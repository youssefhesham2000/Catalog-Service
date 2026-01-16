import { Injectable, Logger } from '@nestjs/common';
import { VariantDocument } from './elasticsearch.service';
import { ProductResultDto, VariantOptionDto } from '../dto/product-result.dto';
import { VariantPreviewDto } from '../dto/variant-preview.dto';
import { OfferPreviewDto } from '../dto/offer-preview.dto';

/**
 * ES hit with score and document
 */
interface ESHit {
  _id: string;
  _score: number;
  _source: VariantDocument;
  sort?: (string | number)[];
}

/**
 * Grouped product with its variants
 */
interface GroupedProduct {
  productId: string;
  name: string;
  description?: string;
  brand?: string;
  categoryId: string;
  categoryName: string;
  maxScore: number;
  variants: ESHit[];
  lastSort?: (string | number)[];
}

/**
 * Product grouping service
 * Groups variant-level ES hits into product-level results
 */
@Injectable()
export class ProductGroupingService {
  private readonly logger = new Logger(ProductGroupingService.name);

  /**
   * Group ES hits by product and select best variant
   * @param hits - Elasticsearch hits (variant documents)
   * @param variantOptionsMap - Map of productId to all variant options
   * @returns Grouped product results
   */
  groupByProduct(
    hits: ESHit[],
    variantOptionsMap: Map<string, VariantOptionDto[]>,
  ): ProductResultDto[] {
    // Group hits by productId
    const productGroups = new Map<string, GroupedProduct>();

    for (const hit of hits) {
      const productId = hit._source.productId;

      if (!productGroups.has(productId)) {
        productGroups.set(productId, {
          productId,
          name: hit._source.productName,
          description: hit._source.productDescription,
          brand: hit._source.brand,
          categoryId: hit._source.categoryId,
          categoryName: hit._source.categoryName,
          maxScore: hit._score,
          variants: [hit],
          lastSort: hit.sort,
        });
      } else {
        const group = productGroups.get(productId)!;
        group.variants.push(hit);
        if (hit._score > group.maxScore) {
          group.maxScore = hit._score;
          group.lastSort = hit.sort;
        }
      }
    }

    // Convert groups to product results
    const results: ProductResultDto[] = [];

    for (const group of productGroups.values()) {
      // Find best variant (highest score, or lowest price as tiebreaker)
      const bestVariant = this.selectBestVariant(group.variants);

      // Select buy box offer (lowest price with stock)
      const bestOffer = this.selectBuyBoxOffer(bestVariant._source);

      // Get variant options from Postgres (or fallback to ES hits)
      const variantOptions =
        variantOptionsMap.get(group.productId) ||
        this.extractVariantOptions(group.variants);

      // Count total offers across all variants
      const offerCount = group.variants.reduce(
        (sum, v) => sum + (v._source.offers?.length || 0),
        0,
      );

      results.push({
        productId: group.productId,
        name: group.name,
        description: group.description,
        brand: group.brand,
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        score: group.maxScore,
        matchedVariant: this.toVariantPreview(bestVariant._source),
        bestOffer,
        variantOptions,
        offerCount,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Select the best variant from a group
   * Criteria: highest score, then lowest price
   * @param variants - Array of variant hits
   * @returns Best variant hit
   */
  private selectBestVariant(variants: ESHit[]): ESHit {
    return variants.reduce((best, current) => {
      if (current._score > best._score) {
        return current;
      }
      if (
        current._score === best._score &&
        current._source.priceFrom < best._source.priceFrom
      ) {
        return current;
      }
      return best;
    });
  }

  /**
   * Select buy box offer (lowest price with stock)
   * @param variant - Variant document
   * @returns Best offer preview
   */
  private selectBuyBoxOffer(variant: VariantDocument): OfferPreviewDto {
    const offers = variant.offers || [];

    // Filter to in-stock offers and sort by price
    const inStockOffers = offers
      .filter((o) => o.stock > 0)
      .sort((a, b) => a.price - b.price);

    // Fall back to any offer if none in stock
    const bestOffer = inStockOffers[0] || offers[0];

    if (!bestOffer) {
      // Return placeholder if no offers
      return {
        offerId: '',
        price: variant.priceFrom,
        stock: 0,
        supplier: {
          supplierId: '',
          name: 'Unknown',
          rating: 0,
        },
      };
    }

    return {
      offerId: bestOffer.offerId,
      price: bestOffer.price,
      stock: bestOffer.stock,
      supplier: {
        supplierId: bestOffer.supplierId,
        name: bestOffer.supplierName,
        rating: bestOffer.supplierRating,
      },
    };
  }

  /**
   * Convert variant document to preview DTO
   * @param variant - Variant document
   * @returns Variant preview
   */
  private toVariantPreview(variant: VariantDocument): VariantPreviewDto {
    return {
      variantId: variant.variantId,
      sku: variant.sku,
      attributes: variant.attributes,
      imageUrl: variant.imageUrl,
      priceFrom: variant.priceFrom,
      totalStock: variant.totalStock,
      sales30d: variant.sales30d,
    };
  }

  /**
   * Extract variant options from ES hits 
   * @param variants - Array of variant hits
   * @returns Variant options
   */
  private extractVariantOptions(variants: ESHit[]): VariantOptionDto[] {
    return variants.map((v) => ({
      variantId: v._source.variantId,
      attributes: v._source.attributes,
      imageUrl: v._source.imageUrl,
    }));
  }

  /**
   * Get last sort values for cursor pagination
   * @param hits - ES hits
   * @returns Sort values from last hit
   */
  getLastSortValues(hits: ESHit[]): (string | number)[] | undefined {
    if (hits.length === 0) {
      return undefined;
    }
    return hits[hits.length - 1].sort;
  }
}

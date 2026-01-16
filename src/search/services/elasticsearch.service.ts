import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenSearchClient } from './opensearch.client';
import { SearchQueryDto } from '../dto/search-query.dto';
import { FacetsQueryDto } from '../dto/facets-query.dto';
import { decodeCursor, CursorPayload } from '../dto/pagination.dto';

/**
 * Variant document structure in OpenSearch
 */
export interface VariantDocument {
  variantId: string;
  productId: string;
  productName: string;
  productDescription?: string;
  brand?: string;
  categoryId: string;
  categoryName: string;
  sku: string;
  attributes: Record<string, string>;
  imageUrl?: string;
  priceFrom: number;
  totalStock: number;
  sales30d: number;
  offers: Array<{
    offerId: string;
    supplierId: string;
    supplierName: string;
    supplierRating: number;
    price: number;
    stock: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search result from OpenSearch
 */
export interface SearchResult {
  hits: Array<{
    _id: string;
    _score: number;
    _source: VariantDocument;
    sort?: (string | number)[];
  }>;
  total: number;
  aggregations?: Record<string, unknown>;
}

/**
 * Allowed facet keys for validation
 */
const ALLOWED_FACET_KEYS = new Set([
  'brand',
  'categoryId',
  'categoryName',
  'priceFrom',
  // Allow any attributes.* field
]);

/**
 * Elasticsearch service
 * Builds and executes OpenSearch queries for product search and facets
 */
@Injectable()
export class ElasticsearchService {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly salesBoostFactor: number;
  private readonly salesBoostModifier: string;

  constructor(
    private readonly openSearchClient: OpenSearchClient,
    private readonly configService: ConfigService,
  ) {
    this.salesBoostFactor = this.configService.get<number>('search.salesBoostFactor', 1.2);
    this.salesBoostModifier = this.configService.get<string>('search.salesBoostModifier', 'log1p');
  }

  /**
   * Execute search query with full-text search, filters, and ranking
   * @param query - Search query parameters
   * @returns Search results with hits and total
   */
  async search(query: SearchQueryDto): Promise<SearchResult> {
    const esQuery = this.buildSearchQuery(query);

    this.logger.debug({
      message: 'Executing search query',
      query: JSON.stringify(esQuery, null, 2),
    });

    const response = await this.openSearchClient.search<VariantDocument>(esQuery);

    return {
      hits: response.hits.map((hit) => ({
        _id: hit._id,
        _score: hit._score,
        _source: hit._source,
        sort: hit.sort,
      })),
      total: response.total,
    };
  }

  /**
   * Execute facets aggregation query
   * @param query - Facets query parameters
   * @returns Aggregation results
   */
  async getFacets(
    query: FacetsQueryDto,
  ): Promise<{ aggregations: Record<string, unknown>; total: number }> {
    const esQuery = this.buildFacetsQuery(query);

    this.logger.debug({
      message: 'Executing facets query',
      query: JSON.stringify(esQuery, null, 2),
    });

    const response = await this.openSearchClient.search<VariantDocument>(esQuery);

    return {
      aggregations: response.aggregations || {},
      total: response.total,
    };
  }

  /**
   * Build search query with multi_match, filters, and function_score
   * @param query - Search query parameters
   * @returns OpenSearch query DSL
   */
  private buildSearchQuery(query: SearchQueryDto): Record<string, unknown> {
    // Build bool query with must (text) and filter clauses
    const boolQuery: Record<string, unknown> = {
      must: [this.buildTextQuery(query.q)],
      filter: this.buildFilters(query),
    };

    // Wrap in function_score for sales boost
    const functionScoreQuery = {
      function_score: {
        query: { bool: boolQuery },
        functions: [
          {
            field_value_factor: {
              field: 'sales30d',
              factor: this.salesBoostFactor,
              modifier: this.salesBoostModifier,
              missing: 1,
            },
          },
        ],
        score_mode: 'multiply',
        boost_mode: 'multiply',
      },
    };

    // Build final query with pagination
    const esQuery: Record<string, unknown> = {
      query: functionScoreQuery,
      size: query.limit || 20,
      sort: [
        { _score: 'desc' },
        { productId: 'asc' }, // Tiebreaker for consistent pagination (productId is already keyword type)
      ],
      _source: true,
    };

    // Handle cursor-based pagination with search_after
    if (query.cursor) {
      const cursorPayload = decodeCursor(query.cursor);
      if (cursorPayload) {
        esQuery.search_after = cursorPayload.sort;
      }
    }

    return esQuery;
  }

  /**
   * Build full-text search query using multi_match
   * @param queryText - Search text
   * @returns Multi-match query
   */
  private buildTextQuery(queryText: string): Record<string, unknown> {
    return {
      multi_match: {
        query: queryText,
        fields: [
          'productName^3',
          'productDescription',
          'brand^2',
          'categoryName',
          'sku',
          'attributes.*',
        ],
        type: 'best_fields',
        fuzziness: 'AUTO',
        prefix_length: 2,
      },
    };
  }

  /**
   * Build filter clauses from query parameters
   * @param query - Search query parameters
   * @returns Array of filter clauses
   */
  private buildFilters(
    query: Pick<SearchQueryDto, 'categoryId' | 'brand' | 'priceRange' | 'filters'>,
  ): Array<Record<string, unknown>> {
    const filters: Array<Record<string, unknown>> = [];

    // Category filter
    if (query.categoryId) {
      filters.push({
        term: { 'categoryId.keyword': query.categoryId },
      });
    }

    // Brand filter
    if (query.brand) {
      filters.push({
        term: { 'brand.keyword': query.brand },
      });
    }

    // Price range filter
    if (query.priceRange) {
      const rangeFilter: Record<string, number> = {};
      if (query.priceRange.min !== undefined) {
        rangeFilter.gte = query.priceRange.min;
      }
      if (query.priceRange.max !== undefined) {
        rangeFilter.lte = query.priceRange.max;
      }
      if (Object.keys(rangeFilter).length > 0) {
        filters.push({
          range: { priceFrom: rangeFilter },
        });
      }
    }

    // Attribute filters (e.g., attributes.color, attributes.size)
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        const fieldName = key.includes('.') ? key : `attributes.${key}`;
        if (Array.isArray(value)) {
          // Multiple values - use terms query
          filters.push({
            terms: { [`${fieldName}.keyword`]: value },
          });
        } else {
          // Single value - use term query
          filters.push({
            term: { [`${fieldName}.keyword`]: value },
          });
        }
      }
    }

    return filters;
  }

  /**
   * Build facets aggregation query
   * @param query - Facets query parameters
   * @returns OpenSearch query with aggregations
   */
  private buildFacetsQuery(query: FacetsQueryDto): Record<string, unknown> {
    // Validate facet keys
    const validatedKeys = this.validateFacetKeys(query.facetKeys);

    // Build bool query for filtering
    const boolQuery: Record<string, unknown> = {
      must: [this.buildTextQuery(query.q)],
      filter: this.buildFilters({
        categoryId: query.categoryId,
        brand: query.brand,
        filters: query.filters,
      }),
    };

    // Build aggregations
    const aggregations: Record<string, unknown> = {};

    for (const key of validatedKeys) {
      if (key === 'priceFrom') {
        // Range aggregation for price
        aggregations[key] = {
          range: {
            field: 'priceFrom',
            ranges: [
              { to: 25, key: 'Under $25' },
              { from: 25, to: 50, key: '$25 - $50' },
              { from: 50, to: 100, key: '$50 - $100' },
              { from: 100, to: 200, key: '$100 - $200' },
              { from: 200, key: 'Over $200' },
            ],
          },
        };
      } else {
        // Terms aggregation for other fields
        const fieldName = key.includes('.') ? key : key;
        aggregations[key] = {
          terms: {
            field: `${fieldName}.keyword`,
            size: 50,
            order: { _count: 'desc' },
          },
        };
      }
    }

    return {
      query: { bool: boolQuery },
      size: 0, // We only want aggregations, not hits
      aggs: aggregations,
    };
  }

  /**
   * Validate facet keys against allowlist
   * @param keys - Requested facet keys
   * @returns Validated keys (invalid ones are filtered out)
   */
  private validateFacetKeys(keys: string[]): string[] {
    return keys.filter((key) => {
      // Allow if in explicit allowlist
      if (ALLOWED_FACET_KEYS.has(key)) {
        return true;
      }
      // Allow any attributes.* field
      if (key.startsWith('attributes.')) {
        return true;
      }
      this.logger.warn(`Invalid facet key rejected: ${key}`);
      return false;
    });
  }

  /**
   * Get human-readable name for facet key
   * @param key - Facet key
   * @returns Display name
   */
  getFacetDisplayName(key: string): string {
    const displayNames: Record<string, string> = {
      brand: 'Brand',
      categoryId: 'Category',
      categoryName: 'Category',
      priceFrom: 'Price',
    };

    if (displayNames[key]) {
      return displayNames[key];
    }

    // Handle attributes.* keys
    if (key.startsWith('attributes.')) {
      const attrName = key.replace('attributes.', '');
      return attrName.charAt(0).toUpperCase() + attrName.slice(1);
    }

    return key;
  }
}

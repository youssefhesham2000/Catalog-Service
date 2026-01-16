import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/database.module';
import { VariantOptionDto } from '../dto/product-result.dto';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';
import { ConfigService } from '@nestjs/config';
import CircuitBreaker from 'opossum';

/**
 * Variant options service
 * Fetches complete variant options from Postgres for product grouping
 * Uses circuit breaker pattern for resilience against database failures
 */
@Injectable()
export class VariantOptionsService implements OnModuleInit {
  private readonly logger = new Logger(VariantOptionsService.name);
  private dbBreaker: CircuitBreaker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Initialize circuit breaker on module start
   */
  onModuleInit() {
    this.dbBreaker = this.circuitBreakerService.create(
      'postgres-variants',
      this.executeVariantQuery.bind(this),
      {
        timeout: this.configService.get<number>('timeouts.database', 10000),
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 5,
      },
    );

    // Set up fallback for when circuit is open
    this.dbBreaker.fallback(() => {
      this.logger.warn('PostgreSQL circuit open - returning empty variant map');
      return new Map<string, VariantOptionDto[]>();
    });
  }

  /**
   * Fetch all variant options for a list of product IDs
   * Uses a single batched query for efficiency
   * Protected by circuit breaker for resilience
   * @param productIds - List of product IDs
   * @returns Map of productId to variant options
   */
  async getVariantOptionsForProducts(
    productIds: string[],
  ): Promise<Map<string, VariantOptionDto[]>> {
    if (productIds.length === 0) {
      return new Map();
    }

    this.logger.debug({
      message: 'Fetching variant options',
      productCount: productIds.length,
    });

    try {
      // Execute through circuit breaker for resilience
      return await this.dbBreaker.fire(productIds) as Map<string, VariantOptionDto[]>;
    } catch (error) {
      this.logger.error({
        message: 'Failed to fetch variant options',
        error: (error as Error).message,
        productIds,
      });

      // Return empty map on error (graceful degradation)
      return new Map();
    }
  }

  /**
   * Internal method to execute variant query (called by circuit breaker)
   * @param productIds - List of product IDs
   * @returns Map of productId to variant options
   */
  private async executeVariantQuery(
    productIds: string[],
  ): Promise<Map<string, VariantOptionDto[]>> {
    // Batch query to fetch all variants for given products
    const variants = await this.prisma.variant.findMany({
      where: {
        productId: {
          in: productIds,
        },
      },
      select: {
        id: true,
        productId: true,
        attributes: true,
        imageUrl: true,
      },
    });

    // Group by productId
    const optionsMap = new Map<string, VariantOptionDto[]>();

    for (const variant of variants) {
      const productId = variant.productId;

      if (!optionsMap.has(productId)) {
        optionsMap.set(productId, []);
      }

      optionsMap.get(productId)!.push({
        variantId: variant.id,
        attributes: variant.attributes as Record<string, string>,
        imageUrl: variant.imageUrl || undefined,
      });
    }

    this.logger.debug({
      message: 'Variant options fetched',
      productCount: productIds.length,
      variantCount: variants.length,
    });

    return optionsMap;
  }

  /**
   * Get distinct attribute keys across all variants for a product
   * Useful for UI to know what filters to show
   * @param productId - Product ID
   * @returns Array of attribute keys
   */
  async getAttributeKeysForProduct(productId: string): Promise<string[]> {
    const variants = await this.prisma.variant.findMany({
      where: { productId },
      select: { attributes: true },
    });

    const keys = new Set<string>();

    for (const variant of variants) {
      const attrs = variant.attributes as Record<string, string>;
      for (const key of Object.keys(attrs)) {
        keys.add(key);
      }
    }

    return Array.from(keys);
  }

  /**
   * Get all distinct values for a specific attribute across product variants
   * @param productId - Product ID
   * @param attributeKey - Attribute key (e.g., 'color', 'size')
   * @returns Array of distinct values
   */
  async getAttributeValuesForProduct(
    productId: string,
    attributeKey: string,
  ): Promise<string[]> {
    const variants = await this.prisma.variant.findMany({
      where: { productId },
      select: { attributes: true },
    });

    const values = new Set<string>();

    for (const variant of variants) {
      const attrs = variant.attributes as Record<string, string>;
      if (attrs[attributeKey]) {
        values.add(attrs[attributeKey]);
      }
    }

    return Array.from(values);
  }
}

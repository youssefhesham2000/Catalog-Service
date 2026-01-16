import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from './services/elasticsearch.service';
import { CacheService } from '../cache/cache.service';
import { MetricsService } from '../common/services/metrics.service';
import { FacetsQueryDto } from './dto/facets-query.dto';
import { FacetsResponseDto } from './dto/facets-response.dto';
import { FacetDto, FacetBucketDto, RangeBucketDto } from './dto/facet.dto';

/**
 * Facets service
 * Provides filter options and counts for search refinement
 */
@Injectable()
export class FacetsService {
  private readonly logger = new Logger(FacetsService.name);
  private readonly cacheTtl: number;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtl = this.configService.get<number>('cache.facetsTtl', 600);
  }

  /**
   * Get facets for search query
   * @param query - Facets query parameters
   * @param correlationId - Request correlation ID
   * @returns Facets response with buckets
   */
  async getFacets(query: FacetsQueryDto, correlationId?: string): Promise<FacetsResponseDto> {
    const startTime = Date.now();

    // Validate facet keys
    if (!query.facetKeys || query.facetKeys.length === 0) {
      throw new BadRequestException('At least one facet key is required');
    }

    // Generate cache key
    const cacheKey = this.cacheService.generateKey('facets', {
      q: query.q,
      facetKeys: query.facetKeys.sort(),
      categoryId: query.categoryId,
      brand: query.brand,
      filters: query.filters,
    });

    // Check cache
    const cached = await this.cacheService.get<FacetsResponseDto>(cacheKey);
    if (cached) {
      this.metricsService.recordCacheHit(cacheKey);
      this.logger.debug({ message: 'Facets cache hit', cacheKey });

      // Update timestamp and return
      cached.meta.timestamp = new Date().toISOString();
      cached.meta.correlationId = correlationId;
      return cached;
    }

    this.metricsService.recordCacheMiss(cacheKey);

    try {
      // Execute facets query
      const { aggregations, total } = await this.elasticsearchService.getFacets(query);

      // Transform aggregations to facets
      const facets = this.transformAggregations(query.facetKeys, aggregations);

      // Build response
      const response: FacetsResponseDto = {
        data: facets,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId,
          totalMatches: total,
          took: Date.now() - startTime,
        },
      };

      // Cache response
      await this.cacheService.set(cacheKey, response, this.cacheTtl);

      // Record metrics
      const latency = Date.now() - startTime;
      this.metricsService.recordSearchLatency(latency, 'facets');

      return response;
    } catch (error) {
      this.logger.error({
        message: 'Facets query failed',
        error: (error as Error).message,
        query,
      });
      throw error;
    }
  }

  /**
   * Transform ES aggregations to facet DTOs
   * @param requestedKeys - Requested facet keys
   * @param aggregations - ES aggregation results
   * @returns Array of facet DTOs
   */
  private transformAggregations(
    requestedKeys: string[],
    aggregations: Record<string, unknown>,
  ): FacetDto[] {
    const facets: FacetDto[] = [];

    for (const key of requestedKeys) {
      const agg = aggregations[key] as
        | { buckets: unknown[] }
        | undefined;

      if (!agg || !agg.buckets) {
        continue;
      }

      if (key === 'priceFrom') {
        // Range facet
        facets.push(this.transformRangeFacet(key, agg.buckets));
      } else {
        // Terms facet
        facets.push(this.transformTermsFacet(key, agg.buckets));
      }
    }

    return facets;
  }

  /**
   * Transform terms aggregation to facet DTO
   */
  private transformTermsFacet(
    key: string,
    buckets: unknown[],
  ): FacetDto {
    const facetBuckets: FacetBucketDto[] = buckets.map((bucket) => {
      const b = bucket as { key: string; doc_count: number };
      return {
        value: String(b.key),
        count: b.doc_count,
      };
    });

    return {
      key,
      name: this.elasticsearchService.getFacetDisplayName(key),
      type: 'terms',
      buckets: facetBuckets,
    };
  }

  /**
   * Transform range aggregation to facet DTO
   */
  private transformRangeFacet(
    key: string,
    buckets: unknown[],
  ): FacetDto {
    const rangeBuckets: RangeBucketDto[] = buckets.map((bucket) => {
      const b = bucket as { key: string; from?: number; to?: number; doc_count: number };
      return {
        from: b.from,
        to: b.to,
        count: b.doc_count,
        label: b.key,
      };
    });

    return {
      key,
      name: this.elasticsearchService.getFacetDisplayName(key),
      type: 'range',
      ranges: rangeBuckets,
    };
  }
}

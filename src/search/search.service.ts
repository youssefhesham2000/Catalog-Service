import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from './services/elasticsearch.service';
import { ProductGroupingService } from './services/product-grouping.service';
import { VariantOptionsService } from './services/variant-options.service';
import { SuggestionService } from './services/suggestion.service';
import { CacheService } from '../cache/cache.service';
import { MetricsService } from '../common/services/metrics.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto, SearchSuggestionDto } from './dto/search-response.dto';
import { ProductResultDto } from './dto/product-result.dto';
import { encodeCursor } from './dto/pagination.dto';

/**
 * Search service
 * Orchestrates search flow: ES query -> product grouping -> variant enrichment
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly cacheTtl: number;

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly productGroupingService: ProductGroupingService,
    private readonly variantOptionsService: VariantOptionsService,
    private readonly suggestionService: SuggestionService,
    private readonly cacheService: CacheService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.cacheTtl = this.configService.get<number>('cache.searchTtl', 300);
  }

  /**
   * Execute product search with full-text, filters, ranking, and grouping
   * @param query - Search query parameters
   * @param correlationId - Request correlation ID
   * @returns Search response with products and metadata
   */
  async search(query: SearchQueryDto, correlationId?: string): Promise<SearchResponseDto> {
    const startTime = Date.now();
    const profile: Record<string, number> = {};

    // Generate cache key
    const cacheKey = this.cacheService.generateKey('search', {
      q: query.q,
      categoryId: query.categoryId,
      brand: query.brand,
      priceRange: query.priceRange,
      filters: query.filters,
      limit: query.limit,
      cursor: query.cursor,
    });

    // Check cache
    const cacheStart = Date.now();
    const cached = await this.cacheService.get<SearchResponseDto>(cacheKey);
    profile.cacheCheck = Date.now() - cacheStart;

    if (cached) {
      this.metricsService.recordCacheHit(cacheKey);
      this.logger.debug({ message: 'Cache hit', cacheKey, profile });

      // Update timestamp and return
      cached.meta.timestamp = new Date().toISOString();
      cached.meta.correlationId = correlationId;
      return cached;
    }

    this.metricsService.recordCacheMiss(cacheKey);

    try {
      // Execute ES search
      const esStart = Date.now();
      const searchResult = await this.elasticsearchService.search(query);
      profile.opensearch = Date.now() - esStart;

      // Handle empty results
      if (searchResult.total === 0) {
        const suggestions = await this.suggestionService.getSuggestions(query.q);
        return this.buildEmptyResponse(query, suggestions, correlationId, startTime);
      }

      // Get product IDs from hits
      const extractStart = Date.now();
      const productIds = [
        ...new Set(searchResult.hits.map((h) => h._source.productId)),
      ];
      profile.extractIds = Date.now() - extractStart;

      // Fetch complete variant options from Postgres
      const pgStart = Date.now();
      const variantOptionsMap =
        await this.variantOptionsService.getVariantOptionsForProducts(productIds);
      profile.postgres = Date.now() - pgStart;

      // Group by product
      const groupStart = Date.now();
      const products = this.productGroupingService.groupByProduct(
        searchResult.hits,
        variantOptionsMap,
      );
      profile.grouping = Date.now() - groupStart;

      // Build cursor for pagination
      const lastHit = searchResult.hits[searchResult.hits.length - 1];
      const nextCursor =
        products.length >= (query.limit || 20) && lastHit?.sort
          ? encodeCursor({ sort: lastHit.sort as (string | number)[] })
          : null;

      // Build response
      const buildStart = Date.now();
      const response = this.buildResponse(
        products,
        searchResult.total,
        nextCursor,
        correlationId,
        startTime,
      );
      profile.buildResponse = Date.now() - buildStart;

      // Cache response
      const cacheWriteStart = Date.now();
      await this.cacheService.set(cacheKey, response, this.cacheTtl);
      profile.cacheWrite = Date.now() - cacheWriteStart;

      // Record metrics
      profile.total = Date.now() - startTime;
      this.metricsService.recordSearchLatency(profile.total, 'search');

      // Log profile for debugging
      this.logger.log({
        message: 'Search profile',
        query: query.q,
        hits: searchResult.hits.length,
        products: products.length,
        profile,
      });

      return response;
    } catch (error) {
      this.logger.error({
        message: 'Search failed',
        error: (error as Error).message,
        query,
      });
      throw error;
    }
  }

  /**
   * Build search response DTO
   */
  private buildResponse(
    products: ProductResultDto[],
    total: number,
    nextCursor: string | null,
    correlationId: string | undefined,
    startTime: number,
  ): SearchResponseDto {
    return {
      data: products,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
        pagination: {
          total,
          count: products.length,
          nextCursor,
        },
        took: Date.now() - startTime,
      },
    };
  }

  /**
   * Build empty search response with suggestions
   */
  private buildEmptyResponse(
    query: SearchQueryDto,
    suggestions: SearchSuggestionDto[],
    correlationId: string | undefined,
    startTime: number,
  ): SearchResponseDto {
    return {
      data: [],
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
        pagination: {
          total: 0,
          count: 0,
          nextCursor: null,
        },
        took: Date.now() - startTime,
      },
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }
}

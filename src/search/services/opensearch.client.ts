import { Injectable, OnModuleInit, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import * as CircuitBreaker from 'opossum';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service';

/**
 * OpenSearch client wrapper
 * Provides connection management and basic operations for the search engine
 * Uses circuit breaker pattern for resilience against failures
 */
@Injectable()
export class OpenSearchClient implements OnModuleInit {
  private readonly logger = new Logger(OpenSearchClient.name);
  private client: Client;
  private indexName: string;
  private searchBreaker: CircuitBreaker;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    this.indexName = this.configService.get<string>('opensearch.indexVariants', 'variants');
  }

  /**
   * Initialize OpenSearch client on module start
   */
  async onModuleInit(): Promise<void> {
    const node = this.configService.get<string>('opensearch.node', 'http://localhost:9200');
    const connectionTimeout = this.configService.get<number>('timeouts.opensearchConnection', 5000);

    // Create OpenSearch client
    // Note: Request timeout is handled by circuit breaker, not the client
    this.client = new Client({
      node,
      ssl: {
        rejectUnauthorized: false, // For development
      },
      // Connection timeout - max time to establish connection
      pingTimeout: connectionTimeout,
      // Retries are handled by circuit breaker pattern
      maxRetries: 1,
      // Sniff on start to discover cluster nodes (disabled for single-node dev)
      sniffOnStart: false,
    });

    // Create circuit breaker for search operations
    this.searchBreaker = this.circuitBreakerService.create(
      'opensearch-search',
      this.executeSearchInternal.bind(this),
      {
        timeout: this.configService.get<number>('timeouts.opensearch', 15000),
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 5,
      },
    );

    // Set up fallback for when circuit is open
    this.searchBreaker.fallback(() => {
      this.logger.warn('OpenSearch circuit open - returning fallback response');
      throw new ServiceUnavailableException(
        'Search service temporarily unavailable. Please try again later.',
      );
    });

    this.logger.log(`Connecting to OpenSearch at ${node}`);

    // Test connection
    try {
      const health = await this.client.cluster.health({});
      this.logger.log(`OpenSearch cluster status: ${health.body.status}`);
    } catch (error) {
      this.logger.error(`Failed to connect to OpenSearch: ${(error as Error).message}`);
    }
  }

  /**
   * Get the underlying OpenSearch client
   * @returns OpenSearch Client instance
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * Get the variants index name
   * @returns Index name string
   */
  getIndexName(): string {
    return this.indexName;
  }

  /**
   * Check if OpenSearch is healthy
   * @returns True if cluster is healthy (green or yellow)
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.client.cluster.health({});
      return ['green', 'yellow'].includes(health.body.status);
    } catch {
      return false;
    }
  }

  /**
   * Execute a search query through circuit breaker
   * @param body - OpenSearch query DSL body
   * @returns Search response (processed)
   */
  async search<T>(body: Record<string, unknown>): Promise<{
    hits: Array<{
      _id: string;
      _score: number;
      _source: T;
      sort?: (string | number)[];
    }>;
    total: number;
    aggregations?: Record<string, unknown>;
  }> {
    // Execute search through circuit breaker for resilience (processed response)
    return this.searchBreaker.fire(body, false) as Promise<{
      hits: Array<{
        _id: string;
        _score: number;
        _source: T;
        sort?: (string | number)[];
      }>;
      total: number;
      aggregations?: Record<string, unknown>;
    }>;
  }

  /**
   * Internal method to execute search (called by circuit breaker)
   * @param body - OpenSearch query DSL body
   * @param rawResponse - If true, returns raw response body
   * @returns Search response (processed or raw)
   */
  private async executeSearchInternal<T>(
    body: Record<string, unknown>,
    rawResponse = false,
  ): Promise<unknown> {
    const response = await this.client.search({
      index: this.indexName,
      body,
    });

    // Return raw response body if requested
    if (rawResponse) {
      return response.body;
    }

    // Process and return structured response
    const hits = response.body.hits.hits.map(
      (hit: { _id: string; _score: number; _source: T; sort?: (string | number)[] }) => ({
        _id: hit._id,
        _score: hit._score,
        _source: hit._source,
        sort: hit.sort,
      }),
    );

    const total =
      typeof response.body.hits.total === 'number'
        ? response.body.hits.total
        : response.body.hits.total.value;

    return {
      hits,
      total,
      aggregations: response.body.aggregations,
    };
  }

  /**
   * Execute a raw search query through circuit breaker
   * Returns the full response body for custom query types (suggestions, etc.)
   * @param body - OpenSearch query DSL body
   * @returns Raw search response body
   */
  async rawSearch(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.searchBreaker.fire(body, true) as Promise<Record<string, unknown>>;
  }

  /**
   * Index a document
   * @param id - Document ID
   * @param document - Document to index
   */
  async index(id: string, document: Record<string, unknown>): Promise<void> {
    await this.client.index({
      index: this.indexName,
      id,
      body: document,
      refresh: true,
    });
  }

  /**
   * Update a document
   * @param id - Document ID
   * @param partialDoc - Partial document for update
   */
  async update(id: string, partialDoc: Record<string, unknown>): Promise<void> {
    await this.client.update({
      index: this.indexName,
      id,
      body: {
        doc: partialDoc,
      },
      refresh: true,
    });
  }

  /**
   * Delete a document
   * @param id - Document ID
   */
  async delete(id: string): Promise<void> {
    try {
      await this.client.delete({
        index: this.indexName,
        id,
        refresh: true,
      });
    } catch (error) {
      // Ignore 404 errors (document doesn't exist)
      if ((error as { statusCode?: number }).statusCode !== 404) {
        throw error;
      }
    }
  }

  /**
   * Check if index exists
   * @returns True if index exists
   */
  async indexExists(): Promise<boolean> {
    const response = await this.client.indices.exists({
      index: this.indexName,
    });
    return response.body;
  }

  /**
   * Create index with mapping
   * @param mapping - Index mapping configuration
   */
  async createIndex(mapping: Record<string, unknown>): Promise<void> {
    const exists = await this.indexExists();
    if (!exists) {
      await this.client.indices.create({
        index: this.indexName,
        body: mapping,
      });
      this.logger.log(`Created index: ${this.indexName}`);
    } else {
      this.logger.log(`Index already exists: ${this.indexName}`);
    }
  }
}

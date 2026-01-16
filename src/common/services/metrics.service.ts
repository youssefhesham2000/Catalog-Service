import { Injectable, Logger } from '@nestjs/common';

/**
 * Metrics service for tracking performance and operational metrics
 * Provides centralized metric collection for observability
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  /**
   * Cache hit/miss counters
   */
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Search latency histogram (simplified - stores last N values)
   */
  private searchLatencies: number[] = [];
  private readonly maxLatencyHistory = 1000;

  /**
   * Record a cache hit
   * @param key - Cache key that was hit
   */
  recordCacheHit(key: string): void {
    this.cacheHits++;
    this.logger.debug({ message: 'Cache hit', key, totalHits: this.cacheHits });
  }

  /**
   * Record a cache miss
   * @param key - Cache key that was missed
   */
  recordCacheMiss(key: string): void {
    this.cacheMisses++;
    this.logger.debug({ message: 'Cache miss', key, totalMisses: this.cacheMisses });
  }

  /**
   * Get cache hit rate
   * @returns Hit rate as percentage (0-100)
   */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) return 0;
    return (this.cacheHits / total) * 100;
  }

  /**
   * Record search latency
   * @param latencyMs - Search latency in milliseconds
   * @param queryType - Type of search query (search, facets)
   */
  recordSearchLatency(latencyMs: number, queryType: 'search' | 'facets'): void {
    this.searchLatencies.push(latencyMs);

    // Keep only last N values to prevent memory growth
    if (this.searchLatencies.length > this.maxLatencyHistory) {
      this.searchLatencies = this.searchLatencies.slice(-this.maxLatencyHistory);
    }

    this.logger.debug({
      message: 'Search latency recorded',
      queryType,
      latencyMs,
    });
  }

  /**
   * Get search latency statistics
   * @returns Object with p50, p95, p99, and average latencies
   */
  getSearchLatencyStats(): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    count: number;
  } {
    if (this.searchLatencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 };
    }

    const sorted = [...this.searchLatencies].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      avg: sum / count,
      count,
    };
  }

  /**
   * Calculate percentile from sorted array
   * @param sorted - Sorted array of numbers
   * @param p - Percentile (0-100)
   * @returns Percentile value
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get all metrics summary
   * @returns Summary of all tracked metrics
   */
  getMetricsSummary(): Record<string, unknown> {
    return {
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: this.getCacheHitRate().toFixed(2) + '%',
      },
      searchLatency: this.getSearchLatencyStats(),
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.searchLatencies = [];
  }
}

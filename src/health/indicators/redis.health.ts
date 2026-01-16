import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CacheService } from '../../cache/cache.service';

/**
 * Redis health indicator
 * Checks Redis cache connectivity using PING command
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  /**
   * Check Redis connectivity
   * @param key - Health indicator key
   * @returns Health indicator result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.cacheService.getClient();
      const response = await client.ping();

      if (response === 'PONG') {
        return this.getStatus(key, true, {
          message: 'Redis is healthy',
        });
      }

      const result = this.getStatus(key, false, {
        message: 'Redis returned unexpected response',
        response,
      });

      throw new HealthCheckError('Redis health check failed', result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        message: 'Redis is unreachable',
        error: (error as Error).message,
      });

      throw new HealthCheckError('Redis health check failed', result);
    }
  }
}

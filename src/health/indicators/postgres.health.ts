import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../database/database.module';

/**
 * PostgreSQL health indicator
 * Checks database connectivity by executing a simple query
 */
@Injectable()
export class PostgresHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Check PostgreSQL connectivity
   * @param key - Health indicator key
   * @returns Health indicator result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Execute simple query to verify connection
      await this.prisma.$queryRaw`SELECT 1`;

      return this.getStatus(key, true, {
        message: 'PostgreSQL is healthy',
      });
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: 'PostgreSQL is unhealthy',
        error: (error as Error).message,
      });

      throw new HealthCheckError('PostgreSQL health check failed', result);
    }
  }
}

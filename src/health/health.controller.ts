import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { PostgresHealthIndicator } from './indicators/postgres.health';
import { OpenSearchHealthIndicator } from './indicators/opensearch.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Health controller
 * Provides health check endpoints for monitoring and load balancer probes
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly postgresHealth: PostgresHealthIndicator,
    private readonly openSearchHealth: OpenSearchHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  /**
   * Comprehensive health check for all dependencies
   * Returns overall health status with per-component details
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check health of all dependencies: PostgreSQL, OpenSearch, Redis',
  })
  @ApiResponse({
    status: 200,
    description: 'All services healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            postgres: { type: 'object' },
            opensearch: { type: 'object' },
            redis: { type: 'object' },
          },
        },
        details: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more services unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  async check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.postgresHealth.isHealthy('postgres'),
      () => this.openSearchHealth.isHealthy('opensearch'),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }

  /**
   * Liveness probe - simple check that the service is running
   * Does not check external dependencies
   */
  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Simple check that the service is running (for Kubernetes liveness probe)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  live(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe - check if service is ready to accept traffic
   * Only checks critical dependencies (database)
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Check if service is ready to accept traffic (for Kubernetes readiness probe)',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
  })
  async ready(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.postgresHealth.isHealthy('postgres'),
      () => this.openSearchHealth.isHealthy('opensearch'),
    ]);
  }
}

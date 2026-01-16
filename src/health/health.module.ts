import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PostgresHealthIndicator } from './indicators/postgres.health';
import { OpenSearchHealthIndicator } from './indicators/opensearch.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { SearchModule } from '../search/search.module';

/**
 * Health module
 * Provides health check endpoints for infrastructure monitoring
 */
@Module({
  imports: [TerminusModule, SearchModule],
  controllers: [HealthController],
  providers: [
    PostgresHealthIndicator,
    OpenSearchHealthIndicator,
    RedisHealthIndicator,
  ],
})
export class HealthModule {}

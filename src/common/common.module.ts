import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { MetricsService } from './services/metrics.service';

/**
 * Common module
 * Provides shared services across the application
 */
@Global()
@Module({
  providers: [CircuitBreakerService, MetricsService],
  exports: [CircuitBreakerService, MetricsService],
})
export class CommonModule {}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CircuitBreaker from 'opossum';

/**
 * Circuit breaker options with sensible defaults
 */
export interface CircuitBreakerOptions {
  /** Timeout for the wrapped function (ms) */
  timeout?: number;
  /** Error percentage threshold to open circuit */
  errorThresholdPercentage?: number;
  /** Time to wait before trying again after circuit opens (ms) */
  resetTimeout?: number;
  /** Minimum number of requests before circuit can trip */
  volumeThreshold?: number;
  /** Rolling window duration for stats (ms) */
  rollingCountTimeout?: number;
  /** Number of buckets in the rolling window */
  rollingCountBuckets?: number;
}

/**
 * Circuit breaker service
 * Provides resilience patterns for external service calls using Opossum
 * - Prevents cascading failures when dependencies are slow or unavailable
 * - Fails fast when circuit is open
 * - Automatically recovers when service becomes healthy
 */
@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly defaultOptions: CircuitBreakerOptions;

  constructor(private readonly configService: ConfigService) {
    this.defaultOptions = {
      timeout: this.configService.get<number>('timeouts.opensearch', 15000),
      errorThresholdPercentage: this.configService.get<number>('circuitBreaker.errorThresholdPercentage', 50),
      resetTimeout: this.configService.get<number>('circuitBreaker.resetTimeout', 30000),
      volumeThreshold: this.configService.get<number>('circuitBreaker.volumeThreshold', 5),
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
    };
  }

  /**
   * Create or get a circuit breaker for a named service
   * @param name - Unique name for the circuit breaker
   * @param fn - Async function to wrap
   * @param options - Circuit breaker options (merged with defaults)
   * @returns Circuit breaker instance
   */
  create<TArgs extends unknown[], TReturn>(
    name: string,
    fn: (...args: TArgs) => Promise<TReturn>,
    options?: CircuitBreakerOptions,
  ): CircuitBreaker<TArgs, TReturn> {
    // Return existing breaker if already created
    if (this.breakers.has(name)) {
      return this.breakers.get(name) as CircuitBreaker<TArgs, TReturn>;
    }

    const mergedOptions = { ...this.defaultOptions, ...options };

    const breaker = new CircuitBreaker(fn, {
      timeout: mergedOptions.timeout,
      errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
      resetTimeout: mergedOptions.resetTimeout,
      volumeThreshold: mergedOptions.volumeThreshold,
      rollingCountTimeout: mergedOptions.rollingCountTimeout,
      rollingCountBuckets: mergedOptions.rollingCountBuckets,
      name,
    });

    // Set up event handlers for monitoring
    this.setupEventHandlers(breaker, name);

    this.breakers.set(name, breaker);
    this.logger.log(
      `Circuit breaker "${name}" created (timeout: ${mergedOptions.timeout}ms, threshold: ${mergedOptions.errorThresholdPercentage}%)`,
    );

    return breaker;
  }

  /**
   * Execute a function through a named circuit breaker
   * @param name - Circuit breaker name
   * @param args - Arguments to pass to the wrapped function
   * @returns Result of the wrapped function
   */
  async fire<TReturn>(name: string, ...args: unknown[]): Promise<TReturn> {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      throw new Error(`Circuit breaker "${name}" not found`);
    }
    return breaker.fire(...args) as Promise<TReturn>;
  }

  /**
   * Get circuit breaker stats for monitoring
   * @param name - Circuit breaker name
   * @returns Stats object or undefined if not found
   */
  getStats(name: string): CircuitBreaker.Stats | undefined {
    return this.breakers.get(name)?.stats;
  }

  /**
   * Get all circuit breakers' health status
   * @returns Map of circuit names to their status
   */
  getAllStatus(): Map<string, { state: string; stats: CircuitBreaker.Stats }> {
    const status = new Map<string, { state: string; stats: CircuitBreaker.Stats }>();
    
    this.breakers.forEach((breaker, name) => {
      let state = 'closed';
      if (breaker.opened) state = 'open';
      else if (breaker.halfOpen) state = 'half-open';
      
      status.set(name, {
        state,
        stats: breaker.stats,
      });
    });

    return status;
  }

  /**
   * Check if a circuit is healthy (closed or half-open)
   * @param name - Circuit breaker name
   * @returns True if circuit is not open
   */
  isHealthy(name: string): boolean {
    const breaker = this.breakers.get(name);
    return breaker ? !breaker.opened : true;
  }

  /**
   * Set up event handlers for logging and monitoring
   */
  private setupEventHandlers(breaker: CircuitBreaker, name: string): void {
    breaker.on('open', () => {
      this.logger.warn({
        message: `Circuit OPENED - failing fast`,
        circuit: name,
        stats: breaker.stats,
      });
    });

    breaker.on('halfOpen', () => {
      this.logger.log({
        message: `Circuit HALF-OPEN - testing recovery`,
        circuit: name,
      });
    });

    breaker.on('close', () => {
      this.logger.log({
        message: `Circuit CLOSED - service recovered`,
        circuit: name,
      });
    });

    breaker.on('timeout', () => {
      this.logger.warn({
        message: `Circuit timeout`,
        circuit: name,
      });
    });

    breaker.on('reject', () => {
      this.logger.debug({
        message: `Circuit rejected request (open)`,
        circuit: name,
      });
    });

    breaker.on('fallback', (result) => {
      this.logger.debug({
        message: `Circuit fallback executed`,
        circuit: name,
        result,
      });
    });
  }

  /**
   * Shutdown all circuit breakers on module destroy
   */
  onModuleDestroy(): void {
    this.breakers.forEach((breaker, name) => {
      breaker.shutdown();
      this.logger.log(`Circuit breaker "${name}" shut down`);
    });
    this.breakers.clear();
  }
}

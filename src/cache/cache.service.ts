import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cache service using Redis
 * Provides get/set/delete operations with TTL support
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize Redis connection on module start
   */
  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('redis.host', 'localhost');
    const port = this.configService.get<number>('redis.port', 6379);
    const password = this.configService.get<string>('redis.password');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });
  }

  /**
   * Close Redis connection on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Check if Redis is connected and healthy
   * @returns True if connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Get Redis client for health checks
   * @returns Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttlSeconds, serialized);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${(error as Error).message}`);
    }
  }

  /**
   * Delete value from cache
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}: ${(error as Error).message}`);
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param pattern - Redis key pattern (e.g., "search:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache deletePattern error for ${pattern}: ${(error as Error).message}`);
    }
  }

  /**
   * Generate cache key for search queries
   * @param prefix - Key prefix
   * @param params - Parameters to include in key
   * @returns Cache key string
   */
  generateKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}:${JSON.stringify(params[k])}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }
}

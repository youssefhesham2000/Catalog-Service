import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import Redis from 'ioredis';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

/**
 * Root application module
 * Configures global modules: config, logging, rate limiting, database, cache, search, health
 */
@Module({
  imports: [
    // Configuration module - loads environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Pino logger - structured JSON logging with file and console output
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pretty = configService.get<boolean>('logging.pretty', false);
        const level = configService.get<string>('logging.level', 'info');
        const logFile = configService.get<string>('logging.file');

        // Use multi-transport when file logging is enabled
        if (logFile) {
          const path = require('path');
          const absoluteLogPath = path.isAbsolute(logFile)
            ? logFile
            : path.join(process.cwd(), logFile);

          return {
            pinoHttp: {
              level,
              transport: {
                targets: [
                  {
                    target: 'pino/file',
                    options: { destination: absoluteLogPath },
                    level,
                  },
                  pretty
                    ? {
                        target: 'pino-pretty',
                        options: { colorize: true, singleLine: true },
                        level,
                      }
                    : {
                        target: 'pino/file',
                        options: { destination: 1 },
                        level,
                      },
                ],
              },
              autoLogging: true,
              redact: ['req.headers.authorization', 'req.headers.cookie'],
            },
          };
        }

        // Simple transport when no file logging
        return {
          pinoHttp: {
            level,
            transport: pretty
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                }
              : undefined,
            autoLogging: true,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),

    // Rate limiting - Redis-backed for distributed environments
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisHost = configService.get<string>('redis.host', 'localhost');
        const redisPort = configService.get<number>('redis.port', 6379);
        const redisPassword = configService.get<string>('redis.password');

        return {
          throttlers: [
            {
              ttl: configService.get<number>('throttle.ttl', 60) * 1000,
              limit: configService.get<number>('throttle.limit', 100),
            },
          ],
          // Use Redis for distributed rate limiting across all API instances
          storage: new ThrottlerStorageRedisService(
            new Redis({
              host: redisHost,
              port: redisPort,
              password: redisPassword || undefined,
              keyPrefix: 'throttle:',
            }),
          ),
        };
      },
    }),

    // Application modules
    CommonModule,
    DatabaseModule,
    CacheModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global timeout interceptor (should be first to wrap all processing)
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    // Global correlation ID interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}

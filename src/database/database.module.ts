import { Global, Module, OnModuleInit, OnModuleDestroy, Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Extended Prisma client with connection lifecycle management and timeouts
 */
@Injectable()
class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(options?: ConstructorParameters<typeof PrismaClient>[0]) {
    super(options);
  }

  /**
   * Connect to database on module initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to PostgreSQL database...');
    await this.$connect();
    this.logger.log('Successfully connected to PostgreSQL database');
  }

  /**
   * Disconnect from database on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from PostgreSQL database...');
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database');
  }

  /**
   * Execute a query with timeout
   * @param fn - Function that performs the database operation
   * @param timeoutMs - Timeout in milliseconds
   * @returns Query result
   * @throws Error if query times out
   */
  async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Database query timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }
}

/**
 * Database module
 * Provides Prisma client as a global singleton for database operations
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queryTimeout = configService.get<number>('timeouts.database', 10000);
        
        const prisma = new PrismaService({
          log: [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
          // Transaction timeout configuration
          transactionOptions: {
            maxWait: queryTimeout,
            timeout: queryTimeout,
          },
        });

        return prisma;
      },
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}

export { PrismaService };

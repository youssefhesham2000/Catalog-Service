import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logging interceptor
 * Logs request/response details including latency for observability
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  /**
   * Intercept request and log details with timing
   * @param context - Execution context
   * @param next - Call handler
   * @returns Observable of the response
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, ip } = request;
    const correlationId = request.headers['x-correlation-id'] as string;
    const userAgent = request.get('user-agent') || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (): void => {
          const latencyMs = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.log({
            message: 'Request completed',
            method,
            url,
            statusCode,
            latencyMs,
            correlationId,
            ip,
            userAgent,
          });
        },
        error: (error: Error): void => {
          const latencyMs = Date.now() - startTime;

          this.logger.error({
            message: 'Request failed',
            method,
            url,
            error: error.message,
            latencyMs,
            correlationId,
            ip,
            userAgent,
          });
        },
      }),
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Global timeout interceptor
 * Ensures all HTTP requests complete within a configured time limit
 * Prevents hung requests from consuming resources indefinitely
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>('timeouts.request', 30000);
  }

  /**
   * Intercept request and apply timeout
   * @param context - Execution context
   * @param next - Call handler
   * @returns Observable that times out after configured duration
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.logger.warn({
            message: 'Request timed out',
            method,
            url,
            timeoutMs: this.timeoutMs,
          });
          return throwError(
            () =>
              new RequestTimeoutException(
                `Request timed out after ${this.timeoutMs}ms`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

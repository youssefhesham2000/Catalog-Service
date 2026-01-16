import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID interceptor
 * Ensures every request has a unique correlation ID for distributed tracing
 * - Uses existing X-Correlation-ID header if provided
 * - Generates a new UUID if not present
 * - Attaches correlation ID to response headers
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  /**
   * Header name for correlation ID
   */
  private readonly CORRELATION_ID_HEADER = 'x-correlation-id';

  /**
   * Intercept request and add correlation ID
   * @param context - Execution context
   * @param next - Call handler
   * @returns Observable of the response
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Get existing correlation ID or generate new one
    let correlationId = request.headers[this.CORRELATION_ID_HEADER] as string;

    if (!correlationId) {
      correlationId = uuidv4();
    }

    // Attach to request for use in logging and error responses
    request.headers[this.CORRELATION_ID_HEADER] = correlationId;

    // Attach to response headers
    response.setHeader(this.CORRELATION_ID_HEADER, correlationId);

    return next.handle();
  }
}

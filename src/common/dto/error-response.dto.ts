import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Error details structure
 */
export class ErrorDetails {
  @ApiProperty({
    description: 'Machine-readable error code',
    example: 'BAD_REQUEST',
    enum: [
      'BAD_REQUEST',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'NOT_FOUND',
      'CONFLICT',
      'UNPROCESSABLE_ENTITY',
      'RATE_LIMIT_EXCEEDED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
    ],
  })
  code: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Invalid query parameter: page must be a positive integer',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Additional error details (e.g., validation errors)',
    example: { validationErrors: ['q must be at least 1 character'] },
  })
  details?: Record<string, unknown>;
}

/**
 * Error metadata structure
 */
export class ErrorMeta {
  @ApiProperty({
    description: 'ISO 8601 timestamp of error',
    example: '2026-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path that caused the error',
    example: '/api/v1/search',
  })
  path: string;

  @ApiPropertyOptional({
    description: 'Request correlation ID for tracing',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  correlationId?: string;
}

/**
 * Standard error response envelope
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Error information',
    type: ErrorDetails,
  })
  error: ErrorDetails;

  @ApiProperty({
    description: 'Error metadata',
    type: ErrorMeta,
  })
  meta: ErrorMeta;
}

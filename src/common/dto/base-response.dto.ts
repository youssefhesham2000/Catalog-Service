import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Pagination metadata for list responses
 */
export class PaginationMeta {
  @ApiProperty({
    description: 'Total number of items matching the query',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Number of items in current page',
    example: 20,
  })
  count: number;

  @ApiPropertyOptional({
    description: 'Cursor for next page (null if no more pages)',
    example: 'eyJzb3J0IjpbMTIzNDU2LCJwcm9kXzEyMyJdfQ==',
    nullable: true,
  })
  nextCursor?: string | null;

  @ApiPropertyOptional({
    description: 'Cursor for previous page (null if on first page)',
    example: null,
    nullable: true,
  })
  prevCursor?: string | null;
}

/**
 * Response metadata envelope
 */
export class ResponseMeta {
  @ApiProperty({
    description: 'ISO 8601 timestamp of response',
    example: '2026-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Request correlation ID for tracing',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  correlationId?: string;

  @ApiPropertyOptional({
    description: 'Pagination metadata for list responses',
    type: PaginationMeta,
  })
  pagination?: PaginationMeta;
}

/**
 * Base response envelope for successful responses
 */
export class BaseResponseDto<T> {
  @ApiProperty({
    description: 'Response data payload',
  })
  data: T;

  @ApiProperty({
    description: 'Response metadata',
    type: ResponseMeta,
  })
  meta: ResponseMeta;
}

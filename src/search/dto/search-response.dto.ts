import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductResultDto } from './product-result.dto';

/**
 * Search pagination metadata
 */
export class SearchPaginationDto {
  @ApiProperty({
    description: 'Total number of matching products',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Number of products in current page',
    example: 20,
  })
  count: number;

  @ApiPropertyOptional({
    description: 'Cursor for next page (null if last page)',
    example: 'eyJzb3J0IjpbMTIzNDU2LCJwcm9kXzEyMyJdfQ==',
    nullable: true,
  })
  nextCursor?: string | null;
}

/**
 * Search suggestions for empty/no results
 */
export class SearchSuggestionDto {
  @ApiProperty({
    description: 'Suggested search term',
    example: 'blue shirt',
  })
  term: string;

  @ApiPropertyOptional({
    description: 'Estimated result count for suggestion',
    example: 45,
  })
  estimatedCount?: number;
}

/**
 * Search response metadata
 */
export class SearchMetaDto {
  @ApiProperty({
    description: 'Response timestamp',
    example: '2026-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Correlation ID for request tracing',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  correlationId?: string;

  @ApiProperty({
    description: 'Pagination information',
    type: SearchPaginationDto,
  })
  pagination: SearchPaginationDto;

  @ApiProperty({
    description: 'Search execution time in milliseconds',
    example: 45,
  })
  took: number;
}

/**
 * Search response DTO
 */
export class SearchResponseDto {
  @ApiProperty({
    description: 'Search result items',
    type: [ProductResultDto],
  })
  data: ProductResultDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: SearchMetaDto,
  })
  meta: SearchMetaDto;

  @ApiPropertyOptional({
    description: 'Search suggestions when no results found',
    type: [SearchSuggestionDto],
  })
  suggestions?: SearchSuggestionDto[];
}

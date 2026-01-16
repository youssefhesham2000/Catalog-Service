import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FacetDto } from './facet.dto';

/**
 * Facets response metadata
 */
export class FacetsMetaDto {
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
    description: 'Total matching documents',
    example: 150,
  })
  totalMatches: number;

  @ApiProperty({
    description: 'Execution time in milliseconds',
    example: 25,
  })
  took: number;
}

/**
 * Facets response DTO
 */
export class FacetsResponseDto {
  @ApiProperty({
    description: 'List of facets with their buckets',
    type: [FacetDto],
  })
  data: FacetDto[];

  @ApiProperty({
    description: 'Response metadata',
    type: FacetsMetaDto,
  })
  meta: FacetsMetaDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Facet bucket (term aggregation result)
 */
export class FacetBucketDto {
  @ApiProperty({
    description: 'Facet value',
    example: 'red',
  })
  value: string;

  @ApiProperty({
    description: 'Document count for this value',
    example: 42,
  })
  count: number;
}

/**
 * Range bucket (for price ranges)
 */
export class RangeBucketDto {
  @ApiPropertyOptional({
    description: 'Range start (inclusive)',
    example: 0,
  })
  from?: number;

  @ApiPropertyOptional({
    description: 'Range end (exclusive)',
    example: 50,
  })
  to?: number;

  @ApiProperty({
    description: 'Document count in this range',
    example: 125,
  })
  count: number;

  @ApiProperty({
    description: 'Human-readable label',
    example: 'Under $50',
  })
  label: string;
}

/**
 * Single facet definition
 */
export class FacetDto {
  @ApiProperty({
    description: 'Facet key/field name',
    example: 'attributes.color',
  })
  key: string;

  @ApiProperty({
    description: 'Human-readable facet name',
    example: 'Color',
  })
  name: string;

  @ApiProperty({
    description: 'Facet type',
    enum: ['terms', 'range'],
    example: 'terms',
  })
  type: 'terms' | 'range';

  @ApiPropertyOptional({
    description: 'Term buckets (for type=terms)',
    type: [FacetBucketDto],
  })
  buckets?: FacetBucketDto[];

  @ApiPropertyOptional({
    description: 'Range buckets (for type=range)',
    type: [RangeBucketDto],
  })
  ranges?: RangeBucketDto[];
}

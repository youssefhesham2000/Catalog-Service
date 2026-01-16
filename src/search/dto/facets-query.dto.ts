import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Facets query parameters DTO
 */
export class FacetsQueryDto {
  @ApiProperty({
    description: 'Free text search query (same as search endpoint)',
    example: 'red shirt',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  q: string;

  @ApiProperty({
    description: 'List of facet keys to return',
    example: ['brand', 'attributes.color', 'attributes.size'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((s: string) => s.trim());
    }
    return value;
  })
  facetKeys: string[];

  @ApiPropertyOptional({
    description: 'Category ID to filter by',
    example: 'cat_fashion_123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Brand name to filter by',
    example: 'Nike',
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Current active filters (to compute facet counts on filtered results)',
    example: { 'attributes.color': 'red' },
  })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  filters?: Record<string, string | string[]>;
}

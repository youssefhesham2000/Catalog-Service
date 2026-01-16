import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Price range filter
 */
export class PriceRangeDto {
  @ApiPropertyOptional({
    description: 'Minimum price',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  min?: number;

  @ApiPropertyOptional({
    description: 'Maximum price',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  max?: number;
}

/**
 * Attribute filters for search
 */
export class AttributeFiltersDto {
  [key: string]: string | string[];
}

/**
 * Search query parameters DTO
 */
export class SearchQueryDto {
  @ApiProperty({
    description: 'Free text search query',
    example: 'red shirt',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  q: string;

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
    description: 'Price range filter',
    type: PriceRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  priceRange?: PriceRangeDto;

  @ApiPropertyOptional({
    description: 'Attribute filters (e.g., color, size)',
    example: { 'attributes.color': 'red', 'attributes.size': 'M' },
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

  @ApiPropertyOptional({
    description: 'Number of results per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (from previous response)',
    example: 'eyJzb3J0IjpbMTIzNDU2LCJwcm9kXzEyMyJdfQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

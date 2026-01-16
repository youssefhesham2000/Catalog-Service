import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Variant preview for search results
 * Contains essential variant information for display
 */
export class VariantPreviewDto {
  @ApiProperty({
    description: 'Variant ID',
    example: 'var_123',
  })
  variantId: string;

  @ApiProperty({
    description: 'SKU (Stock Keeping Unit)',
    example: 'TSHIRT-RED-M-VNECK',
  })
  sku: string;

  @ApiProperty({
    description: 'Variant attributes',
    example: { color: 'red', size: 'M', neckline: 'V-Neck' },
  })
  attributes: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Variant image URL',
    example: 'https://cdn.example.com/images/var_123.jpg',
  })
  imageUrl?: string;

  @ApiProperty({
    description: 'Lowest price across all offers',
    example: 29.99,
  })
  priceFrom: number;

  @ApiProperty({
    description: 'Total stock across all offers',
    example: 150,
  })
  totalStock: number;

  @ApiProperty({
    description: '30-day sales count',
    example: 1250,
  })
  sales30d: number;
}

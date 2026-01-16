import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariantPreviewDto } from './variant-preview.dto';
import { OfferPreviewDto } from './offer-preview.dto';

/**
 * Variant option (e.g., { color: 'red', size: 'M' })
 */
export class VariantOptionDto {
  @ApiProperty({
    description: 'Variant ID',
    example: 'var_123',
  })
  variantId: string;

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
}

/**
 * Product search result DTO
 */
export class ProductResultDto {
  @ApiProperty({
    description: 'Product ID',
    example: 'prod_123',
  })
  productId: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Classic Cotton T-Shirt',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Comfortable cotton t-shirt for everyday wear',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Product brand',
    example: 'Nike',
  })
  brand?: string;

  @ApiProperty({
    description: 'Category ID',
    example: 'cat_fashion_123',
  })
  categoryId: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Fashion > Tops > T-Shirts',
  })
  categoryName: string;

  @ApiProperty({
    description: 'Search relevance score',
    example: 15.234,
  })
  score: number;

  @ApiProperty({
    description: 'Best matching variant (highest relevance or lowest price)',
    type: VariantPreviewDto,
  })
  matchedVariant: VariantPreviewDto;

  @ApiProperty({
    description: 'Best offer for the matched variant (buy box)',
    type: OfferPreviewDto,
  })
  bestOffer: OfferPreviewDto;

  @ApiProperty({
    description: 'Available variant options for this product',
    type: [VariantOptionDto],
  })
  variantOptions: VariantOptionDto[];

  @ApiProperty({
    description: 'Number of offers available for this product',
    example: 5,
  })
  offerCount: number;
}

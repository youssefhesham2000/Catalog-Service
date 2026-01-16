import { ApiProperty } from '@nestjs/swagger';

/**
 * Supplier preview for offer display
 */
export class SupplierPreviewDto {
  @ApiProperty({
    description: 'Supplier ID',
    example: 'sup_456',
  })
  supplierId: string;

  @ApiProperty({
    description: 'Supplier name',
    example: 'Fashion Direct',
  })
  name: string;

  @ApiProperty({
    description: 'Supplier rating (0-5)',
    example: 4.5,
  })
  rating: number;
}

/**
 * Offer preview for search results
 * Represents the "buy box" winning offer
 */
export class OfferPreviewDto {
  @ApiProperty({
    description: 'Offer ID',
    example: 'offer_789',
  })
  offerId: string;

  @ApiProperty({
    description: 'Offer price',
    example: 29.99,
  })
  price: number;

  @ApiProperty({
    description: 'Available stock',
    example: 50,
  })
  stock: number;

  @ApiProperty({
    description: 'Supplier information',
    type: SupplierPreviewDto,
  })
  supplier: SupplierPreviewDto;
}

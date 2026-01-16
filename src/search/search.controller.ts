import {
  Controller,
  Get,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { FacetsService } from './facets.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { FacetsQueryDto } from './dto/facets-query.dto';
import { FacetsResponseDto } from './dto/facets-response.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

/**
 * Search controller
 * REST API endpoints for product search and facets
 */
@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly facetsService: FacetsService,
  ) {}

  /**
   * Search products with full-text search and filters
   * Returns product-level results with variant options and best offers
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search products',
    description:
      'Full-text search with attribute filtering, product grouping, and best-selling ranking',
  })
  @ApiQuery({ name: 'q', description: 'Search query', example: 'red shirt' })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'brand', required: false, description: 'Filter by brand' })
  @ApiQuery({
    name: 'priceRange[min]',
    required: false,
    description: 'Minimum price filter',
    type: Number,
  })
  @ApiQuery({
    name: 'priceRange[max]',
    required: false,
    description: 'Maximum price filter',
    type: Number,
  })
  @ApiQuery({
    name: 'filters',
    required: false,
    description: 'Attribute filters as JSON object',
    example: '{"attributes.color":"red"}',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (1-100)',
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor from previous response',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: SearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async search(
    @Query() query: SearchQueryDto,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<SearchResponseDto> {
    return this.searchService.search(query, correlationId);
  }

  /**
   * Get facets/filter options for a search query
   * Returns available filter values with counts
   */
  @Get('facets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get search facets',
    description:
      'Get available filter options and counts for a search query. Call when user opens filter panel.',
  })
  @ApiQuery({ name: 'q', description: 'Search query', example: 'shirt' })
  @ApiQuery({
    name: 'facetKeys',
    description: 'Comma-separated list of facet keys',
    example: 'brand,attributes.color,attributes.size',
  })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'brand', required: false, description: 'Filter by brand' })
  @ApiQuery({
    name: 'filters',
    required: false,
    description: 'Active filters to compute counts on filtered results',
    example: '{"attributes.color":"red"}',
  })
  @ApiResponse({
    status: 200,
    description: 'Facet results',
    type: FacetsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: ErrorResponseDto,
  })
  async getFacets(
    @Query() query: FacetsQueryDto,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<FacetsResponseDto> {
    return this.facetsService.getFacets(query, correlationId);
  }
}

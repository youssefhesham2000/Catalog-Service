import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenSearchClient } from './services/opensearch.client';
import { ElasticsearchService } from './services/elasticsearch.service';
import { ProductGroupingService } from './services/product-grouping.service';
import { VariantOptionsService } from './services/variant-options.service';
import { SuggestionService } from './services/suggestion.service';
import { SearchService } from './search.service';
import { FacetsService } from './facets.service';
import { SearchController } from './search.controller';
import { MetricsService } from '../common/services/metrics.service';

/**
 * Search module
 * Provides product search and facets functionality using OpenSearch
 */
@Module({
  imports: [ConfigModule],
  controllers: [SearchController],
  providers: [
    OpenSearchClient,
    ElasticsearchService,
    ProductGroupingService,
    VariantOptionsService,
    SuggestionService,
    SearchService,
    FacetsService,
    MetricsService,
  ],
  exports: [SearchService, FacetsService, OpenSearchClient],
})
export class SearchModule {}

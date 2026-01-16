import { Injectable, Logger } from '@nestjs/common';
import { OpenSearchClient } from './opensearch.client';
import { SearchSuggestionDto } from '../dto/search-response.dto';

/**
 * Suggestion service
 * Provides search suggestions when no results are found
 */
@Injectable()
export class SuggestionService {
  private readonly logger = new Logger(SuggestionService.name);

  constructor(private readonly openSearchClient: OpenSearchClient) {}

  /**
   * Generate search suggestions for a query with no results
   * @param originalQuery - Original search query that returned no results
   * @returns Array of suggestions
   */
  async getSuggestions(originalQuery: string): Promise<SearchSuggestionDto[]> {
    try {
      const suggestions: SearchSuggestionDto[] = [];

      // Strategy 1: Did-you-mean using phrase suggester
      const phraseSuggestions = await this.getPhraseSuggestions(originalQuery);
      suggestions.push(...phraseSuggestions);

      // Strategy 2: Popular searches (simplified - would use search analytics in production)
      const popularSuggestions = await this.getPopularSuggestions(originalQuery);
      suggestions.push(...popularSuggestions);

      // Deduplicate and limit
      const seen = new Set<string>();
      return suggestions
        .filter((s) => {
          const normalized = s.term.toLowerCase();
          if (seen.has(normalized)) {
            return false;
          }
          seen.add(normalized);
          return true;
        })
        .slice(0, 5);
    } catch (error) {
      this.logger.error({
        message: 'Failed to generate suggestions',
        error: (error as Error).message,
        query: originalQuery,
      });
      return [];
    }
  }

  /**
   * Get phrase suggestions using OpenSearch suggest API
   * @param query - Search query
   * @returns Phrase suggestions
   */
  private async getPhraseSuggestions(query: string): Promise<SearchSuggestionDto[]> {
    try {
      // Use rawSearch which goes through circuit breaker
      const response = await this.openSearchClient.rawSearch({
        suggest: {
          text: query,
          productName: {
            phrase: {
              field: 'productName',
              size: 3,
              gram_size: 2,
              direct_generator: [
                {
                  field: 'productName',
                  suggest_mode: 'popular',
                },
              ],
              highlight: {
                pre_tag: '',
                post_tag: '',
              },
            },
          },
        },
      });

      const suggestions: SearchSuggestionDto[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const suggestResult = (response as any).suggest?.productName?.[0]?.options || [];

      for (const option of suggestResult) {
        suggestions.push({
          term: option.text,
          estimatedCount: option.score ? Math.round(option.score * 100) : undefined,
        });
      }

      return suggestions;
    } catch (error) {
      this.logger.debug({
        message: 'Phrase suggester failed',
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Get popular/related suggestions using term aggregation
   * Finds products with similar categories or brands
   * @param query - Search query
   * @returns Related suggestions
   */
  private async getPopularSuggestions(query: string): Promise<SearchSuggestionDto[]> {
    try {
      // Fuzzy search to find loosely related products - uses circuit breaker
      const response = await this.openSearchClient.rawSearch({
        query: {
          multi_match: {
            query,
            fields: ['productName', 'brand', 'categoryName'],
            fuzziness: 'AUTO:3,6',
            prefix_length: 1,
          },
        },
        size: 0,
        aggs: {
          popular_brands: {
            terms: {
              field: 'brand.keyword',
              size: 3,
            },
          },
          popular_categories: {
            terms: {
              field: 'categoryName.keyword',
              size: 3,
            },
          },
        },
      });

      const suggestions: SearchSuggestionDto[] = [];

      // Add brand suggestions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const brandBuckets = ((response as any).aggregations?.popular_brands as any)?.buckets || [];
      for (const bucket of brandBuckets.slice(0, 2)) {
        // Combine original query terms with brand
        const queryWords = query.toLowerCase().split(/\s+/);
        const brandWords = bucket.key.toLowerCase().split(/\s+/);
        const combined = [...new Set([...queryWords, ...brandWords])].join(' ');

        suggestions.push({
          term: combined,
          estimatedCount: bucket.doc_count,
        });
      }

      // Add category-based suggestions
      const categoryBuckets =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((response as any).aggregations?.popular_categories as any)?.buckets || [];
      for (const bucket of categoryBuckets.slice(0, 2)) {
        suggestions.push({
          term: bucket.key,
          estimatedCount: bucket.doc_count,
        });
      }

      return suggestions;
    } catch (error) {
      this.logger.debug({
        message: 'Popular suggestions failed',
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Check if suggestions are available for this query
   * Quick check before full suggestion generation
   * @param query - Search query
   * @returns True if suggestions might be available
   */
  async hasPotentialSuggestions(query: string): Promise<boolean> {
    // Quick fuzzy search to see if any documents match loosely
    try {
      const response = await this.openSearchClient.search({
        query: {
          multi_match: {
            query,
            fields: ['productName', 'brand'],
            fuzziness: 'AUTO',
          },
        },
        size: 1,
        _source: false,
      });

      return response.total > 0;
    } catch {
      return false;
    }
  }
}

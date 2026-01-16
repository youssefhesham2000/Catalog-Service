import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { OpenSearchClient } from '../../search/services/opensearch.client';

/**
 * OpenSearch health indicator
 * Checks search engine cluster health status
 */
@Injectable()
export class OpenSearchHealthIndicator extends HealthIndicator {
  constructor(private readonly openSearchClient: OpenSearchClient) {
    super();
  }

  /**
   * Check OpenSearch cluster health
   * @param key - Health indicator key
   * @returns Health indicator result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.openSearchClient.getClient();
      const health = await client.cluster.health({});

      const status = health.body.status;
      const isHealthy = ['green', 'yellow'].includes(status);

      if (isHealthy) {
        return this.getStatus(key, true, {
          status,
          numberOfNodes: health.body.number_of_nodes,
          activeShards: health.body.active_shards,
          message: `OpenSearch cluster is ${status}`,
        });
      }

      const result = this.getStatus(key, false, {
        status,
        message: `OpenSearch cluster is ${status}`,
      });

      throw new HealthCheckError('OpenSearch health check failed', result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        message: 'OpenSearch is unreachable',
        error: (error as Error).message,
      });

      throw new HealthCheckError('OpenSearch health check failed', result);
    }
  }
}

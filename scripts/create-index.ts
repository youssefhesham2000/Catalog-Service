/**
 * OpenSearch Index Creation Script
 * Creates the variants index with appropriate mapping for product search
 *
 * Usage: npx ts-node scripts/create-index.ts
 */

import { Client } from '@opensearch-project/opensearch';

const INDEX_NAME = process.env.OPENSEARCH_INDEX_VARIANTS || 'variants';
const OPENSEARCH_NODE = process.env.OPENSEARCH_NODE || 'http://localhost:9200';

/**
 * Variants index mapping
 * Optimized for full-text search, filtering, and aggregations
 */
const INDEX_MAPPING = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        product_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'product_synonyms'],
        },
      },
      filter: {
        product_synonyms: {
          type: 'synonym',
          synonyms: [
            'tshirt, t-shirt, tee',
            'pants, trousers, jeans',
            'sneakers, trainers, runners',
          ],
        },
      },
    },
  },
  mappings: {
    properties: {
      // Variant identifiers
      variantId: { type: 'keyword' },
      productId: { type: 'keyword' },
      sku: { type: 'keyword' },

      // Product information (denormalized for search)
      productName: {
        type: 'text',
        analyzer: 'product_analyzer',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      productDescription: {
        type: 'text',
        analyzer: 'standard',
      },
      brand: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },

      // Category
      categoryId: { type: 'keyword' },
      categoryName: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },

      // Variant attributes (dynamic mapping for arbitrary attributes)
      attributes: {
        type: 'object',
        dynamic: true,
        properties: {
          // Common attributes with explicit mapping
          color: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          size: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
        },
      },

      // Media
      imageUrl: { type: 'keyword', index: false },

      // Pricing and stock (aggregated across offers)
      priceFrom: { type: 'float' },
      totalStock: { type: 'integer' },

      // Sales metrics (for ranking)
      sales30d: { type: 'integer' },

      // Offers (nested for complex queries)
      offers: {
        type: 'nested',
        properties: {
          offerId: { type: 'keyword' },
          supplierId: { type: 'keyword' },
          supplierName: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          supplierRating: { type: 'float' },
          price: { type: 'float' },
          stock: { type: 'integer' },
        },
      },

      // Timestamps
      createdAt: { type: 'date' },
      updatedAt: { type: 'date' },
    },

    // Dynamic templates for arbitrary attributes
    dynamic_templates: [
      {
        attributes_as_keyword: {
          path_match: 'attributes.*',
          mapping: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
        },
      },
    ],
  },
};

/**
 * Main function - creates index if not exists
 */
async function main(): Promise<void> {
  console.log(`Connecting to OpenSearch at ${OPENSEARCH_NODE}...`);

  const client = new Client({
    node: OPENSEARCH_NODE,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Check cluster health
    const health = await client.cluster.health({});
    console.log(`Cluster status: ${health.body.status}`);

    // Check if index exists
    const exists = await client.indices.exists({ index: INDEX_NAME });

    if (exists.body) {
      console.log(`Index "${INDEX_NAME}" already exists`);

      // Optionally update mapping (uncomment if needed)
      // await client.indices.putMapping({
      //   index: INDEX_NAME,
      //   body: INDEX_MAPPING.mappings,
      // });
      // console.log('Index mapping updated');

      return;
    }

    // Create index
    console.log(`Creating index "${INDEX_NAME}"...`);
    await client.indices.create({
      index: INDEX_NAME,
      body: INDEX_MAPPING,
    });

    console.log(`Index "${INDEX_NAME}" created successfully`);

    // Verify index
    const mapping = await client.indices.getMapping({ index: INDEX_NAME });
    console.log('Index mapping:', JSON.stringify(mapping.body, null, 2));
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();

/**
 * OpenSearch Reindex Script
 * Syncs all variants from PostgreSQL to OpenSearch
 *
 * Usage: npx ts-node scripts/reindex.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Client } from '@opensearch-project/opensearch';

const INDEX_NAME = process.env.OPENSEARCH_INDEX_VARIANTS || 'variants';
const OPENSEARCH_NODE = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
const BATCH_SIZE = 500;

type VariantWithRelations = Prisma.VariantGetPayload<{
  include: {
    product: {
      include: {
        category: true;
      };
    };
    offers: {
      include: {
        supplier: true;
      };
    };
    sales: true;
  };
}>;

/**
 * Transform Prisma variant to ES document
 */
function toESDocument(variant: VariantWithRelations): Record<string, unknown> {
  // Calculate aggregated values across offers
  const activeOffers = variant.offers.filter((o) => o.isActive && o.stock > 0);
  const priceFrom =
    activeOffers.length > 0
      ? Math.min(...activeOffers.map((o) => Number(o.price)))
      : variant.offers.length > 0
        ? Math.min(...variant.offers.map((o) => Number(o.price)))
        : 0;

  const totalStock = variant.offers
    .filter((o) => o.isActive)
    .reduce((sum, o) => sum + o.stock, 0);

  return {
    variantId: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    productName: variant.product.name,
    productDescription: variant.product.description,
    brand: variant.product.brand,
    categoryId: variant.product.categoryId,
    categoryName: variant.product.category.name,
    attributes: variant.attributes,
    imageUrl: variant.imageUrl,
    priceFrom,
    totalStock,
    sales30d: variant.sales?.sales30d || 0,
    offers: variant.offers
      .filter((o) => o.isActive)
      .map((o) => ({
        offerId: o.id,
        supplierId: o.supplierId,
        supplierName: o.supplier.name,
        supplierRating: o.supplier.rating || 0,
        price: Number(o.price),
        stock: o.stock,
      })),
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
}

/**
 * Main function - reindexes all variants
 */
async function main(): Promise<void> {
  console.log('Starting reindex...');
  console.log(`OpenSearch: ${OPENSEARCH_NODE}`);
  console.log(`Index: ${INDEX_NAME}`);

  const prisma = new PrismaClient();
  const opensearch = new Client({
    node: OPENSEARCH_NODE,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Get total count
    const totalCount = await prisma.variant.count();
    console.log(`Total variants: ${totalCount}`);

    let processed = 0;
    let cursor: string | undefined;

    while (true) {
      // Fetch batch with cursor pagination
      const variants = await prisma.variant.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        include: {
          product: {
            include: {
              category: true,
            },
          },
          offers: {
            include: {
              supplier: true,
            },
          },
          sales: true,
        },
      });

      if (variants.length === 0) {
        break;
      }

      // Prepare bulk operations
      const bulkBody: Array<Record<string, unknown>> = [];

      for (const variant of variants) {
        bulkBody.push({
          index: {
            _index: INDEX_NAME,
            _id: variant.id,
          },
        });
        bulkBody.push(toESDocument(variant));
      }

      // Execute bulk index
      const bulkResponse = await opensearch.bulk({
        body: bulkBody,
        refresh: false,
      });

      if (bulkResponse.body.errors) {
        const errors = bulkResponse.body.items
          .filter((item: { index?: { error?: unknown } }) => item.index?.error)
          .map((item: { index?: { error?: unknown } }) => item.index?.error);
        console.error('Bulk index errors:', errors.slice(0, 5));
      }

      processed += variants.length;
      cursor = variants[variants.length - 1].id;

      console.log(`Progress: ${processed}/${totalCount} (${((processed / totalCount) * 100).toFixed(1)}%)`);
    }

    // Refresh index
    console.log('Refreshing index...');
    await opensearch.indices.refresh({ index: INDEX_NAME });

    // Get final count
    const indexCount = await opensearch.count({ index: INDEX_NAME });
    console.log(`\nReindex complete!`);
    console.log(`Documents in index: ${indexCount.body.count}`);
  } catch (error) {
    console.error('Error:', (error as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

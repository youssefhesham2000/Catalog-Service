/**
 * Bulk Seed Script - 2 Million Records
 * Generates realistic product data at scale for load testing
 *
 * Usage: RECORDS=2000000 ts-node scripts/seed-bulk.ts
 */

import { PrismaClient } from '@prisma/client';
import { Client } from '@opensearch-project/opensearch';

// Configuration
const TOTAL_VARIANTS = parseInt(process.env.RECORDS || '2000000', 10);
const BATCH_SIZE = 5000; // Records per batch
const ES_BULK_SIZE = 2000; // ES documents per bulk request

const OPENSEARCH_NODE = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
const INDEX_NAME = process.env.OPENSEARCH_INDEX_VARIANTS || 'variants';

// Sample data pools
const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'Reebok', 'Under Armour', 'New Balance',
  'StyleBasics', 'FashionFirst', 'TrendSetters', 'Urban Edge',
  'Premium Picks', 'Classic Wear', 'Modern Style', 'Elite Fashion',
  'Budget Basics', 'Comfort Zone', 'Active Life', 'Street Style',
  'Vintage Vibes', 'Eco Friendly', 'Luxe Label', 'Daily Wear',
  'Sport Pro', 'Casual Co', 'Weekend Warriors', 'Office Essentials'
];

const CATEGORIES = [
  { name: 'T-Shirts', parent: 'Fashion' },
  { name: 'Jeans', parent: 'Fashion' },
  { name: 'Sneakers', parent: 'Footwear' },
  { name: 'Boots', parent: 'Footwear' },
  { name: 'Headphones', parent: 'Electronics' },
  { name: 'Smartwatches', parent: 'Electronics' },
  { name: 'Phones', parent: 'Electronics' },
  { name: 'Laptops', parent: 'Electronics' },
  { name: 'Backpacks', parent: 'Accessories' },
  { name: 'Watches', parent: 'Accessories' },
  { name: 'Sunglasses', parent: 'Accessories' },
  { name: 'Jackets', parent: 'Fashion' },
  { name: 'Hoodies', parent: 'Fashion' },
  { name: 'Shorts', parent: 'Fashion' },
  { name: 'Dresses', parent: 'Fashion' },
  { name: 'Sandals', parent: 'Footwear' },
];

const COLORS = ['Red', 'Blue', 'Green', 'Black', 'White', 'Gray', 'Navy', 'Pink', 'Yellow', 'Orange', 'Purple', 'Brown', 'Beige', 'Teal', 'Maroon'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '6', '7', '8', '9', '10', '11', '12', '28', '30', '32', '34', '36'];
const MATERIALS = ['Cotton', 'Polyester', 'Leather', 'Denim', 'Wool', 'Silk', 'Nylon', 'Canvas', 'Suede', 'Mesh'];

const PRODUCT_ADJECTIVES = ['Premium', 'Classic', 'Modern', 'Vintage', 'Essential', 'Comfort', 'Pro', 'Elite', 'Ultra', 'Flex', 'Air', 'Max', 'Lite', 'Sport'];
const PRODUCT_NOUNS = ['Edition', 'Series', 'Collection', 'Line', 'Range', 'Style', 'Design', 'Model', 'Version', 'Type'];

const SUPPLIER_NAMES = [
  'Fashion Direct', 'Style Hub', 'TrendSetters Store', 'Budget Outlet',
  'Premium Picks', 'Mega Mart', 'Quick Ship', 'Best Deals', 'Top Seller',
  'Value Store', 'Express Shop', 'Daily Deals', 'Super Saver', 'Elite Store',
  'Fast Fashion', 'Quality First', 'Smart Shop', 'Easy Buy', 'Great Value', 'Top Choice'
];

// Utility functions
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generateSku(productIndex: number, variantIndex: number): string {
  return `SKU-${productIndex.toString().padStart(7, '0')}-${variantIndex.toString().padStart(3, '0')}`;
}

function generateProductName(category: string): string {
  const adj = randomElement(PRODUCT_ADJECTIVES);
  const noun = randomElement(PRODUCT_NOUNS);
  return `${adj} ${category} ${noun}`;
}

function generateDescription(category: string, brand: string): string {
  const descriptions = [
    `High-quality ${category.toLowerCase()} from ${brand}. Perfect for everyday use.`,
    `${brand}'s premium ${category.toLowerCase()} collection. Designed for comfort and style.`,
    `Experience the best in ${category.toLowerCase()} with this ${brand} product.`,
    `Comfortable and stylish ${category.toLowerCase()} by ${brand}. A must-have for your wardrobe.`,
    `${brand} brings you this amazing ${category.toLowerCase()}. Quality you can trust.`,
  ];
  return randomElement(descriptions);
}

async function main(): Promise<void> {
  console.log('🚀 Bulk Seed Script - Loading 2M Records');
  console.log(`   Target: ${TOTAL_VARIANTS.toLocaleString()} variants`);
  console.log(`   Batch size: ${BATCH_SIZE.toLocaleString()}`);
  console.log('');

  const prisma = new PrismaClient();
  const opensearch = new Client({
    node: OPENSEARCH_NODE,
    ssl: { rejectUnauthorized: false },
  });

  const startTime = Date.now();

  try {
    // Step 1: Clean existing data
    console.log('🧹 Cleaning existing data...');
    await prisma.offerSales.deleteMany();
    await prisma.variantSales.deleteMany();
    await prisma.salesEvent.deleteMany();
    await prisma.offer.deleteMany();
    await prisma.variant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.category.deleteMany();
    await prisma.outboxEvent.deleteMany();

    // Delete and recreate ES index
    try {
      await opensearch.indices.delete({ index: INDEX_NAME });
      console.log('   Deleted existing ES index');
    } catch {
      // Index doesn't exist
    }

    // Create index with optimized settings for bulk loading
    await opensearch.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 0, // Disable replicas during bulk load
          refresh_interval: '-1', // Disable refresh during bulk load
          'index.translog.durability': 'async',
        },
        mappings: {
          properties: {
            variantId: { type: 'keyword' },
            productId: { type: 'keyword' },
            sku: { type: 'keyword' },
            productName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            productDescription: { type: 'text' },
            brand: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            categoryId: { type: 'keyword' },
            categoryName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            attributes: { type: 'object', dynamic: true },
            imageUrl: { type: 'keyword', index: false },
            priceFrom: { type: 'float' },
            totalStock: { type: 'integer' },
            sales30d: { type: 'integer' },
            offers: {
              type: 'nested',
              properties: {
                offerId: { type: 'keyword' },
                supplierId: { type: 'keyword' },
                supplierName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
                supplierRating: { type: 'float' },
                price: { type: 'float' },
                stock: { type: 'integer' },
              },
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });
    console.log('   Created new ES index');

    // Step 2: Create categories
    console.log('\n📁 Creating categories...');
    const categoryMap = new Map<string, string>();
    const parentCategories = [...new Set(CATEGORIES.map((c) => c.parent))];

    for (const parentName of parentCategories) {
      const parent = await prisma.category.create({ data: { name: parentName } });
      categoryMap.set(parentName, parent.id);
    }

    for (const cat of CATEGORIES) {
      const child = await prisma.category.create({
        data: { name: cat.name, parentId: categoryMap.get(cat.parent) },
      });
      categoryMap.set(cat.name, child.id);
    }
    console.log(`   Created ${categoryMap.size} categories`);

    // Step 3: Create suppliers
    console.log('\n🏪 Creating suppliers...');
    const supplierMap = new Map<string, { id: string; name: string; rating: number }>();

    for (const name of SUPPLIER_NAMES) {
      const supplier = await prisma.supplier.create({
        data: { name, rating: randomPrice(3.5, 5.0) },
      });
      supplierMap.set(name, { id: supplier.id, name, rating: supplier.rating || 4.0 });
    }
    console.log(`   Created ${supplierMap.size} suppliers`);

    // Step 4: Generate products, variants, offers in batches
    console.log('\n📦 Generating data in batches...');

    const categoryList = CATEGORIES.map((c) => ({
      id: categoryMap.get(c.name)!,
      name: c.name,
    }));
    const supplierList = Array.from(supplierMap.values());

    // Calculate distribution: ~3 variants per product on average
    const VARIANTS_PER_PRODUCT = 3;
    const TOTAL_PRODUCTS = Math.ceil(TOTAL_VARIANTS / VARIANTS_PER_PRODUCT);
    const PRODUCTS_PER_BATCH = Math.ceil(BATCH_SIZE / VARIANTS_PER_PRODUCT);

    let totalVariants = 0;
    let totalOffers = 0;
    let productIndex = 0;
    let esDocuments: Record<string, unknown>[] = [];

    const totalBatches = Math.ceil(TOTAL_PRODUCTS / PRODUCTS_PER_BATCH);

    for (let batch = 0; batch < totalBatches && totalVariants < TOTAL_VARIANTS; batch++) {
      const batchStart = Date.now();
      const productsInBatch: Array<{
        id: string;
        name: string;
        description: string;
        brand: string;
        categoryId: string;
        categoryName: string;
      }> = [];

      const variantsInBatch: Array<{
        id: string;
        productId: string;
        sku: string;
        attributes: Record<string, string>;
        imageUrl: string;
        product: (typeof productsInBatch)[0];
      }> = [];

      const offersInBatch: Array<{
        id: string;
        variantId: string;
        supplierId: string;
        price: number;
        stock: number;
        isActive: boolean;
        supplier: (typeof supplierList)[0];
      }> = [];

      // Generate products for this batch
      for (let p = 0; p < PRODUCTS_PER_BATCH && totalVariants < TOTAL_VARIANTS; p++) {
        productIndex++;
        const category = randomElement(categoryList);
        const brand = randomElement(BRANDS);
        const productId = `prod_${productIndex.toString().padStart(8, '0')}`;

        const product = {
          id: productId,
          name: generateProductName(category.name),
          description: generateDescription(category.name, brand),
          brand,
          categoryId: category.id,
          categoryName: category.name,
        };
        productsInBatch.push(product);

        // Generate 1-5 variants per product
        const numVariants = randomInt(1, 5);
        for (let v = 0; v < numVariants && totalVariants < TOTAL_VARIANTS; v++) {
          totalVariants++;
          const variantId = `var_${totalVariants.toString().padStart(8, '0')}`;

          const variant = {
            id: variantId,
            productId: product.id,
            sku: generateSku(productIndex, v + 1),
            attributes: {
              color: randomElement(COLORS),
              size: randomElement(SIZES),
              material: randomElement(MATERIALS),
            },
            imageUrl: `https://cdn.example.com/images/${variantId}.jpg`,
            product,
          };
          variantsInBatch.push(variant);

          // Generate 1-3 offers per variant
          const numOffers = randomInt(1, 3);
          const selectedSuppliers = supplierList
            .sort(() => Math.random() - 0.5)
            .slice(0, numOffers);

          for (const supplier of selectedSuppliers) {
            totalOffers++;
            offersInBatch.push({
              id: `off_${totalOffers.toString().padStart(8, '0')}`,
              variantId: variant.id,
              supplierId: supplier.id,
              price: randomPrice(10, 200),
              stock: randomInt(0, 500),
              isActive: Math.random() > 0.1, // 90% active
              supplier,
            });
          }
        }
      }

      // Bulk insert to PostgreSQL
      await prisma.product.createMany({
        data: productsInBatch.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          brand: p.brand,
          categoryId: p.categoryId,
        })),
        skipDuplicates: true,
      });

      await prisma.variant.createMany({
        data: variantsInBatch.map((v) => ({
          id: v.id,
          productId: v.productId,
          sku: v.sku,
          attributes: v.attributes,
          imageUrl: v.imageUrl,
        })),
        skipDuplicates: true,
      });

      await prisma.offer.createMany({
        data: offersInBatch.map((o) => ({
          id: o.id,
          variantId: o.variantId,
          supplierId: o.supplierId,
          price: o.price,
          stock: o.stock,
          isActive: o.isActive,
        })),
        skipDuplicates: true,
      });

      // Create variant sales
      await prisma.variantSales.createMany({
        data: variantsInBatch.map((v) => ({
          variantId: v.id,
          sales30d: randomInt(0, 5000),
        })),
        skipDuplicates: true,
      });

      // Prepare ES documents
      for (const variant of variantsInBatch) {
        const variantOffers = offersInBatch.filter((o) => o.variantId === variant.id);
        const activeOffers = variantOffers.filter((o) => o.isActive && o.stock > 0);
        const priceFrom = activeOffers.length > 0
          ? Math.min(...activeOffers.map((o) => o.price))
          : variantOffers.length > 0
            ? Math.min(...variantOffers.map((o) => o.price))
            : 0;
        const totalStock = variantOffers.filter((o) => o.isActive).reduce((sum, o) => sum + o.stock, 0);

        esDocuments.push({ index: { _index: INDEX_NAME, _id: variant.id } });
        esDocuments.push({
          variantId: variant.id,
          productId: variant.product.id,
          sku: variant.sku,
          productName: variant.product.name,
          productDescription: variant.product.description,
          brand: variant.product.brand,
          categoryId: variant.product.categoryId,
          categoryName: variant.product.categoryName,
          attributes: variant.attributes,
          imageUrl: variant.imageUrl,
          priceFrom,
          totalStock,
          sales30d: randomInt(0, 5000),
          offers: variantOffers.filter((o) => o.isActive).map((o) => ({
            offerId: o.id,
            supplierId: o.supplierId,
            supplierName: o.supplier.name,
            supplierRating: o.supplier.rating,
            price: o.price,
            stock: o.stock,
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Bulk index to ES when buffer is full
        if (esDocuments.length >= ES_BULK_SIZE * 2) {
          await opensearch.bulk({ body: esDocuments, refresh: false });
          esDocuments = [];
        }
      }

      const batchDuration = ((Date.now() - batchStart) / 1000).toFixed(1);
      const progress = ((totalVariants / TOTAL_VARIANTS) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = (totalVariants / ((Date.now() - startTime) / 1000)).toFixed(0);

      process.stdout.write(
        `\r   Progress: ${totalVariants.toLocaleString()}/${TOTAL_VARIANTS.toLocaleString()} (${progress}%) | ` +
        `${rate} rec/s | ${elapsed} min elapsed | Batch: ${batchDuration}s`
      );
    }

    // Flush remaining ES documents
    if (esDocuments.length > 0) {
      await opensearch.bulk({ body: esDocuments, refresh: false });
    }

    console.log('\n');

    // Step 5: Finalize ES index
    console.log('🔧 Finalizing OpenSearch index...');
    await opensearch.indices.refresh({ index: INDEX_NAME });
    await opensearch.indices.putSettings({
      index: INDEX_NAME,
      body: {
        'index.refresh_interval': '1s',
        'index.number_of_replicas': 1,
      },
    });

    // Get final counts
    const pgVariantCount = await prisma.variant.count();
    const pgProductCount = await prisma.product.count();
    const pgOfferCount = await prisma.offer.count();
    const esCount = await opensearch.count({ index: INDEX_NAME });

    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log('\n✅ Bulk seed completed!');
    console.log('');
    console.log('📊 Final Statistics:');
    console.log(`   PostgreSQL:`);
    console.log(`     - Products: ${pgProductCount.toLocaleString()}`);
    console.log(`     - Variants: ${pgVariantCount.toLocaleString()}`);
    console.log(`     - Offers: ${pgOfferCount.toLocaleString()}`);
    console.log(`   OpenSearch:`);
    console.log(`     - Documents: ${esCount.body.count.toLocaleString()}`);
    console.log(`   Duration: ${totalDuration} minutes`);
    console.log(`   Rate: ${(pgVariantCount / (parseFloat(totalDuration) * 60)).toFixed(0)} variants/second`);

  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

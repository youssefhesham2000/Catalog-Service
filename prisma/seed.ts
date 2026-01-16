/**
 * Database Seed Script
 * Creates sample data for development and testing
 *
 * Usage: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Sample categories
 */
const categories = [
  { name: 'Fashion', children: ['Tops', 'Bottoms', 'Footwear', 'Accessories'] },
  { name: 'Electronics', children: ['Phones', 'Laptops', 'Audio', 'Accessories'] },
  { name: 'Home & Garden', children: ['Furniture', 'Decor', 'Kitchen', 'Garden'] },
];

/**
 * Sample suppliers
 */
const suppliers = [
  { name: 'Fashion Direct', rating: 4.5 },
  { name: 'Style Hub', rating: 4.2 },
  { name: 'TrendSetters', rating: 4.8 },
  { name: 'Budget Basics', rating: 3.9 },
  { name: 'Premium Picks', rating: 4.7 },
];

/**
 * Sample products with variants
 */
const products = [
  {
    name: 'Classic Cotton T-Shirt',
    description: 'Comfortable everyday cotton t-shirt with a relaxed fit',
    brand: 'StyleBasics',
    category: 'Tops',
    variants: [
      { sku: 'TSHIRT-RED-S', attributes: { color: 'Red', size: 'S', neckline: 'Crew' } },
      { sku: 'TSHIRT-RED-M', attributes: { color: 'Red', size: 'M', neckline: 'Crew' } },
      { sku: 'TSHIRT-RED-L', attributes: { color: 'Red', size: 'L', neckline: 'Crew' } },
      { sku: 'TSHIRT-BLUE-S', attributes: { color: 'Blue', size: 'S', neckline: 'Crew' } },
      { sku: 'TSHIRT-BLUE-M', attributes: { color: 'Blue', size: 'M', neckline: 'Crew' } },
      { sku: 'TSHIRT-BLUE-L', attributes: { color: 'Blue', size: 'L', neckline: 'Crew' } },
      { sku: 'TSHIRT-GREEN-M', attributes: { color: 'Green', size: 'M', neckline: 'V-Neck' } },
    ],
  },
  {
    name: 'Premium Denim Jeans',
    description: 'High-quality denim jeans with modern slim fit',
    brand: 'DenimCraft',
    category: 'Bottoms',
    variants: [
      { sku: 'JEANS-BLUE-30', attributes: { color: 'Indigo', waist: '30', fit: 'Slim' } },
      { sku: 'JEANS-BLUE-32', attributes: { color: 'Indigo', waist: '32', fit: 'Slim' } },
      { sku: 'JEANS-BLUE-34', attributes: { color: 'Indigo', waist: '34', fit: 'Slim' } },
      { sku: 'JEANS-BLACK-32', attributes: { color: 'Black', waist: '32', fit: 'Regular' } },
    ],
  },
  {
    name: 'Running Sneakers Pro',
    description: 'Lightweight running shoes with cushioned sole',
    brand: 'SprintX',
    category: 'Footwear',
    variants: [
      { sku: 'SNEAK-WHITE-9', attributes: { color: 'White', size: '9', style: 'Running' } },
      { sku: 'SNEAK-WHITE-10', attributes: { color: 'White', size: '10', style: 'Running' } },
      { sku: 'SNEAK-BLACK-9', attributes: { color: 'Black', size: '9', style: 'Running' } },
      { sku: 'SNEAK-BLACK-10', attributes: { color: 'Black', size: '10', style: 'Running' } },
      { sku: 'SNEAK-RED-10', attributes: { color: 'Red', size: '10', style: 'Running' } },
    ],
  },
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-cancelling wireless headphones',
    brand: 'AudioMax',
    category: 'Audio',
    variants: [
      { sku: 'HEAD-BLACK', attributes: { color: 'Black', type: 'Over-ear' } },
      { sku: 'HEAD-WHITE', attributes: { color: 'White', type: 'Over-ear' } },
      { sku: 'HEAD-SILVER', attributes: { color: 'Silver', type: 'Over-ear' } },
    ],
  },
  {
    name: 'Smart Watch Series X',
    description: 'Advanced smartwatch with health monitoring features',
    brand: 'TechWear',
    category: 'Accessories',
    variants: [
      { sku: 'WATCH-BLACK-S', attributes: { color: 'Black', bandSize: 'Small' } },
      { sku: 'WATCH-BLACK-L', attributes: { color: 'Black', bandSize: 'Large' } },
      { sku: 'WATCH-SILVER-S', attributes: { color: 'Silver', bandSize: 'Small' } },
      { sku: 'WATCH-SILVER-L', attributes: { color: 'Silver', bandSize: 'Large' } },
    ],
  },
];

/**
 * Main seed function
 */
async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  // Create categories
  console.log('Creating categories...');
  const categoryMap = new Map<string, string>();

  for (const cat of categories) {
    const parent = await prisma.category.create({
      data: { name: cat.name },
    });
    categoryMap.set(cat.name, parent.id);

    for (const childName of cat.children) {
      const child = await prisma.category.create({
        data: {
          name: childName,
          parentId: parent.id,
        },
      });
      categoryMap.set(childName, child.id);
    }
  }
  console.log(`  Created ${categoryMap.size} categories`);

  // Create suppliers
  console.log('Creating suppliers...');
  const supplierMap = new Map<string, string>();

  for (const sup of suppliers) {
    const supplier = await prisma.supplier.create({
      data: {
        name: sup.name,
        rating: sup.rating,
      },
    });
    supplierMap.set(sup.name, supplier.id);
  }
  console.log(`  Created ${supplierMap.size} suppliers`);

  // Create products with variants and offers
  console.log('Creating products...');
  let variantCount = 0;
  let offerCount = 0;

  for (const prod of products) {
    const categoryId = categoryMap.get(prod.category);
    if (!categoryId) {
      console.warn(`  Category not found: ${prod.category}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        name: prod.name,
        description: prod.description,
        brand: prod.brand,
        categoryId,
      },
    });

    for (const v of prod.variants) {
      const variant = await prisma.variant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          attributes: v.attributes,
          imageUrl: `https://cdn.example.com/images/${v.sku.toLowerCase()}.jpg`,
        },
      });
      variantCount++;

      // Create offers from random suppliers
      const supplierNames = Array.from(supplierMap.keys());
      const numOffers = Math.floor(Math.random() * 3) + 1; // 1-3 offers per variant
      const selectedSuppliers = supplierNames
        .sort(() => Math.random() - 0.5)
        .slice(0, numOffers);

      for (const supplierName of selectedSuppliers) {
        const supplierId = supplierMap.get(supplierName)!;
        const basePrice = 20 + Math.random() * 80; // $20-$100

        const offer = await prisma.offer.create({
          data: {
            variantId: variant.id,
            supplierId,
            price: parseFloat(basePrice.toFixed(2)),
            stock: Math.floor(Math.random() * 100) + 10,
            isActive: true,
          },
        });
        offerCount++;

        // Create some sales data
        const sales30d = Math.floor(Math.random() * 500);
        await prisma.offerSales.create({
          data: {
            offerId: offer.id,
            sales30d,
          },
        });
      }

      // Create variant sales aggregate
      const totalSales = Math.floor(Math.random() * 1000);
      await prisma.variantSales.create({
        data: {
          variantId: variant.id,
          sales30d: totalSales,
        },
      });
    }
  }

  console.log(`  Created ${products.length} products`);
  console.log(`  Created ${variantCount} variants`);
  console.log(`  Created ${offerCount} offers`);

  console.log('\n✅ Seed completed successfully!');
  console.log('\nNext steps:');
  console.log('  1. Run: npm run es:create-index');
  console.log('  2. Run: npm run es:reindex');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

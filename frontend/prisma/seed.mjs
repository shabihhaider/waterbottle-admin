// prisma/seed.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // ---- Customers (aligns with your enum + fields) ----
  const customers = [
    {
      name: 'Karachi Hydration',
      email: 'contact@kh.com',
      phone: '+92 300 1111111',
      address: 'Shahrah-e-Faisal, Karachi',
      status: 'ACTIVE',
      rating: 5,
      creditLimit: 50000.00,
      notes: 'VIP office client; weekly deliveries',
    },
    {
      name: 'Lahore Fresh',
      email: 'hello@lf.pk',
      phone: '+92 321 2222222',
      address: 'Mall Road, Lahore',
      status: 'ACTIVE',
      rating: 4,
      creditLimit: 25000.00,
      notes: 'Prefers morning slot',
    },
    {
      name: 'Islamabad Springs',
      email: 'info@isprings.pk',
      phone: '+92 333 3333333',
      address: 'Blue Area, Islamabad',
      status: 'VIP',
      rating: 5,
      creditLimit: 100000.00,
      notes: 'High volume corporate account',
    },
    {
      name: 'Quetta Pure',
      email: 'team@qp.pk',
      phone: '+92 345 4444444',
      address: 'Jinnah Road, Quetta',
      status: 'INACTIVE',
      rating: 2,
      creditLimit: 10000.00,
      notes: 'Inactive last 3 months',
    },
    {
      name: 'Peshawar Aqua',
      email: 'care@paq.pk',
      phone: '+92 355 5555555',
      address: 'GT Road, Peshawar',
      status: 'ACTIVE',
      rating: 3,
      creditLimit: 15000.00,
      notes: null,
    },
  ];

  // Use email (unique) to upsert
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { email: c.email },
      update: {
        name: c.name,
        phone: c.phone,
        address: c.address,
        status: c.status,
        rating: c.rating,
        creditLimit: c.creditLimit,
        notes: c.notes,
      },
      create: c,
    });
  }

  // ---- Products (minimal, useful for later) ----
  const products = [
    {
      sku: 'WB-19L-STD',
      name: '19L Water Bottle',
      description: 'Refillable 19-liter bottle',
      brand: 'AquaPak',
      sizeLiters: 19.0,
      type: 'BOTTLE',
      category: 'WATER',
      costPrice: 120.0,
      salePrice: 180.0,
      stock: 120,
      lowStockLevel: 20,
    },
    {
      sku: 'WB-6L-PACK4',
      name: '6L Water (Pack of 4)',
      description: 'Four 6-liter bottles',
      brand: 'AquaPak',
      sizeLiters: 24.0,
      type: 'PACK',
      category: 'WATER',
      costPrice: 320.0,
      salePrice: 480.0,
      stock: 50,
      lowStockLevel: 10,
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        description: p.description,
        brand: p.brand,
        sizeLiters: p.sizeLiters,
        type: p.type,
        category: p.category,
        costPrice: p.costPrice,
        salePrice: p.salePrice,
        stock: p.stock,
        lowStockLevel: p.lowStockLevel,
      },
      create: p,
    });
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

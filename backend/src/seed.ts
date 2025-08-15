import { prisma } from './prisma';
import { hashPassword } from './utils/auth';

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@hydropak.pk' },
    update: {},
    create: {
      email: 'admin@hydropak.pk',
      name: 'Admin',
      passwordHash: await hashPassword('Admin@123'),
      role: 'ADMIN',
    },
  });

  await prisma.customer.upsert({
    where: { email: 'ali@example.com' },
    update: {},
    create: {
      name: 'Ali Traders',
      email: 'ali@example.com',
      phone: '0300-1234567',
      address: 'Lahore',
    },
  });

  console.log('Seeded:', admin.email);
}

main().catch(console.error).finally(() => process.exit());

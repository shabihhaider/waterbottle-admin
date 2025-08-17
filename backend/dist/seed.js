"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./prisma");
const auth_1 = require("./utils/auth");
async function main() {
    const admin = await prisma_1.prisma.user.upsert({
        where: { email: 'admin@hydropak.pk' },
        update: {},
        create: {
            email: 'admin@hydropak.pk',
            name: 'Admin',
            passwordHash: await (0, auth_1.hashPassword)('Admin@123'),
            role: 'ADMIN',
        },
    });
    await prisma_1.prisma.customer.upsert({
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
//# sourceMappingURL=seed.js.map
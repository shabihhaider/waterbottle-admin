// backend/prisma.config.ts
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  seed: 'node prisma/seed.mjs', // if you have prisma/seed.mjs
});

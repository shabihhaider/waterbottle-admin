// backend/src/env.ts
import dotenv from 'dotenv';
dotenv.config();

// Centralized, typed environment access with sane fallbacks.
export const env = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 5050,
  JWT_SECRET: process.env.JWT_SECRET || 'change_me',
  DATABASE_URL: process.env.DATABASE_URL!,

  // S3 / storage (optional in your current setup)
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  S3_REGION: process.env.S3_REGION || 'ap-south-1',
  S3_BUCKET: process.env.S3_BUCKET || '',

  // Puppeteer (optional for PDF rendering)
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,

  // NEW: Frontend origins for CORS (match your Next dev)
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  FRONTEND_ORIGIN_ALT: process.env.FRONTEND_ORIGIN_ALT || 'http://127.0.0.1:3000',
} as const;

export type Env = typeof env;

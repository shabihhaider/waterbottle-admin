// backend/src/index.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './env';

// Routers
import auth from './routes/auth';
import customers from './routes/customers';
import products from './routes/products';
import orders from './routes/orders';
import invoices from './routes/invoices';
import dashboard from './routes/dashboard';
import drivers from './routes/drivers';
import deliveries from './routes/deliveries';
import analytics from './routes/analytics';

// ---- Process guards --------------------------------------------------------
process.on('unhandledRejection', (e) => {
  console.error('UNHANDLED_REJECTION', e);
});
process.on('uncaughtException', (e) => {
  console.error('UNCAUGHT_EXCEPTION', e);
});

// ---- Env & CORS ------------------------------------------------------------
const PORT = Number(env.PORT || 5050);
// Frontend origins allowed to call this API (no wildcard when using credentials)
// const FRONTEND_ORIGIN = env.FRONTEND_ORIGIN || 'http://localhost:3000';
// const FRONTEND_ORIGIN_ALT = env.FRONTEND_ORIGIN_ALT || 'http://127.0.0.1:3000';

const FRONTEND_ORIGIN = env.FRONTEND_ORIGIN || 'http://localhost:3000';
const FRONTEND_ORIGIN_ALT = env.FRONTEND_ORIGIN_ALT || 'http://localhost:5173';
const FRONTEND_ORIGIN_PROD = process.env.FRONTEND_ORIGIN_PROD || 'https://waterbottle-admin-inzmu4v0l-shabihhaiders-projects.vercel.app';
console.log('Booting API with env:', { PORT, FRONTEND_ORIGIN, FRONTEND_ORIGIN_ALT });

// ---- App -------------------------------------------------------------------
const app = express();

// Security (disable CORP to allow PDF/image rendering if needed)
app.use(helmet({ crossOriginResourcePolicy: false }));

// Logging & parsers
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configured for dev FE
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // SSR/CLI/postman
      const allowed = [FRONTEND_ORIGIN, FRONTEND_ORIGIN_ALT, FRONTEND_ORIGIN_PROD].filter(Boolean);
      cb(null, allowed.includes(origin));
    },
    credentials: false, // ✅ you use Bearer tokens, not cookies
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Debug-User', 'X-Debug-Email'],
  })
);
// Handle preflight globally
app.options('*', cors());

// ---- Healthcheck -----------------------------------------------------------
app.get('/health', (_req, res) => {
  res.statusCode = 200;
  res.json({ ok: true });
});

// ---- Routes ----------------------------------------------------------------
app.use('/api/auth', auth);
app.use('/api/customers', customers);
app.use('/api/products', products);
app.use('/api/orders', orders);
app.use('/api/invoices', invoices);
app.use('/api/dashboard', dashboard);
app.use('/api/drivers', drivers);
app.use('/api/deliveries', deliveries);
app.use('/api/analytics', analytics);

// 404 handler
app.use((_req, res) => {
  res.statusCode = 404;
  res.json({ message: 'Not Found' });
});

// Error handler (last)
app.use((err: any, _req: any, res: any, _next: any) => {
  const e = err as { status?: number; message?: string; body?: unknown; stack?: string };
  const status = e?.status ?? 500;
  const message = e?.message ?? 'Internal Server Error';
  console.error('[ERROR]', status, message, e?.stack);
  res.statusCode = status;
  res.json({ message, error: e?.body });
});

// Bind explicitly to 127.0.0.1 (Windows friendliness)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✅ API running on http://${HOST}:${PORT}`);
});
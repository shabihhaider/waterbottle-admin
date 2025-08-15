// backend/src/index.ts
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
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
const FRONTEND_ORIGIN_ALT = env.FRONTEND_ORIGIN_ALT || 'http://127.0.0.1:3000';
const FRONTEND_ORIGIN_PROD = process.env.FRONTEND_ORIGIN_PROD; // e.g. https://your-frontend.vercel.app

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
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
  })
);
// Handle preflight globally
app.options('*', cors());

// ---- Healthcheck -----------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ ok: true });
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
app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));

// Error handler (last)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status || 500;
  const message = err?.message || 'Internal Server Error';
  const body = err?.body;
  console.error('[ERROR]', status, message, err?.stack);
  res.status(status).json({ message, error: body });
});

// Bind explicitly to 127.0.0.1 (Windows friendliness)
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✅ API running on http://${HOST}:${PORT}`);
});

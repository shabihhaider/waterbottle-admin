"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./env");
const auth_1 = __importDefault(require("./routes/auth"));
const customers_1 = __importDefault(require("./routes/customers"));
const products_1 = __importDefault(require("./routes/products"));
const orders_1 = __importDefault(require("./routes/orders"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const drivers_1 = __importDefault(require("./routes/drivers"));
const deliveries_1 = __importDefault(require("./routes/deliveries"));
const analytics_1 = __importDefault(require("./routes/analytics"));
process.on('unhandledRejection', (e) => {
    console.error('UNHANDLED_REJECTION', e);
});
process.on('uncaughtException', (e) => {
    console.error('UNCAUGHT_EXCEPTION', e);
});
const PORT = Number(env_1.env.PORT || 5050);
const FRONTEND_ORIGIN = env_1.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const FRONTEND_ORIGIN_ALT = env_1.env.FRONTEND_ORIGIN_ALT || 'http://127.0.0.1:3000';
const FRONTEND_ORIGIN_PROD = process.env.FRONTEND_ORIGIN_PROD;
console.log('Booting API with env:', { PORT, FRONTEND_ORIGIN, FRONTEND_ORIGIN_ALT });
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({
    origin(origin, cb) {
        if (!origin)
            return cb(null, true);
        const allowed = [FRONTEND_ORIGIN, FRONTEND_ORIGIN_ALT, FRONTEND_ORIGIN_PROD].filter(Boolean);
        cb(null, allowed.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
}));
app.options('*', (0, cors_1.default)());
app.get('/health', (_req, res) => {
    res.statusCode = 200;
    res.json({ ok: true });
});
app.use('/api/auth', auth_1.default);
app.use('/api/customers', customers_1.default);
app.use('/api/products', products_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/invoices', invoices_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/drivers', drivers_1.default);
app.use('/api/deliveries', deliveries_1.default);
app.use('/api/analytics', analytics_1.default);
app.use((_req, res) => {
    res.statusCode = 404;
    res.json({ message: 'Not Found' });
});
app.use((err, _req, res, _next) => {
    const e = err;
    const status = e?.status ?? 500;
    const message = e?.message ?? 'Internal Server Error';
    console.error('[ERROR]', status, message, e?.stack);
    res.statusCode = status;
    res.json({ message, error: e?.body });
});
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`✅ API running on http://${HOST}:${PORT}`);
});
//# sourceMappingURL=index.js.map
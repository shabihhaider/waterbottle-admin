"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    PORT: process.env.PORT ? Number(process.env.PORT) : 5050,
    JWT_SECRET: process.env.JWT_SECRET || 'change_me',
    DATABASE_URL: process.env.DATABASE_URL,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || '',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
    S3_REGION: process.env.S3_REGION || 'ap-south-1',
    S3_BUCKET: process.env.S3_BUCKET || '',
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    FRONTEND_ORIGIN_ALT: process.env.FRONTEND_ORIGIN_ALT || 'http://127.0.0.1:3000',
};
//# sourceMappingURL=env.js.map
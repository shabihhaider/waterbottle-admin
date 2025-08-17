"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const auth_1 = require("../utils/auth");
const prisma_1 = require("../prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const PUBLIC_API_PATHS = ['/api/auth/login'];
const isDev = process.env.NODE_ENV !== 'production';
const allowDevBypass = isDev || String(process.env.ALLOW_DEV_AUTH || '').toLowerCase() === 'true';
function normalizeJwtPayload(p) {
    if (!p || typeof p !== 'object')
        return {};
    const id = p.id || p.userId || p.uid || p.sub || undefined;
    const email = p.email || p.user_email || undefined;
    const role = p.role || p.user_role || undefined;
    return { id, email, role };
}
async function getOrCreateDevUser(hintId, hintEmail) {
    if (hintId) {
        const u = await prisma_1.prisma.user.findUnique({ where: { id: hintId } });
        if (u)
            return u;
    }
    if (hintEmail) {
        const u = await prisma_1.prisma.user.findUnique({ where: { email: hintEmail } });
        if (u)
            return u;
    }
    const first = await prisma_1.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (first)
        return first;
    const devEmail = 'dev@local.test';
    const existing = await prisma_1.prisma.user.findUnique({ where: { email: devEmail } });
    if (existing)
        return existing;
    const passwordHash = await bcryptjs_1.default.hash('dev123', 10);
    return prisma_1.prisma.user.create({
        data: {
            email: devEmail,
            name: 'Dev Admin',
            role: 'ADMIN',
            passwordHash,
        },
    });
}
async function requireAuth(req, res, next) {
    if (req.method === 'OPTIONS')
        return next();
    const hdr = req.headers.authorization;
    if (hdr?.startsWith('Bearer ')) {
        try {
            const token = hdr.split(' ')[1];
            const raw = (0, auth_1.verifyToken)(token);
            const norm = normalizeJwtPayload(raw);
            if (norm.id) {
                const u = await prisma_1.prisma.user.findUnique({ where: { id: norm.id } });
                if (u) {
                    req.user = { id: u.id, role: u.role, email: u.email };
                    return next();
                }
            }
            if (norm.email) {
                const u = await prisma_1.prisma.user.findUnique({ where: { email: norm.email } });
                if (u) {
                    req.user = { id: u.id, role: u.role, email: u.email };
                    return next();
                }
            }
            if (!allowDevBypass)
                return res.status(401).json({ error: 'Unauthorized' });
            const u = await getOrCreateDevUser();
            req.user = { id: u.id, role: u.role, email: u.email };
            if (isDev)
                console.warn('[auth] Dev bypass (token had no matching user) →', u.email);
            return next();
        }
        catch {
            if (!allowDevBypass)
                return res.status(401).json({ error: 'Invalid token' });
        }
    }
    if (allowDevBypass) {
        try {
            const hintId = req.headers['x-debug-user'] || undefined;
            const hintEmail = req.headers['x-debug-email'] || undefined;
            const u = await getOrCreateDevUser(hintId, hintEmail);
            req.user = { id: u.id, role: u.role, email: u.email };
            if (isDev)
                console.warn('[auth] Dev bypass user →', { id: u.id, email: u.email });
            return next();
        }
        catch (e) {
            return res.status(500).json({ error: 'Dev auth bypass failed' });
        }
    }
    return res.status(401).json({ error: 'Unauthorized' });
}
//# sourceMappingURL=auth.js.map
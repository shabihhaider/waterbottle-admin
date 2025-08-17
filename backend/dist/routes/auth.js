"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../prisma");
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
const isProd = process.env.NODE_ENV === 'production';
router.use((0, express_1.json)());
router.use((0, express_1.urlencoded)({ extended: true }));
function shapeUser(u) {
    return { id: u.id, email: u.email, name: u.name, role: u.role };
}
async function ensureDevAdminIfEmpty() {
    const count = await prisma_1.prisma.user.count();
    if (count > 0)
        return null;
    const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim() || 'admin@hydropak.pk';
    const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
    const created = await prisma_1.prisma.user.create({
        data: {
            email,
            name: 'Admin',
            role: 'ADMIN',
            passwordHash: await (0, auth_1.hashPassword)(password),
        },
    });
    if (!isProd) {
        console.warn(`[auth] No users found → created DEV admin: ${email} / ${password} (change in .env for safety)`);
    }
    return created;
}
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2),
    email: zod_1.z.string().trim().toLowerCase().email(),
    password: zod_1.z.string().min(6),
});
router.post('/register', async (req, res) => {
    try {
        const parsed = registerSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
        }
        const { name, email, password } = parsed.data;
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            return res.status(409).json({ error: 'Email already in use' });
        const user = await prisma_1.prisma.user.create({
            data: { name, email, passwordHash: await (0, auth_1.hashPassword)(password) },
        });
        const token = (0, auth_1.signToken)({ id: user.id, role: user.role, email: user.email });
        return res.json({ token, user: shapeUser(user) });
    }
    catch (err) {
        console.error('POST /auth/register error:', err);
        return res.status(500).json({ error: 'Registration failed' });
    }
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email(),
    password: zod_1.z.string().min(1, 'Password is required'),
});
router.post('/login', async (req, res) => {
    try {
        const parsed = loginSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
        }
        const email = parsed.data.email;
        const password = parsed.data.password;
        if (!isProd) {
            await ensureDevAdminIfEmpty();
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            if (!isProd) {
                return res.status(401).json({ error: 'Invalid credentials', details: 'user_not_found' });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const ok = await (0, auth_1.comparePassword)(password, user.passwordHash);
        if (!ok) {
            if (!isProd) {
                return res.status(401).json({ error: 'Invalid credentials', details: 'bad_password' });
            }
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = (0, auth_1.signToken)({ id: user.id, role: user.role, email: user.email });
        return res.json({ token, user: shapeUser(user) });
    }
    catch (err) {
        console.error('POST /auth/login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map
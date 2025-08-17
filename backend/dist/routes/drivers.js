"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const driverCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    phone: zod_1.z.string().min(6).max(30).optional(),
});
const driverUpdateSchema = driverCreateSchema.partial();
router.get('/', async (req, res, next) => {
    try {
        const q = typeof req.query.q === 'string' ? req.query.q : undefined;
        const where = q
            ? {
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q } },
                ],
            }
            : undefined;
        const drivers = await prisma_1.prisma.driver.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        res.json(drivers);
    }
    catch (err) {
        next(err);
    }
});
router.post('/', async (req, res, next) => {
    try {
        const body = driverCreateSchema.parse(req.body);
        const data = {
            name: body.name,
            phone: body.phone ?? null,
        };
        const driver = await prisma_1.prisma.driver.create({ data });
        res.status(201).json(driver);
    }
    catch (err) {
        next(err);
    }
});
router.put('/:id', async (req, res, next) => {
    try {
        const body = driverUpdateSchema.parse(req.body);
        const data = {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.phone !== undefined ? { phone: body.phone } : {}),
        };
        const driver = await prisma_1.prisma.driver.update({
            where: { id: req.params.id },
            data,
        });
        res.json(driver);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma_1.prisma.driver.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=drivers.js.map
// =============================================
// File: backend/src/routes/drivers.ts
// ---------------------------------------------
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const driverSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6).max(30).optional(),
});

// GET /api/drivers?q=
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    const where = q
      ? { OR: [ { name: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q || '' } } ] }
      : undefined;

    const drivers = await prisma.driver.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(drivers);
  } catch (err) {
    next(err);
  }
});

// POST /api/drivers
router.post('/', async (req, res) => {
  const parsed = driverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const driver = await prisma.driver.create({ data: parsed.data });
  res.status(201).json(driver);
});

// PUT /api/drivers/:id
router.put('/:id', async (req, res) => {
  const parsed = driverSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const driver = await prisma.driver.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(driver);
});

// DELETE /api/drivers/:id
router.delete('/:id', async (req, res) => {
  await prisma.driver.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
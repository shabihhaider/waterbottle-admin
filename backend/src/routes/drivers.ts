// =============================================
// File: backend/src/routes/drivers.ts
// ---------------------------------------------
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ----- Schemas ---------------------------------------------------------------
const driverCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(6).max(30).optional(),
});

const driverUpdateSchema = driverCreateSchema.partial();

// ----- List (GET /api/drivers?q=) -------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;

    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q } },
          ],
        }
      : undefined;

    const drivers = await prisma.driver.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(drivers);
  } catch (err) {
    next(err);
  }
});

// ----- Create (POST /api/drivers) -------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const body = driverCreateSchema.parse(req.body);

    // Ensure exact Prisma shape: phone?: string | null
    const data: Prisma.DriverCreateInput = {
      name: body.name,
      phone: body.phone ?? null,
    };

    const driver = await prisma.driver.create({ data });
    res.status(201).json(driver);
  } catch (err) {
    next(err);
  }
});

// ----- Update (PUT /api/drivers/:id) ----------------------------------------
router.put('/:id', async (req, res, next) => {
  try {
    const body = driverUpdateSchema.parse(req.body);

    // Build update payload only with provided fields
    const data: Prisma.DriverUpdateInput = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
    };

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data,
    });

    res.json(driver);
  } catch (err) {
    next(err);
  }
});

// ----- Delete (DELETE /api/drivers/:id) -------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.driver.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

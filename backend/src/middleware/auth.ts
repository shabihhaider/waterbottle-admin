// backend/src/middleware/auth.ts
import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { verifyToken } from '../utils/auth';
import { prisma } from '../prisma';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
    }
  }
}

const isDev = process.env.NODE_ENV !== 'production';
const allowDevBypass =
  isDev || String(process.env.ALLOW_DEV_AUTH || '').toLowerCase() === 'true';

function normalizeJwtPayload(p: any): { id?: string; email?: string; role?: string } {
  if (!p || typeof p !== 'object') return {};
  const id = p.id || p.userId || p.uid || p.sub || undefined;
  const email = p.email || p.user_email || undefined;
  const role = p.role || p.user_role || undefined;
  return { id, email, role };
}

async function getOrCreateDevUser(hintId?: string, hintEmail?: string) {
  if (hintId) {
    const u = await prisma.user.findUnique({ where: { id: hintId } });
    if (u) return u;
  }
  if (hintEmail) {
    const u = await prisma.user.findUnique({ where: { email: hintEmail } });
    if (u) return u;
  }
  const first = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (first) return first;

  const devEmail = 'dev@local.test';
  const existing = await prisma.user.findUnique({ where: { email: devEmail } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash('dev123', 10);
  return prisma.user.create({
    data: { email: devEmail, name: 'Dev Admin', role: 'ADMIN', passwordHash },
  });
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const authHeader = req.get('authorization') ?? undefined;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const raw = verifyToken<any>(token);
      const norm = normalizeJwtPayload(raw);

      if (norm.id) {
        const u = await prisma.user.findUnique({ where: { id: norm.id } });
        if (u) {
          req.user = { id: u.id, role: u.role, email: u.email };
          return next();
        }
      }
      if (norm.email) {
        const u = await prisma.user.findUnique({ where: { email: norm.email } });
        if (u) {
          req.user = { id: u.id, role: u.role, email: u.email };
          return next();
        }
      }

      if (!allowDevBypass) return res.status(401).json({ error: 'Unauthorized' });
      const u = await getOrCreateDevUser();
      req.user = { id: u.id, role: u.role, email: u.email };
      if (isDev) console.warn('[auth] Dev bypass (token had no matching user) →', u.email);
      return next();
    } catch {
      if (!allowDevBypass) return res.status(401).json({ error: 'Invalid token' });
      // fall through to dev bypass
    }
  }

  if (allowDevBypass) {
    try {
      const hintId = req.get('x-debug-user') ?? undefined;
      const hintEmail = req.get('x-debug-email') ?? undefined;
      const u = await getOrCreateDevUser(hintId, hintEmail);
      req.user = { id: u.id, role: u.role, email: u.email };
      if (isDev) console.warn('[auth] Dev bypass user →', { id: u.id, email: u.email });
      return next();
    } catch {
      return res.status(500).json({ error: 'Dev auth bypass failed' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

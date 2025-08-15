// backend/src/middleware/auth.ts — replace file
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { prisma } from '../prisma';
import bcrypt from 'bcryptjs';

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

// Normalize any JWT payload shape into our internal user shape
function normalizeJwtPayload(p: any): { id?: string; email?: string; role?: string } {
  if (!p || typeof p !== 'object') return {};
  const id = p.id || p.userId || p.uid || p.sub || undefined;
  const email = p.email || p.user_email || undefined;
  const role = p.role || p.user_role || undefined;
  return { id, email, role };
}

async function getOrCreateDevUser(hintId?: string, hintEmail?: string) {
  // 1) Try hints
  if (hintId) {
    const u = await prisma.user.findUnique({ where: { id: hintId } });
    if (u) return u;
  }
  if (hintEmail) {
    const u = await prisma.user.findUnique({ where: { email: hintEmail } });
    if (u) return u;
  }

  // 2) First user in DB
  const first = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (first) return first;

  // 3) Create a dev admin
  const devEmail = 'dev@local.test';
  const existing = await prisma.user.findUnique({ where: { email: devEmail } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash('dev123', 10);
  return prisma.user.create({
    data: {
      email: devEmail,
      name: 'Dev Admin',
      role: 'ADMIN',
      passwordHash,
    },
  });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Let CORS preflight pass
  if (req.method === 'OPTIONS') return next();

  const hdr = req.headers.authorization;

  // If a token is provided, try to verify; in dev, fall back to bypass
  if (hdr?.startsWith('Bearer ')) {
    try {
      const token = hdr.split(' ')[1];
      const raw = verifyToken<any>(token);
      const norm = normalizeJwtPayload(raw);

      // Try to resolve user id by id or by email
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

      // Token verified but no matching DB user
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

  // No/invalid token → dev bypass (only in dev or when explicitly allowed)
  if (allowDevBypass) {
    try {
      const hintId = (req.headers['x-debug-user'] as string) || undefined;
      const hintEmail = (req.headers['x-debug-email'] as string) || undefined;
      const u = await getOrCreateDevUser(hintId, hintEmail);
      req.user = { id: u.id, role: u.role, email: u.email };
      if (isDev) console.warn('[auth] Dev bypass user →', { id: u.id, email: u.email });
      return next();
    } catch (e) {
      return res.status(500).json({ error: 'Dev auth bypass failed' });
    }
  }

  // Production default
  return res.status(401).json({ error: 'Unauthorized' });
}

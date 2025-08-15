import { Router, json, urlencoded } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { comparePassword, hashPassword, signToken } from '../utils/auth';

const router = Router();
const isProd = process.env.NODE_ENV === 'production';

/**
 * Route-level body parsers (keeps /auth working even if app forgot app.use(express.json()))
 */
router.use(json());
router.use(urlencoded({ extended: true }));

/** Shared user shape for responses */
function shapeUser(u: { id: string; email: string; name: string | null; role: string }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/**
 * If the DB has no users at all, create a default admin in DEV and return it.
 * This prevents the “I have no register page” dead-end.
 */
async function ensureDevAdminIfEmpty() {
  const count = await prisma.user.count();
  if (count > 0) return null;

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim() || 'admin@hydropak.pk';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  const created = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      role: 'ADMIN',
      passwordHash: await hashPassword(password),
    },
  });

  if (!isProd) {
    // eslint-disable-next-line no-console
    console.warn(
      `[auth] No users found → created DEV admin: ${email} / ${password} (change in .env for safety)`
    );
  }

  return created;
}

/** Register (optional) */
const registerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    return res.json({ token, user: shapeUser(user) });
  } catch (err) {
    console.error('POST /auth/register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * Login
 * - Accepts { email, password } (email is trimmed+lowercased)
 * - In DEV: if no users exist, auto-seeds admin and logs you in
 */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }

    const email = parsed.data.email;
    const password = parsed.data.password;

    // DEV fallback: if there are no users at all, create the default admin and log in
    if (!isProd) {
      await ensureDevAdminIfEmpty();
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!isProd) {
        return res.status(401).json({ error: 'Invalid credentials', details: 'user_not_found' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      if (!isProd) {
        return res.status(401).json({ error: 'Invalid credentials', details: 'bad_password' });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    return res.json({ token, user: shapeUser(user) });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;

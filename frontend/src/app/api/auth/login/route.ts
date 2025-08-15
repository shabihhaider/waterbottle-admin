// src/app/api/auth/login/route.ts

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // ensure no caching of this route

// ✅ Demo / fallback credentials so login works even if Vercel envs are missing
const FALLBACK_ADMIN = {
  email: (process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@hydropak.pk').toLowerCase(),
  password: (process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin@123'),
};

// Optional dev flag (if you later want to allow any login)
const DEMO_MODE =
  (process.env.ALLOW_DEV_AUTH === 'true') ||
  (process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === 'true');

// add this helper GET so you can ping the route
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      config: {
        allowDevAuth: process.env.ALLOW_DEV_AUTH ?? '(unset)',
        hasAdminEmail: Boolean(process.env.SEED_ADMIN_EMAIL || process.env.ADMIN_EMAIL),
        hasAdminPassword: Boolean(process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD),
        env: process.env.VERCEL_ENV || process.env.NODE_ENV,
        runtime: process.env.NEXT_RUNTIME || 'node',
      },
    },
    { status: 200 }
  );
}

function b64url(s: string) {
  return Buffer.from(s).toString('base64url');
}

async function parseBody(req: Request) {
  const ct = (req.headers.get('content-type') || '').toLowerCase();

  // JSON
  if (ct.includes('application/json')) {
    try { return await req.json(); } catch { /* continue */ }
  }

  // x-www-form-urlencoded
  if (ct.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  // multipart/form-data
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => { if (typeof v === 'string') obj[k] = v; });
    return obj;
  }

  // Last attempt
  try { return await req.json(); } catch { return {}; }
}

export async function POST(req: Request) {
  const body = (await parseBody(req)) as Record<string, unknown>;
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '').trim();

  // Allow everything when explicitly in demo mode
  if (DEMO_MODE) {
    const payload = { sub: email || 'dev@example.com', name: 'Dev', role: 'ADMIN' };
    const token = `demo.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.token`;
    return NextResponse.json({ token, user: payload }, { status: 200 });
  }

  // ✅ Always fall back to these creds if envs aren't set on Vercel
  const adminEmail = FALLBACK_ADMIN.email;
  const adminPassword = FALLBACK_ADMIN.password;

  if (!email || !password) {
    return NextResponse.json({ message: 'Email and password are required.' }, { status: 400 });
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }

  const payload = { sub: adminEmail, name: 'Admin', role: 'ADMIN' };
  const token = `demo.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.token`;
  return NextResponse.json({ token, user: payload }, { status: 200 });
}


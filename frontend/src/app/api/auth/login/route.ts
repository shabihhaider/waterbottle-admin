// frontend/src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function b64url(input: string) {
  return Buffer.from(input).toString('base64url');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '').trim();

  const adminEmail =
    (process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword =
    (process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '').trim();

  if (!adminEmail || !adminPassword) {
    // Misconfiguration: envs not set on Vercel Production
    return NextResponse.json(
      { message: 'Server login is not configured. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.' },
      { status: 500 }
    );
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }

  // Minimal demo token (your frontend stores it in localStorage)
  const payload = { sub: adminEmail, name: 'Admin', role: 'ADMIN' };
  const token = `demo.${b64url(JSON.stringify(payload))}.token`;

  // Also set an httpOnly cookie if you want (optional)
  const res = NextResponse.json({ token, user: payload }, { status: 200 });
  return res;
}

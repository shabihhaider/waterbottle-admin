// src/app/api/auth/login/route.ts

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

  // Read from env (configure these in Vercel)
  const adminEmail = String(process.env.SEED_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const adminPassword = String(process.env.SEED_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '').trim();

  console.log('AUTH_LOGIN_DEBUG', {
    hasAdminVars: Boolean(adminEmail && adminPassword),
    allowDevAuth: process.env.ALLOW_DEV_AUTH === 'true',
    vercelEnv: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    });

  // Allow everything in preview/dev if the flag is on (set ALLOW_DEV_AUTH=true in Vercel)
  if ((process.env.ALLOW_DEV_AUTH ?? '').toLowerCase() === 'true') {
    const payload = { sub: email || 'dev@example.com', name: 'Dev', role: 'ADMIN' };
    const token = `demo.${b64url(JSON.stringify(payload))}.token`;
    return NextResponse.json({ token, user: payload }, { status: 200 });
  }

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { message: 'Server login is not configured. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.' },
      { status: 500 }
    );
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }

  const payload = { sub: adminEmail, name: 'Admin', role: 'ADMIN' };
  const token = `demo.${b64url(JSON.stringify(payload))}.token`;

  return NextResponse.json({ token, user: payload }, { status: 200 });
}

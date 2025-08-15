import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

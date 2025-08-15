// frontend/src/app/api/customers/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs'; // ensure Node runtime (not Edge)

const CustomerIn = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'vip']).default('active'),
  rating: z.number().int().min(0).max(5).default(0),
  creditLimit: z.number().default(0),
  creditBalance: z.number().default(0), // we won’t store this yet, just accept it
});

type UiStatus = 'active' | 'inactive' | 'vip';
type DbStatus = 'ACTIVE' | 'INACTIVE' | 'VIP';
const toDbStatus = (s: UiStatus): DbStatus => s.toUpperCase() as DbStatus;
const toUiStatus = (s: string): UiStatus =>
  (s.toLowerCase() as UiStatus) ?? 'inactive';

export async function GET() {
  const rows = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Map DB → UI shape the Customers page expects
  const data = rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    totalOrders: 0,
    totalSpent: 0,
    lastOrderDate: undefined as string | undefined,
    status: toUiStatus(String(c.status)),
    rating: c.rating ?? 0,
    joinDate: c.createdAt.toISOString(),
    notes: c.notes ?? undefined,
    creditLimit: Number(c.creditLimit ?? 0),
    outstandingBalance: 0,
  }));

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CustomerIn.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid input', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const v = parsed.data;

  const created = await prisma.customer.create({
    data: {
      name: v.name,
      email: v.email || null,
      phone: v.phone || null,
      address: v.address || null,
      status: toDbStatus(v.status),
      rating: v.rating,
      creditLimit: v.creditLimit, // Decimal field accepts number
      notes: null,
    },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

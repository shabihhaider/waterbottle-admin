import { NextRequest, NextResponse } from 'next/server';

// Skip ALL API routes
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Let every /api/* request pass straight through
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // (Put any page-level auth here later)
  return NextResponse.next();
}

// Run on everything except static assets
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

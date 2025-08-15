// frontend/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

// Public API routes that should NOT be blocked by any auth middleware
const PUBLIC_API_PATHS = ['/api/auth/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Always allow the login API to pass through
  if (PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // If you later add auth checks, keep them below
  return NextResponse.next();
}

// Run on everything except static assets (and the login API above)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

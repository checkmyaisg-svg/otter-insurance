import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Runs on every request except static assets. Refreshes the session and
// enforces the auth redirect boundary.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

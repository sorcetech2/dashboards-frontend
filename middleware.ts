// Keep the Edge bundle independent from the Node-only registry and password
// verifier.  The server auth configuration remains the source for sign-in.
export { edgeAuth as middleware } from '@/lib/auth-edge';

// Don't invoke Middleware on some paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};

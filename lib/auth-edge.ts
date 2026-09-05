import NextAuth, { type NextAuthConfig } from 'next-auth';
import {
  AUTH_SESSION_SCHEMA_VERSION,
  hasCurrentSessionClaims,
  rejectSession,
  rejectSessionToken
} from './auth-session';

/**
 * Middleware must remain Edge-safe.  In particular, this configuration does
 * not import `lib/auth` or the server-only user registry; it only verifies the
 * signed JWT and checks claims already placed into it by the Node auth flow.
 * Authoritative authVersion checks still belong to protected server handlers.
 */
const edgeAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token }) {
      // Middleware has no registry access by design. It can still reject old
      // cookies before authorization by requiring the current claim shape.
      if (!hasCurrentSessionClaims(token)) {
        return rejectSessionToken(token);
      }
      return token;
    },
    session({ session, token }) {
      if (!hasCurrentSessionClaims(token)) {
        return rejectSession(token);
      }
      if (session.user) {
        // Auth.js builds the initial Edge session from standard claims only;
        // copy the allow-listed application claims before `authorized` runs.
        session.user.id = token.id;
        session.user.name = token.username;
        session.user.username = token.username;
        session.user.displayName =
          typeof token.displayName === 'string'
            ? token.displayName
            : token.username;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.admin = token.role === 'admin';
        session.user.enabled = token.enabled;
        session.user.authVersion = token.authVersion;
        session.user.sessionSchemaVersion = token.sessionSchemaVersion;
      }
      return session;
    },
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      const adminRoute =
        pathname.startsWith('/teamstats') || pathname.startsWith('/admin');
      const protectedRoute = pathname.startsWith('/dashboard') || adminRoute;
      if (!protectedRoute) return true;

      const user = auth?.user;
      const hasValidSession = Boolean(
        user?.id &&
          user.sessionSchemaVersion === AUTH_SESSION_SCHEMA_VERSION &&
          user.enabled &&
          (user.role === 'admin' || user.role === 'viewer')
      );
      if (!hasValidSession) return false;
      if (adminRoute && user?.role !== 'admin') {
        return Response.redirect(new URL('/dashboard', request.nextUrl));
      }
      return true;
    }
  }
} satisfies NextAuthConfig;

export const { auth: edgeAuth } = NextAuth(edgeAuthConfig);

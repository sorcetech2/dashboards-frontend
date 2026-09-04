import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {
  AUTH_SESSION_SCHEMA_VERSION,
  hasCurrentSessionClaims,
  matchesAuthoritativeAuthState,
  rejectSession,
  rejectSessionToken
} from './auth-session';
import { authLogger } from './auth-logger';
import { getLoginThrottle, requestClientIp } from './login-throttle';
import { getUserAuthStateById, validateUser, type Principal } from './users';

// The single Auth.js configuration for this app. The HTTP route
// (app/api/auth/[...nextauth]/route.ts) and server-side auth() calls
// must both come from here so callbacks and session fields cannot drift.
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  logger: authLogger,
  session: { strategy: 'jwt', maxAge: 12 * 60 * 60 }, // one workday
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, request) {
        const username = credentials?.username;
        const password = credentials?.password;
        try {
          const ip = requestClientIp(request);
          const throttle = getLoginThrottle();
          if (!(await throttle.beforeAttempt(username, ip))) return null;

          if (!username || !password) {
            await throttle.recordFailure(username, ip);
            return null;
          }

          // Returns a sanitized principal or null; never contains password
          // data. Unknown users still take the facade's dummy-hash path.
          const principal = await validateUser(username, password);
          if (!principal) {
            await throttle.recordFailure(username, ip);
            return null;
          }

          // A successful login clears an existing failure state. If the
          // durable throttle cannot be updated, fail closed and do not issue
          // a session despite valid credentials.
          await throttle.recordSuccess(username, ip);

          // Auth.js uses `name` for its standard session identity. Keep the
          // application-specific username alongside it for explicit lookups.
          return {
            ...principal,
            name: principal.username,
            admin: principal.role === 'admin',
            sessionSchemaVersion: AUTH_SESSION_SCHEMA_VERSION,
            email: null,
            image: null
          };
        } catch {
          // Do not distinguish throttle outages, invalid credentials, or
          // malformed requests to the caller.
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // authorize() returns our sanitized Principal.
        const principal = user as unknown as Principal;
        token.id = principal.id;
        token.name = principal.username;
        token.username = principal.username;
        token.displayName = principal.displayName;
        token.tenantId = principal.tenantId;
        token.role = principal.role;
        token.admin = principal.role === 'admin';
        token.enabled = principal.enabled;
        token.authVersion = principal.authVersion;
        token.sessionSchemaVersion = AUTH_SESSION_SCHEMA_VERSION;
      } else {
        // Re-read authoritative state whenever Auth.js refreshes a JWT. This
        // invalidates sessions after disable/reset/role/tenant changes without
        // relying on an in-memory cache or waiting for expiry.
        if (!hasCurrentSessionClaims(token)) {
          return rejectSessionToken(token);
        }
        const current = await getUserAuthStateById(token.id);
        if (!matchesAuthoritativeAuthState(token, current)) {
          return rejectSessionToken(token);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sessionSchemaVersion !== AUTH_SESSION_SCHEMA_VERSION) {
        return rejectSession(token);
      }
      if (session.user) {
        session.user.id =
          typeof token.id === 'string' ? token.id : session.user.id;
        session.user.name =
          typeof token.name === 'string' ? token.name : session.user.name;
        session.user.username =
          typeof token.username === 'string'
            ? token.username
            : session.user.username;
        session.user.displayName =
          typeof token.displayName === 'string'
            ? token.displayName
            : session.user.displayName;
        session.user.tenantId =
          typeof token.tenantId === 'string'
            ? token.tenantId
            : session.user.tenantId;
        session.user.role =
          token.role === 'admin' || token.role === 'viewer'
            ? token.role
            : session.user.role;
        session.user.admin =
          typeof token.admin === 'boolean' ? token.admin : session.user.admin;
        session.user.enabled =
          typeof token.enabled === 'boolean'
            ? token.enabled
            : session.user.enabled;
        session.user.authVersion =
          typeof token.authVersion === 'number'
            ? token.authVersion
            : session.user.authVersion;
        session.user.sessionSchemaVersion =
          typeof token.sessionSchemaVersion === 'number'
            ? token.sessionSchemaVersion
            : session.user.sessionSchemaVersion;
      }
      return session;
    }
  }
});

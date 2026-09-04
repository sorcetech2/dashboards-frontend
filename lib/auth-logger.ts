import 'server-only';

type AuthLogCategory =
  | 'configuration'
  | 'request'
  | 'session'
  | 'callback'
  | 'storage'
  | 'provider'
  | 'sign-in'
  | 'unexpected';

const categoryByType: Record<string, AuthLogCategory> = {
  MissingAdapter: 'configuration',
  MissingAdapterMethods: 'configuration',
  MissingAuthorize: 'configuration',
  MissingSecret: 'configuration',
  InvalidProvider: 'configuration',
  UnsupportedStrategy: 'configuration',
  UntrustedHost: 'configuration',
  MissingCSRF: 'request',
  InvalidCallbackUrl: 'request',
  JWTSessionError: 'session',
  SessionTokenError: 'session',
  SignOutError: 'session',
  AdapterError: 'storage',
  EventError: 'storage',
  CallbackRouteError: 'callback',
  OAuthCallbackError: 'provider',
  OAuthProfileParseError: 'provider',
  OAuthSignInError: 'provider',
  EmailSignInError: 'provider',
  Verification: 'provider',
  OAuthAccountNotLinked: 'sign-in',
  AccountNotLinked: 'sign-in',
  AccessDenied: 'sign-in'
};

function authErrorType(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if (!('type' in error)) return undefined;
  const type = (error as { type?: unknown }).type;
  return typeof type === 'string' ? type : undefined;
}

function isExpectedCredentialsError(error: unknown): boolean {
  if (authErrorType(error) === 'CredentialsSignin') return true;
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return false;
  }
  return (error as { name?: unknown }).name === 'CredentialsSignin';
}

export function classifyAuthError(error: unknown): AuthLogCategory {
  const type = authErrorType(error);
  if (isExpectedCredentialsError(error)) return 'sign-in';
  return type ? (categoryByType[type] ?? 'unexpected') : 'unexpected';
}

/**
 * Auth.js' default logger prints error stacks and nested causes. This logger
 * deliberately emits no error text, token, request, user, or stack data.
 * Expected invalid credentials are completely silent.
 */
export const authLogger = {
  error(error: Error): void {
    if (isExpectedCredentialsError(error)) return;
    const category = classifyAuthError(error);
    console.error(`[auth][error] ${category}`);
  },
  warn(_code: string): void {
    // Auth.js warning values are not needed in production and may include
    // implementation details; keep the custom logger data-minimizing.
    void _code;
  },
  debug(_message: string, _metadata?: unknown): void {
    // Never emit request, token, provider, or callback metadata.
    void _message;
    void _metadata;
  }
};

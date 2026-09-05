import { afterEach, describe, expect, it, vi } from 'vitest';
import { authLogger, classifyAuthError } from '@/lib/auth-logger';

describe('Auth.js logger policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suppresses expected invalid-credential errors and their sensitive data', () => {
    const error = {
      name: 'CredentialsSignin',
      type: 'CredentialsSignin',
      message: 'password=secret username=alice',
      stack: 'sensitive stack'
    } as unknown as Error;
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});

    authLogger.error(error);

    expect(output).not.toHaveBeenCalled();
    expect(classifyAuthError(error)).toBe('sign-in');
  });

  it('emits only an allow-listed coarse category for unexpected errors', () => {
    const error = {
      name: 'JWTSessionError',
      type: 'JWTSessionError',
      message: 'token=secret request=/sensitive',
      stack: 'sensitive stack'
    } as unknown as Error;
    const output = vi.spyOn(console, 'error').mockImplementation(() => {});

    authLogger.error(error);

    expect(output).toHaveBeenCalledOnce();
    expect(output).toHaveBeenCalledWith('[auth][error] session');
  });

  it('does not emit warning or debug metadata', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    authLogger.warn('unexpected-warning');
    authLogger.debug('request', { token: 'secret' });

    expect(warning).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});

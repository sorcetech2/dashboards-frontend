import 'server-only';

import crypto from 'node:crypto';
import type { PasswordHashRecord } from './schema';

const PASSWORD_HASH_LENGTH = 64;
const SCRYPT_PARAMETERS_VERSION = 1;

// This is a deliberately fake, fixed record.  It is used for unknown-user
// attempts so an account's existence is not obvious from KDF timing.  It is
// not derived from, and must never be replaced with, a live registry record.
const DUMMY_PASSWORD_HASH: PasswordHashRecord = {
  algorithm: 'scrypt',
  parametersVersion: SCRYPT_PARAMETERS_VERSION,
  salt: 'c2VydmVyLWR1bW15LXNhbHQtaXMtMTYtYnl0ZXM=',
  hash: 'uQ2r9cR5H7v5a4c9lQdH5nP3hYk7u1q2eVw8mX0sZ3a6bC9dE1fG4hJ6kL8mN0pQ'
};

function decodeBase64(value: string): Buffer | null {
  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/** Verify a versioned scrypt record without exposing the record itself. */
export function verifyPassword(
  password: string,
  record: PasswordHashRecord
): boolean {
  if (
    record.algorithm !== 'scrypt' ||
    record.parametersVersion !== SCRYPT_PARAMETERS_VERSION
  ) {
    return false;
  }

  const salt = decodeBase64(record.salt);
  const expected = decodeBase64(record.hash);
  if (!salt || !expected || expected.length < 32 || expected.length > 128) {
    return false;
  }

  try {
    const actual = crypto.scryptSync(password, salt, expected.length);
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

export function verifyDummyPassword(password: string): boolean {
  return verifyPassword(password, DUMMY_PASSWORD_HASH);
}

export function hashPassword(password: string): PasswordHashRecord {
  if (password.length < 8 || password.length > 200) {
    throw new Error('Password must be between 8 and 200 characters');
  }
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, PASSWORD_HASH_LENGTH);
  return {
    algorithm: 'scrypt',
    parametersVersion: SCRYPT_PARAMETERS_VERSION,
    salt: salt.toString('base64'),
    hash: hash.toString('base64')
  };
}

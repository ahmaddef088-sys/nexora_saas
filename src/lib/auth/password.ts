import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plain text password using bcrypt with 12 salt rounds.
 *
 * @param password - Plain text password
 * @returns Securely hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a valid non-empty string');
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a stored bcrypt hash.
 *
 * @param password - Plain text password to check
 * @param hash - Stored bcrypt password hash
 * @returns True if password matches the hash, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

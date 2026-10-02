import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/auth/password';

describe('Password Hashing & Security Tests', () => {
  it('should securely hash a password using bcrypt', async () => {
    const plainPassword = 'SecurePassword123!';
    const hash = await hashPassword(plainPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plainPassword);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
  });

  it('should verify matching plain password against hash successfully', async () => {
    const plainPassword = 'SecurePassword123!';
    const hash = await hashPassword(plainPassword);

    const isMatch = await verifyPassword(plainPassword, hash);
    expect(isMatch).toBe(true);
  });

  it('should reject incorrect passwords during verification', async () => {
    const plainPassword = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword456!';
    const hash = await hashPassword(plainPassword);

    const isMatch = await verifyPassword(wrongPassword, hash);
    expect(isMatch).toBe(false);
  });

  it('should reject empty or invalid password inputs gracefully', async () => {
    await expect(hashPassword('')).rejects.toThrowError('Password must be a valid non-empty string');

    const isMatchEmpty = await verifyPassword('', '$2a$12$something');
    expect(isMatchEmpty).toBe(false);
  });
});

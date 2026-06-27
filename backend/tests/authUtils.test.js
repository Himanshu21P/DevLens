import { jest } from '@jest/globals';
import {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/utils/auth.js';
import { encrypt, decrypt } from '../src/utils/crypto.js';

// Set up environment variables required for tests
process.env.JWT_SECRET = 'test_jwt_secret_key_12345678';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_87654321';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Cryptographic Helpers (AES-256-GCM)', () => {
  const secretToken = 'gho_1234567890abcdefghijklmnopqrstuvwxyz';

  it('should successfully encrypt and decrypt text', () => {
    const encrypted = encrypt(secretToken);
    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(':'); // Contains iv:ciphertext:tag
    
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secretToken);
  });

  it('should throw an error if encrypted format is invalid', () => {
    expect(() => decrypt('invalidformat')).toThrow();
  });

  it('should return null if encrypting or decrypting empty/null values', () => {
    expect(encrypt(null)).toBeNull();
    expect(decrypt(null)).toBeNull();
  });
});

describe('Password Utilities (Bcrypt)', () => {
  const password = 'SecurePassword123';

  it('should hash password and verify matching plain text', async () => {
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const isMatch = await comparePassword(password, hash);
    expect(isMatch).toBe(true);

    const isNotMatch = await comparePassword('WrongPassword123', hash);
    expect(isNotMatch).toBe(false);
  });

  describe('Password Strength Validation', () => {
    it('should pass for strong passwords', () => {
      const result = validatePasswordStrength('StrongPass123');
      expect(result.isValid).toBe(true);
    });

    it('should fail for short passwords', () => {
      const result = validatePasswordStrength('Sh1!');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    it('should fail if missing uppercase letters', () => {
      const result = validatePasswordStrength('weakpassword123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('uppercase letter');
    });

    it('should fail if missing lowercase letters', () => {
      const result = validatePasswordStrength('WEAKPASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('lowercase letter');
    });

    it('should fail if missing numbers', () => {
      const result = validatePasswordStrength('WeakPassword');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('at least one number');
    });
  });
});

describe('JWT Token Utilities', () => {
  const mockUser = {
    id: 42,
    email: 'dev@devlens.com',
    role: 'owner',
  };
  const mockJti = 'a4b8c9d0-e1f2-3a4b-5c6d-7e8f9a0b1c2d';

  it('should generate and verify a valid access token with minimal claims', () => {
    const token = generateAccessToken(mockUser);
    expect(token).toBeDefined();

    const decoded = verifyAccessToken(token);
    expect(decoded).toBeDefined();
    expect(decoded.userId).toBe(mockUser.id);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.role).toBe(mockUser.role);
    
    // Verify payload is minimal (does not leak sensitive user info)
    expect(decoded).not.toHaveProperty('passwordHash');
  });

  it('should generate and verify a valid refresh token with jti', () => {
    const token = generateRefreshToken(mockUser, mockJti);
    expect(token).toBeDefined();

    const decoded = verifyRefreshToken(token);
    expect(decoded).toBeDefined();
    expect(decoded.userId).toBe(mockUser.id);
    expect(decoded.jti).toBe(mockJti);
  });

  it('should fail verification if token signature is invalid', () => {
    const token = generateAccessToken(mockUser);
    const tamperedToken = token + 'tampered';
    expect(() => verifyAccessToken(tamperedToken)).toThrow();
  });
});

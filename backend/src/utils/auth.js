import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcryptjs.
 * @param {string} password - Cleartext password
 * @returns {Promise<string>} The hashed password
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares a plaintext password with a bcrypt hash.
 * @param {string} password - Cleartext password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if match, false otherwise
 */
export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Enforces a strong password policy:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * @param {string} password - The password to validate
 * @returns {{isValid: boolean, message: string}} Validation result
 */
export const validatePasswordStrength = (password) => {
  if (!password) {
    return { isValid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number.' };
  }
  return { isValid: true, message: 'Password is secure.' };
};

/**
 * Generates a short-lived access token containing minimal user claims.
 * Claims: userId, email, role.
 * @param {object} user - User object containing id, email, and role (or default role)
 * @returns {string} Signed JWT access token
 */
export const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email || null,
    role: user.role || 'member', // Default role if not set
  };

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined.');
  }

  return jwt.sign(payload, secret, { expiresIn: '15m' });
};

/**
 * Generates a long-lived refresh token with a unique identifier (jti).
 * @param {object} user - User object
 * @param {string} jti - Unique token ID (uuid)
 * @returns {string} Signed JWT refresh token
 */
export const generateRefreshToken = (user, jti) => {
  const payload = {
    userId: user.id,
    jti,
  };

  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not defined.');
  }

  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

/**
 * Verifies a JWT access token.
 * @param {string} token - Signed access token
 * @returns {object} Decoded token payload
 */
export const verifyAccessToken = (token) => {
  const secret = process.env.JWT_SECRET;
  return jwt.verify(token, secret);
};

/**
 * Verifies a JWT refresh token.
 * @param {string} token - Signed refresh token
 * @returns {object} Decoded token payload
 */
export const verifyRefreshToken = (token) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  return jwt.verify(token, secret);
};

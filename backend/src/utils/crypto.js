import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is standard for GCM
const TAG_LENGTH = 16;

/**
 * Encrypts a cleartext string using AES-256-GCM.
 * @param {string} text - The text to encrypt
 * @returns {string} The encrypted string formatted as "iv_hex:encrypted_hex:tag_hex"
 */
export const encrypt = (text) => {
  if (!text) return null;

  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables.');
  }

  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${tag}`;
};

/**
 * Decrypts an encrypted string formatted as "iv_hex:encrypted_hex:tag_hex" using AES-256-GCM.
 * @param {string} encryptedData - The formatted encrypted string
 * @returns {string} The decrypted cleartext string
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData) return null;

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected "iv:encrypted:tag".');
  }

  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables.');
  }

  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

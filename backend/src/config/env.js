import dotenv from 'dotenv';
import logger from '../utils/logger.js';

// Load environment variables
dotenv.config();

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_REDIRECT_URI',
  'GEMINI_API_KEY',
];

/**
 * Validates that all required environment variables are present and correctly formatted.
 * Exits the process immediately if validation fails (Fail-Fast principle).
 */
export const validateEnv = () => {
  const missing = [];

  for (const name of REQUIRED_ENV_VARS) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  // Check encryption key format (AES-256 requires 32 bytes, represented as 64 hex characters)
  if (process.env.ENCRYPTION_KEY) {
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    if (!hexRegex.test(process.env.ENCRYPTION_KEY)) {
      logger.error(
        'CRITICAL CONFIGURATION ERROR: ENCRYPTION_KEY must be a valid 64-character hexadecimal string (32 bytes).'
      );
      process.exit(1);
    }
  }

  if (missing.length > 0) {
    logger.error('CRITICAL CONFIGURATION ERROR: Missing required environment variables:');
    for (const variable of missing) {
      logger.error(`  - ${variable}`);
    }
    logger.error('The application will now shut down.');
    process.exit(1);
  }

  logger.info('Configuration validation successful: All required environment variables are present.');
};

export default validateEnv;

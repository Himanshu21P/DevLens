import crypto from 'crypto';
import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/auth.js';

/**
 * Helper to compute SHA-256 hash of a token for database storage/lookup.
 * Prevents plain text tokens from being stored in the DB.
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Service class handling core business logic for credentials and token sessions.
 */
class AuthService {
  /**
   * Registers a new user and creates their default preferences in a transaction.
   */
  async registerUser({ email, password, name }) {
    // 1. Check for duplicate email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const error = new Error('A user with this email already exists.');
      error.statusCode = 400;
      error.name = 'DuplicateEmailError';
      throw error;
    }

    // 2. Hash password
    const passwordHash = await hashPassword(password);

    // 3. Create user and default preferences in a single transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          userPreferences: {
            create: {
              theme: 'dark',
              sendAlerts: true,
            },
          },
        },
        include: {
          userPreferences: true,
        },
      });
      return user;
    });

    logger.info(`User registered successfully: ${email} (ID: ${newUser.id})`);

    // Return clean user object
    return {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      avatarUrl: newUser.avatarUrl,
      createdAt: newUser.createdAt,
    };
  }

  /**
   * Authenticates user credentials and generates a new rotated session.
   */
  async loginUser({ email, password, ipAddress, userAgent }) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.name = 'InvalidCredentialsError';
      throw error;
    }

    // 2. Verify password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      error.name = 'InvalidCredentialsError';
      throw error;
    }

    // 3. Generate tokens
    const jti = crypto.randomUUID();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, jti);

    // 4. Save refresh token in database (store SHA-256 hash)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),
        jti,
        userId: user.id,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    logger.info(`User logged in: ${email} (ID: ${user.id}) - IP: ${ipAddress}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        githubUsername: user.githubUsername,
      },
    };
  }

  /**
   * Refreshes access tokens, implementing Refresh Token Rotation (RTR) and replay detection.
   */
  async refreshUserToken({ refreshToken, ipAddress, userAgent }) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      const error = new Error('Invalid or expired refresh token.');
      error.statusCode = 401;
      error.name = 'InvalidTokenError';
      throw error;
    }

    const hashedToken = hashToken(refreshToken);

    // Find token in database
    const dbToken = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: { user: true },
    });

    // REPLAY ATTACK DETECTION:
    // If the token was not found or has already been marked as used, a security breach is assumed.
    if (!dbToken || dbToken.isUsed || dbToken.revokedAt || dbToken.expiresAt < new Date()) {
      const userId = decoded.userId;

      // Log critical security breach details using Winston
      logger.error(`CRITICAL SECURITY ALERT: Refresh Token Replay Detected!`, {
        timestamp: new Date().toISOString(),
        userId,
        ipAddress,
        userAgent,
        tokenJti: decoded.jti,
        reason: !dbToken
          ? 'Token not found in DB'
          : dbToken.isUsed
          ? 'Token already used'
          : dbToken.revokedAt
          ? 'Token was revoked'
          : 'Token expired',
      });

      // Breach Mitigation: Revoke all active sessions for this user immediately
      if (userId) {
        await prisma.refreshToken.deleteMany({
          where: { userId },
        });
        logger.warn(`Breach Mitigation Executed: Revoked all active sessions for User ID: ${userId}.`);
      }

      const error = new Error('Security Alert: Session has been compromised. Please log in again.');
      error.statusCode = 401;
      error.name = 'SecurityBreachError';
      throw error;
    }

    // Mark current token as used
    await prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { isUsed: true },
    });

    // Generate new rotated token pair
    const newJti = crypto.randomUUID();
    const newAccessToken = generateAccessToken(dbToken.user);
    const newRefreshToken = generateRefreshToken(dbToken.user, newJti);

    // Save new refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: hashToken(newRefreshToken),
        jti: newJti,
        userId: dbToken.user.id,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    logger.info(`Session refreshed (rotated) for User ID: ${dbToken.user.id} - IP: ${ipAddress}`);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logs out the user from the current session by deleting their refresh token.
   */
  async logoutUser(refreshToken) {
    if (!refreshToken) return;
    
    const hashedToken = hashToken(refreshToken);

    try {
      // Delete from database to invalidate session
      await prisma.refreshToken.delete({
        where: { token: hashedToken },
      });
      logger.info('Session invalidated successfully on logout.');
    } catch (err) {
      // If token not found, it might already be deleted. Log warning and proceed
      logger.warn(`Logout request for non-existent token session: ${err.message}`);
    }
  }

  /**
   * Initiates password reset flow: generates secure token, saves hash, logs reset link.
   */
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Security best practice: Do not disclose if email exists. Return success regardless.
    if (!user) {
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    // Generate secure 32-byte hex token
    const resetToken = crypto.randomBytes(32).toString('hex');
    // Store SHA-256 hash of reset token in database
    const passwordResetToken = hashToken(resetToken);
    const passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour expiration

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpires,
      },
    });

    // Mock Email Service: Log secure recovery link to the development console
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;
    
    logger.info(`====================================================`);
    logger.info(`[MOCK EMAIL SERVICE] Password Reset Request for: ${email}`);
    logger.info(`Reset URL: ${resetUrl}`);
    logger.info(`====================================================`);
  }

  /**
   * Completes password reset flow using valid token.
   */
  async resetPassword({ token, password }) {
    const hashedToken = hashToken(token);

    // Find user with matching, non-expired token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      const error = new Error('Password reset token is invalid or has expired.');
      error.statusCode = 400;
      error.name = 'InvalidResetTokenError';
      throw error;
    }

    // Hash new password and clear reset columns
    const passwordHash = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    logger.info(`Password reset successfully completed for User ID: ${user.id}`);
  }
}

export default new AuthService();

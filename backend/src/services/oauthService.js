import crypto from 'crypto';
import prisma from '../config/db.js';
import githubService from './githubService.js';
import profileSyncService from './profileSyncService.js';
import logger from '../utils/logger.js';
import { encrypt } from '../utils/crypto.js';
import { generateAccessToken, generateRefreshToken } from '../utils/auth.js';

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

class OauthService {
  /**
   * Handles GitHub OAuth authentication: logs in existing users, links matching emails,
   * or registers new accounts automatically.
   */
  async loginWithGithub({ code, ipAddress, userAgent }) {
    // 1. Swap code for access token
    const accessToken = await githubService.getOAuthAccessToken(code);

    // 2. Fetch profile and primary email
    const { profile, primaryEmail } = await githubService.getAuthenticatedUserInfo(accessToken);
    const githubId = String(profile.id);

    // Encrypt token for storage
    const encryptedToken = encrypt(accessToken);

    // 3. Search for existing user linked to this GitHub ID
    let user = await prisma.user.findUnique({
      where: { githubId },
    });

    if (user) {
      // User exists, update their access token
      user = await prisma.user.update({
        where: { id: user.id },
        data: { githubAccessToken: encryptedToken },
      });
      logger.info(`GitHub Login: User ID ${user.id} matched via GitHub ID ${githubId}.`);
    } else {
      // 4. If no match by GitHub ID, search by primary email to link accounts
      if (primaryEmail) {
        user = await prisma.user.findUnique({
          where: { email: primaryEmail },
        });

        if (user) {
          // Email match, link the GitHub account
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              githubId,
              githubUsername: profile.login,
              githubAccessToken: encryptedToken,
            },
          });
          logger.info(`GitHub Login: Linked GitHub ID ${githubId} to existing email ${primaryEmail}.`);
        }
      }

      // 5. If still no user, register a new account (OAuth registration)
      if (!user) {
        if (!primaryEmail) {
          const error = new Error('Could not retrieve a primary verified email from your GitHub account.');
          error.statusCode = 400;
          error.name = 'GithubEmailError';
          throw error;
        }

        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: primaryEmail,
              passwordHash: null, // Nullable, indicates OAuth registration
              githubId,
              githubUsername: profile.login,
              githubAccessToken: encryptedToken,
              name: profile.name || profile.login,
              userPreferences: {
                create: {
                  theme: 'dark',
                  sendAlerts: true,
                },
              },
            },
          });
          return newUser;
        });

        logger.info(`GitHub Login: Created new DevLens account for ${primaryEmail}.`);
      }
    }

    // 6. Synchronize profile metadata
    user = await profileSyncService.synchronizeProfile(user.id, profile);

    // 7. Initiate session (tokens, cookies)
    const jti = crypto.randomUUID();
    const jwtAccessToken = generateAccessToken(user);
    const jwtRefreshToken = generateRefreshToken(user, jti);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        token: hashToken(jwtRefreshToken),
        jti,
        userId: user.id,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken: jwtAccessToken,
      refreshToken: jwtRefreshToken,
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
   * Links a GitHub account to an active DevLens profile.
   */
  async linkGithubAccount(userId, code) {
    // 1. Swap code for access token
    const accessToken = await githubService.getOAuthAccessToken(code);

    // 2. Fetch profile info
    const { profile } = await githubService.getAuthenticatedUserInfo(accessToken);
    const githubId = String(profile.id);

    // 3. Prevent Duplicate Linking: Verify if this GitHub ID is already linked to another account
    const existingLink = await prisma.user.findUnique({
      where: { githubId },
    });

    if (existingLink) {
      if (existingLink.id === userId) {
        // Already linked to the current user
        return existingLink;
      }
      const error = new Error('This GitHub account is already linked to another DevLens user.');
      error.statusCode = 409;
      error.name = 'GithubLinkConflictError';
      throw error;
    }

    // Encrypt token
    const encryptedToken = encrypt(accessToken);

    // 4. Update the user with the GitHub ID and encrypted access token
    let user = await prisma.user.update({
      where: { id: userId },
      data: {
        githubId,
        githubUsername: profile.login,
        githubAccessToken: encryptedToken,
      },
    });

    // 5. Synchronize metadata
    user = await profileSyncService.synchronizeProfile(userId, profile);

    logger.info(`Successfully linked GitHub account @${profile.login} to User ID ${userId}.`);
    return user;
  }

  /**
   * Unlinks a GitHub account from an active DevLens profile.
   */
  async unlinkGithubAccount(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    if (!user.githubId) {
      const error = new Error('Your account is not linked to GitHub.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Lockout Prevention: Ensure user has an alternative login method
    // If the user has no passwordHash, they registered via GitHub OAuth only and have no local credentials!
    if (!user.passwordHash) {
      const error = new Error(
        'Cannot unlink GitHub account. You must set a password on your account before unlinking to prevent lockout.'
      );
      error.statusCode = 400;
      error.name = 'UnlinkLockoutError';
      throw error;
    }

    // 2. Clear all OAuth and synchronized fields
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        githubId: null,
        githubUsername: null,
        githubAccessToken: null,
        githubBio: null,
        githubReposCount: 0,
        githubFollowers: 0,
        githubFollowing: 0,
        githubCompany: null,
        githubLocation: null,
        githubBlog: null,
        githubTwitter: null,
      },
    });

    logger.info(`Successfully unlinked GitHub account from User ID ${userId}.`);
    return updatedUser;
  }
}

export default new OauthService();

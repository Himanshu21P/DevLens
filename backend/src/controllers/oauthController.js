import oauthService from '../services/oauthService.js';
import logger from '../utils/logger.js';

// Helper to set the secure HttpOnly refresh token cookie
const setRefreshTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  res.cookie('refreshToken', token, cookieOptions);
};

class OauthController {
  /**
   * GitHub OAuth Callback: processes code, authenticates user, sets cookie, and returns access token.
   */
  githubCallback = async (req, res, next) => {
    try {
      const { code } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is missing.',
          errors: [{ message: 'GitHub code is required in the request body.' }],
          error: {
            message: 'Authorization code is missing.',
            code: 'BAD_REQUEST',
            details: {}
          }
        });
      }

      const { accessToken, refreshToken, user } = await oauthService.loginWithGithub({
        code,
        ipAddress,
        userAgent,
      });

      // Set refresh token cookie
      setRefreshTokenCookie(res, refreshToken);

      return res.status(200).json({
        success: true,
        message: 'GitHub authentication successful.',
        data: {
          accessToken,
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Link GitHub account to current authenticated profile.
   */
  linkGithub = async (req, res, next) => {
    try {
      const { code } = req.body;
      const userId = req.user.id; // From requireAuth middleware

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is missing.',
          errors: [{ message: 'GitHub code is required in the request body.' }],
          error: {
            message: 'Authorization code is missing.',
            code: 'BAD_REQUEST',
            details: {}
          }
        });
      }

      const updatedUser = await oauthService.linkGithubAccount(userId, code);

      return res.status(200).json({
        success: true,
        message: 'GitHub account linked successfully.',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            avatarUrl: updatedUser.avatarUrl,
            githubUsername: updatedUser.githubUsername,
          },
        },
      });
    } catch (err) {
      if (err.name === 'GithubLinkConflictError') {
        return res.status(409).json({
          success: false,
          message: err.message,
          errors: [{ message: 'Conflict: This GitHub account is already linked.' }],
          error: {
            message: err.message,
            code: 'CONFLICT',
            details: {}
          }
        });
      }
      next(err);
    }
  };

  /**
   * Unlink GitHub account from current profile (with lockout safety checks).
   */
  unlinkGithub = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const updatedUser = await oauthService.unlinkGithubAccount(userId);

      return res.status(200).json({
        success: true,
        message: 'GitHub account unlinked successfully.',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            avatarUrl: updatedUser.avatarUrl,
            githubUsername: null,
          },
        },
      });
    } catch (err) {
      if (err.name === 'UnlinkLockoutError') {
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: [{ message: 'Lockout Prevention: Local password is required.' }],
          error: {
            message: err.message,
            code: 'BAD_REQUEST',
            details: {}
          }
        });
      }
      next(err);
    }
  };
}

export default new OauthController();

import authService from '../services/authService.js';
import logger from '../utils/logger.js';

// Helper to set the rotated refresh token inside a secure, HttpOnly cookie
const setRefreshTokenCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth', // Scopes cookie only to auth routes
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  };
  res.cookie('refreshToken', token, cookieOptions);
};

// Helper to clear the refresh token cookie on logout
const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
};

class AuthController {
  /**
   * Register a new user local credentials.
   */
  register = async (req, res, next) => {
    try {
      const { email, password, name } = req.body;
      const userData = await authService.registerUser({ email, password, name });
      
      return res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: { user: userData },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Authenticate local credentials and issue rotated tokens.
   */
  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const { accessToken, refreshToken, user } = await authService.loginUser({
        email,
        password,
        ipAddress,
        userAgent,
      });

      // Set refresh token in secure cookie
      setRefreshTokenCookie(res, refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: {
          accessToken,
          user,
        },
      });
    } catch (err) {
      // Map credential failures directly to standardized 401 response
      if (err.name === 'InvalidCredentialsError') {
        return res.status(401).json({
          success: false,
          message: err.message,
          errors: [{ message: 'The credentials you provided are incorrect.' }],
          error: {
            message: err.message,
            code: 'UNAUTHORIZED',
            details: {}
          }
        });
      }
      next(err);
    }
  };

  /**
   * Rotate access and refresh token pair using RTR.
   */
  refresh = async (req, res, next) => {
    try {
      // Extract refresh token from cookie or request body as a fallback
      const cookies = req.headers.cookie || '';
      const cookieMap = {};
      cookies.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        if (parts.length === 2) {
          cookieMap[parts[0].trim()] = parts[1].trim();
        }
      });
      
      const refreshToken = cookieMap['refreshToken'] || req.body.refreshToken;
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is missing.',
          errors: [{ message: 'Cookie or payload does not contain a refresh token.' }],
          error: {
            message: 'Refresh token is missing.',
            code: 'UNAUTHORIZED',
            details: {}
          }
        });
      }

      const tokens = await authService.refreshUserToken({
        refreshToken,
        ipAddress,
        userAgent,
      });

      // Set the newly rotated refresh token in the secure cookie
      setRefreshTokenCookie(res, tokens.refreshToken);

      return res.status(200).json({
        success: true,
        message: 'Tokens rotated successfully.',
        data: {
          accessToken: tokens.accessToken,
        },
      });
    } catch (err) {
      if (err.name === 'SecurityBreachError' || err.name === 'InvalidTokenError') {
        // Clear cookie if session is compromised or invalid
        clearRefreshTokenCookie(res);
        return res.status(401).json({
          success: false,
          message: err.message,
          errors: [{ message: 'Your session has expired or was terminated.' }],
          error: {
            message: err.message,
            code: 'UNAUTHORIZED',
            details: {}
          }
        });
      }
      next(err);
    }
  };

  /**
   * Terminate current session and clear cookies.
   */
  logout = async (req, res, next) => {
    try {
      const cookies = req.headers.cookie || '';
      const cookieMap = {};
      cookies.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        if (parts.length === 2) {
          cookieMap[parts[0].trim()] = parts[1].trim();
        }
      });
      
      const refreshToken = cookieMap['refreshToken'] || req.body.refreshToken;

      if (refreshToken) {
        await authService.logoutUser(refreshToken);
      }

      // Clear cookie
      clearRefreshTokenCookie(res);

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Request password reset token.
   */
  forgotPassword = async (req, res, next) => {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);

      // Return generic success to prevent email enumeration attacks
      return res.status(200).json({
        success: true,
        message: 'If the email exists in our system, a password reset link has been generated.',
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Reset password using token.
   */
  resetPassword = async (req, res, next) => {
    try {
      const { token, password } = req.body;
      await authService.resetPassword({ token, password });

      return res.status(200).json({
        success: true,
        message: 'Password has been successfully reset. You can now log in with your new password.',
      });
    } catch (err) {
      if (err.name === 'InvalidResetTokenError') {
        return res.status(400).json({
          success: false,
          message: err.message,
          errors: [{ message: 'The reset link is invalid or has expired.' }],
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

export default new AuthController();

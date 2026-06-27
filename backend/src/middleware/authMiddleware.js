import { verifyAccessToken } from '../utils/auth.js';
import logger from '../utils/logger.js';

/**
 * Middleware that protects routes by validating a JWT access token.
 * Populates req.user with decoded token claims on success.
 */
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a Bearer token.',
        errors: [{ message: 'Access token is missing.' }],
        error: {
          message: 'Authentication required. Please provide a Bearer token.',
          code: 'UNAUTHORIZED',
          details: {}
        }
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Attach decoded user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    logger.warn(`JWT Access Token Verification Failed: ${err.message}`);
    
    let message = 'Invalid or expired access token.';
    if (err.name === 'TokenExpiredError') {
      message = 'Access token has expired.';
    }

    return res.status(401).json({
      success: false,
      message,
      errors: [{ message: err.message }],
      error: {
        message,
        code: 'UNAUTHORIZED',
        details: {}
      }
    });
  }
};

export default requireAuth;

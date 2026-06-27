import { Router } from 'express';
import oauthController from '../controllers/oauthController.js';
import requireAuth from '../middleware/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/v1/auth/github/callback:
 *   post:
 *     summary: GitHub OAuth Login Callback
 *     description: Swaps a GitHub authorization code for an access token, synchronizes profile metadata, and creates a secure session.
 *     tags:
 *       - OAuth Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: a8b7c6d5e4f3a2b1
 *     responses:
 *       200:
 *         description: GitHub login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: GitHub authentication successful.
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         email:
 *                           type: string
 *                           example: dev@github.com
 *                         name:
 *                           type: string
 *                           example: Alex Dev
 *                         avatarUrl:
 *                           type: string
 *                           example: https://avatars.githubusercontent.com/u/123
 *                         githubUsername:
 *                           type: string
 *                           example: alexdev
 *       400:
 *         description: Missing code or invalid exchange
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Authorization code is missing.
 */
router.post('/github/callback', oauthController.githubCallback);

/**
 * @openapi
 * /api/v1/auth/github/link:
 *   post:
 *     summary: Link GitHub account
 *     description: Connects a GitHub account to the currently authenticated profile. Ownership is verified via OAuth.
 *     tags:
 *       - OAuth Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *                 example: a8b7c6d5e4f3a2b1
 *     responses:
 *       200:
 *         description: GitHub account linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: GitHub account linked successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         email:
 *                           type: string
 *                           example: dev@github.com
 *                         name:
 *                           type: string
 *                           example: Alex Dev
 *                         avatarUrl:
 *                           type: string
 *                           example: https://avatars.githubusercontent.com/u/123
 *                         githubUsername:
 *                           type: string
 *                           example: alexdev
 *       409:
 *         description: GitHub account is already linked to another DevLens user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: This GitHub account is already linked to another DevLens user.
 */
router.post('/github/link', requireAuth, oauthController.linkGithub);

/**
 * @openapi
 * /api/v1/auth/github/unlink:
 *   post:
 *     summary: Unlink GitHub account
 *     description: Disconnects the GitHub profile. Restricts unlinking if no alternative login method (local password) exists to prevent lockout.
 *     tags:
 *       - OAuth Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub account unlinked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: GitHub account unlinked successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         email:
 *                           type: string
 *                           example: dev@github.com
 *                         name:
 *                           type: string
 *                           example: Alex Dev
 *                         avatarUrl:
 *                           type: string
 *                           example: https://avatars.githubusercontent.com/u/123
 *                         githubUsername:
 *                           type: string
 *                           example: null
 *       400:
 *         description: Cannot unlink due to account lockout safety check
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Cannot unlink GitHub account. You must set a password on your account before unlinking to prevent lockout.
 */
router.post('/github/unlink', requireAuth, oauthController.unlinkGithub);

export default router;

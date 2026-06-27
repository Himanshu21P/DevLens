import express from 'express';
import rateLimit from 'express-rate-limit';
import analyticsController from '../controllers/analyticsController.js';
import requireAuth from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validationMiddleware.js';
import { analyzeParamsSchema, saveReportSchema } from '../validators/analyticsValidator.js';

const router = express.Router();

// 1. Rate limiter for the public profile analysis endpoint
// Limits each IP to 20 profile analyses per 15 minutes to prevent GitHub API rate quota exhaustion.
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many profile analyses requested from this IP, please try again after 15 minutes.',
  },
});

// 2. Custom validation middleware for route path parameters
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/['"]/g, ''),
        })),
      });
    }
    next();
  };
};

// ==========================================
// Swagger / OpenAPI Definitions & Routes
// ==========================================

/**
 * @openapi
 * /api/v1/analytics/analyze/{username}:
 *   get:
 *     summary: Analyze a developer's GitHub profile and repositories
 *     description: Publicly accessible endpoint to perform a deterministic score and quality audit on any GitHub profile. Supports optional authentication header to fetch private repository aggregates and bypass public API rate limits.
 *     tags:
 *       - Analytics
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: The target developer's GitHub username
 *     responses:
 *       200:
 *         description: Successful profile analysis and deterministic score breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: completed
 *                     result:
 *                       type: object
 *                       properties:
 *                         targetGithubUsername:
 *                           type: string
 *                         developerScore:
 *                           type: integer
 *                         scoreBreakdown:
 *                           type: object
 *                         reposAnalyzed:
 *                           type: array
 *                         languageData:
 *                           type: object
 *                         suggestions:
 *                           type: array
 *       400:
 *         description: Validation Error (malformed username)
 *       429:
 *         description: Too many analysis requests from this IP
 */
router.get(
  '/analyze/:username',
  analysisLimiter,
  validateParams(analyzeParamsSchema),
  analyticsController.analyzeProfile
);

/**
 * @openapi
 * /api/v1/analytics/report/save:
 *   post:
 *     summary: Save a completed developer analysis report
 *     description: Authenticated endpoint to persist a developer analysis profile to the user's saved library. Stashes scoring versions, analysis timestamps, and raw metadata snapshots.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetGithubUsername
 *               - developerScore
 *               - scoreBreakdown
 *               - reposAnalyzed
 *               - languageData
 *               - rawMetadataCache
 *     responses:
 *       201:
 *         description: Report saved successfully
 *       400:
 *         description: Validation Error (invalid payload)
 *       401:
 *         description: Authentication required
 */
router.post(
  '/report/save',
  requireAuth,
  validateBody(saveReportSchema),
  analyticsController.saveReport
);

/**
 * @openapi
 * /api/v1/analytics/report/saved:
 *   get:
 *     summary: Fetch all saved reports for the authenticated user
 *     description: Authenticated endpoint to retrieve the collection of saved portfolio reports belonging to the session user.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved reports
 *       401:
 *         description: Authentication required
 */
router.get(
  '/report/saved',
  requireAuth,
  analyticsController.getSavedReports
);

/**
 * @openapi
 * /api/v1/analytics/report/{id}:
 *   delete:
 *     summary: Delete a saved analysis report
 *     description: Authenticated endpoint to delete a specific report from the user's library. Verifies ownership authorization.
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID of the saved report
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Unauthorized to delete this report
 *       404:
 *         description: Report not found
 */
router.delete(
  '/report/:id',
  requireAuth,
  analyticsController.deleteReport
);

/**
 * @openapi
 * /api/v1/analytics/report/compare/{username}:
 *   get:
 *     summary: Retrieve historical score progression and comparison metrics
 *     description: Authenticated endpoint to compile overall and category-level score deltas, biggest improvements, regressions, and resolved improvement suggestions for a developer profile across saved historical reports.
 *     tags:
 *       - Comparison
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: The target developer's GitHub username to compare
 *     responses:
 *       200:
 *         description: Detailed progression metrics compiled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     timeline:
 *                       type: array
 *                     deltas:
 *                       type: object
 *                     biggestImprovement:
 *                       type: string
 *                     areasRegressed:
 *                       type: array
 *                     resolvedSuggestions:
 *                       type: array
 *       401:
 *         description: Authentication required
 */
router.get(
  '/report/compare/:username',
  requireAuth,
  validateParams(analyzeParamsSchema),
  analyticsController.getComparisonHistory
);

/**
 * @openapi
 * /api/v1/analytics/export/pdf:
 *   post:
 *     summary: Export developer analysis report as PDF (Unsaved/Guest)
 *     description: Accepts a completed analysis report JSON payload in the request body, compiles it, and streams a beautifully formatted PDF file back.
 *     tags:
 *       - Exports
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Generated PDF document stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation Error (invalid report payload)
 */
router.post(
  '/export/pdf',
  validateBody(saveReportSchema),
  analyticsController.exportPdf
);

/**
 * @openapi
 * /api/v1/analytics/report/{id}/export/pdf:
 *   get:
 *     summary: Export a saved developer analysis report as PDF
 *     description: Authenticated endpoint to fetch a previously saved report from the database and stream its compiled PDF.
 *     tags:
 *       - Exports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID of the saved report
 *     responses:
 *       200:
 *         description: Generated PDF document stream
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Unauthorized to access this report
 *       404:
 *         description: Report not found
 */
router.get(
  '/report/:id/export/pdf',
  requireAuth,
  analyticsController.exportSavedReportPdf
);

export default router;

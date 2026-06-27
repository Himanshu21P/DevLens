import analyticsService from '../services/analyticsService.js';
import reportService from '../services/reportService.js';
import pdfService from '../services/pdfService.js';
import { verifyAccessToken } from '../utils/auth.js';
import logger from '../utils/logger.js';

class AnalyticsController {
  /**
   * Triggers the collection and scoring of a target developer profile.
   * Performs an optional session validation to retrieve the user's connected GitHub token.
   */
  async analyzeProfile(req, res, next) {
    try {
      const { username } = req.params;
      let requesterUserId = null;

      // Optional Auth: If a Bearer token is provided, verify it to resolve the requester's ID.
      // Do not throw if missing or invalid, as profile searches are publicly accessible (rate-limited).
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          const decoded = verifyAccessToken(token);
          requesterUserId = decoded.userId;
        }
      } catch (authError) {
        logger.debug(`Optional auth token resolution bypassed: ${authError.message}`);
      }

      logger.info(`REST request to analyze profile: ${username} (Requester User ID: ${requesterUserId || 'Guest'})`);
      const analysis = await analyticsService.analyzeProfile(username, requesterUserId);

      return res.status(200).json({
        success: true,
        message: 'Profile analyzed successfully.',
        data: analysis,
      });
    } catch (err) {
      logger.error(`Controller analyzeProfile failed: ${err.message}`);
      next(err);
    }
  }

  /**
   * Saves a compiled analysis report to the database.
   * Requires active authentication.
   */
  async saveReport(req, res, next) {
    try {
      const userId = req.user.id; // Populated by requireAuth middleware
      const reportData = req.body;

      logger.info(`REST request to save report by user ID ${userId}`);
      const savedReport = await reportService.saveReport(userId, reportData);

      return res.status(201).json({
        success: true,
        message: 'Analysis report saved successfully.',
        data: savedReport,
      });
    } catch (err) {
      logger.error(`Controller saveReport failed: ${err.message}`);
      next(err);
    }
  }

  /**
   * Retrieves all saved reports for the authenticated user.
   */
  async getSavedReports(req, res, next) {
    try {
      const userId = req.user.id;

      logger.info(`REST request to fetch saved reports for user ID ${userId}`);
      const reports = await reportService.getSavedReports(userId);

      return res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (err) {
      logger.error(`Controller getSavedReports failed: ${err.message}`);
      next(err);
    }
  }

  /**
   * Deletes a saved report belonging to the authenticated user.
   */
  async deleteReport(req, res, next) {
    try {
      const userId = req.user.id;
      const { id: reportId } = req.params;

      logger.info(`REST request to delete report ID ${reportId} by user ID ${userId}`);
      await reportService.deleteReport(userId, reportId);

      return res.status(200).json({
        success: true,
        message: 'Report deleted successfully.',
      });
    } catch (err) {
      logger.error(`Controller deleteReport failed: ${err.message}`);
      next(err);
    }
  }

  /**
   * Generates and streams a PDF for an unsaved report payload.
   */
  async exportPdf(req, res, next) {
    try {
      const reportData = req.body;
      const username = reportData.targetGithubUsername || 'Developer';
      
      logger.info(`REST request to export unsaved profile analysis for @${username} as PDF`);
      const pdfBuffer = await pdfService.generateDeveloperReportPDF(reportData);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${username}_Capability_Audit_Report.pdf"`);
      return res.status(200).send(pdfBuffer);
    } catch (err) {
      logger.error(`Controller exportPdf failed: ${err.message}`);
      next(err);
    }
  }

  /**
   * Fetches a saved report and streams it as a generated PDF.
   * Requires owner authorization.
   */
  async exportSavedReportPdf(req, res, next) {
    try {
      const userId = req.user.id;
      const { id: reportId } = req.params;

      logger.info(`REST request to export saved report ID ${reportId} as PDF for user ID ${userId}`);
      const report = await reportService.getSavedReportById(userId, reportId);
      
      const pdfBuffer = await pdfService.generateDeveloperReportPDF(report);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${report.targetGithubUsername}_Capability_Audit_Report.pdf"`);
      return res.status(200).send(pdfBuffer);
    } catch (err) {
      logger.error(`Controller exportSavedReportPdf failed: ${err.message}`);
      next(err);
    }
  }

  /**
   * Compiles historical progress analytics for a saved developer profile.
   * Restricted to authenticated user libraries.
   */
  async getComparisonHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { username } = req.params;

      logger.info(`REST request to compile progress comparison for @${username} by user ID ${userId}`);
      const data = await reportService.getComparisonData(userId, username);

      return res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      logger.error(`Controller getComparisonHistory failed: ${err.message}`);
      next(err);
    }
  }
}

export default new AnalyticsController();

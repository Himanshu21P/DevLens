import prisma from '../config/db.js';
import logger from '../utils/logger.js';

class ReportService {
  /**
   * Saves a compiled analysis report to the database.
   * Initializes AI-related columns to defaults, to be enriched in Phase 4.
   * 
   * @param {number} userId - ID of the authenticated user saving the report
   * @param {object} data - The validated report details
   * @returns {Promise<object>} Saved database report record
   */
  async saveReport(userId, data) {
    logger.info(`Saving analysis report for user ID ${userId}, target developer: ${data.targetGithubUsername}`);

    // Map incoming structured data with AI insights to the database columns.
    // Nest learningRoadmap and interviewPrep inside resumeBreakdown to avoid schema migrations.
    const enrichedResumeBreakdown = {
      ...(data.resumeBreakdown || {}),
      learningRoadmap: data.learningRoadmap || null,
      interviewPrep: data.interviewPrep || null,
    };

    const reportRecord = await prisma.analysisReport.create({
      data: {
        userId,
        targetGithubUsername: data.targetGithubUsername,
        developerScore: data.developerScore,
        scoreBreakdown: data.scoreBreakdown,
        reposAnalyzed: data.reposAnalyzed,
        languageData: data.languageData,
        rawMetadataCache: data.rawMetadataCache,
        isSaved: true,
        suggestions: data.suggestions || [],
        aiSummary: data.aiSummary,
        resumeReadinessStars: data.resumeReadinessStars,
        resumeBreakdown: enrichedResumeBreakdown,
        strengths: data.strengths || [],
        weaknesses: data.weaknesses || [],
      },
    });

    logger.info(`Successfully saved report ID: ${reportRecord.id}`);
    return reportRecord;
  }

  /**
   * Retrieves all saved reports for a user.
   * Unpacks nested learningRoadmap and interviewPrep back to the root of the object.
   * 
   * @param {number} userId - ID of the authenticated user
   * @returns {Promise<array>} List of saved reports
   */
  async getSavedReports(userId) {
    logger.info(`Fetching saved reports for user ID: ${userId}`);
    const reports = await prisma.analysisReport.findMany({
      where: {
        userId,
        isSaved: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reports.map((report) => {
      const resumeBreakdown = report.resumeBreakdown || {};
      const { learningRoadmap, interviewPrep, ...cleanResumeBreakdown } = resumeBreakdown;

      return {
        ...report,
        resumeBreakdown: cleanResumeBreakdown,
        learningRoadmap: learningRoadmap || null,
        interviewPrep: interviewPrep || null,
      };
    });
  }

  /**
   * Retrieves a single saved report, checking owner authorization.
   * Unpacks nested learningRoadmap and interviewPrep back to the root of the object.
   * 
   * @param {number} userId - ID of the authenticated user
   * @param {string} reportId - Target report UUID
   * @returns {Promise<object>} Saved report details
   */
  async getSavedReportById(userId, reportId) {
    logger.info(`Fetching saved report ID ${reportId} for user ID ${userId}`);
    const report = await prisma.analysisReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      logger.warn(`Fetch failed: Report ID ${reportId} not found.`);
      const err = new Error('The requested report was not found.');
      err.statusCode = 404;
      throw err;
    }

    if (report.userId !== userId) {
      logger.warn(`Security Violation: User ID ${userId} unauthorized to access report ID ${reportId}`);
      const err = new Error('You are not authorized to view this report.');
      err.statusCode = 403;
      throw err;
    }

    const resumeBreakdown = report.resumeBreakdown || {};
    const { learningRoadmap, interviewPrep, ...cleanResumeBreakdown } = resumeBreakdown;

    return {
      ...report,
      resumeBreakdown: cleanResumeBreakdown,
      learningRoadmap: learningRoadmap || null,
      interviewPrep: interviewPrep || null,
    };
  }

  /**
   * Deletes a saved report.
   * Enforces strict authorization to verify that the report belongs to the user.
   * 
   * @param {number} userId - ID of the authenticated user making the request
   * @param {string} reportId - Target report UUID
   * @returns {Promise<object>} Deleted report record
   */
  async deleteReport(userId, reportId) {
    logger.info(`Attempting to delete report ID ${reportId} for user ID ${userId}`);

    // 1. Verify existence of the report
    const report = await prisma.analysisReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      logger.warn(`Delete failed: Report ID ${reportId} not found.`);
      const err = new Error('The requested report was not found.');
      err.statusCode = 404;
      throw err;
    }

    // 2. Security check: verify owner authorization
    if (report.userId !== userId) {
      logger.warn(`Security Violation: User ID ${userId} unauthorized to delete report ID ${reportId} belonging to user ID ${report.userId}`);
      const err = new Error('You are not authorized to delete this report.');
      err.statusCode = 403;
      throw err;
    }

    // 3. Delete the report
    const deletedRecord = await prisma.analysisReport.delete({
      where: { id: reportId },
    });

    logger.info(`Successfully deleted report ID: ${reportId}`);
    return deletedRecord;
  }

  /**
   * Compiles historical analysis reports for a user/developer, calculating progress deltas and resolved items.
   * Restrained to authenticated user libraries.
   */
  async getComparisonData(userId, username) {
    logger.info(`Fetching comparison history for user ID ${userId}, target developer: ${username}`);

    const reports = await prisma.analysisReport.findMany({
      where: {
        userId,
        targetGithubUsername: username,
        isSaved: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (reports.length === 0) {
      return {
        timeline: [],
        deltas: { overallScoreDelta: 0, categoryDeltas: {} },
        biggestImprovement: null,
        areasRegressed: [],
        resolvedSuggestions: [],
      };
    }

    // 1. Build Timeline
    const timeline = reports.map((report) => {
      const categories = report.scoreBreakdown?.categories || {};
      const catScores = {};
      Object.entries(categories).forEach(([key, val]) => {
        catScores[key] = val.score || 0;
      });

      return {
        id: report.id,
        createdAt: report.createdAt,
        developerScore: report.developerScore,
        categories: catScores,
      };
    });

    // 2. Compute Deltas (Latest vs Earliest)
    const earliest = reports[0];
    const latest = reports[reports.length - 1];

    const overallScoreDelta = latest.developerScore - earliest.developerScore;

    const earliestCategories = earliest.scoreBreakdown?.categories || {};
    const latestCategories = latest.scoreBreakdown?.categories || {};
    
    const categoryDeltas = {};
    const categoriesList = [
      'repositoryQuality',
      'documentation',
      'technologyDiversity',
      'projectActivity',
      'openSourceEngagement',
      'portfolioReadiness'
    ];

    categoriesList.forEach((catKey) => {
      const earliestScore = earliestCategories[catKey]?.score || 0;
      const latestScore = latestCategories[catKey]?.score || 0;
      categoryDeltas[catKey] = latestScore - earliestScore;
    });

    // 3. Biggest Improvement & Regressions
    let maxDelta = -Infinity;
    let biggestImprovement = null;
    const areasRegressed = [];

    Object.entries(categoryDeltas).forEach(([catKey, delta]) => {
      if (delta > maxDelta && delta > 0) {
        maxDelta = delta;
        biggestImprovement = catKey;
      }
      if (delta < 0) {
        areasRegressed.push(catKey);
      }
    });

    // 4. Resolved Suggestions
    // Historical suggestions (from all reports except the latest)
    const historicalSuggestions = new Set();
    reports.slice(0, -1).forEach((report) => {
      const sugs = report.suggestions || [];
      sugs.forEach((s) => historicalSuggestions.add(s));
    });

    // Latest suggestions
    const latestSuggestions = new Set(latest.suggestions || []);

    // Resolved suggestions are in history but not in latest
    const resolvedSuggestions = [];
    historicalSuggestions.forEach((s) => {
      if (!latestSuggestions.has(s)) {
        resolvedSuggestions.push(s);
      }
    });

    return {
      timeline,
      deltas: {
        overallScoreDelta,
        categoryDeltas,
      },
      biggestImprovement,
      areasRegressed,
      resolvedSuggestions,
    };
  }
}

export default new ReportService();

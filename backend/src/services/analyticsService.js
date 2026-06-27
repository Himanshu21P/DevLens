import prisma from '../config/db.js';
import { decrypt } from '../utils/crypto.js';
import portfolioDataCollector from './portfolioDataCollector.js';
import scoringEngine from './scoring/scoringEngine.js';
import aiService from './ai/aiService.js';
import logger from '../utils/logger.js';

class AnalyticsService {
  /**
   * Performs profile collection and scoring, returning a standardized response.
   * Resolves the linked GitHub OAuth token if the requester is authenticated
   * and has connected their GitHub profile.
   * 
   * @param {string} username - Target developer's username
   * @param {number} [requesterUserId] - Optional authenticated user ID
   * @returns {Promise<object>} Standardized completed status envelope
   */
  async analyzeProfile(username, requesterUserId = null) {
    let decryptedToken = null;

    // 1. Attempt to resolve linked GitHub token if requester is authenticated
    if (requesterUserId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: requesterUserId },
          select: { githubAccessToken: true, githubUsername: true },
        });

        if (user && user.githubAccessToken) {
          logger.info(`Resolving encrypted GitHub token for active session of user ID ${requesterUserId}`);
          decryptedToken = decrypt(user.githubAccessToken);
        }
      } catch (dbError) {
        logger.warn(`Failed to resolve requester GitHub token from DB: ${dbError.message}. Proceeding with guest access.`);
      }
    }

    // 2. Fetch, normalize, and sanitize portfolio details
    logger.info(`Collecting portfolio data for developer: ${username}`);
    const normalizedData = await portfolioDataCollector.collectPortfolioData(
      username,
      decryptedToken
    );

    // 3. Compute deterministic scores
    logger.info(`Calculating scores for developer: ${username}`);
    const scoringResult = scoringEngine.calculateDeveloperScore(normalizedData);

    // 4. Extract and map repos analyzed for reports schema
    const reposAnalyzed = normalizedData.topRepositories.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      stars: repo.stars || 0,
      forks: repo.forks || 0,
      primaryLanguage: repo.primaryLanguage || null,
      homepage: repo.homepage || null,
      size: repo.size || 0,
      isPrivate: repo.isPrivate || false,
    }));

    // 5. Gather unique suggestions from all category breakdowns
    const suggestions = Object.values(scoringResult.categories).flatMap(
      (cat) => cat.improvements || []
    );
    const uniqueSuggestions = Array.from(new Set(suggestions));

    // 6. Assemble the structured, extensible result envelope
    const analysisResult = {
      targetGithubUsername: normalizedData.profile.username,
      developerScore: scoringResult.overallScore,
      scoreBreakdown: {
        overallScore: scoringResult.overallScore,
        confidenceScore: scoringResult.confidenceScore,
        scoringVersion: scoringResult.scoringVersion,
        analyzedAt: scoringResult.analyzedAt,
        categories: scoringResult.categories,
      },
      reposAnalyzed,
      languageData: scoringResult.rawMetrics.codebase.languagesPercentage,
      rawMetadataCache: normalizedData, // Storing the full normalized model as snapshot
      suggestions: uniqueSuggestions,
    };

    // 7. Generate AI qualitative insights (AI Provider abstraction, validation, retry, fallback)
    logger.info(`Generating AI insights for developer: ${analysisResult.targetGithubUsername}`);
    const aiInsights = await aiService.generateInsights(analysisResult);

    // 8. Merge AI qualitative insights into the extensible result
    analysisResult.aiSummary = aiInsights.aiSummary;
    analysisResult.strengths = aiInsights.strengths;
    analysisResult.weaknesses = aiInsights.weaknesses;
    analysisResult.resumeReadinessStars = aiInsights.resumeReadinessStars;
    analysisResult.resumeBreakdown = aiInsights.resumeBreakdown;
    analysisResult.learningRoadmap = aiInsights.learningRoadmap;
    analysisResult.interviewPrep = aiInsights.interviewPrep;

    // 9. Persist AI metadata in scoreBreakdown, clearly distinguishing Gemini vs Fallback
    analysisResult.scoreBreakdown.aiMetadata = {
      provider: aiInsights.aiMetadata.provider,
      model: aiInsights.aiMetadata.model,
      promptVersion: aiInsights.aiMetadata.promptVersion,
      timestamp: aiInsights.aiMetadata.timestamp,
      responseTimeMs: aiInsights.aiMetadata.responseTimeMs,
      retryCount: aiInsights.aiMetadata.retryCount,
      fallbackStatus: aiInsights.aiMetadata.fallbackStatus,
      cached: aiInsights.aiMetadata.cached,
      analyticsHash: aiInsights.aiMetadata.analyticsHash,
      insightSource: aiInsights.aiMetadata.fallbackStatus ? 'fallback' : 'gemini',
    };

    // 10. Persist SHA-256 analytics hash in rawMetadataCache
    analysisResult.rawMetadataCache.analyticsHash = aiInsights.aiMetadata.analyticsHash;

    return {
      status: 'completed', // Envelope wrapper to support future async job status (pending/completed)
      result: analysisResult,
    };
  }
}

export default new AnalyticsService();

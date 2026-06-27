import { scoringConfig } from '../../config/scoringConfig.js';
import repositoryQualityService from './repositoryQualityService.js';
import documentationQualityService from './documentationQualityService.js';
import technologyDiversityService from './technologyDiversityService.js';
import projectActivityService from './projectActivityService.js';
import openSourceEngagementService from './openSourceEngagementService.js';
import portfolioReadinessService from './portfolioReadinessService.js';
import logger from '../../utils/logger.js';

class ScoringEngine {
  /**
   * Orchestrates the scoring process by invoking all independent scoring services
   * and aggregating their results into a unified, versioned, and detailed breakdown.
   * 
   * METHODOLOGY:
   * 1. Runs the 6 core category services (Repository Quality, Documentation Quality,
   *    Technology Diversity, Project Activity, Open Source Engagement, Portfolio Readiness)
   *    on the normalized developer profile data.
   * 2. Calculates the overall weighted Developer Score (0-100) using weights defined
   *    in `scoringConfig.js`.
   * 3. Calculates a representativeness confidence score (0-100) based on the volume of
   *    available original repositories.
   * 4. Assembles a structured JSON response designed to be easily extensible for future
   *    historical comparisons and AI analysis.
   * 
   * @param {object} data - Standardized DeveloperAnalysisData model
   * @returns {object} Highly detailed score breakdown, raw metrics, and audit metadata
   */
  calculateDeveloperScore(data) {
    const username = data.profile?.username || 'unknown';
    logger.info(`Running scoring engine for developer: ${username}`);

    const weights = scoringConfig.CATEGORY_WEIGHTS;

    // 1. Execute all independent scoring services
    const repositoryQuality = repositoryQualityService.calculateScore(data);
    const documentationQuality = documentationQualityService.calculateScore(data);
    const technologyDiversity = technologyDiversityService.calculateScore(data);
    const projectActivity = projectActivityService.calculateScore(data);
    const openSourceEngagement = openSourceEngagementService.calculateScore(data);
    const portfolioReadiness = portfolioReadinessService.calculateScore(data);

    // 2. Calculate the overall weighted Developer Score
    const weightedScore = 
      (repositoryQuality.score * weights.repositoryQuality) +
      (documentationQuality.score * weights.documentationQuality) +
      (projectActivity.score * weights.projectActivity) +
      (technologyDiversity.score * weights.technologyDiversity) +
      (openSourceEngagement.score * weights.openSourceEngagement) +
      (portfolioReadiness.score * weights.portfolioReadiness);

    const overallScore = Math.max(0, Math.min(Math.round(weightedScore), 100));

    // 3. Calculate data representativeness confidence score (0-100)
    // 0 original repos = 10% (minimal representation)
    // 1 original repo = 40%
    // 2 original repos = 60%
    // 3 original repos = 80%
    // 4 original repos = 90%
    // >=5 original repos = 100% (ideal statistical size for our analytics engine)
    let confidenceScore = 100;
    const originalCount = data.repositories?.originalCount || 0;
    if (originalCount === 0) {
      confidenceScore = 10;
    } else if (originalCount === 1) {
      confidenceScore = 40;
    } else if (originalCount === 2) {
      confidenceScore = 60;
    } else if (originalCount === 3) {
      confidenceScore = 80;
    } else if (originalCount === 4) {
      confidenceScore = 90;
    }

    // 4. Compile raw metrics for historical comparison and future AI insights
    const rawMetrics = {
      repositories: {
        totalCount: data.repositories?.totalCount || 0,
        originalCount,
        forkCount: data.repositories?.forkCount || 0,
        publicCount: data.repositories?.publicCount || 0,
        privateCount: data.repositories?.privateCount || 0,
      },
      starsAndForks: {
        totalStars: data.aggregateMetrics?.totalStars || 0,
        totalForks: data.aggregateMetrics?.totalForks || 0,
      },
      codebase: {
        totalSizeKB: data.aggregateMetrics?.totalSizeKB || 0,
        languagesPercentage: data.aggregateMetrics?.languagesPercentage || {},
      },
      activity: {
        totalCommitsPastYear: (data.aggregateMetrics?.totalCommitsPastYear || 0) + (data.aggregateMetrics?.privateCommitsCount || 0),
        publicCommitsPastYear: data.aggregateMetrics?.totalCommitsPastYear || 0,
        privateCommitsPastYear: data.aggregateMetrics?.privateCommitsCount || 0,
        recentActivityPushCount: data.aggregateMetrics?.recentActivityPushCount || 0,
      },
      documentation: {
        hasPersonalReadme: !!data.aggregateMetrics?.hasPersonalReadme,
        readmeCoveragePercent: data.topRepositories?.length > 0
          ? Math.round((data.topRepositories.filter(r => r.documentation?.readme?.exists).length / data.topRepositories.length) * 100)
          : 0,
        licenseCoveragePercent: data.topRepositories?.length > 0
          ? Math.round((data.topRepositories.filter(r => r.documentation?.license?.exists).length / data.topRepositories.length) * 100)
          : 0,
      }
    };

    // 5. Build structured response designed to support historical trend tracking
    // Every category contains a current score, its respective weight, factor breakdowns,
    // and actionable improvement lists.
    const scoreBreakdown = {
      overallScore,
      confidenceScore,
      scoringVersion: scoringConfig.VERSION,
      analyzedAt: new Date().toISOString(),
      categories: {
        repositoryQuality: {
          score: repositoryQuality.score,
          weight: weights.repositoryQuality,
          factors: repositoryQuality.factors,
          improvements: repositoryQuality.improvements,
        },
        documentationQuality: {
          score: documentationQuality.score,
          weight: weights.documentationQuality,
          factors: documentationQuality.factors,
          improvements: documentationQuality.improvements,
        },
        projectActivity: {
          score: projectActivity.score,
          weight: weights.projectActivity,
          factors: projectActivity.factors,
          improvements: projectActivity.improvements,
        },
        technologyDiversity: {
          score: technologyDiversity.score,
          weight: weights.technologyDiversity,
          factors: technologyDiversity.factors,
          improvements: technologyDiversity.improvements,
        },
        openSourceEngagement: {
          score: openSourceEngagement.score,
          weight: weights.openSourceEngagement,
          factors: openSourceEngagement.factors,
          improvements: openSourceEngagement.improvements,
        },
        portfolioReadiness: {
          score: portfolioReadiness.score,
          weight: weights.portfolioReadiness,
          factors: portfolioReadiness.factors,
          improvements: portfolioReadiness.improvements,
        },
      },
      rawMetrics,
    };

    logger.info(`Scoring complete for ${username}. Overall Score: ${overallScore}, Confidence: ${confidenceScore}%`);
    return scoreBreakdown;
  }
}

export default new ScoringEngine();

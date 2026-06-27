import { scoringConfig } from '../../config/scoringConfig.js';

class OpenSourceEngagementService {
  /**
   * Calculates the Open Source Engagement score.
   * 
   * METHODOLOGY:
   * 1. Stars Count (45%): Logarithmic/bracketed evaluation of stars accumulated across original projects.
   *    Stars represent peer appreciation and utility of the developer's public codebase.
   * 2. Forks Count (35%): Bracketed evaluation of forks across original projects.
   *    Forks represent actionable reuse and collaboration interest.
   * 3. Followers Count (20%): Bracketed evaluation of the developer's followers.
   *    Followers reflect the developer's individual reach and reputation in the community.
   * 
   * All brackets are defined in `scoringConfig.js` to ensure ease of tuning.
   * 
   * @param {object} data - Normalized DeveloperAnalysisData model
   * @returns {object} Score, factor breakdown, and actionable improvements
   */
  calculateScore(data) {
    const config = scoringConfig.OPEN_SOURCE_ENGAGEMENT;
    const { aggregateMetrics, profile } = data;

    const totalStars = aggregateMetrics?.totalStars || 0;
    const totalForks = aggregateMetrics?.totalForks || 0;
    const followers = profile?.followers || 0;

    // Handle empty portfolios / zero engagement metrics
    if (totalStars === 0 && totalForks === 0 && followers === 0) {
      return {
        score: 0,
        factors: {
          starsCount: {
            score: 0,
            maxScore: config.FACTOR_WEIGHTS.starsCount,
            description: 'No stars accumulated across repositories.',
          },
          forksCount: {
            score: 0,
            maxScore: config.FACTOR_WEIGHTS.forksCount,
            description: 'No forks accumulated across repositories.',
          },
          followersCount: {
            score: 0,
            maxScore: config.FACTOR_WEIGHTS.followersCount,
            description: 'No followers on GitHub.',
          },
        },
        improvements: [
          'Share your primary projects on developer portals (e.g., Dev.to, Reddit) to build visibility and earn stars.',
          'Create templates, boilerplate setups, or utility libraries that other developers can easily fork and adapt.',
          'Engage with the developer community by contributing to open-source repositories and following active creators.',
        ],
      };
    }

    // --- Factor 1: Stars Bracket Scoring (Max 45 points) ---
    let starsScore = 0;
    const starsBracket = config.STARS_BRACKETS.find(b => totalStars >= b.min);
    if (starsBracket) {
      starsScore = Math.min(starsBracket.points, config.FACTOR_WEIGHTS.starsCount);
    }

    // --- Factor 2: Forks Bracket Scoring (Max 35 points) ---
    let forksScore = 0;
    const forksBracket = config.FORKS_BRACKETS.find(b => totalForks >= b.min);
    if (forksBracket) {
      forksScore = Math.min(forksBracket.points, config.FACTOR_WEIGHTS.forksCount);
    }

    // --- Factor 3: Followers Bracket Scoring (Max 20 points) ---
    let followersScore = 0;
    const followersBracket = config.FOLLOWERS_BRACKETS.find(b => followers >= b.min);
    if (followersBracket) {
      followersScore = Math.min(followersBracket.points, config.FACTOR_WEIGHTS.followersCount);
    }

    // Total Score
    const totalScore = starsScore + forksScore + followersScore;

    // Actionable Improvements
    const improvements = [];
    if (totalStars < 5) {
      improvements.push('Share your primary projects on developer portals (e.g., Dev.to, Reddit) to build visibility and earn stars.');
    }
    if (totalForks < 1) {
      improvements.push('Create templates, boilerplate setups, or utility libraries that other developers can easily fork and adapt.');
    }
    if (followers < 10) {
      improvements.push('Engage with the developer community by contributing to open-source repositories and following active creators.');
    }

    return {
      score: Math.max(0, Math.min(totalScore, config.MAX_SCORE)),
      factors: {
        starsCount: {
          score: starsScore,
          maxScore: config.FACTOR_WEIGHTS.starsCount,
          description: `Accumulated ${totalStars} star(s) across original repositories.`,
        },
        forksCount: {
          score: forksScore,
          maxScore: config.FACTOR_WEIGHTS.forksCount,
          description: `Accumulated ${totalForks} fork(s) across original repositories.`,
        },
        followersCount: {
          score: followersScore,
          maxScore: config.FACTOR_WEIGHTS.followersCount,
          description: `Developer has ${followers} follower(s) on GitHub.`,
        },
      },
      improvements,
    };
  }
}

export default new OpenSourceEngagementService();

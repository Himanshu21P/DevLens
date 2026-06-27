import { scoringConfig } from '../../config/scoringConfig.js';

class RepositoryQualityService {
  /**
   * Calculates the Repository Quality score.
   * 
   * METHODOLOGY:
   * 1. Original vs. Fork Ratio (40%): Evaluates how much of the portfolio is original work.
   *    Forks are penalized by a multiplier (0.3) because they represent external code bases.
   * 2. Size Distribution (30%): Verifies if the portfolio contains substantial code bases.
   *    Looks for a healthy mix of small (>100KB), medium (>2MB), and large (>20MB) original projects.
   * 3. Issue Hygiene (30%): Assesses how well repositories are maintained.
   *    High open issue ratios relative to stars and forks indicate potential maintenance neglect.
   * 
   * @param {object} data - Normalized DeveloperAnalysisData model
   * @returns {object} Score, factor breakdown, and actionable improvements
   */
  calculateScore(data) {
    const config = scoringConfig.REPOSITORY_QUALITY;
    const { repositories } = data;
    const allRepos = repositories.all || [];
    const totalCount = repositories.totalCount || 0;
    const originalCount = repositories.originalCount || 0;
    const forkCount = repositories.forkCount || 0;

    // Handle empty portfolios (0 repositories)
    if (totalCount === 0) {
      return {
        score: 0,
        factors: {
          originalRatio: { score: 0, maxScore: config.FACTOR_WEIGHTS.originalRatio, description: 'No repositories detected.' },
          sizeDistribution: { score: 0, maxScore: config.FACTOR_WEIGHTS.repoSizeDistribution, description: 'No repositories detected.' },
          issueHygiene: { score: 0, maxScore: config.FACTOR_WEIGHTS.issueHygiene, description: 'No repositories detected.' },
        },
        improvements: ['Create original public repositories to showcase your development work.'],
      };
    }

    // --- Factor 1: Original vs. Fork Ratio (Max 40 points) ---
    // Formula: (Original Repos + Fork Repos * Penalty) / Total Repos * Max Points
    const originalWeight = originalCount + (forkCount * config.FORK_PENALTY_MULTIPLIER);
    const originalRatioScore = Math.round((originalWeight / totalCount) * config.FACTOR_WEIGHTS.originalRatio);
    const originalRatioPct = Math.round((originalCount / totalCount) * 100);

    // --- Factor 2: Repository Size Distribution (Max 30 points) ---
    // Evaluates original repositories to see if there are substantial codebases
    const originalRepos = allRepos.filter(r => !r.isFork);
    let sizeScore = 0;
    let hasSmall = false;
    let hasMedium = false;
    let hasLarge = false;

    originalRepos.forEach((repo) => {
      const sizeKB = repo.size || 0;
      if (sizeKB >= config.SIZE_THRESHOLDS.LARGE_KB) {
        hasLarge = true;
        hasMedium = true;
        hasSmall = true;
      } else if (sizeKB >= config.SIZE_THRESHOLDS.MEDIUM_KB) {
        hasMedium = true;
        hasSmall = true;
      } else if (sizeKB >= config.SIZE_THRESHOLDS.SMALL_KB) {
        hasSmall = true;
      }
    });

    if (originalCount > 0) {
      if (hasSmall) sizeScore += 10;
      if (hasMedium) sizeScore += 10;
      if (hasLarge) sizeScore += 10;
      
      // Fallback: If they have original repos but they don't hit brackets (e.g. very small),
      // give a base score of 5 points per repository up to 15 points
      if (sizeScore === 0) {
        sizeScore = Math.min(originalCount * 5, 15);
      }
    }

    // --- Factor 3: Issue Hygiene (Max 30 points) ---
    // Evaluates open issue density. High open issues relative to stars/forks indicates neglect.
    let issueScore = config.FACTOR_WEIGHTS.issueHygiene; // Start at max 30
    let highIssueReposCount = 0;

    if (originalCount > 0) {
      originalRepos.forEach((repo) => {
        const openIssues = repo.openIssues || 0;
        const popularity = (repo.stars || 0) + (repo.forks || 0);
        
        // Only flag repositories that have at least some issues
        if (openIssues > 5) {
          const ratio = openIssues / (popularity + 1);
          if (ratio > config.ISSUE_RATIO_HIGH) {
            highIssueReposCount++;
          }
        }
      });

      // Deduct 10 points per repository with poor issue hygiene, capped at 30 deduction
      const deduction = Math.min(highIssueReposCount * 10, config.FACTOR_WEIGHTS.issueHygiene);
      issueScore -= deduction;
    } else {
      issueScore = 0; // No original repos to evaluate hygiene
    }

    // Final calculations
    const totalScore = originalRatioScore + sizeScore + issueScore;
    
    // Actionable Improvements
    const improvements = [];
    if (forkCount > originalCount) {
      improvements.push('Focus on creating original repositories rather than just forking external projects.');
    }
    if (originalCount > 0 && !hasMedium && !hasLarge) {
      improvements.push('Develop larger, more comprehensive projects (medium/large scale) to demonstrate architecture skills.');
    }
    if (highIssueReposCount > 0) {
      improvements.push('Resolve and close open issues on your repositories to demonstrate active maintenance and code hygiene.');
    }

    return {
      score: Math.max(0, Math.min(totalScore, config.MAX_SCORE)),
      factors: {
        originalRatio: {
          score: originalRatioScore,
          maxScore: config.FACTOR_WEIGHTS.originalRatio,
          description: `${originalCount} original repositories and ${forkCount} forks (${originalRatioPct}% original).`,
        },
        sizeDistribution: {
          score: sizeScore,
          maxScore: config.FACTOR_WEIGHTS.repoSizeDistribution,
          description: `Portfolio contains: ${hasSmall ? 'Small' : 'No'} (>100KB), ${hasMedium ? 'Medium' : 'No'} (>2MB), and ${hasLarge ? 'Large' : 'No'} (>20MB) original codebases.`,
        },
        issueHygiene: {
          score: issueScore,
          maxScore: config.FACTOR_WEIGHTS.issueHygiene,
          description: highIssueReposCount > 0
            ? `${highIssueReposCount} repository/repositories flagged with high open-issue density.`
            : 'Excellent issue hygiene; no repositories flagged with excessive open issues.',
        },
      },
      improvements,
    };
  }
}

export default new RepositoryQualityService();

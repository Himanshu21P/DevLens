import { scoringConfig } from '../../config/scoringConfig.js';

class PortfolioReadinessService {
  /**
   * Calculates the Portfolio Readiness score.
   * 
   * METHODOLOGY:
   * 1. Profile Completeness (30%): Assesses how well the developer has filled out their GitHub
   *    profile. Looks for biography (5 pts), website/blog (10 pts), Twitter/X handle (5 pts),
   *    and configured pinned repositories (10 pts).
   * 2. Profile README (35%): Checks if the developer has a personal profile README
   *    (the special `username/username` repository) containing an introduction or detailed bio.
   * 3. Deployment Coverage (35%): Measures the percentage of original repositories containing
   *    a live homepage/deployment link. Presenting working demos shows development readiness.
   *    (>=50% = 35 pts, >=20% = 20 pts, >=5% = 8 pts).
   * 
   * @param {object} data - Normalized DeveloperAnalysisData model
   * @returns {object} Score, factor breakdown, and actionable improvements
   */
  calculateScore(data) {
    const config = scoringConfig.PORTFOLIO_READINESS;
    const { profile, repositories, aggregateMetrics } = data;
    const allRepos = repositories?.all || [];
    const originalCount = repositories?.originalCount || 0;

    // Handle empty portfolios (0 repositories)
    if (repositories?.totalCount === 0 && !profile?.bio && !profile?.blog && !profile?.twitter) {
      return {
        score: 0,
        factors: {
          profileCompleteness: { score: 0, maxScore: config.FACTOR_WEIGHTS.profileCompleteness, description: 'Profile is completely empty.' },
          profileReadme: { score: 0, maxScore: config.FACTOR_WEIGHTS.profileReadme, description: 'No profile README detected.' },
          deploymentCoverage: { score: 0, maxScore: config.FACTOR_WEIGHTS.deploymentCoverage, description: 'No repositories to deploy.' },
        },
        improvements: [
          'Add a biography, personal website, and Twitter handle to your GitHub profile.',
          'Create a personal profile README (a repository matching your username) to introduce yourself.',
          'Add live deployment links to your project repositories.'
        ],
      };
    }

    // --- Factor 1: Profile Completeness (Max 30 points) ---
    let completenessScore = 0;
    const details = [];

    if (profile?.bio) {
      completenessScore += config.COMPLETENESS_ITEMS.bio;
      details.push('Bio');
    }
    if (profile?.blog || profile?.website) {
      completenessScore += config.COMPLETENESS_ITEMS.website;
      details.push('Website');
    }
    if (profile?.twitter) {
      completenessScore += config.COMPLETENESS_ITEMS.twitter;
      details.push('Twitter');
    }

    // Check for pinned repositories using explicit profile.pinnedRepos or fallback to totalCount > 0
    const hasPinnedRepos = profile?.pinnedRepos !== undefined
      ? !!profile.pinnedRepos
      : (repositories?.totalCount > 0);

    if (hasPinnedRepos) {
      completenessScore += config.COMPLETENESS_ITEMS.pinnedRepos;
      details.push('Pinned Repos');
    }

    // --- Factor 2: Profile README (Max 35 points) ---
    const hasPersonalReadme = !!aggregateMetrics?.hasPersonalReadme;
    const readmeScore = hasPersonalReadme ? config.FACTOR_WEIGHTS.profileReadme : 0;

    // --- Factor 3: Deployment/Homepage Coverage (Max 35 points) ---
    const originalRepos = allRepos.filter(r => !r.isFork);
    // Count repos with a homepage or deployment link. We check for a non-empty string.
    const reposWithDeployment = originalRepos.filter(r => r.homepage && typeof r.homepage === 'string' && r.homepage.trim() !== '').length;
    const deploymentRatio = originalCount > 0 ? (reposWithDeployment / originalCount) : 0;

    let deploymentScore = 0;
    const thresholds = config.DEPLOYMENT_PERCENTAGE_THRESHOLDS;

    if (deploymentRatio >= thresholds.HIGH) {
      deploymentScore = 35;
    } else if (deploymentRatio >= thresholds.MEDIUM) {
      deploymentScore = 20;
    } else if (deploymentRatio >= thresholds.LOW) {
      deploymentScore = 8;
    }

    // Total Score
    const totalScore = completenessScore + readmeScore + deploymentScore;

    // Actionable Improvements
    const improvements = [];
    if (!profile?.bio) {
      improvements.push('Add a brief biography to your GitHub profile to introduce yourself to visitors.');
    }
    if (!profile?.blog && !profile?.website) {
      improvements.push('Link your personal portfolio website or blog on your GitHub profile.');
    }
    if (!profile?.twitter) {
      improvements.push('Link your professional Twitter/X or social media handle to your profile.');
    }
    if (!hasPinnedRepos) {
      improvements.push('Configure pinned repositories on your GitHub profile to showcase your best projects.');
    }
    if (!hasPersonalReadme) {
      improvements.push('Create a special repository matching your GitHub username and add a README.md to build a custom profile page.');
    }
    if (deploymentRatio < thresholds.HIGH && originalCount > 0) {
      improvements.push('Add live deployment or demo links (in the "Homepage" field) to more of your original projects.');
    }

    return {
      score: Math.max(0, Math.min(totalScore, config.MAX_SCORE)),
      factors: {
        profileCompleteness: {
          score: completenessScore,
          maxScore: config.FACTOR_WEIGHTS.profileCompleteness,
          description: details.length > 0
            ? `Completed profile items: ${details.join(', ')} (${completenessScore}/${config.FACTOR_WEIGHTS.profileCompleteness} points).`
            : 'No profile details completed.',
        },
        profileReadme: {
          score: readmeScore,
          maxScore: config.FACTOR_WEIGHTS.profileReadme,
          description: hasPersonalReadme
            ? 'Detected custom profile README repository.'
            : 'No custom profile README repository detected.',
        },
        deploymentCoverage: {
          score: deploymentScore,
          maxScore: config.FACTOR_WEIGHTS.deploymentCoverage,
          description: originalCount > 0
            ? `${reposWithDeployment} out of ${originalCount} original repositories (${Math.round(deploymentRatio * 100)}%) have a live deployment link.`
            : 'No original repositories to evaluate.',
        },
      },
      improvements,
    };
  }
}

export default new PortfolioReadinessService();

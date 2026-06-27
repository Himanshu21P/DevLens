/**
 * Centralized Scoring Configuration.
 * Houses all mathematical weights, thresholds, and point values for the DevLens scoring engine.
 * Allows tuning the scoring algorithms without modifying the service logic.
 */
export const scoringConfig = {
  // Version of the scoring algorithm
  VERSION: '1.0.0',

  // Overall Developer Score Category Weights (Must sum to 1.0)
  CATEGORY_WEIGHTS: {
    repositoryQuality: 0.20,      // 20%
    documentationQuality: 0.20,   // 20%
    projectActivity: 0.20,        // 20%
    technologyDiversity: 0.15,    // 15%
    openSourceEngagement: 0.15,   // 15%
    portfolioReadiness: 0.10,     // 10%
  },

  // 1. Repository Quality Thresholds
  REPOSITORY_QUALITY: {
    MAX_SCORE: 100,
    FACTOR_WEIGHTS: {
      originalRatio: 40,      // Max 40 points for original work vs forks
      repoSizeDistribution: 30, // Max 30 points for code size volume
      issueHygiene: 30,       // Max 30 points for issue management
    },
    FORK_PENALTY_MULTIPLIER: 0.3, // Forks are weighted at 30% of original repos
    SIZE_THRESHOLDS: {
      SMALL_KB: 100,           // >100KB original repo size
      MEDIUM_KB: 2000,         // >2MB original repo size
      LARGE_KB: 20000,         // >20MB original repo size
    },
    ISSUE_RATIO_HIGH: 0.2,    // Open issues > 20% of stars/forks count is flagged
  },

  // 2. Documentation Quality Thresholds
  DOCUMENTATION_QUALITY: {
    MAX_SCORE: 100,
    FACTOR_WEIGHTS: {
      readmePresence: 40,     // Max 40 points for README existence
      readmeLength: 30,       // Max 30 points for README depth/completeness
      licensePresence: 15,    // Max 15 points for LICENSE
      communityStandards: 15, // Max 15 points for CONTRIBUTING and CoC
    },
    README_LENGTH_LIMITS: {
      SHORT: 500,             // >500 chars (10 points)
      MEDIUM: 2000,           // >2000 chars (20 points)
      LONG: 6000,             // >6000 chars (30 points)
    },
  },

  // 3. Technology Diversity Thresholds
  TECHNOLOGY_DIVERSITY: {
    MAX_SCORE: 100,
    FACTOR_WEIGHTS: {
      languageCount: 50,      // Max 50 points for programming languages count
      ecosystemDiversity: 50, // Max 50 points for configuration ecosystem files
    },
    LANGUAGE_COUNT_SCALING: {
      1: 30,                  // 1 language = 30 points
      2: 42,                  // 2 languages = 42 points
      3: 48,                  // 3 languages = 48 points
      4: 50,                  // 4+ languages = 50 points
    },
    ECOSYSTEM_POINTS: {
      packageJson: 15,        // Node.js/JavaScript
      requirementsTxt: 15,    // Python
      cargoToml: 15,          // Rust
      goMod: 15,              // Go
      gemfile: 10,            // Ruby
    },
    MAX_ECOSYSTEM_POINTS: 50, // Capped at 50
  },

  // 4. Project Activity Thresholds
  PROJECT_ACTIVITY: {
    MAX_SCORE: 100,
    FACTOR_WEIGHTS: {
      pushRecency: 50,        // Max 50 points for average push recency
      commitFrequency: 50,    // Max 50 points for commit volumes
    },
    PUSH_RECENCY_SCORES: {
      7: 50,                  // Push in last 7 days = 50 points
      30: 40,                 // Push in last 30 days = 40 points
      90: 30,                 // Push in last 90 days = 30 points
      180: 15,                // Push in last 180 days = 15 points
    },
    COMMIT_FREQUENCY_LIMITS: {
      HIGH: 100,              // >100 commits past year = 50 points
      MEDIUM: 25,             // >25 commits past year = 35 points
      LOW: 5,                 // >5 commits past year = 15 points
    },
  },

  // 5. Open Source Engagement Thresholds
  OPEN_SOURCE_ENGAGEMENT: {
    MAX_SCORE: 100,
    FACTOR_WEIGHTS: {
      starsCount: 45,         // Max 45 points for stars
      forksCount: 35,         // Max 35 points for forks
      followersCount: 20,     // Max 20 points for followers
    },
    // Logarithmic or bracketed scaling thresholds
    STARS_BRACKETS: [
      { min: 100, points: 45 },
      { min: 20, points: 38 },
      { min: 5, points: 28 },
      { min: 1, points: 15 },
      { min: 0, points: 5 },
    ],
    FORKS_BRACKETS: [
      { min: 20, points: 35 },
      { min: 5, points: 30 },
      { min: 1, points: 20 },
      { min: 0, points: 5 },
    ],
    FOLLOWERS_BRACKETS: [
      { min: 50, points: 20 },
      { min: 10, points: 16 },
      { min: 2, points: 10 },
      { min: 0, points: 2 },
    ],
  },

  // 6. Portfolio Readiness Thresholds
  PORTFOLIO_READINESS: {
    MAX_SCORE: 100,
    FACTOR_WEIGHTS: {
      profileCompleteness: 30, // Max 30 points for bio, website, twitter, pinned repos
      profileReadme: 35,       // Max 35 points for personal profile readme repo
      deploymentCoverage: 35,  // Max 35 points for repository deployment links
    },
    COMPLETENESS_ITEMS: {
      bio: 5,                  // Biography present
      website: 10,             // Personal website/blog present
      twitter: 5,              // Twitter/X handle present
      pinnedRepos: 10,         // Pinned repositories configured
    },
    DEPLOYMENT_PERCENTAGE_THRESHOLDS: {
      HIGH: 0.50,              // >50% original repos have deployment link = 35 points
      MEDIUM: 0.20,            // >20% original repos have deployment link = 20 points
      LOW: 0.05,               // >5% original repos have deployment link = 8 points
    },
  },
};

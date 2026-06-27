import { jest } from '@jest/globals';
import scoringEngine from '../src/services/scoring/scoringEngine.js';
import repositoryQualityService from '../src/services/scoring/repositoryQualityService.js';
import documentationQualityService from '../src/services/scoring/documentationQualityService.js';
import technologyDiversityService from '../src/services/scoring/technologyDiversityService.js';
import projectActivityService from '../src/services/scoring/projectActivityService.js';
import openSourceEngagementService from '../src/services/scoring/openSourceEngagementService.js';
import portfolioReadinessService from '../src/services/scoring/portfolioReadinessService.js';

describe('Developer Analytics Scoring Engine', () => {
  
  // 1. Edge Case: Empty Profiles (No repositories, empty bio/blog/etc.)
  describe('Edge Case: Empty Profiles', () => {
    const emptyProfileData = {
      profile: {
        provider: 'github',
        username: 'empty-dev',
        displayName: null,
        avatarUrl: null,
        bio: null,
        publicRepos: 0,
        followers: 0,
        following: 0,
        company: null,
        location: null,
        blog: null,
        twitter: null,
      },
      repositories: {
        all: [],
        totalCount: 0,
        publicCount: 0,
        privateCount: 0,
        archivedCount: 0,
        forkCount: 0,
        originalCount: 0,
      },
      topRepositories: [],
      aggregateMetrics: {
        totalStars: 0,
        totalForks: 0,
        totalSizeKB: 0,
        languagesPercentage: {},
        languagesBytes: {},
        totalCommitsPastYear: 0,
        recentActivityPushCount: 0,
        hasPersonalReadme: false,
        privateReposCount: 0,
        privateCommitsCount: 0,
      },
      scoringVersion: '1.0.0',
    };

    it('should return 0 for all scoring categories and overall score', () => {
      const result = scoringEngine.calculateDeveloperScore(emptyProfileData);
      
      expect(result.overallScore).toBe(0);
      expect(result.confidenceScore).toBe(10); // 10% representativeness for empty portfolio
      expect(result.categories.repositoryQuality.score).toBe(0);
      expect(result.categories.documentationQuality.score).toBe(0);
      expect(result.categories.technologyDiversity.score).toBe(0);
      expect(result.categories.projectActivity.score).toBe(0);
      expect(result.categories.openSourceEngagement.score).toBe(0);
      expect(result.categories.portfolioReadiness.score).toBe(0);
    });
  });

  // 2. Edge Case: Repositories with No Commits
  describe('Edge Case: Repositories with No Commits', () => {
    const noCommitsData = {
      profile: {
        provider: 'github',
        username: 'no-commits-dev',
        followers: 0,
      },
      repositories: {
        all: [
          { id: '1', name: 'repo1', isFork: false, size: 500, stars: 0, forks: 0, openIssues: 0, pushedAt: new Date().toISOString() }
        ],
        totalCount: 1,
        originalCount: 1,
        forkCount: 0,
      },
      topRepositories: [
        {
          id: '1',
          name: 'repo1',
          isFork: false,
          size: 500,
          stars: 0,
          forks: 0,
          openIssues: 0,
          pushedAt: new Date().toISOString(),
          commitActivity: { totalCommits: 0, weeklyCommits: new Array(52).fill(0) },
        }
      ],
      aggregateMetrics: {
        totalStars: 0,
        totalForks: 0,
        totalSizeKB: 500,
        languagesPercentage: { JavaScript: 100 },
        totalCommitsPastYear: 0,
        privateCommitsCount: 0,
        recentActivityPushCount: 1,
      },
    };

    it('should calculate 0 for commit frequency but give points for push recency', () => {
      const result = projectActivityService.calculateScore(noCommitsData);
      
      // Push recency score is 50 (since push was today, within last 7 days)
      // Commit frequency score is 0 (since total commits is 0, which is < 5)
      expect(result.factors.pushRecency.score).toBe(50);
      expect(result.factors.commitFrequency.score).toBe(0);
      expect(result.score).toBe(50);
      expect(result.improvements).toContain('Make your first commit in your repositories to demonstrate active coding.');
    });
  });

  // 3. Edge Case: Documentation-Only Repositories
  describe('Edge Case: Documentation-Only Repositories', () => {
    const docOnlyData = {
      profile: {
        provider: 'github',
        username: 'doc-dev',
        followers: 10, // 16 pts
      },
      repositories: {
        all: [
          { id: '1', name: 'docs-repo', isFork: false, size: 10, stars: 0, forks: 0, openIssues: 0, pushedAt: new Date().toISOString() }
        ],
        totalCount: 1,
        originalCount: 1,
        forkCount: 0,
      },
      topRepositories: [
        {
          id: '1',
          name: 'docs-repo',
          isFork: false,
          size: 10,
          stars: 0,
          forks: 0,
          openIssues: 0,
          pushedAt: new Date().toISOString(),
          documentation: {
            readme: { exists: true, size: 8000 }, // Long README (>6000 chars = 30 pts)
            license: { exists: true, name: 'MIT' }, // LICENSE present = 15 pts
            contributing: { exists: true }, // CONTRIBUTING present = 8 pts
            codeOfConduct: { exists: true }, // CoC present = 7 pts
          },
          ecosystem: { configFiles: [], frameworksDetected: [] },
        }
      ],
      aggregateMetrics: {
        totalStars: 0,
        totalForks: 0,
        totalSizeKB: 10,
        languagesPercentage: {},
        totalCommitsPastYear: 10,
        recentActivityPushCount: 1,
        hasPersonalReadme: true,
      },
    };

    it('should award high documentation score but lower size distribution and technology diversity scores', () => {
      const docResult = documentationQualityService.calculateScore(docOnlyData);
      const repoResult = repositoryQualityService.calculateScore(docOnlyData);
      const techResult = technologyDiversityService.calculateScore(docOnlyData);

      // Documentation Quality: README presence = 40, README length = 30, LICENSE = 15, Community = 15. Total = 100.
      expect(docResult.score).toBe(100);
      expect(docResult.factors.readmePresence.score).toBe(40);
      expect(docResult.factors.readmeLength.score).toBe(30);
      expect(docResult.factors.licensePresence.score).toBe(15);
      expect(docResult.factors.communityStandards.score).toBe(15);

      // Repository Quality: size is 10KB, which is less than SMALL_KB (100KB).
      // Fallback: 1 original repo * 5 points = 5 points.
      expect(repoResult.factors.sizeDistribution.score).toBe(5);

      // Tech Diversity: 0 distinct languages, 0 ecosystem files = 0 points.
      expect(techResult.score).toBe(0);
    });
  });

  // 4. Edge Case: Mixed Public/Private Portfolios
  describe('Edge Case: Mixed Public/Private Portfolios', () => {
    const mixedData = {
      profile: {
        provider: 'github',
        username: 'mixed-dev',
        bio: 'Hello World',
        blog: 'https://mixed-dev.com',
      },
      repositories: {
        all: [
          { id: '1', name: 'public-repo', isFork: false, isPrivate: false, size: 500, stars: 10, forks: 2, openIssues: 0, pushedAt: new Date().toISOString() },
          { id: '2', name: '[private-repository]', fullName: 'private/2', isFork: false, isPrivate: true, size: 12000, stars: 0, forks: 0, openIssues: 0, pushedAt: new Date().toISOString() },
        ],
        totalCount: 2,
        originalCount: 2,
        forkCount: 0,
        publicCount: 1,
        privateCount: 1,
      },
      topRepositories: [
        {
          id: '1',
          name: 'public-repo',
          isFork: false,
          isPrivate: false,
          size: 500,
          stars: 10,
          forks: 2,
          openIssues: 0,
          pushedAt: new Date().toISOString(),
          documentation: { readme: { exists: true, size: 3000 }, license: { exists: true } },
          ecosystem: { configFiles: ['package.json'], frameworksDetected: ['React'] },
        },
        {
          id: '2',
          name: '[private-repository]',
          fullName: 'private/2',
          isFork: false,
          isPrivate: true,
          size: 12000,
          stars: 0,
          forks: 0,
          openIssues: 0,
          pushedAt: new Date().toISOString(),
          documentation: { readme: { exists: true, size: 1500 }, license: { exists: false } },
          ecosystem: { configFiles: ['Cargo.toml'], frameworksDetected: [] },
          commitActivity: { totalCommits: 45 },
        }
      ],
      aggregateMetrics: {
        totalStars: 10,
        totalForks: 2,
        totalSizeKB: 12500,
        languagesPercentage: { JavaScript: 40, Rust: 60 },
        totalCommitsPastYear: 15,
        privateReposCount: 1,
        privateCommitsCount: 45, // Private commits must be counted
        recentActivityPushCount: 2,
        hasPersonalReadme: false,
      },
    };

    it('should correctly accumulate public and private metrics for scoring', () => {
      const engineResult = scoringEngine.calculateDeveloperScore(mixedData);
      
      // 1. Overall Score is computed successfully
      expect(engineResult.overallScore).toBeGreaterThan(0);
      
      // 2. Commit Frequency aggregates public (15) + private (45) = 60 commits (MEDIUM bracket = 35 points)
      expect(engineResult.categories.projectActivity.factors.commitFrequency.score).toBe(35);

      // 3. Technology Diversity aggregates both public and private ecosystem files (package.json + Cargo.toml = 15 + 15 = 30 pts)
      expect(engineResult.categories.technologyDiversity.factors.ecosystemDiversity.score).toBe(30);

      // 4. Verification that private details remain sanitized in rawMetrics output
      expect(engineResult.rawMetrics.repositories.privateCount).toBe(1);
      expect(engineResult.rawMetrics.activity.privateCommitsPastYear).toBe(45);
    });
  });

  // 5. Edge Case: Duplicate Data Resiliency
  describe('Edge Case: Duplicate Data Resiliency', () => {
    const duplicateData = {
      profile: {
        provider: 'github',
        username: 'dup-dev',
      },
      repositories: {
        all: [
          { id: '1', name: 'repo1', isFork: false, size: 1000, stars: 5, forks: 1, openIssues: 0, pushedAt: new Date().toISOString() },
          { id: '1', name: 'repo1', isFork: false, size: 1000, stars: 5, forks: 1, openIssues: 0, pushedAt: new Date().toISOString() }, // duplicate
        ],
        totalCount: 2,
        originalCount: 2,
        forkCount: 0,
      },
      topRepositories: [
        {
          id: '1',
          name: 'repo1',
          isFork: false,
          size: 1000,
          stars: 5,
          forks: 1,
          openIssues: 0,
          pushedAt: new Date().toISOString(),
          documentation: { readme: { exists: true, size: 1500 } },
          ecosystem: { configFiles: ['package.json', 'package.json'], frameworksDetected: ['React', 'React'] }, // duplicate entries
        }
      ],
      aggregateMetrics: {
        totalStars: 10, // summed duplicates
        totalForks: 2,
        totalSizeKB: 2000,
        languagesPercentage: { JS: 100, JS: 100 },
        totalCommitsPastYear: 10,
        recentActivityPushCount: 2,
      },
    };

    it('should handle duplicates without crashing and maintain clamped scores', () => {
      const result = scoringEngine.calculateDeveloperScore(duplicateData);
      
      expect(result.overallScore).toBeDefined();
      expect(result.categories.technologyDiversity.score).toBeLessThanOrEqual(100);
      expect(result.categories.technologyDiversity.factors.ecosystemDiversity.score).toBe(15); // package.json duplicate only counted once since it uses a Set in service
    });
  });

  // 6. Edge Case: Very Large Portfolios
  describe('Edge Case: Very Large Portfolios', () => {
    const massiveData = {
      profile: {
        provider: 'github',
        username: 'linus-torvalds',
        bio: 'Creator of Git and Linux',
        blog: 'https://kernel.org',
        twitter: 'torvalds',
        followers: 180000, // follower score = 20
        pinnedRepos: true,
      },
      repositories: {
        all: new Array(60).fill(null).map((_, i) => ({
          id: String(i),
          name: `project-${i}`,
          isFork: false,
          size: 50000, // 50MB each
          stars: 500,
          forks: 150,
          openIssues: 2,
          homepage: 'https://kernel.org',
          pushedAt: new Date().toISOString(),
        })),
        totalCount: 60,
        originalCount: 60,
        forkCount: 0,
      },
      topRepositories: new Array(5).fill(null).map((_, i) => ({
        id: String(i),
        name: `project-${i}`,
        isFork: false,
        size: 50000,
        stars: 500,
        forks: 150,
        openIssues: 2,
        homepage: 'https://kernel.org',
        pushedAt: new Date().toISOString(),
        documentation: {
          readme: { exists: true, size: 12000 },
          license: { exists: true, name: 'GPL-2.0' },
          contributing: { exists: true },
          codeOfConduct: { exists: true },
        },
        ecosystem: {
          configFiles: ['package.json', 'Cargo.toml', 'go.mod', 'requirements.txt', 'Gemfile'], // all 5 configurations
          frameworksDetected: ['React', 'Express'],
        },
        commitActivity: { totalCommits: 500 },
      })),
      aggregateMetrics: {
        totalStars: 30000,
        totalForks: 9000,
        totalSizeKB: 3000000,
        languagesPercentage: { C: 40, Rust: 30, Go: 20, Python: 10 },
        totalCommitsPastYear: 2500,
        privateCommitsCount: 0,
        recentActivityPushCount: 60,
        hasPersonalReadme: true,
      },
    };

    it('should clamp all category and overall scores strictly to 100', () => {
      const result = scoringEngine.calculateDeveloperScore(massiveData);
      
      expect(result.overallScore).toBe(100);
      expect(result.confidenceScore).toBe(100); // 100% confidence
      
      Object.keys(result.categories).forEach((categoryKey) => {
        const cat = result.categories[categoryKey];
        expect(cat.score).toBeLessThanOrEqual(100);
        expect(cat.score).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // 7. Math and Weighting Integrity Checks
  describe('Math and Weighting Integrity Checks', () => {
    it('should ensure category weights sum to exactly 1.0', () => {
      const result = scoringEngine.calculateDeveloperScore({
        profile: { username: 'test' },
        repositories: { totalCount: 0 },
        topRepositories: [],
        aggregateMetrics: {},
      });
      
      const categoryKeys = Object.keys(result.categories);
      let totalWeight = 0;
      categoryKeys.forEach((key) => {
        totalWeight += result.categories[key].weight;
      });

      // Asserting floating point summation precision
      expect(Math.round(totalWeight * 100) / 100).toBe(1.0);
    });
  });
});

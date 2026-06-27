import { jest } from '@jest/globals';
import BaseRepositoryAdapter from '../src/adapters/repositoryAdapter.js';

// Setup Mock Environment
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock Redis configuration and cache helpers
const mockCacheStore = new Map();
jest.unstable_mockModule('../src/config/redis.js', () => ({
  default: null,
  isRedisConnected: true,
  getCache: jest.fn().mockImplementation(async (key) => mockCacheStore.get(key) || null),
  setCache: jest.fn().mockImplementation(async (key, val) => {
    mockCacheStore.set(key, val);
    return true;
  }),
  deleteCache: jest.fn().mockImplementation(async (key) => {
    mockCacheStore.delete(key);
    return true;
  }),
}));

// Mock variables to control the smart mock request results
let mockProfileResponse = null;
let mockReposResponse = null;
const mockLanguagesResponses = {};
const mockCommitsResponses = {};
const mockFileExistResponses = {};
const mockFileContentResponses = {};

// Mock GitHub API Client with a smart mock router
jest.unstable_mockModule('../src/services/githubClient.js', () => ({
  default: {
    request: jest.fn().mockImplementation(async (path, token) => {
      // 1. Profile Request
      if (path.startsWith('/users/') && !path.includes('/repos')) {
        const username = path.split('/').pop();
        if (mockProfileResponse instanceof Error) throw mockProfileResponse;
        if (mockProfileResponse) return mockProfileResponse;
        return { id: 12345, login: username };
      }

      // 2. Repositories Request
      if (path.startsWith('/users/') && path.includes('/repos')) {
        if (mockReposResponse instanceof Error) throw mockReposResponse;
        if (mockReposResponse) return mockReposResponse;
        return [];
      }

      // 3. Languages Request
      if (path.startsWith('/repos/') && path.includes('/languages')) {
        const parts = path.split('/');
        const repoFullName = `${parts[2]}/${parts[3]}`;
        const res = mockLanguagesResponses[repoFullName];
        if (res instanceof Error) throw res;
        return res || {};
      }

      // 4. Commits Request
      if (path.startsWith('/repos/') && path.includes('/commits')) {
        const parts = path.split('/');
        const repoFullName = `${parts[2]}/${parts[3]}`;
        const res = mockCommitsResponses[repoFullName];
        if (res instanceof Error) throw res;
        return res || [];
      }

      // 5. Contents / Files Requests
      if (path.startsWith('/repos/') && path.includes('/contents/')) {
        const parts = path.split('/');
        const repoFullName = `${parts[2]}/${parts[3]}`;
        const filePath = path.substring(path.indexOf('/contents/') + 10);
        const key = `${repoFullName}:${filePath}`;

        // Check if there is a mocked file content (getFileContent)
        const contentRes = mockFileContentResponses[key];
        if (contentRes !== undefined) {
          if (contentRes instanceof Error) throw contentRes;
          if (contentRes === null) {
            const err = new Error('Not Found');
            err.statusCode = 404;
            throw err;
          }
          return {
            name: filePath.split('/').pop(),
            content: Buffer.from(contentRes).toString('base64'),
            encoding: 'base64',
          };
        }

        // Check if there is a mocked file existence (checkFileExists)
        const existRes = mockFileExistResponses[key];
        if (existRes !== undefined) {
          if (existRes instanceof Error) throw existRes;
          if (existRes === null) {
            const err = new Error('Not Found');
            err.statusCode = 404;
            throw err;
          }
          return existRes;
        }

        // Default: File Not Found
        const err = new Error('Not Found');
        err.statusCode = 404;
        throw err;
      }

      return null;
    }),
    getUserEmails: jest.fn(),
  },
}));

const { default: redis } = await import('../src/config/redis.js');
const { default: githubClient } = await import('../src/services/githubClient.js');
const { default: githubAdapter } = await import('../src/adapters/githubAdapter.js');
const { default: portfolioDataCollector } = await import('../src/services/portfolioDataCollector.js');

describe('Repository Adapter & Data Collector Layer (Module 3.1)', () => {
  const mockRawProfile = {
    id: 99911,
    login: 'testdev',
    name: 'Test Developer',
    avatar_url: 'https://avatars.com/u/99911',
    bio: 'Open source enthusiast',
    public_repos: 3,
    followers: 15,
    following: 5,
    company: 'Dev Corp',
    location: 'Denver',
    blog: 'https://testdev.com',
    twitter_username: 'testdev_x',
  };

  const mockRawRepos = [
    {
      id: 101,
      name: 'awesome-project',
      full_name: 'testdev/awesome-project',
      private: false,
      fork: false,
      archived: false,
      stargazers_count: 25,
      forks_count: 5,
      open_issues_count: 2,
      size: 1500,
      language: 'JavaScript',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2026-06-01T00:00:00Z',
      pushed_at: '2026-06-25T00:00:00Z',
      default_branch: 'main',
      html_url: 'https://github.com/testdev/awesome-project',
    },
    {
      id: 102,
      name: 'forked-repo',
      full_name: 'testdev/forked-repo',
      private: false,
      fork: true,
      archived: false,
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      size: 500,
      language: 'Python',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-05-01T00:00:00Z',
      pushed_at: '2024-05-01T00:00:00Z',
      default_branch: 'master',
      html_url: 'https://github.com/testdev/forked-repo',
    },
    {
      id: 103,
      name: 'my-private-startup',
      full_name: 'testdev/my-private-startup',
      private: true,
      fork: false,
      archived: false,
      stargazers_count: 2,
      forks_count: 1,
      open_issues_count: 4,
      size: 12000,
      language: 'Rust',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-06-20T00:00:00Z',
      pushed_at: '2026-06-26T00:00:00Z',
      default_branch: 'main',
      html_url: 'https://github.com/testdev/my-private-startup',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheStore.clear();

    // Reset all mock responses
    mockProfileResponse = null;
    mockReposResponse = null;
    Object.keys(mockLanguagesResponses).forEach(k => delete mockLanguagesResponses[k]);
    Object.keys(mockCommitsResponses).forEach(k => delete mockCommitsResponses[k]);
    Object.keys(mockFileExistResponses).forEach(k => delete mockFileExistResponses[k]);
    Object.keys(mockFileContentResponses).forEach(k => delete mockFileContentResponses[k]);
  });

  describe('1. Adapter Interface & Compliance', () => {
    it('should extend BaseRepositoryAdapter and implement required methods', () => {
      expect(githubAdapter).toBeInstanceOf(BaseRepositoryAdapter);
      expect(githubAdapter.getUserProfile).toBeDefined();
      expect(githubAdapter.getUserRepositories).toBeDefined();
      expect(githubAdapter.getRepositoryLanguages).toBeDefined();
      expect(githubAdapter.getRepositoryCommitActivity).toBeDefined();
      expect(githubAdapter.checkFileExists).toBeDefined();
      expect(githubAdapter.getFileContent).toBeDefined();
    });
  });

  describe('2. Redis Caching & Performance Verification', () => {
    it('should complete cache-miss followed by cache-hit cycle, showing metadata and performance gains', async () => {
      mockProfileResponse = mockRawProfile;

      // --- First Call: Cache Miss ---
      const startTimeMiss = Date.now();
      const missRes = await githubAdapter.getUserProfile('testdev');
      const endTimeMiss = Date.now();
      const missDuration = endTimeMiss - startTimeMiss;

      expect(missRes.data.username).toBe('testdev');
      expect(missRes._cacheMetadata.cached).toBe(false);
      expect(missRes._cacheMetadata.provider).toBe('github');
      expect(githubClient.request).toHaveBeenCalledTimes(1);

      // Verify it was written to Redis
      expect(mockCacheStore.has('github:profile:testdev')).toBe(true);

      // --- Second Call: Cache Hit ---
      const startTimeHit = Date.now();
      const hitRes = await githubAdapter.getUserProfile('testdev');
      const endTimeHit = Date.now();
      const hitDuration = endTimeHit - startTimeHit;

      expect(hitRes.data.username).toBe('testdev');
      expect(hitRes._cacheMetadata.cached).toBe(true);
      expect(hitRes._cacheMetadata.cachedAt).toBeDefined();
      expect(hitRes._cacheMetadata.expiresAt).toBeDefined();
      
      // Ensure the second call did not contact the GitHub API Client
      expect(githubClient.request).toHaveBeenCalledTimes(1);

      // Measurable performance verification
      console.log(`Performance Audit: Cache Miss took ${missDuration}ms. Cache Hit took ${hitDuration}ms.`);
      expect(hitDuration).toBeLessThanOrEqual(missDuration);
    });

    it('should degrade gracefully and execute direct fetch if Redis cache errors out', async () => {
      const { getCache: mockGetCache } = await import('../src/config/redis.js');
      mockGetCache.mockRejectedValueOnce(new Error('Redis Connection Lost'));
      mockProfileResponse = mockRawProfile;

      const res = await githubAdapter.getUserProfile('testdev');

      expect(res.data.username).toBe('testdev');
      expect(res._cacheMetadata.cached).toBe(false); // Bypassed cache gracefully
      expect(githubClient.request).toHaveBeenCalled();
    });

    it('should handle corrupted Redis cache entries gracefully by fetching fresh data', async () => {
      mockCacheStore.set('github:profile:testdev', 'corrupted_string_not_json_envelope');
      mockProfileResponse = mockRawProfile;

      const res = await githubAdapter.getUserProfile('testdev');

      expect(res.data.username).toBe('testdev');
      expect(res._cacheMetadata.cached).toBe(false); // Degraded to fetch
      expect(githubClient.request).toHaveBeenCalled();
    });
  });

  describe('3. Strict Private Repository Sanitization', () => {
    it('should sanitize private repositories at the adapter boundary, stripping sensitive details', async () => {
      mockReposResponse = mockRawRepos;

      const res = await githubAdapter.getUserRepositories('testdev', 'valid_token');
      const repos = res.data;

      // Original public repo is normal
      const publicRepo = repos.find(r => r.id === '101');
      expect(publicRepo.name).toBe('awesome-project');
      expect(publicRepo.htmlUrl).toBe('https://github.com/testdev/awesome-project');

      // Private repo has sensitive details scrubbed (like git/clone URLs) but retains names internally for API queries
      const privateRepo = repos.find(r => r.id === '103');
      expect(privateRepo.isPrivate).toBe(true);
      expect(privateRepo.gitUrl).toBeUndefined();
      expect(privateRepo.sshUrl).toBeUndefined();
      expect(privateRepo.cloneUrl).toBeUndefined();
      
      // Real names are present to allow subsequent API aggregation
      expect(privateRepo.name).toBe('my-private-startup');
      expect(privateRepo.fullName).toBe('testdev/my-private-startup');
    });
  });

  describe('4. Data Collector Normalization, Aggregation & Sanitization', () => {
    it('should compile standardized DeveloperAnalysisData with aggregates, ecosystems, and private scrubbing', async () => {
      mockProfileResponse = mockRawProfile;
      mockReposResponse = mockRawRepos;

      // Mock sub-queries for awesome-project (101)
      mockLanguagesResponses['testdev/awesome-project'] = { JavaScript: 50000, HTML: 2000 };
      mockCommitsResponses['testdev/awesome-project'] = [
        { commit: { author: { date: new Date().toISOString() } } }
      ];
      mockFileExistResponses['testdev/awesome-project:README.md'] = { name: 'README.md', size: 1200 };
      mockFileExistResponses['testdev/awesome-project:LICENSE'] = { name: 'LICENSE', size: 500 };
      mockFileContentResponses['testdev/awesome-project:package.json'] = JSON.stringify({
        dependencies: { react: '^18.2.0', express: '^4.18.0' }
      });

      // Mock sub-queries for my-private-startup (103)
      mockLanguagesResponses['testdev/my-private-startup'] = { Rust: 120000 };
      mockCommitsResponses['testdev/my-private-startup'] = [
        { commit: { author: { date: new Date().toISOString() } } },
        { commit: { author: { date: new Date().toISOString() } } }
      ];
      mockFileExistResponses['testdev/my-private-startup:README.md'] = { name: 'README.md', size: 800 };
      mockFileExistResponses['testdev/my-private-startup:Cargo.toml'] = { name: 'Cargo.toml', size: 300 };

      // Profile README check
      mockFileExistResponses['testdev/testdev:README.md'] = { name: 'README.md', size: 1000 };

      // Trigger Portfolio Data Collector
      const analysisData = await portfolioDataCollector.collectPortfolioData('testdev', 'valid_token');

      // --- Verify Model Structures ---
      expect(analysisData.scoringVersion).toBe('1.0.0');
      expect(analysisData.profile.username).toBe('testdev');
      
      // Verify aggregate counts
      expect(analysisData.repositories.totalCount).toBe(3);
      expect(analysisData.repositories.publicCount).toBe(2);
      expect(analysisData.repositories.privateCount).toBe(1);
      expect(analysisData.repositories.originalCount).toBe(2);
      expect(analysisData.repositories.forkCount).toBe(1);

      // Verify Top Repos detailed aggregation
      expect(analysisData.topRepositories).toHaveLength(2);
      
      const topPublic = analysisData.topRepositories.find(r => r.id === '101');
      expect(topPublic.name).toBe('awesome-project');
      expect(topPublic.languages).toHaveProperty('JavaScript', 50000);
      expect(topPublic.commitActivity.totalCommits).toBe(1);
      expect(topPublic.documentation.readme.exists).toBe(true);
      expect(topPublic.documentation.readme.size).toBe(1200);
      expect(topPublic.documentation.license.exists).toBe(true);
      expect(topPublic.documentation.contributing.exists).toBe(false);
      
      // Verify framework ecosystem detection
      expect(topPublic.ecosystem.frameworksDetected).toContain('React');
      expect(topPublic.ecosystem.frameworksDetected).toContain('Express');
      expect(topPublic.ecosystem.configFiles).toContain('package.json');

      const topPrivate = analysisData.topRepositories.find(r => r.id === '103');
      // Verify strict security sanitization inside the final analysis model
      expect(topPrivate.name).toBe('[private-repository]');
      expect(topPrivate.fullName).toBe('private/103');
      expect(topPrivate.description).toBeNull();
      expect(topPrivate.htmlUrl).toBeNull();
      expect(topPrivate.languages).toHaveProperty('Rust', 120000);
      expect(topPrivate.commitActivity.totalCommits).toBe(2);
      expect(topPrivate.ecosystem.configFiles).toContain('Cargo.toml');

      // Verify aggregate metrics
      expect(analysisData.aggregateMetrics.totalStars).toBe(27);
      expect(analysisData.aggregateMetrics.totalSizeKB).toBe(13500);
      expect(analysisData.aggregateMetrics.hasPersonalReadme).toBe(true);
      expect(analysisData.aggregateMetrics.privateReposCount).toBe(1);
      expect(analysisData.aggregateMetrics.privateCommitsCount).toBe(2);
      
      // Languages percentage weight calculation: JavaScript (50k), HTML (2k), Rust (120k) => Total = 172k
      // Rust % = 120 / 172 ~ 70%. JavaScript % = 50 / 172 ~ 29%.
      expect(analysisData.aggregateMetrics.languagesPercentage).toHaveProperty('Rust', 70);
      expect(analysisData.aggregateMetrics.languagesPercentage).toHaveProperty('JavaScript', 29);
    });
  });

  describe('5. Resiliency & Edge-Case Operations', () => {
    it('should handle users with zero repositories gracefully', async () => {
      mockProfileResponse = mockRawProfile;
      mockReposResponse = [];

      const res = await portfolioDataCollector.collectPortfolioData('emptydev', null);

      expect(res.repositories.totalCount).toBe(0);
      expect(res.topRepositories).toHaveLength(0);
      expect(res.aggregateMetrics.totalStars).toBe(0);
      expect(res.aggregateMetrics.languagesPercentage).toEqual({});
    });

    it('should handle users with only forks gracefully', async () => {
      mockProfileResponse = mockRawProfile;
      mockReposResponse = [
        { id: 201, name: 'fork-1', full_name: 'testdev/fork-1', fork: true, stargazers_count: 10 }
      ];

      const res = await portfolioDataCollector.collectPortfolioData('forkdev', null);

      expect(res.repositories.totalCount).toBe(1);
      expect(res.repositories.forkCount).toBe(1);
      expect(res.repositories.originalCount).toBe(0);
    });

    it('should handle partial GitHub API failures (languages, commits) without crashing the entire query', async () => {
      mockProfileResponse = mockRawProfile;
      mockReposResponse = mockRawRepos.slice(0, 1); // 1 repo: awesome-project

      // Force sub-queries to fail
      mockLanguagesResponses['testdev/awesome-project'] = new Error('GitHub Rate Limit Exceeded');
      mockCommitsResponses['testdev/awesome-project'] = new Error('Network Timeout');

      // Execute: should complete without throwing!
      const res = await portfolioDataCollector.collectPortfolioData('brokendev', null);

      expect(res.repositories.totalCount).toBe(1);
      expect(res.topRepositories).toHaveLength(1);
      
      const topRepo = res.topRepositories[0];
      // Failed sub-queries degrade gracefully to default shapes
      expect(topRepo.languages).toEqual({});
      expect(topRepo.commitActivity.totalCommits).toBe(0);
      expect(topRepo.commitActivity.weeklyCommits).toHaveLength(52);
    });

    it('should handle repositories without detected languages gracefully', async () => {
      mockProfileResponse = mockRawProfile;
      mockReposResponse = [
        { id: 301, name: 'plain-docs', full_name: 'testdev/plain-docs', fork: false, language: null }
      ];
      mockLanguagesResponses['testdev/plain-docs'] = {};
      mockCommitsResponses['testdev/plain-docs'] = [];

      const res = await portfolioDataCollector.collectPortfolioData('nolangdev', null);

      expect(res.repositories.totalCount).toBe(1);
      expect(res.topRepositories[0].primaryLanguage).toBeNull();
      expect(res.aggregateMetrics.languagesPercentage).toEqual({});
    });
  });
});

import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Setup Mock Environment
process.env.JWT_SECRET = 'test_jwt_secret_key_12345678';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock Crypto Utility before imports
jest.unstable_mockModule('../src/utils/crypto.js', () => ({
  encrypt: jest.fn((text) => `iv:encrypted:${text}`),
  decrypt: jest.fn((ciphertext) => 'mock-decrypted-github-token'),
}));

// 1. Mock Database Layer
jest.unstable_mockModule('../src/config/db.js', () => ({
  default: {
    user: {
      findUnique: jest.fn(),
    },
    analysisReport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

// 2. Mock Redis Cache
jest.unstable_mockModule('../src/config/redis.js', () => ({
  default: null,
  isRedisConnected: true,
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
}));

// 3. Mock Data Collector & Scoring Engine to isolate API testing
jest.unstable_mockModule('../src/services/portfolioDataCollector.js', () => ({
  default: {
    collectPortfolioData: jest.fn(),
  },
}));

jest.unstable_mockModule('../src/services/scoring/scoringEngine.js', () => ({
  default: {
    calculateDeveloperScore: jest.fn(),
  },
}));

// 4. Mock AI Insights Service
jest.unstable_mockModule('../src/services/ai/aiService.js', () => ({
  default: {
    generateInsights: jest.fn(),
  },
}));

const { default: prisma } = await import('../src/config/db.js');
const { default: portfolioDataCollector } = await import('../src/services/portfolioDataCollector.js');
const { default: scoringEngine } = await import('../src/services/scoring/scoringEngine.js');
const { default: aiService } = await import('../src/services/ai/aiService.js');

// Import app after all mock setups
const { default: app } = await import('../src/app.js');

const generateTestAccessToken = (userId) => {
  return jwt.sign(
    { userId, email: 'developer@devlens.com', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

describe('Analytics & Reports API Integration Suite (Module 3.3)', () => {
  const userId = 1;
  const mockToken = generateTestAccessToken(userId);
  const targetUsername = 'octocat';

  const mockAiInsights = {
    aiSummary: 'Completed analysis for octocat. Excellent frontend skills.',
    strengths: ['Strong JavaScript skills', 'High test coverage'],
    weaknesses: ['Needs to learn TypeScript', 'Fewer public contributions'],
    resumeReadinessStars: 4,
    resumeBreakdown: {
      bulletPoints: [
        'Engineered high performance JavaScript apps',
        'Maintained 90% test coverage across repositories',
        'Implemented responsive web features',
      ],
      careerInsights: 'Very competitive frontend developer profile.',
    },
    learningRoadmap: {
      milestones: [
        {
          phase: 'Phase 1: Types',
          topic: 'TypeScript Basics',
          priority: 'High',
          estimatedTime: '2 weeks',
          expectedScoreImprovement: 20,
          actionableSteps: ['Study TS Handbook', 'Refactor repository to TS'],
          suggestedResources: ['TS Handbook', 'Total TypeScript'],
        },
        {
          phase: 'Phase 2: Backend',
          topic: 'Node.js API Development',
          priority: 'Medium',
          estimatedTime: '3 weeks',
          expectedScoreImprovement: 15,
          actionableSteps: ['Build Express server with TypeScript'],
          suggestedResources: ['NodeJS documentation'],
        },
        {
          phase: 'Phase 3: DevOps',
          topic: 'Docker and CI/CD',
          priority: 'Low',
          estimatedTime: '1 week',
          expectedScoreImprovement: 10,
          actionableSteps: ['Configure GitHub Actions workflow'],
          suggestedResources: ['GitHub Actions docs'],
        },
      ],
    },
    interviewPrep: {
      likelyQuestions: ['Explain prototypical inheritance', "What is TypeScript's utility types?"],
      talkingPoints: ['My experience in frontend performance', 'Building responsive designs'],
      conceptsToReview: ['JavaScript closures', 'CSS grid and flexbox'],
    },
    aiMetadata: {
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      promptVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      responseTimeMs: 120,
      retryCount: 0,
      fallbackStatus: false,
      cached: false,
      analyticsHash: 'abc123sha256hash',
    },
  };

  const mockCollectorOutput = {
    profile: { username: targetUsername },
    repositories: { originalCount: 2, totalCount: 2, all: [] },
    topRepositories: [],
    aggregateMetrics: { codebase: { languagesPercentage: { JS: 100 } } },
  };

  const mockScoringOutput = {
    overallScore: 85,
    confidenceScore: 60,
    scoringVersion: '1.0.0',
    analyzedAt: new Date().toISOString(),
    categories: {
      repositoryQuality: { score: 80, weight: 0.2, factors: {}, improvements: ['Fix issues'] },
    },
    rawMetrics: {
      codebase: { languagesPercentage: { JS: 100 } },
    },
  };

  const validReportPayload = {
    targetGithubUsername: targetUsername,
    developerScore: 85,
    scoreBreakdown: {
      overallScore: 85,
      confidenceScore: 60,
      scoringVersion: '1.0.0',
      analyzedAt: new Date().toISOString(),
      categories: { repositoryQuality: { score: 80, weight: 0.2, factors: {}, improvements: [] } },
      aiMetadata: {
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        promptVersion: '1.0.0',
        timestamp: new Date().toISOString(),
        responseTimeMs: 120,
        retryCount: 0,
        fallbackStatus: false,
        cached: false,
        analyticsHash: 'abc123sha256hash',
        insightSource: 'gemini',
      },
    },
    reposAnalyzed: [
      { name: 'repo-1', fullName: 'octocat/repo-1', stars: 5, forks: 1, size: 200, isPrivate: false },
    ],
    languageData: { JS: 100 },
    rawMetadataCache: {
      profile: { username: targetUsername },
      analyticsHash: 'abc123sha256hash',
    },
    suggestions: ['Add a README file.'],
    aiSummary: 'Completed analysis for octocat. Excellent frontend skills.',
    resumeReadinessStars: 4,
    resumeBreakdown: {
      bulletPoints: [
        'Engineered high performance JavaScript apps',
        'Maintained 90% test coverage across repositories',
        'Implemented responsive web features',
      ],
      careerInsights: 'Very competitive frontend developer profile.',
    },
    strengths: ['Strong JavaScript skills', 'High test coverage'],
    weaknesses: ['Needs to learn TypeScript', 'Fewer public contributions'],
    learningRoadmap: {
      milestones: [
        {
          phase: 'Phase 1: Types',
          topic: 'TypeScript Basics',
          priority: 'High',
          estimatedTime: '2 weeks',
          expectedScoreImprovement: 20,
          actionableSteps: ['Study TS Handbook', 'Refactor repository to TS'],
          suggestedResources: ['TS Handbook', 'Total TypeScript'],
        },
        {
          phase: 'Phase 2: Backend',
          topic: 'Node.js API Development',
          priority: 'Medium',
          estimatedTime: '3 weeks',
          expectedScoreImprovement: 15,
          actionableSteps: ['Build Express server with TypeScript'],
          suggestedResources: ['NodeJS documentation'],
        },
        {
          phase: 'Phase 3: DevOps',
          topic: 'Docker and CI/CD',
          priority: 'Low',
          estimatedTime: '1 week',
          expectedScoreImprovement: 10,
          actionableSteps: ['Configure GitHub Actions workflow'],
          suggestedResources: ['GitHub Actions docs'],
        },
      ],
    },
    interviewPrep: {
      likelyQuestions: ['Explain prototypical inheritance', "What is TypeScript's utility types?"],
      talkingPoints: ['My experience in frontend performance', 'Building responsive designs'],
      conceptsToReview: ['JavaScript closures', 'CSS grid and flexbox'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    aiService.generateInsights.mockResolvedValue(mockAiInsights);
  });

  // ==========================================
  // GET /api/v1/analytics/analyze/:username
  // ==========================================
  describe('GET /api/v1/analytics/analyze/:username', () => {
    it('should successfully analyze a profile and return a standardized extensible response with AI insights', async () => {
      portfolioDataCollector.collectPortfolioData.mockResolvedValue(mockCollectorOutput);
      scoringEngine.calculateDeveloperScore.mockReturnValue(mockScoringOutput);

      const response = await request(app)
        .get(`/api/v1/analytics/analyze/${targetUsername}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.result.targetGithubUsername).toBe(targetUsername);
      expect(response.body.data.result.developerScore).toBe(85);
      expect(response.body.data.result.scoreBreakdown.confidenceScore).toBe(60);
      expect(response.body.data.result.scoreBreakdown.scoringVersion).toBe('1.0.0');
      expect(response.body.data.result.suggestions).toContain('Fix issues');
      
      // Assert AI insights are merged at the root of the result object
      expect(response.body.data.result.aiSummary).toBe(mockAiInsights.aiSummary);
      expect(response.body.data.result.resumeReadinessStars).toBe(mockAiInsights.resumeReadinessStars);
      expect(response.body.data.result.strengths).toEqual(mockAiInsights.strengths);
      expect(response.body.data.result.weaknesses).toEqual(mockAiInsights.weaknesses);
      expect(response.body.data.result.resumeBreakdown).toEqual(mockAiInsights.resumeBreakdown);
      expect(response.body.data.result.learningRoadmap).toEqual(mockAiInsights.learningRoadmap);
      expect(response.body.data.result.interviewPrep).toEqual(mockAiInsights.interviewPrep);

      // Assert AI metadata in scoreBreakdown
      expect(response.body.data.result.scoreBreakdown.aiMetadata).toEqual(
        expect.objectContaining({
          provider: 'gemini',
          model: 'gemini-1.5-flash',
          insightSource: 'gemini',
          fallbackStatus: false,
          analyticsHash: 'abc123sha256hash',
        })
      );

      // Assert SHA-256 hash in rawMetadataCache
      expect(response.body.data.result.rawMetadataCache.analyticsHash).toBe('abc123sha256hash');
      
      expect(portfolioDataCollector.collectPortfolioData).toHaveBeenCalledWith(targetUsername, null);
      expect(aiService.generateInsights).toHaveBeenCalled();
    });

    it('should resolve linked token if requester is authenticated', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        githubAccessToken: 'v2:mockciphertext:0123456789abcdef:1234567890abcdef', // Mock encrypted token
      });
      portfolioDataCollector.collectPortfolioData.mockResolvedValue(mockCollectorOutput);
      scoringEngine.calculateDeveloperScore.mockReturnValue(mockScoringOutput);

      const response = await request(app)
        .get(`/api/v1/analytics/analyze/${targetUsername}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(200);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { githubAccessToken: true, githubUsername: true },
      });
      expect(portfolioDataCollector.collectPortfolioData).toHaveBeenCalledWith(targetUsername, expect.any(String));
    });

    it('should return 400 Bad Request if username fails Joi regex validation', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/analyze/invalid_username_with_special_char$');

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation Error');
      expect(response.body.errors[0].field).toBe('username');
    });

    it('should clearly distinguish between Gemini and Fallback in the persisted metadata', async () => {
      portfolioDataCollector.collectPortfolioData.mockResolvedValue(mockCollectorOutput);
      scoringEngine.calculateDeveloperScore.mockReturnValue(mockScoringOutput);
      
      // Setup mock to simulate a fallback run
      aiService.generateInsights.mockResolvedValue({
        ...mockAiInsights,
        aiMetadata: {
          ...mockAiInsights.aiMetadata,
          fallbackStatus: true,
        },
      });

      const response = await request(app)
        .get(`/api/v1/analytics/analyze/${targetUsername}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.data.result.scoreBreakdown.aiMetadata.fallbackStatus).toBe(true);
      expect(response.body.data.result.scoreBreakdown.aiMetadata.insightSource).toBe('fallback');
    });

    it('should verify that consecutive profile analyses with identical data reuse the cached AI response', async () => {
      portfolioDataCollector.collectPortfolioData.mockResolvedValue(mockCollectorOutput);
      scoringEngine.calculateDeveloperScore.mockReturnValue(mockScoringOutput);

      // Setup mock to return uncached first, then cached
      aiService.generateInsights
        .mockResolvedValueOnce({
          ...mockAiInsights,
          aiMetadata: { ...mockAiInsights.aiMetadata, cached: false, responseTimeMs: 120 }
        })
        .mockResolvedValueOnce({
          ...mockAiInsights,
          aiMetadata: { ...mockAiInsights.aiMetadata, cached: true, responseTimeMs: 0 }
        });

      // First call (Cache Miss)
      const res1 = await request(app).get(`/api/v1/analytics/analyze/${targetUsername}`);
      expect(res1.statusCode).toBe(200);
      expect(res1.body.data.result.scoreBreakdown.aiMetadata.cached).toBe(false);
      expect(res1.body.data.result.scoreBreakdown.aiMetadata.responseTimeMs).toBe(120);

      // Second call (Cache Hit)
      const res2 = await request(app).get(`/api/v1/analytics/analyze/${targetUsername}`);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.result.scoreBreakdown.aiMetadata.cached).toBe(true);
      expect(res2.body.data.result.scoreBreakdown.aiMetadata.responseTimeMs).toBe(0);
    });
  });

  // ==========================================
  // POST /api/v1/analytics/report/save
  // ==========================================
  describe('POST /api/v1/analytics/report/save', () => {

    it('should reject requests with 401 if access token is missing', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/report/save')
        .send(validReportPayload);

      expect(response.statusCode).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject requests with 400 if payload fails validation', async () => {
      const invalidPayload = { ...validReportPayload, developerScore: 105 }; // Invalid score > 100

      const response = await request(app)
        .post('/api/v1/analytics/report/save')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidPayload);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation Error');
    });

    it('should successfully save the report and return 201 Created', async () => {
      const mockSavedDbRecord = {
        id: 'uuid-report-123',
        userId,
        targetGithubUsername: targetUsername,
        developerScore: 85,
        scoreBreakdown: validReportPayload.scoreBreakdown,
        isSaved: true,
        createdAt: new Date().toISOString(),
      };

      prisma.analysisReport.create.mockResolvedValue(mockSavedDbRecord);

      const response = await request(app)
        .post('/api/v1/analytics/report/save')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(validReportPayload);

      expect(response.statusCode).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('uuid-report-123');
      expect(prisma.analysisReport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          targetGithubUsername: targetUsername,
          developerScore: 85,
          isSaved: true,
          aiSummary: validReportPayload.aiSummary,
          resumeReadinessStars: 4,
          resumeBreakdown: expect.objectContaining({
            bulletPoints: validReportPayload.resumeBreakdown.bulletPoints,
            careerInsights: validReportPayload.resumeBreakdown.careerInsights,
            learningRoadmap: validReportPayload.learningRoadmap,
            interviewPrep: validReportPayload.interviewPrep,
          }),
          strengths: validReportPayload.strengths,
          weaknesses: validReportPayload.weaknesses,
        }),
      });
    });
  });

  // ==========================================
  // GET /api/v1/analytics/report/saved
  // ==========================================
  describe('GET /api/v1/analytics/report/saved', () => {
    it('should reject with 401 if unauthenticated', async () => {
      const response = await request(app).get('/api/v1/analytics/report/saved');
      expect(response.statusCode).toBe(401);
    });

    it('should return a list of saved reports for the authenticated user, unpacking nested roadmap and prep', async () => {
      const mockReports = [
        {
          id: '1',
          targetGithubUsername: 'octocat',
          developerScore: 85,
          aiSummary: 'Completed analysis for octocat. Excellent frontend skills.',
          resumeReadinessStars: 4,
          resumeBreakdown: {
            bulletPoints: [
              'Engineered high performance JavaScript apps',
              'Maintained 90% test coverage across repositories',
              'Implemented responsive web features',
            ],
            careerInsights: 'Very competitive frontend developer profile.',
            learningRoadmap: mockAiInsights.learningRoadmap,
            interviewPrep: mockAiInsights.interviewPrep,
          },
          strengths: ['Strong JavaScript skills', 'High test coverage'],
          weaknesses: ['Needs to learn TypeScript', 'Fewer public contributions'],
        },
      ];
      prisma.analysisReport.findMany.mockResolvedValue(mockReports);

      const response = await request(app)
        .get('/api/v1/analytics/report/saved')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);

      const unpackedReport = response.body.data[0];
      // Assert it was correctly unpacked back to the root of the report object
      expect(unpackedReport.resumeBreakdown).toEqual({
        bulletPoints: [
          'Engineered high performance JavaScript apps',
          'Maintained 90% test coverage across repositories',
          'Implemented responsive web features',
        ],
        careerInsights: 'Very competitive frontend developer profile.',
      });
      expect(unpackedReport.learningRoadmap).toEqual(mockAiInsights.learningRoadmap);
      expect(unpackedReport.interviewPrep).toEqual(mockAiInsights.interviewPrep);

      expect(prisma.analysisReport.findMany).toHaveBeenCalledWith({
        where: { userId, isSaved: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ==========================================
  // DELETE /api/v1/analytics/report/:id
  // ==========================================
  describe('DELETE /api/v1/analytics/report/:id', () => {
    const reportId = 'report-uuid-111';

    it('should reject with 401 if unauthenticated', async () => {
      const response = await request(app).delete(`/api/v1/analytics/report/${reportId}`);
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 if the report does not exist', async () => {
      prisma.analysisReport.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/v1/analytics/report/${reportId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 Forbidden if the report belongs to a different user', async () => {
      prisma.analysisReport.findUnique.mockResolvedValue({
        id: reportId,
        userId: 999, // Different owner
      });

      const response = await request(app)
        .delete(`/api/v1/analytics/report/${reportId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not authorized');
    });

    it('should successfully delete the report and return 200 OK if authorized', async () => {
      prisma.analysisReport.findUnique.mockResolvedValue({
        id: reportId,
        userId, // Same owner
      });
      prisma.analysisReport.delete.mockResolvedValue({ id: reportId });

      const response = await request(app)
        .delete(`/api/v1/analytics/report/${reportId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prisma.analysisReport.delete).toHaveBeenCalledWith({
        where: { id: reportId },
      });
    });
  });

  // ==========================================
  // POST /api/v1/analytics/export/pdf
  // ==========================================
  describe('POST /api/v1/analytics/export/pdf', () => {
    it('should return 200 OK and PDF content type for valid report payload', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/export/pdf')
        .send(validReportPayload);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });

    it('should return 400 Bad Request if the payload fails validation', async () => {
      const invalidPayload = { ...validReportPayload, targetGithubUsername: 'invalid--username' };

      const response = await request(app)
        .post('/api/v1/analytics/export/pdf')
        .send(invalidPayload);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation Error');
    });
  });

  // ==========================================
  // GET /api/v1/analytics/report/:id/export/pdf
  // ==========================================
  describe('GET /api/v1/analytics/report/:id/export/pdf', () => {
    const reportId = 'report-uuid-999';

    it('should reject with 401 if unauthenticated', async () => {
      const response = await request(app).get(`/api/v1/analytics/report/${reportId}/export/pdf`);
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 if the report does not exist', async () => {
      prisma.analysisReport.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/analytics/report/${reportId}/export/pdf`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 403 if the report belongs to a different user', async () => {
      prisma.analysisReport.findUnique.mockResolvedValue({
        id: reportId,
        userId: 999, // Different owner
      });

      const response = await request(app)
        .get(`/api/v1/analytics/report/${reportId}/export/pdf`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not authorized');
    });

    it('should return 200 OK and PDF content type if authorized', async () => {
      const enrichedResumeBreakdown = {
        bulletPoints: validReportPayload.resumeBreakdown.bulletPoints,
        careerInsights: validReportPayload.resumeBreakdown.careerInsights,
        learningRoadmap: validReportPayload.learningRoadmap,
        interviewPrep: validReportPayload.interviewPrep,
      };

      prisma.analysisReport.findUnique.mockResolvedValue({
        id: reportId,
        userId,
        targetGithubUsername: targetUsername,
        developerScore: 85,
        scoreBreakdown: validReportPayload.scoreBreakdown,
        aiSummary: validReportPayload.aiSummary,
        resumeReadinessStars: 4,
        resumeBreakdown: enrichedResumeBreakdown,
        strengths: validReportPayload.strengths,
        weaknesses: validReportPayload.weaknesses,
        reposAnalyzed: validReportPayload.reposAnalyzed,
        languageData: validReportPayload.languageData,
        rawMetadataCache: validReportPayload.rawMetadataCache,
        createdAt: new Date().toISOString(),
      });

      const response = await request(app)
        .get(`/api/v1/analytics/report/${reportId}/export/pdf`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(Buffer.isBuffer(response.body)).toBe(true);
    });
  });

  // ==========================================
  // GET /api/v1/analytics/report/compare/:username
  // ==========================================
  describe('GET /api/v1/analytics/report/compare/:username', () => {
    it('should reject with 401 if unauthenticated', async () => {
      const response = await request(app).get(`/api/v1/analytics/report/compare/${targetUsername}`);
      expect(response.statusCode).toBe(401);
    });

    it('should return empty comparison payload if no reports saved for the developer', async () => {
      prisma.analysisReport.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/v1/analytics/report/compare/${targetUsername}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.timeline).toEqual([]);
      expect(response.body.data.deltas.overallScoreDelta).toBe(0);
    });

    it('should calculate score progression and resolved suggestions correctly', async () => {
      const mockSavedReports = [
        {
          id: 'report-1',
          userId,
          targetGithubUsername: targetUsername,
          developerScore: 70,
          scoreBreakdown: {
            categories: {
              repositoryQuality: { score: 60 },
              documentation: { score: 70 },
            },
          },
          suggestions: ['Add license', 'Add readme'],
          createdAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'report-2',
          userId,
          targetGithubUsername: targetUsername,
          developerScore: 80,
          scoreBreakdown: {
            categories: {
              repositoryQuality: { score: 80 },
              documentation: { score: 70 },
            },
          },
          suggestions: ['Add readme'],
          createdAt: '2026-06-15T00:00:00.000Z',
        },
      ];

      prisma.analysisReport.findMany.mockResolvedValue(mockSavedReports);

      const response = await request(app)
        .get(`/api/v1/analytics/report/compare/${targetUsername}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      
      const comparisonData = response.body.data;
      expect(comparisonData.timeline).toHaveLength(2);
      expect(comparisonData.timeline[0].developerScore).toBe(70);
      expect(comparisonData.timeline[1].developerScore).toBe(80);
      
      expect(comparisonData.deltas.overallScoreDelta).toBe(10);
      expect(comparisonData.deltas.categoryDeltas.repositoryQuality).toBe(20);
      expect(comparisonData.deltas.categoryDeltas.documentation).toBe(0);
      
      expect(comparisonData.biggestImprovement).toBe('repositoryQuality');
      expect(comparisonData.resolvedSuggestions).toEqual(['Add license']);
    });
  });
});

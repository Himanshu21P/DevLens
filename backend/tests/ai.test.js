import { jest } from '@jest/globals';
import Joi from 'joi';

// Setup Mock Environment
process.env.JWT_SECRET = 'test_jwt_secret_key_12345678';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.GEMINI_API_KEY = 'mock_api_key_123456';

// 1. Mock Database Layer
jest.unstable_mockModule('../src/config/db.js', () => ({
  default: {},
}));

// 2. Mock Redis Cache
jest.unstable_mockModule('../src/config/redis.js', () => {
  let cacheStore = {};
  return {
    default: null,
    isRedisConnected: true,
    getCache: jest.fn(async (key) => cacheStore[key] || null),
    setCache: jest.fn(async (key, value) => {
      cacheStore[key] = value;
      return true;
    }),
    deleteCache: jest.fn(async (key) => {
      delete cacheStore[key];
      return true;
    }),
    _clearStore: () => {
      cacheStore = {};
    },
  };
});

// 3. Mock Concrete Gemini Provider API
jest.unstable_mockModule('../src/services/ai/geminiProvider.js', () => ({
  default: {
    modelName: 'gemini-1.5-flash',
    generateRawInsights: jest.fn(),
  },
}));

const { getCache, setCache, _clearStore } = await import('../src/config/redis.js');
const { default: geminiProvider } = await import('../src/services/ai/geminiProvider.js');
const { default: aiService } = await import('../src/services/ai/aiService.js');

describe('AI Advanced Insights Engine (Module 4.1)', () => {
  
  // Standard deterministic report data used as test input
  const testReportData = {
    targetGithubUsername: 'testdev',
    developerScore: 78,
    scoreBreakdown: {
      overallScore: 78,
      confidenceScore: 80,
      scoringVersion: '1.0.0',
      categories: {
        repositoryQuality: { score: 85, weight: 0.2, improvements: [] },
        documentationQuality: { score: 100, weight: 0.2, improvements: [] }, // High score (100)
        projectActivity: { score: 70, weight: 0.2, improvements: [] },
        technologyDiversity: { score: 60, weight: 0.15, improvements: [] },
        openSourceEngagement: { score: 80, weight: 0.15, improvements: [] },
        portfolioReadiness: { score: 75, weight: 0.1, improvements: [] },
      },
    },
    reposAnalyzed: [
      { name: 'repo-1', fullName: 'testdev/repo-1', stars: 5, forks: 1, size: 500, primaryLanguage: 'JavaScript', homepage: 'https://demo.com' },
    ],
    languageData: { JavaScript: 100 },
    suggestions: ['Improve tech diversity', 'Add daily commits'],
  };

  // Valid, schema-compliant mock response from Gemini
  const validAiResponse = {
    aiSummary: "The developer demonstrates a solid portfolio featuring high-quality repository architecture and excellent codebase documentation.",
    strengths: [
      "Excellent documentation quality with 100% README coverage across core projects.",
      "Good repository quality and codebase hygiene."
    ],
    weaknesses: [
      "Technology diversity could be expanded beyond JavaScript.",
      "Commit volumes show moderate activity gaps over the past year."
    ],
    resumeReadinessStars: 4,
    resumeBreakdown: {
      bulletPoints: [
        "Architected a standardized JavaScript portfolio with automated testing.",
        "Engineered 100% documentation coverage, simplifying developer onboarding.",
        "Maintained active Git workflows and push recency across repositories."
      ],
      careerInsights: "Aligned for frontend and fullstack engineering roles. Broadening stack versatility will boost marketability."
    },
    learningRoadmap: {
      milestones: [
        {
          phase: "Phase 1: Foundation",
          topic: "Acquire Go backend development skills",
          priority: "High",
          estimatedTime: "3 weeks",
          expectedScoreImprovement: 15,
          actionableSteps: ["Complete Go language fundamentals course.", "Build a REST API backend in Go."],
          suggestedResources: ["Go Tour", "Go in Action Book"]
        },
        {
          phase: "Phase 2: Database",
          topic: "Learn PostgreSQL and SQL",
          priority: "Medium",
          estimatedTime: "2 weeks",
          expectedScoreImprovement: 10,
          actionableSteps: ["Learn database normalization concepts.", "Connect Go backend to a PostgreSQL instance."],
          suggestedResources: ["SQLBolt tutorial"]
        },
        {
          phase: "Phase 3: Integration",
          topic: "Build a Fullstack Application",
          priority: "Low",
          estimatedTime: "2 weeks",
          expectedScoreImprovement: 10,
          actionableSteps: ["Integrate your Go backend with a React frontend.", "Deploy the application to a cloud hosting platform."],
          suggestedResources: ["Fullstack Web Development Guides"]
        }
      ]
    },
    interviewPrep: {
      likelyQuestions: [
        "How do you approach structuring your codebase for modularity and scalability?",
        "Can you explain the advantages of strong documentation in collaborative projects?"
      ],
      talkingPoints: [
        "Detailing your 100% README coverage and standard licensing implementation.",
        "Explaining your repository layouts and codebase hygiene principles."
      ],
      conceptsToReview: [
        "REST API design and HTTP status codes.",
        "SQL database normalization and indexing."
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    _clearStore();
  });

  // ==========================================
  // 1. Hashing & Caching Cycle
  // ==========================================
  describe('Hashing & Caching Lifecycle', () => {
    it('should query the provider on a cache miss, return insights, and cache the result', async () => {
      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(validAiResponse));

      const result = await aiService.generateInsights(testReportData);

      expect(result.aiSummary).toBe(validAiResponse.aiSummary);
      expect(result.aiMetadata.cached).toBe(false);
      expect(result.aiMetadata.fallbackStatus).toBe(false);
      expect(result.aiMetadata.retryCount).toBe(0);

      expect(geminiProvider.generateRawInsights).toHaveBeenCalledTimes(1);
      
      // Verify it was written to Redis cache
      const cacheKeyPattern = /^github:ai:insights:[a-f0-9]{64}$/;
      expect(setCache).toHaveBeenCalledWith(
        expect.stringMatching(cacheKeyPattern),
        expect.any(Object),
        86400
      );
    });

    it('should return cached insights immediately on a cache hit, bypassing the model API call', async () => {
      // First call to populate cache
      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(validAiResponse));
      await aiService.generateInsights(testReportData);
      
      // Clear mocks to audit next call
      jest.clearAllMocks();

      // Second call (Cache Hit)
      const result = await aiService.generateInsights(testReportData);

      expect(result.aiSummary).toBe(validAiResponse.aiSummary);
      expect(result.aiMetadata.cached).toBe(true);
      expect(result.aiMetadata.responseTimeMs).toBe(0);
      
      // Assert model was never called
      expect(geminiProvider.generateRawInsights).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. Prompt Token Auditing
  // ==========================================
  describe('Prompt Context Auditing', () => {
    it('should generate prompts containing only summarized metrics and the Confidence Score', async () => {
      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(validAiResponse));
      
      await aiService.generateInsights(testReportData);

      const promptCallArgs = geminiProvider.generateRawInsights.mock.calls[0][0];
      const promptText = promptCallArgs.prompt;

      // 1. Verify prompt contains category scores
      expect(promptText).toContain('Overall Developer Score: 78');
      expect(promptText).toContain('Documentation Quality: 100');
      
      // 2. Verify prompt contains the Confidence Score
      expect(promptText).toContain('Data Representativeness Confidence Score: 80%');

      // 3. Verify prompt contains repository metadata but NO source code
      expect(promptText).toContain('repo-1');
      expect(promptText).toContain('Stars=5');
      expect(promptText).not.toContain('function');
      expect(promptText).not.toContain('import');
    });
  });

  // ==========================================
  // 3. Joi and Semantic Business Validation Guards
  // ==========================================
  describe('Validation Pipeline & Guards', () => {
    
    it('should reject responses with Joi validation failures (missing fields)', async () => {
      // Missing 'learningRoadmap' field completely
      const brokenStructure = {
        ...validAiResponse,
        learningRoadmap: undefined,
      };

      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(brokenStructure));

      // Mock fallback to avoid throwing, since it triggers fallback on validation failure
      const result = await aiService.generateInsights(testReportData);
      
      // Verify that it degraded to fallback due to Joi validation failure
      expect(result.aiMetadata.fallbackStatus).toBe(true);
    });

    it('should reject responses failing Business Validation: Invented Scores', async () => {
      // AI invented a score of 92 (which is not in our testReportData scores: 78, 85, 100, 70, 60, 80, 75)
      const inventedScoreResponse = {
        ...validAiResponse,
        aiSummary: "The developer achieved an outstanding score of 92 in open source engagement.",
      };

      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(inventedScoreResponse));

      const result = await aiService.generateInsights(testReportData);

      // Should trigger fallback due to invented score guard
      expect(result.aiMetadata.fallbackStatus).toBe(true);
    });

    it('should reject responses failing Business Validation: Duplicate Recommendations', async () => {
      // Duplicate strengths
      const duplicateStrengthsResponse = {
        ...validAiResponse,
        strengths: [
          "Excellent documentation quality with 100% README coverage across core projects.",
          "Excellent documentation quality with 100% README coverage across core projects." // Duplicate
        ],
      };

      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(duplicateStrengthsResponse));

      const result = await aiService.generateInsights(testReportData);

      // Should trigger fallback due to duplicate recommendations guard
      expect(result.aiMetadata.fallbackStatus).toBe(true);
    });

    it('should reject responses failing Business Validation: Semantic Consistency', async () => {
      // Criticizes documentation in weaknesses, even though documentationQuality score is 100!
      const inconsistentResponse = {
        ...validAiResponse,
        weaknesses: [
          "Low documentation coverage across primary repositories.", // Contradicts score of 100
          "Commit volumes show moderate activity gaps."
        ],
      };

      geminiProvider.generateRawInsights.mockResolvedValue(JSON.stringify(inconsistentResponse));

      const result = await aiService.generateInsights(testReportData);

      // Should trigger fallback due to semantic contradiction guard
      expect(result.aiMetadata.fallbackStatus).toBe(true);
    });
  });

  // ==========================================
  // 4. Resilient Retry Loop
  // ==========================================
  describe('Resilient Retry Loop', () => {
    it('should trigger the retry loop on a malformed JSON and successfully recover if the retry succeeds', async () => {
      // 1st call: returns malformed JSON
      // 2nd call: returns valid JSON
      geminiProvider.generateRawInsights
        .mockResolvedValueOnce('Broken JSON output that cannot be parsed { ...')
        .mockResolvedValueOnce(JSON.stringify(validAiResponse));

      const result = await aiService.generateInsights(testReportData);

      expect(result.aiSummary).toBe(validAiResponse.aiSummary);
      expect(result.aiMetadata.fallbackStatus).toBe(false);
      expect(result.aiMetadata.retryCount).toBe(1); // 1 retry executed

      expect(geminiProvider.generateRawInsights).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  // 5. Graceful Fallback Engine
  // ==========================================
  describe('Graceful Fallback Engine', () => {
    it('should return a rich, structured fallback payload if the provider continuously fails', async () => {
      // Always throws errors (e.g., API offline or rate-limit)
      geminiProvider.generateRawInsights.mockRejectedValue(new Error('API quota exceeded.'));

      const result = await aiService.generateInsights(testReportData);

      expect(result.aiMetadata.fallbackStatus).toBe(true);
      expect(result.aiMetadata.retryCount).toBe(3); // Attempted 3 times before fallback
      
      // Verify fallback data conforms to our Joi schema
      const { error } = Joi.object({
        aiSummary: Joi.string().required(),
        strengths: Joi.array().items(Joi.string()).min(2).required(),
        weaknesses: Joi.array().items(Joi.string()).min(2).required(),
        resumeReadinessStars: Joi.number().integer().min(1).max(5).required(),
        resumeBreakdown: Joi.object({
          bulletPoints: Joi.array().items(Joi.string()).min(3).required(),
          careerInsights: Joi.string().required(),
        }).required(),
        learningRoadmap: Joi.object({
          milestones: Joi.array().items(Joi.object()).min(3).required(),
        }).required(),
        interviewPrep: Joi.object({
          likelyQuestions: Joi.array().items(Joi.string()).min(2).required(),
          talkingPoints: Joi.array().items(Joi.string()).min(2).required(),
          conceptsToReview: Joi.array().items(Joi.string()).min(2).required(),
        }).required(),
      }).unknown().validate(result);

      expect(error).toBeUndefined(); // Passes validation perfectly!
      expect(result.aiSummary).toContain('Portfolio analysis compiled');
      
      // Verify it tailored the roadmap to their weakest score
      // (Their weakest score in testReportData is technologyDiversity with 60 pts)
      // So the fallback roadmap milestones should focus on paradigms and languages!
      expect(result.learningRoadmap.milestones[0].topic).toContain('programming paradigm');
    });
  });
});

import Joi from 'joi';

// GitHub Username Naming Rules:
// - Can only contain alphanumeric characters or hyphens
// - Cannot start or end with a hyphen
// - Cannot contain consecutive hyphens (--)
// - Maximum of 39 characters
const githubUsernameRegex = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export const analyzeParamsSchema = Joi.object({
  username: Joi.string()
    .pattern(githubUsernameRegex)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid GitHub username.',
      'any.required': 'GitHub username is required.',
    }),
});

export const saveReportSchema = Joi.object({
  targetGithubUsername: Joi.string()
    .pattern(githubUsernameRegex)
    .required()
    .messages({
      'string.pattern.base': 'Target GitHub username is invalid.',
      'any.required': 'Target GitHub username is required.',
    }),
  developerScore: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .required(),
  scoreBreakdown: Joi.object({
    overallScore: Joi.number().integer().min(0).max(100).required(),
    confidenceScore: Joi.number().integer().min(0).max(100).required(),
    scoringVersion: Joi.string().required(),
    analyzedAt: Joi.string().isoDate().required(),
    categories: Joi.object().required(),
    aiMetadata: Joi.object({
      provider: Joi.string().required(),
      model: Joi.string().required(),
      promptVersion: Joi.string().required(),
      timestamp: Joi.string().isoDate().required(),
      responseTimeMs: Joi.number().integer().min(0).required(),
      retryCount: Joi.number().integer().min(0).required(),
      fallbackStatus: Joi.boolean().required(),
      cached: Joi.boolean().required(),
      analyticsHash: Joi.string().required(),
      insightSource: Joi.string().valid('gemini', 'fallback').required(),
    }).required(),
  }).required(),
  reposAnalyzed: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().optional(),
        name: Joi.string().required(),
        fullName: Joi.string().required(),
        stars: Joi.number().integer().min(0).required(),
        forks: Joi.number().integer().min(0).required(),
        primaryLanguage: Joi.string().allow(null).optional(),
        homepage: Joi.string().allow(null).optional(),
        size: Joi.number().integer().min(0).required(),
        isPrivate: Joi.boolean().required(),
      })
    )
    .required(),
  languageData: Joi.object().required(),
  rawMetadataCache: Joi.object({
    analyticsHash: Joi.string().required(),
  }).unknown(true).required(),
  suggestions: Joi.array().items(Joi.string()).optional(),
  // AI Qualitative Fields
  aiSummary: Joi.string().required(),
  resumeReadinessStars: Joi.number().integer().min(1).max(5).required(),
  resumeBreakdown: Joi.object({
    bulletPoints: Joi.array().items(Joi.string()).min(3).required(),
    careerInsights: Joi.string().required(),
  }).required(),
  strengths: Joi.array().items(Joi.string()).min(2).required(),
  weaknesses: Joi.array().items(Joi.string()).min(2).required(),
  learningRoadmap: Joi.object({
    milestones: Joi.array().items(
      Joi.object({
        phase: Joi.string().required(),
        topic: Joi.string().required(),
        priority: Joi.string().valid('High', 'Medium', 'Low').required(),
        estimatedTime: Joi.string().required(),
        expectedScoreImprovement: Joi.number().integer().min(0).max(100).required(),
        actionableSteps: Joi.array().items(Joi.string()).min(1).required(),
        suggestedResources: Joi.array().items(Joi.string()).min(1).required(),
      })
    ).min(3).required(),
  }).required(),
  interviewPrep: Joi.object({
    likelyQuestions: Joi.array().items(Joi.string()).min(2).required(),
    talkingPoints: Joi.array().items(Joi.string()).min(2).required(),
    conceptsToReview: Joi.array().items(Joi.string()).min(2).required(),
  }).required(),
});

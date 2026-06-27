import crypto from 'crypto';
import Joi from 'joi';
import { aiConfig } from '../../config/aiConfig.js';
import { getCache, setCache } from '../../config/redis.js';
import geminiProvider from './geminiProvider.js';
import logger from '../../utils/logger.js';

// Define Joi Validation Schema for AI JSON response
const milestoneSchema = Joi.object({
  phase: Joi.string().required(),
  topic: Joi.string().required(),
  priority: Joi.string().valid('High', 'Medium', 'Low').required(),
  estimatedTime: Joi.string().required(),
  expectedScoreImprovement: Joi.number().integer().min(0).max(100).required(),
  actionableSteps: Joi.array().items(Joi.string()).min(1).required(),
  suggestedResources: Joi.array().items(Joi.string()).min(1).required(),
});

const aiInsightsResponseSchema = Joi.object({
  aiSummary: Joi.string().required(),
  strengths: Joi.array().items(Joi.string()).min(2).required(),
  weaknesses: Joi.array().items(Joi.string()).min(2).required(),
  resumeReadinessStars: Joi.number().integer().min(1).max(5).required(),
  resumeBreakdown: Joi.object({
    bulletPoints: Joi.array().items(Joi.string()).min(3).required(),
    careerInsights: Joi.string().required(),
  }).required(),
  learningRoadmap: Joi.object({
    milestones: Joi.array().items(milestoneSchema).min(3).required(),
  }).required(),
  interviewPrep: Joi.object({
    likelyQuestions: Joi.array().items(Joi.string()).min(2).required(),
    talkingPoints: Joi.array().items(Joi.string()).min(2).required(),
    conceptsToReview: Joi.array().items(Joi.string()).min(2).required(),
  }).required(),
});

class AiService {
  constructor() {
    this.provider = geminiProvider; // Default concrete provider
  }

  /**
   * Orchestrates the AI insights generation, handling hashing, Redis caching,
   * validation, retries, and fallback logic.
   * 
   * @param {object} reportData - Deterministic analytics and scoring engine output
   * @returns {Promise<object>} Complete AI insights payload with metadata
   */
  async generateInsights(reportData) {
    const username = reportData.targetGithubUsername || 'developer';
    logger.info(`Starting AI insights generation for: ${username}`);

    // 1. GENERATE DETERMINISTIC PAYLOAD HASH FOR CACHING
    const hashData = {
      developerScore: reportData.developerScore,
      categories: Object.fromEntries(
        Object.entries(reportData.scoreBreakdown.categories).map(([k, v]) => [k, v.score])
      ),
      reposCount: reportData.reposAnalyzed.length,
      languages: Object.keys(reportData.languageData),
    };
    
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
    
    const cacheKey = `github:ai:insights:${hash}`;

    // 2. QUERY REDIS CACHE
    try {
      const cachedEnvelope = await getCache(cacheKey);
      if (cachedEnvelope) {
        logger.info(`AI Caching HIT for developer: ${username} (Hash: ${hash})`);
        
        // Return cached payload, appending updated metadata indicating it was cached
        return {
          ...cachedEnvelope.insights,
          aiMetadata: {
            ...cachedEnvelope.insights.aiMetadata,
            timestamp: new Date().toISOString(),
            fallbackStatus: false,
            responseTimeMs: 0,
            cached: true,
            analyticsHash: hash,
          },
        };
      }
    } catch (cacheErr) {
      logger.warn(`Redis cache read failed in AI service: ${cacheErr.message}. Bypassing cache.`);
    }

    // 3. PREPARE PROMPT CONTEXT
    const promptContext = this._buildPromptContext(reportData);
    
    let responseText = '';
    let retryCount = 0;
    let fallbackStatus = false;
    let validatedJson = null;
    const startTime = Date.now();

    const providerName = aiConfig.DEFAULT_PROVIDER;
    const modelName = this.provider.modelName || aiConfig.DEFAULT_MODEL;

    // 4. RESILIENT RETRY LOOP
    const maxAttempts = 3; // 1 initial + 2 retries
    let feedbackPrompt = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info(`AI Insights request: Attempt ${attempt} of ${maxAttempts}`);
        
        // Call concrete provider
        responseText = await this.provider.generateRawInsights({
          systemInstruction: aiConfig.SYSTEM_INSTRUCTION,
          responseJsonTemplate: aiConfig.RESPONSE_JSON_TEMPLATE,
          prompt: promptContext + feedbackPrompt,
        });

        // Parse JSON safely
        const cleanedText = this._cleanJsonText(responseText);
        const parsedJson = JSON.parse(cleanedText);

        // Run validation pipeline (Joi + Business logic)
        const validationResult = this._validateResponse(parsedJson, reportData);
        
        if (validationResult.isValid) {
          validatedJson = parsedJson;
          break; // Successfully validated, exit loop
        } else {
          logger.warn(`Validation failed on attempt ${attempt}: ${validationResult.reason}`);
          feedbackPrompt = `\n\n[WARNING] Your previous response was invalid for the following reason:\n- ${validationResult.reason}\nPlease correct this and regenerate the exact JSON output complying strictly with all guidelines.`;
          retryCount = attempt;
        }
      } catch (err) {
        logger.warn(`API call or JSON parse failed on attempt ${attempt}: ${err.message}`);
        feedbackPrompt = `\n\n[WARNING] Your previous response failed to parse as valid JSON. Error: ${err.message}. Please return strictly raw JSON, with no markdown code blocks or wrapping text.`;
        retryCount = attempt;
      }
    }

    const responseTimeMs = Date.now() - startTime;

    // 5. DEGRADE GRACEFULLY TO FALLBACK
    if (!validatedJson) {
      logger.error(`AI generation continuously failed validation. Triggering fallback engine for: ${username}`);
      fallbackStatus = true;
      validatedJson = this._compileFallbackInsights(reportData);
    }

    // 6. BUILD FINAL ENVELOPE WITH AI METADATA
    const finalInsights = {
      ...validatedJson,
      aiMetadata: {
        provider: providerName,
        model: modelName,
        promptVersion: aiConfig.VERSION,
        timestamp: new Date().toISOString(),
        retryCount,
        fallbackStatus,
        responseTimeMs,
        cached: false,
        analyticsHash: hash,
      },
    };

    // 7. WRITE TO REDIS CACHE (If not in fallback)
    if (!fallbackStatus) {
      try {
        const cacheEnvelope = {
          insights: finalInsights,
          cachedAt: new Date().toISOString(),
        };
        await setCache(cacheKey, cacheEnvelope, aiConfig.CACHE_TTL);
        logger.info(`AI Insights successfully written to Redis cache for: ${username}`);
      } catch (cacheErr) {
        logger.warn(`Failed to write AI insights to Redis cache: ${cacheErr.message}`);
      }
    }

    return finalInsights;
  }

  /**
   * Summarizes deterministic scores and repository details into a token-efficient text prompt.
   */
  _buildPromptContext(reportData) {
    const categories = reportData.scoreBreakdown.categories;
    
    // Extracted raw metrics
    const reposList = reportData.reposAnalyzed.map(
      r => `- ${r.name}: Stars=${r.stars}, Forks=${r.forks}, Size=${r.size}KB, Lang=${r.primaryLanguage || 'Unknown'}, LiveDemo=${r.homepage ? 'Yes' : 'No'}`
    ).join('\n');

    const languagesText = Object.entries(reportData.languageData)
      .map(([lang, pct]) => `${lang}: ${pct}%`)
      .join(', ');

    return `
TARGET DEVELOPER USERNAME: ${reportData.targetGithubUsername}
DETERMINISTIC SCORES (0-100):
- Overall Developer Score: ${reportData.developerScore}
- Repository Quality: ${categories.repositoryQuality.score}
- Documentation Quality: ${categories.documentationQuality.score}
- Project Activity: ${categories.projectActivity.score}
- Technology Diversity: ${categories.technologyDiversity.score}
- Open Source Engagement: ${categories.openSourceEngagement.score}
- Portfolio Readiness: ${categories.portfolioReadiness.score}

ANALYSIS RELIABILITY:
- Data Representativeness Confidence Score: ${reportData.scoreBreakdown.confidenceScore}% (Do not recommend actions that assume high reliability if confidence is low, e.g. <40%).

PORTFOLIO METRICS SNAPSHOT:
- Core Languages: ${languagesText || 'None detected'}
- Total Original Repos: ${reportData.reposAnalyzed.length}
- Core Project Inventory:\n${reposList || 'No projects analyzed.'}

DETERMINISTIC IMPROVEMENT SUGGESTIONS (Calculated by algorithms):
${reportData.suggestions.map(s => `- ${s}`).join('\n') || 'None.'}
`;
  }

  /**
   * Sanitizes markdown artifacts (like ```json ... ``` wrappers) from raw LLM output.
   */
  _cleanJsonText(text) {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      // Strip starting codeblock markers
      clean = clean.replace(/^```(?:json)?/i, '');
      // Strip ending codeblock markers
      clean = clean.replace(/```$/i, '');
    }
    return clean.trim();
  }

  /**
   * Two-step validation pipeline: Joi structure verification + Semantic business rules check.
   */
  _validateResponse(json, reportData) {
    // Step 1: Joi Schema Validation
    const { error } = aiInsightsResponseSchema.validate(json, { abortEarly: false });
    if (error) {
      const details = error.details.map(d => d.message).join(', ');
      return { isValid: false, reason: `Structure Joi Validation Failed: ${details}` };
    }

    // Step 2: Business Validation Rule A - No Invented Scores
    // Gather all deterministic scores to build a whitelist of valid numbers
    const validScores = [
      reportData.developerScore,
      ...Object.values(reportData.scoreBreakdown.categories).map(c => c.score)
    ];

    // Inspect text fields recursively for invented scores (numbers 6-100 that do not match our scores)
    const textFields = [];
    const collectText = (obj) => {
      if (typeof obj === 'string') textFields.push(obj);
      else if (Array.isArray(obj)) obj.forEach(collectText);
      else if (obj && typeof obj === 'object') Object.values(obj).forEach(collectText);
    };
    collectText(json);

    for (const text of textFields) {
      // Find isolated numbers in the text
      const numbers = text.match(/\b([0-9]{1,3})\b/g);
      if (numbers) {
        for (const numStr of numbers) {
          const val = parseInt(numStr, 10);
          // Exclude low numbers (counts, star counts, milestones, etc.)
          if (val > 5 && val <= 100) {
            if (!validScores.includes(val)) {
              return {
                isValid: false,
                reason: `Score Compliance Violation: Invented numerical score ${val} detected in text: "${text}"`,
              };
            }
          }
        }
      }
    }

    // Step 3: Business Validation Rule B - No Duplicate Recommendations
    const hasDuplicates = (arr) => new Set(arr.size) !== arr.length;
    if (new Set(json.strengths).size !== json.strengths.length) {
      return { isValid: false, reason: 'Duplicate entries detected in Strengths list.' };
    }
    if (new Set(json.weaknesses).size !== json.weaknesses.length) {
      return { isValid: false, reason: 'Duplicate entries detected in Weaknesses list.' };
    }
    const suggestSteps = json.learningRoadmap.milestones.flatMap(m => m.actionableSteps);
    if (new Set(suggestSteps).size !== suggestSteps.length) {
      return { isValid: false, reason: 'Duplicate actionable steps detected in Learning Roadmap.' };
    }

    // Step 4: Business Validation Rule C - Semantic Consistency Guards
    const categories = reportData.scoreBreakdown.categories;
    const weaknessesText = json.weaknesses.join(' ').toLowerCase();

    if (categories.documentationQuality?.score >= 80) {
      if (weaknessesText.includes('documentation') || weaknessesText.includes('readme') || weaknessesText.includes('license')) {
        return { isValid: false, reason: 'Consistency Violation: Criticizing documentation quality despite high deterministic score (>=80).' };
      }
    }
    if (categories.technologyDiversity?.score >= 80) {
      if (weaknessesText.includes('technology diversity') || weaknessesText.includes('diversity') || weaknessesText.includes('lack of languages')) {
        return { isValid: false, reason: 'Consistency Violation: Criticizing technology diversity despite high deterministic score (>=80).' };
      }
    }

    return { isValid: true };
  }

  /**
   * Compiles a robust, structured fallback payload using deterministic scoring rules.
   */
  _compileFallbackInsights(reportData) {
    const username = reportData.targetGithubUsername;
    const categories = reportData.scoreBreakdown.categories;
    
    // Find their weakest score category
    const categoryEntries = Object.entries(categories);
    const sortedCategories = [...categoryEntries].sort((a, b) => a[1].score - b[1].score);
    const weakestCategory = sortedCategories[0]?.[0] || 'repositoryQuality';

    // Compile default roadmap steps based on the weakest category
    let fallbackRoadmap = [];
    if (weakestCategory === 'documentationQuality') {
      fallbackRoadmap = [
        {
          phase: "Phase 1: Standardization",
          topic: "Implement Core Documentation",
          priority: "High",
          estimatedTime: "1 week",
          expectedScoreImprovement: 25,
          actionableSteps: ["Add README.md containing installation, usage, and structure details to all top projects.", "Apply an open-source LICENSE to all repositories."],
          suggestedResources: ["GitHub Guide on Open Source Licensing", "Awesome-README Templates"]
        },
        {
          phase: "Phase 2: Collaboration",
          topic: "Establish Community Standards",
          priority: "Medium",
          estimatedTime: "1 week",
          expectedScoreImprovement: 15,
          actionableSteps: ["Create a CONTRIBUTING.md file detailing contribution guidelines.", "Create a CODE_OF_CONDUCT.md file."],
          suggestedResources: ["Contributor Covenant Code of Conduct Generator", "Open Source Guides (opensources.guide)"]
        },
        {
          phase: "Phase 3: Maintenance",
          topic: "Continuous Documentation Reviews",
          priority: "Low",
          estimatedTime: "Ongoing",
          expectedScoreImprovement: 10,
          actionableSteps: ["Conduct documentation audits before finalizing feature merges.", "Add inline docstrings explaining complex code pathways."],
          suggestedResources: ["JSDoc / Sphinx Documentation standard guides"]
        }
      ];
    } else if (weakestCategory === 'technologyDiversity') {
      fallbackRoadmap = [
        {
          phase: "Phase 1: Cognitive Expansion",
          topic: "Acquire secondary programming paradigm",
          priority: "High",
          estimatedTime: "3-4 weeks",
          expectedScoreImprovement: 20,
          actionableSteps: ["Learn a secondary backend or systems language such as Go or Rust.", "Build a basic CLI tool displaying command options in the target language."],
          suggestedResources: ["A Tour of Go (tour.golang.org)", "The Rust Programming Language Book"]
        },
        {
          phase: "Phase 2: Ecosystem Adaptation",
          topic: "Build-System Integrations",
          priority: "Medium",
          estimatedTime: "2 weeks",
          expectedScoreImprovement: 15,
          actionableSteps: ["Incorporate standard build files (e.g. go.mod or Cargo.toml) into your portfolio.", "Configure package managers and task runners."],
          suggestedResources: ["Go Modules Guide", "Cargo Book"]
        },
        {
          phase: "Phase 3: Framework Integration",
          topic: "Framework Deployments",
          priority: "Low",
          estimatedTime: "2 weeks",
          expectedScoreImprovement: 15,
          actionableSteps: ["Refactor your script or tool into a structured web api using standard frameworks (e.g., Express or Gin).", "Incorporate automated testing in the new stack."],
          suggestedResources: ["Express.js Documentation", "Modern Frontend/Backend web frameworks guides"]
        }
      ];
    } else {
      // Default / Repository quality roadmap
      fallbackRoadmap = [
        {
          phase: "Phase 1: Code Volume and Originality",
          topic: "Architect Core Original Codebases",
          priority: "High",
          estimatedTime: "2-3 weeks",
          expectedScoreImprovement: 25,
          actionableSteps: ["Focus on creating fresh, original repositories rather than just forking external projects.", "Develop a medium-sized project (minimum size 2MB) featuring clean architecture."],
          suggestedResources: ["Clean Architecture: A Craftsman's Guide by Robert C. Martin", "GitHub repositories on design patterns"]
        },
        {
          phase: "Phase 2: Issue and Code Quality Hygiene",
          topic: "Manage Issue Trackers & Refactoring",
          priority: "Medium",
          estimatedTime: "1-2 weeks",
          expectedScoreImprovement: 15,
          actionableSteps: ["Perform clean sweeps of your repository issue boards by closing resolved issues.", "Refactor large, redundant functions into single-responsibility helpers."],
          suggestedResources: ["Refactoring: Improving the Design of Existing Code by Martin Fowler"]
        },
        {
          phase: "Phase 3: Active Streamlining",
          topic: "Active Commit Contributions",
          priority: "Low",
          estimatedTime: "Ongoing",
          expectedScoreImprovement: 10,
          actionableSteps: ["Push regular updates to your codebases in smaller, frequent commits.", "Set up branch protection rules on your primary repositories."],
          suggestedResources: ["Git Branching and Workflows guide"]
        }
      ];
    }

    const fallbackSuggestions = reportData.suggestions.length > 0
      ? reportData.suggestions
      : ["Add a comprehensive README.md file.", "Learn a secondary stack language like Go or Rust.", "Add live deployment homepage URLs to your GitHub projects."];

    return {
      aiSummary: `Portfolio analysis compiled for developer: @${username}. The portfolio exhibits solid core capabilities, showing particular strength in categories where score results are optimal. Focus should be directed to categories needing structured improvement, primarily addressing the weaknesses outlined below.`,
      strengths: [
        "Identified solid foundation across their core GitHub repositories.",
        "Demonstrates active portfolio history containing original codebases."
      ],
      weaknesses: [
        `Deterministic analytics indicates room for improvement in ${weakestCategory.replace(/([A-Z])/g, ' $1').toLowerCase()}.`,
        "Portfolio exhibits uneven distribution across code documentation and ecosystem standardization."
      ],
      resumeReadinessStars: Math.max(1, Math.min(Math.round(reportData.developerScore / 20), 5)),
      resumeBreakdown: {
        bulletPoints: [
          `Engineered and maintained multiple original repositories, contributing to a total developer score of ${reportData.developerScore}.`,
          "Organized and structured project source code using standard repository layouts to showcase clean engineering.",
          "Maintained portfolio active commit streaks and push updates to primary target codebases."
        ],
        careerInsights: `The portfolio is well-positioned for junior to mid-level engineering roles. Focusing on resolving the identified category deficiencies will enhance developer marketability and showcase architectural readiness.`
      },
      learningRoadmap: {
        milestones: fallbackRoadmap,
      },
      interviewPrep: {
        likelyQuestions: [
          `Can you describe the architectural decisions and layout structuring in your primary repositories?`,
          `How do you organize your developer workflow, particularly regarding Git branching and commit frequency?`
        ],
        talkingPoints: [
          "Explain your design decisions and code organization in your largest projects.",
          "Describe how you structure your documentation and code comments to facilitate team onboarding."
        ],
        conceptsToReview: [
          "Object-Oriented Design patterns and SOLID principles.",
          "Git workflow best practices, merge conflicts resolution, and pull requests."
        ]
      }
    };
  }
}

export default new AiService();

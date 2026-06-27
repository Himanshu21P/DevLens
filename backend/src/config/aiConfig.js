/**
 * Centralized AI Configuration.
 * Houses prompt versions, model definitions, cache policies, and prompt templates.
 */
export const aiConfig = {
  VERSION: '1.0.0',
  DEFAULT_PROVIDER: 'gemini',
  DEFAULT_MODEL: 'gemini-1.5-flash',
  
  // Cache TTL for AI insights (24 Hours in seconds)
  CACHE_TTL: 86400,

  // Prompt templates and structural guidelines
  SYSTEM_INSTRUCTION: `You are an expert technical recruiter, engineering manager, and career coach. 
Your task is to analyze a developer's GitHub portfolio data, including their deterministic quality scores and repository metrics, and generate highly professional, qualitative, and actionable career insights.

CRITICAL RULES:
1. You must respond strictly in JSON format. Do not wrap the JSON in markdown blocks or HTML.
2. Maintain complete consistency with the developer's deterministic scores. NEVER invent, modify, or mention numerical scores that differ from the scores provided in the context.
3. Recommendations must be highly specific, actionable, and unique. Avoid generic advice or duplicate suggestions.
4. If a developer has a high score in a category (>=80), do not criticize that category in the weaknesses. Focus only on actual areas of improvement.
5. All suggestions must include expected impact and implementation difficulty.`,

  // Standard JSON schema template provided to the model
  RESPONSE_JSON_TEMPLATE: {
    aiSummary: "A professional, concise 3-4 sentence summary of the developer's portfolio strengths, stack focus, and overall quality.",
    strengths: [
      "Specific strength 1 (e.g., Strong tech diversity with active React and Go projects)",
      "Specific strength 2"
    ],
    weaknesses: [
      "Specific area of improvement 1 (e.g., Low documentation coverage across core repositories)",
      "Specific area of improvement 2"
    ],
    resumeReadinessStars: 4, // 1 to 5 star rating
    resumeBreakdown: {
      bulletPoints: [
        "Actionable resume achievement bullet-point 1 (e.g., Designed and built a Go backend engine featuring 80% test coverage)",
        "Actionable resume achievement bullet-point 2",
        "Actionable resume achievement bullet-point 3"
      ],
      careerInsights: "Marketability analysis, recommended roles, and stack alignment advice."
    },
    learningRoadmap: {
      milestones: [
        {
          phase: "Phase 1: Foundation",
          topic: "Specific topic to learn/improve",
          priority: "High", // "High" | "Medium" | "Low"
          estimatedTime: "2-3 weeks",
          expectedScoreImprovement: 15, // Expected increase in deterministic score
          actionableSteps: [
            "Actionable step 1",
            "Actionable step 2"
          ],
          suggestedResources: [
            "Recommended learning resource 1 (e.g., Official Rust Book)",
            "Recommended learning resource 2"
          ]
        }
      ]
    },
    interviewPrep: {
      likelyQuestions: [
        "Likely technical interview question based on their portfolio focus",
        "Likely architectural interview question"
      ],
      talkingPoints: [
        "Portfolio talking point 1 (e.g., How you structured the repository layout in project-X)",
        "Portfolio talking point 2"
      ],
      conceptsToReview: [
        "Core concept to review (e.g., Redis caching strategies and TTL policies)",
        "Core concept 2"
      ]
    }
  }
};

import { scoringConfig } from '../../config/scoringConfig.js';

class TechnologyDiversityService {
  /**
   * Calculates the Technology Diversity score.
   * 
   * METHODOLOGY:
   * 1. Language Count (50%): Evaluates the number of distinct languages with a significant
   *    presence (>= 1% of total code bytes) in the developer's repositories.
   *    A single language gets a base of 30, scaling up to 50 for 4+ languages.
   * 2. Ecosystem Diversity (50%): Assesses familiarity with different build systems and
   *    runtimes (Node.js, Rust, Go, Python, Ruby) by detecting their configuration files.
   *    This demonstrates real-world stack versatility beyond syntax knowledge.
   * 
   * @param {object} data - Normalized DeveloperAnalysisData model
   * @returns {object} Score, factor breakdown, and actionable improvements
   */
  calculateScore(data) {
    const config = scoringConfig.TECHNOLOGY_DIVERSITY;
    const { aggregateMetrics, topRepositories } = data;
    const topRepos = topRepositories || [];
    const langsPercentage = aggregateMetrics?.languagesPercentage || {};

    // 1. Filter out languages with 0% or empty
    const distinctLanguages = Object.keys(langsPercentage).filter(lang => langsPercentage[lang] > 0);
    const langCount = distinctLanguages.length;

    // --- Factor 1: Language Count Scaling (Max 50 points) ---
    let languageScore = 0;
    if (langCount > 0) {
      const scalePoints = config.LANGUAGE_COUNT_SCALING[langCount] || config.LANGUAGE_COUNT_SCALING[4];
      languageScore = Math.min(scalePoints, config.FACTOR_WEIGHTS.languageCount);
    }

    // --- Factor 2: Ecosystem Diversity (Max 50 points) ---
    // Accumulate points for configuration files detected in top repositories
    let ecosystemPoints = 0;
    const detectedFiles = new Set();
    const frameworks = new Set();

    topRepos.forEach((repo) => {
      const configFiles = repo.ecosystem?.configFiles || [];
      const repoFrameworks = repo.ecosystem?.frameworksDetected || [];

      configFiles.forEach(file => detectedFiles.add(file));
      repoFrameworks.forEach(fw => frameworks.add(fw));
    });

    if (detectedFiles.has('package.json')) ecosystemPoints += config.ECOSYSTEM_POINTS.packageJson;
    if (detectedFiles.has('requirements.txt')) ecosystemPoints += config.ECOSYSTEM_POINTS.requirementsTxt;
    if (detectedFiles.has('Cargo.toml')) ecosystemPoints += config.ECOSYSTEM_POINTS.cargoToml;
    if (detectedFiles.has('go.mod')) ecosystemPoints += config.ECOSYSTEM_POINTS.goMod;
    if (detectedFiles.has('Gemfile')) ecosystemPoints += config.ECOSYSTEM_POINTS.gemfile;

    const ecosystemScore = Math.min(ecosystemPoints, config.FACTOR_WEIGHTS.ecosystemDiversity);

    // Total Score
    const totalScore = languageScore + ecosystemScore;

    // Actionable Improvements
    const improvements = [];
    if (langCount === 1) {
      improvements.push('Learn a secondary programming language (e.g., Python, Rust, Go, or TypeScript) to expand your cognitive problem-solving toolset.');
    }
    if (ecosystemScore < 30) {
      improvements.push('Explore and build projects using different runtime environments and package managers (e.g., building a backend in Node/Python/Go/Rust).');
    }
    if (frameworks.size === 0 && langCount > 0) {
      improvements.push('Integrate popular modern frameworks (e.g., React, Express, NestJS, Django) into your projects to show application development readiness.');
    }

    // Framework list string for description
    const frameworksList = Array.from(frameworks);

    return {
      score: Math.max(0, Math.min(totalScore, config.MAX_SCORE)),
      factors: {
        languageCount: {
          score: languageScore,
          maxScore: config.FACTOR_WEIGHTS.languageCount,
          description: langCount > 0
            ? `Detected ${langCount} distinct programming language(s): ${distinctLanguages.join(', ')}.`
            : 'No programming languages detected.',
        },
        ecosystemDiversity: {
          score: ecosystemScore,
          maxScore: config.FACTOR_WEIGHTS.ecosystemDiversity,
          description: detectedFiles.size > 0
            ? `Detected ecosystem files: ${Array.from(detectedFiles).join(', ')}.${frameworksList.length > 0 ? ` Frameworks: ${frameworksList.join(', ')}.` : ''}`
            : 'No standard project ecosystem files detected.',
        },
      },
      improvements,
    };
  }
}

export default new TechnologyDiversityService();

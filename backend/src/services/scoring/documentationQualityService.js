import { scoringConfig } from '../../config/scoringConfig.js';

class DocumentationQualityService {
  /**
   * Calculates the Documentation Quality score.
   * 
   * METHODOLOGY:
   * 1. README Presence (40%): Checks what ratio of top original repositories contain a README file.
   * 2. README Length/Completeness (30%): Analyzes the size of the READMEs.
   *    Very short READMEs get low points; detailed guides (>2KB or >6KB) get maximum points.
   * 3. LICENSE Presence (15%): Verifies if a LICENSE file is provided.
   * 4. Community Standards (15%): Looks for CONTRIBUTING.md and CODE_OF_CONDUCT.md.
   * 
   * @param {object} data - Normalized DeveloperAnalysisData model
   * @returns {object} Score, factor breakdown, and actionable improvements
   */
  calculateScore(data) {
    const config = scoringConfig.DOCUMENTATION_QUALITY;
    const { topRepositories } = data;
    const topRepos = topRepositories || [];
    const topCount = topRepos.length;

    // Handle empty portfolios
    if (topCount === 0) {
      return {
        score: 0,
        factors: {
          readmePresence: { score: 0, maxScore: config.FACTOR_WEIGHTS.readmePresence, description: 'No repositories to analyze.' },
          readmeLength: { score: 0, maxScore: config.FACTOR_WEIGHTS.readmeLength, description: 'No repositories to analyze.' },
          licensePresence: { score: 0, maxScore: config.FACTOR_WEIGHTS.licensePresence, description: 'No repositories to analyze.' },
          communityStandards: { score: 0, maxScore: config.FACTOR_WEIGHTS.communityStandards, description: 'No repositories to analyze.' },
        },
        improvements: ['Add a detailed README.md and LICENSE file to your repositories.'],
      };
    }

    // --- Factor 1: README Presence (Max 40 points) ---
    const readmeCount = topRepos.filter(r => r.documentation?.readme?.exists).length;
    const readmePresenceScore = Math.round((readmeCount / topCount) * config.FACTOR_WEIGHTS.readmePresence);

    // --- Factor 2: README Length / Completeness (Max 30 points) ---
    // Evaluates the size/depth of README files
    let totalReadmeLengthScore = 0;
    topRepos.forEach((repo) => {
      const size = repo.documentation?.readme?.size || 0;
      if (size >= config.README_LENGTH_LIMITS.LONG) {
        totalReadmeLengthScore += 30;
      } else if (size >= config.README_LENGTH_LIMITS.MEDIUM) {
        totalReadmeLengthScore += 20;
      } else if (size >= config.README_LENGTH_LIMITS.SHORT) {
        totalReadmeLengthScore += 10;
      }
    });
    const readmeLengthScore = Math.round(totalReadmeLengthScore / topCount);

    // --- Factor 3: LICENSE Presence (Max 15 points) ---
    const licenseCount = topRepos.filter(r => r.documentation?.license?.exists).length;
    const licensePresenceScore = Math.round((licenseCount / topCount) * config.FACTOR_WEIGHTS.licensePresence);

    // --- Factor 4: Community Standards (Max 15 points) ---
    // Checks if CONTRIBUTING.md or CODE_OF_CONDUCT.md exist in ANY of the top repositories
    const hasContributing = topRepos.some(r => r.documentation?.contributing?.exists);
    const hasCoC = topRepos.some(r => r.documentation?.codeOfConduct?.exists);

    let communityScore = 0;
    if (hasContributing) communityScore += 8; // 8 points out of 15
    if (hasCoC) communityScore += 7;          // 7 points out of 15

    // Total Score
    const totalScore = readmePresenceScore + readmeLengthScore + licensePresenceScore + communityScore;

    // Actionable Improvements
    const improvements = [];
    if (readmeCount < topCount) {
      improvements.push('Add a README.md file to all of your core repositories.');
    }
    
    // Check if average README size is low
    const averageSize = topRepos.reduce((acc, r) => acc + (r.documentation?.readme?.size || 0), 0) / topCount;
    if (averageSize < config.README_LENGTH_LIMITS.MEDIUM) {
      improvements.push('Expand your repository READMEs to include installation guides, usage examples, and architecture summaries.');
    }
    
    if (licenseCount < topCount) {
      improvements.push('Add an open-source LICENSE (e.g., MIT, Apache 2.0) to your repositories to define usage terms.');
    }
    if (!hasContributing) {
      improvements.push('Create a CONTRIBUTING.md guide in your primary project to encourage open-source contributions.');
    }

    return {
      score: Math.max(0, Math.min(totalScore, config.MAX_SCORE)),
      factors: {
        readmePresence: {
          score: readmePresenceScore,
          maxScore: config.FACTOR_WEIGHTS.readmePresence,
          description: `${readmeCount} out of ${topCount} repositories contain a README.md.`,
        },
        readmeLength: {
          score: readmeLengthScore,
          maxScore: config.FACTOR_WEIGHTS.readmeLength,
          description: `Average README size is ${Math.round(averageSize)} characters.`,
        },
        licensePresence: {
          score: licensePresenceScore,
          maxScore: config.FACTOR_WEIGHTS.licensePresence,
          description: `${licenseCount} out of ${topCount} repositories contain an open-source LICENSE.`,
        },
        communityStandards: {
          score: communityScore,
          maxScore: config.FACTOR_WEIGHTS.communityStandards,
          description: `Found CONTRIBUTING.md: ${hasContributing ? 'Yes' : 'No'}, CODE_OF_CONDUCT.md: ${hasCoC ? 'Yes' : 'No'}.`,
        },
      },
      improvements,
    };
  }
}

export default new DocumentationQualityService();

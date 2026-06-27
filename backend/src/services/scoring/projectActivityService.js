import { scoringConfig } from '../../config/scoringConfig.js';

class ProjectActivityService {
  /**
   * Calculates the Project Activity score.
   * 
   * METHODOLOGY:
   * 1. Push Recency (50%): Evaluates how recently the developer has pushed code.
   *    We calculate the days since the last push for each original repository, map it to a bracketed
   *    score (7 days = 50 pts, 30 days = 40 pts, 90 days = 30 pts, 180 days = 15 pts), and average
   *    these scores across all original repositories. This ensures that developers with multiple active
   *    projects are rewarded, while those with stale codebases receive lower scores.
   * 2. Commit Frequency (50%): Evaluates the total commit volume in the past year.
   *    We sum public and private commits across analyzed projects and map them to brackets
   *    (>=100 commits = 50 pts, >=25 commits = 35 pts, >=5 commits = 15 pts).
   * 
   * @param {object} data - Normalized DeveloperAnalysisData model
   * @returns {object} Score, factor breakdown, and actionable improvements
   */
  calculateScore(data) {
    const config = scoringConfig.PROJECT_ACTIVITY;
    const { repositories, aggregateMetrics } = data;
    const allRepos = repositories?.all || [];
    const totalCount = repositories?.totalCount || 0;
    const originalCount = repositories?.originalCount || 0;

    // Handle empty portfolios (0 repositories)
    if (totalCount === 0) {
      return {
        score: 0,
        factors: {
          pushRecency: { score: 0, maxScore: config.FACTOR_WEIGHTS.pushRecency, description: 'No repositories detected.' },
          commitFrequency: { score: 0, maxScore: config.FACTOR_WEIGHTS.commitFrequency, description: 'No repositories detected.' },
        },
        improvements: ['Commit and push code to GitHub to start building an active development history.'],
      };
    }

    // --- Factor 1: Push Recency (Max 50 points) ---
    // We evaluate original repositories. If none exist, we fall back to all repositories (including forks)
    const reposToEvaluate = originalCount > 0 ? allRepos.filter(r => !r.isFork) : allRepos;
    const evalCount = reposToEvaluate.length;
    
    let totalPushRecencyScore = 0;
    const now = Date.now();

    reposToEvaluate.forEach((repo) => {
      if (!repo.pushedAt) return;
      
      const pushedTime = new Date(repo.pushedAt).getTime();
      const diffMs = now - pushedTime;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      let repoScore = 0;
      if (diffDays <= 7) {
        repoScore = config.PUSH_RECENCY_SCORES[7];
      } else if (diffDays <= 30) {
        repoScore = config.PUSH_RECENCY_SCORES[30];
      } else if (diffDays <= 90) {
        repoScore = config.PUSH_RECENCY_SCORES[90];
      } else if (diffDays <= 180) {
        repoScore = config.PUSH_RECENCY_SCORES[180];
      }

      totalPushRecencyScore += repoScore;
    });

    const pushRecencyScore = evalCount > 0 ? Math.round(totalPushRecencyScore / evalCount) : 0;

    // --- Factor 2: Commit Frequency (Max 50 points) ---
    // Sum public and private commits in the past year from aggregate metrics
    const publicCommits = aggregateMetrics?.totalCommitsPastYear || 0;
    const privateCommits = aggregateMetrics?.privateCommitsCount || 0;
    const totalCommits = publicCommits + privateCommits;

    let commitScore = 0;
    const limits = config.COMMIT_FREQUENCY_LIMITS;

    if (totalCommits >= limits.HIGH) {
      commitScore = 50;
    } else if (totalCommits >= limits.MEDIUM) {
      commitScore = 35;
    } else if (totalCommits >= limits.LOW) {
      commitScore = 15;
    }

    // Total Score
    const totalScore = pushRecencyScore + commitScore;

    // Actionable Improvements
    const improvements = [];
    if (pushRecencyScore < 30) {
      improvements.push('Push updates to your repositories more frequently to showcase active development.');
    }
    if (totalCommits < limits.MEDIUM) {
      improvements.push('Increase your commit volume by breaking down features into smaller, daily contributions.');
    }
    if (totalCommits === 0) {
      improvements.push('Make your first commit in your repositories to demonstrate active coding.');
    }

    // Calculate time elapsed for the most recent push across evaluated repositories for the description
    let mostRecentPushText = 'No recent pushes detected.';
    if (reposToEvaluate.length > 0) {
      const mostRecentPushedRepo = [...reposToEvaluate].sort(
        (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
      )[0];
      if (mostRecentPushedRepo && mostRecentPushedRepo.pushedAt) {
        const days = Math.floor((now - new Date(mostRecentPushedRepo.pushedAt).getTime()) / (1000 * 60 * 60 * 24));
        mostRecentPushText = days === 0 ? 'Latest push was today.' : `Latest push was ${days} day(s) ago.`;
      }
    }

    return {
      score: Math.max(0, Math.min(totalScore, config.MAX_SCORE)),
      factors: {
        pushRecency: {
          score: pushRecencyScore,
          maxScore: config.FACTOR_WEIGHTS.pushRecency,
          description: `${mostRecentPushText} Average push recency score: ${pushRecencyScore}/${config.FACTOR_WEIGHTS.pushRecency} points.`,
        },
        commitFrequency: {
          score: commitScore,
          maxScore: config.FACTOR_WEIGHTS.commitFrequency,
          description: `Recorded ${totalCommits} commit(s) in the past year (${publicCommits} public, ${privateCommits} private).`,
        },
      },
      improvements,
    };
  }
}

export default new ProjectActivityService();

import BaseRepositoryAdapter from './repositoryAdapter.js';
import githubClient from '../services/githubClient.js';
import logger from '../utils/logger.js';
import { getCache, setCache } from '../config/redis.js';

class GithubAdapter extends BaseRepositoryAdapter {
  /**
   * Helper to wrap results in a standardized response containing cache metadata.
   */
  _wrapResponse(data, isCached, cachedAt = null, expiresAt = null) {
    const meta = {
      cached: isCached,
      provider: 'github',
      cachedAt: cachedAt || new Date().toISOString(),
    };
    if (expiresAt) {
      meta.expiresAt = expiresAt;
    }
    
    // Attach cache metadata as a non-enumerable or specific hidden property
    // to avoid polluting JSON database models while keeping it available
    return {
      data,
      _cacheMetadata: meta,
    };
  }

  /**
   * Safe execution wrapper to resolve caching.
   * If Redis is down or fails, it degrades gracefully and fetches from API.
   */
  async _cachedRequest(cacheKey, ttlInSeconds, apiCall) {
    try {
      const cachedEnvelope = await getCache(cacheKey);
      if (cachedEnvelope && cachedEnvelope.data !== undefined) {
        logger.debug(`Cache HIT: Key ${cacheKey}`);
        return this._wrapResponse(
          cachedEnvelope.data,
          true,
          cachedEnvelope.cachedAt,
          cachedEnvelope.expiresAt
        );
      }
    } catch (err) {
      logger.warn(`Redis cache resolution failed for key ${cacheKey}: ${err.message}. Degrading to direct fetch.`);
    }

    // Cache Miss or Redis failure: Fetch fresh data
    logger.debug(`Cache MISS/BYPASS: Key ${cacheKey}`);
    const data = await apiCall();

    const cachedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlInSeconds * 1000).toISOString();
    const envelope = {
      data,
      cachedAt,
      expiresAt,
      provider: 'github',
    };

    try {
      await setCache(cacheKey, envelope, ttlInSeconds);
    } catch (err) {
      logger.warn(`Failed to write to Redis cache for key ${cacheKey}: ${err.message}`);
    }

    return this._wrapResponse(data, false, cachedAt, expiresAt);
  }

  /**
   * Fetches and standardizes public/private user profile details.
   */
  async getUserProfile(username, token = null) {
    const cacheKey = `github:profile:${username}`;
    const ttl = 86400; // 24 Hours

    return this._cachedRequest(cacheKey, ttl, async () => {
      const profile = await githubClient.request(`/users/${username}`, token);
      return {
        provider: 'github',
        id: String(profile.id),
        username: profile.login,
        displayName: profile.name || null,
        avatarUrl: profile.avatar_url || null,
        bio: profile.bio || null,
        publicRepos: profile.public_repos || 0,
        followers: profile.followers || 0,
        following: profile.following || 0,
        company: profile.company || null,
        location: profile.location || null,
        blog: profile.blog || null,
        twitter: profile.twitter_username || null,
      };
    });
  }

  /**
   * Fetches and standardizes repositories.
   * Enforces strict private repository sanitization at the boundary.
   */
  async getUserRepositories(username, token = null) {
    const cacheKey = `github:repos:${username}:${token ? 'auth' : 'guest'}`;
    const ttl = 21600; // 6 Hours

    return this._cachedRequest(cacheKey, ttl, async () => {
      // Fetch repositories (GitHub API paginates; for MVP we fetch up to 100 repos)
      // If token is provided, this list includes private repositories the token has access to
      const repos = await githubClient.request(`/users/${username}/repos?per_page=100`, token)
        .catch(async (err) => {
          // If public repos lookup fails, check if the token is for the user themselves and fetch /user/repos
          if (token) {
            logger.info(`Fallback to authenticated user repositories fetch for ${username}`);
            return githubClient.request('/user/repos?per_page=100&visibility=all', token);
          }
          throw err;
        });

      if (!Array.isArray(repos)) {
        return [];
      }

      return repos.map((repo) => {
        const isPrivate = !!repo.private;

        return {
          id: String(repo.id),
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || null,
          isFork: !!repo.fork,
          isPrivate,
          isArchived: !!repo.archived,
          stars: repo.stargazers_count || 0,
          forks: repo.forks_count || 0,
          openIssues: repo.open_issues_count || 0,
          size: repo.size || 0, // Size in KB is safe to accumulate
          primaryLanguage: repo.language || null,
          homepage: repo.homepage || null,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          pushedAt: repo.pushed_at,
          defaultBranch: repo.default_branch || 'main',
          htmlUrl: repo.html_url || null,
        };
      });
    });
  }

  /**
   * Fetches language byte breakdown for a repository.
   * Handles failures gracefully.
   */
  async getRepositoryLanguages(repoFullName, token = null) {
    // For private repositories, the repoFullName is sanitized to `private/:id` in our adapter.
    // However, to fetch from the actual GitHub API, we need the real name.
    // Since the Data Collector resolves the actual API query parameters, we ensure
    // we only request languages for real, unsanitized repository full names.
    const cacheKey = `github:langs:${repoFullName}`;
    const ttl = 43200; // 12 Hours

    return this._cachedRequest(cacheKey, ttl, async () => {
      try {
        const languages = await githubClient.request(`/repos/${repoFullName}/languages`, token);
        return languages && typeof languages === 'object' ? languages : {};
      } catch (err) {
        logger.warn(`Failed to fetch languages for repository ${repoFullName}: ${err.message}. Degrading to empty language breakdown.`);
        return {};
      }
    });
  }

  /**
   * Fetches user's commit activity in a specific repository.
   * Handles partial failures and rate-limit blocks gracefully.
   */
  async getRepositoryCommitActivity(repoFullName, username, token = null) {
    const cacheKey = `github:commits:${repoFullName}:${username}`;
    const ttl = 10800; // 3 Hours

    return this._cachedRequest(cacheKey, ttl, async () => {
      try {
        // Query the list of commits in the default branch authored by this user (limit to 100 for safety)
        const commits = await githubClient.request(
          `/repos/${repoFullName}/commits?author=${username}&per_page=100`,
          token
        );

        if (!Array.isArray(commits)) {
          return { weeklyCommits: [], totalCommits: 0 };
        }

        // Aggregate weekly frequency for the last year (52 weeks)
        const weeklyCommits = new Array(52).fill(0);
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

        commits.forEach((c) => {
          const dateStr = c.commit?.author?.date;
          if (dateStr) {
            const timestamp = new Date(dateStr).getTime();
            if (timestamp > oneYearAgo) {
              const weeksAgo = Math.floor((Date.now() - timestamp) / (7 * 24 * 60 * 60 * 1000));
              if (weeksAgo >= 0 && weeksAgo < 52) {
                weeklyCommits[51 - weeksAgo] += 1; // Map chronologically (index 0 = oldest, 51 = newest)
              }
            }
          }
        });

        return {
          weeklyCommits,
          totalCommits: commits.length,
        };
      } catch (err) {
        logger.warn(`Failed to fetch commit activity for repository ${repoFullName} / ${username}: ${err.message}. Degrading to zero activity.`);
        return {
          weeklyCommits: new Array(52).fill(0),
          totalCommits: 0,
        };
      }
    });
  }

  /**
   * Checks if a file exists in the repository.
   * Returns details like name, size, or null if missing.
   */
  async checkFileExists(repoFullName, path, token = null) {
    const cacheKey = `github:file:${repoFullName}:${path}`;
    const ttl = 43200; // 12 Hours

    return this._cachedRequest(cacheKey, ttl, async () => {
      try {
        const metadata = await githubClient.request(`/repos/${repoFullName}/contents/${path}`, token);
        if (metadata && !Array.isArray(metadata)) {
          return {
            name: metadata.name,
            size: metadata.size || 0,
            path: metadata.path,
          };
        }
        return null;
      } catch (err) {
        // 404 is a standard response indicating the file doesn't exist; log other anomalies
        if (err.statusCode !== 404) {
          logger.warn(`Failed to check file existence for ${repoFullName}/${path}: ${err.message}`);
        }
        return null;
      }
    });
  }

  /**
   * Fetches the raw content of a text file from the repository (e.g. for parsing ecosystems).
   * Decodes base64 content returned by the GitHub API.
   */
  async getFileContent(repoFullName, path, token = null) {
    try {
      const fileData = await githubClient.request(`/repos/${repoFullName}/contents/${path}`, token);
      if (fileData && fileData.content && fileData.encoding === 'base64') {
        // Decode base64 content safely
        return Buffer.from(fileData.content, 'base64').toString('utf8');
      }
      return null;
    } catch (err) {
      if (err.statusCode !== 404) {
        logger.warn(`Failed to fetch file content for ${repoFullName}/${path}: ${err.message}`);
      }
      return null;
    }
  }
}

export default new GithubAdapter();

import axios from 'axios';
import logger from '../utils/logger.js';
import { getCache, setCache } from '../config/redis.js';

const GITHUB_API_BASE = 'https://api.github.com';

class GithubClient {
  /**
   * Helper to perform authenticated HTTP requests to the GitHub API.
   * Incorporates rate limit auditing, error handling, and future retry/pagination hooks.
   */
  async request(path, token = null, options = {}) {
    const url = `${GITHUB_API_BASE}${path}`;
    const headers = {
      'User-Agent': 'DevLens-App',
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    try {
      const response = await axios({
        method: options.method || 'GET',
        url,
        headers,
        data: options.data,
        params: options.params,
        timeout: 8000, // 8-second timeout
      });

      // Audit Rate Limits
      this.auditRateLimits(response.headers);

      return response.data;
    } catch (err) {
      this.handleApiError(err, path);
    }
  }

  /**
   * Reads rate limit headers and logs warnings if capacity is running low.
   */
  auditRateLimits(headers) {
    const limit = headers['x-ratelimit-limit'];
    const remaining = headers['x-ratelimit-remaining'];
    const resetTime = headers['x-ratelimit-reset'];

    if (remaining !== undefined && limit !== undefined) {
      const remainingVal = parseInt(remaining, 10);
      const limitVal = parseInt(limit, 10);
      
      // Log warning if remaining requests drop below 10%
      if (remainingVal < limitVal * 0.1) {
        const resetDate = new Date(parseInt(resetTime, 10) * 1000).toLocaleTimeString();
        logger.warn(
          `GitHub API Rate Limit warning! Remaining: ${remainingVal}/${limitVal}. Resets at: ${resetDate}`
        );
      }
    }
  }

  /**
   * Translates raw HTTP errors into meaningful, domain-specific errors.
   */
  handleApiError(err, path) {
    const status = err.response?.status;
    const errorMessage = err.response?.data?.message || err.message;

    logger.error(`GitHub API Request Failed [${path}]: ${errorMessage} (Status: ${status || 'TIMEOUT'})`);

    const error = new Error();

    if (status === 401) {
      error.message = 'GitHub access token is invalid or has expired.';
      error.statusCode = 401;
      error.name = 'GithubUnauthorizedError';
    } else if (status === 403) {
      if (err.response?.headers['x-ratelimit-remaining'] === '0') {
        error.message = 'GitHub API rate limit exceeded. Please try again later.';
        error.statusCode = 403;
        error.name = 'GithubRateLimitError';
      } else {
        error.message = 'Access to the requested GitHub resource is forbidden.';
        error.statusCode = 403;
        error.name = 'GithubForbiddenError';
      }
    } else if (status === 404) {
      error.message = 'The requested GitHub user or resource was not found.';
      error.statusCode = 404;
      error.name = 'GithubNotFoundError';
    } else {
      error.message = 'GitHub API is temporarily unavailable. Please try again later.';
      error.statusCode = status || 503;
      error.name = 'GithubApiError';
    }

    throw error;
  }

  /**
   * Fetches public user profile information (with caching).
   */
  async getUserProfile(username, token = null) {
    const cacheKey = `github:profile:${username}`;
    
    // Attempt to resolve from cache first if unauthenticated (saves rate limit)
    if (!token) {
      const cached = await getCache(cacheKey);
      if (cached) {
        logger.debug(`Resolved GitHub profile from Redis cache: ${username}`);
        return cached;
      }
    }

    const data = await this.request(`/users/${username}`, token);

    // Cache the result for 1 hour if fetched successfully
    if (!token) {
      await setCache(cacheKey, data, 3600);
    }

    return data;
  }

  /**
   * Fetches emails of the authenticated user (requires scope 'user:email').
   */
  async getUserEmails(token) {
    // Emails are highly sensitive and should never be cached
    return this.request('/user/emails', token);
  }
}

export default new GithubClient();

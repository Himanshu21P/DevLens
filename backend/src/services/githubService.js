import axios from 'axios';
import githubClient from './githubClient.js';
import logger from '../utils/logger.js';
import { decrypt } from '../utils/crypto.js';

class GithubService {
  /**
   * Exchanged a temporary GitHub OAuth code for a long-lived Access Token.
   */
  async getOAuthAccessToken(code) {
    const url = 'https://github.com/login/oauth/access_token';
    const data = {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    };

    try {
      const response = await axios.post(url, data, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DevLens-App',
        },
      });

      const { access_token, error, error_description } = response.data;

      if (error) {
        logger.error(`GitHub OAuth Exchange Error: ${error_description || error}`);
        const oauthError = new Error(error_description || 'OAuth authorization failed.');
        oauthError.statusCode = 400;
        oauthError.name = 'GithubOAuthError';
        throw oauthError;
      }

      return access_token;
    } catch (err) {
      if (err.name === 'GithubOAuthError') throw err;
      
      logger.error(`GitHub OAuth Token Request Failed: ${err.message}`);
      const error = new Error('Failed to exchange authorization code with GitHub.');
      error.statusCode = 502;
      error.name = 'GithubOAuthNetworkError';
      throw error;
    }
  }

  /**
   * Fetches the profile and primary email of an authenticated GitHub user.
   */
  async getAuthenticatedUserInfo(accessToken) {
    // 1. Fetch public profile
    const profile = await githubClient.request('/user', accessToken);

    // 2. Fetch email list to resolve the primary verified email (handles private emails)
    let primaryEmail = profile.email;

    if (!primaryEmail) {
      try {
        const emails = await githubClient.getUserEmails(accessToken);
        const primary = emails.find((email) => email.primary && email.verified);
        if (primary) {
          primaryEmail = primary.email;
        }
      } catch (err) {
        logger.warn(`Could not resolve primary email list for GitHub user: ${err.message}`);
      }
    }

    return {
      profile,
      primaryEmail,
    };
  }

  /**
   * Helper that decrypts a user's stored token and fetches their current GitHub profile.
   * Isolates the decryption to the service layer.
   */
  async getProfileForUser(user) {
    if (!user.githubAccessToken) {
      throw new Error('User does not have a linked GitHub account.');
    }

    // Decrypt token securely in-memory
    const decryptedToken = decrypt(user.githubAccessToken);
    
    // Fetch profile
    return githubClient.request('/user', decryptedToken);
  }

  /**
   * FUTURE ANALYTICS PREPARATION (Stubs ready for Phase 3 expansion)
   */
  async getUserRepositories(decryptedToken) {
    logger.info('GitHub Service stub called: getUserRepositories (Planned for Phase 3)');
    return githubClient.request('/user/repos?per_page=100&type=owner', decryptedToken);
  }

  async getRepositoryLanguages(repoFullName, decryptedToken) {
    logger.info(`GitHub Service stub called: getRepositoryLanguages for ${repoFullName}`);
    return githubClient.request(`/repos/${repoFullName}/languages`, decryptedToken);
  }

  async getUserPinnedRepositories(username) {
    logger.info(`GitHub Service stub called: getUserPinnedRepositories for ${username}`);
    // Pinned repositories are resolved via GitHub GraphQL API or scraping.
    return [];
  }
}

export default new GithubService();

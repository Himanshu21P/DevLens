/**
 * Base Repository Adapter Interface.
 * Defines the contract that all repository providers (GitHub, GitLab, Bitbucket) must implement.
 * Ensures the analytics layer remains provider-agnostic.
 */
class BaseRepositoryAdapter {
  /**
   * Fetches the standardized profile information for a user.
   * @param {string} username
   * @param {string} [token]
   * @returns {Promise<object>} Standardized profile data
   */
  async getUserProfile(username, token = null) {
    throw new Error('Method "getUserProfile" must be implemented.');
  }

  /**
   * Fetches the standardized list of repositories for a user.
   * @param {string} username
   * @param {string} [token]
   * @returns {Promise<Array<object>>} Standardized repositories list
   */
  async getUserRepositories(username, token = null) {
    throw new Error('Method "getUserRepositories" must be implemented.');
  }

  /**
   * Fetches the language breakdown for a specific repository.
   * @param {string} repoFullName - The full name of the repository (e.g., 'owner/repo')
   * @param {string} [token]
   * @returns {Promise<object>} Standardized language breakdown { [language]: bytes }
   */
  async getRepositoryLanguages(repoFullName, token = null) {
    throw new Error('Method "getRepositoryLanguages" must be implemented.');
  }

  /**
   * Fetches the commit activity of the target user in a specific repository.
   * @param {string} repoFullName
   * @param {string} username - The target user's username
   * @param {string} [token]
   * @returns {Promise<object>} Standardized commit activity details
   */
  async getRepositoryCommitActivity(repoFullName, username, token = null) {
    throw new Error('Method "getRepositoryCommitActivity" must be implemented.');
  }

  /**
   * Checks if a file exists in the repository and returns basic metadata.
   * @param {string} repoFullName
   * @param {string} path - File path in the repository (e.g., 'README.md')
   * @param {string} [token]
   * @returns {Promise<object|null>} Metadata if exists, null otherwise
   */
  async checkFileExists(repoFullName, path, token = null) {
    throw new Error('Method "checkFileExists" must be implemented.');
  }

  /**
   * Fetches the raw text content of a file from the repository.
   * @param {string} repoFullName
   * @param {string} path
   * @param {string} [token]
   * @returns {Promise<string|null>} Raw file content, null if missing or error
   */
  async getFileContent(repoFullName, path, token = null) {
    throw new Error('Method "getFileContent" must be implemented.');
  }
}

export default BaseRepositoryAdapter;

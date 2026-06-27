import prisma from '../config/db.js';
import logger from '../utils/logger.js';

class ProfileSyncService {
  /**
   * Synchronizes a user's GitHub metadata into the database User record.
   * @param {number} userId - Local database User ID
   * @param {object} githubProfile - Raw GitHub profile object returned by the API
   * @returns {Promise<object>} The updated User database record
   */
  async synchronizeProfile(userId, githubProfile) {
    const dataToUpdate = {
      githubId: String(githubProfile.id),
      githubUsername: githubProfile.login,
      avatarUrl: githubProfile.avatar_url,
      githubBio: githubProfile.bio || null,
      githubReposCount: githubProfile.public_repos || 0,
      githubFollowers: githubProfile.followers || 0,
      githubFollowing: githubProfile.following || 0,
      githubCompany: githubProfile.company || null,
      githubLocation: githubProfile.location || null,
      githubBlog: githubProfile.blog || null,
      githubTwitter: githubProfile.twitter_username || null,
    };

    // Safe Name Fallback: Update user name only if it's currently null or empty
    if (githubProfile.name) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      if (currentUser && !currentUser.name) {
        dataToUpdate.name = githubProfile.name;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    logger.info(
      `GitHub Profile Synchronized for User ID ${userId}: @${updatedUser.githubUsername} (Repos: ${updatedUser.githubReposCount})`
    );

    return updatedUser;
  }
}

export default new ProfileSyncService();

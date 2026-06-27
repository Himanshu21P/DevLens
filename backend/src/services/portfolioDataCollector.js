import githubAdapter from '../adapters/githubAdapter.js';
import logger from '../utils/logger.js';

class PortfolioDataCollector {
  /**
   * Collects, normalizes, and sanitizes all developer portfolio details into a unified
   * DeveloperAnalysisData model.
   * 
   * @param {string} username - The target developer's username
   * @param {string} [token] - Optional decrypted access token
   * @param {object} [adapter] - Optional adapter instance (defaults to githubAdapter)
   * @returns {Promise<object>} Standardized DeveloperAnalysisData model
   */
  async collectPortfolioData(username, token = null, adapter = githubAdapter) {
    logger.info(`Starting portfolio data collection for user: ${username} (Authenticated: ${!!token})`);

    // 1. Fetch Profile and Repository List Concurrently
    const [profileResult, reposResult] = await Promise.all([
      adapter.getUserProfile(username, token),
      adapter.getUserRepositories(username, token),
    ]);

    const profile = profileResult.data;
    const allRepos = reposResult.data || [];

    // Compile Cache Metadata from primary requests
    const cacheMetadata = {
      cached: profileResult._cacheMetadata.cached && reposResult._cacheMetadata.cached,
      provider: profileResult._cacheMetadata.provider,
      profileCachedAt: profileResult._cacheMetadata.cachedAt,
      reposCachedAt: reposResult._cacheMetadata.cachedAt,
      profileExpiresAt: profileResult._cacheMetadata.expiresAt || null,
      reposExpiresAt: reposResult._cacheMetadata.expiresAt || null,
    };

    // Calculate basic counts
    const totalCount = allRepos.length;
    const publicCount = allRepos.filter(r => !r.isPrivate).length;
    const privateCount = allRepos.filter(r => r.isPrivate).length;
    const archivedCount = allRepos.filter(r => r.isArchived).length;
    const forkCount = allRepos.filter(r => r.isFork).length;
    const originalCount = totalCount - forkCount;

    // 2. Select Top Repositories for Deep-Dive Analysis
    // We select up to 5 original repositories based on a popularity and size index
    const originalReposOnly = allRepos.filter(r => !r.isFork);
    const sortedRepos = [...originalReposOnly].sort((a, b) => {
      // Popularity Index Formula
      const scoreA = (a.stars * 15) + (a.forks * 8) + (a.size / 500) + (a.isPrivate ? 0 : 20);
      const scoreB = (b.stars * 15) + (b.forks * 8) + (b.size / 500) + (b.isPrivate ? 0 : 20);
      return scoreB - scoreA;
    });

    const topReposToAnalyze = sortedRepos.slice(0, 5);

    // 3. Concurrently Fetch Detailed Metrics for Top Repositories (with Graceful Degradation)
    const enrichedTopRepos = await Promise.all(
      topReposToAnalyze.map(async (repo) => {
        // Since we need to query sub-resources, we must use the REAL unsanitized repository name
        // (which is currently stored in repo.fullName before we apply the final sanitization sweep)
        const realFullName = repo.fullName;

        const [languagesResult, commitsResult, readmeMeta, licenseMeta, contributingMeta, cocMeta, packageJsonContent] = await Promise.all([
          adapter.getRepositoryLanguages(realFullName, token).catch(() => ({ data: {} })),
          adapter.getRepositoryCommitActivity(realFullName, username, token).catch(() => ({ data: { weeklyCommits: new Array(52).fill(0), totalCommits: 0 } })),
          adapter.checkFileExists(realFullName, 'README.md', token).catch(() => null),
          adapter.checkFileExists(realFullName, 'LICENSE', token).catch(() => null),
          adapter.checkFileExists(realFullName, 'CONTRIBUTING.md', token).catch(() => null),
          adapter.checkFileExists(realFullName, 'CODE_OF_CONDUCT.md', token).catch(() => null),
          // Fetch package.json content to inspect dependencies (Node.js framework discovery)
          adapter.getFileContent(realFullName, 'package.json', token).catch(() => null),
        ]);

        const languages = languagesResult.data || {};
        const commitActivity = commitsResult.data || { weeklyCommits: new Array(52).fill(0), totalCommits: 0 };
        
        // Extract raw data from wrapped responses
        const readme = readmeMeta?.data || null;
        const license = licenseMeta?.data || null;
        const contributing = contributingMeta?.data || null;
        const coc = cocMeta?.data || null;

        // Framework and Ecosystem Discovery
        const frameworksDetected = [];
        const configFiles = [];

        if (packageJsonContent) {
          configFiles.push('package.json');
          try {
            const pkg = JSON.parse(packageJsonContent);
            const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
            
            if (deps['react']) frameworksDetected.push('React');
            if (deps['vue']) frameworksDetected.push('Vue');
            if (deps['express']) frameworksDetected.push('Express');
            if (deps['next']) frameworksDetected.push('Next.js');
            if (deps['@nestjs/core']) frameworksDetected.push('NestJS');
            if (deps['svelte']) frameworksDetected.push('Svelte');
            if (deps['nuxt']) frameworksDetected.push('Nuxt.js');
          } catch (e) {
            logger.warn(`Failed to parse package.json for ${realFullName}: ${e.message}`);
          }
        }

        // Concurrently check other common ecosystem files
        const [hasCargo, hasGoMod, hasPip] = await Promise.all([
          adapter.checkFileExists(realFullName, 'Cargo.toml', token).catch(() => null),
          adapter.checkFileExists(realFullName, 'go.mod', token).catch(() => null),
          adapter.checkFileExists(realFullName, 'requirements.txt', token).catch(() => null),
        ]);

        const cargo = hasCargo?.data || null;
        const goMod = hasGoMod?.data || null;
        const pip = hasPip?.data || null;

        if (cargo) configFiles.push('Cargo.toml');
        if (goMod) configFiles.push('go.mod');
        if (pip) configFiles.push('requirements.txt');

        return {
          ...repo, // Standard repository attributes
          languages,
          commitActivity,
          documentation: {
            readme: {
              exists: !!readme,
              size: readme ? readme.size : 0,
            },
            license: {
              exists: !!license,
              name: license ? license.name : null,
            },
            contributing: {
              exists: !!contributing,
            },
            codeOfConduct: {
              exists: !!coc,
            },
          },
          ecosystem: {
            frameworksDetected,
            configFiles,
            hasPackageJson: !!packageJsonContent,
            hasCargoToml: !!cargo,
            hasRequirementsTxt: !!pip,
            hasGoMod: !!goMod,
          },
        };
      })
    );

    // 4. Check Profile Personal README
    // Checks if the repo `username/username` exists and has a README.md
    let hasPersonalReadme = false;
    try {
      const personalReadmeRes = await adapter.checkFileExists(`${username}/${username}`, 'README.md', token);
      hasPersonalReadme = !!(personalReadmeRes?.data);
    } catch (err) {
      // Fail silently, default to false
    }

    // 5. Calculate Aggregate Portfolio Metrics
    let totalStars = 0;
    let totalForks = 0;
    let totalSizeKB = 0;
    const languagesBytes = {};
    let totalCommitsPastYear = 0;
    let privateCommitsCount = 0;
    let recentActivityPushCount = 0;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Accumulate metrics across all repositories
    allRepos.forEach((repo) => {
      // Accumulate portfolio indicators for original work only (exclude forks)
      if (!repo.isFork) {
        totalStars += repo.stars || 0;
        totalForks += repo.forks || 0;
        totalSizeKB += repo.size || 0;
      }

      const pushTime = new Date(repo.pushedAt).getTime();
      if (pushTime > thirtyDaysAgo) {
        recentActivityPushCount++;
      }
    });

    // Accumulate detailed metrics across the top repositories
    enrichedTopRepos.forEach((repo) => {
      // Language aggregation
      Object.entries(repo.languages || {}).forEach(([lang, bytes]) => {
        languagesBytes[lang] = (languagesBytes[lang] || 0) + bytes;
      });

      // Commits aggregation
      const commits = repo.commitActivity?.totalCommits || 0;
      if (repo.isPrivate) {
        privateCommitsCount += commits;
      } else {
        totalCommitsPastYear += commits;
      }
    });

    // Calculate language percentages
    const totalLangBytes = Object.values(languagesBytes).reduce((a, b) => a + b, 0);
    const languagesPercentage = {};
    if (totalLangBytes > 0) {
      Object.entries(languagesBytes).forEach(([lang, bytes]) => {
        languagesPercentage[lang] = Math.round((bytes / totalLangBytes) * 100);
      });
    }

    // 6. STRICT SECURITY SANITIZATION SWEEP
    // Before creating the final DeveloperAnalysisData model, we completely scrub
    // all sensitive properties for private repositories to ensure they are never exposed.
    const sanitizeRepo = (repo) => {
      if (!repo.isPrivate) return repo;
      return {
        ...repo,
        name: '[private-repository]',
        fullName: `private/${repo.id}`,
        description: null,
        htmlUrl: null,
        homepage: null,
        // Strip out sensitive fields just in case they were populated
        gitUrl: undefined,
        sshUrl: undefined,
        cloneUrl: undefined,
      };
    };

    const sanitizedAllRepos = allRepos.map(sanitizeRepo);
    const sanitizedTopRepos = enrichedTopRepos.map(sanitizeRepo);

    // 7. Assemble Standardized DeveloperAnalysisData Model
    const developerAnalysisData = {
      profile,
      repositories: {
        all: sanitizedAllRepos,
        totalCount,
        publicCount,
        privateCount,
        archivedCount,
        forkCount,
        originalCount,
      },
      topRepositories: sanitizedTopRepos,
      aggregateMetrics: {
        totalStars,
        totalForks,
        totalSizeKB,
        languagesPercentage,
        languagesBytes,
        totalCommitsPastYear,
        recentActivityPushCount,
        hasPersonalReadme,
        privateReposCount: privateCount,
        privateCommitsCount,
      },
      scoringVersion: '1.0.0', // Scoring algorithm version tracker
      cacheMetadata,
    };

    logger.info(`Successfully compiled DeveloperAnalysisData for ${username}. Original Repos: ${originalCount}, Top Repos Analyzed: ${sanitizedTopRepos.length}`);
    return developerAnalysisData;
  }
}

export default new PortfolioDataCollector();

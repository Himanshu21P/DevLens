import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Setup Mock Environment
process.env.JWT_SECRET = 'test_jwt_secret_key_12345678';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_87654321';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// 1. Mock Database Layer
jest.unstable_mockModule('../src/config/db.js', () => ({
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaClient)),
  },
}));

// 2. Mock GitHub Service Integration Layer
jest.unstable_mockModule('../src/services/githubService.js', () => ({
  default: {
    getOAuthAccessToken: jest.fn(),
    getAuthenticatedUserInfo: jest.fn(),
  },
}));

const { default: prisma } = await import('../src/config/db.js');
const { default: githubService } = await import('../src/services/githubService.js');
const mockPrismaClient = prisma;

// Import app after mock setup
const { default: app } = await import('../src/app.js');

const generateTestAccessToken = (userId) => {
  return jwt.sign({ userId, email: 'user@devlens.com', role: 'member' }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('GitHub OAuth, Sync & Linking API (Module 2.3)', () => {
  const mockGithubProfile = {
    id: 123456,
    login: 'octocat',
    name: 'The Octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/5832347',
    bio: 'Testing profile synchronization',
    public_repos: 8,
    followers: 120,
    following: 9,
    company: 'GitHub',
    location: 'San Francisco',
    blog: 'https://github.blog',
    twitter_username: 'octocat_tw',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/github/callback (OAuth Flow & Sync)', () => {
    it('registers a new user and synchronizes metadata when GitHub account does not exist', async () => {
      githubService.getOAuthAccessToken.mockResolvedValue('gho_mocktoken');
      githubService.getAuthenticatedUserInfo.mockResolvedValue({
        profile: mockGithubProfile,
        primaryEmail: 'octocat@github.com',
      });

      // DB returns null (no existing user by GitHub ID or email)
      prisma.user.findUnique.mockResolvedValueOnce(null); // By GitHub ID
      prisma.user.findUnique.mockResolvedValueOnce(null); // By Email

      prisma.user.create.mockResolvedValue({
        id: 42,
        email: 'octocat@github.com',
        name: 'The Octocat',
      });

      prisma.user.update.mockResolvedValue({
        id: 42,
        email: 'octocat@github.com',
        name: 'The Octocat',
        githubId: '123456',
        githubUsername: 'octocat',
        avatarUrl: mockGithubProfile.avatar_url,
      });

      const res = await request(app)
        .post('/api/v1/auth/github/callback')
        .send({ code: 'valid_code' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.githubUsername).toBe('octocat');
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalled(); // Synchronize runs
    });

    it('logs in an existing user and updates metadata', async () => {
      githubService.getOAuthAccessToken.mockResolvedValue('gho_mocktoken');
      githubService.getAuthenticatedUserInfo.mockResolvedValue({
        profile: mockGithubProfile,
        primaryEmail: 'octocat@github.com',
      });

      // DB returns user matched by GitHub ID
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 42,
        email: 'octocat@github.com',
        githubId: '123456',
        passwordHash: 'hashed_pass',
      });

      prisma.user.update.mockResolvedValue({
        id: 42,
        email: 'octocat@github.com',
        githubId: '123456',
        githubUsername: 'octocat',
      });

      const res = await request(app)
        .post('/api/v1/auth/github/callback')
        .send({ code: 'valid_code' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledTimes(2); // One for token update, one for sync
    });

    it('returns 400 when authorization code is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/github/callback')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('handles expired/invalid GitHub OAuth code gracefully', async () => {
      // Mock exchange throwing an error
      const oauthError = new Error('The code passed is incorrect or expired.');
      oauthError.statusCode = 400;
      oauthError.name = 'GithubOAuthError';
      githubService.getOAuthAccessToken.mockRejectedValueOnce(oauthError);

      const res = await request(app)
        .post('/api/v1/auth/github/callback')
        .send({ code: 'expired_code' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incorrect or expired');
    });
  });

  describe('POST /api/v1/auth/github/link (Account Linking)', () => {
    const authHeader = `Bearer ${generateTestAccessToken(42)}`;

    it('links GitHub account successfully to active credentials profile', async () => {
      githubService.getOAuthAccessToken.mockResolvedValue('gho_mocktoken');
      githubService.getAuthenticatedUserInfo.mockResolvedValue({
        profile: mockGithubProfile,
      });

      // No conflict: GitHub ID is not linked to any other user
      prisma.user.findUnique.mockResolvedValueOnce(null);

      prisma.user.update.mockResolvedValue({
        id: 42,
        email: 'user@devlens.com',
        githubId: '123456',
        githubUsername: 'octocat',
      });

      const res = await request(app)
        .post('/api/v1/auth/github/link')
        .set('Authorization', authHeader)
        .send({ code: 'link_code' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.githubUsername).toBe('octocat');
    });

    it('rejects linking if GitHub account is already linked to another user (Conflict)', async () => {
      githubService.getOAuthAccessToken.mockResolvedValue('gho_mocktoken');
      githubService.getAuthenticatedUserInfo.mockResolvedValue({
        profile: mockGithubProfile,
      });

      // Conflict: GitHub ID is already linked to User ID 99
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 99,
        email: 'other@devlens.com',
        githubId: '123456',
      });

      const res = await request(app)
        .post('/api/v1/auth/github/link')
        .set('Authorization', authHeader)
        .send({ code: 'link_code' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already linked to another DevLens user');
    });
  });

  describe('POST /api/v1/auth/github/unlink (Account Unlinking & Safety)', () => {
    const authHeader = `Bearer ${generateTestAccessToken(42)}`;

    it('unlinks GitHub account successfully when alternative credentials exist', async () => {
      // User has a passwordHash, so they won't be locked out
      prisma.user.findUnique.mockResolvedValue({
        id: 42,
        email: 'user@devlens.com',
        githubId: '123456',
        passwordHash: 'bcrypt_hash_value',
      });

      prisma.user.update.mockResolvedValue({
        id: 42,
        email: 'user@devlens.com',
        githubId: null,
      });

      const res = await request(app)
        .post('/api/v1/auth/github/unlink')
        .set('Authorization', authHeader);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.githubUsername).toBeNull();
    });

    it('rejects unlinking if user has no alternative credentials (Lockout Prevention)', async () => {
      // User registered via OAuth and has no passwordHash set!
      prisma.user.findUnique.mockResolvedValue({
        id: 42,
        email: 'user@devlens.com',
        githubId: '123456',
        passwordHash: null, // Lockout risk!
      });

      const res = await request(app)
        .post('/api/v1/auth/github/unlink')
        .set('Authorization', authHeader);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('must set a password');
      expect(prisma.user.update).not.create; // No update executed
    });
  });
});

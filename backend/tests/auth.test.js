import request from 'supertest';
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Setup Mock Secrets for JWT and encryption
process.env.JWT_SECRET = 'test_jwt_secret_key_12345678';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_87654321';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock database layer
jest.unstable_mockModule('../src/config/db.js', () => ({
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaClient)),
  },
}));

// We need a helper to reference the mocked database inside transaction scopes
const { default: prisma } = await import('../src/config/db.js');
const mockPrismaClient = prisma;

// Import app after mocks are initialized
const { default: app } = await import('../src/app.js');
const { hashPassword } = await import('../src/utils/auth.js');

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

describe('Authentication API Suite (Module 2.2)', () => {
  const registerPayload = {
    email: 'developer@devlens.com',
    password: 'StrongPassword123!',
    name: 'Alex Dev',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and return clean profile details', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 1,
        email: registerPayload.email,
        name: registerPayload.name,
        avatarUrl: null,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(registerPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(registerPayload.email);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should fail registration when email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, email: registerPayload.email });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(registerPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('should fail registration when password is weak', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@devlens.com',
          password: 'weak',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0].message).toContain('at least 8 characters');
    });

    it('should fail registration when request body is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Alex' }); // Missing email and password

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation Error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user and set secure refresh cookie', async () => {
      const passwordHash = await hashPassword(registerPayload.password);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: registerPayload.email,
        passwordHash,
        name: registerPayload.name,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: registerPayload.email,
          password: registerPayload.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user.email).toBe(registerPayload.email);
      
      // Verify cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('SameSite=Strict');
    });

    it('should reject login with incorrect password', async () => {
      const passwordHash = await hashPassword(registerPayload.password);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: registerPayload.email,
        passwordHash,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: registerPayload.email,
          password: 'WrongPassword123!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should reject login for non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@devlens.com',
          password: 'SomePassword123!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    const mockUser = { id: 1, email: 'developer@devlens.com', role: 'member' };
    const mockJti = 'b2c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e';

    const generateTestRefreshToken = (user, jti) => {
      return jwt.sign({ userId: user.id, jti }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    };

    it('should rotate access and refresh tokens when refresh token is valid', async () => {
      const token = generateTestRefreshToken(mockUser, mockJti);
      const hashedToken = hashToken(token);

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1,
        token: hashedToken,
        jti: mockJti,
        userId: mockUser.id,
        isUsed: false,
        expiresAt: new Date(Date.now() + 3600000), // Valid for 1 hour
        user: mockUser,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject refresh when token has expired', async () => {
      // Create a token that expired 1 hour ago
      const expiredToken = jwt.sign(
        { userId: mockUser.id, jti: mockJti, exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_REFRESH_SECRET
      );

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${expiredToken}`]);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('expired');
    });

    it('should trigger REPLAY DETECT and revoke all sessions if refresh token was already used', async () => {
      const token = generateTestRefreshToken(mockUser, mockJti);
      const hashedToken = hashToken(token);

      // DB returns a token that is marked as used
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 1,
        token: hashedToken,
        jti: mockJti,
        userId: mockUser.id,
        isUsed: true, // Already used! Replay trigger!
        expiresAt: new Date(Date.now() + 3600000),
        user: mockUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`refreshToken=${token}`]);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('compromised');
      
      // Verify mitigation: all refresh tokens for this user must be deleted
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear refresh token from database and scrub cookie', async () => {
      const token = 'some_refresh_token_value';
      prisma.refreshToken.delete.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [`refreshToken=${token}`]);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.refreshToken.delete).toHaveBeenCalled();
      
      // Verify cookie is cleared (Max-Age=0 or Expires in past)
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('refreshToken=;');
    });
  });

  describe('POST /api/v1/auth/forgot-password & /reset-password', () => {
    const email = 'developer@devlens.com';
    const resetToken = '3b9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c';
    const hashedResetToken = hashToken(resetToken);

    it('should handle forgot password and log secure recovery URL', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email,
      });
      prisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should successfully reset password with valid token', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        email,
        passwordResetToken: hashedResetToken,
      });
      prisma.user.update.mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewStrongPassword123!',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should reject password reset if token has expired or is invalid', async () => {
      prisma.user.findFirst.mockResolvedValue(null); // No match found (expired/invalid)

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid_or_expired_token',
          password: 'NewStrongPassword123!',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('invalid or has expired');
    });
  });
});

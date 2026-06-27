import request from 'supertest';
import { jest } from '@jest/globals';

// Mock Prisma and Redis before importing app
jest.unstable_mockModule('../src/config/db.js', () => ({
  default: {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    $disconnect: jest.fn().mockResolvedValue(true),
  },
}));

jest.unstable_mockModule('../src/config/redis.js', () => ({
  default: null,
  isRedisConnected: true,
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
}));

// Dynamically import app so mock modules are loaded first
const { default: app } = await import('../src/app.js');
const { default: prisma } = await import('../src/config/db.js');

describe('GET /health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 and healthy status when database is online', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body.services).toHaveProperty('database', 'connected');
    expect(response.body.services).toHaveProperty('cache', 'connected');
  });

  it('should return 500 and unhealthy status when database is offline', async () => {
    // Force Prisma query to throw an error
    prisma.$queryRaw.mockRejectedValueOnce(new Error('Connection failure'));

    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(500);
    expect(response.body).toHaveProperty('status', 'unhealthy');
    expect(response.body.services).toHaveProperty('database', 'down');
  });
});

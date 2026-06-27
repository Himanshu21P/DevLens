import { createClient } from 'redis';
import logger from '../utils/logger.js';

let redisClient = null;
let isRedisConnected = false;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

if (process.env.NODE_ENV !== 'test') {
  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          logger.warn('Redis reconnection failed. Bypassing Redis cache and degrading gracefully.');
          isRedisConnected = false;
          return false; // Stop reconnecting after 5 attempts
        }
        logger.info(`Redis reconnecting... Attempt #${retries}`);
        return Math.min(retries * 100, 3000); // Backoff strategy
      },
      connectTimeout: 5000,
    },
  });

  redisClient.on('connect', () => {
    logger.info('Connecting to Redis...');
  });

  redisClient.on('ready', () => {
    logger.info('Redis client is ready to use.');
    isRedisConnected = true;
  });

  redisClient.on('error', (err) => {
    logger.error(`Redis Error: ${err.message}`);
    isRedisConnected = false;
  });

  redisClient.on('end', () => {
    logger.warn('Redis connection closed.');
    isRedisConnected = false;
  });

  // Connect asynchronously
  (async () => {
    try {
      await redisClient.connect();
    } catch (err) {
      logger.warn(`Could not connect to Redis: ${err.message}. Running without caching.`);
    }
  })();
}

/**
 * Cache getter helper that fails gracefully if Redis is unavailable.
 */
export const getCache = async (key) => {
  if (!isRedisConnected || !redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error(`Redis Get Error for key ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Cache setter helper that fails gracefully if Redis is unavailable.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlInSeconds - Time to live in seconds
 */
export const setCache = async (key, value, ttlInSeconds = 3600) => {
  if (!isRedisConnected || !redisClient) return false;
  try {
    const serializedValue = JSON.stringify(value);
    await redisClient.set(key, serializedValue, {
      EX: ttlInSeconds,
    });
    return true;
  } catch (err) {
    logger.error(`Redis Set Error for key ${key}: ${err.message}`);
    return false;
  }
};

/**
 * Cache deleter helper that fails gracefully if Redis is unavailable.
 */
export const deleteCache = async (key) => {
  if (!isRedisConnected || !redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    logger.error(`Redis Delete Error for key ${key}: ${err.message}`);
    return false;
  }
};

export default redisClient;
export { isRedisConnected };

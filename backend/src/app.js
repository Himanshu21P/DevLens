import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import logger from './utils/logger.js';
import prisma from './config/db.js';
import { isRedisConnected } from './config/redis.js';
import authRoutes from './routes/authRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

const app = express();

// 1. Security Middleware
app.use(helmet());

// 2. CORS Configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// 3. Compression for performance
app.use(compression());

// 4. Rate Limiter to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again after 15 minutes.',
      code: 'TOO_MANY_REQUESTS',
      details: {}
    },
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
});
app.use('/api/', limiter);

// 5. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 6. Request Logging Middleware (HTTP level)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - IP: ${req.ip}`);
  });
  next();
});

// 7. Swagger API Documentation Setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DevLens API',
      version: '1.0.0',
      description: 'Production-ready REST API for DevLens developer intelligence platform',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/app.js'], // Paths to API documentation annotations
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Route Registrations
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', oauthRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// 8. Health Check Endpoint
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Check system health status
 *     description: Returns the health status of the API, database connection, and Redis cache.
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: string
 *                     cache:
 *                       type: string
 */
app.get('/health', async (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'down',
      cache: isRedisConnected ? 'connected' : 'disconnected (running degraded)',
    },
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    healthInfo.services.database = 'connected';
  } catch (dbError) {
    logger.error(`Health check database failure: ${dbError.message}`);
    healthInfo.status = 'unhealthy';
    healthInfo.services.database = 'down';
  }

  const statusCode = healthInfo.status === 'healthy' ? 200 : 500;
  res.status(statusCode).json(healthInfo);
});

// 9. Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to DevLens API. Refer to /api-docs for documentation.',
  });
});

// 10. Global 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    status: 404,
    error: {
      message: `Cannot ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
      details: {}
    },
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// 11. Global Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled Exception: ${err.message}`, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  const errMsg = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'An unexpected error occurred.'
    : err.message;

  const responsePayload = {
    success: false,
    message: errMsg,
    errors: [{ message: err.message }],
    error: {
      message: errMsg,
      code: err.code || (statusCode === 400 ? 'BAD_REQUEST' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'),
      details: err.details || {}
    }
  };

  if (process.env.NODE_ENV !== 'production') {
    responsePayload.stack = err.stack;
  }

  res.status(statusCode).json(responsePayload);
});

export default app;

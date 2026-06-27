import validateEnv from './config/env.js';
import logger from './utils/logger.js';

// Validate environment configurations first (Fail-Fast)
validateEnv();

import app from './app.js';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`=================================`);
  logger.info(`  DevLens Backend API Service     `);
  logger.info(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`  Listening on Port: ${PORT}      `);
  logger.info(`  Swagger Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`=================================`);
});

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.message}`, { stack: err.stack });
  logger.info('Shutting down server due to uncaught exception...');
  process.exit(1);
});

// Handle Unhandled Rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION:', reason);
  logger.info('Shutting down server due to unhandled promise rejection...');
  server.close(() => {
    process.exit(1);
  });
});

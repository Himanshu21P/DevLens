import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, avoid creating multiple connections due to hot reloading
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log queries using our custom logger in debug mode
    global.prisma.$on('query', (e) => {
      logger.debug(`Prisma Query: ${e.query} -- Params: ${e.params} -- Duration: ${e.duration}ms`);
    });
  }
  prisma = global.prisma;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  logger.info('Prisma disconnected gracefully.');
  process.exit(0);
});

export default prisma;

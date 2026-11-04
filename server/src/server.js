import http from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { app } from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { configureSockets } from './sockets/index.js';

const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: env.CLIENT_ORIGIN, credentials: true } });
configureSockets(io);
let shuttingDown = false;

async function start() {
  await connectDB();
  server.listen(env.PORT, () => logger.info('Server listening', { port: env.PORT }));
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Graceful shutdown started', { signal });
  server.close(async () => {
    try {
      await io.close();
      const mongoose = await import('mongoose');
      await mongoose.default.disconnect();
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown failed', { message: error.message });
      process.exit(1);
    }
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
start().catch(error => {
  logger.error('Server startup failed', { message: error.message });
  process.exit(1);
});

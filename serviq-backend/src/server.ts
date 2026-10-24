import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

async function startServer() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 Serviq Backend running on http://${env.HOST}:${env.PORT}`);
    console.log(`📡 Environment: ${env.NODE_ENV}`);
    console.log(`⚙️ Config: Commission = ${env.COMMISSION_LABOR_RATE_PCT}%, Cancellation Fee = ₹${env.CANCEL_TRIP_FEE_AMOUNT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown handling
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    await app.close();
    process.exit(0);
  });
});

startServer();

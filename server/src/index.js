import { app } from './app.js';
import { env, assertCoreEnv } from './config/env.js';
import { pool } from './db/pool.js';
import { connectRedis } from './redis/client.js';
import { startDeepgramRelayServer } from './realtime/deepgramRelayServer.js';

async function start() {
  assertCoreEnv();
  await pool.query('SELECT 1');
  await connectRedis();

  const server = app.listen(env.port, () => {
    console.log(`Kredox AI API listening on port ${env.port}`);
  });
  startDeepgramRelayServer(server);
}

start().catch((error) => {
  console.error('Failed to start Kredox AI API');
  console.error(error);
  process.exit(1);
});

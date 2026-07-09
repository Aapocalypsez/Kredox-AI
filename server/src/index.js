import { app } from './app.js';
import { env, assertCoreEnv } from './config/env.js';
import { pool } from './db/pool.js';
import { applyDatabaseSchema } from './db/schema.js';
import { connectRedis } from './redis/client.js';
import { startDeepgramRelayServer } from './realtime/deepgramRelayServer.js';

async function start() {
  assertCoreEnv();
  await applyDatabaseSchema();
  await pool.query('SELECT 1');
  
  // Cleanup ghost test session from dashboard
  await pool.query("DELETE FROM video_sessions WHERE id::text LIKE '61bd0308%'").then((res) => {
    console.log(`Ghost session cleanup: deleted ${res.rowCount} row(s)`);
  }).catch((err) => {
    console.error('Failed to cleanup ghost session:', err.message);
  });

  await connectRedis();

  const server = app.listen(env.port, () => {
    console.log(`Kredox AI API listening on port ${env.port}`);
  });
  startDeepgramRelayServer(server);
}

start().catch((error) => {
  console.error('Failed to start Kredox AI API');
  if (error.code === 'ENOTFOUND' && String(error.hostname || '').includes('supabase')) {
    console.error('Database host not found. Check DATABASE_URL in server/.env or Render env vars.');
    console.error('Create a new Supabase project and use the pooler URL with ?sslmode=require');
  } else if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Copy .env.example to server/.env and configure it.');
  } else if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters.');
  }
  console.error(error);
  process.exit(1);
});

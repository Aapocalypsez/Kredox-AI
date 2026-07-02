import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

function poolSslConfig() {
  if (env.nodeEnv !== 'production') return undefined;
  if (/supabase\.co|render\.com|neon\.tech|aws-0-/i.test(env.databaseUrl || '')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: poolSslConfig()
});


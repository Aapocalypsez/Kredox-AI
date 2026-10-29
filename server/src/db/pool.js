import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

function poolSslConfig() {
  if (/supabase|render\.com|neon\.tech|pooler|aws-0-/i.test(env.databaseUrl || '')) {
    return { rejectUnauthorized: false };
  }
  if (env.nodeEnv === 'production') {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: poolSslConfig()
});


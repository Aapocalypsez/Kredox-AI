import { assertCoreEnv } from '../config/env.js';
import { pool } from './pool.js';
import { applyDatabaseSchema } from './schema.js';

async function migrate() {
  assertCoreEnv();
  await applyDatabaseSchema();
  await pool.end();
  console.log('Database schema applied.');
}

migrate().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});


import bcrypt from 'bcryptjs';
import { assertCoreEnv } from '../config/env.js';
import { pool } from './pool.js';
import { applyDatabaseSchema } from './schema.js';

async function ensureAdminAgent() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO agents (email, name, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email)
     DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       role = 'admin'`,
    [email, process.env.ADMIN_NAME?.trim() || 'Kredox Admin', passwordHash]
  );
  console.log(`Admin agent ready for ${email}`);
}

async function migrate() {
  assertCoreEnv();
  await applyDatabaseSchema();
  await ensureAdminAgent();
  await pool.end();
  console.log('Database schema applied.');
}

migrate().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});


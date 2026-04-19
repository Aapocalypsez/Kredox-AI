import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME || 'Kredox Admin';

if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO agents (email, name, password_hash, role)
   VALUES ($1, $2, $3, 'admin')
   ON CONFLICT (email)
   DO UPDATE SET
     name = EXCLUDED.name,
     password_hash = EXCLUDED.password_hash,
     role = 'admin'`,
  [email, name, passwordHash]
);

await pool.end();
console.log(`Seeded admin agent ${email}`);

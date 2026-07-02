#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredPaths = [
  'package.json',
  'package-lock.json',
  'client/package.json',
  'client/package-lock.json',
  'client/vercel.json',
  'server/package.json',
  'server/package-lock.json',
  'render.yaml',
  'vercel.json',
  '.env.example',
  'scripts/flow-checklist.mjs'
];

const skipWhenZipping = [
  'node_modules',
  'client/node_modules',
  'server/node_modules',
  'client/dist',
  '.git',
  '.env',
  'server/.env'
];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function ensureServerEnvTemplate() {
  const target = path.join(root, 'server/.env.example');
  const source = path.join(root, '.env.example');
  if (!(await exists('server/.env.example'))) {
    await copyFile(source, target);
    console.log('Created server/.env.example');
  }
}

async function run() {
  const failures = [];

  for (const item of requiredPaths) {
    if (!(await exists(item))) failures.push(`Missing required file: ${item}`);
  }

  await ensureServerEnvTemplate();

  if (!(await exists('server/.env')) && (await exists('.env.example'))) {
    await copyFile(path.join(root, '.env.example'), path.join(root, 'server/.env'));
    console.log('Created server/.env from .env.example — edit DATABASE_URL and secrets before running locally.');
  }

  const flowScript = path.join(root, 'scripts/flow-checklist.mjs');
  const flow = spawnSync(process.execPath, [flowScript], { cwd: root, encoding: 'utf8' });
  if (flow.status !== 0) {
    failures.push('flow-checklist failed');
    if (flow.stdout) console.error(flow.stdout);
    if (flow.stderr) console.error(flow.stderr);
  }

  if (failures.length) {
    console.error('\nDeploy prep failed:');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log('Deploy prep passed.');
  console.log('\nZip this folder for Windows, but EXCLUDE:');
  skipWhenZipping.forEach((item) => console.log(`  - ${item}`));
  console.log('\nOn Windows after unzip:');
  console.log('  1. Install Node.js 20+');
  console.log('  2. copy .env.example server\\.env and fill DATABASE_URL + JWT secrets');
  console.log('  3. npm install');
  console.log('  4. npm run db:migrate');
  console.log('  5. npm run dev');
  console.log('\nFor cloud deploy, follow DEPLOY.md');
}

run().catch((error) => {
  console.error('deploy-prep crashed:', error.message);
  process.exit(1);
});

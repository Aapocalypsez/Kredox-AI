#!/usr/bin/env node

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  {
    name: 'client App routes',
    file: 'client/src/App.jsx',
    mustInclude: [
      '/login',
      '/dashboard',
      '/report/:id',
      '/campaigns',
      '/applications',
      '/reports',
      '/admin',
      '/session/:id',
      '/verify/:token',
      '/offer/:token'
    ]
  },
  {
    name: 'API client exports',
    file: 'client/src/api/index.js',
    mustInclude: ['authAPI', 'campaignAPI', 'videoAPI', 'offerAPI', 'reportsAPI', 'applicationAPI']
  },
  {
    name: 'server route mounts',
    file: 'server/src/app.js',
    mustInclude: [
      '/api/auth',
      '/api/campaigns',
      '/api/video',
      '/api/reports',
      '/api/offers',
      '/api/links'
    ]
  },
  {
    name: 'deployment blueprints',
    file: 'render.yaml',
    mustInclude: ['start:deploy', 'healthCheckPath', 'ADMIN_EMAIL']
  },
  {
    name: 'vercel root config',
    file: 'vercel.json',
    mustInclude: ['client/dist', 'rewrites']
  },
  {
    name: 'login left panel preserved',
    file: 'client/src/pages/Login.jsx',
    mustInclude: [
      'login-left',
      'Loan decisions in',
      '247',
      'LOANS TODAY',
      'INR 4.2Cr',
      'DISBURSED WEEK',
      '94.2%',
      'MODEL ACCURACY'
    ]
  }
];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function run() {
  const failures = [];

  for (const check of checks) {
    const target = path.join(root, check.file);
    if (!(await exists(check.file))) {
      failures.push(`${check.name}: missing file ${check.file}`);
      continue;
    }

    const content = await readFile(target, 'utf8');
    for (const needle of check.mustInclude) {
      if (!content.includes(needle)) {
        failures.push(`${check.name}: expected "${needle}" in ${check.file}`);
      }
    }
  }

  const pageFiles = [
    'client/src/pages/Login.jsx',
    'client/src/pages/Dashboard.jsx',
    'client/src/pages/Campaigns.jsx',
    'client/src/pages/Applications.jsx',
    'client/src/pages/ApplicationReport.jsx',
    'client/src/pages/LiveSession.jsx',
    'client/src/pages/Reports.jsx',
    'client/src/pages/Admin.jsx',
    'client/src/pages/CustomerVideoPage.jsx',
    'client/src/pages/CustomerOfferPage.jsx',
    'client/src/components/Layout.jsx'
  ];

  for (const page of pageFiles) {
    if (!(await exists(page))) {
      failures.push(`page check: missing ${page}`);
    }
  }

  if (failures.length) {
    console.error('Flow checklist failed:\n');
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log('Flow checklist passed.');
  console.log(`Validated ${checks.length} structural checks and ${pageFiles.length} UI entry points.`);
}

run().catch((error) => {
  console.error('Flow checklist crashed:', error.message);
  process.exit(1);
});

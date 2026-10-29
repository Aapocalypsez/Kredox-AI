#!/usr/bin/env node

/**
 * Kredox AI Keep-Alive Ping
 * Pings the /health endpoint which executes a lightweight SELECT 1 on Supabase,
 * preventing Supabase from pausing after 7 days of inactivity.
 */

const targetUrl = process.argv[2] || process.env.RENDER_API_URL || 'https://kredox-ai-api.onrender.com';
const healthEndpoint = `${targetUrl.replace(/\/+$/, '')}/health`;

console.log(`[Keep-Alive] Pinging ${healthEndpoint}...`);

const startTime = Date.now();
try {
  const res = await fetch(healthEndpoint, { signal: AbortSignal.timeout(90000) });
  const data = await res.json();
  const elapsed = Date.now() - startTime;
  console.log(`[Keep-Alive] Status: ${res.status} (${elapsed}ms)`);
  console.log('[Keep-Alive] Response:', JSON.stringify(data, null, 2));
  if (data.ok) {
    console.log('✅ Keep-alive successful: Render & Supabase are active!');
  }
} catch (err) {
  console.error('❌ Keep-alive ping failed:', err.message);
  process.exit(1);
}

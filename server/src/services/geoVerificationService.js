import { env } from '../config/env.js';
import { pool } from '../db/pool.js';

function normalizeLocation(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(left, right) {
  const a = normalizeLocation(left);
  const b = normalizeLocation(right);
  if (!a && !b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);

  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return dp[a.length][b.length];
}

function similarity(left, right) {
  const a = normalizeLocation(left);
  const b = normalizeLocation(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

function fuzzyMatch(left, right, threshold = 0.78) {
  if (!left || !right) return false;
  return similarity(left, right) >= threshold;
}

function extractNominatimLocation(payload) {
  const address = payload?.address || {};
  return {
    city:
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.city_district ||
      address.county ||
      null,
    state: address.state || address.region || address.state_district || null,
    country: address.country || null,
    pincode: address.postcode || null
  };
}

async function reverseGeocode(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return null;
  }

  const url = new URL(`${env.geo.nominatimBaseUrl}/reverse`);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'KredoxAI/1.0 (+https://github.com/Aapocalypsez/Kredox-AI)'
    }
  });
  if (!response.ok) {
    throw new Error(`Nominatim reverse geocoding failed with ${response.status}`);
  }

  const payload = await response.json();
  return extractNominatimLocation(payload);
}

async function lookupIp(ipAddress) {
  if (!ipAddress) return null;

  const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ipAddress)}`);
  if (!response.ok) return null;

  const payload = await response.json();
  if (payload.status === 'fail') return null;

  return {
    city: payload.city || null,
    region: payload.regionName || payload.region || null,
    country: payload.country || null,
    isp: payload.isp || null
  };
}

async function getDeclaredLocation(sessionId) {
  const result = await pool.query(
    `SELECT c.city AS declared_city, c.declared_state
     FROM video_sessions vs
     LEFT JOIN customers c ON c.id::text = vs.customer_id
     WHERE vs.id = $1`,
    [sessionId]
  );

  if (!result.rowCount) {
    const error = new Error('Video session not found');
    error.statusCode = 404;
    error.publicMessage = 'Video session not found';
    throw error;
  }

  return result.rows[0];
}

function scoreGeo({ gps, ip, declared }) {
  const flags = [];
  let geoScore = 100;

  if ((gps?.country || ip?.country) && !fuzzyMatch(gps?.country || ip?.country, 'India', 0.72)) {
    return {
      geo_score: 0,
      flags: ['FOREIGN_LOCATION'],
      match_status: 'MISMATCH'
    };
  }

  if (gps?.city && declared.declared_city && !fuzzyMatch(gps.city, declared.declared_city)) {
    geoScore -= 40;
    flags.push('CITY_MISMATCH');
  }

  if (gps?.state && declared.declared_state && !fuzzyMatch(gps.state, declared.declared_state)) {
    geoScore -= 60;
    flags.push('STATE_MISMATCH');
  }

  if (gps?.city && ip?.city && !fuzzyMatch(ip.city, gps.city)) {
    geoScore -= 30;
    flags.push('POSSIBLE_VPN');
  }

  geoScore = Math.max(0, geoScore);
  return {
    geo_score: geoScore,
    flags,
    match_status: geoScore >= 85 ? 'MATCH' : geoScore >= 50 ? 'PARTIAL' : 'MISMATCH'
  };
}

export async function verifyGeoLocation({ session_id, latitude, longitude, ip_address }) {
  const [declared, gps, ip] = await Promise.all([
    getDeclaredLocation(session_id),
    reverseGeocode(latitude, longitude),
    lookupIp(ip_address)
  ]);
  const score = scoreGeo({ gps, ip, declared });

  const result = {
    gps_city: gps?.city || null,
    gps_state: gps?.state || null,
    gps_country: gps?.country || null,
    gps_pincode: gps?.pincode || null,
    ip_city: ip?.city || null,
    ip_region: ip?.region || null,
    ip_country: ip?.country || null,
    ip_isp: ip?.isp || null,
    declared_city: declared.declared_city || null,
    declared_state: declared.declared_state || null,
    geo_score: score.geo_score,
    flags: score.flags,
    match_status: score.match_status,
    coordinates: {
      lat: latitude ?? null,
      lng: longitude ?? null
    }
  };

  await pool.query(
    `INSERT INTO geo_verifications (
       session_id,
       gps_city,
       gps_state,
       gps_country,
       gps_pincode,
       ip_city,
       ip_region,
       ip_country,
       ip_isp,
       declared_city,
       declared_state,
       latitude,
       longitude,
       geo_score,
       flags,
       match_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      session_id,
      result.gps_city,
      result.gps_state,
      result.gps_country,
      result.gps_pincode,
      result.ip_city,
      result.ip_region,
      result.ip_country,
      result.ip_isp,
      result.declared_city,
      result.declared_state,
      latitude ?? null,
      longitude ?? null,
      result.geo_score,
      result.flags,
      result.match_status
    ]
  );

  await pool.query(
    `UPDATE video_sessions
     SET geo_match = $2,
         call_city = $3,
         call_state = $4
     WHERE id = $1`,
    [session_id, result.match_status === 'MATCH', result.gps_city || result.ip_city, result.gps_state || result.ip_region]
  );

  return result;
}

export async function getGeoSessionReport(sessionId) {
  const result = await pool.query(
    `SELECT
       id,
       session_id,
       gps_city,
       gps_state,
       gps_country,
       gps_pincode,
       ip_city,
       ip_region,
       ip_country,
       ip_isp,
       declared_city,
       declared_state,
       latitude,
       longitude,
       geo_score,
       flags,
       match_status,
       created_at
     FROM geo_verifications
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId]
  );

  if (!result.rowCount) {
    const error = new Error('Geo verification not found');
    error.statusCode = 404;
    error.publicMessage = 'Geo verification not found';
    throw error;
  }

  const row = result.rows[0];
  return {
    ...row,
    coordinates: {
      lat: row.latitude === null ? null : Number(row.latitude),
      lng: row.longitude === null ? null : Number(row.longitude)
    },
    timeline: [
      `Location captured at ${new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${row.gps_city || 'Unknown'}, ${row.gps_state || 'Unknown'} (GPS)`,
      `IP location: ${row.ip_city || 'Unknown'} (${row.ip_isp || 'ISP unknown'}) — ${row.flags?.includes('POSSIBLE_VPN') ? 'Mismatch' : 'Consistent'}`
    ]
  };
}


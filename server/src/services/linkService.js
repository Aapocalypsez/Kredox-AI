import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { linkKey, redis } from '../redis/client.js';
import { verifySignedLinkToken } from './tokenService.js';

async function expireTokenIfNeeded(token) {
  await pool.query(
    `UPDATE campaign_links
     SET status = 'expired'
     WHERE token = $1
       AND status = 'pending'
       AND expires_at <= NOW()`,
    [token]
  );
}

export async function validateCampaignLink(token) {
  let decoded;

  try {
    decoded = verifySignedLinkToken(token);
  } catch (error) {
    await expireTokenIfNeeded(token);
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: false, reason: 'invalid_signature' };
  }

  const cachedValue = await redis.get(linkKey(token));
  if (!cachedValue) {
    await expireTokenIfNeeded(token);
    return { valid: false, reason: 'expired_or_used' };
  }

  const updateResult = await pool.query(
    `UPDATE campaign_links
     SET status = 'opened',
         opened_at = COALESCE(opened_at, NOW())
     WHERE token = $1
       AND status = 'pending'
       AND expires_at > NOW()
     RETURNING customer_id, campaign_id`,
    [token]
  );

  if (!updateResult.rowCount) {
    await redis.del(linkKey(token));
    const statusResult = await pool.query(
      `SELECT status FROM campaign_links WHERE token = $1`,
      [token]
    );
    const reason = statusResult.rows[0]?.status || 'not_found';
    return { valid: false, reason };
  }

  await redis.del(linkKey(token));
  const cached = JSON.parse(cachedValue);

  return {
    valid: true,
    customer_id: updateResult.rows[0].customer_id,
    session_token: cached.session_token || decoded.session_token
  };
}

export async function completeCampaignLink({ token, session_token }) {
  let decoded;

  try {
    decoded = verifySignedLinkToken(token);
  } catch {
    return { completed: false, reason: 'invalid_token' };
  }

  if (decoded.session_token !== session_token) {
    return { completed: false, reason: 'invalid_session' };
  }

  const result = await pool.query(
    `UPDATE campaign_links
     SET status = 'completed',
         completed_at = NOW()
     WHERE token = $1
       AND status = 'opened'
     RETURNING customer_id, campaign_id, completed_at`,
    [token]
  );

  if (!result.rowCount) {
    return { completed: false, reason: 'not_opened_or_already_completed' };
  }

  return { completed: true, ...result.rows[0] };
}

export async function verifyCampaignSessionAccess({ token, session_token, session_id }) {
  let decoded;

  try {
    decoded = verifySignedLinkToken(token);
  } catch {
    const error = new Error('Invalid verification token');
    error.statusCode = 403;
    error.publicMessage = 'Invalid verification token';
    throw error;
  }

  if (decoded.session_token !== session_token) {
    const error = new Error('Invalid customer session');
    error.statusCode = 403;
    error.publicMessage = 'Invalid customer session';
    throw error;
  }

  const result = await pool.query(
    `SELECT vs.id
     FROM video_sessions vs
     JOIN campaign_links cl ON cl.customer_id = vs.customer_id
     WHERE vs.id = $1
       AND cl.token = $2
       AND cl.status IN ('opened', 'completed')
     LIMIT 1`,
    [session_id, token]
  );

  if (!result.rowCount) {
    const error = new Error('Recording upload is not allowed for this session');
    error.statusCode = 403;
    error.publicMessage = 'Recording upload is not allowed for this session';
    throw error;
  }

  return true;
}


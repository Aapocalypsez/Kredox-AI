import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { logAuditEvent } from './auditService.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(agent) {
  return jwt.sign(
    {
      sub: agent.id,
      email: agent.email,
      role: agent.role,
      name: agent.name
    },
    env.jwtSecret,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

function signRefreshToken(agent) {
  return jwt.sign(
    {
      sub: agent.id,
      token_id: crypto.randomUUID(),
      role: agent.role
    },
    env.refreshJwtSecret,
    { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
  );
}

function publicAgent(agent) {
  return {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role
  };
}

async function issueSession(agent) {
  const accessToken = signAccessToken(agent);
  const refreshToken = signRefreshToken(agent);
  await persistRefreshToken(agent, refreshToken);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    agent: publicAgent(agent)
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    path: '/api/auth'
  };
}

async function persistRefreshToken(agent, refreshToken) {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  await pool.query(
    `INSERT INTO agent_refresh_tokens (agent_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [agent.id, hashToken(refreshToken), expiresAt]
  );
}

export async function loginAgent({ email, password, ipAddress, userAgent }) {
  const result = await pool.query(
    `SELECT id, email, name, password_hash, role
     FROM agents
     WHERE lower(email) = lower($1)`,
    [email]
  );

  const agent = result.rows[0];
  if (!agent || !(await bcrypt.compare(password, agent.password_hash))) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.publicMessage = 'Invalid email or password';
    throw error;
  }

  await Promise.all([
    pool.query(`UPDATE agents SET last_login_at = NOW() WHERE id = $1`, [agent.id])
  ]);

  logAuditEvent({
    event_type: 'AGENT_LOGIN',
    entity_type: 'agent',
    entity_id: agent.id,
    actor_id: agent.id,
    actor_type: 'agent',
    action: 'login',
    ip_address: ipAddress,
    user_agent: userAgent
  }).catch((error) => {
    console.error('Login audit logging failed', { error: error.message });
  });

  return issueSession(agent);
}

export async function registerAgent({ email, name, password, role = 'agent', ipAddress, userAgent }) {
  if (!env.allowPublicRegistration) {
    const error = new Error('Public registration is disabled');
    error.statusCode = 403;
    error.publicMessage = 'Public registration is disabled. Ask an admin to create your account.';
    throw error;
  }

  const normalizedRole = ['admin', 'agent', 'viewer'].includes(role) ? role : 'agent';
  const passwordHash = await bcrypt.hash(password, 12);

  let agent;
  try {
    const result = await pool.query(
      `INSERT INTO agents (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, name, passwordHash, normalizedRole]
    );
    agent = result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const duplicate = new Error('Agent already exists');
      duplicate.statusCode = 409;
      duplicate.publicMessage = 'An account with this email already exists';
      throw duplicate;
    }
    throw error;
  }

  logAuditEvent({
    event_type: 'AGENT_LOGIN',
    entity_type: 'agent',
    entity_id: agent.id,
    actor_id: agent.id,
    actor_type: 'agent',
    action: 'register',
    new_value: publicAgent(agent),
    ip_address: ipAddress,
    user_agent: userAgent
  }).catch((error) => {
    console.error('Registration audit logging failed', { error: error.message });
  });

  return issueSession(agent);
}

export async function refreshAgentSession(refreshToken) {
  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    error.publicMessage = 'Refresh token is required';
    throw error;
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.refreshJwtSecret);
  } catch {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    error.publicMessage = 'Invalid refresh token';
    throw error;
  }

  const result = await pool.query(
    `SELECT rt.id AS refresh_id, a.id, a.email, a.name, a.role
     FROM agent_refresh_tokens rt
     JOIN agents a ON a.id = rt.agent_id
     WHERE rt.token_hash = $1
       AND rt.revoked_at IS NULL
       AND rt.expires_at > NOW()
       AND a.id = $2`,
    [hashToken(refreshToken), payload.sub]
  );

  if (!result.rowCount) {
    const error = new Error('Refresh token is invalid or expired');
    error.statusCode = 401;
    error.publicMessage = 'Refresh token is invalid or expired';
    throw error;
  }

  const agent = result.rows[0];
  return {
    access_token: signAccessToken(agent),
    agent: publicAgent(agent)
  };
}

export async function logoutAgent(refreshToken, agentId = null) {
  if (refreshToken) {
    await pool.query(
      `UPDATE agent_refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1`,
      [hashToken(refreshToken)]
    );
  }

  if (agentId) {
    logAuditEvent({
      event_type: 'AGENT_LOGOUT',
      entity_type: 'agent',
      entity_id: agentId,
      actor_id: agentId,
      actor_type: 'agent',
      action: 'logout'
    }).catch((error) => {
      console.error('Logout audit logging failed', { error: error.message });
    });
  }
}

export async function findAgentById(agentId) {
  const result = await pool.query(
    `SELECT id, email, name, role
     FROM agents
     WHERE id = $1`,
    [agentId]
  );
  return result.rows[0] || null;
}

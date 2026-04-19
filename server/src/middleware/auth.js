import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { findAgentById } from '../services/authService.js';

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : null;
}

export async function authenticateAgent(req, _res, next) {
  const token = bearerToken(req);
  if (!token) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.publicMessage = 'Authentication required';
    return next(error);
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const agent = await findAgentById(payload.sub);
    if (!agent) {
      const error = new Error('Agent not found');
      error.statusCode = 401;
      error.publicMessage = 'Agent not found';
      throw error;
    }
    req.agent = agent;
    return next();
  } catch (error) {
    error.statusCode = error.statusCode || 401;
    error.publicMessage = error.publicMessage || 'Invalid or expired access token';
    return next(error);
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.agent) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.publicMessage = 'Authentication required';
      return next(error);
    }

    if (req.agent.role === 'admin' || roles.includes(req.agent.role)) {
      return next();
    }

    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    error.publicMessage = 'Insufficient permissions';
    return next(error);
  };
}

export function requireReadOnlyOrBetter(req, res, next) {
  return requireRole('viewer', 'agent')(req, res, next);
}

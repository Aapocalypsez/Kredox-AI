import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function createSignedLinkToken({ customerId, campaignId, expiryMinutes }) {
  const sessionToken = crypto.randomUUID();
  const token = jwt.sign(
    {
      customer_id: customerId,
      campaign_id: campaignId,
      session_token: sessionToken
    },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: `${expiryMinutes}m`
    }
  );

  return { token, sessionToken };
}

export function verifySignedLinkToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
}


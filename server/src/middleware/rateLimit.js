import rateLimit from 'express-rate-limit';

export const validateLinkRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    valid: false,
    reason: 'Too many validation attempts. Try again in one minute.'
  }
});


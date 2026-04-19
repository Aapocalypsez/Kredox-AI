import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { authenticateAgent } from '../middleware/auth.js';
import { loginAgent, logoutAgent, refreshAgentSession, refreshCookieOptions } from '../services/authService.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRouter = Router();

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await loginAgent({
      email: req.body.email,
      password: req.body.password,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.cookie('refresh_token', result.refresh_token, refreshCookieOptions());
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    res.json(await refreshAgentSession(req.cookies?.refresh_token));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', authenticateAgent, async (req, res, next) => {
  try {
    await logoutAgent(req.cookies?.refresh_token, req.agent.id);
    res.clearCookie('refresh_token', refreshCookieOptions());
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

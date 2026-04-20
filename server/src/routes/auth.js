import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { authenticateAgent } from '../middleware/auth.js';
import { loginAgent, logoutAgent, refreshAgentSession, refreshCookieOptions, registerAgent } from '../services/authService.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'agent', 'viewer']).default('agent')
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

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await registerAgent({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.cookie('refresh_token', result.refresh_token, refreshCookieOptions());
    res.status(201).json(result);
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

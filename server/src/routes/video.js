import { Router } from 'express';
import { authenticateAgent } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { videoTokenSchema, startVideoSessionSchema } from '../schemas/videoSchemas.js';
import { generateRtcToken } from '../services/agoraService.js';
import { endVideoSession, getVideoSession, startVideoSession } from '../services/videoSessionService.js';

export const videoRouter = Router();

videoRouter.post('/token', validateBody(videoTokenSchema), async (req, res, next) => {
  try {
    res.json(generateRtcToken(req.body));
  } catch (error) {
    next(error);
  }
});

videoRouter.post('/session/start', validateBody(startVideoSessionSchema), async (req, res, next) => {
  try {
    const { session, recording } = await startVideoSession(req.body);
    res.status(201).json({
      session_id: session.id,
      channel_name: session.channel_name,
      status: session.status,
      recording_url: session.recording_url,
      recording
    });
  } catch (error) {
    next(error);
  }
});

function ensureOwnSession(req, session) {
  if (req.agent.role === 'admin' || session.agent_id === req.agent.id || session.agent_id === req.agent.email) return;
  const error = new Error('Agents can only access their own sessions');
  error.statusCode = 403;
  error.publicMessage = 'Agents can only access their own sessions';
  throw error;
}

videoRouter.get('/session/:id', authenticateAgent, async (req, res, next) => {
  try {
    const session = await getVideoSession(req.params.id);
    ensureOwnSession(req, session);
    res.json({ session });
  } catch (error) {
    next(error);
  }
});

videoRouter.post('/session/:id/end', async (req, res, next) => {
  try {
    res.json(await endVideoSession(req.params.id));
  } catch (error) {
    next(error);
  }
});

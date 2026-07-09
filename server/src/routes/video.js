import multer from 'multer';
import { Router } from 'express';
import { authenticateAgent } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { videoTokenSchema, startVideoSessionSchema } from '../schemas/videoSchemas.js';
import { logAuditEvent } from '../services/auditService.js';
import { generateRtcToken } from '../services/agoraService.js';
import { verifyCampaignSessionAccess } from '../services/linkService.js';
import { reprocessVideoSessionArtifacts } from '../services/postProcessingService.js';
import { uploadRecording } from '../services/storageService.js';
import { endVideoSession, getVideoSession, startVideoSession } from '../services/videoSessionService.js';

export const videoRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 500 }
});

videoRouter.post('/token', validateBody(videoTokenSchema), async (req, res, next) => {
  try {
    res.json(generateRtcToken(req.body));
  } catch (error) {
    next(error);
  }
});

videoRouter.post('/session/start', validateBody(startVideoSessionSchema), async (req, res, next) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const { session, recording } = await startVideoSession({ ...req.body, ip_address: ipAddress });
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

videoRouter.post('/session/:id/recording', upload.single('recording'), async (req, res, next) => {
  try {
    await verifyCampaignSessionAccess({
      token: req.body.token,
      session_token: req.body.session_token,
      session_id: req.params.id
    });

    res.status(201).json(await uploadRecording({
      sessionId: req.params.id,
      file: req.file
    }));
  } catch (error) {
    next(error);
  }
});

function ensureOwnSession(req, session) {
  if (!session.agent_id) return;
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

videoRouter.post('/session/:id/flag', authenticateAgent, async (req, res, next) => {
  try {
    const session = await getVideoSession(req.params.id);
    ensureOwnSession(req, session);
    const reason = String(req.body?.reason || 'Agent flagged session').slice(0, 500);
    await logAuditEvent({
      event_type: 'SESSION_FLAGGED',
      entity_type: 'video_session',
      entity_id: req.params.id,
      actor_id: req.agent.id,
      actor_type: 'agent',
      action: 'flag_session',
      new_value: { reason }
    });
    res.json({ ok: true, flagged: true, session_id: req.params.id, reason });
  } catch (error) {
    next(error);
  }
});

videoRouter.post('/session/:id/note', authenticateAgent, async (req, res, next) => {
  try {
    const session = await getVideoSession(req.params.id);
    ensureOwnSession(req, session);
    const note = String(req.body?.note || '').trim();
    if (!note) {
      const error = new Error('Session note is required');
      error.statusCode = 400;
      error.publicMessage = 'Session note is required';
      throw error;
    }
    await logAuditEvent({
      event_type: 'SESSION_NOTE_ADDED',
      entity_type: 'video_session',
      entity_id: req.params.id,
      actor_id: req.agent.id,
      actor_type: 'agent',
      action: 'add_note',
      new_value: { note: note.slice(0, 1000) }
    });
    res.json({ ok: true, noted: true, session_id: req.params.id });
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

videoRouter.post('/session/:id/reprocess', authenticateAgent, async (req, res, next) => {
  try {
    const session = await getVideoSession(req.params.id);
    ensureOwnSession(req, session);
    res.json(await reprocessVideoSessionArtifacts(req.params.id));
  } catch (error) {
    next(error);
  }
});

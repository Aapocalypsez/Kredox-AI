import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { analyzeFrameSchema } from '../schemas/cvSchemas.js';
import { analyzeFrame, getCvSessionSummary } from '../services/cvAnalysisService.js';

export const cvRouter = Router();

cvRouter.post('/analyze-frame', validateBody(analyzeFrameSchema), async (req, res, next) => {
  try {
    res.json(await analyzeFrame(req.body));
  } catch (error) {
    next(error);
  }
});

cvRouter.get('/session/:session_id/summary', async (req, res, next) => {
  try {
    res.json(await getCvSessionSummary(req.params.session_id));
  } catch (error) {
    next(error);
  }
});


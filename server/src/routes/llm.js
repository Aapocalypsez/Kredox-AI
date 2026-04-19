import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { analyzeLlmSchema, explainOfferSchema } from '../schemas/llmSchemas.js';
import {
  analyzeSessionRisk,
  explainOffer,
  getStoredRiskAnalysis,
  streamSessionRiskAnalysis
} from '../services/llmAnalysisService.js';

export const llmRouter = Router();

function sendSse(res, event) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

llmRouter.post('/analyze', validateBody(analyzeLlmSchema), async (req, res, next) => {
  try {
    if (req.query.stream === 'true') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      });

      sendSse(res, { type: 'progress', step: 'Transcript compiled', status: 'complete' });
      sendSse(res, { type: 'progress', step: 'CV data merged', status: 'complete' });
      sendSse(res, { type: 'progress', step: 'Risk model running', status: 'running' });

      await streamSessionRiskAnalysis({
        session_id: req.body.session_id,
        onEvent: (event) => sendSse(res, event)
      });

      sendSse(res, { type: 'done' });
      res.end();
      return;
    }

    res.json(await analyzeSessionRisk(req.body));
  } catch (error) {
    next(error);
  }
});

llmRouter.get('/analysis/:session_id', async (req, res, next) => {
  try {
    res.json(await getStoredRiskAnalysis(req.params.session_id));
  } catch (error) {
    next(error);
  }
});

llmRouter.post('/explain-offer', validateBody(explainOfferSchema), async (req, res, next) => {
  try {
    res.json(await explainOffer(req.body));
  } catch (error) {
    next(error);
  }
});


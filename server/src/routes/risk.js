import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { finalScoreSchema, policyCheckSchema } from '../schemas/riskSchemas.js';
import { calculateFinalRiskScore, runPolicyCheck } from '../services/riskPolicyService.js';

export const riskRouter = Router();

riskRouter.post('/policy-check', validateBody(policyCheckSchema), async (req, res, next) => {
  try {
    res.json(await runPolicyCheck(req.body));
  } catch (error) {
    next(error);
  }
});

riskRouter.post('/final-score', validateBody(finalScoreSchema), async (req, res, next) => {
  try {
    res.json(await calculateFinalRiskScore(req.body));
  } catch (error) {
    next(error);
  }
});


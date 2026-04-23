import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { compileApplicationSchema, patchApplicationFieldSchema } from '../schemas/applicationSchemas.js';
import { compileLoanApplication, getLatestLoanApplication, patchApplicationField } from '../services/applicationCompileService.js';

export const applicationRouter = Router();

applicationRouter.post('/compile', validateBody(compileApplicationSchema), async (req, res, next) => {
  try {
    res.status(201).json(await compileLoanApplication(req.body));
  } catch (error) {
    next(error);
  }
});

applicationRouter.get('/session/:session_id', async (req, res, next) => {
  try {
    res.json(await getLatestLoanApplication(req.params.session_id));
  } catch (error) {
    next(error);
  }
});

applicationRouter.patch('/:id/field', validateBody(patchApplicationFieldSchema), async (req, res, next) => {
  try {
    res.json(await patchApplicationField(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
});


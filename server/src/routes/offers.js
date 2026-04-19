import { Router } from 'express';
import { authenticateAgent, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { generateOfferSchema } from '../schemas/offerSchemas.js';
import {
  acceptLoanOffer,
  generateLoanOffer,
  getPublicLoanOffer,
  presentLoanOffer,
  rejectLoanOffer
} from '../services/offerGenerationService.js';

export const offersRouter = Router();

offersRouter.post('/generate', authenticateAgent, requireRole('agent'), validateBody(generateOfferSchema), async (req, res, next) => {
  try {
    res.status(201).json(await generateLoanOffer(req.body));
  } catch (error) {
    next(error);
  }
});

offersRouter.get('/public/:token', async (req, res, next) => {
  try {
    res.json(await getPublicLoanOffer(req.params.token));
  } catch (error) {
    next(error);
  }
});

offersRouter.post('/:id/present', authenticateAgent, requireRole('agent'), async (req, res, next) => {
  try {
    res.json(await presentLoanOffer(req.params.id, req.body?.channel || 'sms'));
  } catch (error) {
    next(error);
  }
});

offersRouter.post('/:id/accept', async (req, res, next) => {
  try {
    res.json(await acceptLoanOffer(req.params.id));
  } catch (error) {
    next(error);
  }
});

offersRouter.post('/:id/reject', authenticateAgent, requireRole('agent'), async (req, res, next) => {
  try {
    res.json(await rejectLoanOffer(req.params.id));
  } catch (error) {
    next(error);
  }
});

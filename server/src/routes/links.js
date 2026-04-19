import { Router } from 'express';
import { validateLinkRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { completeLinkSchema } from '../schemas/campaignSchemas.js';
import { completeCampaignLink, validateCampaignLink } from '../services/linkService.js';

export const linksRouter = Router();

linksRouter.get('/validate/:token', validateLinkRateLimiter, async (req, res, next) => {
  try {
    const result = await validateCampaignLink(req.params.token);
    res.status(result.valid ? 200 : 400).json(result);
  } catch (error) {
    next(error);
  }
});

linksRouter.post('/complete', validateBody(completeLinkSchema), async (req, res, next) => {
  try {
    const result = await completeCampaignLink(req.body);
    res.status(result.completed ? 200 : 400).json(result);
  } catch (error) {
    next(error);
  }
});


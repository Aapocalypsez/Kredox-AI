import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { createCampaignSchema } from '../schemas/campaignSchemas.js';
import {
  createCampaign,
  getCampaignLinks,
  getCampaignStats,
  listCampaigns
} from '../services/campaignService.js';
import { getMessagingStatus } from '../services/messagingService.js';

export const campaignRouter = Router();

campaignRouter.post('/create', validateBody(createCampaignSchema), async (req, res, next) => {
  try {
    const result = await createCampaign(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

campaignRouter.get('/', async (_req, res, next) => {
  try {
    res.json({ campaigns: await listCampaigns() });
  } catch (error) {
    next(error);
  }
});

campaignRouter.get('/messaging-status', (_req, res) => {
  res.json(getMessagingStatus());
});

async function statsHandler(req, res, next) {
  try {
    res.json(await getCampaignStats(req.params.id));
  } catch (error) {
    next(error);
  }
}

campaignRouter.post('/:id/stats', statsHandler);
campaignRouter.get('/:id/stats', statsHandler);

campaignRouter.get('/:id/links', async (req, res, next) => {
  try {
    res.json({ links: await getCampaignLinks(req.params.id) });
  } catch (error) {
    next(error);
  }
});


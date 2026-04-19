import { Router } from 'express';
import { getActivityFeed } from '../services/reportingService.js';

export const activityRouter = Router();

activityRouter.get('/feed', async (req, res, next) => {
  try {
    res.json({ activity: await getActivityFeed(req.query) });
  } catch (error) {
    next(error);
  }
});

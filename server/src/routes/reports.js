import { Router } from 'express';
import { getAgentPerformance, getDailySummary, getDashboardAnalytics } from '../services/reportingService.js';

export const reportsRouter = Router();

reportsRouter.get('/daily-summary', async (req, res, next) => {
  try {
    res.json(await getDailySummary(req.query.date));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/agent-performance', async (req, res, next) => {
  try {
    res.json(await getAgentPerformance(req.query));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/dashboard', async (_req, res, next) => {
  try {
    res.json(await getDashboardAnalytics());
  } catch (error) {
    next(error);
  }
});

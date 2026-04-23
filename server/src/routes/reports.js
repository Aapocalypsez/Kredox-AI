import { Router } from 'express';
import {
  getAgentPerformance,
  getDailySummary,
  getDashboardAnalytics,
  getSessionReport,
  listRecentApplications
} from '../services/reportingService.js';

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

reportsRouter.get('/applications', async (req, res, next) => {
  try {
    res.json({ applications: await listRecentApplications(req.query) });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/session/:session_id', async (req, res, next) => {
  try {
    res.json(await getSessionReport(req.params.session_id));
  } catch (error) {
    next(error);
  }
});

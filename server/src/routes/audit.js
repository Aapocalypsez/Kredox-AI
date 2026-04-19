import { Router } from 'express';
import { fetchAuditTrail } from '../services/auditService.js';

export const auditRouter = Router();

auditRouter.get('/logs', async (req, res, next) => {
  try {
    const logs = await fetchAuditTrail(req.query);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

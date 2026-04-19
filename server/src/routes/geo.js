import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { verifyGeoSchema } from '../schemas/geoSchemas.js';
import { getGeoSessionReport, verifyGeoLocation } from '../services/geoVerificationService.js';

export const geoRouter = Router();

geoRouter.post('/verify', validateBody(verifyGeoSchema), async (req, res, next) => {
  try {
    const ipAddress = req.body.ip_address || req.ip;
    res.json(await verifyGeoLocation({ ...req.body, ip_address: ipAddress }));
  } catch (error) {
    next(error);
  }
});

geoRouter.get('/session/:session_id/report', async (req, res, next) => {
  try {
    res.json(await getGeoSessionReport(req.params.session_id));
  } catch (error) {
    next(error);
  }
});


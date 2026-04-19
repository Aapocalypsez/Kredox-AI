import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { authenticateAgent, requireReadOnlyOrBetter, requireRole } from './middleware/auth.js';
import { auditLogger } from './services/auditService.js';
import { applicationRouter } from './routes/application.js';
import { activityRouter } from './routes/activity.js';
import { auditRouter } from './routes/audit.js';
import { authRouter } from './routes/auth.js';
import { campaignRouter } from './routes/campaigns.js';
import { cvRouter } from './routes/cv.js';
import { geoRouter } from './routes/geo.js';
import { linksRouter } from './routes/links.js';
import { llmRouter } from './routes/llm.js';
import { offersRouter } from './routes/offers.js';
import { reportsRouter } from './routes/reports.js';
import { riskRouter } from './routes/risk.js';
import { searchRouter } from './routes/search.js';
import { storageRouter } from './routes/storage.js';
import { videoRouter } from './routes/video.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(auditLogger);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'kredox-ai-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/campaigns', authenticateAgent, requireRole('agent'), campaignRouter);
app.use('/api/application', authenticateAgent, requireRole('agent'), applicationRouter);
app.use('/api/activity', authenticateAgent, requireReadOnlyOrBetter, activityRouter);
app.use('/api/audit', authenticateAgent, requireRole('admin'), auditRouter);
app.use('/api/cv', authenticateAgent, requireRole('agent'), cvRouter);
app.use('/api/geo', geoRouter);
app.use('/api/links', linksRouter);
app.use('/api/llm', authenticateAgent, requireRole('agent'), llmRouter);
app.use('/api/offers', offersRouter);
app.use('/api/reports', authenticateAgent, requireReadOnlyOrBetter, reportsRouter);
app.use('/api/risk', authenticateAgent, requireRole('agent'), riskRouter);
app.use('/api/search', authenticateAgent, requireRole('admin'), searchRouter);
app.use('/api/storage', authenticateAgent, requireRole('admin'), storageRouter);
app.use('/api/video', videoRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

app.use((error, _req, res, _next) => {
  if (error.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation failed', details: error.flatten() });
  }

  console.error(error);
  return res.status(error.statusCode || 500).json({
    error: error.publicMessage || 'Internal server error'
  });
});

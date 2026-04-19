import { Router } from 'express';
import { searchTranscripts } from '../services/searchService.js';

export const searchRouter = Router();

searchRouter.get('/transcripts', async (req, res, next) => {
  try {
    res.json(await searchTranscripts(req.query));
  } catch (error) {
    next(error);
  }
});

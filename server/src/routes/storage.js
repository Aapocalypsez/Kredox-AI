import multer from 'multer';
import { Router } from 'express';
import { getRecordingPlayback, uploadRecording } from '../services/storageService.js';

export const storageRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 500 }
});

storageRouter.post('/upload-recording', upload.single('recording'), async (req, res, next) => {
  try {
    res.status(201).json(await uploadRecording({
      sessionId: req.body.session_id,
      file: req.file
    }));
  } catch (error) {
    next(error);
  }
});

storageRouter.get('/recording/:session_id', async (req, res, next) => {
  try {
    res.json(await getRecordingPlayback(req.params.session_id));
  } catch (error) {
    next(error);
  }
});

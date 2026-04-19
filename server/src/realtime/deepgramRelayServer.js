import { WebSocket, WebSocketServer } from 'ws';
import { URL } from 'node:url';
import { env } from '../config/env.js';
import { extractTranscriptEntities } from '../services/entityExtractionService.js';
import { logAuditEvent } from '../services/auditService.js';
import { saveFinalTranscript } from '../services/transcriptStore.js';

const deepgramOptions = {
  model: 'nova-2',
  language: 'hi-en',
  smart_format: 'true',
  diarize: 'true',
  punctuate: 'true',
  interim_results: 'true',
  endpointing: '300'
};

function deepgramUrl() {
  const params = new URLSearchParams(deepgramOptions);
  return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
}

function sendJson(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function parseSessionId(req) {
  const url = new URL(req.url || '/', `ws://${req.headers.host || 'localhost'}`);
  return url.searchParams.get('sessionId');
}

function parseDeepgramTranscript(message) {
  const payload = JSON.parse(message.toString());
  if (payload.type !== 'Results') return null;

  const alternative = payload.channel?.alternatives?.[0];
  const transcript = alternative?.transcript?.trim();
  if (!transcript) return null;

  const words = alternative.words || [];
  const speaker = words.find((word) => word.speaker !== undefined)?.speaker ?? null;

  return {
    transcript,
    confidence: alternative.confidence ?? null,
    words,
    speaker,
    is_final: Boolean(payload.is_final)
  };
}

async function handleFinalTranscript(browserWs, sessionId, transcriptData) {
  await saveFinalTranscript({
    sessionId,
    speaker: transcriptData.speaker,
    text: transcriptData.transcript,
    confidence: transcriptData.confidence
  });

  for (const entity of extractTranscriptEntities(transcriptData.transcript)) {
    logAuditEvent({
      event_type: 'ENTITY_DETECTED',
      entity_type: 'video_session',
      entity_id: sessionId,
      actor_type: 'system',
      action: 'detect_entity',
      new_value: entity
    }).catch((error) => {
      console.error('Entity audit logging failed', { error: error.message });
    });
    sendJson(browserWs, {
      type: 'entity_detected',
      ...entity,
      transcript: transcriptData.transcript,
      speaker: transcriptData.speaker
    });
  }
}

export function startDeepgramRelayServer(server = null) {
  const wss = server ? new WebSocketServer({ server }) : new WebSocketServer({ port: env.deepgram.wsPort });

  wss.on('error', (error) => {
    console.error(`Kredox AI Deepgram relay error on port ${env.deepgram.wsPort}`, error);
  });

  wss.on('connection', (browserWs, req) => {
    const sessionId = parseSessionId(req);

    if (!sessionId) {
      sendJson(browserWs, { type: 'error', message: 'sessionId is required' });
      browserWs.close(1008, 'sessionId is required');
      return;
    }

    if (!env.deepgram.apiKey) {
      sendJson(browserWs, {
        type: 'stt_connection',
        status: 'browser_fallback',
        provider: 'web_speech',
        message: 'Deepgram is not configured; browser speech recognition fallback is enabled.'
      });

      browserWs.on('message', async (message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.type !== 'browser_transcript' || !payload.transcript?.trim()) return;
          const transcriptData = {
            transcript: payload.transcript.trim(),
            confidence: payload.confidence ?? null,
            words: [],
            speaker: payload.speaker ?? 'browser',
            is_final: payload.is_final !== false
          };
          sendJson(browserWs, { type: 'transcript', ...transcriptData });
          if (transcriptData.is_final) {
            await handleFinalTranscript(browserWs, sessionId, transcriptData);
          }
        } catch {
          // Ignore binary audio or malformed fallback messages.
        }
      });
      return;
    }

    const deepgramWs = new WebSocket(deepgramUrl(), {
      headers: {
        Authorization: `Token ${env.deepgram.apiKey}`
      }
    });

    deepgramWs.on('open', () => {
      sendJson(browserWs, {
        type: 'stt_connection',
        status: 'connected',
        provider: 'deepgram',
        config: {
          model: deepgramOptions.model,
          language: deepgramOptions.language,
          diarize: true,
          interim_results: true
        }
      });
    });

    deepgramWs.on('message', async (message) => {
      try {
        const transcriptData = parseDeepgramTranscript(message);
        if (!transcriptData) return;

        sendJson(browserWs, {
          type: 'transcript',
          ...transcriptData
        });

        if (transcriptData.is_final) {
          await handleFinalTranscript(browserWs, sessionId, transcriptData);
        }
      } catch (error) {
        sendJson(browserWs, {
          type: 'error',
          message: 'Failed to process Deepgram transcript'
        });
        console.error(error);
      }
    });

    deepgramWs.on('close', () => {
      sendJson(browserWs, { type: 'stt_connection', status: 'disconnected' });
    });

    deepgramWs.on('error', (error) => {
      sendJson(browserWs, {
        type: 'stt_connection',
        status: 'browser_fallback',
        provider: 'web_speech',
        message: 'Deepgram connection failed; switch to browser speech recognition if available.'
      });
      console.error('Deepgram WebSocket error', error);
    });

    browserWs.on('message', (message, isBinary) => {
      if (!isBinary) {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.type === 'keepalive' && deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
          }
        } catch {
          // Ignore non-binary control messages that are not JSON.
        }
        return;
      }

      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(message);
      }
    });

    browserWs.on('close', () => {
      if (deepgramWs.readyState === WebSocket.OPEN || deepgramWs.readyState === WebSocket.CONNECTING) {
        deepgramWs.close();
      }
    });
  });

  console.log(
    server
      ? `Kredox AI STT relay attached to API port ${env.port}`
      : `Kredox AI STT relay listening on ws://localhost:${env.deepgram.wsPort}`
  );
  return wss;
}

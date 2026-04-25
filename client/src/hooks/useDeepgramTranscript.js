import { useCallback, useEffect, useRef, useState } from 'react';

function cleanUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function toWebSocketUrl(value) {
  const base = cleanUrl(value);
  if (!base) return '';
  if (base.startsWith('wss://') || base.startsWith('ws://')) return base;
  if (base.startsWith('https://')) return `wss://${base.slice('https://'.length)}`;
  if (base.startsWith('http://')) return `ws://${base.slice('http://'.length)}`;
  return base;
}

function resolveTranscriptWsUrl() {
  const explicit = toWebSocketUrl(import.meta.env.VITE_TRANSCRIPT_WS_URL);
  if (explicit) return explicit;

  const apiBase = import.meta.env.VITE_NODE_API || import.meta.env.VITE_API_BASE_URL;
  const derived = toWebSocketUrl(apiBase);
  if (derived && !/dummy-api|placeholder|your-backend/i.test(derived)) return derived;

  return import.meta.env.PROD ? 'wss://kredox-ai.onrender.com' : 'ws://localhost:4000';
}

const WS_URL = resolveTranscriptWsUrl();

function audioBufferTo16BitPcm(audioBuffer) {
  const channel = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(channel.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < channel.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channel[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

function normalizeChunk(chunk) {
  if (!chunk) return null;
  if (chunk instanceof ArrayBuffer || chunk instanceof Blob) return chunk;
  if (ArrayBuffer.isView(chunk)) return chunk.buffer;
  if (typeof AudioBuffer !== 'undefined' && chunk instanceof AudioBuffer) return audioBufferTo16BitPcm(chunk);
  if (chunk.data) return normalizeChunk(chunk.data);
  if (chunk.buffer) return chunk.buffer;
  return null;
}

export function useDeepgramTranscript(sessionId, audioTracks = [], enabled = true) {
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const recognitionRef = useRef(null);
  const [transcript, setTranscript] = useState([]);
  const [entities, setEntities] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const hasAudioTracks = audioTracks.filter(Boolean).length > 0;

  const startBrowserSpeechFallback = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result?.[0]?.transcript?.trim();
      if (!text) return;

      const payload = {
        type: 'browser_transcript',
        transcript: text,
        confidence: result[0]?.confidence,
        speaker: 'Customer',
        is_final: result.isFinal
      };

      setTranscript((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          text,
          speaker: 'Customer',
          confidence: payload.confidence,
          words: [],
          is_final: Boolean(result.isFinal),
          fallback: true,
          received_at: new Date().toISOString()
        }
      ]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    };

    recognition.onerror = () => setWsStatus('browser_fallback_error');
    recognition.onend = () => {
      if (shouldReconnectRef.current) {
        try {
          recognition.start();
        } catch {
          setWsStatus('browser_fallback_error');
        }
      }
    };

    recognitionRef.current = recognition;
    setIsFallbackMode(true);
    setWsStatus('browser_fallback');
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setWsStatus('browser_fallback_error');
    }
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    shouldReconnectRef.current = true;
    setWsStatus('connecting');
    const url = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}sessionId=${encodeURIComponent(sessionId)}`;
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.onopen = () => {
      retryRef.current = 0;
      setIsConnected(true);
      setWsStatus('connected');
      socket.send(JSON.stringify({ type: 'session_start', session_id: sessionId }));
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'transcript') {
          setTranscript((current) => [
            ...current,
            {
              id: `${Date.now()}-${current.length}`,
              text: payload.text || payload.transcript || '',
              speaker: payload.speaker || 'Customer',
              confidence: payload.confidence,
              words: payload.words || [],
              is_final: Boolean(payload.is_final),
              received_at: new Date().toISOString()
            }
          ]);
        }

        if (payload.type === 'stt_connection' && payload.status === 'browser_fallback') {
          startBrowserSpeechFallback();
        }

        if (payload.type === 'entity_detected') {
          setEntities((current) => ({
            ...current,
            [payload.field]: {
              value: payload.value,
              confidence: payload.confidence,
              updated_at: new Date().toISOString()
            }
          }));
        }
      } catch {
        setWsStatus('message_error');
      }
    };

    socket.onerror = () => {
      setWsStatus('failed');
      startBrowserSpeechFallback();
    };

    socket.onclose = () => {
      setIsConnected(false);
      setWsStatus('disconnected');
      if (shouldReconnectRef.current && retryRef.current < 3) {
        retryRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, 2000);
      } else if (shouldReconnectRef.current) {
        startBrowserSpeechFallback();
      }
    };
  }, [sessionId, startBrowserSpeechFallback]);

  const sendAudioChunk = useCallback((chunk) => {
    const payload = normalizeChunk(chunk);
    if (wsRef.current?.readyState === WebSocket.OPEN && payload) {
      wsRef.current.send(payload);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [connect, enabled]);

  useEffect(() => {
    if (!enabled || !isConnected) return undefined;

    const cleanups = audioTracks
      .filter(Boolean)
      .map((track) => {
        const handler = (chunk) => sendAudioChunk(chunk);
        if (typeof track.on === 'function') {
          track.on('audio-buffer', handler);
        }

        return () => {
          if (typeof track.off === 'function') {
            track.off('audio-buffer', handler);
          } else if (typeof track.removeListener === 'function') {
            track.removeListener('audio-buffer', handler);
          }
        };
      });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [audioTracks, enabled, isConnected, sendAudioChunk]);

  useEffect(() => {
    if (wsStatus === 'failed' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      startBrowserSpeechFallback();
    }
  }, [startBrowserSpeechFallback, wsStatus]);

  useEffect(() => {
    if (enabled && isConnected && !hasAudioTracks && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      startBrowserSpeechFallback();
    }
  }, [enabled, hasAudioTracks, isConnected, startBrowserSpeechFallback]);

  return { transcript, entities, isConnected, wsStatus, sendAudioChunk, isFallbackMode };
}

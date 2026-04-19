import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = import.meta.env.VITE_TRANSCRIPT_WS_URL || 'ws://localhost:5000';

export function useDeepgramTranscript(sessionId) {
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const recognitionRef = useRef(null);
  const [transcript, setTranscript] = useState([]);
  const [entities, setEntities] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');

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
        speaker: 'Browser',
        is_final: result.isFinal
      };

      setTranscript((current) => [
        ...current,
        {
          id: `${Date.now()}-${current.length}`,
          text,
          speaker: 'Browser',
          confidence: payload.confidence,
          words: [],
          is_final: Boolean(result.isFinal),
          received_at: new Date().toISOString()
        }
      ]);

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    };

    recognition.onerror = () => setWsStatus('browser_fallback_error');
    recognition.onend = () => {
      if (shouldReconnectRef.current) recognition.start();
    };

    recognitionRef.current = recognition;
    setWsStatus('browser_fallback');
    recognition.start();
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;

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
    if (wsRef.current?.readyState === WebSocket.OPEN && chunk) {
      wsRef.current.send(chunk);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, [connect]);

  return { transcript, entities, isConnected, wsStatus, sendAudioChunk };
}

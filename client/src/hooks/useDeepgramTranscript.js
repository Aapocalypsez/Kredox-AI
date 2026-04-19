import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = import.meta.env.VITE_TRANSCRIPT_WS_URL || 'ws://localhost:8080';

export function useDeepgramTranscript(sessionId) {
  const wsRef = useRef(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);
  const [transcript, setTranscript] = useState([]);
  const [entities, setEntities] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [wsStatus, setWsStatus] = useState('idle');

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
      }
    };
  }, [sessionId]);

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
    };
  }, [connect]);

  return { transcript, entities, isConnected, wsStatus, sendAudioChunk };
}

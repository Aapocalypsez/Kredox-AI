import { useCallback, useEffect, useMemo, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

function transcriptWsUrl(sessionId) {
  const configured = import.meta.env.VITE_TRANSCRIPT_WS_URL;
  if (configured) {
    return `${configured.replace(/\/+$/, '')}?sessionId=${encodeURIComponent(sessionId)}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:5000?sessionId=${encodeURIComponent(sessionId)}`;
}

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
  if (typeof AudioBuffer !== 'undefined' && chunk instanceof AudioBuffer) {
    return audioBufferTo16BitPcm(chunk);
  }
  if (chunk.data) return normalizeChunk(chunk.data);
  if (chunk.buffer) return chunk.buffer;
  return null;
}

function speakerLabel(speaker) {
  if (speaker === null || speaker === undefined) return 'Customer';
  return Number(speaker) === 1 ? 'Agent' : 'Customer';
}

export function useDeepgramTranscript(sessionId, audioTracks = [], enabled = true) {
  const [transcripts, setTranscripts] = useState([]);
  const [entities, setEntities] = useState({});
  const [events, setEvents] = useState([]);
  const socketUrl = useMemo(() => (sessionId && enabled ? transcriptWsUrl(sessionId) : null), [sessionId, enabled]);
  const { lastJsonMessage, readyState, getWebSocket, sendJsonMessage } = useWebSocket(socketUrl, {
    shouldReconnect: () => Boolean(enabled),
    reconnectAttempts: 20,
    reconnectInterval: 1500,
    share: false
  });

  const sendAudioChunk = useCallback(
    (chunk) => {
      const payload = normalizeChunk(chunk);
      const socket = getWebSocket();

      if (payload && socket?.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    },
    [getWebSocket]
  );

  useEffect(() => {
    if (!lastJsonMessage) return;

    if (lastJsonMessage.type === 'transcript') {
      setTranscripts((current) => [
        ...current.slice(-80),
        {
          id: `${Date.now()}-${Math.random()}`,
          transcript: lastJsonMessage.transcript,
          confidence: lastJsonMessage.confidence,
          words: lastJsonMessage.words || [],
          speaker: speakerLabel(lastJsonMessage.speaker),
          is_final: lastJsonMessage.is_final
        }
      ]);
    }

    if (lastJsonMessage.type === 'entity_detected') {
      const entity = {
        field: lastJsonMessage.field,
        value: lastJsonMessage.value,
        display_value: lastJsonMessage.display_value || lastJsonMessage.value,
        transcript: lastJsonMessage.transcript,
        speaker: speakerLabel(lastJsonMessage.speaker),
        detected_at: Date.now()
      };

      setEntities((current) => ({
        ...current,
        [entity.field]: entity
      }));
      setEvents((current) => [...current.slice(-40), entity]);
    }
  }, [lastJsonMessage]);

  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return undefined;

    const interval = window.setInterval(() => {
      sendJsonMessage({ type: 'keepalive' });
    }, 8000);

    return () => window.clearInterval(interval);
  }, [readyState, sendJsonMessage]);

  useEffect(() => {
    if (!enabled || readyState !== ReadyState.OPEN) return undefined;

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
  }, [audioTracks, enabled, readyState, sendAudioChunk]);

  return {
    transcripts,
    entities,
    entityEvents: events,
    sendAudioChunk,
    connectionStatus: readyState === ReadyState.OPEN ? 'transcribing' : 'disconnected',
    readyState
  };
}

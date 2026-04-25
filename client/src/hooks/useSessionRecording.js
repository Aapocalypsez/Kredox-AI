import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { storageAPI } from '../api/index.js';

export function useSessionRecording(sessionId, stream, enabled = true) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const uploadedRef = useRef(false);
  const [status, setStatus] = useState('idle');
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    if (!enabled || !sessionId || !stream) return undefined;
    if (uploadedRef.current || recorderRef.current) return undefined;
    if (typeof MediaRecorder === 'undefined') {
      setStatus('unsupported');
      return undefined;
    }

    const hasTracks = typeof stream.getTracks === 'function' && stream.getTracks().length > 0;
    if (!hasTracks) return undefined;

    let cancelled = false;

    const uploadRecording = async () => {
      if (!chunksRef.current.length || uploadedRef.current) return;
      try {
        setStatus('uploading');
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
        const file = new File([blob], `kredox-session-${sessionId}.webm`, {
          type: blob.type || 'video/webm'
        });
        const result = await storageAPI.uploadRecording(sessionId, file);
        if (cancelled) return;
        uploadedRef.current = true;
        setUploadResult(result);
        setStatus(result?.playback_url ? 'uploaded' : 'stored_without_playback');
        toast.success(result?.playback_url ? 'Call recording uploaded' : 'Call recording captured');
      } catch (error) {
        if (cancelled) return;
        setStatus('failed');
        toast.error(error.response?.data?.error || 'Automatic recording upload failed');
      } finally {
        chunksRef.current = [];
      }
    };

    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        if (!cancelled) {
          setStatus('failed');
          toast.error('Automatic recording failed');
        }
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        void uploadRecording();
      };

      recorder.start(1000);
      setStatus('recording');
    } catch {
      setStatus('failed');
      toast.error('This browser could not start automatic call recording');
    }

    return () => {
      cancelled = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
    };
  }, [enabled, sessionId, stream]);

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setStatus('stopping');
    }
  };

  return {
    status,
    uploadResult,
    stopRecording
  };
}

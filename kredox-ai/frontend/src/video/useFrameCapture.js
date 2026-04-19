import { useEffect, useRef, useState } from 'react';
import { analyzeCvFrame } from '../api.js';

function emotionMeta(type) {
  const normalized = String(type || 'CALM').toUpperCase();
  if (normalized === 'ANGRY') return { label: 'Angry', icon: '😠', tone: 'angry' };
  if (normalized === 'CONFUSED' || normalized === 'FEAR' || normalized === 'SURPRISED') {
    return { label: 'Confused', icon: '😟', tone: 'confused' };
  }
  return { label: 'Calm', icon: '😐', tone: 'calm' };
}

export function useFrameCapture(videoElement, sessionId, enabled = true) {
  const frameNumberRef = useRef(0);
  const [latestAnalysis, setLatestAnalysis] = useState(null);
  const [summary, setSummary] = useState({
    total_frames_analyzed: 0,
    average_liveness_score: 0,
    flag_count: 0,
    most_common_age_estimate: null
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoElement || !sessionId || !enabled) return undefined;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    async function captureFrame() {
      if (!context || !videoElement.videoWidth || !videoElement.videoHeight || cancelled) return;

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
      frameNumberRef.current += 1;

      try {
        setIsAnalyzing(true);
        const analysis = await analyzeCvFrame({
          session_id: sessionId,
          image_base64: imageBase64,
          frame_number: frameNumberRef.current
        });

        if (cancelled) return;

        setLatestAnalysis({
          ...analysis,
          frame_number: frameNumberRef.current,
          dominant_emotion: emotionMeta(analysis.emotions?.[0]?.type)
        });
        setSummary((current) => ({
          total_frames_analyzed: current.total_frames_analyzed + 1,
          average_liveness_score: Math.round(
            ((current.average_liveness_score || 0) * current.total_frames_analyzed + analysis.liveness_score) /
              (current.total_frames_analyzed + 1)
          ),
          flag_count: current.flag_count + (analysis.age_flag ? 1 : 0),
          most_common_age_estimate: analysis.age_range || current.most_common_age_estimate
        }));
        setError(null);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError);
        }
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    }

    const interval = window.setInterval(captureFrame, 3000);
    captureFrame();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [videoElement, sessionId, enabled]);

  return {
    latestAnalysis,
    summary,
    isAnalyzing,
    error
  };
}


import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { cvAPI } from '../api/index.js';

export function useFrameCapture(videoRef, sessionId) {
  const frameRef = useRef(0);
  const [cvData, setCvData] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!videoRef || !sessionId) return undefined;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    setIsCapturing(true);

    const capture = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !context) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', 0.8);
      frameRef.current += 1;

      try {
        const data = await cvAPI.analyzeFrame(sessionId, image, frameRef.current);
        if (!cancelled) {
          setCvData(data);
          setFrameCount(frameRef.current);
        }
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.error || 'Failed to analyze video frame');
      }
    };

    const interval = setInterval(capture, 3000);
    capture();

    return () => {
      cancelled = true;
      clearInterval(interval);
      setIsCapturing(false);
    };
  }, [sessionId, videoRef]);

  return { cvData, frameCount, isCapturing };
}

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { cvAPI } from '../api/index.js';

function analyzeFrameQuality(context, width, height) {
  const sampleWidth = Math.min(96, width);
  const sampleHeight = Math.min(72, height);
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });

  if (!sampleContext) {
    return { usable: false, reason: 'quality_check_unavailable', brightness: 0, variance: 0 };
  }

  sampleContext.drawImage(context.canvas, 0, 0, sampleWidth, sampleHeight);
  const data = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  for (let index = 0; index < data.length; index += 4) {
    const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
    sum += brightness;
    sumSquares += brightness * brightness;
    count += 1;
  }

  const mean = count ? sum / count : 0;
  const variance = count ? sumSquares / count - mean * mean : 0;
  const usable = mean >= 28 && variance >= 20;
  const reason = usable ? 'usable_frame' : mean < 28 ? 'camera_too_dark_or_covered' : 'blank_or_low_detail_frame';

  return {
    usable,
    reason,
    brightness: Math.round(mean),
    variance: Math.round(variance)
  };
}

export function useFrameCapture(videoRef, sessionId) {
  const frameRef = useRef(0);
  const warnedRef = useRef(false);
  const [cvData, setCvData] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [qualityIssue, setQualityIssue] = useState(null);
  const videoReadyRef = useRef(false);

  useEffect(() => {
    if (!videoRef || !sessionId) return undefined;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    setIsCapturing(true);

    const waitForVideo = () => {
      const video = videoRef.current;
      const ready = Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
      videoReadyRef.current = ready;
      return ready ? video : null;
    };

    const capture = async () => {
      const video = waitForVideo();
      if (!video || !context) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameQuality = analyzeFrameQuality(context, canvas.width, canvas.height);
      frameRef.current += 1;

      if (!frameQuality.usable) {
        setQualityIssue(frameQuality);
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.error('Camera is covered or too dark. Show your face clearly to continue.');
        }
      } else {
        warnedRef.current = false;
        setQualityIssue(null);
      }

      const image = canvas.toDataURL('image/jpeg', 0.65);

      try {
        const data = await cvAPI.analyzeFrame(sessionId, image, frameRef.current, frameQuality);
        if (!cancelled) {
          setCvData(data);
          setFrameCount(frameRef.current);
        }
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.error || 'Failed to analyze video frame');
      }
    };

    const readinessInterval = setInterval(waitForVideo, 500);
    const interval = setInterval(capture, 3000);
    capture();

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(readinessInterval);
      setIsCapturing(false);
      videoReadyRef.current = false;
    };
  }, [sessionId, videoRef]);

  return { cvData, frameCount, isCapturing, qualityIssue };
}

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
  const usable = mean >= 42 && variance >= 90;
  const reason = usable ? 'usable_frame' : mean < 42 ? 'camera_too_dark_or_covered' : 'blank_or_low_detail_frame';

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
      const frameQuality = analyzeFrameQuality(context, canvas.width, canvas.height);
      frameRef.current += 1;

      if (!frameQuality.usable) {
        const failedFrame = {
          provider: 'client_quality_gate',
          provider_status: frameQuality.reason,
          face_detected: false,
          age_range: null,
          age_midpoint: null,
          liveness_score: 0,
          liveness_status: 'FAIL',
          quality: frameQuality
        };
        if (!cancelled) {
          setCvData(failedFrame);
          setQualityIssue(frameQuality);
          setFrameCount(frameRef.current);
        }
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.error('Camera is covered or too dark. Show your face clearly to continue.');
        }
        return;
      }

      warnedRef.current = false;
      setQualityIssue(null);
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

    const interval = setInterval(capture, 3000);
    capture();

    return () => {
      cancelled = true;
      clearInterval(interval);
      setIsCapturing(false);
    };
  }, [sessionId, videoRef]);

  return { cvData, frameCount, isCapturing, qualityIssue };
}

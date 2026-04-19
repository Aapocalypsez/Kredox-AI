import { useEffect, useState } from 'react';
import { verifyGeoLocation } from '../api.js';

async function detectPublicIp() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) return '';
    const data = await response.json();
    return data.ip || '';
  } catch {
    return '';
  }
}

export function useGeoCapture(sessionId, enabled = true) {
  const [geoResult, setGeoResult] = useState(null);
  const [status, setStatus] = useState(enabled ? 'verifying' : 'idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId || !enabled) return undefined;

    let cancelled = false;

    async function sendGeo(coords) {
      try {
        setStatus('verifying');
        const ipAddress = await detectPublicIp();
        const result = await verifyGeoLocation({
          session_id: sessionId,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          ip_address: ipAddress
        });

        if (!cancelled) {
          setGeoResult(result);
          setStatus(result.match_status === 'MISMATCH' ? 'mismatch' : 'verified');
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError);
          setStatus('failed');
        }
      }
    }

    if (!navigator.geolocation) {
      sendGeo(null);
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => sendGeo(position.coords),
      () => sendGeo(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );

    return () => {
      cancelled = true;
    };
  }, [sessionId, enabled]);

  return {
    geoResult,
    status,
    error
  };
}


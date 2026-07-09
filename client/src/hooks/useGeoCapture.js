import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { geoAPI } from '../api/index.js';

export function useGeoCapture(sessionId) {
  const [geoResult, setGeoResult] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geoError, setGeoError] = useState(null);

  useEffect(() => {
    if (!sessionId) return undefined;

    let cancelled = false;

    const sendLocation = async (latitude, longitude) => {
      try {
        setGeoStatus('verifying');
        const data = await geoAPI.verify(sessionId, latitude, longitude);
        if (!cancelled) {
          setGeoResult(data);
          setGeoStatus(data.match_status === 'MATCH' ? 'verified' : 'partial');
        }
      } catch (error) {
        if (!cancelled) {
          setGeoError(error);
          setGeoStatus('failed');
          toast.error(error.response?.data?.error || 'Failed to verify location');
        }
      }
    };

    setGeoStatus('requesting');
    if (!navigator.geolocation) {
      sendLocation(null, null);
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => sendLocation(position.coords.latitude, position.coords.longitude),
      (error) => {
        console.warn('Geolocation capture failed, falling back to IP geolocation:', error.message);
        setGeoError(error);
        sendLocation(null, null);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { geoResult, geoStatus, geoError };
}

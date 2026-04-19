import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { activityAPI, campaignAPI, reportsAPI } from '../api/index.js';

export function useDashboardData() {
  const [data, setData] = useState({
    kpis: null,
    applications: [],
    campaigns: [],
    activity: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError('');
        const [dashboard, applications, campaigns, activity] = await Promise.all([
          reportsAPI.dashboard(),
          reportsAPI.applications(50),
          campaignAPI.getAll(),
          activityAPI.feed().catch(() => ({ activity: [] }))
        ]);

        if (!cancelled) {
          setData({
            kpis: dashboard,
            applications: applications.applications || [],
            campaigns: campaigns.campaigns || [],
            activity: activity.activity || []
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load dashboard data');
          toast.error('Failed to load dashboard data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { ...data, error, isLoading };
}

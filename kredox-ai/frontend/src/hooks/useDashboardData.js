import { useEffect, useState } from 'react';
import { activityFeed, applications, campaigns, kpis } from '../data/mockData.js';

export function useDashboardData() {
  const [isLoading, setIsLoading] = useState(true);
  const [activity, setActivity] = useState(activityFeed);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 450);
    return () => clearTimeout(timer);
  }, []);

  return {
    kpis,
    applications,
    campaigns,
    activity,
    setActivity,
    isLoading
  };
}

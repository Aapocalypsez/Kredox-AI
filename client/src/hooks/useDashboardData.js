import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { campaignAPI, reportsAPI } from '../api/index.js';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCampaigns(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.campaigns || payload?.data || [];
}

async function fetchDashboardData() {
  const [summaryData, campaignData] = await Promise.all([
    reportsAPI.dailySummary(todayIsoDate()),
    campaignAPI.getAll()
  ]);
  const campaigns = normalizeCampaigns(campaignData);

  return {
    summary: summaryData,
    kpis: {
      total_applications: summaryData.total_applications ?? summaryData.total_sessions ?? 0,
      live_sessions: summaryData.live_sessions ?? 0,
      auto_approved: summaryData.auto_approved ?? summaryData.approved ?? 0,
      flagged: summaryData.flagged ?? summaryData.manual_review ?? 0
    },
    applications: summaryData.applications || summaryData.sessions || [],
    campaigns
  };
}

export function useDashboardData() {
  const query = useQuery({
    queryKey: ['dashboard-data', todayIsoDate()],
    queryFn: fetchDashboardData,
    refetchInterval: 30000,
    staleTime: 25000
  });

  useEffect(() => {
    if (query.error) {
      toast.error(query.error.response?.data?.error || 'Failed to load dashboard data');
    }
  }, [query.error]);

  return {
    kpis: query.data?.kpis || null,
    applications: query.data?.applications || [],
    campaigns: query.data?.campaigns || [],
    summary: query.data?.summary || null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
}

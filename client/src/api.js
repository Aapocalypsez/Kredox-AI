import axios from 'axios';

function cleanBaseUrl(value, fallback) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url || /dummy-api|placeholder|your-backend/i.test(url)) return fallback;
  return url;
}

const fallbackApiUrl = import.meta.env.PROD ? 'https://kredox-ai.onrender.com' : 'http://localhost:4000';

export const api = axios.create({
  baseURL: cleanBaseUrl(import.meta.env.VITE_API_BASE_URL, fallbackApiUrl),
  timeout: 15000,
  withCredentials: true
});

let accessToken = localStorage.getItem('kredox_access_token') || '';

export function setAccessToken(token) {
  accessToken = token || '';
  if (token) {
    localStorage.setItem('kredox_access_token', token);
  } else {
    localStorage.removeItem('kredox_access_token');
  }
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry && !original?.url?.includes('/api/auth/')) {
      original._retry = true;
      try {
        const { data } = await api.post('/api/auth/refresh');
        setAccessToken(data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        setAccessToken('');
      }
    }
    return Promise.reject(error);
  }
);

export async function loginAgent(payload) {
  const { data } = await api.post('/api/auth/login', payload);
  setAccessToken(data.access_token);
  return data;
}

export async function refreshAgentSession() {
  const { data } = await api.post('/api/auth/refresh');
  setAccessToken(data.access_token);
  return data;
}

export async function logoutAgent() {
  const { data } = await api.post('/api/auth/logout');
  setAccessToken('');
  return data;
}

export async function createCampaign(payload) {
  const { data } = await api.post('/api/campaigns/create', payload);
  return data;
}

export async function fetchCampaigns() {
  const { data } = await api.get('/api/campaigns');
  return data.campaigns;
}

export async function fetchCampaignLinks(campaignId) {
  const { data } = await api.get(`/api/campaigns/${campaignId}/links`);
  return data.links;
}

export async function validateToken(token) {
  const { data } = await api.get(`/api/links/validate/${encodeURIComponent(token)}`);
  return data;
}

export async function completeLink(payload) {
  const { data } = await api.post('/api/links/complete', payload);
  return data;
}

export async function createVideoToken(payload) {
  const { data } = await api.post('/api/video/token', payload);
  return data;
}

export async function startVideoSession(payload) {
  const { data } = await api.post('/api/video/session/start', payload);
  return data;
}

export async function fetchVideoSession(sessionId) {
  const { data } = await api.get(`/api/video/session/${sessionId}`);
  return data.session;
}

export async function endVideoSession(sessionId) {
  const { data } = await api.post(`/api/video/session/${sessionId}/end`);
  return data;
}

export async function analyzeCvFrame(payload) {
  const { data } = await api.post('/api/cv/analyze-frame', payload);
  return data;
}

export async function fetchCvSummary(sessionId) {
  const { data } = await api.get(`/api/cv/session/${sessionId}/summary`);
  return data;
}

export async function fetchLlmAnalysis(sessionId) {
  const { data } = await api.get(`/api/llm/analysis/${sessionId}`);
  return data;
}

export async function analyzeLlmSession(sessionId) {
  const { data } = await api.post('/api/llm/analyze', { session_id: sessionId });
  return data;
}

export async function explainOffer(payload) {
  const { data } = await api.post('/api/llm/explain-offer', payload);
  return data;
}

export async function verifyGeoLocation(payload) {
  const { data } = await api.post('/api/geo/verify', payload);
  return data;
}

export async function fetchGeoReport(sessionId) {
  const { data } = await api.get(`/api/geo/session/${sessionId}/report`);
  return data;
}

export async function runPolicyCheck(payload) {
  const { data } = await api.post('/api/risk/policy-check', payload);
  return data;
}

export async function calculateFinalRiskScore(payload) {
  const { data } = await api.post('/api/risk/final-score', payload);
  return data;
}

export async function compileApplication(sessionId) {
  const { data } = await api.post('/api/application/compile', { session_id: sessionId });
  return data;
}

export async function patchApplicationField(applicationId, payload) {
  const { data } = await api.patch(`/api/application/${applicationId}/field`, payload);
  return data;
}

export async function generateLoanOffer(payload) {
  const { data } = await api.post('/api/offers/generate', payload);
  return data;
}

export async function fetchPublicLoanOffer(token) {
  const { data } = await api.get(`/api/offers/public/${encodeURIComponent(token)}`);
  return data;
}

export async function presentLoanOffer(offerId, channel = 'sms') {
  const { data } = await api.post(`/api/offers/${offerId}/present`, { channel });
  return data;
}

export async function acceptLoanOffer(offerId) {
  const { data } = await api.post(`/api/offers/${offerId}/accept`);
  return data;
}

export async function fetchAuditLogs(params = {}) {
  const { data } = await api.get('/api/audit/logs', { params });
  return data.logs;
}

export async function fetchRecordingPlayback(sessionId) {
  const { data } = await api.get(`/api/storage/recording/${sessionId}`);
  return data;
}

export async function searchTranscripts(params = {}) {
  const { data } = await api.get('/api/search/transcripts', { params });
  return data;
}

export async function fetchDailySummary(params = {}) {
  const { data } = await api.get('/api/reports/daily-summary', { params });
  return data;
}

export async function fetchAgentPerformance(params = {}) {
  const { data } = await api.get('/api/reports/agent-performance', { params });
  return data;
}

export async function fetchDashboardAnalytics() {
  const { data } = await api.get('/api/reports/dashboard');
  return data;
}

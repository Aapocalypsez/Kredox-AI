import axios from 'axios';

function cleanBaseUrl(value, fallback) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url || /dummy-api|placeholder|your-backend/i.test(url)) return fallback;
  return url;
}

const nodeFallback = import.meta.env.PROD ? 'https://kredox-ai.onrender.com' : 'http://localhost:4000';
const pythonFallback = import.meta.env.PROD ? 'https://kredox-ai-ml.onrender.com' : 'http://localhost:8001';
const configuredNodeUrl = import.meta.env.VITE_NODE_API || import.meta.env.VITE_API_BASE_URL;
const configuredPythonUrl = import.meta.env.VITE_PYTHON_API;
const API_TIMEOUT_MS = 60000;
const LOGIN_TIMEOUT_MS = 90000;

export const nodeAPI = axios.create({
  baseURL: cleanBaseUrl(configuredNodeUrl, nodeFallback),
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

export const pythonAPI = axios.create({
  baseURL: cleanBaseUrl(configuredPythonUrl, pythonFallback),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

nodeAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('kredox_token') || localStorage.getItem('kredox_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

nodeAPI.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/api/auth/login') &&
      !original.url?.includes('/api/auth/refresh')
    ) {
      original._retry = true;
      const refresh = await nodeAPI.post('/api/auth/refresh');
      const token = refresh.data.access_token;
      localStorage.setItem('kredox_token', token);
      localStorage.setItem('kredox_access_token', token);
      original.headers.Authorization = `Bearer ${token}`;
      return nodeAPI(original);
    }
    return Promise.reject(err);
  }
);

const unwrap = (response) => response.data;

function isTransientNetworkError(error) {
  return ['ECONNABORTED', 'ERR_NETWORK', 'ERR_FAILED'].includes(error?.code) || !error?.response;
}

async function warmBackend() {
  try {
    await nodeAPI.get('/health', {
      timeout: LOGIN_TIMEOUT_MS,
      withCredentials: false
    });
  } catch {
    // Render free services can take a while to wake; the login retry below is the real check.
  }
}

async function loginWithWake(email, password) {
  await warmBackend();

  try {
    return await nodeAPI
      .post('/api/auth/login', { email, password }, { timeout: LOGIN_TIMEOUT_MS })
      .then(unwrap);
  } catch (error) {
    if (!isTransientNetworkError(error)) throw error;
    await warmBackend();
    return nodeAPI
      .post('/api/auth/login', { email, password }, { timeout: LOGIN_TIMEOUT_MS })
      .then(unwrap);
  }
}

export const authAPI = {
  login: loginWithWake,
  register: (data) => nodeAPI.post('/api/auth/register', data).then(unwrap),
  refresh: () => nodeAPI.post('/api/auth/refresh').then(unwrap),
  logout: () => nodeAPI.post('/api/auth/logout').then(unwrap)
};

export const campaignAPI = {
  create: (data) => nodeAPI.post('/api/campaigns/create', data).then(unwrap),
  getStats: (id) => nodeAPI.post(`/api/campaigns/${id}/stats`).then(unwrap),
  getAll: () => nodeAPI.get('/api/campaigns').then(unwrap),
  getLinks: (id) => nodeAPI.get(`/api/campaigns/${id}/links`).then(unwrap),
  messagingStatus: () => nodeAPI.get('/api/campaigns/messaging-status').then(unwrap)
};

export const linkAPI = {
  validate: (token) => nodeAPI.get(`/api/links/validate/${encodeURIComponent(token)}`).then(unwrap),
  complete: (payload) => nodeAPI.post('/api/links/complete', payload).then(unwrap)
};

export const videoAPI = {
  getToken: (channel, uid, role = 'publisher') =>
    nodeAPI.post('/api/video/token', { channel_name: channel, uid, role }).then(unwrap),
  startSession: (customer_id, agent_id, channel_name) =>
    nodeAPI.post('/api/video/session/start', { customer_id, agent_id, channel_name }).then(unwrap),
  endSession: (session_id) => nodeAPI.post(`/api/video/session/${session_id}/end`).then(unwrap),
  getSession: (session_id) => nodeAPI.get(`/api/video/session/${session_id}`).then(unwrap),
  flagSession: (session_id, reason) => nodeAPI.post(`/api/video/session/${session_id}/flag`, { reason }).then(unwrap),
  addNote: (session_id, note) => nodeAPI.post(`/api/video/session/${session_id}/note`, { note }).then(unwrap),
  reprocessSession: (session_id) => nodeAPI.post(`/api/video/session/${session_id}/reprocess`).then(unwrap),
  uploadSessionRecording: (session_id, file, token, session_token) => {
    const formData = new FormData();
    formData.append('token', token);
    formData.append('session_token', session_token);
    formData.append('recording', file);
    return nodeAPI
      .post(`/api/video/session/${session_id}/recording`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(unwrap);
  }
};

export const cvAPI = {
  analyzeFrame: (session_id, image_base64, frame_number) =>
    nodeAPI.post('/api/cv/analyze-frame', { session_id, image_base64, frame_number }).then(unwrap),
  getSessionSummary: (session_id) => nodeAPI.get(`/api/cv/session/${session_id}/summary`).then(unwrap)
};

export const geoAPI = {
  verify: (session_id, latitude, longitude, ip_address = null) =>
    nodeAPI.post('/api/geo/verify', { session_id, latitude, longitude, ip_address }).then(unwrap),
  getReport: (session_id) => nodeAPI.get(`/api/geo/session/${session_id}/report`).then(unwrap)
};

export const llmAPI = {
  analyze: (session_id) => nodeAPI.post('/api/llm/analyze', { session_id }).then(unwrap),
  getAnalysis: (session_id) => nodeAPI.get(`/api/llm/analysis/${session_id}`).then(unwrap),
  explainOffer: (payload) => nodeAPI.post('/api/llm/explain-offer', payload).then(unwrap)
};

export const riskAPI = {
  policyCheck: (customer_id, session_id) =>
    nodeAPI.post('/api/risk/policy-check', { customer_id, session_id }).then(unwrap),
  finalScore: (session_id, customer_id) =>
    nodeAPI.post('/api/risk/final-score', { session_id, customer_id }).then(unwrap),
  getSession: (session_id) => nodeAPI.get(`/api/risk/session/${session_id}`).then(unwrap),
  mlPredict: (features) => pythonAPI.post('/ml/predict', features).then(unwrap)
};

export const applicationAPI = {
  compile: (session_id) => nodeAPI.post('/api/application/compile', { session_id }).then(unwrap),
  getBySession: (session_id) => nodeAPI.get(`/api/application/session/${session_id}`).then(unwrap),
  updateStatus: (id, status, reason, agent_id = null) =>
    nodeAPI
      .patch(`/api/application/${id}/status`, {
        status,
        reason,
        agent_id
      })
      .then(unwrap),
  updateField: (id, field, value, reason, agent_id = null) =>
    nodeAPI
      .patch(`/api/application/${id}/field`, {
        field,
        value,
        field_path: field,
        new_value: value,
        reason,
        agent_id
      })
      .then(unwrap)
};

export const offerAPI = {
  generate: (session_id, application_id) =>
    nodeAPI.post('/api/offers/generate', { session_id, application_id }).then(unwrap),
  present: (offer_id, channel = 'email') =>
    nodeAPI.post(`/api/offers/${offer_id}/present`, { channel }).then(unwrap),
  getPublic: (token) => nodeAPI.get(`/api/offers/public/${encodeURIComponent(token)}`).then(unwrap),
  accept: (offer_id) => nodeAPI.post(`/api/offers/${offer_id}/accept`).then(unwrap)
};

export const reportsAPI = {
  dashboard: () => nodeAPI.get('/api/reports/dashboard').then(unwrap),
  applications: (limit = 50) => nodeAPI.get('/api/reports/applications', { params: { limit } }).then(unwrap),
  dailySummary: (date) => nodeAPI.get('/api/reports/daily-summary', { params: { date } }).then(unwrap),
  session: (session_id) => nodeAPI.get(`/api/reports/session/${session_id}`).then(unwrap),
  searchTranscripts: (query, filters = {}) =>
    nodeAPI.get('/api/search/transcripts', { params: { q: query, ...filters } }).then(unwrap),
  getRecording: (session_id) => nodeAPI.get(`/api/storage/recording/${session_id}`).then(unwrap),
  agentPerformance: (agent_id, period) =>
    nodeAPI.get('/api/reports/agent-performance', { params: { agent_id, period } }).then(unwrap)
};

export const storageAPI = {
  uploadRecording: (session_id, file) => {
    const formData = new FormData();
    formData.append('session_id', session_id);
    formData.append('recording', file);
    return nodeAPI
      .post('/api/storage/upload-recording', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(unwrap);
  },
  getRecording: (session_id) => nodeAPI.get(`/api/storage/recording/${session_id}`).then(unwrap)
};

export const bureauAPI = {
  get: (customer_id) => nodeAPI.get(`/api/bureau/${customer_id}`).then(unwrap)
};

export const activityAPI = {
  feed: () => nodeAPI.get('/api/activity/feed').then(unwrap)
};

export const auditAPI = {
  logs: (params = {}) => nodeAPI.get('/api/audit/logs', { params }).then(unwrap)
};

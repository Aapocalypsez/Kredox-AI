import axios from 'axios';

export const nodeAPI = axios.create({
  baseURL: import.meta.env.VITE_NODE_API || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

export const pythonAPI = axios.create({
  baseURL: import.meta.env.VITE_PYTHON_API || 'http://localhost:8001',
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

export const authAPI = {
  login: (email, password) => nodeAPI.post('/api/auth/login', { email, password }).then(unwrap),
  refresh: () => nodeAPI.post('/api/auth/refresh').then(unwrap),
  logout: () => nodeAPI.post('/api/auth/logout').then(unwrap)
};

export const campaignAPI = {
  create: (data) => nodeAPI.post('/api/campaigns/create', data).then(unwrap),
  getStats: (id) => nodeAPI.post(`/api/campaigns/${id}/stats`).then(unwrap),
  getAll: () => nodeAPI.get('/api/campaigns').then(unwrap),
  getLinks: (id) => nodeAPI.get(`/api/campaigns/${id}/links`).then(unwrap)
};

export const linkAPI = {
  validate: (token) => nodeAPI.get(`/api/links/validate/${encodeURIComponent(token)}`).then(unwrap)
};

export const videoAPI = {
  getToken: (channel, uid, role = 'publisher') =>
    nodeAPI.post('/api/video/token', { channel_name: channel, uid, role }).then(unwrap),
  startSession: (customer_id, agent_id, channel_name) =>
    nodeAPI.post('/api/video/session/start', { customer_id, agent_id, channel_name }).then(unwrap),
  endSession: (session_id) => nodeAPI.post(`/api/video/session/${session_id}/end`).then(unwrap),
  getSession: (session_id) => nodeAPI.get(`/api/video/session/${session_id}`).then(unwrap)
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
  mlPredict: (features) => pythonAPI.post('/ml/predict', features).then(unwrap)
};

export const applicationAPI = {
  compile: (session_id) => nodeAPI.post('/api/application/compile', { session_id }).then(unwrap),
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
  accept: (offer_id) => nodeAPI.post(`/api/offers/${offer_id}/accept`).then(unwrap)
};

export const reportsAPI = {
  dailySummary: (date) => nodeAPI.get('/api/reports/daily-summary', { params: { date } }).then(unwrap),
  searchTranscripts: (query, filters = {}) =>
    nodeAPI.get('/api/search/transcripts', { params: { q: query, ...filters } }).then(unwrap),
  getRecording: (session_id) => nodeAPI.get(`/api/storage/recording/${session_id}`).then(unwrap),
  agentPerformance: (agent_id, period) =>
    nodeAPI.get('/api/reports/agent-performance', { params: { agent_id, period } }).then(unwrap)
};

export const bureauAPI = {
  get: (customer_id) => nodeAPI.get(`/api/bureau/${customer_id}`).then(unwrap)
};

export const activityAPI = {
  feed: () => nodeAPI.get('/api/activity/feed').then(unwrap)
};

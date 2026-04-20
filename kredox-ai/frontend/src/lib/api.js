import axios from 'axios';

function cleanBaseUrl(value, fallback) {
  const url = String(value || '').trim().replace(/\/+$/, '');
  if (!url || /dummy-api|placeholder|your-backend/i.test(url)) return fallback;
  return url;
}

export const API_BASE_URL = cleanBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.PROD ? 'https://kredox-ai-api.onrender.com' : 'http://localhost:4000'
);

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kredox_token') || localStorage.getItem('kredox_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

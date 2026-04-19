import { createClient } from 'redis';
import { env } from '../config/env.js';

const memoryCache = new Map();

const memoryRedis = {
  isOpen: true,
  async connect() {
    return this;
  },
  async get(key) {
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      memoryCache.delete(key);
      return null;
    }
    return item.value;
  },
  async set(key, value, options = {}) {
    const ttlSeconds = options.EX || options.ex;
    memoryCache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + Number(ttlSeconds) * 1000 : null
    });
    return 'OK';
  },
  async del(key) {
    return memoryCache.delete(key) ? 1 : 0;
  }
};

let redisClient = env.redisUrl ? createClient({ url: env.redisUrl }) : null;

if (redisClient) {
  redisClient.on('error', (error) => {
    console.warn('Redis unavailable; using in-memory token cache for demo mode', error.message);
  });
}

function activeClient() {
  return redisClient?.isOpen ? redisClient : memoryRedis;
}

export const redis = {
  get isOpen() {
    return activeClient().isOpen;
  },
  get: (...args) => activeClient().get(...args),
  set: (...args) => activeClient().set(...args),
  del: (...args) => activeClient().del(...args)
};

export async function connectRedis() {
  if (!redisClient) return memoryRedis;

  try {
    if (!redisClient.isOpen) await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn('Redis connection failed; continuing with in-memory token cache', error.message);
    redisClient = null;
    return memoryRedis;
  }
}

export function linkKey(token) {
  return `campaign_link:${token}`;
}

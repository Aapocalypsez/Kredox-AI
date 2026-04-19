import { createClient } from 'redis';
import { env } from '../config/env.js';

const memoryStore = new Map();
const ttlTimers = new Map();

function setMemoryValue(key, value, ttlSeconds) {
  if (ttlTimers.has(key)) clearTimeout(ttlTimers.get(key));
  memoryStore.set(key, value);

  if (ttlSeconds) {
    const timer = setTimeout(() => {
      memoryStore.delete(key);
      ttlTimers.delete(key);
    }, Number(ttlSeconds) * 1000);
    ttlTimers.set(key, timer);
  }
}

const memoryRedis = {
  isOpen: true,
  async get(key) {
    return memoryStore.get(key) ?? null;
  },
  async set(key, value, options = {}) {
    setMemoryValue(key, value, options.EX || options.ex);
    return 'OK';
  },
  async setEx(key, ttlSeconds, value) {
    setMemoryValue(key, value, ttlSeconds);
    return 'OK';
  },
  async del(key) {
    if (ttlTimers.has(key)) clearTimeout(ttlTimers.get(key));
    ttlTimers.delete(key);
    return memoryStore.delete(key) ? 1 : 0;
  }
};

let redisClient = null;

if (env.redisUrl) {
  try {
    redisClient = createClient({ url: env.redisUrl });
    redisClient.on('error', (error) => {
      console.warn('Redis error', error.message);
    });
  } catch (error) {
    console.warn('Redis not configured — using in-memory fallback (not for production)', error.message);
    redisClient = null;
  }
} else {
  console.warn('Redis not configured — using in-memory fallback (not for production)');
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
  setEx: (...args) => activeClient().setEx(...args),
  del: (...args) => activeClient().del(...args)
};

export async function connectRedis() {
  if (!redisClient) return memoryRedis;

  try {
    if (!redisClient.isOpen) await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.warn('Redis not configured — using in-memory fallback (not for production)', error.message);
    redisClient = null;
    return memoryRedis;
  }
}

export function linkKey(token) {
  return `campaign_link:${token}`;
}

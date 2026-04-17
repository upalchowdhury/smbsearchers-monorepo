import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    return new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableReadyCheck: true,
    });
  } catch {
    return null;
  }
}

export const redis = globalForRedis.redis ?? createRedisClient();
if (globalForRedis.redis === undefined) {
  globalForRedis.redis = redis;
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!redis) return;
  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // cache best-effort
  }
}

export async function invalidateByPrefix(prefix: string): Promise<number> {
  if (!redis) return 0;
  let cursor = '0';
  let deleted = 0;

  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    return deleted;
  }

  return deleted;
}

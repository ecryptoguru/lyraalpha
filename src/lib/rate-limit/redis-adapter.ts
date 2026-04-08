type IORedisLike = {
  evalsha: (...args: unknown[]) => Promise<unknown>;
  eval: (...args: unknown[]) => Promise<unknown>;
  smembers: (key: string) => Promise<string[]>;
  sadd: (key: string, ...members: string[]) => Promise<number>;
  srem: (key: string, ...members: string[]) => Promise<number>;
  pttl: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<unknown>;
  zincrby: (key: string, increment: number, member: string) => Promise<number | string>;
  del: (...keys: string[]) => Promise<number>;
  pipeline: () => {
    eval: (...args: unknown[]) => unknown;
    exec: () => Promise<Array<[unknown, unknown]> | null>;
  };
};

/**
 * Adapter to make ioredis compatible with @upstash/ratelimit
 * The Upstash library expects a specific Redis interface
 */
export class RedisAdapter {
  private client: IORedisLike;

  constructor(client: IORedisLike) {
    this.client = client;
  }

  async evalsha<TArgs extends unknown[], TData = unknown>(
    sha1: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    const result = await this.client.evalsha(
      sha1,
      keys.length,
      ...keys,
      ...(args as string[]),
    );
    return result as TData;
  }

  // Define the subset of Redis commands actually used by @upstash/ratelimit
  // See: https://github.com/upstash/ratelimit/blob/main/packages/ratelimit/src/types.ts

  async eval<TArgs extends unknown[], TData = unknown>(
    script: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    const result = await this.client.eval(
      script,
      keys.length,
      ...keys,
      ...(args as string[]),
    );
    return result as TData;
  }

  // The upstash ratelimit library expects these specific signatures for its internal scripts
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async sadd<TData>(key: string, ...members: TData[]): Promise<number> {
    return this.client.sadd(key, ...(members as string[]));
  }

  async srem<TData>(key: string, ...members: TData[]): Promise<number> {
    return this.client.srem(key, ...(members as string[]));
  }

  async pttl(key: string): Promise<number> {
    return this.client.pttl(key);
  }

  async get<TData>(key: string): Promise<TData | null> {
    const res = await this.client.get(key);
    if (res === null) return null;
    try {
      return JSON.parse(res) as TData;
    } catch {
      return res as unknown as TData;
    }
  }

  async set<TData>(key: string, value: TData): Promise<"OK" | TData | null> {
    const res = await this.client.set(key, typeof value === "string" ? value : JSON.stringify(value));
    return res as "OK" | TData | null;
  }

  async zincrby(key: string, increment: number, member: string): Promise<number> {
    const res = await this.client.zincrby(key, increment, member);
    const num = typeof res === "number" ? res : Number(res);
    return Number.isFinite(num) ? num : 0;
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  // Upstash defines pipeline as returning an object with exec()
  pipeline(): {
    eval: (...args: unknown[]) => unknown;
    exec: () => Promise<unknown[]>;
  } {
    const pipe = this.client.pipeline();
    return {
      eval: (...args: unknown[]) => {
        pipe.eval(...args);
        return this;
      },
      exec: async () => {
        const results = await pipe.exec();
        if (!results) return [];
        // Map ioredis results [error, result][] to upstash format [result][]
        return results.map((entry) => entry[1]);
      },
    };
  }
}

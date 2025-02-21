import { Redis } from "ioredis";
import { environment } from "../config/environment";

const redisConfig = {
  host: environment.redis.host,
  port: environment.redis.port,
  password: environment.redis.password,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
};

const createRedisInstance = async () => {
  const client = environment.redis.url
    ? new Redis(environment.redis.url)
    : new Redis(redisConfig);

  await client.connect();

  client.on("error", (error) => {
    console.error("Erro na conexão com Redis:", error);
  });

  client.on("connect", () => {
    console.log("Conectado ao Redis");
  });

  return client;
};

export const initRedis = async () => {
  const redis = await createRedisInstance();
  return redis;
};

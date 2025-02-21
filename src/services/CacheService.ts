import { Redis } from "ioredis";
import { environment } from "../config/environment";
import type { LinkedInProfile } from "../types/linkedin";

export class CacheService {
  private redis: Redis;
  private readonly TTL: number;
  private initialized = false;

  constructor() {
    this.TTL = 24 * 60 * 60; // 24 horas
    this.redis = new Redis({
      host: environment.redis.host,
      port: environment.redis.port,
      password: environment.redis.password,
      connectTimeout: 10000,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        return Math.min(times * 50, 2000);
      },
    });

    this.setupRedisEvents();
  }

  private setupRedisEvents(): void {
    this.redis.on("connect", () => {
      console.log("Redis conectado com sucesso");
      this.initialized = true;
    });

    this.redis.on("error", (error) => {
      console.error("Erro na conexão com Redis:", error);
      this.initialized = false;
    });
  }

  public async waitForConnection(timeout = 5000): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout ao conectar com Redis"));
      }, timeout);

      this.redis.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });

      this.redis.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  public getRedisInstance(): Redis {
    if (!this.initialized) {
      throw new Error("Redis ainda não está inicializado");
    }
    return this.redis;
  }

  public async getProfile(username: string): Promise<LinkedInProfile | null> {
    try {
      const cached = await this.redis.get(`profile:${username}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("Erro ao buscar perfil do cache:", error);
      return null;
    }
  }

  public async setProfile(
    username: string,
    profile: LinkedInProfile,
  ): Promise<void> {
    try {
      await this.redis.setex(
        `profile:${username}`,
        this.TTL,
        JSON.stringify(profile),
      );
    } catch (error) {
      console.error("Erro ao salvar perfil no cache:", error);
      throw new Error("Falha ao armazenar perfil no cache");
    }
  }

  public async getLastUpdate(username: string): Promise<Date | null> {
    try {
      const timestamp = await this.redis.get(`lastUpdate:${username}`);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error("Erro ao buscar última atualização:", error);
      return null;
    }
  }

  public async setLastUpdate(username: string): Promise<void> {
    try {
      await this.redis.set(`lastUpdate:${username}`, new Date().toISOString());
    } catch (error) {
      console.error("Erro ao salvar última atualização:", error);
      throw new Error("Falha ao atualizar timestamp");
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === "PONG";
    } catch (error) {
      console.error("Erro na conexão com Redis:", error);
      return false;
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error("Erro ao buscar do cache:", error);
      return null;
    }
  }

  public async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      console.error("Erro ao salvar no cache:", error);
      throw new Error("Falha ao armazenar no cache");
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("Erro ao deletar do cache:", error);
      throw new Error("Falha ao deletar do cache");
    }
  }
}

import Redis from 'ioredis';
import { IProfile } from '../types/Profile';

interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    tls: Record<string, unknown>;
}

export class CacheService {
    private readonly redis: Redis;
    private readonly TTL = 24 * 60 * 60; // 24 horas em segundos

    constructor() {
        const config = this.getRedisConfig();
        this.redis = this.createRedisClient(config);
        this.setupEventListeners();
    }

    private getRedisConfig(): RedisConfig {
        return {
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD,
            tls: {} // Necessário para conexão segura com Upstash
        };
    }

    private createRedisClient(config: RedisConfig): Redis {
        console.log('Conectando ao Redis:', {
            host: config.host,
            port: config.port,
            hasPassword: !!config.password
        });

        return new Redis({
            ...config,
            retryStrategy: (times: number) => {
                if (times > 3) return null;
                return Math.min(times * 50, 2000);
            },
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            enableOfflineQueue: false
        });
    }

    private setupEventListeners(): void {
        this.redis.on('error', (error: Error) => {
            console.error('Erro na conexão com Redis:', {
                message: error.message,
                name: error.name,
                stack: error.stack?.split('\n')[0]
            });
        });

        this.redis.on('connect', () => {
            console.log('Conectado ao Redis com sucesso');
        });
    }

    public getRedisInstance(): Redis {
        return this.redis;
    }

    public async getProfile(username: string): Promise<IProfile | null> {
        try {
            const cached = await this.redis.get(`profile:${username}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Erro ao buscar perfil do cache:', error);
            return null;
        }
    }

    public async setProfile(username: string, profile: IProfile): Promise<void> {
        try {
            await this.redis.setex(
                `profile:${username}`,
                this.TTL,
                JSON.stringify(profile)
            );
        } catch (error) {
            console.error('Erro ao salvar perfil no cache:', error);
            throw new Error('Falha ao armazenar perfil no cache');
        }
    }

    public async getLastUpdate(username: string): Promise<Date | null> {
        try {
            const timestamp = await this.redis.get(`lastUpdate:${username}`);
            return timestamp ? new Date(timestamp) : null;
        } catch (error) {
            console.error('Erro ao buscar última atualização:', error);
            return null;
        }
    }

    public async setLastUpdate(username: string): Promise<void> {
        try {
            await this.redis.set(
                `lastUpdate:${username}`,
                new Date().toISOString()
            );
        } catch (error) {
            console.error('Erro ao salvar última atualização:', error);
            throw new Error('Falha ao atualizar timestamp');
        }
    }

    public async healthCheck(): Promise<boolean> {
        try {
            const ping = await this.redis.ping();
            return ping === 'PONG';
        } catch (error) {
            console.error('Erro no health check do Redis:', error);
            return false;
        }
    }
}
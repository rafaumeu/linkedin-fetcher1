import Redis from 'ioredis';
import { IProfile } from '../types/Profile';

export class CacheService {
    private redis: Redis;
    private TTL = 24 * 60 * 60; // 24 horas em segundos

    constructor() {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = Number(process.env.REDIS_PORT) || 6379;

        console.log('Conectando ao Redis:', { host, port });
        
        this.redis = new Redis({
            host,
            port,
            retryStrategy: (times) => {
                if (times > 3) return null; // desiste após 3 tentativas
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            enableOfflineQueue: false
        });

        this.redis.on('error', (error) => {
            console.error('Erro na conexão com Redis:', error);
        });

        this.redis.on('connect', () => {
            console.log('Conectado ao Redis com sucesso');
        });
    }

    async getProfile(username: string): Promise<IProfile | null> {
        const cached = await this.redis.get(`profile:${username}`);
        return cached ? JSON.parse(cached) : null;
    }

    async setProfile(username: string, profile: IProfile): Promise<void> {
        await this.redis.setex(`profile:${username}`, this.TTL, JSON.stringify(profile));
    }

    async getLastUpdate(username: string): Promise<Date | null> {
        const timestamp = await this.redis.get(`lastUpdate:${username}`);
        return timestamp ? new Date(timestamp) : null;
    }

    async setLastUpdate(username: string): Promise<void> {
        await this.redis.set(`lastUpdate:${username}`, new Date().toISOString());
    }
}
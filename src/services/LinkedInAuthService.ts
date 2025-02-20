import axios from 'axios';
import { env } from '../env';
import { Redis } from 'ioredis';
import { LinkedInToken } from '../types/linkedin';

class LinkedInAuthError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'LinkedInAuthError';
    }
}

interface LinkedInConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

interface TokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
}

export class LinkedInAuthService {
    private readonly config: LinkedInConfig;
    private readonly redis: Redis;

    constructor(redis: Redis) {
        this.validateEnvConfig();
        this.redis = redis;
        
        this.config = {
            clientId: env.linkedIn.clientId,
            clientSecret: env.linkedIn.clientSecret,
            redirectUri: env.linkedIn.redirectUri,
            scopes: env.linkedIn.scopes
        };
    }

    private validateEnvConfig(): void {
        if (!env.linkedIn.clientId || !env.linkedIn.clientSecret) {
            throw new LinkedInAuthError(
                'Credenciais do LinkedIn não configuradas',
                'INVALID_CONFIG'
            );
        }
    }

    private async validateState(state: string): Promise<string> {
        const storedData = await this.redis.get(`linkedin:state:${state}`);
        
        if (!storedData) {
            throw new LinkedInAuthError('Estado inválido ou expirado', 'INVALID_STATE');
        }

        const data = JSON.parse(storedData);
        await this.redis.del(`linkedin:state:${state}`);
        return data.codeVerifier;
    }

    public async getAccessToken(code: string, state: string): Promise<LinkedInToken> {
        const verifier = await this.validateState(state);
        const credentials = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.config.redirectUri,
            code_verifier: verifier
        });

        const response = await axios.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            params.toString(),
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        if (response.data?.access_token) {
            return {
                access_token: response.data.access_token,
                expires_in: response.data.expires_in,
                refresh_token: response.data.refresh_token,
                created_at: Date.now()
            };
        }

        throw new Error('Erro ao obter token de acesso');
    }

    async getProfileData(accessToken: string) {
        try {
            const response = await axios.get('https://api.linkedin.com/v2/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202304'
                }
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 401) {
                    throw new Error('Token do LinkedIn expirado ou revogado');
                }
                if (error.response?.status === 403) {
                    throw new Error('Permissões insuficientes');
                }
            }
            throw new Error('Erro ao obter dados do perfil do LinkedIn');
        }
    }

    public async getCookieFromToken(accessToken: string): Promise<string> {
        const jsessionid = `ajax:${Date.now()}`;
        return `li_at=${accessToken}; JSESSIONID=${jsessionid}`;
    }

    private async storeToken(userId: string, token: TokenResponse): Promise<void> {
        await this.redis.setex(
            `linkedin:token:${userId}`,
            token.expires_in,
            JSON.stringify(token)
        );
    }

    async refreshAccessToken(userId: string, refreshToken: string): Promise<LinkedInToken> {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret
        });

        try {
            const response = await axios.post(
                'https://www.linkedin.com/oauth/v2/accessToken',
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const newToken: LinkedInToken = {
                ...response.data,
                created_at: Date.now()
            };

            await this.storeToken(userId, newToken);
            return newToken;
        } catch (error) {
            throw new Error('Falha ao atualizar token de acesso');
        }
    }

    async validateToken(accessToken: string): Promise<boolean> {
        try {
            const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });
            
            return response.status === 200;
        } catch (error) {
            console.error('Erro ao validar token:', error);
            return false;
        }
    }
}
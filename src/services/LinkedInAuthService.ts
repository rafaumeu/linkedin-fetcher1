import axios from 'axios';
import crypto from 'crypto';
import { LinkedInScrapper } from './LinkedInScrapper';
import { env } from '../env';
import { Redis } from 'ioredis';

interface LinkedInToken {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    created_at: number;
}

class LinkedInAuthError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'LinkedInAuthError';
    }
}

export class LinkedInAuthService {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;
    private scope: string[];
    private redis: Redis;

    constructor(redis: Redis) {
        if (!env.linkedIn.clientId?.trim() || !env.linkedIn.clientSecret || !env.linkedIn.redirectUri?.trim()) {
            console.error('Configuração atual:', {
                hasClientId: !!env.linkedIn.clientId,
                hasClientSecret: !!env.linkedIn.clientSecret,
                redirectUri: env.linkedIn.redirectUri,
                clientIdLength: env.linkedIn.clientId?.length,
                clientSecretLength: env.linkedIn.clientSecret?.length,
                clientSecretFormat: env.linkedIn.clientSecret ? {
                    decoded: decodeURIComponent(env.linkedIn.clientSecret),
                    containsSpecialChars: /[\/\+\=\s]/.test(env.linkedIn.clientSecret)
                } : null
            });
            throw new Error('Credenciais do LinkedIn não configuradas corretamente');
        }

        this.clientId = env.linkedIn.clientId.trim();
        this.clientSecret = env.linkedIn.clientSecret;
        this.redirectUri = env.linkedIn.redirectUri.trim();
        this.scope = env.linkedIn.scopes;
        this.redis = redis;
        
        console.log('=== Configuração LinkedIn Detalhada ===');
        console.log('Client ID:', this.clientId);
        console.log('Client Secret Raw:', {
            length: this.clientSecret.length,
            firstChar: this.clientSecret[0],
            lastChar: this.clientSecret[this.clientSecret.length - 1],
            containsSpecialChars: /[\/\+\=\s]/.test(this.clientSecret)
        });
        console.log('Redirect URI:', this.redirectUri);
        console.log('Escopos:', this.scope);
        console.log('Client Secret Format:', {
            length: this.clientSecret.length,
            containsSlash: this.clientSecret.includes('/'),
            containsPlus: this.clientSecret.includes('+'),
            containsEquals: this.clientSecret.includes('=')
        });
    }

    private async saveState(state: string, codeVerifier: string): Promise<void> {
        const data = {
            codeVerifier,
            timestamp: Date.now()
        };
        
        console.log('Salvando state:', {
            state,
            codeVerifier: codeVerifier.substring(0, 10) + '...',
            key: `linkedin:state:${state}`
        });

        await this.redis.setex(
            `linkedin:state:${state}`,
            300, // 5 minutos
            JSON.stringify(data)
        );
    }

    private async getState(state: string): Promise<{ codeVerifier: string, timestamp: number } | null> {
        const data = await this.redis.get(`linkedin:state:${state}`);
        return data ? JSON.parse(data) : null;
    }

    private async deleteState(state: string): Promise<void> {
        await this.redis.del(`linkedin:state:${state}`);
    }

    private async generatePKCE() {
        const verifier = crypto.randomBytes(32).toString('base64url');
        const challenge = crypto
            .createHash('sha256')
            .update(verifier)
            .digest('base64url');
            
        await this.redis.setex(`pkce:${verifier}`, 600, challenge);
        return { verifier, challenge };
    }

    async getAuthorizationUrl(): Promise<string> {
        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');

        console.log('=== Gerando URL de Autorização ===');
        console.log('Dados gerados:', {
            state,
            codeVerifier: codeVerifier.substring(0, 10) + '...',
            codeChallenge: codeChallenge.substring(0, 10) + '...'
        });

        await this.saveState(state, codeVerifier);

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state,
            scope: this.scope.join(' '),
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    }

    private async validateState(state: string, code: string): Promise<string> {
        console.log('=== Validando State ===');
        console.log('State recebido:', state);
        
        const storedData = await this.redis.get(`linkedin:state:${state}`);
        console.log('Dados armazenados:', storedData);
        
        if (!storedData) {
            throw new LinkedInAuthError(
                'Estado inválido ou expirado',
                'INVALID_STATE'
            );
        }

        const data = JSON.parse(storedData);
        await this.redis.del(`linkedin:state:${state}`);
        return data.codeVerifier;
    }

    async getAccessToken(code: string, state: string): Promise<LinkedInToken> {
        try {
            const verifier = await this.validateState(state, code);
            
            // Codifica as credenciais em Base64
            const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirectUri,
                code_verifier: verifier
            });

            console.log('=== Debug Autenticação ===');
            console.log('Headers:', {
                'Authorization': `Basic ${credentials.substring(0, 10)}...`,
                'Content-Type': 'application/x-www-form-urlencoded'
            });

            const response = await axios.post(
                'https://www.linkedin.com/oauth/v2/accessToken',
                params.toString(),
                {
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    }
                }
            );

            return {
                ...response.data,
                created_at: Date.now()
            };
        } catch (error) {
            console.error('Erro completo:', error);
            return this.handleAuthError(error);
        }
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
                    throw new Error('Permissões insuficientes. Verifique as configurações do aplicativo LinkedIn');
                }
            }
            throw new Error('Erro ao obter dados do perfil do LinkedIn');
        }
    }

    async getCookieFromToken(accessToken: string): Promise<string> {
        try {
            // Gera um JSESSIONID único
            const jsessionid = `ajax:${Date.now()}`;
            
            // Usa o token como li_at e adiciona outros cookies necessários
            return `li_at=${accessToken}; JSESSIONID="${jsessionid}"; bcookie="v=2&${Date.now()}"`;
        } catch (error) {
            console.error('Erro ao gerar cookie:', error);
            throw new Error('Não foi possível gerar cookie com o token fornecido');
        }
    }

    private async validateCookie(cookie: string): Promise<boolean> {
        try {
            const scraper = new LinkedInScrapper(cookie);
            return true;
        } catch (error) {
            console.error('Cookie inválido:', error);
            return false;
        }
    }

    private generateCodeVerifier(): string {
        return crypto.randomBytes(32)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    private generateCodeChallenge(verifier: string): string {
        const hash = crypto.createHash('sha256')
            .update(verifier)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        return hash;
    }

    private async storeToken(userId: string, token: LinkedInToken): Promise<void> {
        if (!token || !token.access_token) {
            throw new LinkedInAuthError('Token inválido', 'INVALID_TOKEN');
        }

        await this.redis.setex(
            `linkedin_token:${userId}`,
            token.expires_in,
            JSON.stringify(token)  // Convertendo o objeto token para string
        );
    }

    private async getStoredToken(userId: string): Promise<LinkedInToken | null> {
        const tokenStr = await this.redis.get(`linkedin_token:${userId}`);
        if (!tokenStr) return null;
        
        try {
            return JSON.parse(tokenStr) as LinkedInToken;
        } catch {
            return null;
        }
    }

    async refreshAccessToken(userId: string, refreshToken: string): Promise<LinkedInToken> {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret
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

    private handleAuthError(error: unknown): never {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const errorData = error.response?.data;

            switch (status) {
                case 401:
                    throw new LinkedInAuthError(
                        'Credenciais inválidas ou token expirado',
                        'INVALID_CREDENTIALS',
                        errorData
                    );
                case 403:
                    throw new LinkedInAuthError(
                        'Acesso negado',
                        'ACCESS_DENIED',
                        errorData
                    );
                case 429:
                    throw new LinkedInAuthError(
                        'Limite de requisições excedido',
                        'RATE_LIMIT_EXCEEDED',
                        errorData
                    );
            }
        }
        
        throw new LinkedInAuthError(
            'Erro desconhecido durante autenticação',
            'UNKNOWN_ERROR'
        );
    }

    private isValidToken(token: unknown): token is LinkedInToken {
        if (!token || typeof token !== 'object') return false;
        
        return (
            'access_token' in token &&
            typeof token.access_token === 'string' &&
            'expires_in' in token &&
            typeof token.expires_in === 'number' &&
            'created_at' in token &&
            typeof token.created_at === 'number'
        );
    }

    private async getValidToken(userId: string): Promise<LinkedInToken | null> {
        const token = await this.getStoredToken(userId);
        
        if (!token || !this.isValidToken(token)) {
            return null;
        }

        // Verifica se o token ainda é válido
        const isExpired = Date.now() - token.created_at >= token.expires_in * 1000;
        return isExpired ? null : token;
    }

    private async validateCredentials(): Promise<void> {
        console.log('=== Debug Credenciais ===');
        console.log('Client ID:', this.clientId);
        console.log('Client Secret Length:', this.clientSecret.length);
        console.log('Redirect URI:', this.redirectUri);
        console.log('Client Secret Format:', {
            hasSpaces: /\s/.test(this.clientSecret),
            hasSpecialChars: /[^A-Za-z0-9+/=]/.test(this.clientSecret)
        });
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

    private async debugToken(accessToken: string): Promise<void> {
        try {
            console.log('\n=== Debug do Token LinkedIn ===');
            const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            console.log('Resposta:', {
                status: response.status,
                data: response.data
            });
        } catch (error) {
            console.error('Erro no debug:', error);
        }
    }
} 
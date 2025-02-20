import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { LinkedInScrapper } from './services/LinkedInScrapper';
import { CacheService } from './services/CacheService';
import { LinkedInAuthService } from './services/LinkedInAuthService';
import { env } from './env';
import { IProfileResponse, IProfileError } from './types/Profile';
import { LinkedInValidationResponse } from './types/linkedin';

dotenv.config();

console.log('\n=== Iniciando Servidor ===');
console.log('Ambiente:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    REDIS_HOST: process.env.REDIS_HOST
});

console.log('Configuração LinkedIn:', {
    clientId: env.linkedIn.clientId?.substring(0, 5) + '...',
    redirectUri: env.linkedIn.redirectUri,
    frontendUrl: env.linkedIn.frontendUrl,
    corsOrigin: env.cors.origin
});

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const cache = new CacheService();
const authService = new LinkedInAuthService(cache.getRedisInstance());

app.get('/api/health', async (_req: Request, res: Response) => {
    try {
        const redisStatus = await cache.healthCheck();
        return res.json({
            status: 'online',
            redis: redisStatus ? 'connected' : 'error',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

interface LinkedInProfileRequest {
    username: string;
    linkedinToken: string;
}

app.post('/api/linkedin/profile', async (req: Request<{}, {}, LinkedInProfileRequest>, res: Response<IProfileResponse | IProfileError>) => {
    try {
        const { username, linkedinToken } = req.body;

        if (!username || !linkedinToken) {
            return res.status(400).json({
                error: 'Username e token do LinkedIn são obrigatórios'
            });
        }

        const tokenMatch = linkedinToken.match(/li_at=([^;]+)/);
        const jsessionMatch = linkedinToken.match(/JSESSIONID=([^;]+)/);

        if (!tokenMatch?.[1] || !jsessionMatch?.[1]) {
            return res.status(400).json({
                error: 'Token inválido. Formato esperado: li_at=XXX; JSESSIONID=YYY'
            });
        }

        const cachedProfile = await cache.getProfile(username);
        if (cachedProfile) {
            const lastUpdate = await cache.getLastUpdate(username);
            return res.json({
                ...cachedProfile,
                lastUpdate: lastUpdate || new Date(),
                fromCache: true
            });
        }

        const scraper = new LinkedInScrapper(linkedinToken);
        const profile = await scraper.extrairPerfil(username);

        if (!profile.experiences?.length && 
            !profile.skills?.length && 
            !profile.education?.length && 
            !profile.certifications?.length) {
            return res.status(400).json({
                error: 'Não foi possível extrair dados. Verifique o token do LinkedIn.'
            });
        }

        await cache.setProfile(username, profile);
        await cache.setLastUpdate(username);

        return res.json({
            ...profile,
            lastUpdate: new Date(),
            fromCache: false
        });
    } catch (error) {
        console.error('Erro detalhado:', error);
        return res.status(500).json({
            error: 'Erro ao extrair perfil do LinkedIn',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

app.post('/api/linkedin/auth', async (req: Request, res: Response) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                error: 'Token de acesso é obrigatório'
            });
        }

        const linkedinCookie = await authService.getCookieFromToken(accessToken);
        
        return res.json({
            cookie: linkedinCookie
        });
    } catch (error) {
        return res.status(500).json({
            error: 'Erro ao gerar cookie do LinkedIn'
        });
    }
});

app.get('/api/linkedin/callback', async (req: Request, res: Response) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            const errorMsg = decodeURIComponent(error_description as string || error as string)
                .replace(/&quot;/g, '"');
            return res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent(errorMsg)}`);
        }

        if (!code || !state) {
            return res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent('Parâmetros de callback inválidos')}`);
        }

        const accessToken = await authService.getAccessToken(code as string, state as string);
        const linkedinCookie = await authService.getCookieFromToken(accessToken.access_token);
        
        return res.redirect(`${env.linkedIn.frontendUrl}?cookie=${encodeURIComponent(linkedinCookie)}`);
    } catch (error) {
        console.error('Erro no callback:', error);
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        return res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent(message)}`);
    }
});

app.post('/api/linkedin/browser-auth', async (req: Request, res: Response) => {
    try {
        const { cookie } = req.body;
        
        if (!cookie) {
            return res.status(400).json({
                error: 'Cookie do LinkedIn é obrigatório'
            });
        }

        const tokenMatch = cookie.match(/li_at=([^;]+)/);
        if (!tokenMatch?.[1]) {
            return res.status(400).json({
                error: 'Cookie inválido. Formato esperado: li_at=XXX'
            });
        }

        const jsessionid = `ajax:${Date.now()}`;
        const fullCookie = `${cookie}; JSESSIONID=${jsessionid}`;

        const scraper = new LinkedInScrapper(fullCookie);
        const isValid = await scraper.validateToken();

        if (!isValid) {
            return res.status(400).json({
                error: 'Cookie do LinkedIn inválido ou expirado'
            });
        }

        return res.json({ cookie: fullCookie });
    } catch (error) {
        console.error('Erro ao validar cookie:', error);
        return res.status(500).json({
            error: 'Erro ao validar cookie do LinkedIn'
        });
    }
});

app.post('/api/linkedin/validate-token', async (req: Request, res: Response<LinkedInValidationResponse>) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.json({ isValid: false, error: 'Token não fornecido' });
        }

        const scraper = new LinkedInScrapper(token);
        const isValid = await scraper.validateToken();

        return res.json({ isValid });
    } catch (error) {
        return res.json({
            isValid: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

const startServer = (): void => {
    try {
        app.listen(PORT, () => {
            console.log('=== Servidor Iniciado ===');
            console.log(`Porta: ${PORT}`);
            console.log(`Ambiente: ${process.env.NODE_ENV}`);
            console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
        });
    } catch (error) {
        console.error('Erro fatal ao iniciar servidor:', error);
        process.exit(1);
    }
};

startServer();

export default app; 
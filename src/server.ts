import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { LinkedInScrapper } from './services/LinkedInScrapper';
import { CacheService } from './services/CacheService';
import { CronJob } from 'cron';
import { LinkedInAuthService } from './services/LinkedInAuthService';
import { env } from './env';
import Redis from 'ioredis';

dotenv.config();

console.log('\n=== Iniciando Servidor ===');
console.log('Ambiente:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
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
const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
});
const authService = new LinkedInAuthService(redis);

app.post('/api/linkedin/profile', async (req, res) => {
    try {
        const { username, linkedinToken } = req.body;

        if (!username || !linkedinToken) {
            return res.status(400).json({
                error: 'Username e token do LinkedIn são obrigatórios'
            });
        }

        // Valida formato do token
        const tokenMatch = linkedinToken.match(/li_at=([^;]+)/);
        const jsessionMatch = linkedinToken.match(/JSESSIONID=([^;]+)/);

        if (!tokenMatch?.[1] || !jsessionMatch?.[1]) {
            return res.status(400).json({
                error: 'Token inválido. Formato esperado: li_at=XXX; JSESSIONID=YYY'
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

        res.json({
            ...profile,
            lastUpdate: new Date(),
            fromCache: false
        });
    } catch (error) {
        console.error('Erro detalhado:', error);
        res.status(500).json({
            error: 'Erro ao extrair perfil do LinkedIn',
            details: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
});

app.post('/api/linkedin/auth', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                error: 'Token de acesso é obrigatório'
            });
        }

        const linkedinCookie = await authService.getCookieFromToken(accessToken);
        
        res.json({
            cookie: linkedinCookie
        });
    } catch (error) {
        res.status(500).json({
            error: 'Erro ao gerar cookie do LinkedIn'
        });
    }
});

app.get('/api/linkedin/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;
        
        console.log('Callback LinkedIn recebido:', {
            hasCode: !!code,
            state,
            error,
            error_description
        });

        if (error) {
            const errorMsg = decodeURIComponent(error_description as string || error as string)
                .replace(/&quot;/g, '"');
            console.error('Erro LinkedIn:', errorMsg);
            return res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent(errorMsg)}`);
        }

        if (!code || !state) {
            return res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent('Parâmetros de callback inválidos')}`);
        }

        const accessToken = await authService.getAccessToken(code as string, state as string);
        const linkedinCookie = await authService.getCookieFromToken(accessToken.access_token);
        
        res.redirect(`${env.linkedIn.frontendUrl}?cookie=${encodeURIComponent(linkedinCookie)}`);
    } catch (error) {
        console.error('Erro no callback:', error);
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent(message)}`);
    }
});

app.get('/api/linkedin/login', async (req, res) => {
    console.log('\n=== Requisição de Login Recebida ===');
    console.log('Headers:', {
        origin: req.headers.origin,
        referer: req.headers.referer
    });
    
    try {
        const authUrl = await authService.getAuthorizationUrl();
        console.log('Redirecionando para:', authUrl);
        
        // Força o redirecionamento imediato
        res.writeHead(302, {
            'Location': authUrl
        });
        res.end();
    } catch (error) {
        console.error('Erro no login:', error);
        const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        res.redirect(`${env.linkedIn.frontendUrl}?error=${encodeURIComponent(errorMsg)}`);
    }
});

app.post('/api/linkedin/browser-auth', async (req, res) => {
    try {
        const { cookie } = req.body;
        
        if (!cookie) {
            return res.status(400).json({
                error: 'Cookie do LinkedIn é obrigatório'
            });
        }

        // Valida formato do cookie
        const tokenMatch = cookie.match(/li_at=([^;]+)/);
        if (!tokenMatch?.[1]) {
            return res.status(400).json({
                error: 'Cookie inválido. Formato esperado: li_at=XXX'
            });
        }

        // Gera um JSESSIONID único
        const jsessionid = `ajax:${Date.now()}`;
        const fullCookie = `${cookie}; JSESSIONID=${jsessionid}`;

        // Valida se o cookie funciona
        const scraper = new LinkedInScrapper(fullCookie);
        const isValid = await scraper.validateToken();

        if (!isValid) {
            return res.status(400).json({
                error: 'Cookie do LinkedIn inválido ou expirado'
            });
        }

        res.json({ cookie: fullCookie });
    } catch (error) {
        console.error('Erro ao validar cookie:', error);
        res.status(500).json({
            error: 'Erro ao validar cookie do LinkedIn'
        });
    }
});

// Job para atualização automática
const updateJob = new CronJob('0 0 */12 * * *', async () => { // Roda a cada 12 horas
    try {
        // Aqui você pode implementar a lógica para atualizar perfis frequentemente acessados
        console.log('Iniciando atualização automática...');
    } catch (error) {
        console.error('Erro na atualização automática:', error);
    }
});

updateJob.start();

app.get('/api/linkedin/debug', async (req, res) => {
    try {
        const clientId = env.linkedIn.clientId;
        const clientSecret = env.linkedIn.clientSecret;
        const redirectUri = env.linkedIn.redirectUri;

        // Testa conexão com Redis
        const redisTest = await redis.ping();
        
        res.json({
            clientIdLength: clientId.length,
            clientSecretLength: clientSecret.length,
            redirectUri,
            redisConnection: redisTest === 'PONG',
            env: process.env.NODE_ENV,
            scopes: env.linkedIn.scopes
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao debugar configurações' });
    }
});

app.get('/api/linkedin/debug-auth', async (req, res) => {
    try {
        const clientId = env.linkedIn.clientId;
        const clientSecret = env.linkedIn.clientSecret;
        
        res.json({
            clientId: {
                value: clientId.substring(0, 5) + '...',
                length: clientId.length,
                hasSpaces: /\s/.test(clientId)
            },
            clientSecret: {
                length: clientSecret.length,
                isBase64: /^[A-Za-z0-9+/=]+$/.test(clientSecret),
                hasSpaces: /\s/.test(clientSecret),
                hasSpecialChars: /[^A-Za-z0-9+/=]/.test(clientSecret)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao debugar autenticação' });
    }
});

app.get('/api/linkedin/debug-credentials', async (req, res) => {
    try {
        const clientId = env.linkedIn.clientId;
        const clientSecret = env.linkedIn.clientSecret;
        
        res.json({
            clientId: {
                length: clientId.length,
                firstChars: clientId.substring(0, 5) + '...',
                hasSpaces: /\s/.test(clientId)
            },
            clientSecret: {
                length: clientSecret.length,
                hasSpaces: /\s/.test(clientSecret),
                isBase64: /^[A-Za-z0-9+/=]+$/.test(clientSecret)
            },
            redirectUri: env.linkedIn.redirectUri,
            scopes: env.linkedIn.scopes
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao verificar credenciais' });
    }
});

app.post('/api/linkedin/validate-token', async (req, res) => {
    try {
        const { accessToken } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                error: 'Token não fornecido'
            });
        }

        const isValid = await authService.validateToken(accessToken);
        
        res.json({
            valid: isValid
        });
    } catch (error) {
        res.status(500).json({
            error: 'Erro ao validar token'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 
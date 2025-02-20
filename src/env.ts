import dotenv from 'dotenv';
dotenv.config();

if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET || !process.env.LINKEDIN_REDIRECT_URI) {
    throw new Error('Variáveis de ambiente do LinkedIn não configuradas');
}

export const env = {
    linkedIn: {
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        redirectUri: process.env.LINKEDIN_REDIRECT_URI,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        scopes: [
            'openid',
            'profile',
            'email',
            'w_member_social'
        ]
    },
    cors: {
        origin: process.env.CORS_ORIGIN || '*'
    }
}; 
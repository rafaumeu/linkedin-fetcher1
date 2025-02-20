// src/index.ts

import dotenv from 'dotenv';
import { LinkedInScrapper } from './services/LinkedInScrapper';

dotenv.config();

async function main() {
    const cookie = process.env.LINKEDIN_COOKIE;
    
    if (!cookie) {
        throw new Error('LINKEDIN_COOKIE não encontrado no arquivo .env');
    }

    const scraper = new LinkedInScrapper(cookie);
    
    try {
        // Extrair username da URL
        const username = 'rafael-dias-zendron-528290132';
        const experiencias = await scraper.extrairPerfil(username);
        
        console.log(JSON.stringify(experiencias, null, 2));
    } catch (error) {
        console.error('Erro:', error);
    }
}

main();
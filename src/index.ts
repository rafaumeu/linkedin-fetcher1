// src/index.ts

import dotenv from "dotenv";
import { CacheService } from "./services/CacheService";
import { LinkedInScrapper } from "./services/LinkedInScrapper";

dotenv.config();

const cache = new CacheService();

async function validateEnvironment(): Promise<void> {
  if (!process.env.LINKEDIN_COOKIE) {
    throw new Error("LINKEDIN_COOKIE não encontrado no arquivo .env");
  }

  const redisHealth = await cache.healthCheck();
  if (!redisHealth) {
    throw new Error("Não foi possível conectar ao Redis");
  }
}

async function main(): Promise<void> {
  try {
    await validateEnvironment();

    const cookie = process.env.LINKEDIN_COOKIE as string;
    const username =
      process.env.TEST_PROFILE || "rafael-dias-zendron-528290132";

    console.log("=== Iniciando extração de perfil ===");
    console.log("Username:", username);

    const scraper = new LinkedInScrapper(cookie);
    const profile = await scraper.extrairPerfil(username);

    if (!profile) {
      throw new Error("Não foi possível extrair o perfil");
    }

    await cache.setProfile(username, profile);
    await cache.setLastUpdate(username);

    console.log("=== Perfil extraído com sucesso ===");
    console.log(JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error(
      "Erro fatal:",
      error instanceof Error ? error.message : "Erro desconhecido",
    );
    process.exit(1);
  }
}

// Executa apenas se for chamado diretamente (não como módulo)
if (require.main === module) {
  main().catch((error) => {
    console.error("Erro não tratado:", error);
    process.exit(1);
  });
}

export { main };
main();

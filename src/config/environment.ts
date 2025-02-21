import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

function loadEnvFile() {
  const env = process.env.NODE_ENV || "development";
  const envPath = path.resolve(process.cwd(), `.env.${env}`);

  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.warn(`Arquivo .env.${env} não encontrado, usando .env padrão`);
    dotenv.config();
  }
}

loadEnvFile();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),

  LINKEDIN_CLIENT_ID: z.string(),
  LINKEDIN_CLIENT_SECRET: z.string(),
  LINKEDIN_REDIRECT_URI: z.string(),
  LINKEDIN_COOKIE: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("*"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Erro na validação das variáveis de ambiente:",
    parsedEnv.error.format(),
  );
  process.exit(1);
}

export const environment = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,

  redis: {
    host: parsedEnv.data.REDIS_HOST,
    port: parsedEnv.data.REDIS_PORT,
    password: parsedEnv.data.REDIS_PASSWORD,
    url: parsedEnv.data.REDIS_URL,
  },

  linkedIn: {
    clientId: parsedEnv.data.LINKEDIN_CLIENT_ID,
    clientSecret: parsedEnv.data.LINKEDIN_CLIENT_SECRET,
    redirectUri: parsedEnv.data.LINKEDIN_REDIRECT_URI,
    cookie: parsedEnv.data.LINKEDIN_COOKIE,
    frontendUrl: parsedEnv.data.FRONTEND_URL,
    scopes: ["openid", "profile", "email", "w_member_social"],
  },

  cors: {
    origin: parsedEnv.data.CORS_ORIGIN,
  },
};
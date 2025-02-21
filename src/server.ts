import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { environment } from "./config/environment";
import { linkedinRoutes } from "./routes/linkedin";
import { CacheService } from "./services/CacheService";

dotenv.config();

console.log("\n=== Iniciando Servidor ===");
console.log("Ambiente:", {
  NODE_ENV: environment.nodeEnv,
  PORT: environment.port,
  REDIS_HOST: environment.redis.host,
});

const app = express();
const cache = new CacheService();

const startServer = async (): Promise<void> => {
  try {
    await cache.waitForConnection();

    app.use(
      cors({
        origin: environment.cors.origin,
        credentials: true,
      }),
    );
    app.use(express.json());

    // Configuração das rotas
    app.use("/api/linkedin", linkedinRoutes);

    const PORT = environment.port || 3000;

    app.listen(PORT, () => {
      console.log("=== Servidor Iniciado ===");
      console.log(`Porta: ${PORT}`);
      console.log(`Ambiente: ${process.env.NODE_ENV}`);
      console.log(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    });
  } catch (error) {
    console.error("Erro fatal ao iniciar servidor:", error);
    process.exit(1);
  }
};

startServer();

export default app;

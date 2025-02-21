import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { CacheService } from "./services/CacheService";
import { setupSwagger } from "./swagger";
import passport from 'passport';
import './config/passport'; // Certifique-se de importar a configuração do Passport

dotenv.config(); // Carregando as variáveis de ambiente

// Agora você pode importar o environment
import { environment } from "./config/environment"; // Importando as variáveis de ambiente
import { linkedinRoutes } from "./routes/linkedin";

const app = express();
const cache = new CacheService();

// Configurações do middleware
app.use(cors());
app.use(express.json());
app.use(passport.initialize());

// Configuração das rotas
app.use("/api/linkedin", linkedinRoutes);

// Configuração do Swagger
setupSwagger(app);

app.get("/", (_req, res) => {
  res.redirect("/api-docs"); // Redireciona para a documentação do Swagger
});

const startServer = async (): Promise<void> => {
  try {
    await cache.waitForConnection();

    const PORT = environment.port || 3000;

    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("LINKEDIN_CLIENT_ID:", process.env.LINKEDIN_CLIENT_ID);
    console.log("LINKEDIN_CLIENT_SECRET:", process.env.LINKEDIN_CLIENT_SECRET);
    console.log("LINKEDIN_REDIRECT_URI:", process.env.LINKEDIN_REDIRECT_URI);

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

app.use((_req, res) => {
  res.status(404).send('Rota não encontrada.'); // Mensagem para rotas não definidas
});

export default app;

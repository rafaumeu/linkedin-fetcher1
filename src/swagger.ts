import fs from "node:fs";
import path from "node:path";
import type { Application } from "express";
import type { OpenAPIV3 } from "openapi-types";
import swaggerUi from "swagger-ui-express";

const swaggerFilePath = path.join(__dirname, "../swagger.json");
const swaggerDocs: OpenAPIV3.Document = JSON.parse(
  fs.readFileSync(swaggerFilePath, "utf-8"),
);

// Middleware para servir a documentação do Swagger
export const setupSwagger = (app: Application) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};

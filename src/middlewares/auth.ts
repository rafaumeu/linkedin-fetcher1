import type { NextFunction, Request, Response } from "express";
import { LinkedInScrapper } from "../services/LinkedInScrapper";

export async function validateLinkedInToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  try {
    const scraper = new LinkedInScrapper(token);
    const isValid = await scraper.validateToken();

    if (!isValid) {
      res.status(401).json({ error: "Token inválido ou expirado" });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ error: "Erro na validação do token" });
    return;
  }
}

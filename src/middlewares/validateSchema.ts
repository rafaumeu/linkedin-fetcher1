import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { z } from "zod";

export const validateSchema = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        next(error);
      }
    }
  };
};

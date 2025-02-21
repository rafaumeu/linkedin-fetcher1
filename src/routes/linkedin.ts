import { Router } from "express";
import passport from "passport";
import { z } from "zod";
import { LinkedInController } from "../controllers/LinkedInController";
import { validateLinkedInToken } from "../middlewares/auth";
import { validateSchema } from "../middlewares/validateSchema";
import { LinkedInAuthService } from "../services/LinkedInAuthService";

const router = Router();
const authService = new LinkedInAuthService();
const linkedinController = new LinkedInController(authService);

// Rotas de autenticação
router.get("/auth", linkedinController.authenticate);
router.get("/auth/linkedin", passport.authenticate("linkedin"));
router.get(
  "/auth/linkedin/callback",
  passport.authenticate("linkedin", { failureRedirect: "/login" }),
  (_req, res) => {
    res.redirect("/"); // Redirecione para onde você quiser
  },
);

// Rotas protegidas
router.post(
  "/profile",
  validateLinkedInToken,
  validateSchema(
    z.object({
      username: z.string(),
      linkedinToken: z.string(),
    }),
  ),
  linkedinController.getProfile,
);

router.post(
  "/validate",
  validateSchema(
    z.object({
      token: z.string(),
    }),
  ),
  linkedinController.validateToken,
);

router.post(
  "/browser-auth",
  validateSchema(
    z.object({
      token: z.string(),
    }),
  ),
  linkedinController.browserAuth,
);

export { router as linkedinRoutes };

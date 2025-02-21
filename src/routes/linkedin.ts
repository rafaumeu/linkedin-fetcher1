import { Router } from "express";
import { LinkedInController } from "../controllers/LinkedInController";
import { validateLinkedInToken } from "../middlewares/auth";
import { LinkedInAuthService } from "../services/LinkedInAuthService";

const router = Router();
const authService = new LinkedInAuthService();
const linkedinController = new LinkedInController(authService);

// Rotas de autenticação
router.get("/auth", linkedinController.authenticate);
router.get("/callback", linkedinController.handleCallback);

// Rotas protegidas
router.post("/profile", validateLinkedInToken, linkedinController.getProfile);
router.post("/validate", linkedinController.validateToken);
router.post("/browser-auth", linkedinController.browserAuth);

export { router as linkedinRoutes };

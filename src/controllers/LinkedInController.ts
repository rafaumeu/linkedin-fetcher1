import type { Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import { environment } from "../config/environment";
import { LinkedInCallbackSchema } from "../schemas/linkedin";
import { CacheService } from "../services/CacheService";
import type { LinkedInAuthService } from "../services/LinkedInAuthService";
import { LinkedInScrapper } from "../services/LinkedInScrapper";
import type {
  IProfileError,
  IProfileResponse,
  LinkedInProfile,
  LinkedInProfileBody,
  LinkedInValidationResponse,
} from "../types/linkedin";

export class LinkedInController {
  private readonly authService: LinkedInAuthService;
  private readonly cache: CacheService;

  constructor(authService: LinkedInAuthService) {
    this.authService = authService;
    this.cache = new CacheService();
  }

  public getProfile = async (
    req: Request<
      ParamsDictionary,
      IProfileResponse | IProfileError,
      LinkedInProfileBody
    >,
    res: Response<IProfileResponse | IProfileError>,
  ) => {
    try {
      const { username, linkedinToken } = req.body;

      if (!this.validateProfileRequest(username, linkedinToken)) {
        return res.status(400).json({
          error: "Username e token do LinkedIn são obrigatórios",
        });
      }

      const tokenValidation = this.validateTokenFormat(linkedinToken);
      if (!tokenValidation.isValid) {
        return res.status(400).json({
          error: tokenValidation.error || "Token inválido",
        });
      }

      const cachedProfile = await this.getCachedProfile(username);
      if (cachedProfile) {
        return res.json(cachedProfile);
      }

      const profile = await this.fetchAndCacheProfile(username, linkedinToken);
      return res.json(profile);
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  public validateToken = async (
    req: Request,
    res: Response<LinkedInValidationResponse>,
  ) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.json({ isValid: false, error: "Token não fornecido" });
      }

      const scraper = new LinkedInScrapper(token);
      const isValid = await scraper.validateToken();

      return res.json({ isValid });
    } catch (error) {
      return res.json({
        isValid: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  };

  public authenticate = async (_req: Request, res: Response) => {
    try {
      const authUrl = await this.authService.getAuthorizationUrl();
      return res.json({ url: authUrl });
    } catch (error) {
      console.error("Erro na autenticação:", error);
      return res.status(500).json({
        error: "Erro ao iniciar autenticação com LinkedIn",
      });
    }
  };

  public handleCallback = async (req: Request, res: Response) => {
    try {
      const params = LinkedInCallbackSchema.parse(req.query);
      const tokens = await this.authService.handleCallback(params.code);

      return res.redirect(
        `${environment.linkedIn.frontendUrl}?tokens=${JSON.stringify(tokens)}`,
      );
    } catch (error) {
      console.error("Erro no callback:", error);
      return res.redirect(
        `${environment.linkedIn.frontendUrl}?error=auth_failed`,
      );
    }
  };

  public browserAuth = async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Token não fornecido" });
      }

      const isValid = await this.authService.validateBrowserToken(token);
      if (!isValid) {
        return res.status(401).json({ error: "Token inválido ou expirado" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Erro na autenticação do browser:", error);
      return res.status(500).json({
        error: "Erro na autenticação",
      });
    }
  };

  private validateProfileRequest(username?: string, token?: string): boolean {
    return Boolean(username && token);
  }

  private validateTokenFormat(token: string) {
    const tokenMatch = token.match(/li_at=([^;]+)/);
    const jsessionMatch = token.match(/JSESSIONID=([^;]+)/);

    if (!tokenMatch?.[1] || !jsessionMatch?.[1]) {
      return {
        isValid: false,
        error: "Token inválido. Formato esperado: li_at=XXX; JSESSIONID=YYY",
      };
    }

    return { isValid: true };
  }

  private async getCachedProfile(
    username: string,
  ): Promise<IProfileResponse | null> {
    const profile = await this.cache.getProfile(username);
    if (!profile) return null;

    const lastUpdate = await this.cache.getLastUpdate(username);
    return {
      ...profile,
      profileUrl: `https://www.linkedin.com/in/${username}`,
      lastUpdate: lastUpdate || new Date(),
      fromCache: true,
    };
  }

  private async fetchAndCacheProfile(
    username: string,
    token: string,
  ): Promise<IProfileResponse> {
    const scraper = new LinkedInScrapper(token);
    const profile = await scraper.extrairPerfil(username);

    const linkedInProfile: LinkedInProfile = {
      ...profile,
      profileUrl: `https://www.linkedin.com/in/${username}`,
    };

    if (!this.isValidProfile(linkedInProfile)) {
      throw new Error(
        "Não foi possível extrair dados. Verifique o token do LinkedIn.",
      );
    }

    await this.cache.setProfile(username, linkedInProfile);
    await this.cache.setLastUpdate(username);

    return {
      ...linkedInProfile,
      lastUpdate: new Date(),
      fromCache: false,
    };
  }

  private isValidProfile(profile: LinkedInProfile): boolean {
    return Boolean(
      profile.experiences?.length ||
        profile.skills?.length ||
        profile.education?.length ||
        profile.certifications?.length,
    );
  }

  private handleError(res: Response, error: unknown): Response {
    console.error("Erro detalhado:", error);
    return res.status(500).json({
      error: "Erro ao extrair perfil do LinkedIn",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}

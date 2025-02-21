import axios, { AxiosError } from "axios";
import type { Redis } from "ioredis";
import { z } from "zod";
import { environment } from "../config/environment";
import { LinkedInAuthError } from "../errors/LinkedInAuthError";
import { LinkedInTokenSchema } from "../schemas/linkedin";
import type { AuthenticatedUser } from "../types/auth";
import type { LinkedInConfig, LinkedInToken } from "../types/linkedin";
import { CacheService } from "./CacheService";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

// Estendendo o tipo User do Passport
declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export class LinkedInAuthService {
  private readonly config: LinkedInConfig;
  private readonly cache: CacheService;

  constructor() {
    const isDev = process.env.NODE_ENV === "development";

    const config = {
      clientId:
        environment.linkedIn?.clientId ||
        process.env.LINKEDIN_CLIENT_ID ||
        (isDev ? "dev-id" : undefined),
      clientSecret:
        environment.linkedIn?.clientSecret ||
        process.env.LINKEDIN_CLIENT_SECRET ||
        (isDev ? "dev-secret" : undefined),
      redirectUri:
        environment.linkedIn?.redirectUri ||
        process.env.LINKEDIN_REDIRECT_URI ||
        (isDev ? "http://localhost:3000/callback" : undefined),
      cookie:
        environment.linkedIn?.cookie ||
        process.env.LINKEDIN_COOKIE ||
        (isDev ? "dev-cookie" : undefined),
      frontendUrl:
        environment.linkedIn?.frontendUrl ||
        process.env.FRONTEND_URL ||
        "http://localhost:3000",
      scopes: environment.linkedIn?.scopes || [
        "r_liteprofile",
        "r_emailaddress",
      ],
    };

    if (
      !isDev &&
      (!config.clientId ||
        !config.clientSecret ||
        !config.redirectUri ||
        !config.cookie)
    ) {
      throw new Error(
        "Configurações essenciais do LinkedIn ausentes em produção",
      );
    }

    this.config = config as LinkedInConfig;
    this.cache = new CacheService();
  }

  private async getRedis(): Promise<Redis> {
    await this.cache.waitForConnection();
    return this.cache.getRedisInstance();
  }

  private async validateState(state: string): Promise<string> {
    const storedData = await this.cache.get(`linkedin:state:${state}`);

    if (!storedData) {
      throw new LinkedInAuthError(
        "Estado inválido ou expirado",
        "INVALID_STATE",
      );
    }

    await this.cache.del(`linkedin:state:${state}`);
    return JSON.parse(storedData);
  }

  public async getAccessToken(
    code: string,
    state: string,
  ): Promise<LinkedInToken> {
    const verifier = await this.validateState(state);

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code_verifier: verifier,
    });

    try {
      const response = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      return LinkedInTokenSchema.parse({
        ...response.data,
        created_at: Date.now(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Erro de validação:", error.errors);
        throw new LinkedInAuthError(
          "Resposta inválida do LinkedIn",
          "INVALID_RESPONSE",
        );
      }
      if (error instanceof AxiosError) {
        console.error("Erro na requisição:", {
          status: error.response?.status,
          data: error.response?.data,
        });
        throw new LinkedInAuthError(
          "Falha na autenticação com LinkedIn",
          "AUTH_ERROR",
        );
      }
      throw error;
    }
  }

  async getProfileData(accessToken: string) {
    try {
      const response = await axios.get("https://api.linkedin.com/v2/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "LinkedIn-Version": "202304",
        },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error("Token do LinkedIn expirado ou revogado");
        }
        if (error.response?.status === 403) {
          throw new Error("Permissões insuficientes");
        }
      }
      throw new Error("Erro ao obter dados do perfil do LinkedIn");
    }
  }

  public async getCookieFromToken(accessToken: string): Promise<string> {
    const jsessionid = `ajax:${Date.now()}`;
    return `li_at=${accessToken}; JSESSIONID=${jsessionid}`;
  }

  public async storeToken(userId: string, token: TokenResponse): Promise<void> {
    const redis = await this.getRedis();
    await redis.setex(
      `linkedin:token:${userId}`,
      token.expires_in,
      JSON.stringify(token),
    );
  }

  async refreshAccessToken(
    userId: string,
    refreshToken: string,
  ): Promise<LinkedInToken> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const newToken: LinkedInToken = {
        ...response.data,
        created_at: Date.now(),
      };

      await this.storeToken(userId, newToken);
      return newToken;
    } catch (error) {
      throw new Error("Falha ao atualizar token de acesso");
    }
  }

  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      });

      return response.status === 200;
    } catch (error) {
      console.error("Erro ao validar token:", error);
      return false;
    }
  }

  public async getAuthorizationUrl(state: string): Promise<string> {
    const baseUrl = "https://www.linkedin.com/oauth/v2/authorization";
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: state,
      scope: this.config.scopes.join(" "),
    });

    return `${baseUrl}?${params.toString()}`;
  }

  public async handleCallback(code: string): Promise<LinkedInToken> {
    try {
      const tokens = await this.getAccessToken(
        code,
        await this.getStoredState(),
      );
      return tokens;
    } catch (error) {
      console.error("Erro no callback:", error);
      throw new Error("Falha ao processar callback do LinkedIn");
    }
  }

  public async validateBrowserToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get(
        "https://www.linkedin.com/voyager/api/me",
        {
          headers: {
            cookie: token,
            accept: "application/vnd.linkedin.normalized+json+2.1",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0",
          },
          maxRedirects: 5,
          validateStatus: () => true,
        },
      );
      return response.status === 200;
    } catch (error) {
      console.error("Erro ao validar token do browser:", error);
      return false;
    }
  }

  private async getStoredState(): Promise<string> {
    const redis = await this.getRedis();
    const state = await redis.get("linkedin:state");
    if (!state) {
      throw new LinkedInAuthError(
        "Estado da autenticação não encontrado",
        "INVALID_STATE",
      );
    }
    return state;
  }

  public async storeState(state: string): Promise<void> {
    const redis = await this.getRedis();
    await redis.set(
      `linkedin:state:${state}`,
      JSON.stringify({
        /* dados adicionais se necessário */
      }),
      "EX",
      300,
    ); // Armazena por 5 minutos
  }
}

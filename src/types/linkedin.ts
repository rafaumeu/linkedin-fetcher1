import type { z } from "zod";
import type {
  LinkedInConfigSchema,
  LinkedInTokenSchema,
} from "../schemas/linkedin";

// Tipos inferidos dos schemas Zod
export type LinkedInConfigType = z.infer<typeof LinkedInConfigSchema>;
export type LinkedInTokenType = z.infer<typeof LinkedInTokenSchema>;

// Interface base para configuração
export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  cookie: string;
  frontendUrl: string;
  scopes: string[];
}

// Interface base para token
export interface LinkedInToken {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  created_at: number;
}

export interface LinkedInProfile {
  name: string;
  headline?: string;
  location?: string;
  profileUrl: string;
  connections?: number;
  company?: string;
  position?: string;
  experiences?: Array<{
    title: string;
    company: string;
    duration?: string;
    location?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    isCurrentRole?: boolean;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    duration?: string;
  }>;
  skills?: string[];
  certifications?: Array<{
    name: string;
    issuer: string;
    issueDate?: string;
    expirationDate?: string;
  }>;
}

export interface IEducation {
  school: string;
  degree?: string;
  field?: string;
  duration?: string;
}

export interface ICertification {
  name: string;
  issuer: string;
  issueDate?: string;
  expirationDate?: string;
}

export interface LinkedInProfileParams {
  username?: string;
}

export interface LinkedInProfileBody {
  username: string;
  linkedinToken: string;
}

export interface IProfileResponse extends LinkedInProfile {
  lastUpdate: Date;
  fromCache: boolean;
}

export interface IProfileError {
  error: string;
}

export interface LinkedInTokenStorage {
  token: LinkedInToken;
  userId: string;
  state: string;
}

export interface LinkedInErrorResponse {
  error: string;
  error_description?: string;
  status?: number;
}

export interface LinkedInAuthResponse {
  code: string;
  state: string;
}

export interface LinkedInValidationResponse {
  isValid: boolean;
  error?: string;
}

export interface LinkedInApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface ApiData {
  included: ApiElement[];
  data: {
    experience: {
      elements: ExperienceElement[];
    };
  };
}

export interface ApiElement {
  $type: string;
  entityUrn: string;
  title?: string;
  companyName?: string;
  description?: string;
  dateRange?: ApiPeriod;
}

export interface ExperienceElement {
  empresa: string;
  cargo: string;
  periodo: string;
  descricao: string;
  startDate?: string;
  endDate?: string;
  skills: string[];
}

export interface ApiPeriod {
  start: { year: number; month?: number };
  end?: { year: number; month?: number };
}

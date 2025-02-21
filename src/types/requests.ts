export interface LinkedInProfileParams {
  username?: string;
}

export interface LinkedInProfileBody {
  username: string;
  linkedinToken: string;
}

export interface LinkedInValidationResponse {
  isValid: boolean;
  error?: string;
}

export interface LinkedInCallbackParams {
  code: string;
  state?: string;
  error?: string;
  error_description?: string;
}

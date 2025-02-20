export interface LinkedInProfile {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    email?: string;
}

export interface LinkedInToken {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    created_at: number;
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
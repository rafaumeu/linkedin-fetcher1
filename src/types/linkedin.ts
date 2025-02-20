interface LinkedInProfileResponse {
  profilePicture: {
    displayImage: {
      elements: Array<{
        identifiers: Array<{
          identifier: string;
          index: number;
          mediaType: string;
          file: string;
          identifierType: string;
          identifierExpiresInSeconds: number;
        }>;
      }>;
    };
  };
}

interface LinkedInUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture: string;
  email: string;
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
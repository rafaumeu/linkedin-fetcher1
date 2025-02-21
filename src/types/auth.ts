export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken?: string;
}

export class LinkedInAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_RESPONSE"
      | "AUTH_ERROR"
      | "INVALID_CONFIG"
      | "INVALID_STATE",
  ) {
    super(message);
    this.name = "LinkedInAuthError";
  }
}

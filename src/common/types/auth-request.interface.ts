import { Request } from 'express';

/**
 * Shape of the user object attached to the request after JWT or API-key auth.
 * JwtStrategy.validate() returns { sub, walletAddress, role }.
 * ApiKeyGuard additionally sets apiKeyId and scope.
 */
export interface JwtUser {
  /** UUID of the authenticated user (from JWT `sub` claim) */
  sub: string;
  walletAddress: string;
  role: string;
  /** Present only when authenticated via API key */
  apiKeyId?: string;
  scope?: string;
}

/** Express Request with a typed `user` property populated by guards */
export interface AuthRequest extends Request {
  user: JwtUser;
}

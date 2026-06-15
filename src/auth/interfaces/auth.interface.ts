export interface JwtPayload {
  sub: string; // user id
  email: string;
  walletAddress: string;
  role?: string; // 'creator' | 'admin' | 'donor'
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    walletAddress: string;
  };
}

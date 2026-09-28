import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    accessToken?: string;
    refreshToken?: string;
  }

  interface Session {
    user: {
      accessToken?: string;
      refreshToken?: string;
    } & DefaultSession["user"];
    accessToken?: string;
    refreshToken?: string;
    error?: string;
    tenantSlug?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: string;
  }
}

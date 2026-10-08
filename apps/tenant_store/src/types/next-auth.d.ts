import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    accessToken?: string;
    refreshToken?: string;
    verified?: boolean;
  }

  interface Session {
    user: {
      accessToken?: string;
      verified?: boolean;
    } & DefaultSession["user"];
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    verified?: boolean;
    accessTokenExpiresAt?: number;
    error?: string;
  }
}

import { apiClient } from "@/api/apiClient";
import axios from "axios";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Tenant slug forwarded by the login form. Required when subdomain mode
        // is off, because `/api/auth/*` is excluded from the proxy matcher, so
        // no `x-tenant-slug` header reaches this server-side call.
        tenant: { label: "Tenant", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const tenantSlug = credentials.tenant?.trim();

        try {
          const res = await apiClient.post(
            `${BACKEND_URL}/auth/login`,
            {
              email: credentials.email,
              password: credentials.password,
            },
            tenantSlug
              ? { headers: { "x-tenant-slug": tenantSlug } }
              : undefined,
          );
          const data = res.data;

          if (!data) {
            throw new Error(data?.message ?? "Invalid credentials");
          }

          const accessToken = data?.access_token;
          if (!accessToken) {
            throw new Error("No token returned from server");
          }

          return {
            id: data.id,
            email: data.email,
            accessToken,
            refreshToken: data.refresh_token,
            verified: data.verified,
          };
        } catch (error) {
          // Surface the backend error code (e.g. EMAIL_NOT_VERIFIED) so the
          // login form can offer a verification link instead of a generic error.
          if (axios.isAxiosError(error)) {
            const payload = error.response?.data as
              | { code?: string; message?: string }
              | undefined;
            throw new Error(payload?.code ?? payload?.message ?? "Invalid credentials");
          }
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.verified = user.verified;
      }
      return token;
    },
    session({ session, token }) {
      // Only the short-lived access token is exposed to the browser session.
      // The refresh token stays server-side in the httpOnly cookie (read by the
      // proxy and /api/refresh via `getToken`) so browser JavaScript / XSS can
      // never read the long-lived rotating credential.
      session.user.accessToken = token.accessToken as string;
      session.user.verified = token.verified;
      return session;
    },
  },
};

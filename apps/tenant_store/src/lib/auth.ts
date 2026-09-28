import { apiClient } from "@/api/apiClient";
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }
        const res = await apiClient.post(`${BACKEND_URL}/auth/login`, {
          email: credentials.email,
          password: credentials.password,
        });
        const data = res.data;

        console.log("🚀 ~ auth.ts:29 ~ data:", data);

        if (!res.data) {
          throw new Error(data?.message ?? "Invalid credentials");
        }

        const accessToken = data?.access_token;
        if (!accessToken) {
          throw new Error("No token returned from server");
        }

        return {
          id: data.id,
          accessToken,
          refreshToken: data.refresh_token,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user.accessToken = token.accessToken as string;
      session.user.refreshToken = token.refreshToken as string;
      return session;
    },
  },
};

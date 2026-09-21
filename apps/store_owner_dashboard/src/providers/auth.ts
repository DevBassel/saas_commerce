import type { AuthProvider } from "@refinedev/core";

import { authApi } from "@/api/auth.api";
import { tokenStorage, toApiError } from "@/api/client";
import { getTenantSlug, tenantMatchesSlug } from "@/api/tenant";

type JwtPayload = {
  type?: string;
  id?: number;
  role?: string;
  tenantId?: number | null;
  tenantSchema?: string | null;
  exp?: number;
};

export const decodeJwt = (token: string): JwtPayload | null => {
  try {
    const payloadPart = token.split(".")[1];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload) return false;
  if (payload.type && payload.type !== "access") return false;
  if (typeof payload.exp !== "number") return false;
  return payload.exp * 1000 > Date.now();
};

const isTenantValid = (payload: JwtPayload | null): boolean => {
  const slug = getTenantSlug();
  if (!slug) return true;
  return tenantMatchesSlug(payload?.tenantSchema, slug);
};

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const session = await authApi.loginTenant({
        email: String(email),
        password: String(password),
      });

      tokenStorage.setSession(
        session.access_token,
        session.refresh_token,
        String(email)
      );

      return {
        success: true,
        redirectTo: "/",
      };
    } catch (error) {
      const apiError = toApiError(error);
      return {
        success: false,
        error: {
          name: "LoginError",
          message: apiError.message,
        },
      };
    }
  },

  logout: async () => {
    tokenStorage.clear();
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    const token = tokenStorage.getAccessToken();
    const payload = token ? decodeJwt(token) : null;

    if (isTokenValid(token) && isTenantValid(payload)) {
      return {
        authenticated: true,
      };
    }

    tokenStorage.clear();

    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },

  getPermissions: async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) return null;
    return decodeJwt(token)?.role ?? null;
  },

  getIdentity: async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) return null;
    const payload = decodeJwt(token);
    if (!payload || typeof payload.id !== "number") return null;
    return {
      id: payload.id,
      name: tokenStorage.getEmail() ?? "",
      roles: payload.role ? [payload.role] : [],
    };
  },

  onError: async (error) => {
    const statusCode = (error as { statusCode?: number })?.statusCode;

    if (statusCode === 401) {
      return {
        logout: true,
        redirectTo: "/login",
        error,
      };
    }

    return { error };
  },
};

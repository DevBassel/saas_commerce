import type { AuthProvider } from "@refinedev/core";

import { authApi } from "@/api/auth.api";
import { refreshSession, tokenStorage, toApiError } from "@/api/client";
import {
  allowSubdomain,
  getGuardTenantSlug,
  tenantMatchesSlug,
  withTenantParam,
} from "@/api/tenant";

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
  const slug = getGuardTenantSlug();
  if (!slug) return true;
  return tenantMatchesSlug(payload?.tenantSchema, slug);
};

const withTenant = (path: string): string =>
  allowSubdomain() ? path : withTenantParam(path, getGuardTenantSlug());

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const loginEmail = String(email);

    try {
      const session = await authApi.loginTenant({
        email: loginEmail,
        password: String(password),
      });

      if (!session.verified) {
        return {
          success: true,
          redirectTo: withTenant(
            `/verify-email?email=${encodeURIComponent(loginEmail)}`
          ),
        };
      }

      tokenStorage.setSession(
        session.access_token,
        session.refresh_token,
        loginEmail
      );

      return {
        success: true,
        redirectTo: withTenant("/"),
      };
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.code === "EMAIL_NOT_VERIFIED") {
        return {
          success: true,
          redirectTo: withTenant(
            `/verify-email?email=${encodeURIComponent(loginEmail)}`
          ),
        };
      }

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
      redirectTo: withTenant("/login"),
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

    if (tokenStorage.getRefreshToken()) {
      const accessToken = await refreshSession();
      const refreshed = accessToken ? decodeJwt(accessToken) : null;

      if (refreshed && isTenantValid(refreshed)) {
        return {
          authenticated: true,
        };
      }

      // Tenant mismatch is definitive; transient refresh failure keeps tokens.
      if (refreshed && !isTenantValid(refreshed)) tokenStorage.clear();
    }

    if (!tokenStorage.getRefreshToken()) tokenStorage.clear();

    return {
      authenticated: false,
      redirectTo: withTenant("/login"),
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

    if (statusCode === 401 && !tokenStorage.getRefreshToken()) {
      return {
        logout: true,
        redirectTo: withTenant("/login"),
        error,
      };
    }

    return { error };
  },
};

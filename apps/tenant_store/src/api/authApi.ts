import { signOut } from "next-auth/react";
import { getBrowserTenantSlug, withTenantParam } from "@/lib/tenant/url";
import { apiClient } from "./apiClient";

export interface IRegister {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  success: boolean;
  msg: string;
  resendCooldownSeconds: number;
}

export async function registerRequest(
  data: IRegister,
): Promise<RegisterResponse> {
  const res = await apiClient.post<RegisterResponse>("/auth/register", data);
  return res.data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // Sign out locally even if the server call fails.
  } finally {
    await signOut({ redirect: false });
    window.location.href = withTenantParam("/login", getBrowserTenantSlug());
  }
}

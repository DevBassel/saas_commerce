import { signOut } from "next-auth/react";
import { apiClient } from "./apiClient";

export interface IRegister {
  name: string;
  email: string;
  password: string;
}

export async function registerRequest(data: IRegister) {
  const res = await apiClient.post("/auth/register", data);
  return res.data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } catch {
    // Sign out locally even if the server call fails.
  } finally {
    await signOut({ redirect: false });
    window.location.href = "/login";
  }
}

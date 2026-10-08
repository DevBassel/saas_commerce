import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Tenant-less client for platform (apex) calls.
 *
 * It deliberately does **not** reuse `apiClient`: that interceptor attaches
 * `Authorization` and `x-tenant-slug` derived from the request host, and a
 * platform request must never carry a tenant header. `POST /auth/register-store`
 * is `@Public @Platform`, so it expects no tenant claim and no bearer token.
 */
const platformClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface IRegisterStore {
  storeName: string;
  storeSlug: string;
  subdomain?: string;
  name: string;
  email: string;
  password: string;
}

export interface IStoreCredentials {
  id: number;
  access_token: string;
  refresh_token: string;
}

export async function registerStoreRequest(
  data: IRegisterStore,
): Promise<IStoreCredentials> {
  const res = await platformClient.post<IStoreCredentials>(
    "/auth/register-store",
    data,
  );
  return res.data;
}

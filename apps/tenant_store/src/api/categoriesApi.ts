import type { AxiosInstance } from "axios";

export interface IStoreCategoryOption {
  id: number;
  name: string;
}

/**
 * Public, tenant-scoped category options for the storefront filter form.
 *
 * The caller must pass a request-scoped anonymous client carrying the resolved
 * tenant header; this helper intentionally has no default client so a call can
 * never silently pick up the authenticated shared `apiClient`.
 */
export async function getStoreCategoryOptions(
  client: AxiosInstance,
): Promise<IStoreCategoryOption[]> {
  const res = await client.get<IStoreCategoryOption[]>("/store/categories");
  return res.data;
}

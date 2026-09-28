import type { AxiosInstance } from "axios";
import { apiClient } from "./apiClient";

export interface IAddress {
  id: number;
  userId: number;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  label: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateAddress {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  label?: string;
  isDefault?: boolean;
}

export async function getAddresses(
  client: AxiosInstance = apiClient,
): Promise<IAddress[]> {
  const res = await client.get<IAddress[]>("/addresses");
  return res.data;
}

export async function createAddress(
  dto: ICreateAddress,
  client: AxiosInstance = apiClient,
): Promise<IAddress> {
  const res = await client.post<IAddress>("/addresses", dto);
  return res.data;
}

export async function setDefaultAddress(
  id: number,
  client: AxiosInstance = apiClient,
): Promise<IAddress> {
  const res = await client.patch<IAddress>(`/addresses/${id}/default`);
  return res.data;
}

export type CurrencyChangeRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface CurrencyRequestTenant {
  name: string;
  slug: string;
  currency: string;
}

export interface CurrencyChangeRequest {
  id: number;
  tenantId: number;
  requestedById: number | null;
  requestedByEmail: string | null;
  currentCurrency: string;
  requestedCurrency: string;
  status: CurrencyChangeRequestStatus;
  reason: string | null;
  reviewNote: string | null;
  reviewedById: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: CurrencyRequestTenant | null;
}

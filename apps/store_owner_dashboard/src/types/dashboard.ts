export interface DashboardStats {
  totalOrders: number;
  fulfilledOrders: number;
  pendingOrders: number;
  balance: Balance | null;
  customers: number;
  storageUsedBytes: number;
  storageCapacityBytes: number;
  schemaSizeBytes: number;
  schemaCapacityBytes: number;
}

export interface Balance {
  available: Array<{
    amount: number;
    currency: string;
  }>;
  pending: Array<{
    amount: number;
    currency: string;
  }>;
}

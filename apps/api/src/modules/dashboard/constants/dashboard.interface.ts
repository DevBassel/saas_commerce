export interface DashboardStats {
  totalOrders: number;
  fulfilledOrders: number;
  pendingOrders: number;
  totalPaid: number;
  waitingAmount: number;
  customers: number;
  storageUsedBytes: number;
  storageCapacityBytes: number;
  schemaSizeBytes: number;
  schemaCapacityBytes: number;
}

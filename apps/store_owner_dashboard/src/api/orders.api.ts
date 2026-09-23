import { apiClient } from "./client";
import type { Order, OrderStatus } from "@/types/order";

export const ordersApi = {
  cancel: async (id: number): Promise<Order> => {
    const response = await apiClient.patch<Order>(`orders/${id}/cancel`);
    return response.data;
  },

  updateStatus: async (id: number, status: OrderStatus): Promise<Order> => {
    const response = await apiClient.patch<Order>(`orders/${id}/status`, {
      status,
    });
    return response.data;
  },
};

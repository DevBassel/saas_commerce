import { apiClient } from "./client";
import type {
  AssignSubscriptionPayload,
  Subscription,
  SubscriptionPlan,
  SubscriptionPlanPayload,
  SubscriptionStatus,
  TenantSubscriptionResponse,
  UsageSummary,
} from "@/types/subscription";

export const SUBSCRIPTION_PLANS_RESOURCE = "platform/subscription-plans";

export const subscriptionsApi = {
  listPlans: async (params?: {
    active?: boolean;
    isPublic?: boolean;
  }): Promise<SubscriptionPlan[]> => {
    const response = await apiClient.get<SubscriptionPlan[]>(
      SUBSCRIPTION_PLANS_RESOURCE,
      { params },
    );
    return response.data;
  },

  getPlan: async (id: number): Promise<SubscriptionPlan> => {
    const response = await apiClient.get<SubscriptionPlan>(
      `${SUBSCRIPTION_PLANS_RESOURCE}/${id}`,
    );
    return response.data;
  },

  createPlan: async (
    payload: SubscriptionPlanPayload,
  ): Promise<SubscriptionPlan> => {
    const response = await apiClient.post<SubscriptionPlan>(
      SUBSCRIPTION_PLANS_RESOURCE,
      payload,
    );
    return response.data;
  },

  updatePlan: async (
    id: number,
    payload: SubscriptionPlanPayload,
  ): Promise<SubscriptionPlan> => {
    const response = await apiClient.patch<SubscriptionPlan>(
      `${SUBSCRIPTION_PLANS_RESOURCE}/${id}`,
      payload,
    );
    return response.data;
  },

  deletePlan: async (
    id: number,
  ): Promise<{ deleted?: true; deactivated?: true }> => {
    const response = await apiClient.delete<{
      deleted?: true;
      deactivated?: true;
    }>(`${SUBSCRIPTION_PLANS_RESOURCE}/${id}`);
    return response.data;
  },

  getTenantSubscription: async (
    tenantId: number,
  ): Promise<TenantSubscriptionResponse> => {
    const response = await apiClient.get<TenantSubscriptionResponse>(
      `platform/tenants/${tenantId}/subscription`,
    );
    return response.data;
  },

  getTenantUsage: async (tenantId: number): Promise<UsageSummary> => {
    const response = await apiClient.get<UsageSummary>(
      `platform/tenants/${tenantId}/subscription/usage`,
    );
    return response.data;
  },

  assignTenantPlan: async (
    tenantId: number,
    payload: AssignSubscriptionPayload,
  ): Promise<Subscription> => {
    const response = await apiClient.put<Subscription>(
      `platform/tenants/${tenantId}/subscription`,
      payload,
    );
    return response.data;
  },

  setTenantStatus: async (
    tenantId: number,
    status: SubscriptionStatus,
  ): Promise<Subscription> => {
    const response = await apiClient.patch<Subscription>(
      `platform/tenants/${tenantId}/subscription/status`,
      { status },
    );
    return response.data;
  },
};

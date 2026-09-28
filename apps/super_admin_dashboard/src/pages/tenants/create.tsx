"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCreate } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { StoreIcon } from "lucide-react";

import { REGISTER_STORE_RESOURCE } from "@/api/tenants.api";
import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import { TenantCreateForm } from "@/components/tenants/tenant-create-form";
import {
  createStoreSchema,
  type CreateStoreFormValues,
} from "@/components/tenants/tenant-schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const TenantsCreate = () => {
  const navigate = useNavigate();

  const { mutate: createStore, mutation } = useCreate({
    resource: REGISTER_STORE_RESOURCE,
    mutationOptions: {
      onSuccess: () => {
        navigate("/tenants");
      },
    },
  });

  const isPending = mutation.isPending;

  const form = useForm<CreateStoreFormValues>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      storeName: "",
      storeSlug: "",
      subdomain: "",
    },
  });

  const handleSubmit = (values: CreateStoreFormValues) => {
    const payload = {
      name: values.name,
      email: values.email,
      password: values.password,
      storeName: values.storeName,
      storeSlug: values.storeSlug,
      ...(values.subdomain ? { subdomain: values.subdomain } : {}),
    };

    createStore({
      values: payload,
      successNotification: {
        message: `Store "${values.storeName}" created`,
        type: "success",
      },
    });
  };

  return (
    <CreateView>
      <CreateViewHeader />
      <Card className={cn("max-w-2xl")}>
        <CardHeader>
          <CardTitle className={cn("flex", "items-center", "gap-2")}>
            <StoreIcon className="h-5 w-5" />
            New Tenant
          </CardTitle>
          <CardDescription>
            Creates the tenant schema and the store owner user
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <TenantCreateForm
            form={form}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/tenants")}
            isSubmitting={isPending}
          />
        </CardContent>
      </Card>
    </CreateView>
  );
};

TenantsCreate.displayName = "TenantsCreate";

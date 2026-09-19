"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetIdentity,
  useInvalidate,
  useNotification,
} from "@refinedev/core";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { authApi } from "@/api/auth.api";
import { toApiError } from "@/api/client";
import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import { UserCreateForm } from "@/components/users/user-create-form";
import {
  userCreateSchema,
  type UserCreateValues,
} from "@/components/users/user-schema";
import { canCreateUsers } from "@/constants/users";
import { cn } from "@/lib/utils";
import type { ActorIdentity } from "@/types/user";

export const UsersCreate = () => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const canCreate = canCreateUsers(identity?.roles?.[0] ?? null);

  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { open } = useNotification();

  const form = useForm<UserCreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const handleSubmit = async (values: UserCreateValues) => {
    try {
      await authApi.registerTenantUser(values);
      await invalidate({ resource: "users", invalidates: ["list"] });
      open?.({
        type: "success",
        message: "User created",
        description: `${values.name} was added as a customer.`,
      });
      navigate("/users");
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to create user",
        description: toApiError(error).message,
      });
    }
  };

  return (
    <CreateView>
      <CreateViewHeader />
      {canCreate ? (
        <UserCreateForm
          form={form}
          onSubmit={handleSubmit}
          isSubmitting={form.formState.isSubmitting}
        />
      ) : (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          You do not have permission to create users.
        </p>
      )}
    </CreateView>
  );
};

UsersCreate.displayName = "UsersCreate";

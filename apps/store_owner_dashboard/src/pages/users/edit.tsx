"use client";

import type { HttpError } from "@refinedev/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";

import {
  EditView,
  EditViewHeader,
} from "@/components/refine-ui/views/edit-view";
import { UserForm } from "@/components/users/user-form";
import {
  userSchema,
  type UserFormValues,
} from "@/components/users/user-schema";
import { UserPermissionsCard } from "@/components/users/user-permissions-card";
import { UserRoleCard } from "@/components/users/user-role-card";
import { QueryErrorState } from "@/components/refine-ui/views/query-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { User } from "@/types/user";

export const UsersEdit = () => {
  const form = useForm<User, HttpError, UserFormValues>({
    resolver: zodResolver(userSchema),
    refineCoreProps: {
      resource: "users",
      action: "edit",
      redirect: false,
      meta: { detailPath: "users/profile" },
    },
  });

  const query = form.refineCore.query;
  const record = query?.data?.data;

  return (
    <EditView>
      <EditViewHeader />

      {query?.isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton
                key={`skeleton-field-${index}`}
                className="h-10 w-full"
              />
            ))}
          </CardContent>
        </Card>
      ) : query?.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} />
      ) : record?.id ? (
        <div className="flex flex-col gap-10 justify-between">
          <div className="flex [&>form]:grow md:flex-row flex-col justify-between gap-3 ">
            <UserForm
              form={form}
              onSubmit={form.refineCore.onFinish}
              isSubmitting={form.refineCore.formLoading}
              submitLabel="Save changes"
              email={record?.email}
            />
            <UserRoleCard user={record} />
          </div>
          <div className={"w-full"}>
            <UserPermissionsCard user={record} />
          </div>
        </div>
      ) : null}
    </EditView>
  );
};

UsersEdit.displayName = "UsersEdit";

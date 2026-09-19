"use client";

import { useMemo, useState } from "react";
import {
  useCustom,
  useCustomMutation,
  useGetIdentity,
  useInvalidate,
  useList,
  useNotification,
} from "@refinedev/core";
import {
  Eye,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { toApiError } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  canManageTarget,
  isBypassRole,
  permissionAction,
  permissionKeys,
  type PermissionAction,
} from "@/constants/users";
import type { Permission } from "@/types/permission";
import type { ActorIdentity, User, UserProfile } from "@/types/user";

const prefixOf = (key: string): string => key.split(":")[0] || key;

const PERMISSION_ICONS: Record<PermissionAction, LucideIcon> = {
  create: Plus,
  read: Eye,
  update: Pencil,
  delete: Trash2,
  other: KeyRound,
};

const groupPermissions = (
  permissions: Permission[],
): Array<{ prefix: string; items: Permission[] }> => {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const prefix = prefixOf(permission.key);
    const bucket = groups.get(prefix);
    if (bucket) bucket.push(permission);
    else groups.set(prefix, [permission]);
  }
  return [...groups.entries()].map(([prefix, items]) => ({ prefix, items }));
};

export const UserPermissionsCard = ({ user }: { user: User }) => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const actorRoleKey = identity?.roles?.[0] ?? null;
  const manageable = canManageTarget(actorRoleKey, user.role?.key);

  const { query: profileQuery } = useCustom<UserProfile>({
    url: "users/profile",
    method: "get",
  });
  const profile = profileQuery.data?.data;
  const actorKeys = useMemo(
    () => new Set(permissionKeys(profile?.permissions)),
    [profile],
  );

  const { query: permissionsQuery } = useList<Permission>({
    resource: "permissions",
    pagination: { mode: "off" },
    sorters: [{ field: "key", order: "asc" }],
  });
  const groups = useMemo(
    () => groupPermissions(permissionsQuery.data?.data ?? []),
    [permissionsQuery.data],
  );

  const directIds = useMemo(
    () => new Set((user.permissions ?? []).map((permission) => permission.id)),
    [user.permissions],
  );
  const inheritedIds = useMemo(
    () =>
      new Set(
        (user.role?.permissions ?? []).map((permission) => permission.id),
      ),
    [user.role],
  );

  const [busyId, setBusyId] = useState<number | "all" | null>(null);
  const { mutateAsync, mutation } = useCustomMutation();
  const invalidate = useInvalidate();
  const { open } = useNotification();

  const isSubmitting = mutation.isPending;
  const isGrantable = (permission: Permission) =>
    isBypassRole(actorRoleKey) || actorKeys.has(permission.key);

  const refresh = () =>
    invalidate({
      resource: "users",
      id: user.id,
      invalidates: ["detail", "list"],
    });

  const handleToggle = async (permission: Permission, next: boolean) => {
    if (!manageable) return;
    try {
      if (next) {
        if (!isGrantable(permission)) return;
        setBusyId(permission.id);
        await mutateAsync({
          url: `users/${user.id}/permissions`,
          method: "post",
          values: { permissionIds: [permission.id] },
        });
      } else {
        if (!directIds.has(permission.id)) return;
        setBusyId(permission.id);
        await mutateAsync({
          url: `users/${user.id}/permissions`,
          method: "delete",
          values: { permissionIds: [permission.id] },
        });
      }
      refresh();
      open?.({
        type: "success",
        message: next ? "Permission granted" : "Permission revoked",
      });
    } catch (error) {
      open?.({
        type: "error",
        message: "Permission update failed",
        description: toApiError(error).message,
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (!manageable || directIds.size === 0) return;
    setBusyId("all");
    try {
      await mutateAsync({
        url: `users/${user.id}/permissions`,
        method: "delete",
        values: {},
      });
      refresh();
      open?.({ type: "success", message: "All direct permissions revoked" });
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to revoke permissions",
        description: toApiError(error).message,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        className={cn("flex", "flex-row", "items-center", "justify-between")}
      >
        <CardTitle>Direct permissions</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!manageable || directIds.size === 0 || isSubmitting}
          onClick={handleRevokeAll}
        >
          {busyId === "all" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Revoke all
        </Button>
      </CardHeader>
      <CardContent className={cn("flex", "flex-col", "gap-6")}>
        {!manageable ? (
          <p className={cn("text-sm", "text-muted-foreground")}>
            You cannot manage permissions for a user with an equal or higher
            rank.
          </p>
        ) : null}

        {permissionsQuery.isLoading ? (
          <p className={cn("text-sm", "text-muted-foreground")}>
            Loading permissions...
          </p>
        ) : groups.length === 0 ? (
          <p className={cn("text-sm", "text-muted-foreground")}>
            No permissions available.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.prefix} className={cn("flex", "flex-col", "gap-2")}>
              <h3 className={cn("text-md", "text-primary", "font-bold")}>
                {group.prefix}
              </h3>
              <div className={"grid grid-cols-2  gap-2"}>
                {group.items.map((permission) => {
                  const isDirect = directIds.has(permission.id);
                  const isInherited =
                    !isDirect && inheritedIds.has(permission.id);
                  const checked = isDirect || isInherited;
                  const canGrant = isGrantable(permission);
                  const disabled =
                    !manageable ||
                    isInherited ||
                    (!checked && !canGrant) ||
                    busyId === permission.id ||
                    isSubmitting;
                  const ActionIcon =
                    PERMISSION_ICONS[permissionAction(permission.key)];

                  return (
                    <div
                      key={permission.id}
                      className={cn(
                        "flex",
                        "items-center",
                        "justify-between",
                        "gap-4",
                        "rounded-md",
                        "border",
                        "px-3",
                        "py-2",
                      )}
                    >
                      <div className={cn("flex", "items-center", "gap-3")}>
                        <ActionIcon
                          aria-hidden="true"
                          className={cn(
                            "h-4",
                            "w-4",
                            "shrink-0",
                            "text-muted-foreground",
                          )}
                        />
                        <div className={cn("flex", "flex-col")}>
                          <span className="text-sm font-medium">
                            {permission.name}
                          </span>
                          <span
                            className={cn("text-xs", "text-muted-foreground")}
                          >
                            {permission.key}
                          </span>
                        </div>
                      </div>
                      <div className={cn("flex", "items-center", "gap-2")}>
                        {isInherited ? (
                          <Badge variant="secondary">From role</Badge>
                        ) : null}
                        {isDirect ? (
                          <Badge variant="outline">Direct</Badge>
                        ) : null}
                        {busyId === permission.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        <Switch
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(value) =>
                            handleToggle(permission, value)
                          }
                          aria-label={permission.key}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

UserPermissionsCard.displayName = "UserPermissionsCard";

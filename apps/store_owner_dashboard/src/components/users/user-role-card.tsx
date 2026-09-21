"use client";

import { useState } from "react";
import {
  useCustomMutation,
  useGetIdentity,
  useInvalidate,
  useList,
  useNotification,
} from "@refinedev/core";
import { Loader2 } from "lucide-react";

import { toApiError } from "@/api/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { canManageTarget, filterAssignableRoles } from "@/constants/users";
import type { Role } from "@/types/role";
import type { ActorIdentity, User } from "@/types/user";

export const UserRoleCard = ({ user }: { user: User }) => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const actorRoleKey = identity?.roles?.[0] ?? null;
  const isSelf = identity?.id != null && identity.id === user.id;

  const manageable = canManageTarget(actorRoleKey, user.role?.key);
  const canChangeRole = manageable && !isSelf;

  const { query: rolesQuery } = useList<Role>({
    resource: "roles",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
  });
  const roles = filterAssignableRoles(rolesQuery.data?.data ?? [], actorRoleKey);

  const incomingRoleId = user.roleId != null ? String(user.roleId) : undefined;
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(
    incomingRoleId,
  );
  const [syncedRoleId, setSyncedRoleId] = useState(incomingRoleId);

  if (syncedRoleId !== incomingRoleId) {
    setSyncedRoleId(incomingRoleId);
    setSelectedRoleId(incomingRoleId);
  }

  const { mutateAsync, mutation } = useCustomMutation();
  const invalidate = useInvalidate();
  const { open } = useNotification();

  const isSubmitting = mutation.isPending;
  const hasRole = user.roleId != null;
  const canSave =
    canChangeRole &&
    selectedRoleId != null &&
    selectedRoleId !== incomingRoleId;

  const refresh = () =>
    invalidate({ resource: "users", id: user.id, invalidates: ["detail", "list"] });

  const handleAssign = async () => {
    if (!canSave || selectedRoleId == null) return;
    try {
      await mutateAsync({
        url: `users/${user.id}/role`,
        method: "patch",
        values: { roleId: Number(selectedRoleId) },
      });
      refresh();
      open?.({ type: "success", message: "Role updated" });
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to update role",
        description: toApiError(error).message,
      });
    }
  };

  const handleRemove = async () => {
    if (!canChangeRole || !hasRole) return;
    try {
      await mutateAsync({
        url: `users/${user.id}/role`,
        method: "delete",
        values: {},
      });
      refresh();
      open?.({ type: "success", message: "Role removed" });
    } catch (error) {
      open?.({
        type: "error",
        message: "Failed to remove role",
        description: toApiError(error).message,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role</CardTitle>
      </CardHeader>
      <CardContent className={cn("flex", "flex-col", "gap-4")}>
        {!canChangeRole ? (
          <p className={cn("text-sm", "text-muted-foreground")}>
            {isSelf
              ? "You cannot change your own role."
              : "You cannot change the role of a user with an equal or higher rank."}
          </p>
        ) : null}

        <Select
          value={selectedRoleId}
          onValueChange={setSelectedRoleId}
          disabled={!canChangeRole || rolesQuery.isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={String(role.id)}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className={cn("flex", "justify-end", "gap-2")}>
          <Button
            type="button"
            variant="outline"
            disabled={!canChangeRole || !hasRole || isSubmitting}
            onClick={handleRemove}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Remove role
          </Button>
          <Button
            type="button"
            disabled={!canSave || isSubmitting}
            onClick={handleAssign}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save role
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

UserRoleCard.displayName = "UserRoleCard";

"use client";

import { Badge } from "@/components/ui/badge";

export const ActiveBadge = ({ active }: { active: boolean }) =>
  active ? (
    <Badge variant="secondary">Active</Badge>
  ) : (
    <Badge variant="outline">Inactive</Badge>
  );

ActiveBadge.displayName = "ActiveBadge";

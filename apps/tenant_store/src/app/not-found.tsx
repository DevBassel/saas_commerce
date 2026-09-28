"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Store } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Store className="size-6" />
          </span>
          <CardTitle className="text-xl">Store not found</CardTitle>
          <CardDescription>
            This address isn&apos;t linked to a store. Open the store using its
            subdomain, for example{" "}
            <span className="font-medium text-foreground">
              {typeof window !== "undefined" ? window.location.hostname : ""}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          If you reached this page from a bookmark, update it to include the
          store subdomain.
        </CardContent>
      </Card>
    </div>
  );
}

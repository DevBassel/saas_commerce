import { headers } from "next/headers";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { classifyHost, getAppRootDomain } from "@/lib/tenant/host";
import { withTenantParam } from "@/lib/tenant/url";
import { Store } from "lucide-react";

export default async function NotFound() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const classification = classifyHost(host);
  // In `?tenant=` mode the apex host is a tenant context, so trust the header
  // the proxy set (an unknown storefront slug is still a tenant 404) and fall
  // back to the host classification.
  const slug =
    requestHeaders.get("x-tenant-slug") ??
    (classification.kind === "tenant" ? classification.slug : null);

  const root = getAppRootDomain();
  const scheme = process.env.NEXTAUTH_URL?.startsWith("https") ? "https" : "http";
  const platformUrl = `${scheme}://${root}`;

  if (classification.kind === "invalid") {
    return (
      <Shell
        title="This address isn't linked to a store"
        description={
          <>
            <span className="font-medium text-foreground">{host ?? "This host"}</span>{" "}
            is not a store on this platform.
          </>
        }
        action={{ href: platformUrl, label: "Go to the platform" }}
      />
    );
  }

  if (!slug) {
    return (
      <Shell
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={{ href: "/", label: "Back to home" }}
      />
    );
  }

  return (
    <Shell
      title="Page not found"
      description="This page isn't available in this store. Check the address or head back to the store home."
      action={{ href: withTenantParam("/", slug), label: "Back to the store" }}
    />
  );
}

function Shell({
  title,
  description,
  action,
}: {
  title: string;
  description: React.ReactNode;
  action: { href: string; label: string };
}) {
  const external = /^https?:\/\//.test(action.href);
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-10">
      <Card className="mx-auto w-full max-w-md text-center">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Store className="size-6" />
          </span>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {external ? (
            <a href={action.href} className={cn(buttonVariants(), "w-full")}>
              {action.label}
            </a>
          ) : (
            <Link href={action.href} className={cn(buttonVariants(), "w-full")}>
              {action.label}
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

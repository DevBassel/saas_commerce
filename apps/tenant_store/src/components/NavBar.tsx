"use client";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  House,
  LogIn,
  LogOut,
  Menu,
  Package,
  ShoppingCartIcon,
  Store,
  UserPlus,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";
import { logout } from "@/api/authApi";

type NavItem = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  path: string;
};

const guestItems: NavItem[] = [
  { icon: Store, label: "Products", path: "/products" },
  { icon: LogIn, label: "Login", path: "/login" },
  { icon: UserPlus, label: "Register", path: "/register" },
];

const userItems: NavItem[] = [
  { icon: House, label: "Home", path: "/" },
  { icon: Store, label: "Products", path: "/products" },
  { icon: Package, label: "Orders", path: "/orders" },
];

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const [open, setOpen] = useState(false);

  const navItems = user ? userItems : guestItems;

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname?.startsWith(path);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <Link href={user ? "/" : "/login"} className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Shop</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.path}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(item.path) && "bg-accent text-accent-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <Link
              href="/cart"
              aria-label="Cart"
              className={cn(
                "relative flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive("/cart") && "bg-accent text-accent-foreground",
              )}
            >
              <ShoppingCartIcon className="size-5" />
            </Link>
          )}

          {user ? (
            <div className="hidden items-center gap-3 md:flex">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => logout()}
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          ) : (
            <Button
              className="hidden md:inline-flex"
              onClick={() => router.push("/login")}
            >
              Sign in
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-6">
            {navItems.map((item) => (
              <Button
                key={item.label}
                variant="ghost"
                onClick={() => {
                  router.push(item.path);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm",
                  isActive(item.path) && "bg-accent text-accent-foreground",
                )}
              >
                <item.icon className="size-5 text-muted-foreground" />
                {item.label}
              </Button>
            ))}
            {user && (
              <Button
                variant="ghost"
                className="flex w-full items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive hover:text-destructive"
                onClick={async () => {
                  setOpen(false);
                  await logout();
                }}
              >
                <LogOut className="size-5" />
                Logout
              </Button>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

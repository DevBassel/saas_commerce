"use client";

import React from "react";
import {
  useMenu,
  useLink,
  useRefineOptions,
  type TreeMenuItem,
} from "@refinedev/core";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent as ShadcnSidebarContent,
  SidebarGroup as ShadcnSidebarGroup,
  SidebarGroupContent as ShadcnSidebarGroupContent,
  SidebarGroupLabel as ShadcnSidebarGroupLabel,
  SidebarHeader as ShadcnSidebarHeader,
  SidebarMenu as ShadcnSidebarMenu,
  SidebarMenuButton as ShadcnSidebarMenuButton,
  SidebarMenuItem as ShadcnSidebarMenuItem,
  SidebarMenuSub as ShadcnSidebarMenuSub,
  SidebarMenuSubButton as ShadcnSidebarMenuSubButton,
  SidebarMenuSubItem as ShadcnSidebarMenuSubItem,
  SidebarRail as ShadcnSidebarRail,
  SidebarTrigger as ShadcnSidebarTrigger,
} from "@/components/ui/sidebar";
import { useSidebar as useShadcnSidebar } from "@/hooks/use-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, ListIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const { menuItems, selectedKey } = useMenu();

  return (
    <ShadcnSidebar className={cn("border-none")}>
      <ShadcnSidebarRail />
      <SidebarHeader />
      <ShadcnSidebarContent
        className={cn("gap-2", "pt-2", "pb-2", "border-r", "border-border")}
      >
        {menuItems.map((item: TreeMenuItem) =>
          item.meta?.group ? (
            <SidebarItemGroup
              key={item.key || item.name}
              item={item}
              selectedKey={selectedKey}
            />
          ) : (
            <ShadcnSidebarMenu key={item.key || item.name}>
              <SidebarItem item={item} selectedKey={selectedKey} />
            </ShadcnSidebarMenu>
          ),
        )}
      </ShadcnSidebarContent>
    </ShadcnSidebar>
  );
}

type MenuItemProps = {
  item: TreeMenuItem;
  selectedKey?: string;
};

function SidebarItem({ item, selectedKey }: MenuItemProps) {
  const { open } = useShadcnSidebar();
  const Link = useLink();
  const hasChildren = !!item.children && item.children.length > 0;

  if (hasChildren) {
    return open ? (
      <SidebarItemCollapsible item={item} selectedKey={selectedKey} />
    ) : (
      <SidebarItemDropdown item={item} selectedKey={selectedKey} />
    );
  }

  return (
    <ShadcnSidebarMenuItem>
      <ShadcnSidebarMenuButton
        asChild
        isActive={item.key === selectedKey}
        tooltip={getDisplayName(item)}
      >
        <Link to={item.route || ""}>
          <ItemIcon icon={item.meta?.icon ?? item.icon} />
          <span>{getDisplayName(item)}</span>
        </Link>
      </ShadcnSidebarMenuButton>
    </ShadcnSidebarMenuItem>
  );
}

function SidebarItemGroup({ item, selectedKey }: MenuItemProps) {
  const { children } = item;

  return (
    <ShadcnSidebarGroup className={cn("p-1.5")}>
      <ShadcnSidebarGroupLabel>{getDisplayName(item)}</ShadcnSidebarGroupLabel>
      <ShadcnSidebarGroupContent>
        <ShadcnSidebarMenu>
          {children?.map((child: TreeMenuItem) => (
            <SidebarItem
              key={child.key || child.name}
              item={child}
              selectedKey={selectedKey}
            />
          ))}
        </ShadcnSidebarMenu>
      </ShadcnSidebarGroupContent>
    </ShadcnSidebarGroup>
  );
}

function SidebarItemCollapsible({ item, selectedKey }: MenuItemProps) {
  const { children } = item;
  const Link = useLink();

  return (
    <Collapsible defaultOpen className={cn("group/collapsible")}>
      <ShadcnSidebarMenuItem>
        <CollapsibleTrigger asChild>
          <ShadcnSidebarMenuButton tooltip={getDisplayName(item)}>
            <ItemIcon icon={item.meta?.icon ?? item.icon} />
            <span>{getDisplayName(item)}</span>
            <ChevronRight
              className={cn(
                "ml-auto",
                "transition-transform",
                "duration-200",
                "group-data-[state=open]/collapsible:rotate-90",
              )}
            />
          </ShadcnSidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ShadcnSidebarMenuSub>
            {children?.map((child: TreeMenuItem) => (
              <ShadcnSidebarMenuSubItem key={child.key || child.name}>
                <ShadcnSidebarMenuSubButton
                  asChild
                  isActive={child.key === selectedKey}
                >
                  <Link to={child.route || ""}>
                    <ItemIcon icon={child.meta?.icon ?? child.icon} />
                    <span>{getDisplayName(child)}</span>
                  </Link>
                </ShadcnSidebarMenuSubButton>
              </ShadcnSidebarMenuSubItem>
            ))}
          </ShadcnSidebarMenuSub>
        </CollapsibleContent>
      </ShadcnSidebarMenuItem>
    </Collapsible>
  );
}

function SidebarItemDropdown({ item, selectedKey }: MenuItemProps) {
  const { children } = item;
  const Link = useLink();

  return (
    <ShadcnSidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ShadcnSidebarMenuButton tooltip={getDisplayName(item)}>
            <ItemIcon icon={item.meta?.icon ?? item.icon} />
            <span>{getDisplayName(item)}</span>
            <ChevronRight className={cn("ml-auto")} />
          </ShadcnSidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {children?.map((child: TreeMenuItem) => (
            <DropdownMenuItem key={child.key || child.name} asChild>
              <Link
                to={child.route || ""}
                className={cn("flex w-full items-center gap-2", {
                  "bg-accent text-accent-foreground": child.key === selectedKey,
                })}
              >
                <ItemIcon icon={child.meta?.icon ?? child.icon} />
                <span>{getDisplayName(child)}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </ShadcnSidebarMenuItem>
  );
}

function SidebarHeader() {
  const { title } = useRefineOptions();
  const { open, isMobile } = useShadcnSidebar();

  return (
    <ShadcnSidebarHeader
      className={cn(
        "p-0",
        "h-16",
        "border-b",
        "border-border",
        "flex-row",
        "items-center",
        "justify-between",
        "overflow-hidden",
      )}
    >
      <div
        className={cn(
          "whitespace-nowrap",
          "flex",
          "flex-row",
          "h-full",
          "items-center",
          "justify-start",
          "gap-2",
          "transition-discrete",
          "duration-200",
          {
            "pl-3": !open,
            "pl-5": open,
          },
        )}
      >
        <div>{title.icon}</div>
        <h2
          className={cn(
            "text-sm",
            "font-bold",
            "transition-opacity",
            "duration-200",
            {
              "opacity-0": !open,
              "opacity-100": open,
            },
          )}
        >
          {title.text}
        </h2>
      </div>

      <ShadcnSidebarTrigger
        className={cn("text-muted-foreground", "mr-1.5", {
          "opacity-0": !open,
          "opacity-100": open || isMobile,
          "pointer-events-auto": open || isMobile,
          "pointer-events-none": !open && !isMobile,
        })}
      />
    </ShadcnSidebarHeader>
  );
}

function ItemIcon({ icon }: { icon?: React.ReactNode }) {
  return <>{icon ?? <ListIcon />}</>;
}

function getDisplayName(item: TreeMenuItem) {
  return item.meta?.label ?? item.label ?? item.name;
}

"use client";

import { Badge } from "@/components/ui/badge";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Bell,
  Building2,
  CalendarCheck2,
  CheckSquare,
  ChevronDown,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  Target,
  User2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "./auth/auth-provider";
import { isAdmin } from "@/lib/helper";

interface SearchFormData {
  query: string;
}

export type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  isActive?: boolean;
  visible?: boolean;
};

export type MenuSection = {
  label: string;
  items: MenuItem[];
  visible?: boolean;
};

export type SidebarUser = {
  name: string;
  email: string;
  avatar?: string;
};

export type AppSidebarProps = {
  /** Menu sections to display in the sidebar */
  // menuSections?: MenuSection[];
  /** Current user information */
  user?: SidebarUser;
  /** Logo component or text */
  logo?: React.ReactNode;
  /** Logo text to display */
  logoText?: string;
  /** Enable search functionality */
  enableSearch?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Additional header content */
  headerContent?: React.ReactNode;
  /** Additional footer content */
  footerContent?: React.ReactNode;
  /** Sidebar variant */
  variant?: "sidebar" | "floating" | "inset";
  /** Sidebar side */
  side?: "left" | "right";
  /** Collapsible state */
  collapsible?: "offcanvas" | "icon" | "none";
};

const defaultUser: SidebarUser = {
  name: "John Doe",
  email: "john@hexavara.com",
};

export function AppSidebar({
  // menuSections = defaultMenuSections,
  user,
  logo,
  logoText = "Hexavara",
  enableSearch = true,
  searchPlaceholder = "Search CRM...",
  headerContent,
  footerContent,
  variant = "sidebar",
  side = "left",
  collapsible = "offcanvas",
}: AppSidebarProps) {
  const { user: authUser, logout } = useAuth();
  const pathname = usePathname();
  const sidebarUser: SidebarUser = user || {
    name: authUser?.name || defaultUser.name,
    email: authUser?.email || defaultUser.email,
  };

  const menuSections: MenuSection[] = [
    {
      label: "Main",
      visible: true,
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
          visible: isAdmin(),
        },
        { title: "Leads", url: "/leads", icon: Target, visible: true },
        { title: "Deals", url: "/deals", icon: DollarSign, visible: true },
        {
          title: "Organization",
          url: "/organizations",
          icon: Building2,
          visible: true,
        },
      ],
    },
    {
      label: "Activities",
      visible: true,
      items: [
        {
          title: "Visit Schedule",
          url: "/viewings",
          icon: CalendarCheck2,
          visible: true,
        },
        { title: "Notes", url: "/notes", icon: FileText, visible: true },
        { title: "Tasks", url: "/tasks", icon: CheckSquare, visible: true },
      ],
    },
    {
      label: "Settings",
      visible: isAdmin(),
      items: [
        { title: "Team", url: "/team", icon: UserPlus, visible: isAdmin() },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          visible: isAdmin(),
        },
      ],
    },
  ];

  const { register, handleSubmit } = useForm<SearchFormData>({
    defaultValues: {
      query: "",
    },
  });

  //TODO: Implement search functionality
  const handleSearchSubmit = (data: SearchFormData) => {
    console.log("Searching for:", data.query);
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <Sidebar variant={variant} side={side} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex items-center gap-2">
                  {logo || (
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Building2 className="size-4" />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">{logoText}</span>
                    <span className="text-xs text-muted-foreground">CRM</span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {headerContent}

        {enableSearch && (
          <form onSubmit={handleSubmit(handleSearchSubmit)}>
            <SidebarGroup className="py-0">
              <SidebarGroupContent className="relative">
                <label htmlFor="search" className="sr-only">
                  {searchPlaceholder}
                </label>
                <SidebarInput
                  id="search"
                  placeholder={searchPlaceholder}
                  className="pl-8"
                  {...register("query")}
                />
                <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
              </SidebarGroupContent>
            </SidebarGroup>
          </form>
        )}
      </SidebarHeader>

      <SidebarContent>
        {menuSections.map(
          (section) =>
            section.visible && (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map(
                      (item) =>
                        item.visible && (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={
                                item.url === "/"
                                  ? pathname === "/"
                                  : pathname.startsWith(item.url)
                              }>
                              <Link href={item.url}>
                                <item.icon />
                                <span>{item.title}</span>
                                {item.badge !== undefined && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-auto shrink-0"
                                  >
                                    {item.badge}
                                  </Badge>
                                )}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ),
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ),
        )}
      </SidebarContent>

      <SidebarFooter>
        {footerContent || (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <User2 className="size-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none text-left">
                      <span className="font-semibold">{sidebarUser.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {sidebarUser.email}
                      </span>
                    </div>
                    <ChevronDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User2 className="size-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="size-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notifications" className="cursor-pointer">
                      <Bell className="size-4" />
                      Notifications
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Bell,
  Building,
  Building2,
  CalendarCheck2,
  Barcode,
  ChartColumn,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileClock,
  FileText,
  LogOut,
  MapPinned,
  Search,
  Settings,
  Target,
  TextAlignStart,
  User2,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { Collapsible } from "radix-ui";
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
  /** Submenu items. When set, the item toggles instead of navigating. */
  children?: Omit<MenuItem, "children">[];
};

export type MenuSection = {
  label?: string;
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


const NAV_BUTTON_CLASS =
  "h-[31px] whitespace-nowrap rounded-md pl-5 pr-3 text-sm font-medium text-[#4f4f4f] hover:bg-[#e9e8ec] hover:text-[#4f4f4f] data-[active=true]:!bg-[#1980c0] data-[active=true]:!text-white [&>svg]:size-4";

const NAV_SUB_BUTTON_CLASS =
  "h-[31px] whitespace-nowrap rounded-md pl-[44px] pr-3 text-sm font-medium text-[#4f4f4f] hover:bg-[#e9e8ec] hover:text-[#4f4f4f] data-[active=true]:!bg-[#1980c0] data-[active=true]:!text-white [&>svg]:size-4";

function isPathActive(pathname: string, url: string) {
  return url === "/" ? pathname === "/" : pathname.startsWith(url);
}

function NavParentItem({
  item,
  pathname,
}: {
  item: MenuItem;
  pathname: string;
}) {
  const children = item.children ?? [];
  const hasActiveChild = children.some((child) =>
    isPathActive(pathname, child.url),
  );
  const [open, setOpen] = React.useState(hasActiveChild);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <Collapsible.Trigger asChild>
          <SidebarMenuButton className={NAV_BUTTON_CLASS}>
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight
              className={`ml-auto transition-transform ${open ? "rotate-90" : ""}`}
            />
          </SidebarMenuButton>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <SidebarMenuSub className="mx-0 mt-1 border-l-0 px-0 py-0">
            {children.map((child) => (
              <SidebarMenuSubItem key={child.title}>
                <SidebarMenuSubButton
                  asChild
                  className={NAV_SUB_BUTTON_CLASS}
                  isActive={isPathActive(pathname, child.url)}
                >
                  <Link href={child.url}>
                    <child.icon />
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </Collapsible.Content>
      </SidebarMenuItem>
    </Collapsible.Root>
  );
}

/** Single source of truth for the sidebar menu and the page breadcrumb. */
export function buildMenuSections(admin: boolean): MenuSection[] {
  return [
    {
      visible: true,
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: ChartColumn,
          visible: admin,
        },
        {
          title: "Product Management",
          url: "/projects",
          icon: CreditCard,
          visible: true,
          children: [
            { title: "Projects", url: "/projects", icon: TextAlignStart },
            { title: "Types", url: "/types", icon: Barcode },
            {
              title: "Specifications & Media",
              url: "/specifications",
              icon: ClipboardList,
            },
            { title: "Siteplans", url: "/siteplans", icon: MapPinned },
          ],
        },
        {
          title: "Availability & Reservation",
          url: "/availability",
          icon: Building,
          visible: true,
          children: [
            { title: "Availability", url: "/availability", icon: Building },
            {
              title: "Reservations",
              url: "/reservations",
              icon: CalendarCheck2,
            },
          ],
        },
        {
          title: "Pricing Management",
          url: "/pricing",
          icon: FileClock,
          visible: true,
          children: [
            { title: "Pricing", url: "/pricing", icon: DollarSign },
          ],
        },
      ],
    },
    {
      label: "CRM",
      visible: true,
      items: [
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
      visible: admin,
      items: [
        { title: "Team", url: "/team", icon: UserPlus, visible: admin },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          visible: admin,
        },
      ],
    },
  ];
}

export function SidebarOpenTrigger() {
  const { state, isMobile } = useSidebar();
  if (!isMobile && state === "expanded") return null;
  return <SidebarTrigger className="-ml-1" />;
}

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

  const menuSections = buildMenuSections(isAdmin());

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
          <SidebarMenuItem className="flex items-center gap-1">
            <SidebarMenuButton size="lg" asChild className="min-w-0 flex-1">
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
            <SidebarTrigger className="size-7 shrink-0 border border-[#E4E4E7] bg-white" />
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
              <SidebarGroup key={section.label ?? "primary"}>
                {section.label && (
                  <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-[11px]">
                    {section.items.map(
                      (item) =>
                        item.visible &&
                        (item.children ? (
                          <NavParentItem
                            key={item.title}
                            item={item}
                            pathname={pathname}
                          />
                        ) : (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              asChild
                              className={NAV_BUTTON_CLASS}
                              isActive={isPathActive(pathname, item.url)}
                            >
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
                        )),
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

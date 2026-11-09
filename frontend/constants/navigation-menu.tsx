import { MenuSection } from "@/components/Sidebar";

import {
  Building2,
  CalendarCheck2,
  CheckSquare,
  DollarSign,
  FileText,
  LayoutDashboard,
  Settings,
  Target,
  UserPlus,
} from "lucide-react";

export const navigationMenus: MenuSection[] = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, isActive: true },
      { title: "Project", url: "/projects", icon: Building2 },
      { title: "Leads", url: "/leads", icon: Target },
      { title: "Deals", url: "/deals", icon: DollarSign },
      // { title: "Contacts", url: "/contacts", icon: Users },
      { title: "Organization", url: "/organizations", icon: Building2 },
    ],
  },
  {
    label: "Activities",
    items: [
      { title: "Visit Schedule", url: "/viewings", icon: CalendarCheck2 },
      { title: "Notes", url: "/notes", icon: FileText },
      { title: "Tasks", url: "/tasks", icon: CheckSquare },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Team", url: "/team", icon: UserPlus },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

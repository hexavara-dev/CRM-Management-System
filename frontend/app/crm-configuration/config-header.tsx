"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { getBreadcrumbTrail } from "@/components/PageHeading";
import { PageHeader } from "@/components/PageHeader";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Judul halaman CRM Configuration: breadcrumb, kotak ikon, judul, dan deskripsi. */
export function ConfigHeader({
  icon: Icon,
  description,
  actions,
}: {
  icon: LucideIcon;
  description: string;
  /** Tombol di kanan judul, mis. Preview dan Simpan. */
  actions?: React.ReactNode;
}) {
  const trail = getBreadcrumbTrail(usePathname());
  const title = trail[trail.length - 1] ?? "";
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#E5F1FA] text-[#1980C0] sm:size-14">
            <Icon className="size-6 sm:size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="type-h3 text-[#1f1f1f]">{title}</h1>
            <p className="text-sm text-[#475467]">{description}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Navbar breadcrumb untuk halaman CRM Configuration agar sejajar dengan navbar global. */
export function ConfigNavbar() {
  const trail = getBreadcrumbTrail(usePathname());
  return <PageHeader title={trail[trail.length - 1] ?? ""} breadcrumbs={trail} />;
}

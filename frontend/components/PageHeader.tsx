"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  breadcrumbs?: string[];
  actions?: ReactNode;
};

export function PageHeader({ title, breadcrumbs = [], actions }: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0">
          {breadcrumbs.length > 0 ? (
            <Breadcrumb>
              <BreadcrumbList className="gap-1 text-xs text-[#667085] sm:gap-1.5">
                {breadcrumbs.map((crumb, index) => (
                  <span className="contents" key={`${crumb}-${index}`}>
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage className="font-medium text-[#101828]">{crumb}</BreadcrumbPage>
                      ) : crumb}
                    </BreadcrumbItem>
                    {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          ) : (
            <h1 className="truncate text-lg font-semibold text-[#101828]">{title}</h1>
          )}
        </div>
        {actions}
      </div>
    </header>
  );
}

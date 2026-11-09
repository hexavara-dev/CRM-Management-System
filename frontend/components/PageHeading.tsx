"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { buildMenuSections } from "@/components/Sidebar";

const matches = (pathname: string, url: string) =>
  url === "/" ? pathname === "/" : pathname === url || pathname.startsWith(`${url}/`);

/** Resolves ["Parent", "Page"] (or ["Page"]) for a pathname from the sidebar menu. */
export function getBreadcrumbTrail(pathname: string): string[] {
  let best: { trail: string[]; length: number } | null = null;
  const consider = (trail: string[], url: string) => {
    if (matches(pathname, url) && (!best || url.length > best.length)) {
      best = { trail, length: url.length };
    }
  };

  for (const section of buildMenuSections(true)) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          consider([item.title, child.title], child.url);
        }
      } else {
        consider([item.title], item.url);
      }
    }
  }
  return (best as { trail: string[] } | null)?.trail ?? [];
}

type PageHeadingProps = {
  /** Overrides the title taken from the menu (e.g. a record name on a detail page). */
  title?: string;
  /** Right-aligned content, such as an "Add" button. */
  actions?: React.ReactNode;
};

export function PageHeading({ title, actions }: PageHeadingProps) {
  const pathname = usePathname();
  const trail = getBreadcrumbTrail(pathname);
  const pageTitle = title ?? trail[trail.length - 1] ?? "";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="type-h3 text-[#1f1f1f]">{pageTitle}</h1>
        {trail.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList className="gap-1 text-xs text-[#6b6b6b] sm:gap-1">
              {trail.map((crumb, index) => {
                const isLast = index === trail.length - 1;
                return (
                  <React.Fragment key={crumb}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-xs font-medium text-[#1f1f1f]">
                          {crumb}
                        </BreadcrumbPage>
                      ) : (
                        <span>{crumb}</span>
                      )}
                    </BreadcrumbItem>
                    {!isLast && (
                      <BreadcrumbSeparator className="[&>svg]:size-3" />
                    )}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      {actions}
    </div>
  );
}

import { PackageOpen } from "lucide-react";
import type { ReactNode } from "react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type AvailabilityEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function AvailabilityEmptyState({
  title,
  description,
  icon,
  action,
  compact = false,
  className,
}: AvailabilityEmptyStateProps) {
  return (
    <Empty
      className={cn(
        "border border-[#dfe4ea] bg-[#fbfdff]",
        compact ? "min-h-40" : "min-h-64",
        className,
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="size-11 rounded-full bg-[#eef7ff] text-[#1684ff]"
        >
          {icon ?? <PackageOpen className="size-5" />}
        </EmptyMedia>
        <EmptyTitle className="text-[#101828]">{title}</EmptyTitle>
        <EmptyDescription className="max-w-md text-xs leading-5 text-[#667085]">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

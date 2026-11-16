import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function NoImagePlaceholder({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label="No image"
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-[#F4F4F5] text-[#71717A]",
        className,
      )}
    >
      <ImageOff className={compact ? "size-5" : "size-8"} strokeWidth={1.5} />
      <span className={compact ? "text-[10px]" : "text-xs"}>No image</span>
    </div>
  );
}

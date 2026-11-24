"use client";

import { LabelBadge } from "@/app/crm-configuration/leads-label/label-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LabelText } from "@/components/ui/label-text";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { LeadLabel } from "@/hooks/use-lead-labels";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Controller, get, useFormContext } from "react-hook-form";

export function LeadLabelMultiSelect({
  name = "labelIds",
  label = "Prospek",
  className,
  labels,
  isLoading = false,
}: {
  name?: string;
  label?: string;
  className?: string;
  labels: LeadLabel[];
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const error = get(errors, name);

  const visibleLabels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword
      ? labels.filter((label) =>
          `${label.name} ${label.description ?? ""}`
            .toLowerCase()
            .includes(keyword),
        )
      : labels;
  }, [labels, search]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const selectedIds = Array.isArray(field.value) ? field.value : [];
        const selectedLabels = selectedIds
          .map((id: string) => labels.find((label) => label.id === id))
          .filter((label): label is LeadLabel => Boolean(label));

        const toggle = (label: LeadLabel) => {
          if (selectedIds.includes(label.id)) {
            field.onChange(selectedIds.filter((id: string) => id !== label.id));
            return;
          }
          const withoutPreviousTemperature =
            label.type === "TEMPERATURE"
              ? selectedIds.filter(
                  (id: string) =>
                    labels.find((item) => item.id === id)?.type !==
                    "TEMPERATURE",
                )
              : selectedIds;
          field.onChange([...withoutPreviousTemperature, label.id]);
        };

        return (
          <div className={cn("col-span-2 space-y-1.5", className)}>
            <LabelText>{label}</LabelText>
            <Popover
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <button
                  ref={triggerRef}
                  type="button"
                  disabled={isLoading || labels.length === 0}
                  className={cn(
                    "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50",
                    error && "border-destructive",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {selectedLabels.length > 0 ? (
                      selectedLabels.map((label) => (
                        <LabelBadge
                          key={label.id}
                          name={label.name}
                          color={label.color}
                          icon={label.icon}
                        />
                      ))
                    ) : (
                      <span className="text-muted-foreground">
                        {isLoading
                          ? "Memuat label..."
                          : "Pilih satu atau beberapa label"}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                portalContainer={triggerRef.current?.closest<HTMLElement>(
                  "[data-slot='dialog-content']",
                )}
                className="z-[999] w-[var(--radix-popover-trigger-width)] p-2"
              >
                <Input
                  autoFocus
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari label..."
                />
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {visibleLabels.length > 0 ? (
                    visibleLabels.map((label) => (
                      <div
                        key={label.id}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedIds.includes(label.id)}
                          onCheckedChange={() => toggle(label)}
                        />
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => toggle(label)}
                        >
                          <LabelBadge
                            name={label.name}
                            color={label.color}
                            icon={label.icon}
                          />
                          <span className="ml-auto text-[10px] font-medium text-muted-foreground">
                            {label.type === "TEMPERATURE"
                              ? "Temperature"
                              : "Tag"}
                          </span>
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      Label tidak ditemukan.
                    </p>
                  )}
                </div>
                <p className="border-t pt-2 text-xs text-muted-foreground">
                  Maksimal satu Temperature; Tag dapat dipilih lebih dari satu.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        );
      }}
    />
  );
}

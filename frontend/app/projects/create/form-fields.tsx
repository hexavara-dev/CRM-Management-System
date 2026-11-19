"use client";

import { useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FIELD_LABEL } from "./form-styles";

export const REQUIRED = <span className="text-[#D64545]">*</span>;

export function Field({
  label,
  required,
  action,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className={cn(FIELD_LABEL, "mb-0")}>
          {label} {required && REQUIRED}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

type SelectOption = string | { value: string; label: string };

export function SelectField({
  name,
  placeholder,
  options,
  required,
  initialValue = "",
}: {
  name: string;
  placeholder: string;
  options: SelectOption[];
  required?: boolean;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Select
      name={name}
      value={value}
      onValueChange={setValue}
      required={required}
    >
      <SelectTrigger className="h-9 w-full text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          return (
            <SelectItem key={item.value} value={item.value} className="text-xs">
              {item.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

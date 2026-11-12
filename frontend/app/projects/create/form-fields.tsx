"use client";

import { useState} from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FIELD_LABEL } from "./form-styles";

export const REQUIRED = <span className="text-[#D64545]">*</span>;

export function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className={FIELD_LABEL}>
        {label} {required && REQUIRED}
      </label>
      {children}
    </div>
  );
}

export function SelectField({ name, placeholder, options, required }: { name: string; placeholder: string; options: string[]; required?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <Select name={name} value={value} onValueChange={setValue} required={required}>
      <SelectTrigger className="h-9 w-full text-xs">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-xs">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

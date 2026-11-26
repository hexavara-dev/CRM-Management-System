"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function rupiahDigits(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/^0+(?=\d)/, "");
}

export function formatRupiahInput(value: string | number | null | undefined) {
  return rupiahDigits(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type RupiahInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "inputMode"> & {
  value: string | number | null | undefined;
  onValueChange: (digits: string) => void;
  inputClassName?: string;
  /** Pengganti awalan "Rp" berbingkai, misalnya ikon diikuti teks "Rp". */
  leading?: React.ReactNode;
};

export const RupiahInput = React.forwardRef<HTMLInputElement, RupiahInputProps>(
  ({ value, onValueChange, className, inputClassName, leading, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const display = formatRupiahInput(value);

    return (
      <div className={cn("flex h-9 w-full items-center overflow-hidden rounded-md border border-input bg-background text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring", className)}>
        {leading ? (
          <span aria-hidden="true" className="flex h-full shrink-0 items-center gap-2 pl-3">{leading}</span>
        ) : (
          <span aria-hidden="true" className="flex h-full shrink-0 items-center border-r border-input px-3 text-muted-foreground">Rp</span>
        )}
        <input
          {...props}
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={display}
          onChange={(event) => {
            const before = event.currentTarget.value.slice(0, event.currentTarget.selectionStart ?? 0);
            const digitsBeforeCaret = before.replace(/\D/g, "").length;
            const next = rupiahDigits(event.currentTarget.value);
            onValueChange(next);
            requestAnimationFrame(() => {
              const element = inputRef.current;
              if (!element) return;
              let position = 0;
              let seen = 0;
              while (position < element.value.length && seen < digitsBeforeCaret) {
                if (/\d/.test(element.value[position])) seen++;
                position++;
              }
              element.setSelectionRange(position, position);
            });
          }}
          className={cn("h-full min-w-0 flex-1 bg-transparent outline-none", leading ? "pr-3 pl-1" : "px-3", "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", inputClassName)}
        />
      </div>
    );
  },
);
RupiahInput.displayName = "RupiahInput";

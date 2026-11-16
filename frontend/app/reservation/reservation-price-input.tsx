"use client";

import { Controller, useFormContext } from "react-hook-form";
import { ErrorText } from "@/components/ui/error-text";
import { LabelText } from "@/components/ui/label-text";

const formatPriceInput = (value: string) =>
  value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function ReservationPriceInput() {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name="price"
      render={({ field, fieldState }) => (
        <div className="w-full space-y-2">
          <LabelText htmlFor="reservation-price">Harga unit</LabelText>
          <div
            className={`flex h-9 w-full items-center rounded-md border bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring ${
              fieldState.error ? "border-destructive" : "border-input"
            }`}
          >
            <span className="border-r px-3 text-sm text-muted-foreground">
              Rp
            </span>
            <input
              {...field}
              id="reservation-price"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Harga unit"
              value={formatPriceInput(String(field.value ?? ""))}
              onChange={(event) => {
                field.onChange(event.target.value.replace(/\D/g, ""));
              }}
              aria-invalid={!!fieldState.error}
              className="h-full min-w-0 flex-1 rounded-r-md bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {fieldState.error && (
            <ErrorText>{fieldState.error.message}</ErrorText>
          )}
        </div>
      )}
    />
  );
}

"use client";

import { Controller, useFormContext } from "react-hook-form";
import { ErrorText } from "@/components/ui/error-text";
import { LabelText } from "@/components/ui/label-text";
import { RupiahInput } from "@/components/ui/rupiah-input";

export function ReservationPriceInput() {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name="price"
      render={({ field, fieldState }) => (
        <div className="w-full space-y-2">
          <LabelText htmlFor="reservation-price">Harga unit</LabelText>
          <RupiahInput
            id="reservation-price"
            name={field.name}
            ref={field.ref}
            onBlur={field.onBlur}
            placeholder="Harga unit"
            value={field.value}
            onValueChange={field.onChange}
            aria-invalid={!!fieldState.error}
            className={fieldState.error ? "border-destructive" : undefined}
          />
          {fieldState.error && (
            <ErrorText>{fieldState.error.message}</ErrorText>
          )}
        </div>
      )}
    />
  );
}

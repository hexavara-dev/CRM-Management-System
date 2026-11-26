"use client";

import * as React from "react";

import { ErrorText } from "@/components/ui/error-text";
import { HelperText } from "@/components/ui/helper-text";
import { LabelText } from "@/components/ui/label-text";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/lib/utils";
import {
  Controller,
  RegisterOptions,
  get,
  useFormContext,
} from "react-hook-form";

type InputProps = {
  label?: string;
  name: string;
  labelClassname?: string;
  validation?: RegisterOptions;
  helperText?: string;
  currency?: boolean;
} & React.ComponentProps<"input">;

const FormInput = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      validation,
      name,
      labelClassname,
      type,
      label,
      helperText,
      currency,
      ...props
    },
    ref,
  ) => {
    const {
      control,
      formState: { errors },
    } = useFormContext();

    const error = get(errors, name);

    return (
      <Controller
        control={control}
        name={name}
        rules={validation}
        render={({ field }) => (
          <div className="w-full">
            {label && (
              <LabelText className={labelClassname}>
                {label}
                {props.required && <span className="ml-1 text-destructive">*</span>}
              </LabelText>
            )}
            {currency ? <RupiahInput
              {...props}
              name={field.name}
              value={field.value}
              onValueChange={(digits) => field.onChange(digits === "" ? "" : Number(digits))}
              onBlur={field.onBlur}
              ref={ref ?? field.ref}
              aria-invalid={!!error}
              className={cn(className, error && "border-destructive")}
            /> : <input
              type={type}
              {...field}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 shadow-sm transition-colors file:border-0 file:bg-background file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm",
                className,
                error && "border-destructive",
              )}
              ref={ref}
              {...props}
            />}

            {helperText && !error && <HelperText>{helperText}</HelperText>}
            {error && <ErrorText>{error.message?.toString()}</ErrorText>}
          </div>
        )}
      />
    );
  },
);
FormInput.displayName = "FormInput";

export { FormInput };

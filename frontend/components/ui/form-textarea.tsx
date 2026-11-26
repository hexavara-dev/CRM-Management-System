"use client";

import * as React from "react";

import { ErrorText } from "@/components/ui/error-text";
import { HelperText } from "@/components/ui/helper-text";
import { LabelText } from "@/components/ui/label-text";
import { cn } from "@/lib/utils";
import {
  Controller,
  RegisterOptions,
  get,
  useFormContext,
} from "react-hook-form";

type TextareaProps = {
  label?: string;
  name: string;
  labelClassname?: string;
  validation?: RegisterOptions;
  helperText?: string;
} & React.ComponentProps<"textarea">;

const FormTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      validation,
      name,
      labelClassname,
      label,
      helperText,
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
            <textarea
              {...field}
              className={cn(
                "flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-sm",
                className,
                error && "border-destructive",
              )}
              ref={ref}
              {...props}
            />

            {helperText && !error && <HelperText>{helperText}</HelperText>}
            {error && <ErrorText>{error.message?.toString()}</ErrorText>}
          </div>
        )}
      />
    );
  },
);
FormTextarea.displayName = "FormTextarea";

export { FormTextarea };

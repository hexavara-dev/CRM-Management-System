import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Controller,
  RegisterOptions,
  get,
  useFormContext,
} from "react-hook-form";
import { LabelText } from "./label-text";
import { Input } from "./input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

export type SelectOptions = {
  label: string;
  value: string;
};

type InputSelectProps = {
  options: SelectOptions[];
  name: string;
  isLoading?: boolean;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  labelClassname?: string;
  validation?: RegisterOptions;
  searchable?: boolean;
  filterOptionsBySearch?: boolean;
  portalInsideDialog?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
} & React.HTMLAttributes<HTMLSelectElement>;

export default function FormSelect({
  label,
  name,
  labelClassname,
  className,
  disabled,
  isLoading,
  placeholder,
  validation,
  options,
  searchable = false,
  filterOptionsBySearch = false,
  portalInsideDialog = false,
  searchValue,
  searchPlaceholder = "Search...",
  onSearchChange,
}: InputSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentSearch = searchValue ?? internalSearch;
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
      render={({ field }) => {
        const selectedOption = options.find(
          (option) => option.value === field.value,
        );
        const visibleOptions = filterOptionsBySearch
          ? options.filter((option) =>
              option.label.toLowerCase().includes(currentSearch.trim().toLowerCase()),
            )
          : options;

        return (
          <div>
            {label && <LabelText className={labelClassname}>{label}</LabelText>}
            {searchable ? (
              <Popover
                open={isOpen}
                onOpenChange={(nextOpen) => {
                  setIsOpen(nextOpen);
                  if (!nextOpen && filterOptionsBySearch) setInternalSearch("");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    ref={triggerRef}
                    type="button"
                    disabled={disabled || isLoading}
                    className={cn(
                      "flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50",
                      !selectedOption && "text-muted-foreground",
                      error && "border-destructive",
                      className,
                    )}
                  >
                    <span className="truncate">
                      {selectedOption?.label || placeholder || "Select an option"}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  portalContainer={
                    portalInsideDialog
                      ? triggerRef.current?.closest<HTMLElement>("[data-slot='dialog-content']")
                      : undefined
                  }
                  className="z-[999] w-[var(--radix-popover-trigger-width)] p-2"
                >
                  <Input
                    autoFocus
                    value={currentSearch}
                    placeholder={searchPlaceholder}
                    onChange={(event) => {
                      if (onSearchChange) onSearchChange(event.target.value);
                      else setInternalSearch(event.target.value);
                    }}
                  />
                  <div className="max-h-56 overflow-y-auto overscroll-contain">
                    {isLoading ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        Searching...
                      </div>
                    ) : visibleOptions.length > 0 ? (
                      visibleOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            field.onChange(option.value);
                            setIsOpen(false);
                            if (filterOptionsBySearch) setInternalSearch("");
                          }}
                        >
                          {option.label}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        No matching options
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Select
                disabled={disabled || isLoading}
                onValueChange={field.onChange}
                value={field.value}
              >
                <SelectTrigger
                  className={cn(className, error && "border-destructive")}
                >
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="z-[999]">
                  {options.length > 0 ? (
                    options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No options available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      }}
    />
  );
}

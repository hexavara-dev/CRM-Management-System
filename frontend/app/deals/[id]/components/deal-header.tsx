"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Deal } from "@/lib/data";
import { formatRupiah } from "@/lib/helper";
// import { cn } from "@/lib/utils";
import { DealFormData, dealFormSchema } from "@/schemas/deal.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

interface DealHeaderProps {
  deal: Deal;
  onEdit: (data: DealFormData) => Promise<void>;
}

export function DealHeader({ deal, onEdit }: DealHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealFormSchema),
    defaultValues: {
      dealType: "",
      expectedAmount: deal.value || 0,
      currency: "IDR",
      expectedClosingDate: deal.expectedCloseDate
        ? new Date(deal.expectedCloseDate).toISOString().split("T")[0]
        : "",
      stageId: "",
      statusId: "",
      assignedUserId: "",
      lostReason: "",
      lostNotes: "",
    },
  });

  const onSubmit = async (data: DealFormData) => {
    await onEdit(data);
    setIsOpen(false);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-2 md:px-4 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 md:mr-2 h-4" />
      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
          >
            <ArrowLeft />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="text-sm md:text-base font-semibold leading-none mb-1 truncate">
              {deal.name}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {deal.leadName || "No linked lead"} • {formatRupiah(deal.value)}
            </p>
          </div>
          {/* 
          <Badge
            variant="outline"
            className={cn(
              "rounded-full px-2 md:px-2.5 py-0.5 text-xs shrink-0 hidden sm:flex",
              statusColors[statusName] || statusColors.new,
            )}
          >
            {statusName.charAt(0).toUpperCase() + statusName.slice(1)}
          </Badge> */}
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="hidden md:flex">
                Edit Deal
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden size-8"
              >
                <Edit className="size-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="min-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Deal</DialogTitle>
                <DialogDescription>
                  Update the deal details below.
                </DialogDescription>
              </DialogHeader>
              <FormProvider {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="grid grid-cols-2 gap-4"
                  noValidate
                >
                  <FormInput
                    name="dealType"
                    label="Deal Type"
                    placeholder="e.g. Service, Product"
                  />
                  <FormInput
                    name="expectedAmount"
                    label="Value (IDR)"
                    currency
                    min={0}
                  />
                  <div className="col-span-2">
                    <FormInput
                      name="expectedClosingDate"
                      label="Expected Closing Date"
                      type="date"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </DialogFooter>
                </form>
              </FormProvider>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}

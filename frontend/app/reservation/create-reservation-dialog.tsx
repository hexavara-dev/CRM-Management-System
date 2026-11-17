"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorText } from "@/components/ui/error-text";
import { FormInput } from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { LabelText } from "@/components/ui/label-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, useProjects } from "@/hooks/use-projects";
import {
  reservationErrorMessage,
  useAvailableReservationUnits,
  useCreateReservation,
} from "@/hooks/use-reservations";
import { useUsers } from "@/hooks/use-users";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { ReservationPriceInput } from "./reservation-price-input";

const reservationSchema = z.object({
  unitId: z.string().min(1, "Pilih unit yang tersedia."),
  salesId: z.string().min(1, "Pilih sales."),
  customerName: z.string().trim().min(1, "Nama pemesan wajib diisi.").max(150),
  customerEmail: z.union([
    z.literal(""),
    z.string().trim().email("Format email tidak valid.").max(255),
  ]),
  customerPhone: z.string().max(30, "Nomor telepon maksimal 30 karakter."),
  price: z
    .string()
    .regex(/^\d+$/, "Harga wajib berupa angka bulat.")
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      "Harga terlalu besar.",
    ),
  status: z.enum(["ACTIVE", "PAYMENT_PENDING"]),
  notes: z.string().max(10000, "Catatan maksimal 10.000 karakter."),
});

type ReservationFormData = z.infer<typeof reservationSchema>;

const initialValues: ReservationFormData = {
  unitId: "",
  salesId: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  price: "",
  status: "ACTIVE",
  notes: "",
};

export type ReservationUnitSelection = {
  projectId: string;
  projectName: string;
  unitId: string;
  unitLabel: string;
  price: number;
};

export function CreateReservationDialog({
  open,
  onOpenChange,
  onCreated,
  initialSelection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  initialSelection?: ReservationUnitSelection;
}) {
  const { user } = useAuth();
  const projectsQuery = useProjects({ page: 1, limit: 100, isActive: true });
  const { users, isLoading: usersLoading } = useUsers();
  const [projectId, setProjectId] = useState(initialSelection?.projectId ?? "");
  const unitsQuery = useAvailableReservationUnits(projectId || undefined);
  const createReservation = useCreateReservation();
  const form = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: initialSelection
      ? {
          ...initialValues,
          unitId: initialSelection.unitId,
          price: String(initialSelection.price),
        }
      : initialValues,
  });
  const salesOptions = users
    .filter((sales) => sales.id !== user?.id)
    .map((sales) => ({
      value: sales.id,
      label: `${sales.name || sales.email} · ${sales.email}`,
    }));
  const resetForm = form.reset;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm(initialValues);
      setProjectId("");
    }
    onOpenChange(nextOpen);
  };

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    form.setValue("unitId", "", { shouldDirty: true });
    form.setValue("price", "", { shouldDirty: true });
    form.clearErrors(["unitId", "price"]);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await createReservation.mutateAsync({
        unitId: values.unitId,
        salesId: values.salesId,
        customerName: values.customerName,
        ...(values.customerEmail
          ? { customerEmail: values.customerEmail }
          : {}),
        ...(values.customerPhone
          ? { customerPhone: values.customerPhone }
          : {}),
        price: Number(values.price),
        status: values.status,
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
      });
      handleOpenChange(false);
      onCreated();
    } catch {
      // The mutation displays an actionable server message.
    }
  });

  const projectError = projectsQuery.isError
    ? errorMessage(projectsQuery.error, "Gagal memuat proyek.")
    : undefined;
  const unitError = unitsQuery.isError
    ? errorMessage(unitsQuery.error, "Gagal memuat unit tersedia.")
    : undefined;
  const mutationError = createReservation.isError
    ? reservationErrorMessage(createReservation.error)
    : undefined;
  const selectedUnitAvailable =
    !initialSelection ||
    unitsQuery.data?.some((unit) => unit.id === initialSelection.unitId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-visible sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Buat Reservasi</DialogTitle>
          <DialogDescription>
            {initialSelection
              ? "Lengkapi detail pemesan untuk unit yang dipilih."
              : "Pilih unit tersedia dan isi detail pemesan."}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <LabelText htmlFor="reservation-project">Project</LabelText>
                {initialSelection ? (
                  <Input
                    id="reservation-project"
                    value={initialSelection.projectName}
                    readOnly
                    className="h-9 bg-muted/40"
                  />
                ) : (
                  <Select
                    value={projectId}
                    onValueChange={handleProjectChange}
                    disabled={projectsQuery.isLoading || !!projectError}
                  >
                    <SelectTrigger id="reservation-project" className="w-full">
                      <SelectValue
                        placeholder={
                          projectsQuery.isLoading
                            ? "Memuat proyek..."
                            : "Pilih project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(projectsQuery.data?.data ?? []).map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!initialSelection && projectError && (
                  <ErrorText>{projectError}</ErrorText>
                )}
                {!initialSelection &&
                  !projectsQuery.isLoading &&
                  !projectError &&
                  (projectsQuery.data?.data.length ?? 0) === 0 && (
                    <ErrorText>Belum ada project aktif.</ErrorText>
                  )}
              </div>

              {initialSelection ? (
                <div className="space-y-2">
                  <LabelText htmlFor="reservation-unit">
                    Unit tersedia
                  </LabelText>
                  <Input
                    id="reservation-unit"
                    value={initialSelection.unitLabel}
                    readOnly
                    className="h-9 bg-muted/40"
                  />
                  {!unitsQuery.isLoading &&
                    !unitError &&
                    !selectedUnitAvailable && (
                      <ErrorText>
                        Unit ini sudah tidak tersedia untuk reservasi.
                      </ErrorText>
                    )}
                  {unitError && <ErrorText>{unitError}</ErrorText>}
                </div>
              ) : (
                <Controller
                  control={form.control}
                  name="unitId"
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <LabelText htmlFor="reservation-unit">
                        Unit tersedia
                      </LabelText>
                      <Select
                        value={field.value}
                        onValueChange={(unitId) => {
                          field.onChange(unitId);
                          form.clearErrors("unitId");
                          void form.trigger("unitId");
                          const unit = unitsQuery.data?.find(
                            (item) => item.id === unitId,
                          );
                          if (unit) {
                            form.setValue(
                              "price",
                              String(unit.variant.currentPrice),
                              {
                                shouldValidate: true,
                              },
                            );
                          }
                        }}
                        disabled={
                          !projectId || unitsQuery.isLoading || !!unitError
                        }
                      >
                        <SelectTrigger
                          id="reservation-unit"
                          className="w-full"
                          aria-invalid={!!fieldState.error}
                        >
                          <SelectValue
                            placeholder={
                              !projectId
                                ? "Pilih project dahulu"
                                : unitsQuery.isLoading
                                  ? "Memuat unit..."
                                  : "Pilih unit"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(unitsQuery.data ?? []).map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.code} · {unit.category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && (
                        <ErrorText>{fieldState.error.message}</ErrorText>
                      )}
                      {unitError && <ErrorText>{unitError}</ErrorText>}
                      {projectId &&
                        !unitsQuery.isLoading &&
                        !unitError &&
                        (unitsQuery.data?.length ?? 0) === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Tidak ada unit tersedia di project ini.
                          </p>
                        )}
                    </div>
                  )}
                />
              )}

              <FormInput
                name="customerName"
                label="Nama pemesan"
                placeholder="Nama lengkap"
                autoComplete="name"
              />
              <FormInput
                name="customerEmail"
                label="Email pemesan"
                type="email"
                placeholder="nama@email.com"
                autoComplete="email"
              />
              <FormInput
                name="customerPhone"
                label="Nomor telepon"
                type="tel"
                placeholder="08xxxxxxxxxx"
                autoComplete="tel"
              />

              <div className="space-y-2">
                <FormSelect
                  name="salesId"
                  label="Sales"
                  labelClassname="mb-2 block"
                  options={salesOptions}
                  placeholder="Cari dan pilih sales"
                  searchable
                  filterOptionsBySearch
                  portalInsideDialog
                  searchPlaceholder="Cari nama atau email..."
                  isLoading={usersLoading}
                  disabled={!usersLoading && salesOptions.length === 0}
                  className="w-full"
                />
                {form.formState.errors.salesId?.message && (
                  <ErrorText>{form.formState.errors.salesId.message}</ErrorText>
                )}
                {!usersLoading && salesOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Belum ada sales lain yang bisa dipilih.
                  </p>
                )}
              </div>

              <ReservationPriceInput />

              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <div className="space-y-2">
                    <LabelText htmlFor="reservation-status">Status</LabelText>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="reservation-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Aktif</SelectItem>
                        <SelectItem value="PAYMENT_PENDING">
                          Menunggu pembayaran
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              <div className="sm:col-span-2">
                <Controller
                  control={form.control}
                  name="notes"
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <LabelText htmlFor="reservation-notes">
                        Catatan (opsional)
                      </LabelText>
                      <Textarea
                        id="reservation-notes"
                        rows={3}
                        placeholder="Catatan tambahan"
                        {...field}
                      />
                      {fieldState.error && (
                        <ErrorText>{fieldState.error.message}</ErrorText>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            {mutationError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2"
              >
                <ErrorText>{mutationError}</ErrorText>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createReservation.isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={
                  createReservation.isPending ||
                  !projectId ||
                  unitsQuery.isLoading ||
                  unitsQuery.isError ||
                  !selectedUnitAvailable
                }
              >
                {createReservation.isPending
                  ? "Menyimpan..."
                  : "Simpan Reservasi"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
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
import { LabelText } from "@/components/ui/label-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  AvailableReservationUnit,
  Reservation,
  ReservationStatusCode,
} from "@/components/reservation/reservation-types";
import {
  reservationErrorMessage,
  useAvailableReservationUnits,
  useReservationDetail,
  useUpdateReservation,
} from "@/hooks/use-reservations";
import { errorMessage, useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import { ReservationPriceInput } from "./reservation-price-input";

const schema = z.object({
  projectId: z.string().min(1, "Pilih project."),
  unitId: z.string().min(1, "Pilih unit yang tersedia."),
  customerName: z.string().trim().min(1, "Nama pemesan wajib diisi.").max(150),
  customerEmail: z.union([
    z.literal(""),
    z.string().trim().email("Format email tidak valid.").max(255),
  ]),
  customerPhone: z.string().max(30),
  salesId: z.string().min(1, "Pilih sales."),
  price: z
    .string()
    .regex(/^\d+$/, "Harga wajib berupa angka bulat.")
    .refine(
      (value) => Number.isSafeInteger(Number(value)),
      "Harga terlalu besar.",
    ),
  status: z.enum([
    "ACTIVE",
    "PAYMENT_PENDING",
    "EXPIRED",
    "CANCELLED",
    "COMPLETED",
  ]),
  notes: z.string().max(10000),
});
type FormData = z.infer<typeof schema>;

const statusLabels: Record<ReservationStatusCode, string> = {
  ACTIVE: "Aktif",
  PAYMENT_PENDING: "Menunggu Pembayaran",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
};
const statuses = Object.keys(statusLabels) as ReservationStatusCode[];
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

function Field({
  label,
  value,
}: { label: string; value: string | number | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

function Details({ reservation }: { reservation: Reservation }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Field label="Nomor reservasi" value={reservation.refCode} />
      <Field label="Unit" value={reservation.unit} />
      <Field label="Project" value={reservation.project} />
      <Field
        label="Cluster / Blok"
        value={`${reservation.cluster} / ${reservation.block}`}
      />
      <Field label="Pemesan" value={reservation.customer} />
      <Field label="Email" value={reservation.customerEmail} />
      <Field label="Telepon" value={reservation.customerPhone} />
      <Field label="Sales" value={reservation.sales.name} />
      <Field
        label="Tanggal reservasi"
        value={date(reservation.reservationDate)}
      />
      <Field label="Kedaluwarsa" value={date(reservation.expiresAt)} />
      <Field label="Harga unit" value={rupiah.format(reservation.price)} />
      <Field label="Status" value={reservation.status} />
      <div className="sm:col-span-2">
        <Field label="Catatan" value={reservation.notes} />
      </div>
    </dl>
  );
}

export function ReservationDetailDialog({
  id,
  mode,
  onClose,
  onModeChange,
}: {
  id: string | null;
  mode: "detail" | "edit";
  onClose: () => void;
  onModeChange: (mode: "detail" | "edit") => void;
}) {
  const detail = useReservationDetail(id);
  const { users, isLoading: usersLoading } = useUsers();
  const projectsQuery = useProjects({ page: 1, limit: 100, isActive: true });
  const update = useUpdateReservation();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      projectId: "",
      unitId: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      salesId: "",
      price: "",
      status: "ACTIVE",
      notes: "",
    },
  });
  const projectId = useWatch({ control: form.control, name: "projectId" });
  const unitsQuery = useAvailableReservationUnits(projectId || undefined);
  const reservation = detail.data;
  const canChangeUnit =
    reservation?.statusCode === "ACTIVE" ||
    reservation?.statusCode === "PAYMENT_PENDING";
  const reset = form.reset;
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    if (!reservation || !id) return;
    if (mode === "edit" && isDirty) return;
    reset({
      projectId: reservation.projectId,
      unitId: reservation.unitId,
      customerName: reservation.customer,
      customerEmail: reservation.customerEmail ?? "",
      customerPhone: reservation.customerPhone ?? "",
      salesId: reservation.sales.id,
      price: String(reservation.price),
      status: reservation.statusCode,
      notes: reservation.notes ?? "",
    });
  }, [id, mode, isDirty, reservation, reset]);

  const salesOptions = users.map((sales) => ({
    value: sales.id,
    label: `${sales.name || sales.email} · ${sales.email}`,
  }));
  if (
    reservation &&
    !salesOptions.some((sales) => sales.value === reservation.sales.id)
  ) {
    salesOptions.unshift({
      value: reservation.sales.id,
      label: reservation.sales.name,
    });
  }

  const projectOptions = projectsQuery.data?.data ?? [];
  const hasCurrentProject = projectOptions.some(
    (project) => project.id === reservation?.projectId,
  );
  const unitOptions: AvailableReservationUnit[] = [...(unitsQuery.data ?? [])];
  if (
    reservation &&
    projectId === reservation.projectId &&
    !unitOptions.some((unit) => unit.id === reservation.unitId)
  ) {
    unitOptions.unshift({
      id: reservation.unitId,
      code: reservation.unit,
      status: "RESERVED",
      variant: { id: "", name: "", currentPrice: reservation.price },
      category: {
        id: reservation.blockId,
        name: reservation.block,
        type: "BLOCK",
      },
    });
  }

  const handleProjectChange = (
    projectId: string,
    onChange: (value: string) => void,
  ) => {
    onChange(projectId);
    form.setValue("unitId", "", { shouldDirty: true });
    form.setValue("price", "", { shouldDirty: true });
    form.clearErrors(["projectId", "unitId", "price"]);
    void form.trigger("projectId");
  };

  const submit = form.handleSubmit(async (values) => {
    if (!id) return;
    try {
      await update.mutateAsync({
        id,
        payload: {
          unitId: values.unitId,
          customerName: values.customerName.trim(),
          customerEmail: values.customerEmail.trim() || null,
          customerPhone: values.customerPhone.trim() || null,
          salesId: values.salesId,
          price: Number(values.price),
          status: values.status,
          notes: values.notes.trim() || null,
        },
      });
      onModeChange("detail");
    } catch {
      // Mutation error is shown below and in a toast.
    }
  });

  return (
    <Dialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="overflow-visible sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Ubah Reservasi" : "Detail Reservasi"}
          </DialogTitle>
          <DialogDescription>
            {reservation?.refCode ?? "Memuat data reservasi..."}
          </DialogDescription>
        </DialogHeader>
        {detail.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Memuat detail reservasi...
          </p>
        ) : detail.isError ? (
          <div role="alert">
            <ErrorText>{reservationErrorMessage(detail.error)}</ErrorText>
            <Button
              type="button"
              variant="outline"
              onClick={() => detail.refetch()}
            >
              Coba lagi
            </Button>
          </div>
        ) : !reservation ? (
          <p className="py-8 text-center text-sm">Reservasi tidak ditemukan.</p>
        ) : mode === "detail" ? (
          <>
            <Details reservation={reservation} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Tutup
              </Button>
              <Button type="button" onClick={() => onModeChange("edit")}>
                Ubah Reservasi
              </Button>
            </DialogFooter>
          </>
        ) : (
          <FormProvider {...form}>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <LabelText htmlFor="edit-reservation-project">
                    Project
                  </LabelText>
                  <Controller
                    control={form.control}
                    name="projectId"
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={(value) =>
                            handleProjectChange(value, field.onChange)
                          }
                          disabled={!canChangeUnit || projectsQuery.isLoading}
                        >
                          <SelectTrigger
                            id="edit-reservation-project"
                            className="w-full"
                            aria-invalid={!!fieldState.error}
                          >
                            <SelectValue placeholder="Pilih project" />
                          </SelectTrigger>
                          <SelectContent>
                            {!hasCurrentProject && (
                              <SelectItem value={reservation.projectId}>
                                {reservation.project}
                              </SelectItem>
                            )}
                            {projectOptions.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && (
                          <ErrorText>{fieldState.error.message}</ErrorText>
                        )}
                      </>
                    )}
                  />
                  {projectsQuery.isError && (
                    <ErrorText>
                      {errorMessage(projectsQuery.error, "Gagal memuat project.")}
                    </ErrorText>
                  )}
                </div>
                <div className="space-y-2">
                  <LabelText htmlFor="edit-reservation-unit">
                    Unit tersedia
                  </LabelText>
                  <Controller
                    control={form.control}
                    name="unitId"
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={(unitId) => {
                            field.onChange(unitId);
                            form.clearErrors("unitId");
                            void form.trigger("unitId");
                            const unit = unitOptions.find(
                              (option) => option.id === unitId,
                            );
                            if (unit) {
                              form.setValue(
                                "price",
                                String(unit.variant.currentPrice),
                                { shouldDirty: true, shouldValidate: true },
                              );
                            }
                          }}
                          disabled={
                            !canChangeUnit ||
                            !projectId ||
                            unitsQuery.isLoading ||
                            unitsQuery.isError
                          }
                        >
                          <SelectTrigger
                            id="edit-reservation-unit"
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
                            {unitOptions.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id}>
                                {unit.code} · {unit.category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fieldState.error && (
                          <ErrorText>{fieldState.error.message}</ErrorText>
                        )}
                        {unitsQuery.isError && (
                          <ErrorText>
                            {errorMessage(
                              unitsQuery.error,
                              "Gagal memuat unit tersedia.",
                            )}
                          </ErrorText>
                        )}
                        {!unitsQuery.isLoading &&
                          !unitsQuery.isError &&
                          projectId &&
                          unitOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Tidak ada unit tersedia di project ini.
                            </p>
                          )}
                      </>
                    )}
                  />
                </div>
                {!canChangeUnit && (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Project dan unit hanya dapat diubah pada reservasi aktif.
                  </p>
                )}
                <FormInput name="customerName" label="Nama pemesan" />
                <FormInput
                  name="customerEmail"
                  label="Email pemesan"
                  type="email"
                />
                <FormInput
                  name="customerPhone"
                  label="Nomor telepon"
                  type="tel"
                />
                <div className="space-y-2">
                  <FormSelect
                    name="salesId"
                    label="Sales"
                    labelClassname="mb-2 block"
                    options={salesOptions}
                    searchable
                    filterOptionsBySearch
                    portalInsideDialog
                    searchPlaceholder="Cari nama atau email..."
                    placeholder="Pilih sales"
                    isLoading={usersLoading}
                    className="w-full"
                  />
                  {form.formState.errors.salesId && (
                    <ErrorText>
                      {form.formState.errors.salesId.message}
                    </ErrorText>
                  )}
                </div>
                <ReservationPriceInput />
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field, fieldState }) => (
                    <div className="space-y-2">
                      <LabelText htmlFor="edit-reservation-status">
                        Status
                      </LabelText>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={reservation.statusCode === "COMPLETED"}
                      >
                        <SelectTrigger
                          id="edit-reservation-status"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses
                            .filter(
                              (status) =>
                                reservation.statusCode === "ACTIVE" ||
                                reservation.statusCode === "PAYMENT_PENDING" ||
                                status !== "COMPLETED",
                            )
                            .map((status) => (
                              <SelectItem key={status} value={status}>
                                {statusLabels[status]}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {fieldState.error && (
                        <ErrorText>{fieldState.error.message}</ErrorText>
                      )}
                    </div>
                  )}
                />
                <div className="sm:col-span-2">
                  <Controller
                    control={form.control}
                    name="notes"
                    render={({ field, fieldState }) => (
                      <div className="space-y-2">
                        <LabelText htmlFor="edit-reservation-notes">
                          Catatan
                        </LabelText>
                        <Textarea
                          id="edit-reservation-notes"
                          rows={3}
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
              {update.isError && (
                <div role="alert">
                  <ErrorText>{reservationErrorMessage(update.error)}</ErrorText>
                </div>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onModeChange("detail")}
                  disabled={update.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={update.isPending || usersLoading}
                >
                  {update.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}

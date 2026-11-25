"use client";

import { AppSidebar } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
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
import FormSelect from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLeads } from "@/hooks/use-leads";
import { useLocations } from "@/hooks/use-locations";
import { useProjects } from "@/hooks/use-projects";
import { useSources } from "@/hooks/use-sources";
import { useStatuses } from "@/hooks/use-statuses";
import { useUsers } from "@/hooks/use-users";
import { useViewings } from "@/hooks/use-viewings";
import { cn } from "@/lib/utils";
import { ViewingFormData, viewingFormSchema } from "@/schemas/viewing.schema";
import { Viewing } from "@/types/viewing";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Calendar as CalendarIcon,
  List,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ViewingsCalendar } from "./components/viewings-calendar";
import {
  ViewingSortField,
  ViewingSortOrder,
  ViewingsTable,
} from "./components/viewings-table";
import {
  ALL_FILTER_VALUE,
  ViewingsToolbar,
} from "./components/viewings-toolbar";

type ViewMode = "calendar" | "table";

const TABLE_PAGE_SIZE = 10;
const CALENDAR_PAGE_SIZE = 100;
const DEFAULT_DURATION = "60";
const DURATION_PRESETS = [30, 45, 60, 90, 120, 180];

const EMPTY_FORM: ViewingFormData = {
  leadId: "",
  actorId: "",
  statusId: "",
  sourceId: "",
  locationId: "",
  scheduledAt: "",
  durationMinutes: DEFAULT_DURATION,
  notes: "",
};

/** Value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInputValue(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const options: Array<{ value: ViewMode; label: string; icon: typeof List }> =
    [
      { value: "calendar", label: "Calendar", icon: CalendarDays },
      { value: "table", label: "Table", icon: List },
    ];
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Mode tampilan"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant="outline"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "h-10 bg-white px-3",
            mode === value &&
              "border-slate-900 bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
          )}
        >
          <Icon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}

export default function ViewingsPage() {
  const { user } = useAuth();
  const { locations } = useLocations();
  const [leadSearch, setLeadSearch] = useState("");
  const debouncedLeadSearch = useDebouncedValue(leadSearch);
  const { leads, isFetching: isSearchingLeads } = useLeads({
    getAll: true,
    useServerPagination: true,
    page: 1,
    limit: 20,
    additionalParams: debouncedLeadSearch
      ? { search: debouncedLeadSearch }
      : undefined,
  });
  const { users, isLoading: isUsersLoading } = useUsers();
  const { data: projectList, isLoading: isProjectsLoading } = useProjects({
    page: 1,
    limit: 100,
    isActive: true,
  });
  const { sources: viewingSources } = useSources({
    additionalParams: { type: "viewing" },
  });
  const { statuses: viewingStatuses, isLoading: isStatusesLoading } =
    useStatuses({
      additionalParams: { type: "viewing" },
    });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedViewing, setSelectedViewing] = useState<Viewing | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [salesId, setSalesId] = useState(ALL_FILTER_VALUE);
  const [projectId, setProjectId] = useState(ALL_FILTER_VALUE);
  const [statusId, setStatusId] = useState(ALL_FILTER_VALUE);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ViewingSortField>("scheduledAt");
  const [sortOrder, setSortOrder] = useState<ViewingSortOrder>("asc");

  const withPageReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const handleSortChange = (field: ViewingSortField) => {
    if (field === sortBy) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const filterParams = useMemo(() => {
    const trimmedSearch = debouncedSearch.trim();
    return {
      startDate: new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1,
        0,
        0,
        0,
      ).toISOString(),
      endDate: new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ).toISOString(),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      ...(salesId !== ALL_FILTER_VALUE ? { assignedUserId: salesId } : {}),
      ...(projectId !== ALL_FILTER_VALUE ? { projectId } : {}),
      ...(statusId !== ALL_FILTER_VALUE ? { statusId } : {}),
    };
  }, [currentMonth, debouncedSearch, salesId, projectId, statusId]);

  const isCalendar = viewMode === "calendar";
  const tableParams = useMemo(
    () => ({ ...filterParams, sortBy, sortOrder }),
    [filterParams, sortBy, sortOrder],
  );

  const {
    viewings,
    meta,
    isLoading,
    isError,
    createViewing,
    updateViewing,
    deleteViewing,
    isCreating,
    isUpdating,
    isDeleting,
  } = useViewings({
    page: isCalendar ? 1 : page,
    limit: isCalendar ? CALENDAR_PAGE_SIZE : TABLE_PAGE_SIZE,
    additionalParams: isCalendar ? filterParams : tableParams,
    fetchAllPages: isCalendar,
  });

  // After deleting the last row of the last page, fall back to the new last page.
  useEffect(() => {
    if (meta && meta.totalPages > 0 && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

  const leadOptions = useMemo(() => {
    const options = leads.map((lead) => ({
      value: lead.id,
      label:
        `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim(),
    }));
    const selectedLead = selectedViewing?.lead;
    if (
      selectedLead?.customer &&
      !options.some((option) => option.value === selectedLead.id)
    ) {
      options.unshift({
        value: selectedLead.id,
        label:
          `${selectedLead.customer.firstName} ${selectedLead.customer.lastName || ""}`.trim(),
      });
    }
    return options;
  }, [leads, selectedViewing]);

  const salesOptions = useMemo(
    () =>
      users.map((item) => ({ value: item.id, label: item.name || item.email })),
    [users],
  );

  const projectOptions = useMemo(
    () =>
      (projectList?.data ?? []).map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [projectList],
  );

  const statusOptions = useMemo(
    () =>
      viewingStatuses.map((status) => ({
        value: status.id,
        label: status.name,
      })),
    [viewingStatuses],
  );

  const unitsOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.name,
      })),
    [locations],
  );

  const sourceOptions = useMemo(
    () =>
      viewingSources.map((source) => ({
        value: source.id,
        label: source.name,
      })),
    [viewingSources],
  );

  const durationOptions = useMemo(() => {
    const minutes = new Set(DURATION_PRESETS);
    if (selectedViewing?.durationMinutes)
      minutes.add(selectedViewing.durationMinutes);
    return [...minutes]
      .sort((a, b) => a - b)
      .map((value) => ({ value: String(value), label: `${value} menit` }));
  }, [selectedViewing]);

  const addForm = useForm<ViewingFormData>({
    resolver: zodResolver(viewingFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const editForm = useForm<ViewingFormData>({
    resolver: zodResolver(viewingFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const buildPayload = (data: ViewingFormData) => {
    const lead = leads.find((item) => item.id === data.leadId);
    return {
      leadId: data.leadId,
      actorId: data.actorId || undefined,
      statusId: data.statusId || undefined,
      sourceId: data.sourceId || undefined,
      locationId: data.locationId || undefined,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      durationMinutes: Number(data.durationMinutes),
      name: lead
        ? `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim()
        : undefined,
      email: lead?.customer?.email || undefined,
      notes: data.notes,
    };
  };

  const onSubmitAdd = async (data: ViewingFormData) => {
    try {
      await createViewing(buildPayload(data));
      addForm.reset(EMPTY_FORM);
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add visit:", error);
    }
  };

  const onSubmitEdit = async (data: ViewingFormData) => {
    if (!selectedViewing) return;

    try {
      await updateViewing({ id: selectedViewing.id, data: buildPayload(data) });
      editForm.reset(EMPTY_FORM);
      setIsEditDialogOpen(false);
      setSelectedViewing(null);
    } catch (error) {
      console.error("Failed to update visit:", error);
    }
  };

  const openEditDialog = (viewing: Viewing) => {
    setSelectedViewing(viewing);
    editForm.reset({
      leadId: viewing.leadId || "",
      actorId: viewing.actorId || "",
      statusId: viewing.statusId || "",
      sourceId: viewing.sourceId || "",
      locationId: viewing.location?.id || "",
      scheduledAt: toLocalInputValue(viewing.scheduledAt),
      durationMinutes: String(viewing.durationMinutes ?? DEFAULT_DURATION),
      notes: viewing.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (viewing: Viewing) => {
    setSelectedViewing(viewing);
    setIsDeleteDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    if (!selectedViewing) return;

    try {
      await deleteViewing(selectedViewing.id);
      setIsDeleteDialogOpen(false);
      setSelectedViewing(null);
    } catch (error) {
      console.error("Failed to delete visit:", error);
    }
  };

  const toolbar = (
    <ViewingsToolbar
      mode={viewMode}
      search={search}
      onSearchChange={withPageReset(setSearch)}
      month={currentMonth}
      onMonthChange={withPageReset(setCurrentMonth)}
      salesId={salesId}
      onSalesChange={withPageReset(setSalesId)}
      projectId={projectId}
      onProjectChange={withPageReset(setProjectId)}
      statusId={statusId}
      onStatusChange={withPageReset(setStatusId)}
      salesOptions={salesOptions}
      projectOptions={projectOptions}
      statusOptions={statusOptions}
      isSalesLoading={isUsersLoading}
      isProjectLoading={isProjectsLoading}
      isStatusLoading={isStatusesLoading}
    />
  );

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0 min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/leads">Leads</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Visit Schedule Leads</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => addForm.reset(EMPTY_FORM)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Visit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Visit Schedule</DialogTitle>
                  <DialogDescription>
                    Create a visit plan from existing leads.
                  </DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <FormSelect
                      name="leadId"
                      label="Nama User"
                      placeholder="Select lead"
                      options={leadOptions}
                      className="col-span-2"
                      searchable
                      searchValue={leadSearch}
                      searchPlaceholder="Search lead name, email, or phone..."
                      onSearchChange={setLeadSearch}
                      isLoading={isSearchingLeads}
                    />
                    <FormSelect
                      name="actorId"
                      label="PIC Visit"
                      placeholder="Select sales"
                      options={salesOptions}
                      className="col-span-1"
                    />
                    <FormInput
                      name="scheduledAt"
                      label="Tanggal & Jam Visit"
                      type="datetime-local"
                      className="col-span-1"
                    />
                    <FormSelect
                      name="durationMinutes"
                      label="Durasi"
                      placeholder="Select duration"
                      options={durationOptions}
                      className="col-span-1"
                    />
                    <FormSelect
                      name="statusId"
                      label="Status"
                      placeholder="Select viewing status"
                      options={statusOptions}
                      className="col-span-1"
                      disabled={statusOptions.length === 0}
                    />
                    <FormSelect
                      name="locationId"
                      label="Units"
                      placeholder="Select units"
                      options={unitsOptions}
                      className="col-span-1"
                      disabled={unitsOptions.length === 0}
                    />
                    <FormSelect
                      name="sourceId"
                      label="Source"
                      placeholder="Select source"
                      options={sourceOptions}
                      className="col-span-1"
                      disabled={sourceOptions.length === 0}
                    />
                    <div className="col-span-2">
                      <FormTextarea
                        name="notes"
                        label="Notes"
                        placeholder="Tulis ringkasan hasil survey..."
                        rows={4}
                      />
                    </div>
                    <div className="col-span-2">
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isCreating}>
                          {isCreating ? "Saving..." : "Save Visit"}
                        </Button>
                      </DialogFooter>
                    </div>
                  </form>
                </FormProvider>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="space-y-3 p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
          {isCalendar ? (
            <div className="space-y-3 rounded-xl border bg-slate-50/60 p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-base font-semibold">
                  Visit Schedule Management
                </h1>
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              </div>
              {toolbar}
              <ViewingsCalendar
                viewings={viewings}
                isLoading={isLoading}
                isError={isError}
                currentMonth={currentMonth}
                onEdit={openEditDialog}
                onDelete={handleDelete}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <CalendarIcon className="size-6" />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight">
                      Visit Schedule Management
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Kelola jadwal kunjungan customer dan pantau agenda visit
                      tim sales secara terpusat.
                    </p>
                  </div>
                </div>
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              </div>
              {toolbar}
              <ViewingsTable
                viewings={viewings}
                isLoading={isLoading}
                isError={isError}
                meta={meta}
                page={page}
                limit={TABLE_PAGE_SIZE}
                onPageChange={setPage}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                onEdit={openEditDialog}
                onDelete={handleDelete}
              />
            </>
          )}
        </div>
      </SidebarInset>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Visit Schedule</DialogTitle>
            <DialogDescription>
              Update visit information and follow-up progress.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4"
            >
              {user?.role === "owner" && (
                <FormSelect
                  name="leadId"
                  label="Lead Name"
                  placeholder="Select lead"
                  options={leadOptions}
                  className="col-span-2"
                  searchable
                  searchValue={leadSearch}
                  searchPlaceholder="Search lead name, email, or phone..."
                  onSearchChange={setLeadSearch}
                  isLoading={isSearchingLeads}
                />
              )}
              <FormSelect
                name="actorId"
                label="PIC Visit"
                placeholder="Select sales"
                options={salesOptions}
                className="col-span-1"
              />
              <FormInput
                name="scheduledAt"
                label="Tanggal & Jam Visit"
                type="datetime-local"
                className="col-span-1"
              />
              <FormSelect
                name="durationMinutes"
                label="Durasi"
                placeholder="Select duration"
                options={durationOptions}
                className="col-span-1"
              />
              <FormSelect
                name="statusId"
                label="Status"
                placeholder="Select viewing status"
                options={statusOptions}
                className="col-span-1"
                disabled={statusOptions.length === 0}
              />
              <FormSelect
                name="sourceId"
                label="Source"
                placeholder="Select source"
                options={sourceOptions}
                className="col-span-1"
                disabled={sourceOptions.length === 0}
              />
              <div className="col-span-2">
                <FormTextarea
                  name="notes"
                  label="Hasil Survey"
                  placeholder="Tulis ringkasan hasil survey..."
                  rows={4}
                />
              </div>
              <div className="col-span-2">
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete Visit"
        description="Are you sure you want to delete this visit schedule?"
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}

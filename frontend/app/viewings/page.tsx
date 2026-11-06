"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useLeads } from "@/hooks/use-leads";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useLocations } from "@/hooks/use-locations";
import { useSources } from "@/hooks/use-sources";
import { useStatuses } from "@/hooks/use-statuses";
import { useUsers } from "@/hooks/use-users";
import { useViewings } from "@/hooks/use-viewings";
import { ViewingFormData, viewingFormSchema } from "@/schemas/viewing.schema";
import { Viewing } from "@/types/viewing";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ViewingsCalendar } from "./components/viewings-calendar";
import { ViewingsTable } from "./components/viewings-table";

type DateFilter = "all" | "today" | "week" | "month" | "upcoming" | "past";

function buildDateParams(
  filter: DateFilter,
): Record<string, string> {
  if (filter === "all") return {};
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (filter === "today") {
    return { startDate: startOfDay.toISOString(), endDate: endOfDay.toISOString() };
  }
  if (filter === "week") {
    const dayOffset = (startOfDay.getDay() + 6) % 7;
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - dayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { startDate: weekStart.toISOString(), endDate: weekEnd.toISOString() };
  }
  if (filter === "month") {
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
    };
  }
  if (filter === "upcoming") return { startDate: startOfDay.toISOString() };
  if (filter === "past") return { endDate: new Date(startOfDay.getTime() - 1).toISOString() };
  return {};
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
  const { users } = useUsers();
  const { sources: viewingSources } = useSources({
    additionalParams: { type: "viewing" },
  });
  const { statuses: viewingStatuses } = useStatuses({
    additionalParams: { type: "viewing" },
  });

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedViewing, setSelectedViewing] = useState<Viewing | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Table filter state (server-side)
  const [tableSourceId, setTableSourceId] = useState<string>("all");
  const [tableStatusId, setTableStatusId] = useState<string>("all");
  const [tableDateFilter, setTableDateFilter] = useState<DateFilter>("all");

  // Calendar query: filter by current visible month
  const calendarParams = useMemo(
    () => ({
      startDate: new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1,
        0, 0, 0,
      ).toISOString(),
      endDate: new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0,
        23, 59, 59, 999,
      ).toISOString(),
    }),
    [currentMonth],
  );

  // Table query: server-side select filters
  const tableServerParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (tableSourceId !== "all") params.sourceId = tableSourceId;
    if (tableStatusId !== "all") params.statusId = tableStatusId;
    Object.assign(params, buildDateParams(tableDateFilter));
    return params;
  }, [tableSourceId, tableStatusId, tableDateFilter]);

  const activeQueryParams =
    viewMode === "calendar" ? calendarParams : tableServerParams;

  const {
    viewings,
    isLoading,
    createViewing,
    updateViewing,
    deleteViewing,
    isCreating,
    isUpdating,
    isDeleting,
  } = useViewings({
    additionalParams: activeQueryParams,
    limit: 100,
    fetchAllPages: viewMode === "calendar",
  });


  const leadOptions = useMemo(
    () => {
      const options = leads.map((lead) => ({
        value: lead.id,
        label:
          `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim(),
      }));
      const selectedLead = selectedViewing?.lead;
      if (selectedLead?.customer && !options.some((option) => option.value === selectedLead.id)) {
        options.unshift({
          value: selectedLead.id,
          label: `${selectedLead.customer.firstName} ${selectedLead.customer.lastName || ""}`.trim(),
        });
      }
      return options;
    },
    [leads, selectedViewing],
  );

  const salesOptions = useMemo(
    () =>
      (users || []).map((user) => ({
        value: user.id,
        label: user.name || user.email,
      })),
    [users],
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

  const addForm = useForm<ViewingFormData>({
    resolver: zodResolver(viewingFormSchema),
    defaultValues: {
      leadId: "",
      actorId: "",
      statusId: "",
      sourceId: "",
      scheduledAt: "",
      notes: "",
      locationId: "",
    },
  });

  const editForm = useForm<ViewingFormData>({
    resolver: zodResolver(viewingFormSchema),
    defaultValues: {
      leadId: "",
      actorId: "",
      statusId: "",
      sourceId: "",
      scheduledAt: "",
      notes: "",
      locationId: "",
    },
  });

  const onSubmitAdd = async (data: ViewingFormData) => {
    try {
      const lead = leads.find((item) => item.id === data.leadId);

      await createViewing({
        leadId: data.leadId,
        actorId: data.actorId || undefined,
        statusId: data.statusId || undefined,
        sourceId: data.sourceId || undefined,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        name: lead
          ? `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim()
          : undefined,
        email: lead?.customer?.email || undefined,
        notes: data.notes,
        locationId: data.locationId,
      });

      addForm.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add visit:", error);
    }
  };

  const onSubmitEdit = async (data: ViewingFormData) => {
    if (!selectedViewing) return;

    try {
      const lead = leads.find((item) => item.id === data.leadId);

      await updateViewing({
        id: selectedViewing.id,
        data: {
          leadId: data.leadId,
          actorId: data.actorId || undefined,
          statusId: data.statusId || undefined,
          sourceId: data.sourceId || undefined,
          scheduledAt: new Date(data.scheduledAt).toISOString(),
          name: lead
            ? `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim()
            : undefined,
          email: lead?.customer?.email || undefined,
          notes: data.notes,
          locationId: data.locationId,
        },
      });

      editForm.reset();
      setIsEditDialogOpen(false);
      setSelectedViewing(null);
    } catch (error) {
      console.error("Failed to update visit:", error);
    }
  };

  const openEditDialog = (viewing: Viewing) => {
    const scheduledAt = viewing.scheduledAt
      ? new Date(viewing.scheduledAt).toISOString().split("T")[0]
      : "";

    setSelectedViewing(viewing);
    editForm.reset({
      leadId: viewing.leadId || "",
      actorId: viewing.actorId || "",
      statusId: viewing.statusId || "",
      sourceId: viewing.sourceId || "",
      scheduledAt,
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

  const handleCalendarMonthChange = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const diff = direction === "prev" ? -1 : 1;
      return new Date(prev.getFullYear(), prev.getMonth() + diff, 1);
    });
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Viewing / Visit</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
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
                      label="Tanggal Visit"
                      type="date"
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

        <div className="p-4">
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardHeader className="border-b bg-linear-to-r from-slate-50 to-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Visit Schedule Management</CardTitle>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode("calendar")}
                    className={
                      viewMode === "calendar" ? "bg-slate-900 text-white" : ""
                    }
                  >
                    Calendar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode("table")}
                    className={
                      viewMode === "table" ? "bg-slate-900 text-white" : ""
                    }
                  >
                    Table
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4">
                {viewMode === "calendar" ? (
                  <ViewingsCalendar
                    viewings={viewings}
                    isLoading={isLoading}
                    currentMonth={currentMonth}
                    onChangeMonth={handleCalendarMonthChange}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                      <Select
                        value={tableDateFilter}
                        onValueChange={(v) =>
                          setTableDateFilter(v as DateFilter)
                        }
                      >
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue placeholder="Visit Date" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All dates</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This week</SelectItem>
                          <SelectItem value="month">This month</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="past">Past</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={tableSourceId}
                        onValueChange={setTableSourceId}
                      >
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sources</SelectItem>
                          {sourceOptions.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={tableStatusId}
                        onValueChange={setTableStatusId}
                      >
                        <SelectTrigger className="w-full sm:w-44">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {statusOptions.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <ViewingsTable
                      viewings={viewings}
                      isLoading={isLoading}
                      onEdit={openEditDialog}
                      onDelete={handleDelete}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
              {user?.role === "admin" && (
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
                label="Tanggal Visit"
                type="date"
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

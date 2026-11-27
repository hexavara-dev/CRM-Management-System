"use client";
import { LabelBadge } from "@/app/crm-configuration/leads-label/label-icons";
import { AddLeadForm, type PendingLeadDeal } from "@/app/leads/components/add-lead-form";
import { AddDealDialog } from "@/app/deals/components/add-deal-dialog";
import { LeadArchiveDialog } from "@/app/leads/components/lead-archive-dialog";
import {
  type LeadDateRange,
  LeadsPipelineTab,
} from "@/app/leads/components/leads-pipeline-tab";
import { AppSidebar } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadLabels } from "@/hooks/use-lead-labels";
import { useArchiveLeadAction } from "@/hooks/use-lead-archive";
import { useActiveLeadSources } from "@/hooks/use-lead-sources";
import { useLeadsTable } from "@/hooks/use-leads-table";
import { apiErrorMessage } from "@/lib/api-error";
import { useLocations } from "@/hooks/use-locations";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useProjects } from "@/hooks/use-projects";
import { useUsers } from "@/hooks/use-users";
import {
  LeadFormData,
  LeadFormInput,
  leadFormSchema,
} from "@/schemas/lead.schema";
import { Lead } from "@/types/lead";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  Clock3,
  Columns3,
  List,
  Pencil,
  Plus,
  Search,
  Archive,
  Upload,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { DateRange } from "react-day-picker";

const formatLeadDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "-";

const getLastUpdate = (lead: Lead) => {
  const latestActivity = lead.activities?.reduce<string | undefined>(
    (latest, activity) =>
      !latest || new Date(activity.createdAt) > new Date(latest)
        ? activity.createdAt
        : latest,
    undefined,
  );
  return latestActivity || lead.createdAt;
};

const getDaysSince = (value: string) =>
  Math.max(
    0,
    Math.floor(
      (new Date().setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) /
        86_400_000,
    ),
  );

const dateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateLabel = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function SidebarAwareLeadsTable({
  children,
}: { children: (isSidebarCollapsed: boolean) => ReactNode }) {
  const { state, isMobile } = useSidebar();
  return <>{children(!isMobile && state === "collapsed")}</>;
}

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [prospectFilter, setProspectFilter] = useState("all");
  // Pipeline menampilkan seluruh Lead sampai user secara eksplisit memilih periode.
  const [pipelineDateRange, setPipelineDateRange] = useState<LeadDateRange>({
    from: "",
    to: "",
  });
  const deferredSearch = useDeferredValue(search.trim());
  const pipelinePeriod: DateRange | undefined = pipelineDateRange.from
    ? {
        from: new Date(`${pipelineDateRange.from}T00:00:00`),
        to: pipelineDateRange.to
          ? new Date(`${pipelineDateRange.to}T00:00:00`)
          : undefined,
      }
    : undefined;
  const pipelinePeriodLabel = pipelinePeriod?.from
    ? pipelinePeriod.to
      ? `${dateLabel(pipelinePeriod.from)} – ${dateLabel(pipelinePeriod.to)}`
      : dateLabel(pipelinePeriod.from)
    : "Pilih rentang tanggal";

  const { leads, isLoading, isError, error, updateLead, serverPagination } =
    useLeadsTable({
      filters: {
        search: deferredSearch || undefined,
        projectId: projectFilter === "all" ? undefined : projectFilter,
        stageId: stageFilter === "all" ? undefined : stageFilter,
        assignedUserId: salesFilter === "all" ? undefined : salesFilter,
        sourceId: sourceFilter === "all" ? undefined : sourceFilter,
        labelId: prospectFilter === "all" ? undefined : prospectFilter,
      },
    });
  const { user } = useAuth();

  const pipelineStagesQuery = usePipelineStages("lead");
  const stages = (pipelineStagesQuery.data ?? []).filter(
    (stage) => stage.isActive,
  );
  const { locations } = useLocations();
  const { users } = useUsers();
  const { sources } = useActiveLeadSources();
  const leadLabelsQuery = useLeadLabels(undefined, 1, 100);
  const leadLabels = (leadLabelsQuery.data?.data ?? []).filter(
    (label) => label.isActive,
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [leadForNewDeal, setLeadForNewDeal] = useState<PendingLeadDeal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadToArchive, setLeadToArchive] = useState<Lead | null>(null);
  const { archiveLead, isArchiving } = useArchiveLeadAction();
  const router = useRouter();

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: "name",
        header: "Lead",
        size: 112,
        accessorFn: (row) =>
          `${row.customer.firstName} ${row.customer.lastName || ""}`.trim(),
        cell: ({ row }) => {
          const lead = row.original;
          const name = row.getValue("name") as string;
          return (
            <button
              type="button"
              className="min-w-36 cursor-pointer text-left"
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <span className="font-semibold text-[#141B34] hover:text-[#0B63F6]">
                {name}
              </span>
            </button>
          );
        },
      },
      {
        id: "phone",
        header: "No. HP",
        size: 112,
        accessorFn: (row) => row.customer.phoneNumber || "-",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.customer.phoneNumber || "-"}
          </span>
        ),
      },
      {
        id: "project",
        header: "Project Diminati",
        size: 170,
        accessorFn: (row) => row.project?.name || row.location?.name || "-",
        cell: ({ row }) =>
          row.original.project?.name || row.original.location?.name ? (
            <span
              title={row.original.project?.name || row.original.location?.name}
              className="block max-w-40 truncate rounded-md bg-[#E7F0FF] px-2 py-1 text-[11px] font-medium text-[#0B63F6]"
            >
              {row.original.project?.name || row.original.location?.name}
            </span>
          ) : (
            "-"
          ),
      },
      {
        id: "source",
        header: "Asal Leads",
        size: 100,
        accessorFn: (row) => row.source?.name || "-",
        cell: ({ row }) => (
          <span title={row.original.source?.name} className="block truncate">
            {row.original.source?.name || "-"}
          </span>
        ),
      },
      {
        id: "prospect",
        header: "Prospek",
        size: 145,
        accessorFn: (row) =>
          row.labels?.map((label) => label.name).join(", ") || "-",
        cell: ({ row }) =>
          row.original.labels?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {row.original.labels.map((label) => (
                <LabelBadge
                  key={label.id}
                  name={label.name}
                  color={label.color}
                  icon={label.icon}
                  className="lead-list-label"
                />
              ))}
            </div>
          ) : (
            "-"
          ),
      },
      {
        id: "createdAt",
        size: 112,
        header: () => (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            Tanggal Leads <ArrowUpDown className="size-3" />
          </span>
        ),
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatLeadDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "stage",
        header: "Fase Leads",
        size: 105,
        accessorFn: (row) => row.stage?.name || "-",
        cell: ({ row }) =>
          row.original.stage ? (
            <Badge colorHex={row.original.stage.color || "#E8EDF5"}>
              {row.original.stage.name}
            </Badge>
          ) : (
            "-"
          ),
      },
      {
        id: "assignedSales",
        header: "Assigned Sales",
        size: 125,
        accessorFn: (row) => row.assignedUser?.name || "-",
        cell: ({ row }) => (
          <span
            title={row.original.assignedUser?.name}
            className="block truncate"
          >
            {row.original.assignedUser?.name || "-"}
          </span>
        ),
      },
      {
        id: "lastUpdate",
        header: "Last Update",
        size: 112,
        accessorFn: (row) => getLastUpdate(row),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatLeadDate(getLastUpdate(row.original))}
          </span>
        ),
      },
      {
        id: "days",
        size: 72,
        header: () => (
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" /> Hari
          </span>
        ),
        accessorFn: (row) => getDaysSince(getLastUpdate(row)),
        cell: ({ row }) => {
          const days = getDaysSince(getLastUpdate(row.original));
          const tone =
            days <= 1
              ? "bg-[#E8F7EC] text-[#16803A]"
              : days <= 3
                ? "bg-[#FFF3E0] text-[#C66A00]"
                : "bg-[#FFE7E7] text-[#D92D20]";
          return (
            <span
              className={`whitespace-nowrap rounded-md px-2 py-1 text-xs ${tone}`}
            >
              {days} hari
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        size: 88,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/leads/${lead.id}`);
                }}
                title="Lihat atau ubah Lead"
                aria-label="Lihat atau ubah Lead"
              >
                <Pencil className="h-4 w-4 text-[#141B34]" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setLeadToArchive(lead);
                }}
                title="Arsipkan Lead"
                aria-label="Arsipkan Lead"
              >
                <Archive className="h-4 w-4 text-[#D92D20]" />
              </Button>
            </div>
          );
        },
      },
    ],
    [router],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: location.id,
        label: location.name,
      })),
    [locations],
  );

  const getLocationNameById = (locationId?: string) => {
    if (!locationId) return "";
    return locations.find((location) => location.id === locationId)?.name || "";
  };

  const projectsQuery = useProjects({ page: 1, limit: 100, isActive: true });
  const projectOptions = (projectsQuery.data?.data ?? []).map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const editForm = useForm<LeadFormInput, unknown, LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      stageId: "",
      source: "",
      gender: "",
      salutation: "",
      organizationName: "",
      organizationLocation: "",
      locationId: "",
      sourceId: "",
      labelIds: [],
      priority: "MEDIUM",
    },
  });

  const onSubmitEdit = async (data: LeadFormData) => {
    if (selectedLead) {
      try {
        await updateLead({
          id: selectedLead.id,
          data: {
            ...data,
            location: getLocationNameById(data.locationId),
          },
        });
        editForm.reset();
        setIsEditDialogOpen(false);
        setSelectedLead(null);
      } catch (error) {
        console.error("Failed to update lead:", error);
      }
    }
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0 min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-[#101828]">Leads Management</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled
                title="Import akan diaktifkan setelah kontrak data Lead lengkap."
              >
                <Upload className="mr-2 h-4 w-4" />
                Import Leads
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="grid h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-h-[860px] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-[#D6E4FF] bg-[#FBFCFF] p-0 shadow-2xl sm:w-[calc(100vw-4rem)] sm:max-w-[1280px]">
                  <DialogHeader className="border-b border-[#DCE7F8] bg-[linear-gradient(110deg,#F7FAFF_0%,#FFFFFF_72%)] px-6 py-5 pr-14">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF2FF] text-[#0B63F6] shadow-sm">
                        <UserRound className="size-5" />
                      </span>
                      <div>
                        <DialogTitle className="text-xl font-bold tracking-tight text-[#121B41]">
                          Add New Lead
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-xs text-[#667085]">
                          Tambah data prospek baru ke dalam sistem CRM.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <AddLeadForm
                    onDone={() => setIsAddDialogOpen(false)}
                    onDealRequested={(lead) => {
                      setIsAddDialogOpen(false);
                      setLeadForNewDeal(lead);
                    }}
                  />
                </DialogContent>
              </Dialog>
              {leadForNewDeal && (
                <AddDealDialog
                  pendingLead={leadForNewDeal}
                  onClose={() => setLeadForNewDeal(null)}
                  onCreated={() => setLeadForNewDeal(null)}
                />
              )}
            </div>
          </div>
        </header>

        <div className="min-w-0 bg-[#FAFBFC] p-3 lg:flex-1 lg:overflow-hidden">
          <Tabs
            defaultValue="list"
            className="space-y-3 lg:flex lg:h-full lg:min-h-0 lg:flex-col"
          >
            <TabsList className="h-10 w-fit gap-0.5 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-[#F7F8FA] p-1 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
              <TabsTrigger
                value="list"
                className="h-8 gap-2 rounded-xl px-4 text-sm font-medium text-[#667085] transition-colors hover:text-[#344054] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0B63F6] data-[state=active]:shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
              >
                <List className="size-4" />
                List Leads
              </TabsTrigger>
              <TabsTrigger
                value="pipeline"
                className="h-8 gap-2 rounded-xl px-4 text-sm font-medium text-[#667085] transition-colors hover:text-[#344054] data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-[#0B63F6] data-[state=active]:shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
              >
                <Columns3 className="size-4" />
                Pipeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0 lg:min-h-0 lg:flex-1">
              <Card className="gap-0 rounded-xl py-0 shadow-none lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <CardHeader className="px-4 pt-3 pb-2">
                  <CardTitle className="pb-1 text-lg font-semibold">
                    Leads Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.4fr)_repeat(5,minmax(125px,1fr))] xl:[&_[data-slot=select-trigger]]:h-8 xl:[&_[data-slot=select-trigger]]:text-xs xl:[&_[data-slot=input]]:h-8 xl:[&_[data-slot=input]]:text-xs">
                    <label className="space-y-1">
                      <span
                        aria-hidden="true"
                        className="invisible block text-xs font-medium"
                      >
                        Pencarian
                      </span>
                      <span className="relative block">
                        <span className="sr-only">Cari nama atau nomor HP</span>
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Cari nama atau nomor HP..."
                          className="pl-9"
                        />
                      </span>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">Project</span>
                      <Select
                        value={projectFilter}
                        onValueChange={setProjectFilter}
                        disabled={projectsQuery.isLoading}
                      >
                        <SelectTrigger aria-label="Filter project">
                          <SelectValue placeholder="Semua Project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Project</SelectItem>
                          {projectOptions.map((project) => (
                            <SelectItem
                              key={project.value}
                              value={project.value}
                            >
                              {project.label}
                            </SelectItem>
                          ))}
                          {!projectsQuery.isLoading &&
                            projectOptions.length === 0 && (
                              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                                Belum ada Project aktif
                              </p>
                            )}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">
                        Tahapan Pipeline
                      </span>
                      <Select
                        value={stageFilter}
                        onValueChange={setStageFilter}
                      >
                        <SelectTrigger aria-label="Filter tahapan pipeline">
                          <SelectValue placeholder="Semua Tahapan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Tahapan</SelectItem>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">Prospek</span>
                      <Select
                        value={prospectFilter}
                        onValueChange={setProspectFilter}
                      >
                        <SelectTrigger aria-label="Filter prospek">
                          <SelectValue placeholder="Semua Prospek" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Prospek</SelectItem>
                          {leadLabels.map((label) => (
                            <SelectItem key={label.id} value={label.id}>
                              <span className="inline-flex items-center gap-2">
                                <LabelBadge
                                  name={label.name}
                                  color={label.color}
                                  icon={label.icon}
                                />
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">
                        Assigned Sales
                      </span>
                      <Select
                        value={salesFilter}
                        onValueChange={setSalesFilter}
                        disabled={user?.role !== "owner"}
                      >
                        <SelectTrigger aria-label="Filter assigned sales">
                          <SelectValue placeholder="Semua Sales" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Sales</SelectItem>
                          {users.map((sales) => (
                            <SelectItem key={sales.id} value={sales.id}>
                              {sales.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">
                        Asal Leads
                      </span>
                      <Select
                        value={sourceFilter}
                        onValueChange={setSourceFilter}
                      >
                        <SelectTrigger aria-label="Filter asal Leads">
                          <SelectValue placeholder="Semua Sumber" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Sumber</SelectItem>
                          {sources.map((source) => (
                            <SelectItem key={source.id} value={source.id}>
                              {source.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <SidebarAwareLeadsTable>
                    {(isSidebarCollapsed) => (
                      <DataTable
                        columns={columns}
                        data={leads}
                        isLoading={isLoading}
                        errorMessage={
                          isError
                            ? apiErrorMessage(error, "Gagal memuat daftar Lead. Coba muat ulang halaman.")
                            : undefined
                        }
                        serverPagination={serverPagination}
                        showColumnSelector={false}
                    tableHeaderClassName="text-slate-700"
                        className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-2"
                        tableContainerClassName="lg:min-h-0 lg:flex-1 [&_th]:!px-2 [&_td]:!px-2 [&_th]:!py-1.5 [&_td]:!py-1.5 [&_th]:!text-[11px] [&_td]:!text-[11px] [&_.lead-list-label]:!gap-1 [&_.lead-list-label]:!px-1.5 [&_.lead-list-label]:!py-0.5 [&_.lead-list-label]:!text-[10px]"
                        compact
                        useColumnSizing
                        fillAvailableWidth={isSidebarCollapsed}
                      />
                    )}
                  </SidebarAwareLeadsTable>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pipeline" className="lg:min-h-0 lg:flex-1">
              <Card className="gap-0 rounded-xl py-0 shadow-none lg:flex lg:h-full lg:min-h-0 lg:flex-col">
                <CardHeader className="flex flex-row items-end justify-between gap-4 px-4 pt-3 pb-2">
                  <CardTitle className="pb-1 text-lg font-semibold">
                    Leads Pipeline
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium whitespace-nowrap">
                      Periode Leads
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-60 justify-start text-xs font-normal"
                        >
                          <CalendarDays className="mr-2 size-3.5 text-muted-foreground" />
                          {pipelinePeriodLabel}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-auto p-0">
                        <Calendar
                          mode="range"
                          numberOfMonths={2}
                          selected={pipelinePeriod}
                          onSelect={(range) =>
                            setPipelineDateRange({
                              from: range?.from ? dateValue(range.from) : "",
                              to: range?.to ? dateValue(range.to) : "",
                            })
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                  <LeadsPipelineTab dateRange={pipelineDateRange} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>

      <LeadArchiveDialog
        open={leadToArchive !== null}
        leadName={
          leadToArchive
            ? `${leadToArchive.customer.firstName} ${leadToArchive.customer.lastName || ""}`.trim()
            : undefined
        }
        isSubmitting={isArchiving}
        onOpenChange={(open) => {
          if (!open) setLeadToArchive(null);
        }}
        onSubmit={async ({ category, reason }) => {
          if (!leadToArchive) return;
          await archiveLead({ id: leadToArchive.id, category, reason });
          setLeadToArchive(null);
        }}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update the lead information below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4"
            >
              <FormSelect
                name="salutation"
                label="Salutation"
                options={[
                  { value: "Mr", label: "Mr" },
                  { value: "Mrs", label: "Mrs" },
                  { value: "Ms", label: "Ms" },
                  { value: "Dr", label: "Dr" },
                ]}
                placeholder="Select"
                className="col-span-1"
              />
              <FormSelect
                name="gender"
                label="Gender"
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
                placeholder="Select"
                className="col-span-1"
              />
              <FormInput
                name="firstName"
                label="First Name"
                className="col-span-1"
              />
              <FormInput
                name="lastName"
                label="Last Name"
                className="col-span-1"
              />
              <FormInput
                name="email"
                label="Email"
                type="email"
                className="col-span-1"
              />
              <FormInput name="phone" label="Phone" className="col-span-1" />
              <FormInput
                name="organizationName"
                label="Organization Name"
                className="col-span-1"
              />
              <FormInput
                name="organizationLocation"
                label="Organization Location"
                className="col-span-1"
              />
              <FormSelect
                name="locationId"
                label="Contact Location"
                className="col-span-1"
                placeholder="Select location"
                options={locationOptions}
                disabled={locationOptions.length === 0}
              />
              <FormInput
                name="company"
                label="Company (Alias)"
                className="col-span-1"
              />
              <FormSelect
                name="stageId"
                label="Tahapan Pipeline"
                className="col-span-1"
                options={stages.map((stage) => ({
                  value: stage.id,
                  label: stage.name,
                }))}
                placeholder="Pilih tahapan pipeline"
              />
              <FormInput name="source" label="Source" className="col-span-1" />
              <div className="col-span-2">
                <FormTextarea name="notes" label="Notes" rows={3} />
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
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

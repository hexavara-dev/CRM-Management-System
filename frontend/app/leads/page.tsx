"use client";
import { AppSidebar } from "@/components/Sidebar";
import { LeadsPipelineTab, type LeadDateRange } from "@/app/leads/components/leads-pipeline-tab";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLeadsTable } from "@/hooks/use-leads-table";
import { useLeadLabels } from "@/hooks/use-lead-labels";
import { useLeadCampaigns } from "@/hooks/use-lead-campaigns";
import { useLocations } from "@/hooks/use-locations";
import { useProject, useProjects } from "@/hooks/use-projects";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { ConvertDealFormData } from "@/schemas/convert.schema";
import { LeadCreateFormData, LeadCreateFormInput, LeadFormData, LeadFormInput, leadCreateFormSchema, leadFormSchema } from "@/schemas/lead.schema";
import { Lead } from "@/types/lead";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  CircleDollarSign,
  Columns3,
  Clock3,
  Crosshair,
  Home,
  Info,
  List,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Save,
  Search,
  Upload,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-provider";
import { useUsers } from "@/hooks/use-users";
import { useSources } from "@/hooks/use-sources";
import { LabelBadge } from "@/app/crm-configuration/leads-label/label-icons";
import { LeadLabelMultiSelect } from "@/app/leads/components/lead-label-multi-select";

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
      (new Date().setHours(0, 0, 0, 0) -
        new Date(value).setHours(0, 0, 0, 0)) /
        86_400_000,
    ),
  );

const getNextFollowUp = (lead: Lead) => {
  const dates =
    lead.activities?.flatMap((activity) =>
      (activity.tasks ?? [])
        .map((task) => task.dueDate)
        .filter((date): date is string => Boolean(date)),
    ) ?? [];
  return dates.sort((a, b) => +new Date(a) - +new Date(b))[0];
};

export default function LeadsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [prospectFilter, setProspectFilter] = useState("all");
  const [pipelineDateRange, setPipelineDateRange] = useState<LeadDateRange>(() => {
    const now = new Date();
    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      from: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  });
  const deferredSearch = useDeferredValue(search.trim());

  const {
    leads,
    isLoading,
    createLead,
    updateLead,
    convertToDeal,
    isConverting,
    serverPagination,
  } = useLeadsTable({
    filters: {
      search: deferredSearch || undefined,
      stageId: stageFilter === "all" ? undefined : stageFilter,
      assignedUserId: salesFilter === "all" ? undefined : salesFilter,
      sourceId: sourceFilter === "all" ? undefined : sourceFilter,
      labelId:
        prospectFilter === "all" ? undefined : prospectFilter,
    },
  });
  const { user } = useAuth();

  const pipelineStagesQuery = usePipelineStages("lead");
  const stages = (pipelineStagesQuery.data ?? []).filter((stage) => stage.isActive);
  const { locations } = useLocations();
  const { users } = useUsers();
  const { sources } = useSources({
    additionalParams: {
      type: "lead",
    },
  });
  const leadLabelsQuery = useLeadLabels(undefined, 1, 100);
  const leadLabels = (leadLabelsQuery.data?.data ?? []).filter(
    (label) => label.isActive,
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const router = useRouter();


  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        id: "name",
        header: "Lead",
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
        accessorFn: (row) => row.customer.phoneNumber || "-",
      },
      {
        id: "project",
        header: "Project Diminati",
        accessorFn: (row) => row.project?.name || row.location?.name || "-",
        cell: ({ row }) =>
          row.original.project?.name || row.original.location?.name ? (
            <span className="whitespace-nowrap rounded-md bg-[#E7F0FF] px-2 py-1 text-xs font-medium text-[#0B63F6]">
              {row.original.project?.name || row.original.location?.name}
            </span>
          ) : (
            "-"
          ),
      },
      {
        id: "source",
        header: "Asal Leads",
        accessorFn: (row) => row.source?.name || "-",
      },
      {
        id: "prospect",
        header: "Prospek",
        accessorFn: (row) => row.labels?.map((label) => label.name).join(", ") || "-",
        cell: ({ row }) =>
          row.original.labels?.length ? (
            <div className="flex min-w-52 flex-wrap gap-1.5">
              {row.original.labels.map((label) => (
                <LabelBadge
                  key={label.id}
                  name={label.name}
                  color={label.color}
                  icon={label.icon}
                />
              ))}
            </div>
          ) : (
            "-"
          ),
      },
      {
        id: "createdAt",
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
        accessorFn: (row) => row.assignedUser?.name || "-",
      },
      {
        id: "lastUpdate",
        header: "Last Update",
        accessorFn: (row) => getLastUpdate(row),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatLeadDate(getLastUpdate(row.original))}
          </span>
        ),
      },
      {
        id: "days",
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
            <span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs ${tone}`}>
              {days} hari
            </span>
          );
        },
      },
      {
        id: "nextFollowUp",
        header: "Next Follow-up",
        accessorFn: (row) => getNextFollowUp(row) || "",
        cell: ({ row }) => {
          const next = getNextFollowUp(row.original);
          return next ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <CalendarDays className="size-3.5" /> {formatLeadDate(next)}
            </span>
          ) : (
            "-"
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
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
              >
                <Pencil className="h-4 w-4 text-[#141B34]" />
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

  const addForm = useForm<LeadCreateFormInput, unknown, LeadCreateFormData>({
    resolver: zodResolver(leadCreateFormSchema),
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
      age: undefined,
      projectId: "",
      productVariantId: "",
      campaignId: "",
      budget: undefined,
      createDeal: false,
      assignedUserId: "",
      sourceId: "",
      labelIds: [],
      priority: "MEDIUM",
    },
  });
  const selectedLeadSourceId = addForm.watch("sourceId");
  const selectedProjectId = addForm.watch("projectId");
  const createDeal = addForm.watch("createDeal") ?? false;
  const projectsQuery = useProjects({ page: 1, limit: 100, isActive: true });
  const selectedProjectQuery = useProject(selectedProjectId || undefined);
  const campaignsQuery = useLeadCampaigns(selectedLeadSourceId || undefined);
  const campaigns = (campaignsQuery.data ?? []).filter((campaign) => campaign.isActive);
  const projectOptions = (projectsQuery.data?.data ?? []).map((project) => ({
    value: project.id,
    label: project.name,
  }));
  const productVariantOptions = (selectedProjectQuery.data?.variants ?? []).map((variant) => ({
    value: variant.id,
    label: variant.name,
  }));

  useEffect(() => {
    addForm.setValue("productVariantId", "");
  }, [addForm, selectedProjectId]);

  useEffect(() => {
    addForm.setValue("campaignId", "");
  }, [addForm, selectedLeadSourceId]);

  useEffect(() => {
    if (user?.id && !addForm.getValues("assignedUserId")) {
      addForm.setValue("assignedUserId", user.id);
    }
  }, [addForm, user?.id]);

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

  const convertForm = useForm({
    defaultValues: {
      expectedAmount: 0,
      currency: "IDR",
    },
  });

  const onSubmitAdd = async (data: LeadCreateFormData) => {
    try {
      await createLead({
        ...data,
        assignedUserId:
          user?.role === "owner"
            ? data.assignedUserId || user.id
            : user?.id,
      });
      addForm.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add lead:", error);
    }
  };

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

  const onSubmitConvert = async (data: ConvertDealFormData) => {
    if (selectedLead) {
      try {
        await convertToDeal({
          id: selectedLead.id,
          dealData: { ...data, currency: "IDR" },
        });
        setIsConvertDialogOpen(false);
        setSelectedLead(null);
      } catch (error) {
        console.error("Failed to convert lead:", error);
      }
    }
  };

  // const handleEdit = (lead: Lead) => {
  //   setSelectedLead(lead);
  //   editForm.reset({
  //     salutation: lead.customer.salutation || "",
  //     gender: lead.customer.gender || "",
  //     firstName: lead.customer.firstName,
  //     lastName: lead.customer.lastName || "",
  //     email: lead.customer.email || "",
  //     phone: lead.customer.phoneNumber || "",
  //     organizationName: lead.customer.organization?.name || "",
  //     organizationLocation: lead.customer.organization?.location || "",
  //     locationId:
  //       lead.locationId || getLocationIdByName(lead.customer.location || ""),
  //     company: lead.customer.organization?.name || "",
  //     statusId: lead.status?.id || "",
  //     source: lead.type || "",
  //     notes: "",
  //   });
  //   setIsEditDialogOpen(true);
  // };

  // const handleOpenConvert = (lead: Lead) => {
  //   setSelectedLead(lead);
  //   convertForm.reset({
  //     expectedAmount: 0,
  //     currency: "USD",
  //   });
  //   setIsConvertDialogOpen(true);
  // };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Leads</h1>
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
                <Button onClick={() => {
                  addForm.reset();
                  if (user?.id) addForm.setValue("assignedUserId", user.id);
                }}>
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
                      <DialogTitle className="text-xl font-bold tracking-tight text-[#121B41]">Add New Lead</DialogTitle>
                      <DialogDescription className="mt-1 text-xs text-[#667085]">
                        Tambah data prospek baru ke dalam sistem CRM.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="flex h-full min-h-0 flex-col overflow-hidden"
                  >
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
                      <div className="grid gap-3 lg:grid-cols-2">
                        <section className="rounded-xl border border-[#D9E6FA] bg-white p-4 shadow-[0_2px_8px_rgba(44,95,180,0.04)]">
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#142047]"><UserRound className="size-4 text-[#0B63F6]" />Informasi Personal</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="relative sm:col-span-2"><UserRound className="pointer-events-none absolute bottom-2.5 left-3 z-10 size-4 text-[#5C78A9]" /><FormInput name="firstName" label="Nama Lengkap *" placeholder="Masukkan nama lengkap..." className="border-[#C9D9F3] pl-9" /></div>
                            <FormSelect name="gender" label="Jenis Kelamin" options={[{ value: "male", label: "Laki-laki" }, { value: "female", label: "Perempuan" }]} placeholder="Pilih jenis kelamin" className="border-[#C9D9F3]" />
                            <FormInput name="age" label="Umur" type="number" min={0} max={120} placeholder="Contoh: 30" className="border-[#C9D9F3]" />
                          </div>
                        </section>
                        <section className="rounded-xl border border-[#D9E6FA] bg-white p-4 shadow-[0_2px_8px_rgba(44,95,180,0.04)]">
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#142047]"><Phone className="size-4 text-[#0B63F6]" />Informasi Kontak</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="relative"><Phone className="pointer-events-none absolute bottom-2.5 left-3 z-10 size-4 text-[#5C78A9]" /><FormInput name="phone" label="Nomor Handphone *" placeholder="Contoh: 812 3456 7890" className="border-[#C9D9F3] pl-9" /></div>
                            <div className="relative"><Mail className="pointer-events-none absolute bottom-2.5 left-3 z-10 size-4 text-[#5C78A9]" /><FormInput name="email" label="Email" type="email" placeholder="Masukkan email..." className="border-[#C9D9F3] pl-9" /></div>
                            <div className="relative sm:col-span-2"><MapPin className="pointer-events-none absolute bottom-2.5 left-3 z-10 size-4 text-[#5C78A9]" /><FormInput name="location" label="Alamat" placeholder="Masukkan alamat lengkap..." className="border-[#C9D9F3] pl-9" /></div>
                          </div>
                        </section>
                      </div>

                      <section className="rounded-xl border border-[#D9E6FA] bg-white p-4 shadow-[0_2px_8px_rgba(44,95,180,0.04)]">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#142047]"><Home className="size-4 text-[#0B63F6]" />Minat &amp; Kebutuhan</h3>
                        <div className="grid gap-3 md:grid-cols-3">
                          <FormSelect name="projectId" label="Project Diminati" placeholder="Pilih project" options={projectOptions} isLoading={projectsQuery.isLoading} disabled={projectOptions.length === 0} className="border-[#C9D9F3]" />
                          <FormSelect name="productVariantId" label="Tipe Rumah" placeholder={selectedProjectId ? "Pilih tipe rumah" : "Pilih project dahulu"} options={productVariantOptions} isLoading={selectedProjectQuery.isLoading} disabled={!selectedProjectId || productVariantOptions.length === 0} className="border-[#C9D9F3]" />
                          <div className="relative"><CircleDollarSign className="pointer-events-none absolute bottom-2.5 left-3 z-10 size-4 text-[#5C78A9]" /><FormInput name="budget" label="Budget Pembelian" currency placeholder="Contoh: Rp 550.000.000" className="border-[#C9D9F3] pl-9" /></div>
                          <div className="md:col-span-3"><FormTextarea name="notes" label="Catatan Kebutuhan / Preferensi" placeholder="Contoh: Tertarik dengan rumah 1 lantai, area dekat fasilitas umum, dan sedang menyiapkan KPR..." rows={2} className="border-[#C9D9F3]" /></div>
                        </div>
                      </section>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <section className="rounded-xl border border-[#D9E6FA] bg-white p-4 shadow-[0_2px_8px_rgba(44,95,180,0.04)]">
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#142047]"><Crosshair className="size-4 text-[#0B63F6]" />Sumber Lead</h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <FormSelect name="sourceId" label="Sumber Lead *" placeholder="Pilih sumber lead" options={sources.map((source) => ({ value: source.id, label: source.name }))} disabled={sources.length === 0} className="border-[#C9D9F3]" />
                            <FormSelect name="campaignId" label="Campaign (opsional)" placeholder={selectedLeadSourceId ? "Pilih campaign" : "Pilih sumber dahulu"} options={campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name || "Campaign tanpa nama" }))} isLoading={campaignsQuery.isLoading} disabled={!selectedLeadSourceId || campaigns.length === 0} className="border-[#C9D9F3]" />
                          </div>
                        </section>
                        <section className="rounded-xl border border-[#D9E6FA] bg-white p-4 shadow-[0_2px_8px_rgba(44,95,180,0.04)]">
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#142047]"><UsersRound className="size-4 text-[#0B63F6]" />Penugasan &amp; Pipeline</h3>
                          <div className="grid gap-3 lg:grid-cols-3">
                            <FormSelect name="assignedUserId" label="Assigned Sales *" placeholder="Pilih sales" options={(user?.role === "owner" ? users : user ? [user] : []).map((sales) => ({ value: sales.id, label: sales.name || sales.email || "User" }))} disabled={user?.role !== "owner" || users.length === 0} className="border-[#C9D9F3]" />
                            <FormSelect name="stageId" label="Tahapan Pipeline *" placeholder="Pilih tahapan pipeline" options={stages.map((stage) => ({ value: stage.id, label: stage.name }))} disabled={stages.length === 0} className="border-[#C9D9F3]" />
                            <LeadLabelMultiSelect label="Status Qualified" className="col-span-1" labels={leadLabels} isLoading={leadLabelsQuery.isLoading} />
                          </div>
                        </section>
                      </div>
                    </div>
                    <DialogFooter className="mt-auto shrink-0 -mx-0 -mb-0 rounded-none border-[#DCE7F8] bg-white px-5 py-3 sm:px-6">
                      <label className="mr-auto flex cursor-pointer items-start gap-2 text-left"><input type="checkbox" checked={createDeal} onChange={(event) => addForm.setValue("createDeal", event.target.checked, { shouldDirty: true })} className="mt-0.5 size-4 rounded border-[#AFC4E7] text-[#0B63F6]" /><span><span className="flex items-center gap-1 text-xs font-semibold text-[#243B6B]">Buat Deal Sekaligus <Info className="size-3 text-[#6C83AD]" /></span><span className="block text-[10px] text-[#667085]">Lead dan Deal dibuat dalam satu transaksi.</span></span></label>
                      <Button type="button" variant="outline" className="border-[#C9D9F3]" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" className="bg-[#0B63F6] px-5 hover:bg-[#0755D6]"><Save className="size-4" />Save Lead</Button>
                    </DialogFooter>
                  </form>
                </FormProvider>
              </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <div className="min-w-0 bg-[#FAFBFC] p-4">
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList className="h-11 w-fit overflow-hidden rounded-xl border border-[#E4E7EC] bg-[#F3F5F8] p-1 shadow-sm">
              <TabsTrigger
                value="list"
                className="h-9 gap-2 rounded-lg px-5 text-base font-medium text-[#667085] transition-all data-[state=active]:bg-white data-[state=active]:text-[#0B63F6] data-[state=active]:shadow-sm"
              >
                <List className="size-4" />
                List Leads
              </TabsTrigger>
              <TabsTrigger
                value="pipeline"
                className="h-9 gap-2 rounded-lg px-5 text-base font-medium text-[#667085] transition-all data-[state=active]:bg-white data-[state=active]:text-[#0B63F6] data-[state=active]:shadow-sm"
              >
                <Columns3 className="size-4" />
                Pipeline
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0">
              <Card className="gap-0 rounded-xl py-0 shadow-none">
                <CardHeader className="px-4 pt-4 pb-3">
                  <CardTitle className="text-xl font-semibold pb-2">Leads Management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(230px,1.4fr)_repeat(5,minmax(140px,1fr))]">
                    <label className="space-y-1">
                      <span aria-hidden="true" className="invisible block text-xs font-medium">
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
                      <Select disabled value="all">
                        <SelectTrigger aria-label="Filter project">
                          <SelectValue placeholder="Semua Project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Project</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">Tahapan Pipeline</span>
                      <Select value={stageFilter} onValueChange={setStageFilter}>
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
                      <Select value={prospectFilter} onValueChange={setProspectFilter}>
                        <SelectTrigger aria-label="Filter prospek">
                          <SelectValue placeholder="Semua Prospek" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Prospek</SelectItem>
                          {leadLabels.map((label) => (
                            <SelectItem key={label.id} value={label.id}>
                              <span className="inline-flex items-center gap-2">
                                <LabelBadge name={label.name} color={label.color} icon={label.icon} />
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-xs font-medium">Assigned Sales</span>
                      <Select value={salesFilter} onValueChange={setSalesFilter} disabled={user?.role !== "owner"}>
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
                      <span className="block text-xs font-medium">Asal Leads</span>
                      <Select value={sourceFilter} onValueChange={setSourceFilter}>
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
                  <DataTable
                    columns={columns}
                    data={leads}
                    isLoading={isLoading}
                    serverPagination={serverPagination}
                    showColumnSelector={false}
                    tableHeaderClassName="bg-slate-200 text-slate-700"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pipeline">
              <Card className="gap-0 rounded-xl py-0 shadow-none">
                <CardHeader className="flex flex-row items-end justify-between gap-4 px-4 pt-4 pb-3">
                  <CardTitle className="pb-2 text-xl font-semibold">Leads Pipeline</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium whitespace-nowrap">Periode Leads</span>
                    <Input
                      type="date"
                      aria-label="Tanggal mulai periode Leads"
                      value={pipelineDateRange.from}
                      onChange={(event) => setPipelineDateRange((current) => ({ ...current, from: event.target.value }))}
                      className="w-40"
                    />
                    <span className="text-sm text-muted-foreground">s/d</span>
                    <Input
                      type="date"
                      aria-label="Tanggal akhir periode Leads"
                      value={pipelineDateRange.to}
                      min={pipelineDateRange.from || undefined}
                      onChange={(event) => setPipelineDateRange((current) => ({ ...current, to: event.target.value }))}
                      className="w-40"
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <LeadsPipelineTab dateRange={pipelineDateRange} />
                  </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>

      {/* Edit Dialog */}
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

      {/* Convert Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert to Deal</DialogTitle>
            <DialogDescription>
              Convert this lead into an active deal.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...convertForm}>
            <form
              onSubmit={convertForm.handleSubmit(onSubmitConvert)}
              className="grid gap-4 py-4"
            >
              <FormInput
                name="expectedAmount"
                label="Expected Amount"
                currency
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConvertDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isConverting}>
                  {isConverting ? "Converting..." : "Convert to Deal"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

    </SidebarProvider>
  );
}

"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Typography from "@/components/Typography";
import { useAuth } from "@/components/auth/auth-provider";
import { useActivities } from "@/hooks/use-activities";
import { useLeadDetail, useLeads } from "@/hooks/use-leads";
import { type ArchiveCategory, useLeadArchive } from "@/hooks/use-lead-archive";
import { useLeadLabels } from "@/hooks/use-lead-labels";
import { useLocations } from "@/hooks/use-locations";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useSources } from "@/hooks/use-sources";
import { useUpload } from "@/hooks/use-upload";
import { useUsers } from "@/hooks/use-users";
import { Attachment } from "@/lib/data";
import { LeadFormData, LeadFormInput, leadFormSchema } from "@/schemas/lead.schema";
import { AttachmentRecord } from "@/types/activity";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LeadHeader } from "./components/lead-header";
import { LeadSummary } from "./components/lead-summary";
import { LeadTabs } from "./components/lead-tabs";
import { ConvertDealFormData } from "@/schemas/convert.schema";
import { LeadLabelMultiSelect } from "../components/lead-label-multi-select";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lead, isLoading } = useLeadDetail(params.id);
  const { user } = useAuth();
  const { createLeadActivity } = useActivities();
  const { updateLead, isUpdating, convertToDeal, isConverting } = useLeads();
  const { archiveLead, isMutating: isArchiving } = useLeadArchive({ page: 1, limit: 10 });
  const pipelineStages = usePipelineStages("lead");
  const stages = (pipelineStages.data ?? []).filter((stage) => stage.isActive);
  const { locations } = useLocations();
  const { users } = useUsers();
  const { sources } = useSources({
    additionalParams: {
      type: "lead",
    },
  });
  const leadLabelsQuery = useLeadLabels(undefined, 1, 100);
  const assignedLabelIds = new Set(lead?.labels?.map((label) => label.id) ?? []);
  const leadLabels = (leadLabelsQuery.data?.data ?? []).filter(
    (label) => label.isActive || assignedLabelIds.has(label.id),
  );
  const { uploadFile } = useUpload();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [archiveCategory, setArchiveCategory] = useState<ArchiveCategory>("NOT_RESPOND");
  const [archiveReason, setArchiveReason] = useState("");

  const attachments = useMemo(() => (lead?.attachments || []).map(
      (att: AttachmentRecord) => ({
        id: att.id,
        entityType: "lead" as const,
        entityId: lead?.id || "",
        name: att.fileName || att.name || "",
        fileUrl: att.fileUrl,
        fileType: att.fileType || "application/octet-stream",
        fileSize: att.fileSize || 0,
        uploadedAt: new Date(att.createdAt),
      }),
    ), [lead]) as Attachment[];

  const editForm = useForm<LeadFormInput, unknown, LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      salutation: "",
      gender: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      organizationName: "",
      organizationLocation: "",
      location: "",
      company: "",
      stageId: "",
      source: "",
      notes: "",
      labelIds: [],
      priority: "MEDIUM",
    },
  });

  const convertForm = useForm<ConvertDealFormData>({
    defaultValues: {
      expectedAmount: 0,
    },
  });

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

  const handleOpenEdit = () => {
    if (lead) {
      editForm.reset({
        salutation: lead.customer.salutation || "",
        gender: lead.customer.gender || "",
        firstName: lead.customer.firstName,
        lastName: lead.customer.lastName || "",
        email: lead.customer.email || "",
        phone: lead.customer.phoneNumber || "",
        organizationName: lead.customer.organization?.name || "",
        organizationLocation: lead.customer.organization?.location || "",
        locationId: lead.locationId || "",
        assignedUserId: lead.assignedUser?.id || "",
        stageId: lead.stageId || "",
        sourceId: lead.source?.id || "",
        labelIds: lead.labels?.map((label) => label.id) ?? [],
        priority: lead.priority ?? "MEDIUM",
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleOpenConvert = () => {
    if (lead) {
      convertForm.reset({
        expectedAmount: 0,
      });
      setIsConvertDialogOpen(true);
    }
  };

  const onSubmitConvert = async (data: ConvertDealFormData) => {
    if (!lead) return;

    const parsedAmount =
      typeof data.expectedAmount === "number"
        ? data.expectedAmount
        : Number(String(data.expectedAmount ?? "").replace(/\D/g, "")) || 0;

    try {
      await convertToDeal({
        id: lead.id,
        dealData: {
          expectedAmount: parsedAmount,
          currency: "IDR",
        },
      });
      setIsConvertDialogOpen(false);
    } catch (error) {
      console.error("Failed to convert lead:", error);
    }
  };

  const onSubmitEdit = async (data: LeadFormData) => {
    try {
      await updateLead({
        id: params.id,
        data: {
          ...data,
          location: getLocationNameById(data.locationId),
          assignedUserId:
            user?.role === "owner" ? data.assignedUserId : undefined,
        },
      });
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Failed to update lead:", error);
    }
  };

  const handleAddActivity = async (data: { type: string; description: string }) => {
    try {
      await createLeadActivity({
        leadId: params.id,
        activityType: data.type,
        notes: {
          create: {
            title: data.type,
            content: data.description,
          },
        },
      });
    } catch (error) {
      console.error("Failed to add activity:", error);
      throw error;
    }
  };

  const handleArchive = async () => {
    try {
      await archiveLead({ id: params.id, category: archiveCategory, reason: archiveReason });
      setIsArchiveDialogOpen(false);
      router.push("/leads/archive");
    } catch (error) {
      console.error("Failed to archive lead:", error);
    }
  };

  const handleAddAttachment = async (data: {
    name: string;
    file: FileList;
  }) => {
    if (!lead?.id || !data.file[0]) return;
    try {
      await uploadFile({
        leadId: lead.id,
        file: data.file[0],
        name: data.name,
      });
    } catch (error) {
      console.error("Failed to upload attachment:", error);
    }
  };

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-full">
            <p>Loading lead...</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!lead) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-full">
            <p>Lead not found</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-full flex-col">
          <LeadHeader
            lead={lead}
            onEditClick={handleOpenEdit}
            onConvertClick={handleOpenConvert}
            onArchiveClick={() => setIsArchiveDialogOpen(true)}
          />
          <div className="flex-1 overflow-y-auto bg-[#FAFBFC] p-4">
            <div className="mx-auto max-w-[1500px] space-y-3">
              <LeadSummary lead={lead} />
              <LeadTabs lead={lead} stages={pipelineStages.data ?? []} attachments={attachments} onAddActivity={handleAddActivity} onAddAttachment={handleAddAttachment} />
            </div>
          </div>
        </div>
      </SidebarInset>

      <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arsipkan Lead</DialogTitle><DialogDescription>Lead akan disembunyikan dari daftar aktif. Data aktivitas dan dokumen tetap tersimpan.</DialogDescription></DialogHeader>
          <label className="grid gap-1 text-sm font-medium">Kategori Arsip
            <select value={archiveCategory} disabled={isArchiving} onChange={(event) => setArchiveCategory(event.target.value as ArchiveCategory)} className="h-9 rounded-md border bg-background px-2">
              <option value="NOT_RESPOND">Not Respond</option><option value="INVALID">Invalid</option><option value="NOT_QUALIFIED">Not Qualified</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">Alasan (opsional)
            <textarea value={archiveReason} maxLength={500} disabled={isArchiving} onChange={(event) => setArchiveReason(event.target.value)} className="min-h-24 rounded-md border p-2 text-sm" />
            <span className="text-right text-xs text-muted-foreground">{archiveReason.length}/500</span>
          </label>
          <DialogFooter><Button variant="outline" disabled={isArchiving} onClick={() => setIsArchiveDialogOpen(false)}>Batal</Button><Button variant="destructive" disabled={isArchiving} onClick={() => void handleArchive()}>{isArchiving ? "Mengarsipkan..." : "Arsipkan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-5xl">
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
              <div className="grid grid-cols-2 gap-4 h-max">
                <div className="border-b pb-1.5 col-span-2">
                  <Typography as="h3" weight="medium" color="black">
                    Biodata
                  </Typography>
                </div>
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
                  placeholder="First Name"
                  className="col-span-1"
                />
                <FormInput
                  name="lastName"
                  label="Last Name"
                  placeholder="Last Name"
                  className="col-span-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 h-max">
                <div className="border-b pb-1.5 col-span-2">
                  <Typography as="h3" weight="medium" color="black">
                    Contacts
                  </Typography>
                </div>
                <FormInput
                  name="email"
                  label="Email"
                  type="email"
                  placeholder="email@example.com"
                  className="col-span-1"
                />
                <FormInput
                  name="phone"
                  label="Phone"
                  placeholder="+62 xxx xxxx xxxx"
                  className="col-span-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 h-max">
                <div className="border-b pb-1.5 col-span-2">
                  <Typography as="h3" weight="medium" color="black">
                    Organizations (Optional)
                  </Typography>
                </div>
                <FormInput
                  name="organizationName"
                  label="Organization Name"
                  placeholder="Company Name"
                  className="col-span-1"
                />
                <FormInput
                  name="organizationLocation"
                  label="Organization Location"
                  placeholder="Input Adress"
                  className="col-span-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 h-max">
                <div className="border-b pb-1.5 col-span-2">
                  <Typography as="h3" weight="medium" color="black">
                    Additional Info
                  </Typography>
                </div>
                <FormSelect
                  name="locationId"
                  label="Unit"
                  placeholder="Select location"
                  className="col-span-1"
                  options={locationOptions}
                  disabled={locationOptions.length === 0}
                />

                {user?.role === "owner" && (
                  <FormSelect
                    name="assignedUserId"
                    label="Assigned Sales"
                    placeholder="Select sales"
                    className="col-span-1"
                    options={users.map((u) => ({
                      value: u.id,
                      label: u.name,
                    }))}
                    disabled={users.length === 0}
                  />
                )}

                <FormSelect
                  name="stageId"
                  label="Tahapan Pipeline"
                  className="col-span-1"
                  options={stages.map((stage) => ({
                    value: stage.id,
                    label: stage.name,
                  }))}
                  placeholder="Pilih tahapan pipeline"
                  disabled={stages.length === 0}
                />
                <FormSelect
                  name="sourceId"
                  label="Source"
                  placeholder="Select source"
                  className="col-span-1"
                  options={sources.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  disabled={sources.length === 0}
                />
                <FormSelect
                  name="priority"
                  label="Prioritas"
                  className="col-span-1"
                  options={[
                    { value: "LOW", label: "Rendah" },
                    { value: "MEDIUM", label: "Sedang" },
                    { value: "HIGH", label: "Tinggi" },
                  ]}
                  placeholder="Pilih prioritas"
                />
                <LeadLabelMultiSelect
                  labels={leadLabels}
                  isLoading={leadLabelsQuery.isLoading}
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

      {/*   l Dialog */}
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
              className="grid grid-cols-2 gap-4 py-4"
            >
              <div className="flex items-center gap-5">
                <FormInput
                  name="expectedAmount"
                  label="Amount"
                  currency
                  placeholder="15000000"
                  className="col-span-1"
                />
                <p>IDR</p>
              </div>
              <div className="col-span-2">
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
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

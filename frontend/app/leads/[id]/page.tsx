"use client";

import { AppSidebar } from "@/components/Sidebar";
import Typography from "@/components/Typography";
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
import { FormInput } from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useActivities } from "@/hooks/use-activities";
import { useDealUnits } from "@/hooks/use-deals";
import { useFinancingBanks } from "@/hooks/use-financing-banks";
import { useArchiveLeadAction } from "@/hooks/use-lead-archive";
import { useLeadLabels } from "@/hooks/use-lead-labels";
import { useActiveLeadSources } from "@/hooks/use-lead-sources";
import { useLeadDetail, useLeads } from "@/hooks/use-leads";
import { useLocations } from "@/hooks/use-locations";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useUsers } from "@/hooks/use-users";
import { Attachment } from "@/lib/data";
import {
  ConvertDealFormData,
  convertDealSchema,
} from "@/schemas/convert.schema";
import {
  LeadFormData,
  LeadFormInput,
  leadFormSchema,
} from "@/schemas/lead.schema";
import { AttachmentRecord } from "@/types/activity";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LeadLabelMultiSelect } from "../components/lead-label-multi-select";
import { LeadHeader } from "./components/lead-header";
import { LeadSummary } from "./components/lead-summary";
import { LeadTabs } from "./components/lead-tabs";
import { activityTypeLabel } from "./components/tabs/activities-tab";
import { formatDate } from "@/lib/helper";
import { LeadArchiveDialog } from "../components/lead-archive-dialog";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: lead, isLoading } = useLeadDetail(params.id);
  const { user } = useAuth();
  const { createLeadActivity } = useActivities();
  const { updateLead, isUpdating, convertToDeal, isConverting } = useLeads();
  const { archiveLead, isArchiving } = useArchiveLeadAction();
  const pipelineStages = usePipelineStages("lead");
  const stages = (pipelineStages.data ?? []).filter((stage) => stage.isActive);
  const { locations } = useLocations();
  const { users } = useUsers();
  const { sources } = useActiveLeadSources();
  const leadLabelsQuery = useLeadLabels(undefined, 1, 100);
  const assignedLabelIds = new Set(
    lead?.labels?.map((label) => label.id) ?? [],
  );
  const leadLabels = (leadLabelsQuery.data?.data ?? []).filter(
    (label) => label.isActive || assignedLabelIds.has(label.id),
  );
  const dealUnitsQuery = useDealUnits(lead?.projectId);
  const { data: financingBanks = [] } = useFinancingBanks(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const attachments = useMemo(
    () =>
      (lead?.attachments || []).map((att: AttachmentRecord) => {
        const activity = att.leadActivityId
          ? lead?.activities?.find((item) => item.id === att.leadActivityId)
          : undefined;
        return {
          id: att.id,
          entityType: "lead" as const,
          entityId: lead?.id || "",
          name: att.fileName || att.name || "",
          fileUrl: att.fileUrl,
          fileType: att.fileType || "application/octet-stream",
          fileSize: att.fileSize || 0,
          uploadedAt: new Date(att.createdAt),
          uploadedByName: att.uploadedBy?.name || undefined,
          activityLabel: activity
            ? `${activityTypeLabel(activity.activityType)} · ${formatDate(new Date(activity.activityDate ?? activity.createdAt))}`
            : undefined,
        };
      }),
    [lead],
  ) as Attachment[];

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
    resolver: zodResolver(convertDealSchema),
    defaultValues: {
      expectedAmount: 0,
      unitId: "",
      paymentMethod: "CASH",
      financingBankId: "",
      notes: "",
    },
  });
  const convertPaymentMethod = convertForm.watch("paymentMethod");

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
        unitId: "",
        paymentMethod: "CASH",
        financingBankId: "",
        notes: "",
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
          unitId: data.unitId,
          paymentMethod: data.paymentMethod,
          financingBankId:
            data.paymentMethod === "CASH" ? undefined : data.financingBankId,
          notes: data.notes,
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

  const handleAddActivity = async (data: {
    type: string;
    description: string;
    activityDate: string;
  }) => {
    try {
      return await createLeadActivity({
        leadId: params.id,
        activityType: data.type,
        activityDate: data.activityDate,
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
              <LeadTabs
                lead={lead}
                stages={pipelineStages.data ?? []}
                attachments={attachments}
                onAddActivity={handleAddActivity}
              />
            </div>
          </div>
        </div>
      </SidebarInset>

      <LeadArchiveDialog
        open={isArchiveDialogOpen}
        leadName={`${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim()}
        isSubmitting={isArchiving}
        onOpenChange={setIsArchiveDialogOpen}
        onSubmit={async ({ category, reason }) => {
          await archiveLead({ id: params.id, category, reason });
          router.push("/leads/archive");
        }}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update the lead information below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <form
                id="edit-lead-form"
                onSubmit={editForm.handleSubmit(onSubmitEdit)}
                className="grid grid-cols-2 items-start gap-x-6 gap-y-4"
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
              </form>
            </div>
            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" form="edit-lead-form" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </FormProvider>
        </DialogContent>
      </Dialog>

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
              <FormSelect
                name="unitId"
                label="Project / Unit"
                placeholder={
                  lead?.projectId ? "Pilih unit" : "Lead belum memiliki project"
                }
                options={(dealUnitsQuery.data ?? []).map((unit) => ({
                  value: unit.id,
                  label: `${unit.code} - ${unit.variant.name} (${unit.status})`,
                }))}
                isLoading={dealUnitsQuery.isLoading}
                disabled={!lead?.projectId || dealUnitsQuery.isLoading}
              />
              <FormSelect
                name="paymentMethod"
                label="Jenis Pembayaran"
                placeholder="Pilih jenis pembayaran"
                options={[
                  { value: "CASH", label: "Tunai" },
                  { value: "KPR", label: "KPR" },
                  { value: "KPR_SHARIA", label: "KPR Syariah" },
                ]}
              />
              {convertPaymentMethod !== "CASH" && (
                <FormSelect
                  name="financingBankId"
                  label="Bank Pembiayaan"
                  placeholder="Pilih bank"
                  options={financingBanks.map((bank) => ({
                    value: bank.id,
                    label: bank.name,
                  }))}
                  disabled={financingBanks.length === 0}
                />
              )}
              <div className="col-span-2">
                <FormInput
                  name="notes"
                  label="Catatan Deal"
                  placeholder="Catatan awal Deal (opsional)"
                />
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

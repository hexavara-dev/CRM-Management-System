"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
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
import { useLocations } from "@/hooks/use-locations";
import { useSources } from "@/hooks/use-sources";
import { useTasks } from "@/hooks/use-tasks";
import { useStatuses } from "@/hooks/use-statuses";
import { useUpload } from "@/hooks/use-upload";
import { useUsers } from "@/hooks/use-users";
import {
  Activity,
  Attachment,
  CallLog as CallLogData,
  Note as NoteData,
  Task as TaskData,
} from "@/lib/data";
import { TaskFormData } from "@/schemas/deal.schema";
import { LeadFormData, leadFormSchema } from "@/schemas/lead.schema";
import {
  AttachmentRecord,
  CallLog,
  LeadActivity,
  Note,
  Task,
} from "@/types/activity";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LeadDetailsSidebar } from "./components/lead-details-sidebar";
import { LeadHeader } from "./components/lead-header";
import { LeadTabs } from "./components/lead-tabs";
import { ConvertDealFormData } from "@/schemas/convert.schema";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  // const router = useRouter();
  const { data: lead, isLoading } = useLeadDetail(params.id);
  const { user } = useAuth();
  const { createLeadActivity } = useActivities();
  const { updateLead, isUpdating, convertToDeal, isConverting } = useLeads();
  const { updateTask, deleteTask } = useTasks();
  const { statuses } = useStatuses({
    additionalParams: {
      type: "lead",
    },
  });
  const { locations } = useLocations();
  const { users } = useUsers();
  const { sources } = useSources({
    additionalParams: {
      type: "lead",
    },
  });
  const { uploadFile } = useUpload();

  const [isTaskDeleteDialogOpen, setIsTaskDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  const { callLogs, activities, tasks, notes, attachments } = useMemo(() => {
    if (!lead?.activities) {
      return {
        callLogs: [] as CallLogData[],
        activities: [] as Activity[],
        tasks: [] as TaskData[],
        notes: [] as NoteData[],
        attachments: [] as Attachment[],
      };
    }

    type CallLogWithActivityId = CallLog & {
      activityId: string;
      leadId?: string;
    };
    type TaskWithActivityId = Task & { activityId: string };
    type NoteWithActivityId = Note & { activityId: string; createdAt: string };

    const mappedCallLogs: CallLogData[] = lead.activities
      .flatMap((a: LeadActivity) =>
        (a.callLogs || []).map(
          (c: CallLog): CallLogWithActivityId => ({ ...c, activityId: a.id }),
        ),
      )
      .map(
        (c: CallLogWithActivityId): CallLogData => ({
          id: c.id,
          entityType: "lead",
          entityId: c.activityId,
          leadId: c.activityId,
          type: "outgoing" as const,
          status: "completed" as const,
          duration: c.duration ? Math.floor(c.duration / 1000) : 0,
          notes: c.description,
          createdAt: new Date(c.startDate || lead.createdAt),
        }),
      );

    const mappedTasks: TaskData[] = lead.activities
      .flatMap((a: LeadActivity) =>
        (a.tasks || []).map(
          (t: Task): TaskWithActivityId => ({ ...t, activityId: a.id }),
        ),
      )
      .map(
        (t: TaskWithActivityId): TaskData => ({
          id: t.id,
          title: t.title,
          description: t.description,
          dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
          status: "pending" as const,
          entityType: "lead",
          entityId: t.activityId,
          priority: t.priority,
          assignedUserId: t.assignedUserId,
          assignedUser: t.assignedUser,
          createdAt: new Date(t.createdAt || lead.createdAt),
          updatedAt: new Date(t.createdAt || lead.createdAt),
        }),
      );

    const mappedNotes: NoteData[] = lead.activities
      .flatMap((a: LeadActivity) =>
        (a.notes || []).map(
          (n: Note): NoteWithActivityId => ({
            ...n,
            activityId: a.id,
            createdAt: lead.createdAt,
          }),
        ),
      )
      .map(
        (n: NoteWithActivityId): NoteData => ({
          id: n.id,
          content: n.content,
          entityType: "lead",
          entityId: n.activityId,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.createdAt),
        }),
      );

    const mappedActivities: Activity[] = lead.activities.map(
      (a: LeadActivity) => {
        let description =
          a.activityType.charAt(0).toUpperCase() + a.activityType.slice(1);

        if (a.activityType === "task" && a.tasks?.[0]) {
          description = `Task created: ${a.tasks[0].title}`;
        } else if (a.activityType === "call" && a.callLogs?.[0]) {
          description = `Call logged: ${a.callLogs[0].description || "No description"}`;
        } else if (a.activityType === "note" && a.notes?.[0]) {
          const content = a.notes[0].content || "";
          const excerpt =
            content.length > 60 ? `${content.substring(0, 60)}...` : content;
          description = `Note added: ${excerpt}`;
        } else if (a.activityType === "registration") {
          description = "Lead registered in system";
        }

        return {
          id: a.id,
          type: a.activityType as Activity["type"],
          description: description,
          entityType: "lead" as const,
          entityId: a.leadId,
          createdAt: new Date(a.createdAt),
        };
      },
    );

    const mappedAttachments: Attachment[] = (lead.attachments || []).map(
      (att: AttachmentRecord) => ({
        id: att.id,
        entityType: "lead" as const,
        entityId: lead.id,
        name: att.fileName || att.name || "",
        fileUrl: att.fileUrl,
        fileType: att.fileType || "application/octet-stream",
        fileSize: att.fileSize || 0,
        uploadedAt: new Date(att.createdAt),
      }),
    );

    return {
      callLogs: mappedCallLogs,
      activities: mappedActivities,
      tasks: mappedTasks,
      notes: mappedNotes,
      attachments: mappedAttachments,
    };
  }, [lead]) as {
    callLogs: CallLogData[];
    activities: Activity[];
    tasks: TaskData[];
    notes: NoteData[];
    attachments: Attachment[];
  };

  const editForm = useForm<LeadFormData>({
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
      statusId: "",
      source: "",
      notes: "",
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
        statusId: lead.status?.id || "",
        sourceId: lead.source?.id || "",
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

  const handleAddCallLog = async (data: {
    duration: number;
    notes: string;
  }) => {
    try {
      await createLeadActivity({
        leadId: params.id,
        activityType: "call",
        callLogs: {
          create: {
            title: "Call Log",
            description: data.notes,
            startDate: new Date(),
            duration: Number(data.duration),
          },
        },
      });
    } catch (error) {
      console.error("Failed to add call log:", error);
    }
  };

  const handleAddTask = async (data: {
    title: string;
    description: string;
    dueDate: string;
    priority: "low" | "normal" | "high" | "urgent";
    assignedUserId?: string;
  }) => {
    try {
      await createLeadActivity({
        leadId: params.id,
        activityType: "task",
        tasks: {
          create: {
            title: data.title,
            description: data.description,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            priority: data.priority,
            assignedUserId: data.assignedUserId,
          },
        },
      });
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const handleUpdateTask = async (id: string, data: Partial<TaskFormData>) => {
    try {
      await updateTask({
        id,
        data: {
          title: data.title,
          description: data.description,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          priority: data.priority,
          assignedUserId: data.assignedUserId,
        },
      });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id);
    setIsTaskDeleteDialogOpen(true);
  };

  const onConfirmDeleteTask = async () => {
    if (taskToDelete) {
      try {
        await deleteTask(taskToDelete);
        setIsTaskDeleteDialogOpen(false);
        setTaskToDelete(null);
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    }
  };

  const handleAddNote = async (data: { content: string }) => {
    try {
      await createLeadActivity({
        leadId: params.id,
        activityType: "note",
        notes: {
          create: {
            content: data.content,
            title: "Quick Note",
          },
        },
      });
    } catch (error) {
      console.error("Failed to add note:", error);
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
          />

          <div className="flex flex-col-reverse md:flex-row flex-1 overflow-hidden">
            <LeadTabs
              leadId={lead.id}
              callLogs={callLogs}
              activities={activities}
              tasks={tasks}
              notes={notes}
              attachments={attachments}
              onAddCallLog={handleAddCallLog}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddNote={handleAddNote}
              onAddAttachment={handleAddAttachment}
            />
            <LeadDetailsSidebar lead={lead} />
          </div>
        </div>
      </SidebarInset>

      <ConfirmModal
        isOpen={isTaskDeleteDialogOpen}
        onClose={() => setIsTaskDeleteDialogOpen(false)}
        onConfirm={onConfirmDeleteTask}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
      />

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
                  name="statusId"
                  label="Status"
                  className="col-span-1"
                  options={statuses.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  placeholder="Select status"
                  disabled={statuses.length === 0}
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
                  type="text"
                  inputMode="numeric"
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

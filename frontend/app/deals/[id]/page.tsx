"use client";

import { AppSidebar } from "@/components/Sidebar";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useActivities } from "@/hooks/use-activities";
import { useDealDetail, useDeals } from "@/hooks/use-deals";
import { useTasks } from "@/hooks/use-tasks";
import { useUpload } from "@/hooks/use-upload";
import type {
  Activity,
  Attachment,
  CallLog,
  Deal,
  Note,
  Task,
} from "@/lib/data";
import {
  CallLogFormData,
  DealFormData,
  NoteFormData,
  TaskFormData,
} from "@/schemas/deal.schema";
import type {
  CallLog as ActivityCallLog,
  Note as ActivityNote,
  Task as ActivityTask,
  LeadActivity,
} from "@/types/activity";
import type { AttachmentRecord } from "@/types/activity";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DealDetailsSidebar } from "./components/deal-details-sidebar";
import { DealHeader } from "./components/deal-header";
import { DealTabs } from "./components/deal-tabs";

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: deal, isLoading } = useDealDetail(params.id);
  const { updateDeal } = useDeals({ getAll: false });
  const { createLeadActivity } = useActivities();
  const { updateTask, deleteTask } = useTasks();
  const { uploadFile } = useUpload();

  const [isTaskDeleteDialogOpen, setIsTaskDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const { callLogs, activities, tasks, notes, attachments } = useMemo(() => {
    if (!deal?.activities) {
      return {
        callLogs: [] as CallLog[],
        activities: [] as Activity[],
        tasks: [] as Task[],
        notes: [] as Note[],
        attachments: [] as Attachment[],
      };
    }

    const mappedCallLogs: CallLog[] = deal.activities
      .flatMap((a: LeadActivity) =>
        (a.callLogs || []).map((c: ActivityCallLog) => ({
          ...c,
          activityId: a.id,
        })),
      )
      .map((c: ActivityCallLog) => ({
        id: c.id,
        entityType: "deal" as const,
        entityId: deal.id,
        type: "outgoing" as const,
        status: "completed" as const,
        duration: c.duration ? Math.floor(c.duration / 1000) : 0,
        notes: c.description,
        createdAt: new Date(c.startDate || deal.createdAt),
      }));

    const mappedTasks: Task[] = deal.activities
      .flatMap((a: LeadActivity) =>
        (a.tasks || []).map((t: ActivityTask) => ({ ...t, activityId: a.id })),
      )
      .map((t: ActivityTask) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
        status: "pending" as const,
        priority: t.priority || "normal",
        assignedUserId: t.assignedUserId,
        assignedUser: t.assignedUser,
        createdAt: new Date(deal.createdAt),
        updatedAt: new Date(deal.createdAt),
      }));

    const mappedNotes: Note[] = deal.activities
      .flatMap((a: LeadActivity) =>
        (a.notes || []).map((n: ActivityNote) => ({ ...n, activityId: a.id })),
      )
      .map((n: ActivityNote) => ({
        id: n.id,
        content: n.content,
        entityType: "deal" as const,
        entityId: deal.id,
        createdAt: new Date(deal.createdAt),
        updatedAt: new Date(deal.createdAt),
      }));

    const mappedActivities: Activity[] = deal.activities.map(
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
        }

        return {
          id: a.id,
          type: a.activityType as Activity["type"],
          description: description,
          entityType: "deal",
          entityId: deal.id,
          createdAt: new Date(a.createdAt),
        };
      },
    );

    const mappedAttachments: Attachment[] = (deal.attachments || []).map(
      (att: AttachmentRecord) => ({
        id: att.id,
        entityType: "deal" as const,
        entityId: deal.id,
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
  }, [deal]);

  const handleEditDeal = async (data: DealFormData) => {
    if (deal) {
      await updateDeal({ id: deal.id, data });
    }
  };

  const handleAddCallLog = async (data: CallLogFormData) => {
    await createLeadActivity({
      dealId: params.id,
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
  };

  const handleAddTask = async (data: TaskFormData) => {
    await createLeadActivity({
      dealId: params.id,
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
  };

  const handleUpdateTask = async (id: string, data: Partial<TaskFormData>) => {
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
  };

  const handleDeleteTask = (id: string) => {
    setTaskToDelete(id);
    setIsTaskDeleteDialogOpen(true);
  };

  const onConfirmDeleteTask = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      setIsTaskDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleAddNote = async (data: NoteFormData) => {
    await createLeadActivity({
      dealId: params.id,
      activityType: "note",
      notes: {
        create: {
          content: data.content,
          title: "Quick Note",
        },
      },
    });
  };

  const handleAddAttachment = async (data: {
    name: string;
    file: FileList;
  }) => {
    if (!deal?.id || !data.file[0]) return;
    try {
      await uploadFile({
        dealId: deal.id,
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
            <p>Loading deal...</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (!deal) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex items-center justify-center h-full">
            <p>Deal not found</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const displayDeal: Deal = {
    id: deal.id,
    name: deal.refCode || "Unnamed Deal",
    value: Number(deal.expectedAmount) || 0,
    status: (deal.status?.name.toLowerCase() as Deal["status"]) || "new",
    leadName: deal.lead
      ? `${deal.lead.customer.firstName} ${deal.lead.customer.lastName || ""}`.trim()
      : undefined,
    expectedCloseDate: deal.expectedClosingDate
      ? new Date(deal.expectedClosingDate)
      : undefined,
    createdAt: new Date(deal.createdAt),
    updatedAt: new Date(deal.createdAt),
  };

  // const organization: Organization | undefined = deal.lead?.customer
  //   ?.organization
  //   ? {
  //       id: deal.lead.customer.organization.id,
  //       name: deal.lead.customer.organization.name,
  //       territory: "",
  //       industry: "",
  //       address: "",
  //       numberOfEmployees: 0,
  //       website: "",
  //       createdAt: new Date(),
  //       updatedAt: new Date(),
  //     }
  //   : undefined;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex h-full flex-col">
          <DealHeader deal={displayDeal} onEdit={handleEditDeal} />

          <div className="flex flex-col-reverse md:flex-row flex-1 overflow-hidden">
            <DealTabs
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
            <DealDetailsSidebar deal={deal} />
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
    </SidebarProvider>
  );
}

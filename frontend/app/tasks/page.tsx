"use client";

import { AppSidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
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
import { Separator } from "@/components/ui/separator";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useTasks } from "@/hooks/use-tasks";
import { useUsers } from "@/hooks/use-users";
import { TaskFormData, taskFormSchema } from "@/schemas/deal.schema";
import { Task } from "@/types/activity";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Calendar, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function TasksPage() {
  const {
    tasks,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    isCreating,
    isUpdating,
    isDeleting,
  } = useTasks();

  const { users } = useUsers();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const columns = useMemo<ColumnDef<Task>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div>
              <div className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {task.title}
              </div>
              {task.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.description}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "assignedUser",
        header: "Assigned To",
        cell: ({ row }) => {
          const assignedUser = row.getValue("assignedUser") as
            | { name?: string; email: string }
            | null
            | undefined;
          if (!assignedUser) return "-";
          return assignedUser.name || assignedUser.email;
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const priority = row.getValue("priority") as string;
          return (
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${priorityColors[priority] || priorityColors.normal}`}
            >
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </span>
          );
        },
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ row }) => {
          const dueDate = row.getValue("dueDate") as string | null | undefined;
          if (!dueDate) return "-";
          const date = new Date(dueDate);
          return isNaN(date.getTime()) ? (
            "-"
          ) : (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {date.toLocaleDateString("id-ID")}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => {
          const dateValue = row.getValue("createdAt") as
            | string
            | null
            | undefined;
          if (!dateValue) return "-";
          const date = new Date(dateValue);
          return isNaN(date.getTime()) ? "-" : date.toLocaleDateString("id-ID");
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(task)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(task.id)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const addForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      priority: "normal",
      assignedUserId: "",
    },
  });

  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      priority: "normal",
      assignedUserId: "",
    },
  });

  const onSubmitAdd = async (data: TaskFormData) => {
    try {
      await createTask({
        title: data.title,
        description: data.description,
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString()
          : undefined,
        priority: data.priority,
        assignedUserId: data.assignedUserId || undefined,
      });
      addForm.reset();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const onSubmitEdit = async (data: TaskFormData) => {
    if (selectedTask) {
      try {
        await updateTask({
          id: selectedTask.id,
          data: {
            title: data.title,
            description: data.description,
            dueDate: data.dueDate
              ? new Date(data.dueDate).toISOString()
              : undefined,
            priority: data.priority,
            assignedUserId: data.assignedUserId || undefined,
          },
        });
        editForm.reset();
        setIsEditDialogOpen(false);
        setSelectedTask(null);
      } catch (error) {
        console.error("Failed to update task:", error);
      }
    }
  };

  const handleDelete = (id: string) => {
    setSelectedTask(tasks.find((t) => t.id === id) || null);
    setIsDeleteDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    if (selectedTask) {
      try {
        await deleteTask(selectedTask.id);
        setIsDeleteDialogOpen(false);
        setSelectedTask(null);
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    }
  };

  const openEditDialog = (task: Task) => {
    setSelectedTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : "",
      priority: task.priority,
    });
    setIsEditDialogOpen(true);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold">Tasks</h1>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => addForm.reset()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="min-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                  <DialogDescription>Create a new task.</DialogDescription>
                </DialogHeader>
                <FormProvider {...addForm}>
                  <form
                    onSubmit={addForm.handleSubmit(onSubmitAdd)}
                    className="grid grid-cols-2 gap-4 py-4"
                  >
                    <FormInput
                      name="title"
                      label="Task Title"
                      placeholder="Task title"
                      className="col-span-2"
                    />
                    <FormTextarea
                      name="description"
                      label="Description"
                      placeholder="Task description..."
                      rows={3}
                      className="col-span-2"
                    />
                    <FormInput
                      name="dueDate"
                      label="Due Date"
                      type="date"
                      className="col-span-1"
                    />
                    <FormSelect
                      name="priority"
                      label="Priority"
                      options={priorityOptions}
                      placeholder="Select priority"
                      className="col-span-1"
                    />
                    <div className="col-span-2">
                      <FormSelect
                        name="assignedUserId"
                        label="Assigned To"
                        options={users.map((u) => ({
                          value: u.id,
                          label: u.name || u.email,
                        }))}
                        placeholder="Select user (optional)"
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
                          {isCreating ? "Saving..." : "Save Task"}
                        </Button>
                      </DialogFooter>
                    </div>
                  </form>
                </FormProvider>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card>
            <CardHeader>
              <CardTitle>Tasks Management</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div>Loading tasks...</div>
              ) : (
                <DataTable columns={columns} data={tasks} searchKey="title" />
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update the task below.</DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid grid-cols-2 gap-4 py-4"
            >
              <FormInput
                name="title"
                label="Task Title"
                className="col-span-2"
              />
              <FormTextarea
                name="description"
                label="Description"
                rows={3}
                className="col-span-2"
              />
              <FormInput
                name="dueDate"
                label="Due Date"
                type="date"
                className="col-span-1"
              />
              <FormSelect
                name="priority"
                label="Priority"
                options={priorityOptions}
                placeholder="Select priority"
                className="col-span-1"
              />
              <div className="col-span-2">
                <FormSelect
                  name="assignedUserId"
                  label="Assigned To"
                  options={users.map((u) => ({
                    value: u.id,
                    label: u.name || u.email,
                  }))}
                  placeholder="Select user (optional)"
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
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        loading={isDeleting}
      />
    </SidebarProvider>
  );
}

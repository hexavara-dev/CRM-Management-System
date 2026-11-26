"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FormInput } from "@/components/ui/form-input";
import FormSelect from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task } from "@/lib/data";
import { formatDate } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";
import { Calendar, CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

const taskPriorityColors = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

type TaskFormData = {
  title: string;
  description: string;
  dueDate: string;
  priority: "low" | "normal" | "high" | "urgent";
  assignedUserId?: string;
};

interface TasksTabProps {
  tasks: Task[];
  onAddTask: (data: TaskFormData) => void;
  onUpdateTask: (id: string, data: Partial<TaskFormData>) => void;
  onDeleteTask: (id: string) => void;
  entityLabel?: string;
}

export function TasksTab({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  entityLabel = "lead",
}: TasksTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { users } = useUsers();

  const userOptions = users.map((user) => ({
    value: user.id,
    label: user.name,
  }));

  const addForm = useForm<TaskFormData>({
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      priority: "normal",
      assignedUserId: "",
    },
  });

  const editForm = useForm<TaskFormData>({
    defaultValues: {
      title: "",
      description: "",
      dueDate: "",
      priority: "normal",
      assignedUserId: "",
    },
  });

  const onSubmitAdd = (data: TaskFormData) => {
    onAddTask(data);
    addForm.reset();
    setIsAddDialogOpen(false);
  };

  const onSubmitEdit = (data: TaskFormData) => {
    if (selectedTask) {
      onUpdateTask(selectedTask.id, data);
      editForm.reset();
      setIsEditDialogOpen(false);
      setSelectedTask(null);
    }
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate
        ? new Date(task.dueDate).toISOString().split("T")[0]
        : "",
      priority: task.priority || "normal",
      assignedUserId: task.assignedUserId || "",
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Tasks</h2>
          <p className="text-sm text-muted-foreground">
            Manage follow-ups and next steps.
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8">
              <Plus className="size-3.5 mr-1.5" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="min-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Task</DialogTitle>
              <DialogDescription>
                Create a new task for this {entityLabel}.
              </DialogDescription>
            </DialogHeader>
            <FormProvider {...addForm}>
              <form
                onSubmit={addForm.handleSubmit(onSubmitAdd)}
                className="grid gap-4 py-4"
              >
                <FormInput
                  name="title"
                  label="Title"
                  validation={{ required: "Title is required" }}
                  placeholder="Task title"
                />
                <FormTextarea
                  name="description"
                  label="Description"
                  placeholder="Task description..."
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput name="dueDate" label="Due Date" type="date" />
                  <FormSelect
                    name="priority"
                    label="Priority"
                    defaultValue="normal"
                    options={priorityOptions}
                  />
                </div>
                <FormSelect
                  name="assignedUserId"
                  label="Assign To"
                  placeholder="Select a user"
                  options={userOptions}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save Task</Button>
                </DialogFooter>
              </form>
            </FormProvider>
          </DialogContent>
        </Dialog>
      </div>

      {tasks.length === 0 ? (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CheckCircle className="size-4" />
            </EmptyMedia>
            <EmptyTitle>No tasks assigned</EmptyTitle>
            <EmptyDescription>
              Create tasks to stay on top of your {entityLabel} interactions.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
          >
            Create first task
          </Button>
        </Empty>
      ) : (
        <div className="rounded-lg border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">Task</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className="group">
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.dueDate ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 text-muted-foreground" />
                        {formatDate(task.dueDate)}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-normal px-2 h-5 capitalize",
                        taskPriorityColors[
                          task.priority as keyof typeof taskPriorityColors
                        ] || taskPriorityColors.normal,
                      )}
                    >
                      {task.priority || "normal"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {task.assignedUser?.name || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(task.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(task)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDeleteTask(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="min-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the task details below.
            </DialogDescription>
          </DialogHeader>
          <FormProvider {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEdit)}
              className="grid gap-4 py-4"
            >
              <FormInput
                name="title"
                label="Title"
                validation={{ required: "Title is required" }}
              />
              <FormTextarea name="description" label="Description" rows={2} />
              <div className="grid grid-cols-2 gap-4">
                <FormInput name="dueDate" label="Due Date" type="date" />
                <FormSelect
                  name="priority"
                  label="Priority"
                  options={priorityOptions}
                />
              </div>
              <FormSelect
                name="assignedUserId"
                label="Assign To"
                placeholder="Select a user"
                options={userOptions}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Task</Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
    </div>
  );
}

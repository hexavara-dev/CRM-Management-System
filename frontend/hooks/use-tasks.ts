import api from "@/lib/api";
import { Task } from "@/types/activity";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useTasks() {
  // const { user } = useAuth();
  const queryClient = useQueryClient();
  // const tenantId = user?.tenantId;

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const response = await api.get<Task[]>("/api/task");
      return response.data;
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const payload = {
        title: data.title,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || "normal",
        assignedUserId: data.assignedUserId || null,
      };
      const response = await api.post<Task>("/api/task", { data: payload });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to create task");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const payload: Record<string, unknown> = { ...data };
      if (!payload.assignedUserId) payload.assignedUserId = null;
      const response = await api.put<Task>(`/api/task/${id}`, {
        data: payload,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      toast.success("Task updated successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to update task");
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/task/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      toast.success("Task deleted successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete task");
    },
  });

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    isError: tasksQuery.isError,
    error: tasksQuery.error,
    createTask: createTaskMutation.mutateAsync,
    updateTask: updateTaskMutation.mutateAsync,
    deleteTask: deleteTaskMutation.mutateAsync,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
  };
}

import { useAuth } from "@/components/auth/auth-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import { ApiResponse } from "@/types/api";
import { User } from "@/types/user";

export interface CreateUserData {
  email: string;
  name?: string;
  password: string;
  role: "member";
}

export function useUsers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;

  const usersQuery = useQuery<ApiResponse<User[]>>({
    queryKey: ["users", tenantId],
    queryFn: async () => {
      const response = await api.get<ApiResponse<User[]>>("/api/user", {
        params: { tenantId },
      });
      return response.data;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      if (!tenantId) throw new Error("Not authenticated");
      const payload = {
        ...data,
        tenant: { connect: { id: tenantId } },
      };
      const response = await api.post<User>("/api/user", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to create user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/user/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete user");
    },
  });

  return {
    users: usersQuery.data?.data ?? [],
    isLoading: usersQuery.isLoading,
    createUser: createUserMutation.mutateAsync,
    deleteUser: deleteUserMutation.mutateAsync,
    isCreating: createUserMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
  };
}

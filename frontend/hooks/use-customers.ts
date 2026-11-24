import { useAuth } from "@/components/auth/auth-provider";
import api from "@/lib/api";
import { CustomerFormData } from "@/schemas/customer.schema";
import { ApiResponse } from "@/types/api";
import { Customer } from "@/types/customer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useCustomers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;

  const customersQuery = useQuery<ApiResponse<Customer[]>>({
    queryKey: ["customers"],
    queryFn: async () => {
      const response = await api.get("/api/customer");
      return response.data;
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!tenantId) throw new Error("Not authenticated");
      const payload = {
        ...data,
        tenantId,
      };
      const response = await api.post<Customer>("/api/customer", payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to create customer");
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CustomerFormData>;
    }) => {
      const response = await api.put<Customer>(`/api/customer/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to update customer");
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/customer/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete customer");
    },
  });

  return {
    customers: customersQuery.data,
    isLoading: customersQuery.isLoading,
    isError: customersQuery.isError,
    error: customersQuery.error,
    createCustomer: createCustomerMutation.mutateAsync,
    updateCustomer: updateCustomerMutation.mutateAsync,
    deleteCustomer: deleteCustomerMutation.mutateAsync,
    isCreating: createCustomerMutation.isPending,
    isUpdating: updateCustomerMutation.isPending,
    isDeleting: deleteCustomerMutation.isPending,
  };
}

export function useCustomerDetail(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const response = await api.get<Customer>(`/api/customer/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCustomerProfile(id: string) {
  return useQuery({
    queryKey: ["customer-profile", id],
    queryFn: async () => {
      const response = await api.get<Customer>(`/api/customers/${id}/profile`);
      return response.data;
    },
    enabled: !!id,
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { normalizeCollection } from "@/lib/api-response";
import { toast } from "sonner";

export interface Location {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  metadata?: unknown;
  createdAt: string;
}

export interface CreateLocationData {
  name: string;
  description?: string;
  metadata?: unknown;
}

export function useLocations() {
  const queryClient = useQueryClient();

  const locationsQuery = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await api.get("/api/location");
      return response.data;
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: CreateLocationData) => {
      const response = await api.post<Location>("/api/location", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location created successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal membuat lokasi."));
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateLocationData>;
    }) => {
      const response = await api.put<Location>(`/api/location/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal memperbarui lokasi."));
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/location/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast.success("Location deleted");
    },
    onError: (error: unknown) => {
      toast.error(apiErrorMessage(error, "Gagal menghapus lokasi."));
    },
  });

  return {
    locations: normalizeCollection<Location>(locationsQuery.data),
    isLoading: locationsQuery.isLoading,
    createLocation: createLocationMutation.mutateAsync,
    updateLocation: updateLocationMutation.mutateAsync,
    deleteLocation: deleteLocationMutation.mutateAsync,
    isCreating: createLocationMutation.isPending,
    isUpdating: updateLocationMutation.isPending,
    isDeleting: deleteLocationMutation.isPending,
  };
}

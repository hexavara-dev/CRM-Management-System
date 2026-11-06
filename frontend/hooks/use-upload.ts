import { useAuth } from "@/components/auth/auth-provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { toast } from "sonner";
import type { AttachmentRecord } from "@/types/activity";

export interface UploadResponse {
  message: string;
  url: string;
  attachment?: AttachmentRecord;
}

export function useUpload() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = user?.tenantId;

  const uploadMutation = useMutation({
    mutationFn: async ({
      customerId,
      leadId,
      dealId,
      file,
      name,
    }: {
      customerId?: string;
      leadId?: string;
      dealId?: string;
      file: File;
      name: string;
    }) => {
      if (!tenantId) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("document", file);
      formData.append("name", name);

      let url = "";
      if (customerId) {
        url = `/api/customer/${customerId}/upload`;
      } else if (leadId) {
        url = `/api/lead/${leadId}/upload`;
      } else if (dealId) {
        url = `/api/deal/${dealId}/upload`;
      } else {
        throw new Error("Target ID (customer, lead, or deal) is required");
      }

      const response = await api.post<UploadResponse>(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["deal"] });
      toast.success("File uploaded successfully");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to upload file");
    },
  });

  return {
    uploadFile: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
  };
}

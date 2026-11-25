import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";
import api from "@/lib/api";
import { specPayload, type SpecValues, specsOfVariant } from "@/lib/unit-specs";

type ProductList = {
  data: {
    id: string;
    name: string;
    code: string;
    city: string | null;
    subdistrict: string | null;
    village: string | null;
    province: string | null;
    isActive: boolean;
    coverUrl: string | null;
  }[];
  meta: { totalPages: number };
};

type ProductAttribute = {
  id: string;
  variantId: string | null;
  typeVariantId: string | null;
  attributeId: string;
  value: number;
  attribute: { id: string; code: string; name: string; unit: string | null };
};

type ProductMedia = {
  id: string;
  variantId: string | null;
  fileUrl: string;
  mediaType: string;
  isPrimary: boolean;
  sortOrder: number;
};

type ProductVariant = {
  id: string;
  name: string;
  basePrice: number;
  currentPrice: number;
  minPrice: number | null;
  stock: number;
  unitCount: number;
  typeVariants: (Omit<ProductTypeVariant, "id" | "specs"> & { id: string })[];
};

export type ProductTypeVariant = {
  id?: string;
  name: string;
  code: string | null;
  basePrice: number;
  currentPrice?: number;
  minPrice?: number | null;
  stock: number;
  unitCount?: number;
  specs: SpecValues;
};

type ProductDetail = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  subdistrict: string | null;
  village: string | null;
  province: string | null;
  isActive: boolean;
  variants: ProductVariant[];
  attributes: ProductAttribute[];
  media: ProductMedia[];
};

export type ProjectTypeRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  location: string;
  isActive: boolean;
  name: string;
  basePrice: number;
  currentPrice: number;
  stock: number;
  unitCount: number;
  image: string | null;
  typeVariants: ProductTypeVariant[];
};

export type ProjectTypeForm = {
  projectId: string;
  variantId?: string;
  name: string;
  typeVariants: ProductTypeVariant[];
  image?: File;
};

export type ProjectTypesData = {
  rows: ProjectTypeRow[];
  projects: { id: string; name: string }[];
  summary: {
    totalTypes: number;
    totalProjects: number;
    totalUnits: number;
    averageTypes: number;
  };
};

async function allProducts() {
  const params = { page: 1, limit: 100 };
  const first = (await api.get<ProductList>("/api/products", { params })).data;
  if (first.meta.totalPages <= 1) return first.data;

  const pages = await Promise.all(
    Array.from({ length: first.meta.totalPages - 1 }, (_, index) =>
      api.get<ProductList>("/api/products", {
        params: { ...params, page: index + 2 },
      }),
    ),
  );
  return [...first.data, ...pages.flatMap((page) => page.data.data)];
}

async function loadProductTypes(): Promise<ProjectTypesData> {
  const products = await allProducts();
  const details: ProductDetail[] = [];
  const concurrency = 8;
  for (let offset = 0; offset < products.length; offset += concurrency) {
    const batch = products.slice(offset, offset + concurrency);
    const result = await Promise.all(
      batch.map((product) =>
        api
          .get<ProductDetail>(`/api/products/${product.id}`)
          .then((response) => response.data),
      ),
    );
    details.push(...result);
  }

  const rows = details.flatMap((product) =>
    product.variants.map((variant) => {
      const typeVariants = variant.typeVariants.map((option) => ({
        id: option.id,
        name: option.name,
        code: option.code,
        basePrice: Number(option.basePrice),
        currentPrice: Number(option.currentPrice ?? option.basePrice),
        minPrice: option.minPrice == null ? null : Number(option.minPrice),
        stock: option.stock,
        unitCount: option.unitCount,
        specs: specsOfVariant(product.attributes, option.id),
      }));
      const media = product.media
        .filter(
          (item) => item.mediaType === "IMAGE" && item.variantId === variant.id,
        )
        .sort(
          (left, right) =>
            Number(right.isPrimary) - Number(left.isPrimary) ||
            left.sortOrder - right.sortOrder,
        )[0];

      return {
        id: variant.id,
        projectId: product.id,
        projectName: product.name,
        projectCode: product.code,
        location: [
          product.subdistrict || product.village,
          product.city || product.province,
        ]
          .filter((part): part is string => Boolean(part?.trim()))
          .join(", "),
        isActive: product.isActive,
        name: variant.name,
        basePrice: Number(variant.basePrice),
        currentPrice: Number(variant.currentPrice),
        stock: variant.stock,
        unitCount: variant.unitCount,
        // Gambar type hanya dari media milik variant ini; gambar proyek (variantId null) tidak dipakai sebagai fallback.
        image: media?.fileUrl ?? null,
        typeVariants,
      } satisfies ProjectTypeRow;
    }),
  );

  const totalProjects = products.length;
  const totalTypes = rows.length;
  return {
    rows,
    projects: products.map(({ id, name }) => ({ id, name })),
    summary: {
      totalTypes,
      totalProjects,
      totalUnits: rows.reduce((total, row) => total + row.unitCount, 0),
      averageTypes: totalProjects ? totalTypes / totalProjects : 0,
    },
  };
}

export function useProjectTypes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-types", user?.tenantId],
    queryFn: loadProductTypes,
    enabled: !!user,
  });
}

/** Hanya field yang diterima API; unitCount adalah data tampilan. */
function typeVariantPayload({ unitCount: _unitCount, specs, ...option }: ProductTypeVariant) {
  return { ...option, currentPrice: option.currentPrice ?? option.basePrice, attributes: specPayload(specs) };
}

async function uploadTypeImage(
  projectId: string,
  variantId: string,
  image?: File,
) {
  if (!image) return true;
  const form = new FormData();
  form.append("file", image);
  form.append("variantId", variantId);
  form.append("isPrimary", "true");
  form.append("sortOrder", "0");
  try {
    await api.post(`/api/products/${projectId}/media`, form);
    return true;
  } catch {
    return false;
  }
}

export function useCreateProjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: ProjectTypeForm) => {
      const variant = (
        await api.post<{ id: string }>(`/api/products/${form.projectId}/variants`, {
          name: form.name.trim(),
          typeVariants: form.typeVariants.map(typeVariantPayload),
        })
      ).data;
      const imageUploaded = await uploadTypeImage(
        form.projectId,
        variant.id,
        form.image,
      );
      return { partial: !imageUploaded };
    },
    onSuccess: async ({ partial }) => {
      await queryClient.invalidateQueries({ queryKey: ["project-types"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["project"] });
      await queryClient.invalidateQueries({ queryKey: ["project-edit"] });
      toast[partial ? "warning" : "success"](
        partial
          ? "Tipe tersimpan, tetapi gambar gagal disimpan."
          : "Tipe berhasil ditambahkan.",
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal menambahkan tipe.")),
  });
}

export function useUpdateProjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      form: ProjectTypeForm & {
        variantId: string;
      },
    ) => {
      await api.put(`/api/products/${form.projectId}/variants/${form.variantId}`, {
        name: form.name.trim(),
        typeVariants: form.typeVariants.map(typeVariantPayload),
      });
      const imageUploaded = await uploadTypeImage(
        form.projectId,
        form.variantId,
        form.image,
      );
      return { partial: !imageUploaded };
    },
    onSuccess: async ({ partial }) => {
      await queryClient.invalidateQueries({ queryKey: ["project-types"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["project"] });
      await queryClient.invalidateQueries({ queryKey: ["project-edit"] });
      toast[partial ? "warning" : "success"](
        partial
          ? "Tipe diperbarui, tetapi gambar gagal disimpan."
          : "Tipe berhasil diperbarui.",
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal memperbarui tipe.")),
  });
}

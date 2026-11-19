import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";
import api from "@/lib/api";

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

export type TypeAttributeCode =
  | "building_area"
  | "surface_area"
  | "floors"
  | "bedroom"
  | "bathroom"
  | "carport";

export const TYPE_ATTRIBUTES: {
  code: TypeAttributeCode;
  name: string;
  unit?: string;
}[] = [
  { code: "building_area", name: "Building Area", unit: "m²" },
  { code: "surface_area", name: "Surface Area", unit: "m²" },
  { code: "floors", name: "Floors" },
  { code: "bedroom", name: "Bedroom" },
  { code: "bathroom", name: "Bathroom" },
  { code: "carport", name: "Carport" },
];

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
  attributes: Record<TypeAttributeCode, number>;
  attributeRows: ProductAttribute[];
};

export type ProjectTypeForm = {
  projectId: string;
  variantId?: string;
  name: string;
  basePrice: number;
  stock: number;
  attributes: Record<TypeAttributeCode, number>;
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

const emptyAttributes = (): Record<TypeAttributeCode, number> => ({
  building_area: 0,
  surface_area: 0,
  floors: 0,
  bedroom: 0,
  bathroom: 0,
  carport: 0,
});

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
      const attributeRows = product.attributes.filter(
        (attribute) => attribute.variantId === variant.id,
      );
      const attributes = emptyAttributes();
      for (const attribute of attributeRows) {
        if (attribute.attribute.code in attributes) {
          attributes[attribute.attribute.code as TypeAttributeCode] =
            attribute.value;
        }
      }
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
        attributes,
        attributeRows,
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

async function ensureAttributeDefinitions() {
  const definitions = (
    await api.get<{ data: { id: string; code: string }[] }>("/api/attributes")
  ).data.data;
  const byCode = new Map(
    definitions.map((definition) => [definition.code, definition.id]),
  );

  for (const attribute of TYPE_ATTRIBUTES) {
    if (byCode.has(attribute.code)) continue;
    const created = (
      await api.post<{ id: string }>("/api/attributes", {
        name: attribute.name,
        code: attribute.code,
        dataType: "NUMBER",
        unit: attribute.unit ?? null,
      })
    ).data;
    byCode.set(attribute.code, created.id);
  }
  return byCode;
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
      const attributeIds = await ensureAttributeDefinitions();
      const variant = (
        await api.post<{ id: string }>(
          `/api/products/${form.projectId}/variants`,
          {
            name: form.name.trim(),
            basePrice: form.basePrice,
            currentPrice: form.basePrice,
            stock: form.stock,
          },
        )
      ).data;
      const specResults = await Promise.all(
        TYPE_ATTRIBUTES.map(async (attribute) => {
          const attributeId = attributeIds.get(attribute.code);
          if (!attributeId) return false;
          try {
            await api.post(`/api/products/${form.projectId}/attributes`, {
              variantId: variant.id,
              attributeId,
              value: form.attributes[attribute.code],
            });
            return true;
          } catch {
            return false;
          }
        }),
      );
      const imageUploaded = await uploadTypeImage(
        form.projectId,
        variant.id,
        form.image,
      );
      return {
        partial: specResults.some((result) => !result) || !imageUploaded,
      };
    },
    onSuccess: async ({ partial }) => {
      await queryClient.invalidateQueries({ queryKey: ["project-types"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["project"] });
      await queryClient.invalidateQueries({ queryKey: ["project-edit"] });
      toast[partial ? "warning" : "success"](
        partial
          ? "Tipe tersimpan, tetapi sebagian spesifikasi atau gambar gagal disimpan."
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
        attributeRows: ProductAttribute[];
      },
    ) => {
      const attributeIds = await ensureAttributeDefinitions();
      await api.put(
        `/api/products/${form.projectId}/variants/${form.variantId}`,
        {
          name: form.name.trim(),
          basePrice: form.basePrice,
          stock: form.stock,
        },
      );

      const specResults = await Promise.all(
        TYPE_ATTRIBUTES.map(async (attribute) => {
          const definitionId = attributeIds.get(attribute.code);
          if (!definitionId) return false;
          const current = form.attributeRows.find(
            (row) => row.attribute.code === attribute.code,
          );
          try {
            if (current) {
              await api.put(
                `/api/products/${form.projectId}/attributes/${current.id}`,
                { value: form.attributes[attribute.code] },
              );
            } else {
              await api.post(`/api/products/${form.projectId}/attributes`, {
                variantId: form.variantId,
                attributeId: definitionId,
                value: form.attributes[attribute.code],
              });
            }
            return true;
          } catch {
            return false;
          }
        }),
      );
      const imageUploaded = await uploadTypeImage(
        form.projectId,
        form.variantId,
        form.image,
      );
      return {
        partial: specResults.some((result) => !result) || !imageUploaded,
      };
    },
    onSuccess: async ({ partial }) => {
      await queryClient.invalidateQueries({ queryKey: ["project-types"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({ queryKey: ["project"] });
      await queryClient.invalidateQueries({ queryKey: ["project-edit"] });
      toast[partial ? "warning" : "success"](
        partial
          ? "Tipe diperbarui, tetapi sebagian spesifikasi atau gambar gagal disimpan."
          : "Tipe berhasil diperbarui.",
      );
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal memperbarui tipe.")),
  });
}

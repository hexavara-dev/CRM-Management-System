import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { errorMessage } from "@/hooks/use-projects";
import api from "@/lib/api";
import { invalidateProductData } from "@/lib/product-cache";
import { newPhotoFiles, type Photo, photoOrder, typePhotos, typeVariantPhotos } from "@/lib/photos";
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
  typeVariantId: string | null;
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
  typeVariants: (Omit<ProductTypeVariant, "id" | "specs" | "photos"> & { id: string })[];
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
  photos: Photo[];
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
  photos: Photo[];
  typeVariants: ProductTypeVariant[];
};

export type ProjectTypeForm = {
  projectId: string;
  variantId?: string;
  name: string;
  typeVariants: ProductTypeVariant[];
  photos: Photo[];
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
        photos: typeVariantPhotos(product.media, option.id),
      }));
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
        // Hanya foto milik tipe ini; foto proyek dan foto varian tidak dipakai sebagai pengganti.
        photos: typePhotos(product.media, variant.id),
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
function typeVariantPayload({ unitCount: _unitCount, specs, photos, ...option }: ProductTypeVariant) {
  return {
    ...option,
    currentPrice: option.currentPrice ?? option.basePrice,
    attributes: specPayload(specs),
    mediaOrder: photoOrder(photos),
  };
}

/** Tipe, varian, spesifikasi, dan foto dikirim dalam satu request. */
function typeFormData(form: ProjectTypeForm) {
  const data = new FormData();
  data.append(
    "payload",
    JSON.stringify({
      name: form.name.trim(),
      mediaOrder: photoOrder(form.photos),
      typeVariants: form.typeVariants.map(typeVariantPayload),
    }),
  );
  for (const file of newPhotoFiles(form.photos)) data.append("typeImages", file);
  const variantFiles = form.typeVariants.flatMap((variant, index) =>
    newPhotoFiles(variant.photos).map((file) => ({ index, file })),
  );
  data.append("typeVariantImageIndexes", JSON.stringify(variantFiles.map(({ index }) => index)));
  for (const { file } of variantFiles) data.append("typeVariantImages", file);
  return data;
}

export function useCreateProjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: ProjectTypeForm) =>
      api.post(`/api/products/${form.projectId}/variants`, typeFormData(form)),
    onSuccess: async () => {
      await invalidateProductData(queryClient);
      toast.success("Tipe berhasil ditambahkan.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal menambahkan tipe.")),
  });
}

export function useUpdateProjectType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: ProjectTypeForm & { variantId: string }) =>
      api.put(`/api/products/${form.projectId}/variants/${form.variantId}`, typeFormData(form)),
    onSuccess: async () => {
      await invalidateProductData(queryClient);
      toast.success("Tipe berhasil diperbarui.");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Gagal memperbarui tipe.")),
  });
}

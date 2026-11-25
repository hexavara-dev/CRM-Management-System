"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { AppSidebar } from "@/components/Sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ProjectWizard, type WizardInitial } from "@/app/projects/create/project-wizard";
import { typePhotos, typeVariantPhotos } from "@/lib/photos";
import { specsOfVariant } from "@/lib/unit-specs";
import { useProjectEditData, type ProjectEditData } from "@/hooks/use-projects";

function toWizardInitial(project: ProjectEditData): WizardInitial {
  const variantName = new Map(project.variants.map((variant) => [variant.id, variant.name]));
  const typeVariantById = new Map(project.variants.flatMap((variant) => variant.typeVariants.map((option) => [option.id, option])));
  const unitTypes = project.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    photos: typePhotos(project.media, variant.id),
    variants: variant.typeVariants.map((option) => ({
      id: option.id,
      key: option.id,
      name: option.name,
      code: option.code ?? "",
      stock: String(option.stock),
      basePrice: String(option.basePrice),
      specs: specsOfVariant(project.attributes, option.id),
      photos: typeVariantPhotos(project.media, option.id),
    })),
  }));
  return {
    info: {
      code: project.code,
      name: project.name,
      status: project.isActive ? "Active" : "Inactive",
      description: project.description ?? "",
      province: project.province ?? "",
      city: project.city ?? "",
      subdistrict: project.subdistrict ?? "",
      village: project.village ?? "",
      address: project.address ?? "",
      postalCode: project.postalCode ?? "",
      mapsUrl: project.mapsUrl ?? "",
      siteplanImg: project.category.siteplanImg ?? "",
    },
    unitTypes,
    locations: project.locations.map((location) => ({
      id: location.id,
      persistedId: location.id,
      parentId: location.parentId === project.category.id ? "root" : (location.parentId ?? "root"),
      name: location.name,
      level: location.type.charAt(0) + location.type.slice(1).toLowerCase(),
    })),
    units: project.units.map((unit) => ({
      id: unit.id,
      persistedId: unit.id,
      locationId: unit.categoryId === project.category.id ? "root" : unit.categoryId,
      code: unit.code,
      type: variantName.get(unit.variantId) ?? "",
      typeVariantKey: unit.typeVariantId,
      typeVariantName: typeVariantById.get(unit.typeVariantId)?.name ?? "",
      status: unit.status.charAt(0) + unit.status.slice(1).toLowerCase(),
    })),
    facilityAttributeIds: project.attributes
      .filter((item) => item.variantId === null && item.attribute.source === "PROJECT" && item.value > 0)
      .map((item) => item.attribute.id),
    media: project.media
      .filter((item) => item.mediaType === "IMAGE" && !item.variantId && !item.unitId)
      .map((item) => ({ id: item.id, fileUrl: item.fileUrl, isPrimary: item.isPrimary })),
  };
}

function EditWizard({ project }: { project: ProjectEditData }) {
  const [initial] = useState(() => toWizardInitial(project));
  return <ProjectWizard projectId={project.id} initial={initial} />;
}

/** Status di tengah area konten; sidebar tetap tampil. */
function EditState({ loading = false, message }: { loading?: boolean; message: string }) {
  const Icon = loading ? LoaderCircle : AlertCircle;
  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <div role={loading ? "status" : "alert"} className="grid min-h-svh place-items-center p-6 text-center">
          <div>
            <Icon className={cn("mx-auto size-10", loading ? "animate-spin text-[#1980C0]" : "text-[#D64545]")} />
            <p className="mt-3 text-sm text-[#475467]">{message}</p>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProjectEditData(id);
  if (query.isPending || query.isFetching) return <EditState loading message="Memuat proyek..." />;
  if (query.isError || !query.data) return <EditState message="Gagal memuat proyek. Muat ulang halaman." />;
  return <EditWizard key={query.data.id} project={query.data} />;
}

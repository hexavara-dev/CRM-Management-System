"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ProjectWizard, type WizardInitial } from "@/app/projects/create/project-wizard";
import { specsOfVariant } from "@/lib/unit-specs";
import { useProjectEditData, type ProjectEditData } from "@/hooks/use-projects";

function toWizardInitial(project: ProjectEditData): WizardInitial {
  const variantName = new Map(project.variants.map((variant) => [variant.id, variant.name]));
  const typeVariantById = new Map(project.variants.flatMap((variant) => variant.typeVariants.map((option) => [option.id, option])));
  const unitTypes = project.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    imageUrl: project.media.find((media) => media.mediaType === "IMAGE" && media.variantId === variant.id)?.fileUrl,
    variants: variant.typeVariants.map((option) => ({
      id: option.id,
      key: option.id,
      name: option.name,
      code: option.code ?? "",
      stock: String(option.stock),
      basePrice: String(option.basePrice),
      specs: specsOfVariant(project.attributes, option.id),
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
      hook: unit.isHook ? "Ya" : "Tidak",
      status: unit.status.charAt(0) + unit.status.slice(1).toLowerCase(),
      imageUrls: unit.media.map((media) => media.fileUrl),
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

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProjectEditData(id);
  if (query.isPending || query.isFetching) return <p className="p-6">Memuat proyek...</p>;
  if (query.isError || !query.data) return <p className="p-6">Gagal memuat proyek. Muat ulang halaman.</p>;
  return <EditWizard key={query.data.id} project={query.data} />;
}

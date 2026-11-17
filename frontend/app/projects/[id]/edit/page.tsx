"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ProjectWizard, type WizardInitial } from "@/app/projects/create/project-wizard";
import { useProjectEditData, type ProjectEditData } from "@/hooks/use-projects";

function toWizardInitial(project: ProjectEditData): WizardInitial {
  const attributeValue = (variantId: string, code: string) =>
    String(project.attributes.find((item) => item.variantId === variantId && item.attribute.code === code)?.value ?? 0);
  const variantName = new Map(project.variants.map((variant) => [variant.id, variant.name]));
  const unitTypes = project.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    buildingArea: attributeValue(variant.id, "building_area"),
    surfaceArea: attributeValue(variant.id, "surface_area"),
    floors: attributeValue(variant.id, "floors"),
    bedroom: attributeValue(variant.id, "bedroom"),
    bathroom: attributeValue(variant.id, "bathroom"),
    carport: attributeValue(variant.id, "carport"),
    stock: String(variant.stock),
    basePrice: String(variant.basePrice),
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
      hook: unit.isHook ? "Ya" : "Tidak",
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

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProjectEditData(id);
  if (query.isPending || query.isFetching) return <p className="p-6">Memuat proyek...</p>;
  if (query.isError || !query.data) return <p className="p-6">Gagal memuat proyek. Muat ulang halaman.</p>;
  return <EditWizard key={query.data.id} project={query.data} />;
}

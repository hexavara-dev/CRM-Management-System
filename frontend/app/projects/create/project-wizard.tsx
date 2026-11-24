"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, MapPin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { buildProjectPayload } from "./build-payload";
import { PageHeading } from "@/components/PageHeading";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CoverGuide, CoverUpload } from "./cover-upload";
import { LocationPicker } from "./location-picker";
import { RegionFields } from "./region-fields";
import {
  HierarchyStep,
  type LocationNode,
  type UnitItem,
} from "./hierarchy-step";
import { EMPTY_INFO, PreviewStep, type ProjectInfo } from "./preview-step";
import { UnitTypeStep, type UnitType } from "./unit-type-step";
import { INPUT } from "./form-styles";
import { Field, SelectField } from "./form-fields";
import { Stepper } from "./stepper";
import { FacilityPicker } from "./facility-picker";
import { MiniRichTextEditor } from "./mini-rich-text-editor";

const SECTION_TITLE = "flex items-center gap-2 text-base font-semibold text-[#1980C0]";

export type WizardInitial = {
  info: ProjectInfo;
  unitTypes: UnitType[];
  locations: LocationNode[];
  units: UnitItem[];
  facilityAttributeIds: string[];
  media: { id: string; fileUrl: string; isPrimary: boolean }[];
};

export function ProjectWizard({
  projectId,
  initial,
}: { projectId?: string; initial?: WizardInitial }) {
  const [step, setStep] = useState(0);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>(
    initial?.unitTypes ?? [],
  );
  const [locations, setLocations] = useState<LocationNode[]>(
    initial?.locations ?? [],
  );
  const [info, setInfo] = useState<ProjectInfo>(initial?.info ?? EMPTY_INFO);
  const [existingMedia, setExistingMedia] = useState(initial?.media ?? []);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [newCoverUrls, setNewCoverUrls] = useState<string[]>([]);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [siteplanFile, setSiteplanFile] = useState<File>();
  const [siteplanPreviewUrl, setSiteplanPreviewUrl] = useState(initial?.info.siteplanImg ?? "");
  const [units, setUnits] = useState<UnitItem[]>(initial?.units ?? []);
  const [facilityAttributeIds, setFacilityAttributeIds] = useState<string[]>(
    initial?.facilityAttributeIds ?? [],
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const coverUrls = [
    ...existingMedia.map((media) => media.fileUrl),
    ...newCoverUrls,
  ];

  const makePrimary = (id: string) =>
    setExistingMedia((media) =>
      media
        .map((item) => ({ ...item, isPrimary: item.id === id }))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    );
  const removeMedia = (id: string) => {
    setRemovedMediaIds((ids) => [...ids, id]);
    setExistingMedia((media) => {
      const remaining = media.filter((item) => item.id !== id);
      if (media.find((item) => item.id === id)?.isPrimary && remaining.length) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  };

  const readInfo = (): ProjectInfo | null => {
    if (!formRef.current) return null;
    if (!formRef.current.reportValidity()) return null;
    const fd = new FormData(formRef.current);
    const get = (k: keyof ProjectInfo) => String(fd.get(k) ?? "");
    if ((["province", "city", "subdistrict", "village"] as const).some((k) => !get(k).trim())) {
      toast.error("Lengkapi Provinsi, Kota/Kabupaten, Kecamatan, dan Kelurahan/Desa.");
      return null;
    }
    const nextInfo = {
      code: get("code"), name: get("name"), status: get("status"), description: get("description"),
      province: get("province"), city: get("city"), subdistrict: get("subdistrict"), village: get("village"),
      address: get("address"), postalCode: get("postalCode"), mapsUrl: get("mapsUrl"), siteplanImg: siteplanPreviewUrl,
    } satisfies ProjectInfo;
    setInfo(nextInfo);
    return nextInfo;
  };

  const buildPayload = (infoOverride: ProjectInfo = info) => {
    let payload;
    try {
      payload = buildProjectPayload({
        info: infoOverride,
        unitTypes,
        nodes: locations,
        units,
        facilityAttributeIds,
        includeEmpty: !!projectId,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Data proyek belum valid.",
      );
      return null;
    }
    return payload;
  };

  const save = () => {
    const payload = buildPayload();
    if (!payload) return;
    const typeImages = unitTypes.flatMap((type, variantIndex) =>
      type.image ? [{ variantIndex, file: type.image }] : [],
    );
    const unitImages = units.flatMap((unit, unitIndex) =>
      (unit.images ?? []).map((file) => ({ unitIndex, file })),
    );
    if (projectId) {
      updateProject.mutate(
        {
          id: projectId,
          payload: {
            ...payload,
            removeMediaIds: removedMediaIds,
            ...(existingMedia.find((media) => media.isPrimary)
              ? {
                  primaryMediaId: existingMedia.find((media) => media.isPrimary)
                    ?.id,
                }
              : {}),
          },
          covers: coverFiles,
          typeImages,
          siteplan: siteplanFile,
          unitImages,
        },
        { onSuccess: () => router.push(`/projects/${projectId}`) },
      );
    } else {
      createProject.mutate(
        { payload, covers: coverFiles, typeImages, siteplan: siteplanFile, unitImages },
        { onSuccess: (project) => router.push(`/projects/${project.id}`) },
      );
    }
  };

  const saveStep = (stepToSave: number) => {
    if (!projectId) return true;
    const currentInfo = stepToSave === 0 ? readInfo() : info;
    if (!currentInfo) return false;
    const payload = buildPayload(currentInfo);
    if (!payload) return false;
    const stepPayload = stepToSave === 0
      ? { name: payload.name, code: payload.code, description: payload.description, province: payload.province, city: payload.city, subdistrict: payload.subdistrict, village: payload.village, address: payload.address, postalCode: payload.postalCode, mapsUrl: payload.mapsUrl, isActive: payload.isActive, facilityAttributeIds: payload.facilityAttributeIds, removeMediaIds: removedMediaIds, ...(existingMedia.find((media) => media.isPrimary) ? { primaryMediaId: existingMedia.find((media) => media.isPrimary)?.id } : {}) }
      : stepToSave === 1 ? { variants: payload.variants } : { locations: payload.locations, units: payload.units };
    updateProject.mutate({
      id: projectId,
      payload: stepPayload,
      covers: stepToSave === 0 ? coverFiles : [],
      typeImages: stepToSave === 1 ? unitTypes.flatMap((type, variantIndex) => type.image ? [{ variantIndex, file: type.image }] : []) : [],
      siteplan: stepToSave === 0 ? siteplanFile : undefined,
      unitImages: stepToSave === 2 ? units.flatMap((unit, unitIndex) => (unit.images ?? []).map((file) => ({ unitIndex, file }))) : [],
    });
    return true;
  };

  const next = () => {
    if (step === 0 && !readInfo()) return;
    setStep(step + 1);
  };

  const goToStep = (target: number) => {
    if (step === 0 && target !== 0 && !readInfo()) return;
    setStep(target);
  };

  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <PageHeading
              title={projectId ? "Edit Project" : "Create Project"}
            />
            <Stepper current={step} clickable={!!projectId} onStepChange={goToStep} />
          </div>
          <hr className="border-[#EDEDED]" />

          <div
            className={cn(
              "rounded-xl border border-[#E4E4E7] bg-white p-4",
              step !== 1 && "hidden",
            )}
          >
            <UnitTypeStep
              items={unitTypes}
              units={units}
              onChange={setUnitTypes}
              onRename={(oldName, newName) =>
                setUnits((current) =>
                  current.map((unit) =>
                    unit.type === oldName ? { ...unit, type: newName } : unit,
                  ),
                )
              }
              onVariantRename={(key, name) =>
                setUnits((current) => current.map((unit) =>
                  unit.typeVariantKey === key ? { ...unit, typeVariantName: name } : unit,
                ))
              }
            />
          </div>

          <div
            className={cn(
              "rounded-xl border border-[#E4E4E7] bg-white p-4",
              step !== 2 && "hidden",
            )}
          >
            <HierarchyStep
              projectName={info.name}
              nodes={locations}
              onChange={setLocations}
              unitTypes={unitTypes}
              units={units}
              onUnitsChange={setUnits}
            />
          </div>

          {step === 3 && (
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
              <PreviewStep
                info={info}
                coverUrls={coverUrls}
                unitTypes={unitTypes}
                nodes={locations}
                units={units}
                facilityAttributeIds={facilityAttributeIds}
              />
            </div>
          )}

          <form
            ref={formRef}
            onSubmit={(e) => e.preventDefault()}
            className={cn(
              "space-y-8 rounded-xl border border-[#E4E4E7] bg-white p-5",
              step !== 0 && "hidden",
            )}
          >
            <section className="space-y-4">
              <h3 className={SECTION_TITLE}>
                <Box className="size-5" />
                Informasi Proyek
              </h3>
              <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-2">
                <div className="min-w-0 space-y-4">
                <Field label="Kode Proyek" required>
                  <Input
                    name="code"
                    placeholder="Masukkan kode proyek"
                    defaultValue={initial?.info.code}
                    required
                    className={INPUT}
                  />
                </Field>
                <Field label="Nama Proyek" required>
                  <Input
                    name="name"
                    placeholder="Masukkan nama proyek"
                    defaultValue={initial?.info.name}
                    required
                    className={INPUT}
                  />
                </Field>
                <Field label="Deskripsi Proyek (Opsional)">
                  <MiniRichTextEditor
                    name="description"
                    initialValue={initial?.info.description}
                    className="min-h-48"
                  />
                </Field>
                </div>
                <div className="min-w-0 space-y-4">
                <Field label="Status Proyek" required>
                  <SelectField
                    name="status"
                    placeholder="Pilih status"
                    initialValue={initial?.info.status}
                    options={[
                      { value: "Active", label: "Aktif" },
                      { value: "In Development", label: "Dalam Pengembangan" },
                      { value: "Inactive", label: "Tidak Aktif" },
                    ]}
                    required
                  />
                </Field>
                  <Field label="Sampul Proyek (Opsional)" action={<CoverGuide />}>
                    <CoverUpload
                    name="cover"
                    existing={existingMedia}
                    onMakePrimary={projectId ? makePrimary : undefined}
                    onDeleteExisting={projectId ? removeMedia : undefined}
                    onUrlsChange={setNewCoverUrls}
                    onFilesChange={setCoverFiles}
                    />
                  </Field>
                <Field label="Siteplan (Opsional)">
                  <div className="space-y-2">
                    <label className="group relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#1980C0] bg-[#F6FAFD] transition hover:bg-[#EAF5FC] focus-within:ring-2 focus-within:ring-[#1980C0]/30">
                      {siteplanPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- object URL lokal atau URL storage.
                        <img src={siteplanPreviewUrl} alt="Preview siteplan" className="size-full object-contain" />
                      ) : (
                        <span className="text-xs text-[#667085]">Klik untuk memilih siteplan</span>
                      )}
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-3 py-1.5 text-center text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                        {siteplanPreviewUrl ? "Klik untuk mengganti siteplan" : "Pilih gambar siteplan"}
                      </span>
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
                            toast.error("Gunakan JPEG, PNG, atau WebP maksimal 10 MB.");
                            event.target.value = "";
                            return;
                          }
                          setSiteplanFile(file);
                          setSiteplanPreviewUrl(URL.createObjectURL(file));
                        }}
                      />
                    </label>
                    <p className="truncate text-[10px] text-[#6b6b6b]" title={siteplanFile?.name}>
                      {siteplanFile?.name ?? (siteplanPreviewUrl ? "Siteplan tersimpan" : "Belum ada file dipilih")} · JPEG, PNG, atau WebP; maksimal 10 MB.
                    </p>
                  </div>
                </Field>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className={SECTION_TITLE}>
                <Sparkles className="size-5" />
                Fasilitas Proyek
              </h3>
              <FacilityPicker
                selected={facilityAttributeIds}
                onChange={setFacilityAttributeIds}
              />
            </section>

            <section className="space-y-4">
              <h3 className={SECTION_TITLE}>
                <MapPin className="size-5" />
                Alamat Proyek
              </h3>
              <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                <RegionFields
                  initial={initial?.info}
                  postal={
                    <Field label="Kode Pos" required>
                      <Input
                        name="postalCode"
                        placeholder="Masukkan kode pos"
                        defaultValue={initial?.info.postalCode}
                        inputMode="numeric"
                        required
                        className={INPUT}
                      />
                    </Field>
                  }
                  address={
                    <Field label="Alamat Lengkap" required>
                      <Input
                        name="address"
                        placeholder="Masukkan alamat lengkap"
                        defaultValue={initial?.info.address}
                        required
                        className={INPUT}
                      />
                    </Field>
                  }
                />
              </div>

              <Field label="Titik Lokasi (Opsional)">
                <LocationPicker initialValue={initial?.info.mapsUrl} />
              </Field>
            </section>
          </form>

          <div className="flex items-center justify-between">
            {step === 0 ? (
              <Button
                asChild
                variant="outline"
                className="h-9 rounded-lg px-5 text-xs"
              >
                <Link href={projectId ? `/projects/${projectId}` : "/projects"}>
                  Cancel
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="h-9 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-10 text-xs text-[#1980C0] hover:bg-[#d6eaf6]"
              >
                Back
              </Button>
            )}
            {projectId && step < 3 ? (
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => saveStep(step)} disabled={updateProject.isPending} className="h-9 rounded-lg px-5 text-xs">
                  {updateProject.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button type="button" onClick={next} disabled={step === 1 && unitTypes.length === 0} className="h-9 rounded-lg bg-[#1980C0] px-12 text-xs text-white hover:bg-[#166ea6]">Next</Button>
              </div>
            ) : step === 3 ? (
              <Button
                type="button"
                onClick={save}
                disabled={createProject.isPending || updateProject.isPending}
                className="h-9 rounded-lg bg-[#1980C0] px-12 text-xs text-white hover:bg-[#166ea6]"
              >
                {createProject.isPending || updateProject.isPending
                  ? "Menyimpan..."
                  : "Simpan"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={next}
                disabled={step === 1 && unitTypes.length === 0}
                className="h-9 rounded-lg bg-[#1980C0] px-12 text-xs text-white hover:bg-[#166ea6]"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

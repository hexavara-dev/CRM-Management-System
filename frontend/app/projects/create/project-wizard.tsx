"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { buildProjectPayload } from "./build-payload";
import { PageHeading } from "@/components/PageHeading";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CoverUpload } from "./cover-upload";
import { LocationPicker } from "./location-picker";
import { RegionFields } from "./region-fields";
import { HierarchyStep, type LocationNode, type UnitItem } from "./hierarchy-step";
import { EMPTY_INFO, PreviewStep, type ProjectInfo } from "./preview-step";
import { UnitTypeStep, type UnitType } from "./unit-type-step";
import { INPUT, TEXTAREA } from "./form-styles";
import { Field, SelectField } from "./form-fields";
import { Stepper } from "./stepper";
import { FacilityPicker } from "./facility-picker";


export type WizardInitial = {
  info: ProjectInfo;
  unitTypes: UnitType[];
  locations: LocationNode[];
  units: UnitItem[];
  facilityAttributeIds: string[];
  media: { id: string; fileUrl: string; isPrimary: boolean }[];
};

export function ProjectWizard({ projectId, initial }: { projectId?: string; initial?: WizardInitial }) {
  const [step, setStep] = useState(0);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>(initial?.unitTypes ?? []);
  const [locations, setLocations] = useState<LocationNode[]>(initial?.locations ?? []);
  const [info, setInfo] = useState<ProjectInfo>(initial?.info ?? EMPTY_INFO);
  const [existingMedia, setExistingMedia] = useState(initial?.media ?? []);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [newCoverUrls, setNewCoverUrls] = useState<string[]>([]);
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [units, setUnits] = useState<UnitItem[]>(initial?.units ?? []);
  const [facilityAttributeIds, setFacilityAttributeIds] = useState<string[]>(initial?.facilityAttributeIds ?? []);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const coverUrls = [...existingMedia.map((media) => media.fileUrl), ...newCoverUrls];

  const makePrimary = (id: string) => setExistingMedia((media) =>
    media.map((item) => ({ ...item, isPrimary: item.id === id }))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
  );
  const removeMedia = (id: string) => {
    if (!window.confirm("Hapus gambar ini?")) return;
    setRemovedMediaIds((ids) => [...ids, id]);
    setExistingMedia((media) => {
      const remaining = media.filter((item) => item.id !== id);
      if (media.find((item) => item.id === id)?.isPrimary && remaining.length) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  };

  const save = () => {
    let payload;
    try {
      payload = buildProjectPayload({ info, unitTypes, nodes: locations, units, facilityAttributeIds, includeEmpty: !!projectId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Data proyek belum valid.");
      return;
    }
    const typeImages = unitTypes.flatMap((type, variantIndex) =>
      type.image ? [{ variantIndex, file: type.image }] : []
    );
    if (projectId) {
      updateProject.mutate(
        { id: projectId, payload: {
          ...payload,
          removeMediaIds: removedMediaIds,
          ...(existingMedia.find((media) => media.isPrimary) ? { primaryMediaId: existingMedia.find((media) => media.isPrimary)?.id } : {}),
        }, covers: coverFiles, typeImages },
        { onSuccess: () => router.push(`/projects/${projectId}`) },
      );
    } else {
      createProject.mutate(
        { payload, covers: coverFiles, typeImages },
        { onSuccess: (project) => router.push(`/projects/${project.id}`) },
      );
    }
  };

  const next = () => {
    if (step === 0) {
      if (!formRef.current?.reportValidity()) return;
      const fd = new FormData(formRef.current);
      const get = (k: keyof ProjectInfo) => String(fd.get(k) ?? "");
      // `required` di <select> native Radix tidak bisa diandalkan (browser auto-memilih opsi pertama),
      // jadi wilayah dicek dari hidden input agar proyek tidak tersimpan tanpa wilayah.
      if ((["province", "city", "subdistrict", "village"] as const).some((k) => !get(k).trim())) {
        toast.error("Lengkapi Province, City/Regency, Subdistrict, dan Village.");
        return;
      }
      setInfo({
        code: get("code"),
        name: get("name"),
        status: get("status"),
        description: get("description"),
        province: get("province"),
        city: get("city"),
        subdistrict: get("subdistrict"),
        village: get("village"),
        address: get("address"),
        postalCode: get("postalCode"),
        mapsUrl: get("mapsUrl"),
      });
    }
    setStep(step + 1);
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
            <PageHeading title={projectId ? "Edit Project" : "Create Project"} />
            <Stepper current={step} />
          </div>
          <hr className="border-[#EDEDED]" />

          <div className={cn("rounded-xl border border-[#E4E4E7] bg-white p-4", step !== 1 && "hidden")}>
            <UnitTypeStep items={unitTypes} units={units} onChange={setUnitTypes} onRename={(oldName, newName) => setUnits((current) => current.map((unit) => unit.type === oldName ? { ...unit, type: newName } : unit))} />
          </div>

          <div className={cn("rounded-xl border border-[#E4E4E7] bg-white p-4", step !== 2 && "hidden")}>
            <HierarchyStep projectName={info.name} nodes={locations} onChange={setLocations} unitTypes={unitTypes} units={units} onUnitsChange={setUnits} />
          </div>

          {step === 3 && (
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4">
              <PreviewStep info={info} coverUrls={coverUrls} unitTypes={unitTypes} nodes={locations} units={units} facilityAttributeIds={facilityAttributeIds} />
            </div>
          )}

          <form ref={formRef} onSubmit={(e) => e.preventDefault()} className={cn("space-y-5 rounded-xl border border-[#E4E4E7] bg-white p-4", step !== 0 && "hidden")}>
            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#1980C0]">
                <Box className="size-3.5" />
                Project Information
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Project Code" required>
                  <Input name="code" placeholder="Masukkan kode proyek" defaultValue={initial?.info.code} required className={INPUT} />
                </Field>
                <Field label="Project Name" required>
                  <Input name="name" placeholder="Masukkan nama proyek" defaultValue={initial?.info.name} required className={INPUT} />
                </Field>
                <Field label="Project Status" required>
                  <SelectField name="status" placeholder="Pilih status" initialValue={initial?.info.status} options={["Active", "In Development", "Inactive"]} required />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Project Description (Optional)">
                  <textarea name="description" rows={6} placeholder="Deskripsi proyek" defaultValue={initial?.info.description} className={cn(TEXTAREA, "h-40")} />
                </Field>
                <Field label="Project Cover (Optional)">
                  <CoverUpload name="cover" existing={existingMedia} onMakePrimary={projectId ? makePrimary : undefined} onDeleteExisting={projectId ? removeMedia : undefined} onUrlsChange={setNewCoverUrls} onFilesChange={setCoverFiles} />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-[#1980C0]">Fasilitas Proyek</h3>
              <FacilityPicker selected={facilityAttributeIds} onChange={setFacilityAttributeIds} />
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-[#1980C0]">
                <MapPin className="size-3.5" />
                Project Address
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <RegionFields
                  initial={initial?.info}
                  postal={
                    <Field label="Postal Code" required>
                      <Input name="postalCode" placeholder="Masukkan kode pos" defaultValue={initial?.info.postalCode} inputMode="numeric" required className={INPUT} />
                    </Field>
                  }
                  address={
                    <Field label="Full Address" required>
                      <Input name="address" placeholder="Masukkan alamat lengkap" defaultValue={initial?.info.address} required className={INPUT} />
                    </Field>
                  }
                />
              </div>

              <Field label="Location Point (Optional)">
                <LocationPicker initialValue={initial?.info.mapsUrl} />
              </Field>
            </section>

          </form>

          <div className="flex items-center justify-between">
            {step === 0 ? (
              <Button asChild variant="outline" className="h-9 rounded-lg px-5 text-xs">
                <Link href={projectId ? `/projects/${projectId}` : "/projects"}>Cancel</Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="h-9 rounded-lg border-[#1980C0] bg-[#E8F3FA] px-10 text-xs text-[#1980C0] hover:bg-[#d6eaf6]">
                Back
              </Button>
            )}
            {step === 3 ? (
              <Button type="button" onClick={save} disabled={createProject.isPending || updateProject.isPending} className="h-9 rounded-lg bg-[#1980C0] px-12 text-xs text-white hover:bg-[#166ea6]">
                {createProject.isPending || updateProject.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            ) : (
              <Button type="button" onClick={next} disabled={step === 1 && unitTypes.length === 0} className="h-9 rounded-lg bg-[#1980C0] px-12 text-xs text-white hover:bg-[#166ea6]">
                Next
              </Button>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

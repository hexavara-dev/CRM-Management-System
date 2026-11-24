"use client";

import { AppSidebar } from "@/components/Sidebar";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { useActivities } from "@/hooks/use-activities";
import { useDealDetailWorkflow } from "@/hooks/use-deal-detail-workflow";
import { useDealDetail, useDealUnits, useDeals } from "@/hooks/use-deals";
import { useFinancingBanks } from "@/hooks/use-financing-banks";
import { usePipelineStages } from "@/hooks/use-pipeline-stages";
import { useProjects } from "@/hooks/use-projects";
import { useUpload } from "@/hooks/use-upload";
import { useUsers } from "@/hooks/use-users";
import type { Activity, Attachment, Note } from "@/lib/data";
import type {
  Note as ActivityNote,
  AttachmentRecord,
  DealActivity,
} from "@/types/activity";
import type {
  DealPaymentMethod,
  DealPaymentStatus,
  DealPaymentType,
} from "@/types/deal";
import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DealHeader } from "./components/deal-header";
import { DealOverview } from "./components/deal-overview";
import { DealTabs } from "./components/deal-tabs";

const inputClass = "h-9";
const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default function DealDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { data: deal, isLoading, isError } = useDealDetail(params.id);
  const { updateDeal, isUpdating } = useDeals({}, false);
  const stagesQuery = usePipelineStages("deal");
  const stages = stagesQuery.data ?? [];
  const { data: projects } = useProjects({ page: 1, limit: 100 });
  const { users } = useUsers();
  const { data: banks = [] } = useFinancingBanks(true);
  const { createLeadActivity, isCreatingActivity } = useActivities();
  const { uploadFile } = useUpload();
  const workflow = useDealDetailWorkflow(params.id);

  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [chronology, setChronology] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<DealPaymentType>("ITJ");
  const [paymentStatus, setPaymentStatus] =
    useState<DealPaymentStatus>("PENDING");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] =
    useState<DealPaymentMethod>("CASH");
  const [editBankId, setEditBankId] = useState("");
  const [editStageId, setEditStageId] = useState("");
  const [editAssignedUserId, setEditAssignedUserId] = useState("");
  const [stageOpen, setStageOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityType, setActivityType] = useState("follow_up");
  const [activityDescription, setActivityDescription] = useState("");

  const editRequested = searchParams.get("edit") === "1";
  const editUnitsQuery = useDealUnits(editProjectId);
  const editNeedsBank = editPaymentMethod !== "CASH";
  const editIsValid =
    Number(editAmount) >= 0 &&
    !!editUnitId &&
    !!editStageId &&
    !!editAssignedUserId &&
    (!editNeedsBank || !!editBankId);

  const populateEditForm = () => {
    setEditAmount(String(deal?.amount ?? deal?.expectedAmount ?? ""));
    setEditNotes(deal?.notes || "");
    setEditProjectId(deal?.unit?.variant.product.id || "");
    setEditUnitId(deal?.unitId || "");
    setEditPaymentMethod(deal?.paymentMethod || "CASH");
    setEditBankId(deal?.financingBankId || "");
    setEditStageId(deal?.stageId || "");
    setEditAssignedUserId(deal?.assignedUserId || "");
  };

  useEffect(() => {
    if (!deal || !editRequested || editOpen) return;
    populateEditForm();
    setEditOpen(true);
  }, [deal, editOpen, editRequested]);

  const mapped = useMemo(() => {
    if (!deal)
      return {
        activities: [] as Activity[],
        notes: [] as Note[],
        attachments: [] as Attachment[],
      };
    const dealActivities = deal.activities ?? [];
    const activities: Activity[] = dealActivities.map(
      (activity: DealActivity) => ({
        id: activity.id,
        type: activity.activityType as Activity["type"],
        description:
          activity.notes?.[0]?.content ||
          activity.tasks?.[0]?.title ||
          activity.callLogs?.[0]?.description ||
          activity.activityType.replaceAll("_", " "),
        entityType: "deal",
        entityId: deal.id,
        createdAt: new Date(activity.createdAt),
      }),
    );
    const notes: Note[] = dealActivities.flatMap((activity: DealActivity) =>
      (activity.notes ?? []).map((note: ActivityNote) => ({
        id: note.id,
        content: note.content,
        entityType: "deal" as const,
        entityId: deal.id,
        createdAt: new Date(activity.createdAt),
        updatedAt: new Date(activity.createdAt),
      })),
    );
    const attachments: Attachment[] = (deal.attachments ?? []).map(
      (attachment: AttachmentRecord) => ({
        id: attachment.id,
        entityType: "deal" as const,
        entityId: deal.id,
        name: attachment.fileName || attachment.name || "Dokumen",
        fileUrl: attachment.fileUrl,
        fileType: attachment.fileType || "application/octet-stream",
        fileSize: attachment.fileSize || 0,
        uploadedAt: new Date(attachment.createdAt),
      }),
    );
    return { activities, notes, attachments };
  }, [deal]);

  if (isLoading || stagesQuery.isLoading) {
    return (
      <PageShell>
        <div className="flex h-full items-center justify-center gap-2 text-sm text-[#667085]">
          <Loader2 className="size-4 animate-spin" /> Memuat Detail Deal...
        </div>
      </PageShell>
    );
  }
  if (isError || !deal) {
    return (
      <PageShell>
        <div className="flex h-full items-center justify-center text-sm text-[#667085]">
          Detail Deal tidak ditemukan.
        </div>
      </PageShell>
    );
  }

  const pendingLost = workflow.lostRequests.find(
    (request) => request.status === "PENDING",
  );
  const openEdit = () => {
    populateEditForm();
    setEditOpen(true);
  };

  const setEditDialogOpen = (open: boolean) => {
    setEditOpen(open);
    if (!open && editRequested) {
      router.replace(`/deals/${deal.id}`, { scroll: false });
    }
  };

  const saveEdit = async () => {
    await updateDeal({
      id: deal.id,
      data: {
        expectedAmount: Number(editAmount || 0),
        amount: Number(editAmount || 0),
        notes: editNotes || null,
        unitId: editUnitId,
        paymentMethod: editPaymentMethod,
        financingBankId: editNeedsBank ? editBankId : null,
        stageId: editStageId,
        assignedUserId: editAssignedUserId,
      },
    });
    setEditDialogOpen(false);
  };

  const saveStage = async () => {
    if (!selectedStageId) return;
    await updateDeal({ id: deal.id, data: { stageId: selectedStageId } });
    setStageOpen(false);
  };

  const saveActivity = async () => {
    if (!activityDescription.trim()) return;
    await createLeadActivity({
      dealId: deal.id,
      activityType,
      notes: {
        create: { title: "Activity", content: activityDescription.trim() },
      },
    });
    setActivityDescription("");
    setActivityOpen(false);
  };

  const submitLost = async () => {
    if (!lostReason || !chronology.trim()) return;
    await workflow.requestLost({
      reason: lostReason,
      chronology: chronology.trim(),
    });
    setLostReason("");
    setChronology("");
    setLostOpen(false);
  };

  const reviewLost = async (decision: "approve" | "reject") => {
    if (!pendingLost) return;
    await workflow.reviewLost({
      requestId: pendingLost.id,
      decision,
      reviewNotes,
    });
    setReviewNotes("");
    setLostOpen(false);
  };

  const submitPayment = async () => {
    const amount = Number(paymentAmount.replace(/\D/g, ""));
    if (!amount) return;
    await workflow.addPayment({
      type: paymentType,
      amount,
      status: paymentStatus,
    });
    setPaymentAmount("");
    setPaymentOpen(false);
  };

  const addNote = async (data: { content: string }) => {
    await createLeadActivity({
      dealId: deal.id,
      activityType: "note",
      notes: { create: { title: "Quick Note", content: data.content } },
    });
  };

  const addAttachment = async (data: { name: string; file: FileList }) => {
    if (!data.file[0]) return;
    await uploadFile({ dealId: deal.id, file: data.file[0], name: data.name });
  };

  return (
    <PageShell>
      <div className="flex h-full min-h-0 flex-col">
        <DealHeader
          deal={deal}
          hasPendingLost={!!pendingLost}
          onLost={() => setLostOpen(true)}
          onEdit={openEdit}
          onAddActivity={() => setActivityOpen(true)}
          onChangeStage={() => {
            setSelectedStageId(deal.stageId || "");
            setStageOpen(true);
          }}
        />
        <DealTabs
          overview={
            <DealOverview
              deal={deal}
              stages={stages}
              history={workflow.history}
              payments={workflow.payments}
              onAddPayment={() => setPaymentOpen(true)}
            />
          }
          activities={mapped.activities}
          attachments={mapped.attachments}
          notes={mapped.notes}
          history={workflow.history}
          onAddNote={addNote}
          onAddAttachment={addAttachment}
        />
      </div>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingLost ? "Verifikasi Lost Deal" : "Ajukan Lost Deal"}
            </DialogTitle>
            <DialogDescription>
              {pendingLost
                ? "Tinjau alasan dan kronologi sebelum memberi keputusan."
                : "Deal tidak langsung menjadi Lost. Pengajuan harus diverifikasi user lain."}
            </DialogDescription>
          </DialogHeader>
          {pendingLost ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-[#FFFAEB] p-3 text-sm">
                <p className="font-semibold text-[#B54708]">
                  {pendingLost.reason}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[#475467]">
                  {pendingLost.chronology}
                </p>
                <p className="mt-2 text-xs text-[#667085]">
                  Diajukan oleh{" "}
                  {pendingLost.requestedBy.name ||
                    pendingLost.requestedBy.email}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reviewNotes">Catatan verifikasi</Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Catatan persetujuan atau penolakan (opsional)"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => reviewLost("reject")}
                  disabled={
                    workflow.isReviewingLost ||
                    pendingLost.requestedBy.id === user?.id
                  }
                >
                  Tolak
                </Button>
                <Button
                  onClick={() => reviewLost("approve")}
                  disabled={
                    workflow.isReviewingLost ||
                    pendingLost.requestedBy.id === user?.id
                  }
                >
                  Setujui Lost
                </Button>
              </DialogFooter>
              {pendingLost.requestedBy.id === user?.id && (
                <p className="text-xs text-[#B42318]">
                  Pengaju tidak dapat memverifikasi pengajuannya sendiri.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="lostReason">Alasan Lost</Label>
                <select
                  id="lostReason"
                  className={selectClass}
                  value={lostReason}
                  onChange={(event) => setLostReason(event.target.value)}
                >
                  <option value="">Pilih alasan</option>
                  <option value="Harga tidak sesuai">Harga tidak sesuai</option>
                  <option value="Pembiayaan ditolak">Pembiayaan ditolak</option>
                  <option value="Memilih kompetitor">Memilih kompetitor</option>
                  <option value="Tidak dapat dihubungi">
                    Tidak dapat dihubungi
                  </option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="chronology">Keterangan / Kronologi</Label>
                <Textarea
                  id="chronology"
                  value={chronology}
                  onChange={(event) => setChronology(event.target.value)}
                  placeholder="Jelaskan kronologi pengajuan Lost..."
                  rows={5}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setLostOpen(false)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={submitLost}
                  disabled={
                    !lostReason ||
                    !chronology.trim() ||
                    workflow.isRequestingLost
                  }
                >
                  Ajukan Verifikasi
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Transaksi</DialogTitle>
            <DialogDescription>
              Catat pembayaran ITJ, DP, atau Pelunasan Deal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Jenis Transaksi</Label>
              <select
                className={selectClass}
                value={paymentType}
                onChange={(event) =>
                  setPaymentType(event.target.value as DealPaymentType)
                }
              >
                <option value="ITJ">ITJ</option>
                <option value="DP">DP</option>
                <option value="SETTLEMENT">Pelunasan</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentAmount">Nominal</Label>
              <Input
                id="paymentAmount"
                className={inputClass}
                inputMode="numeric"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder="Rp 0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                className={selectClass}
                value={paymentStatus}
                onChange={(event) =>
                  setPaymentStatus(event.target.value as DealPaymentStatus)
                }
              >
                <option value="PENDING">Belum Lunas</option>
                <option value="PAID">Lunas</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={submitPayment}
              disabled={!paymentAmount || workflow.isAddingPayment}
            >
              Simpan Transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Deal</DialogTitle>
            <DialogDescription>
              Perbarui informasi transaksi Deal. Fase mengikuti konfigurasi
              Deals Pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <select
                className={selectClass}
                value={editProjectId}
                onChange={(event) => {
                  setEditProjectId(event.target.value);
                  setEditUnitId("");
                }}
              >
                <option value="">Pilih project</option>
                {(projects?.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <select
                className={selectClass}
                value={editUnitId}
                onChange={(event) => setEditUnitId(event.target.value)}
                disabled={!editProjectId || editUnitsQuery.isLoading}
              >
                <option value="">
                  {editUnitsQuery.isLoading ? "Memuat unit..." : "Pilih unit"}
                </option>
                {(editUnitsQuery.data ?? []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.variant.name} / {unit.typeVariant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editAmount">Harga Deal</Label>
              <Input
                id="editAmount"
                className={inputClass}
                inputMode="numeric"
                value={editAmount}
                onChange={(event) => setEditAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Pembayaran</Label>
              <select
                className={selectClass}
                value={editPaymentMethod}
                onChange={(event) => {
                  const method = event.target.value as DealPaymentMethod;
                  setEditPaymentMethod(method);
                  if (method === "CASH") setEditBankId("");
                }}
              >
                <option value="CASH">Tunai</option>
                <option value="KPR">KPR</option>
                <option value="KPR_SHARIA">KPR Syariah</option>
              </select>
            </div>
            {editNeedsBank && (
              <div className="space-y-1.5">
                <Label>Bank Pembiayaan</Label>
                <select
                  className={selectClass}
                  value={editBankId}
                  onChange={(event) => setEditBankId(event.target.value)}
                >
                  <option value="">Pilih bank</option>
                  {banks.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Fase Deal</Label>
              <select
                className={selectClass}
                value={editStageId}
                onChange={(event) => setEditStageId(event.target.value)}
              >
                <option value="">Pilih fase</option>
                {[...stages]
                  .filter(
                    (stage) => stage.isActive || stage.id === deal.stageId,
                  )
                  .sort((a, b) => a.position - b.position)
                  .map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned Sales</Label>
              <select
                className={selectClass}
                value={editAssignedUserId}
                onChange={(event) => setEditAssignedUserId(event.target.value)}
              >
                <option value="">Pilih sales</option>
                {users.map((sales) => (
                  <option key={sales.id} value={sales.id}>
                    {sales.name || sales.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="editNotes">Catatan Deal</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEdit} disabled={!editIsValid || isUpdating}>
              {isUpdating ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageOpen} onOpenChange={setStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Fase Deal</DialogTitle>
            <DialogDescription>
              Fase berasal dari konfigurasi Deals Pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <select
              className={selectClass}
              value={selectedStageId}
              onChange={(event) => setSelectedStageId(event.target.value)}
            >
              <option value="">Pilih fase</option>
              {[...stages]
                .sort((a, b) => a.position - b.position)
                .map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={saveStage}
              disabled={!selectedStageId || isUpdating}
            >
              Ubah Fase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Activity</DialogTitle>
            <DialogDescription>
              Catat interaksi atau tindak lanjut pada Deal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Jenis Activity</Label>
              <select
                className={selectClass}
                value={activityType}
                onChange={(event) => setActivityType(event.target.value)}
              >
                <option value="follow_up">Follow Up</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
                <option value="note">Catatan</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activityDescription">Keterangan</Label>
              <Textarea
                id="activityDescription"
                value={activityDescription}
                onChange={(event) => setActivityDescription(event.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={saveActivity}
              disabled={!activityDescription.trim() || isCreatingActivity}
            >
              Tambah Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}

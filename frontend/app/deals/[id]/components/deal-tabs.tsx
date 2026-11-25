"use client";

import { ActivityTimelineTab } from "@/app/leads/[id]/components/tabs/activity-timeline-tab";
import { AttachmentsTab } from "@/app/leads/[id]/components/tabs/attachments-tab";
import { NotesTab } from "@/app/leads/[id]/components/tabs/notes-tab";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Activity, Attachment, Note } from "@/lib/data";
import type { DealHistory } from "@/types/deal";
import { useState } from "react";
import { DealHistoryTab } from "./deal-history";

type AttachmentFormData = { name: string; file: FileList };

export function DealTabs({
  overview,
  activities,
  attachments,
  notes,
  history,
  onAddNote,
  onAddAttachment,
}: {
  /** Menerima fungsi untuk berpindah tab, mis. dari "Lihat Semua" Dokumen Penting. */
  overview: (openTab: (tab: string) => void) => React.ReactNode;
  activities: Activity[];
  attachments: Attachment[];
  notes: Note[];
  history: DealHistory[];
  onAddNote: (data: { content: string }) => Promise<void>;
  onAddAttachment: (data: AttachmentFormData) => void;
}) {
  const [tab, setTab] = useState("overview");
  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="border-b border-[#EAECF0] bg-white px-4">
        <TabsList
          variant="line"
          className="h-12 justify-start gap-7 bg-transparent"
        >
          <TabsTrigger value="overview" className="px-0">
            Overview
          </TabsTrigger>
          <TabsTrigger value="notes" className="px-0">
            Notes
          </TabsTrigger>
          <TabsTrigger value="history" className="px-0">
            History
          </TabsTrigger>
          <TabsTrigger value="activities" className="px-0">
            Activities
          </TabsTrigger>
          <TabsTrigger value="documents" className="px-0">
            Documents
            {attachments.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-1.5 h-5 rounded-full px-1.5 text-[10px]"
              >
                {attachments.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F9FAFB]">
        <TabsContent value="overview" className="m-0">
          {overview(setTab)}
        </TabsContent>
        <TabsContent value="activities" className="m-0 p-6">
          <ActivityTimelineTab activities={activities} entityLabel="deal" />
        </TabsContent>
        <TabsContent value="documents" className="m-0 p-6">
          <AttachmentsTab
            attachments={attachments}
            onAddAttachment={onAddAttachment}
            entityLabel="deal"
          />
        </TabsContent>
        <TabsContent value="notes" className="m-0 p-6">
          <NotesTab notes={notes} onAddNote={onAddNote} entityLabel="deal" />
        </TabsContent>
        <TabsContent value="history" className="m-0 p-6">
          <DealHistoryTab history={history} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

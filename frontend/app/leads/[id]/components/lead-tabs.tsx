"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PipelineStage } from "@/hooks/use-pipeline-stages";
import type { Attachment } from "@/lib/data";
import type { Lead } from "@/types/lead";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ActivitiesTab } from "./tabs/activities-tab";
import { AttachmentsTab } from "./tabs/attachments-tab";
import { OverviewTab } from "./tabs/overview-tab";

type AttachmentFormData = { name: string; file: FileList };

export function LeadTabs({ lead, stages, attachments, onAddActivity, onAddAttachment }: {
  lead: Lead;
  stages: PipelineStage[];
  attachments: Attachment[];
  onAddActivity: (data: { type: string; description: string }) => Promise<void>;
  onAddAttachment: (data: AttachmentFormData) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = ["overview", "activities", "documents"].includes(searchParams.get("tab") || "") ? searchParams.get("tab")! : "overview";
  const change = useCallback((value: string) => { const params = new URLSearchParams(searchParams.toString()); if (value === "overview") params.delete("tab"); else params.set("tab", value); router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }); }, [pathname, router, searchParams]);

  return <Tabs value={active} onValueChange={change} className="space-y-3">
    <TabsList variant="line" className="h-11 gap-6 border-b px-2">
      <TabsTrigger value="overview" className="px-1">Overview</TabsTrigger>
      <TabsTrigger value="activities" className="px-1">Activities <Badge variant="secondary" className="ml-1 rounded-full px-1.5">{lead.activities?.length ?? 0}</Badge></TabsTrigger>
      <TabsTrigger value="documents" className="px-1">Documents <Badge variant="secondary" className="ml-1 rounded-full px-1.5">{attachments.length}</Badge></TabsTrigger>
    </TabsList>
    <TabsContent value="overview" className="mt-0"><OverviewTab lead={lead} stages={stages} /></TabsContent>
    <TabsContent value="activities" className="mt-0"><ActivitiesTab lead={lead} stages={stages} onAddActivity={onAddActivity} /></TabsContent>
    <TabsContent value="documents" className="mt-0"><AttachmentsTab attachments={attachments} onAddAttachment={onAddAttachment} entityLabel="Lead" /></TabsContent>
  </Tabs>;
}

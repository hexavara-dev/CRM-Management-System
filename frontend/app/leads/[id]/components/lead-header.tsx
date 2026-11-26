"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import type { Lead } from "@/types/lead";
import { Archive, ArrowLeft, CalendarDays, Edit, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { LabelBadge } from "@/app/crm-configuration/leads-label/label-icons";

interface LeadHeaderProps {
  lead: Lead;
  onEditClick?: () => void;
  onConvertClick?: () => void;
  onArchiveClick?: () => void;
}

export function LeadHeader({ lead, onEditClick, onConvertClick, onArchiveClick }: LeadHeaderProps) {
  const router = useRouter();
  const fullName = `${lead.customer.firstName} ${lead.customer.lastName || ""}`.trim();
  const initials = `${lead.customer.firstName.charAt(0)}${lead.customer.lastName?.charAt(0) || ""}`.toUpperCase();
  const createdAt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(lead.createdAt));

  return (
    <header className="shrink-0 border-b bg-white px-4 py-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-[#475467]">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Kembali" onClick={() => router.back()}><ArrowLeft className="size-4" /></Button>
        <button type="button" onClick={() => router.push("/leads")} className="font-medium hover:text-[#0B63F6]">Leads</button>
        <span>›</span><span className="font-semibold text-[#101828]">Detail Lead</span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11 border border-[#D0D5DD]"><AvatarFallback className="bg-[#EFF6FF] font-semibold text-[#0B63F6]">{initials}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-lg font-bold text-[#101828]">{fullName}</h1>{lead.labels?.map((label) => <LabelBadge key={label.id} name={label.name} color={label.color} icon={label.icon} />)}</div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#475467]"><CalendarDays className="size-3.5" /> Dibuat: {createdAt}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-2">
          <Button type="button" className="bg-[#119447] hover:bg-[#0d7c3b]" onClick={onConvertClick} disabled={lead.converted} title={lead.converted ? "Lead ini sudah menjadi Deal" : "Convert Lead menjadi Deal"}><TrendingUp className="size-4" />{lead.converted ? "Sudah menjadi Deal" : "Convert to Deals"}</Button>
          <Button type="button" variant="outline" className="border-[#F04438] text-[#D92D20] hover:bg-[#FFF1F0] hover:text-[#D92D20]" onClick={onArchiveClick} title="Arsipkan Lead ini"><Archive className="size-4" /> Arsipkan Leads</Button>
          <Button type="button" variant="outline" size="icon" aria-label="Edit Lead" title="Edit Lead" onClick={onEditClick}><Edit className="size-4" /></Button>
        </div>
      </div>
    </header>
  );
}

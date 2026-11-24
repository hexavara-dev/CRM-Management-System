import type { Lead } from "@/types/lead";
import { CalendarClock, Megaphone, Target, UserRound } from "lucide-react";

function activityAge(value: string) {
  const days = Math.max(0, Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) / 86_400_000));
  return days === 0 ? "Hari ini" : `${days} hari lalu`;
}

export function LeadSummary({ lead }: { lead: Lead }) {
  const lastActivity = [...(lead.activities ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  const items = [
    { label: "Fase Leads", value: lead.stage?.name || "Belum ditentukan", icon: Target },
    { label: "Sumber Lead", value: lead.source?.name || "Belum ditentukan", icon: Megaphone },
    { label: "Assigned Sales", value: lead.assignedUser?.name || "Belum ditugaskan", icon: UserRound },
    { label: "Last Activity", value: lastActivity ? `${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(lastActivity.createdAt))} (${activityAge(lastActivity.createdAt)})` : "Belum ada aktivitas", icon: CalendarClock },
  ];
  return (
    <section className="grid overflow-hidden rounded-xl bg-[#F5F7FC] sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon }, index) => (
        <div key={label} className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? "lg:border-l" : ""}`}>
          <Icon className="size-5 shrink-0 text-[#344054]" />
          <div className="min-w-0"><p className="text-[11px] text-[#667085]">{label}</p><p className="truncate text-sm font-semibold text-[#101828]">{value}</p></div>
        </div>
      ))}
    </section>
  );
}

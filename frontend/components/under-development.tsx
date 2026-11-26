"use client";

import { Hammer } from "lucide-react";
import { PageHeading } from "@/components/PageHeading";
import { AppSidebar, SidebarOpenTrigger } from "@/components/Sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/** Halaman menu yang belum dibuat; menu tetap tampil agar rencana fiturnya terlihat. */
export function UnderDevelopment({ description }: { description: string }) {
  return (
    <SidebarProvider className="overflow-hidden">
      <AppSidebar />
      <SidebarInset className="w-0">
        <header className="flex shrink-0 items-center gap-2 px-4 pt-3 empty:hidden">
          <SidebarOpenTrigger />
        </header>
        <main className="space-y-4 p-4">
          <PageHeading />
          <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#D9D9DE] bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-[#E5F1FA] text-[#1980C0]">
              <Hammer className="size-7" />
            </span>
            <h2 className="text-lg font-semibold text-[#1f1f1f]">Fitur ini sedang dalam pengembangan</h2>
            <p className="max-w-md text-sm text-[#475467]">{description}</p>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

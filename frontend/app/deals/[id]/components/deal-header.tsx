"use client";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Deal } from "@/types/deal";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  Home,
  LockKeyhole,
  MoreVertical,
  Pencil,
  Phone,
  TrendingUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";

const date = (value: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));

export function DealHeader({
  deal,
  hasPendingLost,
  onLost,
  onEdit,
  onAddActivity,
  onChangeStage,
}: {
  deal: Deal;
  hasPendingLost: boolean;
  onLost: () => void;
  onEdit: () => void;
  onAddActivity: () => void;
  onChangeStage: () => void;
}) {
  const customer = deal.lead?.customer;
  const name = customer
    ? `${customer.firstName} ${customer.lastName || ""}`.trim()
    : "Customer tidak tersedia";

  return (
    <header className="border-b border-[#EAECF0] bg-white px-4 py-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-[#667085]">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-8 !self-center" />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-full"
          asChild
        >
          <Link href="/deals" aria-label="Kembali ke Deals">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <Link href="/deals" className="hover:text-[#1570EF]">
          Deals
        </Link>
        <span>›</span>
        <span className="font-semibold text-[#344054]">Detail Deal</span>
      </div>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#EFF8FF] text-[#1570EF]">
            <Home className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-[#101828]">
              {name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#667085]">
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {customer?.phoneNumber || "—"}
              </span>
              {deal.leadId && (
                <Link
                  href={`/leads/${deal.leadId}`}
                  title="Buka Lead asal Deal ini"
                  className="flex items-center gap-1 hover:text-[#1570EF]"
                >
                  <UserRound className="size-3" />
                  Dari Lead
                </Link>
              )}
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                Dibuat: {date(deal.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button
            size="sm"
            onClick={onLost}
            className={
              hasPendingLost
                ? "bg-[#F79009] hover:bg-[#DC6803]"
                : "bg-[#D92D20] hover:bg-[#B42318]"
            }
          >
            <LockKeyhole className="mr-1.5 size-4" />
            {hasPendingLost ? "Lost Pending" : "Lost Deals (Verifikasi)"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Menu Deal"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4" /> Edit Deal
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddActivity}>
                <Activity className="size-4" /> Tambah Activity
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onChangeStage}>
                <TrendingUp className="size-4" /> Ubah Fase Deal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

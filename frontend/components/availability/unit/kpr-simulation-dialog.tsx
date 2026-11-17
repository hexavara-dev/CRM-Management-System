"use client";

import { useState } from "react";

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
import { LabelText } from "@/components/ui/label-text";
import { formatRupiah } from "./format";
import type { UnitDetail } from "./types";

function parsePercent(value: string) {
  return value.trim() ? Number(value.replace(",", ".")) : NaN;
}

export function KprSimulationDialog({
  open,
  onOpenChange,
  unit,
  onReserve,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: UnitDetail;
  onReserve: () => void;
}) {
  const [downPaymentPercent, setDownPaymentPercent] = useState("20");
  const [annualInterestPercent, setAnnualInterestPercent] = useState("8");
  const [tenorYears, setTenorYears] = useState("15");

  const downPaymentRate = parsePercent(downPaymentPercent);
  const annualInterestRate = parsePercent(annualInterestPercent);
  const years = Number(tenorYears);
  const valid =
    Number.isFinite(unit.finalPrice) &&
    unit.finalPrice > 0 &&
    Number.isFinite(downPaymentRate) &&
    downPaymentRate >= 0 &&
    downPaymentRate <= 100 &&
    Number.isFinite(annualInterestRate) &&
    annualInterestRate >= 0 &&
    annualInterestRate <= 100 &&
    Number.isInteger(years) &&
    years >= 1 &&
    years <= 40;
  const downPayment = valid ? (unit.finalPrice * downPaymentRate) / 100 : 0;
  const principal = valid ? unit.finalPrice - downPayment : 0;
  const months = valid ? years * 12 : 0;
  const monthlyRate = valid ? annualInterestRate / 100 / 12 : 0;
  const monthlyPayment = !valid
    ? 0
    : monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Simulasi KPR</DialogTitle>
          <DialogDescription>
            Perkiraan cicilan Unit {unit.number}. Ubah angka di bawah untuk
            melihat simulasi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-[#e9f2ff] p-3">
            <p className="text-xs text-muted-foreground">
              Harga unit setelah promo
            </p>
            <p className="text-lg font-semibold text-[#075bea]">
              {formatRupiah(unit.finalPrice)}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <LabelText htmlFor="kpr-dp">Uang muka (%)</LabelText>
              <Input
                id="kpr-dp"
                value={downPaymentPercent}
                onChange={(event) => setDownPaymentPercent(event.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <LabelText htmlFor="kpr-interest">Bunga per tahun (%)</LabelText>
              <Input
                id="kpr-interest"
                value={annualInterestPercent}
                onChange={(event) =>
                  setAnnualInterestPercent(event.target.value)
                }
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <LabelText htmlFor="kpr-years">Tenor (tahun)</LabelText>
              <Input
                id="kpr-years"
                value={tenorYears}
                onChange={(event) => setTenorYears(event.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          {valid ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span>Uang muka</span>
                <strong>{formatRupiah(downPayment)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Pokok pinjaman</span>
                <strong>{formatRupiah(principal)}</strong>
              </div>
              <div className="flex justify-between gap-3 border-t pt-2">
                <span>Estimasi cicilan per bulan</span>
                <strong className="text-[#075bea]">
                  {formatRupiah(monthlyPayment)}
                </strong>
              </div>
            </div>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Isi uang muka 0–100%, bunga 0–100%, dan tenor 1–40 tahun.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Simulasi memakai bunga tetap dan belum termasuk biaya administrasi,
            asuransi, atau perubahan suku bunga. Nilai akhir mengikuti ketentuan
            bank.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          {unit.status === "Available" && (
            <Button type="button" onClick={onReserve}>
              Pesan Unit Ini
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

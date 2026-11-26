import type { Viewing } from "@/types/viewing";

const DEFAULT_DURATION_MINUTES = 60;
const EMPTY = "-";

export function getViewingCustomerName(viewing: Viewing): string {
  const customer = viewing.customer;
  if (customer) {
    const fullName = `${customer.firstName} ${customer.lastName ?? ""}`.trim();
    if (fullName) return fullName;
  }
  return viewing.name?.trim() || EMPTY;
}

export function getViewingPhone(viewing: Viewing): string {
  return viewing.customer?.phoneNumber || EMPTY;
}

export function getViewingSalesName(viewing: Viewing): string {
  return viewing.actor?.name || EMPTY;
}

export function getViewingProjectName(viewing: Viewing): string {
  return viewing.unit?.variant.product.name || EMPTY;
}

export function getViewingEndAt(viewing: Viewing): Date {
  const start = new Date(viewing.scheduledAt);
  const minutes = viewing.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  return new Date(start.getTime() + minutes * 60_000);
}

function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatViewingStartTime(viewing: Viewing): string {
  return formatClock(new Date(viewing.scheduledAt));
}

/** "10:00 - 11:00" in the browser's time zone, 24-hour clock. */
export function formatViewingTimeRange(viewing: Viewing): string {
  return `${formatViewingStartTime(viewing)} - ${formatClock(getViewingEndAt(viewing))}`;
}

/** "Dewi Anggraini" -> "DA"; a single word gives its first letter; empty gives "?". */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || name.trim() === EMPTY) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

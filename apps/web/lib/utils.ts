import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function parseApiTimestamp(dateString: string): Date {
  const raw = (dateString || "").trim();
  if (!raw) return new Date(Number.NaN);

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  if (hasTimezone) {
    return new Date(raw);
  }

  // Range-query rows may return minute keys like "2026-02-08T13:21:00"
  // without timezone info. Treat them as UTC to avoid local-time offsets.
  const isoNoTimezone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw);
  if (isoNoTimezone) {
    return new Date(`${raw}Z`);
  }

  // SQLite CURRENT_TIMESTAMP style: "YYYY-MM-DD HH:MM:SS"
  const sqliteUtc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw);
  if (sqliteUtc) {
    return new Date(raw.replace(" ", "T") + "Z");
  }

  return new Date(raw);
}

export function formatDuration(dateString: string): string {
  const date = parseApiTimestamp(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const diff = Math.max(0, now.getTime() - date.getTime());

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

export function getDomainColor(domain: string): string {
  const colors = [
    "#18181b",
    "#27272a",
    "#3f3f46",
    "#52525b",
    "#71717a",
    "#a1a1aa",
    "#d4d4d8",
    "#e4e4e7",
  ];

  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

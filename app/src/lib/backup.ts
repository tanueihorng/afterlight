// How safe is this record right now?
//
// The most likely way a patient loses years of entries is not a bug — it is clearing their
// browser. This module tracks how long it has been since the record left the device, so the app
// can say so once, calmly, and never nag.

import type { AllData } from "./db";
import type { AppMeta } from "./models";
import { daysBetween, todayLocal } from "./util";

/** Days after which an export is worth mentioning again. */
export const BACKUP_STALE_DAYS = 30;
/** Never raise the subject more often than this. */
export const NUDGE_INTERVAL_DAYS = 7;

export interface BackupState {
  lastExportAt?: string;
  daysSinceExport?: number;
  /** Records created or changed since the last export. */
  unsavedChanges: number;
  stale: boolean;
  neverExported: boolean;
  totalRecords: number;
}

export function countRecords(data: AllData): number {
  return Object.values(data).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
}

/** Records whose last change is more recent than the last export. */
export function changesSinceExport(data: AllData, lastExportAt?: string): number {
  if (!lastExportAt) return countRecords(data);
  let n = 0;
  for (const list of Object.values(data)) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const updated = (row as { updated_at?: string; created_at?: string }).updated_at;
      const created = (row as { created_at?: string }).created_at;
      const stamp = updated ?? created;
      if (stamp && stamp > lastExportAt) n++;
    }
  }
  return n;
}

export function backupState(data: AllData, meta?: AppMeta, today = todayLocal()): BackupState {
  const lastExportAt = meta?.last_export_at;
  const totalRecords = countRecords(data);
  const unsavedChanges = changesSinceExport(data, lastExportAt);
  const daysSinceExport = lastExportAt
    ? Math.max(0, daysBetween(lastExportAt.slice(0, 10), today))
    : undefined;

  return {
    lastExportAt,
    daysSinceExport,
    unsavedChanges,
    neverExported: !lastExportAt,
    stale:
      totalRecords > 0 &&
      unsavedChanges > 0 &&
      (daysSinceExport === undefined || daysSinceExport >= BACKUP_STALE_DAYS),
    totalRecords,
  };
}

/**
 * Whether to mention backing up at all. Deliberately conservative: nothing to say unless there is
 * something unsaved, the last export is old, and we have not raised it this week.
 */
export function shouldNudge(
  state: BackupState,
  lastNudgeAt: string | null,
  today = todayLocal(),
): boolean {
  if (!state.stale) return false;
  if (!lastNudgeAt) return true;
  return daysBetween(lastNudgeAt.slice(0, 10), today) >= NUDGE_INTERVAL_DAYS;
}

/* --------------------------------------------------------------- storage */

export interface StorageState {
  supported: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  persisted?: boolean;
}

export async function storageState(): Promise<StorageState> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { supported: false };
  }
  const { usage, quota } = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : undefined;
  return { supported: true, usageBytes: usage, quotaBytes: quota, persisted };
}

/**
 * Ask the browser not to evict this record. Browsers may refuse; the honest answer matters more
 * than the request, because a refusal is exactly when exporting becomes the only protection.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(n?: number): string {
  if (n === undefined) return "unknown";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

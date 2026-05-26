"use client";

import { getCurrentProfile } from "./cloudProgress";
import { isSupabaseConfigured, publicStorageUrl, restRequest, storageRequest } from "./supabaseClient";

export type SemesterId = "HS2025" | "FS2026";

export type SummaryBlock = {
  id: string;
  semester: SemesterId;
  title: string;
  order: number;
};

export type SummaryDownload = {
  id: string;
  title: string;
  semester: SemesterId;
  blockId: string;
  blockTitle: string;
  description: string;
  version: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  copyrightOwner: "Tim Weibel";
  fileData?: string;
  filePath?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
};

type SummaryDownloadRow = {
  id: string;
  title: string;
  semester: SemesterId;
  block_id: string;
  block_title: string;
  description: string | null;
  version: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  upload_date: string;
  copyright_owner: "Tim Weibel";
  file_data?: string | null;
  file_path?: string | null;
  download_url?: string | null;
  created_at: string;
  updated_at: string;
};

export const SUMMARY_DOWNLOADS_CHANGED_EVENT = "atlas-summary-downloads-changed";
export const COPYRIGHT_OWNER = "Tim Weibel" as const;
export const MAX_SUMMARY_FILE_SIZE = 50 * 1024 * 1024;

const STORAGE_BUCKET = "summary-downloads";
const STORAGE_KEY = "atlas-summary-downloads-v1";
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "md", "zip"]);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed"
]);

export const DOWNLOAD_SEMESTERS: Array<{ id: SemesterId; title: string; order: number }> = [
  { id: "HS2025", title: "HS2025", order: 1 },
  { id: "FS2026", title: "FS2026", order: 2 }
];

const SUMMARY_BLOCK_NUMBERS: Record<SemesterId, number[]> = {
  HS2025: [1, 2, 3, 4],
  FS2026: [5, 6, 7, 8, 9]
};

export const SUMMARY_BLOCKS: SummaryBlock[] = DOWNLOAD_SEMESTERS.flatMap((semester) => (
  SUMMARY_BLOCK_NUMBERS[semester.id].map((blockNumber, index) => ({
    id: `${semester.id}-block-${blockNumber}`,
    semester: semester.id,
    title: `Block ${blockNumber}`,
    order: index + 1
  }))
));

export function blocksForSemester(semester: SemesterId): SummaryBlock[] {
  return SUMMARY_BLOCKS
    .filter((block) => block.semester === semester)
    .sort((a, b) => a.order - b.order);
}

export function getSummaryBlock(blockId: string): SummaryBlock | null {
  return SUMMARY_BLOCKS.find((block) => block.id === blockId) || null;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatUploadDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function validateSummaryFile(file: File): string | null {
  if (!file) return "Bitte wähle eine Datei aus.";
  if (file.size > MAX_SUMMARY_FILE_SIZE) {
    return `Die Datei ist zu gross. Maximal erlaubt sind ${formatFileSize(MAX_SUMMARY_FILE_SIZE)}.`;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(extension) && !ALLOWED_TYPES.has(file.type)) {
    return "Dieser Dateityp wird für Zusammenfassungen nicht unterstützt.";
  }

  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export async function loadSummaryDownloads(): Promise<SummaryDownload[]> {
  if (isSupabaseConfigured()) {
    try {
      const rows = await restRequest<SummaryDownloadRow[]>(
        "summary_downloads?select=id,title,semester,block_id,block_title,description,version,file_name,file_type,file_size,upload_date,copyright_owner,file_path,download_url,created_at,updated_at&order=semester.asc,block_id.asc,created_at.desc"
      );
      return rows.map(fromRow);
    } catch {
      return readLocalDownloads();
    }
  }

  return readLocalDownloads();
}

export async function loadSummaryDownloadFile(id: string): Promise<SummaryDownload | null> {
  if (isSupabaseConfigured()) {
    try {
      const rows = await restRequest<SummaryDownloadRow[]>(
        `summary_downloads?select=*&id=eq.${encodeURIComponent(id)}`
      );
      return rows[0] ? fromRow(rows[0]) : null;
    } catch {
      return readLocalDownloads().find((item) => item.id === id) || null;
    }
  }

  return readLocalDownloads().find((item) => item.id === id) || null;
}

export async function saveSummaryDownload(download: SummaryDownload): Promise<SummaryDownload> {
  const normalized = normalizeDownload(download);

  if (isSupabaseConfigured()) {
    const profile = await getCurrentProfile().catch(() => null);
    if (profile?.role === "admin") {
      const rows = await restRequest<SummaryDownloadRow[]>("summary_downloads?on_conflict=id&select=*", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([toRow(normalized)])
      });
      notifyDownloadsChanged();
      return rows[0] ? fromRow(rows[0]) : normalized;
    }
  }

  const items = readLocalDownloads();
  const existingIndex = items.findIndex((item) => item.id === normalized.id);
  const next = existingIndex >= 0
    ? items.map((item, index) => index === existingIndex ? normalized : item)
    : [normalized, ...items];
  writeLocalDownloads(next);
  notifyDownloadsChanged();
  return normalized;
}

export async function deleteSummaryDownload(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const profile = await getCurrentProfile().catch(() => null);
    if (profile?.role === "admin") {
      const existing = await loadSummaryDownloadFile(id).catch(() => null);
      await restRequest(`summary_downloads?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (existing?.filePath) {
        await deleteSummaryStorageObject(existing.filePath).catch(() => undefined);
      }
      notifyDownloadsChanged();
      return;
    }
  }

  writeLocalDownloads(readLocalDownloads().filter((item) => item.id !== id));
  notifyDownloadsChanged();
}

export async function triggerSummaryDownload(summary: SummaryDownload): Promise<void> {
  const complete = summary.fileData ? summary : await loadSummaryDownloadFile(summary.id);
  if (!complete?.fileData && !complete?.downloadUrl && !complete?.filePath) {
    throw new Error("Download ist nicht verfügbar.");
  }

  const link = document.createElement("a");
  link.href = complete.fileData || complete.downloadUrl || (complete.filePath ? publicStorageUrl(STORAGE_BUCKET, complete.filePath) : "");
  link.download = complete.fileName || `${complete.title}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function uploadSummaryFileToStorage(file: File, summaryId: string): Promise<{ filePath: string; downloadUrl: string }> {
  const profile = await getCurrentProfile().catch(() => null);
  if (!isSupabaseConfigured() || profile?.role !== "admin") {
    throw new Error("Supabase Storage ist nur mit Admin-Account verfügbar.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "file";
  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "zusammenfassung";
  const filePath = `${summaryId}/${safeName}-${Date.now()}.${extension}`;

  await storageRequest(`object/${STORAGE_BUCKET}/${filePath}`, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "3600",
      "x-upsert": "true"
    },
    body: file
  });

  return {
    filePath,
    downloadUrl: publicStorageUrl(STORAGE_BUCKET, filePath)
  };
}

export function storageModeLabel(): string {
  return isSupabaseConfigured()
    ? "Supabase Storage, falls dein Account Admin-Rechte hat. Sonst lokaler Browser-Speicher."
    : "Lokaler Browser-Speicher.";
}

export async function canUseSummaryStorage(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const profile = await getCurrentProfile().catch(() => null);
  return profile?.role === "admin";
}

function readLocalDownloads(): SummaryDownload[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as SummaryDownload[];
    return Array.isArray(parsed) ? parsed.map(normalizeDownload) : [];
  } catch {
    return [];
  }
}

function writeLocalDownloads(items: SummaryDownload[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeDownload)));
  } catch {
    throw new Error("Der lokale Browser-Speicher reicht für diese Datei nicht aus. Nutze Supabase oder eine kleinere Datei.");
  }
}

function notifyDownloadsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SUMMARY_DOWNLOADS_CHANGED_EVENT));
}

function normalizeDownload(download: SummaryDownload): SummaryDownload {
  const block = getSummaryBlock(download.blockId);
  const now = new Date().toISOString();
  return {
    ...download,
    title: download.title.trim(),
    semester: download.semester,
    blockTitle: block?.title || download.blockTitle || "Block",
    description: download.description || "",
    version: download.version || "",
    fileType: download.fileType || "application/octet-stream",
    fileSize: Number(download.fileSize) || 0,
    uploadDate: download.uploadDate || now,
    copyrightOwner: COPYRIGHT_OWNER,
    createdAt: download.createdAt || now,
    updatedAt: download.updatedAt || now
  };
}

function fromRow(row: SummaryDownloadRow): SummaryDownload {
  return normalizeDownload({
    id: row.id,
    title: row.title,
    semester: row.semester,
    blockId: row.block_id,
    blockTitle: row.block_title,
    description: row.description || "",
    version: row.version || "",
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadDate: row.upload_date,
    copyrightOwner: row.copyright_owner,
    fileData: row.file_data || undefined,
    filePath: row.file_path || undefined,
    downloadUrl: row.download_url || (row.file_path ? publicStorageUrl(STORAGE_BUCKET, row.file_path) : undefined),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function toRow(download: SummaryDownload): SummaryDownloadRow {
  return {
    id: download.id,
    title: download.title,
    semester: download.semester,
    block_id: download.blockId,
    block_title: download.blockTitle,
    description: download.description || null,
    version: download.version || null,
    file_name: download.fileName,
    file_type: download.fileType,
    file_size: download.fileSize,
    upload_date: download.uploadDate,
    copyright_owner: COPYRIGHT_OWNER,
    file_data: download.fileData || null,
    file_path: download.filePath || null,
    download_url: download.downloadUrl || null,
    created_at: download.createdAt,
    updated_at: download.updatedAt
  };
}

async function deleteSummaryStorageObject(filePath: string): Promise<void> {
  await storageRequest(`object/${STORAGE_BUCKET}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [filePath] })
  });
}

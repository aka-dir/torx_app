/** Robust image collection for drag/drop and file picker (empty MIME types, HEIC, etc.). */

import type { DragEvent } from "react";

const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".heic", ".heif", ".avif"]);

function hasImageExtension(name: string): boolean {
  const lower = name.toLowerCase();
  for (const ext of IMG_EXTS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

/** Last path segment (ZIP entry paths, subfolders). */
function pathBasename(pathInZip: string): string {
  const n = pathInZip.replace(/\\/g, "/");
  const i = n.lastIndexOf("/");
  return i === -1 ? n : n.slice(i + 1);
}

/** True if the file name (or ZIP entry path) looks like a supported image. */
export function isProbablyImageFilename(pathInZip: string): boolean {
  return hasImageExtension(pathBasename(pathInZip));
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return hasImageExtension(file.name);
}

export function collectImageFiles(list: FileList | File[]): File[] {
  return Array.from(list).filter(isImageFile);
}

/** Use on dragenter + dragover + drop so the browser allows file drop. */
export function preventDragDefaults(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}

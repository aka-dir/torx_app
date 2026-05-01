import JSZip from "jszip";
import { isImageFile, isProbablyImageFilename } from "./collectFilesFromDrop";

function isZipFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".zip")) return true;
  const t = file.type;
  return t === "application/zip" || t === "application/x-zip-compressed" || t === "application/x-zip";
}

function archiveLabel(zipFileName: string): string {
  const lower = zipFileName.toLowerCase();
  if (lower.endsWith(".zip")) {
    const base = zipFileName.slice(0, -4).trim();
    return base || "archief";
  }
  return zipFileName.trim() || "archief";
}

/**
 * Flatten a user selection into image `File`s: loose images plus every image inside `.zip` archives.
 * Names from ZIPs are prefixed to avoid collisions (`map__folder__file.jpg`).
 */
export async function collectImagesFromUploadList(list: FileList | File[]): Promise<File[]> {
  const raw = Array.from(list);
  const out: File[] = [];
  const zips: File[] = [];

  for (const f of raw) {
    if (isZipFile(f)) zips.push(f);
    else if (isImageFile(f)) out.push(f);
  }

  for (const zipFile of zips) {
    const zip = await JSZip.loadAsync(zipFile);
    const prefix = archiveLabel(zipFile.name);
    for (const [relativePath, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const p = relativePath.replace(/\\/g, "/");
      if (p.includes("__MACOSX/") || p.endsWith(".DS_Store")) continue;
      if (!isProbablyImageFilename(p)) continue;
      const blob = await entry.async("blob");
      const flat = p.replace(/\//g, "__");
      const uniqueName = `${prefix}__${flat}`;
      const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : "";
      out.push(new File([blob], uniqueName, { type: type || undefined }));
    }
  }

  return out;
}

import * as pdfjs from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerConfigured = false;

function ensurePdfWorker() {
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
    workerConfigured = true;
  }
}

/** Rasterize each PDF page to a JPEG File (for layout / ordering via classify). */
export async function pdfFileToPageJpegs(pdfFile: File): Promise<File[]> {
  ensurePdfWorker();
  const data = new Uint8Array(await pdfFile.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const out: File[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.75 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.82));
    if (!blob) throw new Error(`Failed to rasterize PDF page ${i}`);
    out.push(new File([blob], `pdf-page-${i}.jpg`, { type: "image/jpeg" }));
  }
  return out;
}

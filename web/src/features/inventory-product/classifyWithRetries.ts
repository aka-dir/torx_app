import { extractClassifyItems, postClassify, type ClassifyItem } from "@/lib/inventoryClassify";

function mergeRetryPass(original: ClassifyItem[], retryItems: ClassifyItem[]): ClassifyItem[] {
  const byFile = new Map(retryItems.map((i) => [i.file, i]));
  return original.map((item) => {
    if (item.ok) return item;
    return byFile.get(item.file) ?? item;
  });
}

/**
 * Runs classify, then sends only still-failing files through the API once more.
 * Items that remain !ok become unclassified in the UI.
 */
export async function classifyWithFinalRetry(files: File[], chunkSize: number, dedupe: boolean): Promise<ClassifyItem[]> {
  const json = await postClassify(files, chunkSize, dedupe);
  const items = extractClassifyItems(json);
  const failedNames = new Set(items.filter((i) => !i.ok).map((i) => i.file));
  if (failedNames.size === 0) return items;

  const retryFiles = files.filter((f) => failedNames.has(f.name));
  if (retryFiles.length === 0) return items;

  const json2 = await postClassify(retryFiles, chunkSize, dedupe);
  const items2 = extractClassifyItems(json2);
  return mergeRetryPass(items, items2);
}

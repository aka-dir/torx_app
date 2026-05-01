import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sorterPath = path.join(root, "src/pages/ImageSorter.tsx");
const s = fs.readFileSync(sorterPath, "utf8");

const e1s = s.indexOf("/** ZIP export filename editor");
const e1e = s.indexOf("export default function ImageSorter()");
if (e1s < 0 || e1e < 0) throw new Error("editable / main marker not found");
let editable = s.slice(e1s, e1e);

const s2s = s.indexOf("function SelectedInspectPanel(");
const s2e = s.indexOf("function TempApiUsageReport(");
if (s2s < 0 || s2e < 0) throw new Error("inspect / temp marker not found");
let inspect = s.slice(s2s, s2e);

const s3s = s.indexOf("function ResultsView(");
if (s3s < 0) throw new Error("ResultsView not found");
let results = s.slice(s3s).trimEnd();

const header = `import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  Download,
  MessageSquare,
  ArrowRight,
  ImageIcon,
  Plus,
  Trash2,
  Info,
  RefreshCw,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { InventorySlot as Slot, InventoryUnclassified as Unclassified } from "@/lib/inventoryClassify";
import { fixedSlotOrdinal } from "@/lib/slotTemplates";
import { cn } from "@/lib/utils";
import type { ResultsLayoutMode } from "@/context/SorterSessionContext";

export const MANUAL_SLOT_PREFIX = "manual_" as const;
export function isManualSlotId(id: string): boolean {
  return id.startsWith(MANUAL_SLOT_PREFIX);
}
export type SlotDragPayload =
  | { source: "unclassified"; fileName: string }
  | { source: "slot"; slotId: string; fileName: string };

`;

editable = editable.replace(/^function EditableZipExportName/m, "export function EditableZipExportName");
inspect = inspect.replace(/^function SelectedInspectPanel/m, "export function SelectedInspectPanel");
results = results.replace(/^function ResultsView/m, "export function ResultsView");

const outDir = path.join(root, "src/components/inventory");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "SorterResultsPanels.tsx");
fs.writeFileSync(outPath, header + editable + inspect + results + "\n");
console.log("OK", outPath);

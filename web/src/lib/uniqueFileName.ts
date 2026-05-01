/**
 * If `name` is already in `taken`, returns `stem_2.ext`, `stem_3.ext`, … so each `File.name` in session stays unique.
 */
export function uniquifyFileName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const stem = dot > 0 ? name.slice(0, dot) : name;
  let n = 2;
  let candidate = `${stem}_${n}${ext}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${stem}_${n}${ext}`;
  }
  return candidate;
}

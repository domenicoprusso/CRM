function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function splitMultiValue(value: string | null | undefined) {
  return normalizeText(value)
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeFreeTag(value: string | null | undefined) {
  return normalizeText(value).replace(/\s+/g, " ");
}

export function normalizeProjectSlug(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return null;
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug || null;
}

export function projectTagFromValue(value: string | null | undefined) {
  const slug = normalizeProjectSlug(value);
  return slug ? `project:${slug}` : null;
}

export function projectTagsFromValue(value: string | null | undefined) {
  return splitMultiValue(value).map(projectTagFromValue).filter((tag): tag is string => Boolean(tag));
}

export function normalizeTagList(value: string | null | undefined) {
  return splitMultiValue(value).map(normalizeFreeTag).filter(Boolean);
}

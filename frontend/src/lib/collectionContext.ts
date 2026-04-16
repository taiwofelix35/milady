const STORAGE_KEY = "milady:selectedCollectionSlug";

export function saveSelectedCollectionSlug(slug: string) {
  if (typeof window === "undefined") return;
  if (!slug) return;
  window.localStorage.setItem(STORAGE_KEY, slug);
}

export function getSelectedCollectionSlug() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

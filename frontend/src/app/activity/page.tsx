import { redirect } from "next/navigation";
import { getCollectionBySlug } from "@/lib/collections";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawCollection = resolvedSearchParams.collection;
  const collectionSlug = Array.isArray(rawCollection) ? rawCollection[0] : rawCollection;

  const preferredSlug =
    typeof collectionSlug === "string" && getCollectionBySlug(collectionSlug)
      ? collectionSlug
      : "tempo-milady";

  redirect(`/collection/${preferredSlug}`);
}

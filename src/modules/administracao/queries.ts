import "server-only";

import { createSupabaseServerClient } from "@/core/db/server";
import type { CatalogoRow, EscritorioConfigRow } from "@/core/db/types";

export async function getConfig(): Promise<EscritorioConfigRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("escritorio_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data ?? null;
}

export async function listCatalogos(): Promise<
  Record<string, CatalogoRow[]>
> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("catalogos")
    .select("*")
    .order("tipo")
    .order("ordem");
  const grupos: Record<string, CatalogoRow[]> = {};
  for (const row of data ?? []) {
    (grupos[row.tipo] ??= []).push(row);
  }
  return grupos;
}

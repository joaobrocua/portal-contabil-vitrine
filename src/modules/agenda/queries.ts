import "server-only";

import { fetchTodos } from "@/core/db/pagination";
import { createSupabaseServerClient } from "@/core/db/server";
import type { EventoTipo } from "@/core/db/types";
import type { Departamento } from "@/core/types/domain";

export interface ItemAgenda {
  id: string;
  data: string; // YYYY-MM-DD
  titulo: string;
  tipo: EventoTipo;
  departamento: Departamento | null;
  empresaNome: string | null;
  origem: "manual" | "tarefa";
  refHref: string;
  concluido: boolean;
}

/** Une eventos manuais + prazos de tarefas no intervalo [inicio, fim]. */
export async function itensDoPeriodo(
  inicio: string,
  fim: string,
): Promise<ItemAgenda[]> {
  const supabase = await createSupabaseServerClient();

  // Pagina nos bastidores: o PostgREST corta em 1000 linhas sem avisar, e a
  // grade do mês precisa de todas. `id` desempata a ordem entre páginas.
  const [eventos, tarefas] = await Promise.all([
    fetchTodos((de, ate) =>
      supabase
        .from("eventos_agenda")
        .select(
          "id, data, titulo, tipo, departamento, concluido, empresa:empresas(razao_social, nome_fantasia)",
        )
        .gte("data", inicio)
        .lte("data", fim)
        .order("data")
        .order("id")
        .range(de, ate),
    ),
    fetchTodos((de, ate) =>
      supabase
        .from("tarefas")
        .select(
          "id, prazo, titulo, departamento, status, empresa:empresas(razao_social, nome_fantasia)",
        )
        .not("prazo", "is", null)
        .gte("prazo", inicio)
        .lte("prazo", fim)
        .order("prazo")
        .order("id")
        .range(de, ate),
    ),
  ]);

  type EventoSel = {
    id: string;
    data: string;
    titulo: string;
    tipo: string;
    departamento: string | null;
    concluido: boolean;
    empresa: { razao_social: string; nome_fantasia: string | null } | null;
  };
  type TarefaSel = {
    id: string;
    prazo: string;
    titulo: string;
    departamento: string | null;
    status: string;
    empresa: { razao_social: string; nome_fantasia: string | null } | null;
  };

  const nome = (e: { razao_social: string; nome_fantasia: string | null } | null) =>
    e ? e.nome_fantasia || e.razao_social : null;

  const a: ItemAgenda[] = (eventos as unknown as EventoSel[]).map((e) => ({
    id: `ev-${e.id}`,
    data: e.data,
    titulo: e.titulo,
    tipo: e.tipo as EventoTipo,
    departamento: (e.departamento as Departamento) ?? null,
    empresaNome: nome(e.empresa),
    origem: "manual",
    refHref: "/agenda",
    concluido: e.concluido,
  }));

  const b: ItemAgenda[] = (tarefas as unknown as TarefaSel[]).map((t) => ({
    id: `tf-${t.id}`,
    data: t.prazo as string,
    titulo: t.titulo,
    tipo: "prazo",
    departamento: (t.departamento as Departamento) ?? null,
    empresaNome: nome(t.empresa),
    origem: "tarefa",
    refHref: `/tarefas/${t.id}`,
    concluido: ["concluida", "cancelada"].includes(t.status as string),
  }));

  return [...a, ...b].sort((x, y) => (x.data < y.data ? -1 : 1));
}

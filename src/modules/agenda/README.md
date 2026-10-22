# Módulo: Agenda & Prazos

Calendário do escritório (item 14). É em boa parte uma **visão derivada**: une os
prazos de `tarefas` com os eventos manuais de `eventos_agenda`.

**Tabela própria:** `eventos_agenda` (lançamentos avulsos: reuniões, lembretes).

**Rota:** `/agenda?mes=YYYY-MM`.

**API pública** (`index.ts`): `itensDoPeriodo`, `MonthGrid`, `NovoEventoForm`.

# Módulo: Tarefas & Processos

Motor central do sistema (item 6). Toda atividade do escritório é uma tarefa com
responsável, departamento, competência, prazo, status, **checklist de etapas** e
**histórico**. Fiscal, DP, Contábil, Societário e IR (V2) são visões
especializadas sobre este motor — não motores próprios.

**Tabelas:** `tarefas`, `tarefa_itens`, `tarefa_documentos`, `tarefa_templates`.

**Rotas:** `/tarefas` (lista + filtros), `/tarefas/nova` (`?modelo=<id>` preenche
a partir de um modelo), `/tarefas/[id]` (situação + checklist + documentos
vinculados + histórico), `/tarefas/[id]/editar`, `/tarefas/modelos` (só admin).

**API pública** (`index.ts`): `listTarefas`, `getTarefa`, `contarTarefas`,
`empresasParaSelecao`, `listModelos`, `getModelo`, `documentosDaTarefa`,
`prazoDoModelo`, `TarefaForm`, `TarefasList`, `Checklist`, `StatusPicker`,
`TarefaStatusBadge`, `ModelosPanel`, `ModeloSelect`, `VincularDocumento`,
`DesvincularDocumento`.

Status entra em `concluida` → `concluida_em` é preenchido por trigger.

**Modelos** (`tarefa_templates`): admin cadastra título, departamento,
descrição, checklist e dia do prazo. Em Nova tarefa, o modelo preenche o
formulário; o checklist é copiado do banco (não do navegador) na criação.
A coluna `recorrencia` existe, mas gerar tarefas automaticamente todo mês é
V3 — hoje o modelo é sempre aplicado à mão.

**Documentos vinculados** (`tarefa_documentos`): só em tarefa de empresa, e o
documento tem que ser da mesma empresa (trigger na 0025).

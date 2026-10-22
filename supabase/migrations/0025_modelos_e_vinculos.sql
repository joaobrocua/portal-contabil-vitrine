-- =============================================================
-- 0025_modelos_e_vinculos.sql — telas de modelos de tarefa e de
-- documentos vinculados à tarefa
-- =============================================================
-- As duas tabelas existiam desde a 0003, mas sem tela. Antes de ligar a
-- interface, fecha as brechas de integridade que ela passaria a expor.

-- 1. tarefa_documentos.documento_id não tinha FK: apagar um documento
--    deixava vínculo apontando pro nada. Limpa órfãos e amarra com cascade.
delete from public.tarefa_documentos td
where not exists (select 1 from public.documentos d where d.id = td.documento_id);

alter table public.tarefa_documentos
  drop constraint if exists tarefa_documentos_documento_id_fkey;
alter table public.tarefa_documentos
  add constraint tarefa_documentos_documento_id_fkey
  foreign key (documento_id) references public.documentos(id) on delete cascade;

create index if not exists tarefa_documentos_documento_idx
  on public.tarefa_documentos (documento_id);

-- 2. Documento vinculado tem que ser da MESMA empresa da tarefa (a action
--    confere, mas a regra mora no banco pra não depender da tela).
create or replace function public.tarefa_documento_mesma_empresa()
returns trigger language plpgsql as $$
declare
  emp_tarefa uuid;
  emp_doc uuid;
begin
  select empresa_id into emp_tarefa from public.tarefas where id = new.tarefa_id;
  select empresa_id into emp_doc from public.documentos where id = new.documento_id;
  if emp_tarefa is null or emp_doc is distinct from emp_tarefa then
    raise exception 'O documento precisa ser da mesma empresa da tarefa.'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefa_documento_mesma_empresa on public.tarefa_documentos;
create trigger trg_tarefa_documento_mesma_empresa
  before insert or update on public.tarefa_documentos
  for each row execute function public.tarefa_documento_mesma_empresa();

-- 3. Modelos: dia do prazo válido e lista de itens sempre um array JSON.
update public.tarefa_templates set dia_prazo = null
where dia_prazo is not null and dia_prazo not between 1 and 31;
update public.tarefa_templates set itens_padrao = '[]'::jsonb
where jsonb_typeof(itens_padrao) is distinct from 'array';

alter table public.tarefa_templates
  drop constraint if exists tarefa_templates_dia_prazo_check;
alter table public.tarefa_templates
  add constraint tarefa_templates_dia_prazo_check
  check (dia_prazo is null or dia_prazo between 1 and 31);

alter table public.tarefa_templates
  drop constraint if exists tarefa_templates_itens_array_check;
alter table public.tarefa_templates
  add constraint tarefa_templates_itens_array_check
  check (jsonb_typeof(itens_padrao) = 'array');

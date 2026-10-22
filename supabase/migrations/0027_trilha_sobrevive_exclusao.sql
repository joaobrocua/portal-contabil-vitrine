-- =============================================================
-- 0027_trilha_sobrevive_exclusao.sql — excluir documento sem apagar a
-- trilha de acessos (LGPD)
-- =============================================================
-- documento_acessos.documento_id era `on delete cascade`: apagar um
-- documento apagava junto o registro de quem o enviou/baixou — o oposto do
-- que uma trilha de auditoria deve fazer. Agora a exclusão só solta o
-- vínculo (set null) e cada linha guarda uma cópia do título e da empresa,
-- pra continuar legível depois que o documento some. A própria exclusão
-- também entra na trilha (acao = 'excluiu', já prevista desde a 0004).

alter table public.documento_acessos
  add column if not exists documento_titulo text,
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null;

-- preenche o histórico que já existe
update public.documento_acessos a
   set documento_titulo = d.titulo,
       empresa_id = d.empresa_id
  from public.documentos d
 where d.id = a.documento_id
   and (a.documento_titulo is null or a.empresa_id is null);

alter table public.documento_acessos alter column documento_id drop not null;
alter table public.documento_acessos
  drop constraint if exists documento_acessos_documento_id_fkey;
alter table public.documento_acessos
  add constraint documento_acessos_documento_id_fkey
  foreign key (documento_id) references public.documentos(id) on delete set null;

create index if not exists doc_acessos_empresa_idx
  on public.documento_acessos (empresa_id, created_at desc);

-- Toda linha nova já nasce com título/empresa (o código não precisa mandar).
create or replace function public.doc_acesso_copia_dados()
returns trigger language plpgsql as $$
begin
  if new.documento_id is not null
     and (new.documento_titulo is null or new.empresa_id is null) then
    select coalesce(new.documento_titulo, d.titulo), coalesce(new.empresa_id, d.empresa_id)
      into new.documento_titulo, new.empresa_id
      from public.documentos d
     where d.id = new.documento_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_doc_acesso_copia_dados on public.documento_acessos;
create trigger trg_doc_acesso_copia_dados
  before insert on public.documento_acessos
  for each row execute function public.doc_acesso_copia_dados();

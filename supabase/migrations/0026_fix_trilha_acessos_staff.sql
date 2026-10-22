-- =============================================================
-- 0026_fix_trilha_acessos_staff.sql — staff voltou a gravar na trilha
-- =============================================================
-- Regressão da 0023: ao trocar `empresa_visivel(d.empresa_id)` por
-- `d.empresa_id = any(empresas_visiveis_ids())` na policy de INSERT de
-- documento_acessos, faltou o `is_staff() or` na frente — empresa_visivel()
-- já incluía staff; empresas_visiveis_ids() lista só empresas de contato.
-- Resultado: desde a 0023, upload/download feito por colaborador não ficava
-- registrado na trilha LGPD (o insert é best-effort no código, então não
-- aparecia erro nenhum). Cliente não foi afetado.

drop policy if exists doc_acessos_insert on public.documento_acessos;
create policy doc_acessos_insert on public.documento_acessos for insert
  with check (
    (select auth.uid()) is not null
    and profile_id = (select auth.uid())
    and exists (
      select 1 from public.documentos d
      where d.id = documento_acessos.documento_id
        and ((select public.is_staff())
             or d.empresa_id = any ((select public.empresas_visiveis_ids())::uuid[])))
  );

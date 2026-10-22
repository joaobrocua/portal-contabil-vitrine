-- =============================================================
-- 0016_fix_profiles_self_escalation.sql
-- Corrige escalonamento de privilégio: a policy `profiles_self_update`
-- (0001_core.sql) só restringe QUAL linha pode ser alterada
-- (id = auth.uid()), não QUAIS colunas — RLS no Postgres é por linha,
-- não por coluna. Isso permitia qualquer usuário autenticado, incluindo
-- papel 'cliente', promover a si mesmo a 'admin' direto pelo client
-- (supabase.from('profiles').update({ papel: 'admin' })...), já que
-- essa policy é permissiva e é OR-combinada com `profiles_admin_write`.
--
-- Trigger, não policy, porque RLS não faz checagem por coluna.
-- =============================================================

create or replace function public.protect_profile_privilege_columns()
returns trigger
language plpgsql
set search_path = public as $$
begin
  -- auth.uid() nulo = sessão sem JWT de usuário (service_role da API
  -- admin, ou conexão direta via psql/Studio para bootstrap do primeiro
  -- admin) — não passa pela RLS mesmo, então não há o que proteger aqui.
  -- auth.uid() presente + is_admin() = admin de verdade alterando
  -- (o próprio ou outro usuário) via profiles_admin_write — permitido.
  -- Só bloqueia quando é um usuário autenticado não-admin tentando
  -- mudar as próprias colunas privilegiadas via profiles_self_update.
  if auth.uid() is not null and not public.is_admin() then
    if new.papel is distinct from old.papel
       or new.ativo is distinct from old.ativo
       or new.departamento is distinct from old.departamento
    then
      raise exception
        'Apenas administradores podem alterar papel, ativo ou departamento.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privilege on public.profiles;
create trigger trg_profiles_protect_privilege
  before update on public.profiles
  for each row
  execute function public.protect_profile_privilege_columns();

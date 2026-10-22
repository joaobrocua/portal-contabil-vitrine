-- O escritório nunca pode ficar sem administrador ativo.
--
-- A tela de Usuários já recusa rebaixar/desativar o último admin, mas só no
-- servidor: dois admins se alterando ao mesmo tempo passam os dois pela
-- checagem (cada um enxerga o outro como "admin restante"), e quem usa a API
-- direto nem passa por ela. Aqui o banco garante, serializando as alterações.

create or replace function public.profiles_protege_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- só importa quando um admin ATIVO deixa de sê-lo (rebaixado, desativado ou apagado)
  if old.papel = 'admin' and old.ativo
     and (tg_op = 'DELETE' or new.papel <> 'admin' or not new.ativo) then
    -- uma alteração por vez: sem isto, duas transações simultâneas contariam o
    -- mesmo "outro admin" e as duas passariam
    perform pg_advisory_xact_lock(hashtext('profiles_ultimo_admin'));
    if not exists (
      select 1 from public.profiles
      where papel = 'admin' and ativo and id <> old.id
    ) then
      raise exception 'O escritório precisa ter ao menos um administrador ativo.'
        using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_protege_ultimo_admin() from public, anon, authenticated;

drop trigger if exists profiles_ultimo_admin on public.profiles;
create trigger profiles_ultimo_admin
  before update or delete on public.profiles
  for each row execute function public.profiles_protege_ultimo_admin();

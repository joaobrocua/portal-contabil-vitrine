-- =============================================================
-- 0020_fix_signup_e_usuario_inativo.sql
--
-- 1) handle_new_user copiava `papel`/`departamento` de raw_user_meta_data
--    — dado controlado por quem se cadastra. Com o cadastro público do
--    GoTrue aberto, qualquer pessoa fazia signup com
--    data: { papel: "admin" } e virava admin. Agora todo usuário novo nasce
--    como 'cliente' sem departamento; o papel real é gravado depois pela
--    action criarUsuario (service role) ou por um admin.
--
-- 2) is_admin()/is_papel() e o ramo "cliente" de empresa_visivel() não
--    olhavam `ativo`. Um usuário desativado seguia com acesso via API até o
--    JWT expirar (e um admin desativado conseguia se reativar). is_staff()
--    já conferia `ativo`; agora todos conferem.
-- =============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, papel, departamento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    'cliente',
    null
  )
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel = 'admin' and ativo from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_papel(variadic p_papeis papel[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select papel = any(p_papeis) and ativo from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.empresa_visivel(p_empresa uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1
        from public.contatos c
        join public.profiles p on p.id = c.profile_id
       where c.empresa_id = p_empresa
         and c.profile_id = auth.uid()
         and p.ativo
    )
$$;

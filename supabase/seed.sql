-- =============================================================
-- seed.sql — Primeiro acesso
-- Rode DEPOIS das migrations 0001..0005.
-- =============================================================

-- -------------------------------------------------------------
-- PASSO 1 — Criar o usuário administrador
-- -------------------------------------------------------------
-- Opção A (recomendada): No painel do Supabase, vá em
--   Authentication → Users → Add user → Create new user
--   E-mail: o e-mail do administrador
--   Password: defina uma senha
--   Marque "Auto Confirm User".
--
-- Depois, rode o UPDATE abaixo trocando o e-mail:

update public.profiles
   set papel = 'admin',
       nome  = 'Administrador',
       ativo = true
 where email = 'ALTERE_PARA_O_EMAIL_DO_ADMIN@exemplo.com';

-- -------------------------------------------------------------
-- Opção B (via SQL) — descomente e ajuste e-mail/senha.
-- Cria o usuário direto em auth.users. Requer extensão pgcrypto (já habilitada).
-- -------------------------------------------------------------
-- do $$
-- declare
--   novo_id uuid := gen_random_uuid();
--   v_email text := 'admin@exemplo.com.br';
--   v_senha text := 'trocar-esta-senha';
-- begin
--   insert into auth.users
--     (instance_id, id, aud, role, email, encrypted_password,
--      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
--      created_at, updated_at)
--   values
--     ('00000000-0000-0000-0000-000000000000', novo_id, 'authenticated',
--      'authenticated', v_email, crypt(v_senha, gen_salt('bf')),
--      now(), '{"provider":"email","providers":["email"]}',
--      '{"nome":"Administrador","papel":"admin"}', now(), now());
--
--   insert into auth.identities
--     (provider_id, user_id, identity_data, provider, last_sign_in_at,
--      created_at, updated_at)
--   values
--     (novo_id::text, novo_id,
--      jsonb_build_object('sub', novo_id::text, 'email', v_email),
--      'email', now(), now(), now());
-- end $$;

-- -------------------------------------------------------------
-- PASSO 2 (opcional) — dados de exemplo para testar o sistema
-- -------------------------------------------------------------
-- insert into public.empresas (razao_social, nome_fantasia, cnpj, regime_tributario, municipio, uf)
-- values
--   ('ABC Comércio de Alimentos LTDA', 'ABC Alimentos', '11222333000181', 'simples_nacional', 'Sinop', 'MT'),
--   ('XYZ Serviços de Tecnologia LTDA', 'XYZ Tech', '44555666000199', 'lucro_presumido', 'Sinop', 'MT')
-- on conflict (cnpj) do nothing;

-- Correção do trigger de conclusão de tarefa (rode uma vez no SQL Editor)
create or replace function public.tarefa_marca_conclusao()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida'
     and (old.status is null or old.status is distinct from 'concluida') then
    new.concluida_em = now();
  elsif new.status <> 'concluida' then
    new.concluida_em = null;
  end if;
  return new;
end $$;

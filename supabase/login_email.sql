-- =====================================================================
--  Login com código por e-mail (para quem não consegue entrar com o Google)
--  Rode este arquivo uma vez no Supabase (SQL Editor). Pode rodar de novo.
--  Só CRIA uma função. Não altera nem apaga nenhum dado.
--
--  login_lookup: na tela de login, diz se o e-mail já tem conta no clã e
--  mostra o nome só parcialmente ("Valkyria" -> "Va*****a"). O nome
--  completo nunca sai do banco. Com o mesmo e-mail da conta Google, a
--  pessoa entra na MESMA conta (o Supabase junta pelo e-mail).
-- =====================================================================
create or replace function public.login_lookup(p_email text) returns text
language sql stable security definer set search_path = public as $$
  select (
    select string_agg(
             case
               when char_length(w) <= 2 then left(w, 1) || repeat('*', char_length(w) - 1)
               when char_length(w) <= 4 then left(w, 1) || repeat('*', char_length(w) - 2) || right(w, 1)
               else left(w, 2) || repeat('*', char_length(w) - 3) || right(w, 1)
             end, ' ' order by i)
      from unnest(string_to_array(trim(n.nome), ' ')) with ordinality as t(w, i)
     where w <> ''
  )
  from (
    select coalesce(nullif(p.game_name, ''), nullif(p.google_name, ''), 'Sem nome') as nome
      from auth.users u
      join public.profiles p on p.id = u.id
     where lower(u.email) = lower(trim(p_email))
       and length(trim(coalesce(p_email, ''))) between 3 and 254
     limit 1
  ) n;
$$;

revoke execute on function public.login_lookup(text) from public;
grant  execute on function public.login_lookup(text) to anon, authenticated;

notify pgrst, 'reload schema';

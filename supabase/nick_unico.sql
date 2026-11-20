-- =====================================================================
--  Nick único (evita alguém se passar por outro membro, como o líder)
--
--  Duas contas ativas (aguardando aprovação, membro, oficial ou líder) não
--  podem ter o mesmo nick. A comparação ignora maiúsculas, acentos e espaços
--  extras ("Máximus" = "maximus "). Ex-membros não contam: o nick de quem
--  saiu do clã pode ser usado de novo.
--
--  Antes de ativar, este arquivo VERIFICA se já existem nicks repetidos.
--  Se existirem, ele para sem alterar nada e mostra a lista: troque os nicks
--  repetidos (Membros → ✎ Nick) e rode de novo.
--
--  Pode ser executado de novo. Nenhum dado é alterado.
-- =====================================================================

-- Forma usada para comparar nicks
create or replace function public.nick_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(regexp_replace(
           translate(lower(btrim(coalesce(p, ''))),
                     'áàâãäåéèêëíìîïóòôõöúùûüçñý', 'aaaaaaeeeeiiiiooooouuuucny'),
           '\s+', ' ', 'g'), '')
$$;

-- 1. Verificação: há nicks repetidos entre as contas ativas?
do $$
declare v_list text;
begin
  select string_agg(format('"%s" → %s', g.nick, g.who), E'\n' order by g.nick) into v_list
  from (
    select min(btrim(p.game_name)) as nick,
           string_agg(format('%s (%s, entrou em %s)', btrim(p.game_name), p.role, to_char(p.created_at, 'DD/MM/YYYY')), ', ') as who
      from public.profiles p
     where p.role in ('pending', 'member', 'officer', 'leader') and public.nick_key(p.game_name) is not null
     group by public.nick_key(p.game_name)
    having count(*) > 1
  ) g;
  if v_list is not null then
    raise exception E'Existem nicks repetidos. Troque-os (Membros → ✎ Nick) e rode este arquivo de novo:\n%', v_list;
  end if;
end $$;

-- 2. A regra: vale ao trocar o nick e ao aprovar ou readmitir alguém
create or replace function public.nick_unique_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_other text;
begin
  if public.nick_key(new.game_name) is null or new.role not in ('pending', 'member', 'officer', 'leader') then
    return new;
  end if;
  if tg_op = 'UPDATE' and public.nick_key(new.game_name) is not distinct from public.nick_key(old.game_name)
     and old.role in ('pending', 'member', 'officer', 'leader') then
    return new; -- nada mudou no nick nem no estado da conta
  end if;
  select btrim(p.game_name) into v_other
    from public.profiles p
   where p.id <> new.id and p.role in ('pending', 'member', 'officer', 'leader')
     and public.nick_key(p.game_name) = public.nick_key(new.game_name)
   limit 1;
  if v_other is not null then
    raise exception 'O nick "%" já é usado por outro membro do clã. Escolha outro.', btrim(new.game_name)
      using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists profiles_nick_unique on public.profiles;
create trigger profiles_nick_unique before insert or update of game_name, role on public.profiles
  for each row execute function public.nick_unique_check();

revoke execute on function public.nick_unique_check() from public, anon, authenticated;

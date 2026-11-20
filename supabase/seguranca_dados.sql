-- =====================================================================
--  Segurança: o que um membro comum consegue ler direto pela API
--  (Postman, console do navegador etc.) fica igual ao que o site mostra.
--
--  1. Perfis: só oficiais e líder recebem a lista de perfis (list_profiles).
--     O membro comum lê só as próprias contas (inclusive as que pilota).
--     Dos outros, a função my_people entrega APENAS O NOME (sem foto, sem
--     endereço de imagem, sem cargo) de quem aparece para ele no site:
--     colegas de time, recrutamentos que ele vê (os candidatos com classe
--     e atributos, como o site mostra), ganhadores do sorteio, quem atendeu
--     os tickets dele, pilotos das contas dele e autores do Malah News.
--     Para pedir acesso de piloto, find_accounts busca uma conta pelo nick
--     (mínimo de 3 letras, até 8 resultados, só o nome e a classe).
--  2. Média do clã (painel "Meu perfil"): função clan_averages, que
--     devolve só as médias, sem os atributos de cada um.
--  3. Respostas dos eventos: membro comum lê só as respostas das contas
--     que controla. Os colegas de time continuam aparecendo no site
--     (pelas vagas do time), sem o motivo do pedido de saída, quem
--     respondeu e os atributos daquele evento.
--
--  Oficiais e líder continuam vendo tudo. Nenhum dado é alterado ou
--  apagado. Pode ser executado de novo (sempre a versão mais recente).
-- =====================================================================

-- ---------- 1. Perfis ----------
-- Lista completa: só oficiais e líder. Membro comum recebe só as próprias contas.
create or replace function public.list_profiles() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(to_jsonb(p) order by p.created_at), '[]'::json)
  from public.profiles p
  where public.is_officer() or public.can_act_as(p.id)
$$;

-- Nome de quem aparece para o membro no site (sem foto, sem cargo, sem datas)
create or replace function public.my_people() returns json
language sql stable security definer set search_path = public as $$
  with vis as (   -- recrutamentos que eu vejo
    select r.* from public.recruitments r where r.status = 'open' or r.created_by = auth.uid()
  ), ids as (
    -- colegas dos meus times
    select ts.user_id as id, false as attrs from public.team_slots ts
     where ts.team in (select public.my_teams(ts.event_id))
    -- recrutamentos: quem criou, quem aprovou e os candidatos (com atributos)
    union all select v.created_by, false from vis v
    union all select v.decided_by, false from vis v
    union all select a.user_id, true from public.recruit_applications a join vis v on v.id = a.recruit_id
    -- ganhadores dos sorteios
    union all select w.user_id, false from public.raffle_winners w
    -- quem atendeu os meus tickets
    union all select t.assigned_to, false from public.tickets t where t.author_id = auth.uid()
    union all select m.author_id, false from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
     where t.author_id = auth.uid() and not m.internal
    union all select l.actor, false from public.ticket_log l join public.tickets t on t.id = l.ticket_id
     where t.author_id = auth.uid()
    -- pilotos das minhas contas e contas que eu piloto
    union all select ap.pilot_id, false from public.account_pilots ap where public.can_act_as(ap.account_id)
    union all select ap.account_id, false from public.account_pilots ap where ap.pilot_id = auth.uid()
    -- autores do Malah News
    union all select n.author_id, false from public.news_posts n
  ), g as (
    select id, bool_or(attrs) as attrs from ids where id is not null group by id
  )
  select case when not public.is_member() then '[]'::json else coalesce(json_agg(
      jsonb_build_object(
        'id', p.id,
        'game_name', coalesce(nullif(trim(p.game_name), ''), nullif(trim(p.google_name), ''), 'Membro'),
        'google_name', '',
        'char_class', case when p.role = 'former' then null else p.char_class end)
      || case when g.attrs and p.role <> 'former' then jsonb_build_object(
           'armor', p.armor, 'armor_pen', p.armor_pen, 'potency', p.potency,
           'resistance', p.resistance, 'resonance', p.resonance)
         else '{}'::jsonb end), '[]'::json) end
  from g join public.profiles p on p.id = g.id
  where not public.can_act_as(p.id)
$$;

-- Busca de conta para o pedido de piloto: mínimo de 3 letras, até 8 resultados, só nome e classe
create or replace function public.find_accounts(p_q text) returns json
language sql stable security definer set search_path = public as $$
  with q as (
    select replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as s
  )
  select case when not public.is_member() or char_length((select s from q)) < 3 then '[]'::json
    else coalesce((select json_agg(x) from (
      select p.id, coalesce(nullif(trim(p.game_name), ''), p.google_name) as game_name, p.char_class
        from public.profiles p
       where p.role in ('member', 'officer', 'leader') and p.id <> auth.uid()
         and coalesce(nullif(trim(p.game_name), ''), p.google_name) ilike '%' || (select s from q) || '%'
       order by 2 limit 8) x), '[]'::json) end
$$;

revoke execute on function public.my_people()         from public, anon;
revoke execute on function public.find_accounts(text) from public, anon;
grant  execute on function public.my_people()         to authenticated;
grant  execute on function public.find_accounts(text) to authenticated;

revoke execute on function public.list_profiles() from public, anon;
grant  execute on function public.list_profiles() to authenticated;

-- Leitura direta da tabela: só as próprias contas (inclusive pilotadas), oficiais e líder
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (public.can_act_as(id) or public.is_officer());

-- ---------- 2. Média do clã ----------
create or replace function public.clan_averages() returns json
language sql stable security definer set search_path = public as $$
  select case when public.is_member() then json_build_object(
      'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
      'resistance', round(avg(resistance)), 'resonance', round(avg(resonance)), 'count', count(*))
    end
  from public.profiles
  where role in ('member', 'officer', 'leader') and char_class is not null
    and armor is not null and armor_pen is not null and potency is not null
    and resistance is not null and resonance is not null
$$;

revoke execute on function public.clan_averages() from public, anon;
grant  execute on function public.clan_averages() to authenticated;

-- ---------- 3. Respostas dos eventos ----------
drop policy if exists "rsvps_select" on public.rsvps;
create policy "rsvps_select" on public.rsvps
  for select to authenticated
  using (public.can_act_as(user_id) or public.is_officer());

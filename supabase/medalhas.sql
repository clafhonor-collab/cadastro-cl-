-- =====================================================================
--  Medalhas (Novembro/2026)
--  Calcula, para cada membro ativo, só o necessário para as medalhas:
--    streak         = presenças seguidas (do evento mais recente para trás)
--    perfect_months = meses fechados com 100% de presença (mínimo 4 eventos)
--    res_gain       = Ressonância ganha desde o primeiro valor registrado
--  Eventos de ausência programada (sem presença) não quebram a sequência
--  nem o mês perfeito.
--  Oficiais e líder recebem os números exatos. O membro comum recebe só o
--  NÍVEL de cada medalha, que é o que o site mostra (sequência 5/10/20/50;
--  Ressonância +500/+1.000/+2.000), seguindo as regras de seguranca_dados.sql.
--  Só ADICIONA uma função. Nenhum dado é alterado ou apagado.
--  Depende de ausencias.sql (coluna rsvps.absence_id).
-- =====================================================================
create or replace function public.member_badges()
returns table (user_id uuid, streak integer, perfect_months integer, res_gain integer)
language sql stable security definer set search_path = public as $$
  with mem as (
    select p.id, p.created_at, p.resonance
      from public.profiles p
     where public.is_member() and p.role in ('member', 'officer', 'leader')
  ),
  reg as (
    select e.id, e.starts_at
      from public.events e
     where e.starts_at <= now() and exists (select 1 from public.attendance a where a.event_id = e.id)
  ),
  hist0 as (
    select m.id as uid, r.id as event_id, r.starts_at,
           coalesce((select a.present from public.attendance a where a.event_id = r.id and a.user_id = m.id), false) as was
      from mem m join reg r on r.starts_at >= m.created_at
  ),
  hist as (
    select h.uid, h.starts_at, h.was from hist0 h
     where h.was or not exists (select 1 from public.rsvps v
                                 where v.event_id = h.event_id and v.user_id = h.uid and v.absence_id is not null)
  ),
  ordered as (
    select uid, was,
           sum(case when was then 0 else 1 end) over (partition by uid order by starts_at desc rows unbounded preceding) as misses
      from hist
  ),
  stk as (select uid, (count(*) filter (where misses = 0))::int as streak from ordered group by uid),
  months as (
    select uid, date_trunc('month', starts_at at time zone 'America/Sao_Paulo') as mon, count(*) as n, bool_and(was) as all_in
      from hist group by uid, date_trunc('month', starts_at at time zone 'America/Sao_Paulo')
  ),
  pm as (
    select uid, (count(*) filter (where n >= 4 and all_in
                   and mon < date_trunc('month', now() at time zone 'America/Sao_Paulo')))::int as perfect
      from months group by uid
  ),
  rg as (
    select distinct on (h.user_id) h.user_id as uid, (h.changes -> 'resonance' ->> 0)::numeric as first_val
      from public.profile_history h
     where h.changes ? 'resonance' and jsonb_typeof(h.changes -> 'resonance' -> 0) = 'number'
     order by h.user_id, h.changed_at asc
  ),
  res as (
    select m.id, coalesce(s.streak, 0) as streak, coalesce(p.perfect, 0) as perfect,
           greatest(0, coalesce(m.resonance - rg.first_val, 0))::int as gain
      from mem m
      left join stk s on s.uid = m.id
      left join pm  p on p.uid = m.id
      left join rg    on rg.uid = m.id
  )
  select r.id,
         case when public.is_officer() then r.streak
              else case when r.streak >= 50 then 50 when r.streak >= 20 then 20 when r.streak >= 10 then 10 when r.streak >= 5 then 5 else 0 end end,
         r.perfect,
         case when public.is_officer() then r.gain
              else case when r.gain >= 2000 then 2000 when r.gain >= 1000 then 1000 when r.gain >= 500 then 500 else 0 end end
    from res r;
$$;

revoke execute on function public.member_badges() from public, anon;
grant  execute on function public.member_badges() to authenticated;

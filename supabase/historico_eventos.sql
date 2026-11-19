-- =====================================================================
--  Histórico de alterações dos eventos (quem mexeu no evento e em cada sala)
--  Só ADICIONA uma tabela, funções e gatilhos, e troca a função save_teams
--  por uma versão que também registra o histórico (mesmo funcionamento).
--  Nenhum dado existente é alterado ou apagado. Pode ser executado de novo.
--  O histórico começa a contar a partir de quando este arquivo for executado.
-- =====================================================================

create table if not exists public.event_log (
  id       bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  at       timestamptz not null default now(),
  actor    uuid references public.profiles(id) on delete set null,
  kind     text not null check (kind in ('created', 'edit', 'format', 'rename', 'lock', 'unlock', 'room')),
  room     text,
  detail   jsonb not null default '{}'::jsonb
);
create index if not exists event_log_event_idx on public.event_log (event_id, at desc);

alter table public.event_log enable row level security;

-- Só líder e oficiais leem; as escritas são só pelos gatilhos abaixo
drop policy if exists "event_log_select" on public.event_log;
create policy "event_log_select" on public.event_log
  for select to authenticated using (public.is_officer());

-- ---------- Alterações no próprio evento ----------
create or replace function public.log_event_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb := '{}'::jsonb;
  i int;
  o text;
  n text;
begin
  if tg_op = 'INSERT' then
    insert into public.event_log (event_id, actor, kind) values (new.id, auth.uid(), 'created');
    return new;
  end if;

  if new.title is distinct from old.title then d := d || jsonb_build_object('title', jsonb_build_array(old.title, new.title)); end if;
  if new.description is distinct from old.description then d := d || jsonb_build_object('description', true); end if;
  if new.starts_at is distinct from old.starts_at then d := d || jsonb_build_object('starts_at', jsonb_build_array(old.starts_at, new.starts_at)); end if;
  if new.type_id is distinct from old.type_id then d := d || jsonb_build_object('type_id', jsonb_build_array(old.type_id, new.type_id)); end if;
  if new.rsvp_close_minutes is distinct from old.rsvp_close_minutes then
    d := d || jsonb_build_object('rsvp_close_minutes', jsonb_build_array(old.rsvp_close_minutes, new.rsvp_close_minutes));
  end if;
  if d <> '{}'::jsonb then
    insert into public.event_log (event_id, actor, kind, detail) values (new.id, auth.uid(), 'edit', d);
  end if;

  if (new.team_format, new.team_count) is distinct from (old.team_format, old.team_count) then
    insert into public.event_log (event_id, actor, kind, detail)
    values (new.id, auth.uid(), 'format', jsonb_build_object(
      'format', jsonb_build_array(old.team_format, new.team_format),
      'count',  jsonb_build_array(old.team_count, new.team_count)));
  elsif new.team_names is distinct from old.team_names then
    -- Renomear time (formato Outros): uma linha por time renomeado
    for i in 1..10 loop
      o := coalesce(nullif(btrim(old.team_names[i]), ''), 'Time ' || i);
      n := coalesce(nullif(btrim(new.team_names[i]), ''), 'Time ' || i);
      if o <> n then
        insert into public.event_log (event_id, actor, kind, room, detail)
        values (new.id, auth.uid(), 'rename', n, jsonb_build_object('from', o, 'to', n));
      end if;
    end loop;
  end if;

  if new.teams_locked is distinct from old.teams_locked then
    insert into public.event_log (event_id, actor, kind)
    values (new.id, auth.uid(), case when new.teams_locked then 'lock' else 'unlock' end);
  end if;
  return new;
end $$;

drop trigger if exists events_log on public.events;
create trigger events_log after insert or update on public.events
  for each row execute function public.log_event_change();

-- ---------- Salas (times) ----------
-- Registra, por sala, quem entrou e quem saiu (comparando antes e depois)
create or replace function public.log_room_diff(p_event bigint, p_old jsonb, p_new jsonb) returns void
language sql security definer set search_path = public as $$
  with o as (select x ->> 'team' as team, (x ->> 'user_id')::uuid as uid from jsonb_array_elements(coalesce(p_old, '[]'::jsonb)) x),
       n as (select x ->> 'team' as team, (x ->> 'user_id')::uuid as uid from jsonb_array_elements(coalesce(p_new, '[]'::jsonb)) x),
       a as (select team, uid from n except select team, uid from o),
       r as (select team, uid from o except select team, uid from n),
       rooms as (select team from a union select team from r)
  insert into public.event_log (event_id, actor, kind, room, detail)
  select p_event, auth.uid(), 'room', rooms.team, jsonb_build_object(
           'added',   coalesce((select jsonb_agg(a.uid) from a where a.team = rooms.team), '[]'::jsonb),
           'removed', coalesce((select jsonb_agg(r.uid) from r where r.team = rooms.team), '[]'::jsonb))
  from rooms
$$;

-- Salvar os times (painel "Montar times"): mesmo funcionamento de antes + histórico por sala
create or replace function public.save_teams(p_event bigint, p_slots jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_old jsonb;
begin
  if not public.is_officer() then
    raise exception 'Sem permissão para montar times';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'team', team)), '[]'::jsonb) into v_old
    from public.team_slots where event_id = p_event;
  -- os gatilhos de sala não registram nada aqui: o resumo é feito abaixo
  perform set_config('forhonor.slots_logged', '1', true);
  delete from public.team_slots where event_id = p_event;
  insert into public.team_slots (event_id, user_id, team)
  select p_event, (s ->> 'user_id')::uuid, s ->> 'team'
    from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) as s;
  perform set_config('forhonor.slots_logged', '', true);
  perform public.log_room_diff(p_event, v_old, coalesce(p_slots, '[]'::jsonb));
end $$;

-- Outras saídas de sala: "Não vou", saída aceita, times removidos ao trocar o formato, membro removido do clã
create or replace function public.log_slots_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('forhonor.slots_logged', true), '') = '1' then return null; end if;
  insert into public.event_log (event_id, actor, kind, room, detail)
  select x.event_id, auth.uid(), 'room', x.team,
         jsonb_build_object('added', '[]'::jsonb, 'removed', jsonb_agg(x.user_id), 'auto', bool_and(x.auto))
  from (
    select o.event_id, o.team, o.user_id,
           not exists (select 1 from public.rsvps r where r.event_id = o.event_id and r.user_id = o.user_id and r.going) as auto
    from old_rows o
    where exists (select 1 from public.events e where e.id = o.event_id)
  ) x
  group by x.event_id, x.team;
  return null;
end $$;

drop trigger if exists team_slots_log_del on public.team_slots;
create trigger team_slots_log_del after delete on public.team_slots
  referencing old table as old_rows
  for each statement execute function public.log_slots_deleted();

-- Entradas em sala fora do painel (raro)
create or replace function public.log_slots_inserted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('forhonor.slots_logged', true), '') = '1' then return null; end if;
  insert into public.event_log (event_id, actor, kind, room, detail)
  select n.event_id, auth.uid(), 'room', n.team, jsonb_build_object('added', jsonb_agg(n.user_id), 'removed', '[]'::jsonb)
  from new_rows n
  group by n.event_id, n.team;
  return null;
end $$;

drop trigger if exists team_slots_log_ins on public.team_slots;
create trigger team_slots_log_ins after insert on public.team_slots
  referencing new table as new_rows
  for each statement execute function public.log_slots_inserted();

-- Quem chama cada função
revoke execute on function public.log_room_diff(bigint, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.save_teams(bigint, jsonb) from public, anon;
grant  execute on function public.save_teams(bigint, jsonb) to authenticated;

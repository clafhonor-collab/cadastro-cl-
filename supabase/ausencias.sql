-- =====================================================================
--  Ausência programada (Novembro/2026)
--  O membro (ou quem pilota a conta, ou a liderança) informa um período
--  em que não vai jogar. Todos os eventos do período ficam "Não vou"
--  automaticamente, inclusive os criados depois. A pessoa pode trocar
--  para "Vou" num evento específico. Eventos da ausência não contam
--  como falta na frequência nem nas medalhas.
--  O motivo é obrigatório e só a própria pessoa e a liderança veem.
--  Só ADICIONA tabela, coluna, funções e gatilhos. Nenhum dado existente
--  é alterado ou apagado.
-- =====================================================================

create table if not exists public.absences (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  starts_on  date not null,
  ends_on    date not null,
  reason     text not null check (char_length(btrim(reason)) between 1 and 300),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 180)
);
create index if not exists absences_user_idx on public.absences (user_id, starts_on);

-- Resposta "Não vou" criada pela ausência (guarda o número da ausência)
alter table public.rsvps add column if not exists absence_id bigint;

alter table public.absences enable row level security;
-- Ver: a própria pessoa, quem pilota a conta e a liderança. Escrever: só pelas funções abaixo.
drop policy if exists "absences_select" on public.absences;
create policy "absences_select" on public.absences
  for select to authenticated using (public.can_act_as(user_id) or public.is_officer());

-- Data do evento no horário de Brasília
create or replace function public.event_day(p_ts timestamptz) returns date
language sql immutable as $$ select (p_ts at time zone 'America/Sao_Paulo')::date $$;

-- Aplica uma ausência nos eventos futuros do período.
-- Sem resposta → "Não vou". "Vou" → "Não vou" se ainda dá para mudar (prazo aberto e sem time travado);
-- oficiais e líder mudam sempre. Devolve quantos eventos foram alterados.
create or replace function public.apply_absence(p_id bigint) returns integer
language plpgsql security definer set search_path = public as $$
declare a public.absences; n integer := 0; k integer;
begin
  select * into a from public.absences where id = p_id;
  if not found then return 0; end if;
  insert into public.rsvps (event_id, user_id, going, absence_id, updated_at)
  select e.id, a.user_id, false, a.id, now()
    from public.events e
   where e.starts_at > now() and public.event_day(e.starts_at) between a.starts_on and a.ends_on
     and not exists (select 1 from public.rsvps r where r.event_id = e.id and r.user_id = a.user_id);
  get diagnostics k = row_count; n := n + k;
  update public.rsvps r set going = false, discord = null, absence_id = a.id, updated_at = now(),
         withdraw_reason = null, withdraw_requested_at = null
    from public.events e
   where r.event_id = e.id and r.user_id = a.user_id and r.going
     and e.starts_at > now() and public.event_day(e.starts_at) between a.starts_on and a.ends_on
     and (public.is_officer() or public.can_change_rsvp_for(e.id, a.user_id));
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- Cadastra uma ausência. Devolve { id, changed }.
create or replace function public.save_absence(p_user uuid, p_start date, p_end date, p_reason text) returns json
language plpgsql security definer set search_path = public as $$
declare v_id bigint; today date := public.event_day(now());
begin
  if not (public.can_act_as(p_user) or public.is_officer()) then
    raise exception 'Você não pode programar ausência para esta conta' using errcode = '42501';
  end if;
  if not public.is_active_account(p_user) then raise exception 'Esta conta não está ativa no clã'; end if;
  if p_start is null or p_end is null or p_end < p_start then raise exception 'Confira as datas da ausência'; end if;
  if p_start < today then raise exception 'A ausência não pode começar antes de hoje'; end if;
  if p_end - p_start > 180 then raise exception 'A ausência pode ter no máximo 180 dias'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Informe o motivo da ausência'; end if;
  if exists (select 1 from public.absences where user_id = p_user and starts_on <= p_end and ends_on >= p_start) then
    raise exception 'Já existe uma ausência neste período';
  end if;
  insert into public.absences (user_id, starts_on, ends_on, reason)
  values (p_user, p_start, p_end, left(btrim(p_reason), 300)) returning id into v_id;
  return json_build_object('id', v_id, 'changed', public.apply_absence(v_id));
end $$;

-- Encerra (em andamento) ou cancela (futura) uma ausência.
-- (Os eventos que já passaram continuam fora da frequência.)
create or replace function public.delete_absence(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare a public.absences;
begin
  select * into a from public.absences where id = p_id;
  if not found then return; end if;
  if not (public.can_act_as(a.user_id) or public.is_officer()) then
    raise exception 'Sem permissão para cancelar esta ausência' using errcode = '42501';
  end if;
  -- Em andamento (Encerrar): a data final passa a ser hoje e só os eventos depois de hoje são liberados.
  -- Ainda não começou (Cancelar): libera todos os eventos e a ausência sai da lista.
  delete from public.rsvps r using public.events e
   where r.event_id = e.id and r.absence_id = a.id and not r.going and e.starts_at > now()
     and (a.starts_on > public.event_day(now()) or public.event_day(e.starts_at) > public.event_day(now()));
  if a.starts_on <= public.event_day(now()) then
    update public.absences set ends_on = least(ends_on, public.event_day(now())) where id = a.id;
  else
    delete from public.absences where id = a.id;
  end if;
end $$;

-- Evento criado ou com data alterada: aplica as ausências que cobrem a nova data
create or replace function public.events_absences() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.starts_at is not distinct from old.starts_at then return new; end if;
    delete from public.rsvps where event_id = new.id and absence_id is not null and not going;
  end if;
  if new.starts_at > now() then
    insert into public.rsvps (event_id, user_id, going, absence_id, updated_at)
    select new.id, a.user_id, false, a.id, now()
      from public.absences a
     where public.event_day(new.starts_at) between a.starts_on and a.ends_on
       and public.is_active_account(a.user_id)
    on conflict (event_id, user_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists events_absences on public.events;
create trigger events_absences after insert or update of starts_at on public.events
  for each row execute function public.events_absences();

-- Quem troca para "Vou" deixa de estar marcado como ausente naquele evento
create or replace function public.rsvps_clear_absence() returns trigger
language plpgsql as $$
begin
  if new.going and new.absence_id is not null then new.absence_id := null; end if;
  return new;
end $$;
drop trigger if exists rsvps_clear_absence on public.rsvps;
create trigger rsvps_clear_absence before update on public.rsvps
  for each row execute function public.rsvps_clear_absence();

revoke execute on function public.apply_absence(bigint) from public, anon, authenticated;
revoke execute on function public.save_absence(uuid, date, date, text) from public, anon;
revoke execute on function public.delete_absence(bigint) from public, anon;
grant  execute on function public.save_absence(uuid, date, date, text) to authenticated;
grant  execute on function public.delete_absence(bigint) to authenticated;


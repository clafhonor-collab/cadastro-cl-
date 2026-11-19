-- =====================================================================
--  Sorteio semanal do clã (domingos às 22h, horário de Brasília)
--  Só ADICIONA tabelas, funções e regras. Nenhum dado existente é
--  alterado ou apagado. Pode ser executado mais de uma vez.
--  Depende do schema base (events, event_types, attendance) e do trecho
--  "Configurações do líder" (require_perm).
--
--  Regras:
--  - A staff (líder e oficiais) cadastra o sorteio e o prêmio.
--  - O membro se inscreve em cada sorteio (a inscrição vale só para ele).
--  - Elegível = presença REGISTRADA em todas as Guerras das Sombras da
--    semana do sorteio (de segunda 00h até domingo 22h, em Brasília).
--  - Um ganhador por item (ex.: 3 Passes Simples = 3 ganhadores).
--  - O sorteio acontece no banco, na primeira vez que alguém abre o site
--    depois do horário. Depois do horário ninguém entra, sai ou é removido.
-- =====================================================================

create table if not exists public.raffles (
  id             bigint generated always as identity primary key,
  draw_at        timestamptz not null unique,
  prize_kind     text not null check (prize_kind in ('bp_simple', 'bp_boosted', 'prodigy', 'other')),
  prize_qty      integer check (prize_qty is null or prize_qty between 1 and 10),
  prize_text     text check (prize_text is null or char_length(prize_text) between 1 and 100),
  winners_count  integer not null check (winners_count between 1 and 10),
  status         text not null default 'open' check (status in ('open', 'drawn')),
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  drawn_at       timestamptz,
  eligible_count integer
);
create index if not exists raffles_status_idx on public.raffles (status, draw_at);

-- Inscrições. Removida pela staff = removed_at preenchido (com o motivo).
create table if not exists public.raffle_entries (
  raffle_id      bigint not null references public.raffles(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  entered_at     timestamptz not null default now(),
  removed_at     timestamptz,
  removed_by     uuid references public.profiles(id) on delete set null,
  removed_reason text check (removed_reason is null or char_length(removed_reason) between 5 and 300),
  primary key (raffle_id, user_id)
);

create table if not exists public.raffle_winners (
  raffle_id bigint not null references public.raffles(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  position  integer not null,
  primary key (raffle_id, user_id)
);

alter table public.raffles        enable row level security;
alter table public.raffle_entries enable row level security;
alter table public.raffle_winners enable row level security;

-- Leitura: sorteios e ganhadores para todos os membros; inscrições só a própria (a staff vê todas).
-- As escritas são só pelas funções abaixo.
drop policy if exists "raffles_select" on public.raffles;
create policy "raffles_select" on public.raffles
  for select to authenticated using (public.is_member());

drop policy if exists "raffle_entries_select" on public.raffle_entries;
create policy "raffle_entries_select" on public.raffle_entries
  for select to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_officer()));

-- Quem removeu e o motivo NÃO saem pela tabela (nem para o membro removido):
-- a staff lê essas informações pela função raffle_removals().
revoke select on public.raffle_entries from anon, authenticated;
grant select (raffle_id, user_id, entered_at, removed_at) on public.raffle_entries to authenticated;

drop policy if exists "raffle_winners_select" on public.raffle_winners;
create policy "raffle_winners_select" on public.raffle_winners
  for select to authenticated using (public.is_member());

-- ---------- Funções internas ----------

-- Só líder e oficiais; o oficial também depende das Configurações do líder
create or replace function public.raffle_staff(p_key text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_officer() then
    raise exception 'Só a staff (líder e oficiais) pode fazer isso' using errcode = '42501';
  end if;
  perform public.require_perm(p_key);
end $$;

-- Sempre domingo às 22h de Brasília, no futuro
create or replace function public.raffle_check_time(p_at timestamptz) returns void
language plpgsql stable set search_path = public as $$
begin
  if p_at is null
     or extract(isodow from p_at at time zone 'America/Sao_Paulo') <> 7
     or (p_at at time zone 'America/Sao_Paulo')::time <> time '22:00' then
    raise exception 'O sorteio é sempre aos domingos às 22h (horário de Brasília)';
  end if;
  if p_at <= now() then raise exception 'Escolha um domingo que ainda não passou'; end if;
end $$;

-- Confere o prêmio e calcula quantos ganhadores (um por item)
create or replace function public.raffle_clean(p jsonb, out kind text, out qty int, out txt text, out winners int)
language plpgsql immutable as $$
begin
  kind := p->>'prize_kind';
  if kind = 'bp_simple' then
    qty := coalesce(nullif(p->>'prize_qty', '')::int, 1);
    if qty not between 1 and 5 then raise exception 'Escolha de 1 a 5 Passes de Batalha Simples'; end if;
    txt := null; winners := qty;
  elsif kind in ('bp_boosted', 'prodigy') then
    qty := 1; txt := null; winners := 1;
  elsif kind = 'other' then
    txt := left(nullif(trim(p->>'prize_text'), ''), 100);
    if txt is null then raise exception 'Escreva o que será sorteado'; end if;
    qty := nullif(p->>'prize_qty', '')::int;
    if qty is not null and qty not between 1 and 10 then raise exception 'A quantidade vai de 1 a 10'; end if;
    winners := coalesce(qty, 1);
  else
    raise exception 'Prêmio inválido';
  end if;
end $$;

-- Guerras das Sombras da semana do sorteio (segunda 00h até o horário do sorteio, em Brasília)
create or replace function public.raffle_wars(p_raffle bigint)
returns table (event_id bigint, title text, starts_at timestamptz, registered boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.title, e.starts_at,
         exists (select 1 from public.attendance a where a.event_id = e.id)
  from public.raffles r
  join public.events e
    on e.starts_at >= (((r.draw_at at time zone 'America/Sao_Paulo')::date - 6)::timestamp at time zone 'America/Sao_Paulo')
   and e.starts_at < r.draw_at
  join public.event_types t on t.id = e.type_id and t.name = 'Guerra das Sombras'
  where r.id = p_raffle
  order by e.starts_at
$$;

-- Situação de cada inscrito (não removido): elegível = presente em todas as Guerras da semana
create or replace function public.raffle_check(p_raffle bigint)
returns table (user_id uuid, wars_total int, wars_present int, eligible boolean)
language sql stable security definer set search_path = public as $$
  with w as (select event_id from public.raffle_wars(p_raffle)),
       n as (select count(*)::int as total from w),
       x as (
         select en.user_id, n.total,
                (select count(*)::int from public.attendance a
                  where a.user_id = en.user_id and a.present and a.event_id in (select event_id from w)) as present
         from public.raffle_entries en cross join n
         where en.raffle_id = p_raffle and en.removed_at is null)
  select x.user_id, x.total, x.present,
         (x.total > 0 and x.present = x.total and public.is_active_account(x.user_id))
  from x
$$;

-- ---------- Funções usadas pelo site ----------

create or replace function public.create_raffle(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz := (p->>'draw_at')::timestamptz;
  c record;
  v_id bigint;
begin
  perform public.raffle_staff('raffle_manage');
  perform public.raffle_check_time(v_at);
  select * into c from public.raffle_clean(p);
  if exists (select 1 from public.raffles where draw_at = v_at) then
    raise exception 'Já existe um sorteio neste domingo';
  end if;
  insert into public.raffles (draw_at, prize_kind, prize_qty, prize_text, winners_count)
  values (v_at, c.kind, c.qty, c.txt, c.winners)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.update_raffle(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.raffles;
  v_at timestamptz := (p->>'draw_at')::timestamptz;
  c record;
begin
  perform public.raffle_staff('raffle_manage');
  select * into r from public.raffles where id = p_id for update;
  if not found then raise exception 'Este sorteio não existe mais'; end if;
  if r.status <> 'open' or r.draw_at <= now() then raise exception 'O horário deste sorteio já passou'; end if;
  perform public.raffle_check_time(v_at);
  select * into c from public.raffle_clean(p);
  if exists (select 1 from public.raffles where draw_at = v_at and id <> p_id) then
    raise exception 'Já existe um sorteio neste domingo';
  end if;
  update public.raffles set draw_at = v_at, prize_kind = c.kind, prize_qty = c.qty, prize_text = c.txt, winners_count = c.winners
  where id = p_id;
end $$;

create or replace function public.delete_raffle(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles;
begin
  perform public.raffle_staff('raffle_manage');
  select * into r from public.raffles where id = p_id for update;
  if not found then return; end if;
  if r.status <> 'open' or r.draw_at <= now() then raise exception 'Um sorteio já realizado não pode ser cancelado'; end if;
  delete from public.raffles where id = p_id;
end $$;

create or replace function public.join_raffle(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles; e public.raffle_entries;
begin
  if not public.is_member() then raise exception 'Só membros do clã podem se inscrever' using errcode = '42501'; end if;
  select * into r from public.raffles where id = p_id;
  if not found then raise exception 'Este sorteio não existe mais'; end if;
  if r.status <> 'open' or r.draw_at <= now() then raise exception 'As inscrições deste sorteio já fecharam'; end if;
  select * into e from public.raffle_entries where raffle_id = p_id and user_id = auth.uid();
  if found and e.removed_at is not null then
    raise exception 'Sua inscrição foi removida pela staff. Entre em contato com a staff.';
  end if;
  insert into public.raffle_entries (raffle_id, user_id) values (p_id, auth.uid())
  on conflict (raffle_id, user_id) do nothing;
end $$;

create or replace function public.leave_raffle(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles;
begin
  select * into r from public.raffles where id = p_id;
  if not found then return; end if;
  if r.status <> 'open' or r.draw_at <= now() then raise exception 'As inscrições deste sorteio já fecharam'; end if;
  delete from public.raffle_entries where raffle_id = p_id and user_id = auth.uid() and removed_at is null;
end $$;

-- A staff remove uma inscrição, sempre com o motivo por escrito
create or replace function public.remove_raffle_entry(p_id bigint, p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles; v_reason text := trim(coalesce(p_reason, ''));
begin
  perform public.raffle_staff('raffle_remove');
  if char_length(v_reason) < 5 then raise exception 'Escreva o motivo da remoção (pelo menos 5 letras)'; end if;
  select * into r from public.raffles where id = p_id;
  if not found then raise exception 'Este sorteio não existe mais'; end if;
  if r.status <> 'open' or r.draw_at <= now() then raise exception 'O horário deste sorteio já passou'; end if;
  update public.raffle_entries
     set removed_at = now(), removed_by = auth.uid(), removed_reason = left(v_reason, 300)
   where raffle_id = p_id and user_id = p_user and removed_at is null;
  if not found then raise exception 'Esta inscrição não existe mais'; end if;
end $$;

-- Painel da staff: Guerras da semana e situação de cada inscrito
create or replace function public.raffle_staff_view(p_raffle bigint) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_officer() then raise exception 'Só a staff vê o painel do sorteio' using errcode = '42501'; end if;
  return json_build_object(
    'wars',   coalesce((select json_agg(w) from public.raffle_wars(p_raffle) w), '[]'::json),
    'checks', coalesce((select json_agg(c) from public.raffle_check(p_raffle) c), '[]'::json));
end $$;

-- Remoções recentes, com quem removeu e o motivo (só a staff)
create or replace function public.raffle_removals()
returns table (raffle_id bigint, user_id uuid, removed_at timestamptz, removed_by uuid, removed_reason text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_officer() then return; end if;
  return query
    select e.raffle_id, e.user_id, e.removed_at, e.removed_by, e.removed_reason
    from public.raffle_entries e
    where e.removed_at is not null and e.removed_at > now() - interval '60 days'
    order by e.removed_at desc;
end $$;

-- Faz os sorteios cujo horário já chegou. Qualquer membro que abre o site dispara;
-- o sorteio em si (aleatório) acontece aqui no banco e só uma vez por sorteio.
create or replace function public.run_raffle_draws() returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles; v_n int;
begin
  -- Pelo site: só membros. Pelo agendamento (pg_cron) não há usuário logado.
  if auth.uid() is not null and not public.is_member() then return; end if;
  for r in select * from public.raffles where status = 'open' and draw_at <= now() order by draw_at for update skip locked loop
    select count(*) into v_n from public.raffle_check(r.id) c where c.eligible;
    insert into public.raffle_winners (raffle_id, user_id, position)
    select r.id, x.user_id, row_number() over ()
    from (select c.user_id from public.raffle_check(r.id) c where c.eligible
          order by gen_random_uuid() limit r.winners_count) x;
    update public.raffles set status = 'drawn', drawn_at = now(), eligible_count = v_n where id = r.id;
  end loop;
end $$;

-- Quem chama cada função
revoke execute on function public.raffle_staff(text), public.raffle_check_time(timestamptz), public.raffle_clean(jsonb),
  public.raffle_wars(bigint), public.raffle_check(bigint) from public, anon, authenticated;
revoke execute on function public.create_raffle(jsonb), public.update_raffle(bigint, jsonb), public.delete_raffle(bigint),
  public.join_raffle(bigint), public.leave_raffle(bigint), public.remove_raffle_entry(bigint, uuid, text),
  public.raffle_staff_view(bigint), public.raffle_removals(), public.run_raffle_draws() from public, anon;
grant execute on function public.create_raffle(jsonb), public.update_raffle(bigint, jsonb), public.delete_raffle(bigint),
  public.join_raffle(bigint), public.leave_raffle(bigint), public.remove_raffle_entry(bigint, uuid, text),
  public.raffle_staff_view(bigint), public.raffle_removals(), public.run_raffle_draws() to authenticated;

-- Agendamento: faz o sorteio exatamente no horário (domingo 22h de Brasília = segunda 01h UTC).
-- Se o pg_cron não estiver disponível, nada quebra: o sorteio acontece quando alguém abrir o site.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('sorteio-domingo', '0 1 * * 1', 'select public.run_raffle_draws()');
exception when others then
  raise notice 'pg_cron indisponível (%): o sorteio acontece quando alguém abrir o site depois do horário.', sqlerrm;
end $$;

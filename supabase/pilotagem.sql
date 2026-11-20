-- =====================================================================
--  Membro Piloto e Pilotagem (Novembro/2026)
--
--  1. Tipo de conta no perfil:
--     - pilot_only = "Membro piloto": não tem conta própria no jogo, só
--       pilota contas de outros. Não informa classe e atributos, não
--       responde eventos com a própria conta e fica fora do rank de força,
--       da média do clã e da frequência (só as contas pilotadas contam).
--     - is_pilot   = membro comum que também é piloto (pode se cadastrar na
--       Pilotagem). Todo membro piloto também é piloto.
--     - pilot_note = qual(is) conta(s) a pessoa pilota (escrito no cadastro).
--  2. Pilotagem (Utils): os pilotos anunciam seus serviços; os outros
--     membros pedem a pilotagem da própria conta; o piloto recebe o aviso
--     no sininho e aceita ou recusa. Ao aceitar, ele passa a pilotar a
--     conta (igual a um pedido de piloto aprovado).
--
--  Só ADICIONA colunas, tabelas e funções e atualiza as funções do rank e
--  da média do clã. Nenhum dado existente é alterado ou apagado.
--  Pode ser executado de novo.
-- =====================================================================

-- ---------- 1. Tipo de conta ----------
alter table public.profiles add column if not exists pilot_only boolean not null default false;
alter table public.profiles add column if not exists is_pilot   boolean not null default false;
alter table public.profiles add column if not exists pilot_note text;
alter table public.profiles drop constraint if exists profiles_pilot_note_chk;
alter table public.profiles add constraint profiles_pilot_note_chk
  check (pilot_note is null or char_length(pilot_note) <= 200);

-- O próprio membro escolhe o tipo da conta (no cadastro ou depois, em "Editar perfil")
create or replace function public.set_account_kind(p_pilot_only boolean, p_is_pilot boolean, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 200), '');
  v_pilot boolean := coalesce(p_pilot_only, false) or coalesce(p_is_pilot, false);
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role = 'former' then
    raise exception 'Conta fora do clã';
  end if;
  if coalesce(p_pilot_only, false) and v_note is null then
    raise exception 'Informe qual conta você pilota';
  end if;
  update public.profiles
     set pilot_only = coalesce(p_pilot_only, false),
         is_pilot   = v_pilot,
         pilot_note = case when v_pilot then v_note end
   where id = auth.uid();
  if coalesce(p_pilot_only, false) then
    -- Membro piloto não responde eventos com a própria conta: tira as respostas e vagas dos próximos eventos
    delete from public.team_slots ts
     using public.events e
     where e.id = ts.event_id and ts.user_id = auth.uid() and e.starts_at > now();
    delete from public.rsvps r
     using public.events e
     where e.id = r.event_id and r.user_id = auth.uid() and e.starts_at > now();
  end if;
  if not v_pilot then
    -- Deixou de ser piloto: sai da Pilotagem e os pedidos em aberto são recusados
    delete from public.pilot_offers where pilot_id = auth.uid();
    update public.pilot_service_requests
       set status = 'declined', decided_at = now(), answer = 'Deixou de oferecer pilotagem'
     where pilot_id = auth.uid() and status = 'pending';
  end if;
end $$;

-- Membro piloto não responde eventos com a própria conta (só pelas contas que pilota)
create or replace function public.rsvp_pilot_only_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and pilot_only) then
    raise exception 'Membro piloto não responde eventos com a própria conta: escolha a conta que você pilota em “Respondendo como”'
      using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rsvps_pilot_only on public.rsvps;
create trigger rsvps_pilot_only before insert or update of user_id, going on public.rsvps
  for each row execute function public.rsvp_pilot_only_guard();

-- A conta de um membro piloto não pode ser pilotada (ela não é uma conta do jogo)
create or replace function public.pilot_account_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = new.account_id and pilot_only) then
    raise exception 'Esta pessoa é membro piloto (não tem conta própria no jogo para ser pilotada)';
  end if;
  return new;
end $$;
drop trigger if exists account_pilots_kind on public.account_pilots;
create trigger account_pilots_kind before insert or update on public.account_pilots
  for each row execute function public.pilot_account_guard();

-- ---------- 2. Rank de força e média do clã: sem os membros piloto ----------
create or replace function public.power_overview(p_user uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v json; v_res integer;
begin
  if not public.is_member() or not (public.is_officer() or public.can_act_as(p_user)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select coalesce(resonance, 0) into v_res from public.profiles where id = p_user;
  with base as (
    select id, coalesce(nullif(trim(game_name), ''), nullif(trim(google_name), ''), 'Membro') as name, char_class,
           armor, armor_pen, potency, resistance, resonance
      from public.profiles
     where role in ('member', 'officer', 'leader') and not pilot_only and char_class is not null
       and armor is not null and armor_pen is not null and potency is not null
       and resistance is not null and resonance is not null
  ), mx as (
    select max(armor) as armor, max(armor_pen) as armor_pen, max(potency) as potency,
           max(resistance) as resistance, max(resonance) as resonance from base
  ), sc as (
    select b.*, round(10 * (
        0.5   * case when mx.resonance  > 0 then 100.0 * b.resonance  / mx.resonance  else 0 end
      + 0.175 * case when mx.armor      > 0 then 100.0 * b.armor      / mx.armor      else 0 end
      + 0.175 * case when mx.armor_pen  > 0 then 100.0 * b.armor_pen  / mx.armor_pen  else 0 end
      + 0.075 * case when mx.potency    > 0 then 100.0 * b.potency    / mx.potency    else 0 end
      + 0.075 * case when mx.resistance > 0 then 100.0 * b.resistance / mx.resistance else 0 end))::int as score
      from base b cross join mx
  ), rk as (
    select sc.*,
           row_number() over (order by score desc, lower(name)) as pos,
           row_number() over (partition by char_class order by score desc, lower(name)) as cls_pos,
           count(*) over (partition by char_class) as cls_total
      from sc
  ), band as (
    select * from base
     where id <> p_user and resonance between greatest(0, v_res - 500) and v_res + 500
  )
  select json_build_object(
    'clan', json_build_object('count', (select count(*) from base), 'avg', (select json_build_object(
        'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
        'resistance', round(avg(resistance)), 'resonance', round(avg(resonance))) from base)),
    'band', json_build_object('lo', greatest(0, v_res - 500), 'hi', v_res + 500, 'count', (select count(*) from band),
        'avg', (select json_build_object(
          'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
          'resistance', round(avg(resistance)), 'resonance', round(avg(resonance))) from band)),
    'best', json_build_object(
        'armor',      (select json_build_object('value', armor,      'name', name) from base order by armor desc,      lower(name) limit 1),
        'armor_pen',  (select json_build_object('value', armor_pen,  'name', name) from base order by armor_pen desc,  lower(name) limit 1),
        'potency',    (select json_build_object('value', potency,    'name', name) from base order by potency desc,    lower(name) limit 1),
        'resistance', (select json_build_object('value', resistance, 'name', name) from base order by resistance desc, lower(name) limit 1),
        'resonance',  (select json_build_object('value', resonance,  'name', name) from base order by resonance desc,  lower(name) limit 1)),
    'total', (select count(*) from rk),
    'top', (select coalesce(json_agg(json_build_object('id', id, 'game_name', name, 'char_class', char_class, 'score', score) order by pos), '[]'::json)
              from rk where pos <= 10),
    'me', (select json_build_object('pos', pos, 'score', score, 'cls_pos', cls_pos, 'cls_total', cls_total) from rk where id = p_user)
  ) into v;
  return v;
end $$;

create or replace function public.clan_averages() returns json
language sql stable security definer set search_path = public as $$
  select case when public.is_member() then json_build_object(
      'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
      'resistance', round(avg(resistance)), 'resonance', round(avg(resonance)), 'count', count(*))
    end
  from public.profiles
  where role in ('member', 'officer', 'leader') and not pilot_only and char_class is not null
    and armor is not null and armor_pen is not null and potency is not null
    and resistance is not null and resonance is not null
$$;

-- Busca de conta para pedir acesso de piloto: membros piloto não aparecem (não têm conta no jogo)
create or replace function public.find_accounts(p_q text) returns json
language sql stable security definer set search_path = public as $$
  with q as (
    select replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') as s
  )
  select case when not public.is_member() or char_length((select s from q)) < 3 then '[]'::json
    else coalesce((select json_agg(x) from (
      select p.id, coalesce(nullif(trim(p.game_name), ''), p.google_name) as game_name, p.char_class
        from public.profiles p
       where p.role in ('member', 'officer', 'leader') and not p.pilot_only and p.id <> auth.uid()
         and coalesce(nullif(trim(p.game_name), ''), p.google_name) ilike '%' || (select s from q) || '%'
       order by 2 limit 8) x), '[]'::json) end
$$;

-- ---------- 3. Pilotagem ----------
-- Anúncio de cada piloto (um por pessoa)
create table if not exists public.pilot_offers (
  pilot_id   uuid primary key references public.profiles(id) on delete cascade,
  about      text not null check (char_length(about) between 1 and 300),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pedido de pilotagem: o dono da conta pede para um piloto pilotar a conta dele
create table if not exists public.pilot_service_requests (
  id           bigint generated always as identity primary key,
  account_id   uuid not null references public.profiles(id) on delete cascade,
  pilot_id     uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  message      text check (message is null or char_length(message) <= 300),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  answer       text check (answer is null or char_length(answer) <= 300),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  check (account_id <> pilot_id)
);
create unique index if not exists pilot_service_one_pending
  on public.pilot_service_requests (account_id, pilot_id) where status = 'pending';
create index if not exists pilot_service_pilot_idx on public.pilot_service_requests (pilot_id, status);

-- Leitura direta só pelas funções abaixo (que já entregam os nomes prontos)
alter table public.pilot_offers enable row level security;
alter table public.pilot_service_requests enable row level security;
drop policy if exists "pilot_offers_select" on public.pilot_offers;
create policy "pilot_offers_select" on public.pilot_offers
  for select to authenticated using (public.is_member());
drop policy if exists "pilot_requests_select" on public.pilot_service_requests;
create policy "pilot_requests_select" on public.pilot_service_requests
  for select to authenticated
  using (public.is_officer() or pilot_id = auth.uid() or account_id = auth.uid() or requested_by = auth.uid());

-- Tudo o que a aba Pilotagem mostra: anúncios (nome do piloto, texto, quantas contas pilota)
-- e os pedidos que a pessoa enviou ou recebeu (a liderança vê todos)
create or replace function public.pilotage_board() returns json
language sql stable security definer set search_path = public as $$
  select case when not public.is_member() then null else json_build_object(
    'offers', coalesce((select json_agg(json_build_object(
        'pilot_id', o.pilot_id,
        'name', coalesce(nullif(trim(p.game_name), ''), nullif(trim(p.google_name), ''), 'Piloto'),
        'pilot_only', p.pilot_only,
        'about', o.about, 'active', o.active, 'updated_at', o.updated_at,
        'accounts', (select count(*) from public.account_pilots ap
                      join public.profiles a on a.id = ap.account_id
                     where ap.pilot_id = o.pilot_id and ap.status = 'approved' and a.role in ('member', 'officer', 'leader')))
      order by o.active desc, lower(coalesce(nullif(trim(p.game_name), ''), p.google_name)))
      from public.pilot_offers o join public.profiles p on p.id = o.pilot_id
      where p.role in ('member', 'officer', 'leader') and (p.is_pilot or p.pilot_only)), '[]'::json),
    'requests', coalesce((select json_agg(json_build_object(
        'id', r.id, 'account_id', r.account_id, 'pilot_id', r.pilot_id, 'requested_by', r.requested_by,
        'account_name', coalesce(nullif(trim(a.game_name), ''), nullif(trim(a.google_name), ''), 'Conta'),
        'account_class', a.char_class,
        'pilot_name', coalesce(nullif(trim(pl.game_name), ''), nullif(trim(pl.google_name), ''), 'Piloto'),
        'message', r.message, 'status', r.status, 'answer', r.answer,
        'created_at', r.created_at, 'decided_at', r.decided_at) order by r.created_at desc)
      from public.pilot_service_requests r
      join public.profiles a  on a.id  = r.account_id
      join public.profiles pl on pl.id = r.pilot_id
      where (public.is_officer() or r.pilot_id = auth.uid() or r.account_id = auth.uid() or r.requested_by = auth.uid())
        and (r.status = 'pending' or r.created_at > now() - interval '60 days')), '[]'::json)
  ) end
$$;

-- O piloto publica, edita, pausa ou volta a oferecer seus serviços
create or replace function public.save_pilot_offer(p_about text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_about text := nullif(left(btrim(coalesce(p_about, '')), 300), '');
begin
  if not public.is_member() then raise exception 'Só membros do clã'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and (is_pilot or pilot_only)) then
    raise exception 'Marque “Também sou piloto” em Editar perfil para se cadastrar na Pilotagem';
  end if;
  if v_about is null then raise exception 'Escreva como você pode ajudar (horários, eventos, etc.)'; end if;
  insert into public.pilot_offers (pilot_id, about, active)
  values (auth.uid(), v_about, coalesce(p_active, true))
  on conflict (pilot_id) do update set about = excluded.about, active = excluded.active, updated_at = now();
end $$;

-- Sair da Pilotagem (o próprio piloto ou a liderança)
create or replace function public.delete_pilot_offer(p_pilot uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_pilot = auth.uid() or public.is_officer()) then raise exception 'Sem permissão'; end if;
  delete from public.pilot_offers where pilot_id = p_pilot;
  update public.pilot_service_requests
     set status = 'declined', decided_at = now(), answer = coalesce(answer, 'O piloto saiu da Pilotagem')
   where pilot_id = p_pilot and status = 'pending';
end $$;

-- O dono da conta pede a pilotagem (até 3 pedidos em aberto por pessoa)
create or replace function public.request_pilotage(p_pilot uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Só membros do clã'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and pilot_only) then
    raise exception 'Membro piloto não tem conta própria para ser pilotada';
  end if;
  if p_pilot = auth.uid() then raise exception 'Você não pode pedir a si mesmo'; end if;
  if not exists (select 1 from public.pilot_offers o join public.profiles p on p.id = o.pilot_id
                  where o.pilot_id = p_pilot and o.active and p.role in ('member', 'officer', 'leader')) then
    raise exception 'Este piloto não está disponível no momento';
  end if;
  if exists (select 1 from public.account_pilots
              where account_id = auth.uid() and pilot_id = p_pilot and status = 'approved') then
    raise exception 'Este piloto já pilota a sua conta';
  end if;
  if exists (select 1 from public.pilot_service_requests
              where account_id = auth.uid() and pilot_id = p_pilot and status = 'pending') then
    raise exception 'Você já tem um pedido em aberto com este piloto';
  end if;
  if (select count(*) from public.pilot_service_requests
       where requested_by = auth.uid() and status = 'pending') >= 3 then
    raise exception 'Limite de 3 pedidos de pilotagem em aberto. Aguarde a resposta ou cancele um pedido.';
  end if;
  insert into public.pilot_service_requests (account_id, pilot_id, requested_by, message)
  values (auth.uid(), p_pilot, auth.uid(), nullif(left(btrim(coalesce(p_message, '')), 300), ''));
end $$;

-- Quem pediu cancela (enquanto o piloto não respondeu)
create or replace function public.cancel_pilotage(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.pilot_service_requests
     set status = 'cancelled', decided_at = now()
   where id = p_id and status = 'pending' and (requested_by = auth.uid() or account_id = auth.uid());
  if not found then raise exception 'Pedido não encontrado ou já respondido'; end if;
end $$;

-- O piloto aceita (passa a pilotar a conta) ou recusa
create or replace function public.answer_pilotage(p_id bigint, p_accept boolean, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.pilot_service_requests;
begin
  select * into r from public.pilot_service_requests where id = p_id for update;
  if r.id is null or r.pilot_id <> auth.uid() then raise exception 'Pedido não encontrado'; end if;
  if r.status <> 'pending' then raise exception 'Este pedido já foi respondido'; end if;
  if p_accept then
    if not public.is_member() then raise exception 'Só membros do clã'; end if;
    if not public.is_active_account(r.account_id) then raise exception 'A conta não está mais no clã'; end if;
    insert into public.account_pilots (account_id, pilot_id, status, reason, decided_at, decided_by)
    values (r.account_id, r.pilot_id, 'approved', 'Pedido pela Pilotagem', now(), r.account_id)
    on conflict (account_id, pilot_id) do update
       set status = 'approved', decided_at = now(), decided_by = r.account_id;
  end if;
  update public.pilot_service_requests
     set status = case when p_accept then 'accepted' else 'declined' end,
         decided_at = now(), answer = nullif(left(btrim(coalesce(p_answer, '')), 300), '')
   where id = p_id;
end $$;

-- Quem chama cada função
revoke execute on function public.set_account_kind(boolean, boolean, text)  from public, anon;
revoke execute on function public.pilotage_board()                           from public, anon;
revoke execute on function public.save_pilot_offer(text, boolean)            from public, anon;
revoke execute on function public.delete_pilot_offer(uuid)                   from public, anon;
revoke execute on function public.request_pilotage(uuid, text)               from public, anon;
revoke execute on function public.cancel_pilotage(bigint)                    from public, anon;
revoke execute on function public.answer_pilotage(bigint, boolean, text)     from public, anon;
grant  execute on function public.set_account_kind(boolean, boolean, text)  to authenticated;
grant  execute on function public.pilotage_board()                           to authenticated;
grant  execute on function public.save_pilot_offer(text, boolean)            to authenticated;
grant  execute on function public.delete_pilot_offer(uuid)                   to authenticated;
grant  execute on function public.request_pilotage(uuid, text)               to authenticated;
grant  execute on function public.cancel_pilotage(bigint)                    to authenticated;
grant  execute on function public.answer_pilotage(bigint, boolean, text)     to authenticated;
revoke execute on function public.rsvp_pilot_only_guard(), public.pilot_account_guard()
  from public, anon, authenticated;

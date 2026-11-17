-- =====================================================================
--  Gerenciador de eventos do clã — esquema do banco (Supabase)
--  Cole TODO este arquivo no "SQL Editor" do Supabase e clique em "Run".
-- =====================================================================

-- ---------- Tabelas ----------------------------------------------------

-- Um perfil por pessoa que fez login com o Google.
-- role: pending (aguardando aprovação), member, officer, leader
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  google_name text not null default '',
  avatar_url   text,
  game_name    text check (game_name is null or char_length(game_name) <= 40),
  role         text not null default 'pending'
               check (role in ('pending', 'member', 'officer', 'leader')),
  created_at   timestamptz not null default now()
);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 1000),
  starts_at   timestamptz not null,
  created_by  uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists events_starts_at_idx on public.events (starts_at);

-- Resposta de cada membro a cada evento (true = vai, false = não vai)
create table if not exists public.rsvps (
  event_id   bigint not null references public.events(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  going      boolean not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- Classe e atributos ---------------------------------------
-- Classes: dh, cruzado, mago, bk, monge, druida, barbaro, necromante, bruxo, tempest

alter table public.profiles add column if not exists char_class text;
alter table public.profiles add column if not exists armor      integer;
alter table public.profiles add column if not exists armor_pen  integer;
alter table public.profiles add column if not exists potency    integer;
alter table public.profiles add column if not exists resistance integer;
alter table public.profiles add column if not exists resonance  integer;

-- Na resposta guardamos uma "foto" da classe/atributos confirmados para aquele evento
alter table public.rsvps add column if not exists char_class text;
alter table public.rsvps add column if not exists armor      integer;
alter table public.rsvps add column if not exists armor_pen  integer;
alter table public.rsvps add column if not exists potency    integer;
alter table public.rsvps add column if not exists resistance integer;
alter table public.rsvps add column if not exists resonance  integer;
-- Ao confirmar presença, o membro informa se vai usar o Discord no evento
alter table public.rsvps add column if not exists discord    boolean;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'rsvps'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_char_class_chk');
    execute format($f$alter table public.%I add constraint %I check (char_class is null or char_class in
      ('dh','cruzado','mago','bk','monge','druida','barbaro','necromante','bruxo','tempest'))$f$, t, t || '_char_class_chk');
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_attrs_chk');
    execute format($f$alter table public.%I add constraint %I check (
      coalesce(armor, 0) between 0 and 1000000 and coalesce(armor_pen, 0) between 0 and 1000000 and
      coalesce(potency, 0) between 0 and 1000000 and coalesce(resistance, 0) between 0 and 1000000 and
      coalesce(resonance, 0) between 0 and 1000000)$f$, t, t || '_attrs_chk');
  end loop;
end $$;

-- ---------- Telefone de contato (opcional) ---------------------------
-- Tabela separada para que só o próprio membro, oficiais e o líder vejam o número.
create table if not exists public.member_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone   text check (phone is null or char_length(phone) <= 30)
);

-- ---------- Times ----------------------------------------------------
-- Formato do evento: 'guerra' (12 times fixos) ou 'rito' (até 10 times)
alter table public.events add column if not exists team_format text;
alter table public.events add column if not exists team_count  smallint not null default 10;
alter table public.events drop constraint if exists events_team_chk;
alter table public.events add constraint events_team_chk
  check ((team_format is null or team_format in ('guerra', 'rito')) and team_count between 1 and 10);

-- Em qual time cada membro está, por evento
create table if not exists public.team_slots (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id  uuid   not null references public.profiles(id) on delete cascade,
  team     text   not null check (char_length(team) between 1 and 30),
  primary key (event_id, user_id)
);

-- ---------- Presença real ---------------------------------------------
-- Depois do evento, um oficial marca quem realmente compareceu.
create table if not exists public.attendance (
  event_id bigint  not null references public.events(id) on delete cascade,
  user_id  uuid    not null references public.profiles(id) on delete cascade,
  present  boolean not null,
  primary key (event_id, user_id)
);

-- ---------- Tipos de evento -------------------------------------------
-- Para criar um tipo novo: Supabase → Table Editor → event_types → Insert row.
--   name:       nome que aparece no site
--   sort_order: posição na lista (menor aparece primeiro)
--   active:     desmarque para esconder o tipo sem apagá-lo
create table if not exists public.event_types (
  id         bigint generated always as identity primary key,
  name       text not null unique check (char_length(name) between 1 and 60),
  sort_order integer not null default 50,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.event_types (name, sort_order) values
  ('Guerra das Sombras', 10),
  ('Vigília',            20),
  ('Rito do Exílio',     30),
  ('Outros',            999)
on conflict (name) do nothing;

-- Um tipo em uso por algum evento não pode ser apagado (use "active = false" para escondê-lo)
alter table public.events add column if not exists type_id bigint
  references public.event_types(id) on delete restrict;
create index if not exists events_type_idx on public.events (type_id);

-- Classifica pelo nome os eventos que ainda não têm tipo
update public.events e
   set type_id = (select t.id from public.event_types t where t.name = case
                    when e.title ilike '%guerra%'   then 'Guerra das Sombras'
                    when e.title ilike '%vig_lia%'  then 'Vigília'
                    when e.title ilike '%rito%'     then 'Rito do Exílio'
                    else 'Outros' end)
 where e.type_id is null;

-- ---------- Histórico de alterações do perfil -------------------------
-- Toda mudança de nome (personagem ou conta Google), classe ou atributos é registrada aqui.
-- changes = { "campo": [valor_antigo, valor_novo], ... }
create table if not exists public.profile_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by uuid default auth.uid(),
  changes    jsonb not null
);
create index if not exists profile_history_user_idx on public.profile_history (user_id, changed_at desc);

-- ---------- Prazo de confirmação, times travados e pedidos de saída ----
-- rsvp_close_minutes: prazo para responder, em minutos antes do início (null = sem prazo)
-- teams_locked:       com os times travados, quem está escalado não sai sozinho; pede ao oficial
alter table public.events add column if not exists rsvp_close_minutes integer
  check (rsvp_close_minutes is null or rsvp_close_minutes between 0 and 10080);
alter table public.events add column if not exists teams_locked boolean not null default false;

-- Pedido de saída feito pelo membro quando já não pode mudar a resposta sozinho
alter table public.rsvps add column if not exists withdraw_reason       text
  check (withdraw_reason is null or char_length(withdraw_reason) <= 300);
alter table public.rsvps add column if not exists withdraw_requested_at timestamptz;

-- ---------- Anotações internas (oficiais e líder) ---------------------
create table if not exists public.member_notes (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  author_id  uuid default auth.uid() references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists member_notes_member_idx on public.member_notes (member_id, created_at desc);

-- ---------- Ex-membros e histórico no clã -----------------------------
-- role 'former' = ex-membro: sai das listas, perde o acesso, mas o histórico é mantido.
-- Se a pessoa entrar de novo no site, pode pedir para voltar (vira 'pending').
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('pending', 'member', 'officer', 'leader', 'former'));

-- Toda mudança de cargo fica registrada (entrou, aprovado, promovido, removido, voltou...)
create table if not exists public.membership_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  from_role  text,
  to_role    text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  reason     text check (reason is null or char_length(reason) <= 300),
  changed_at timestamptz not null default now()
);
create index if not exists membership_log_user_idx on public.membership_log (user_id, changed_at desc);

-- Quem já estava cadastrado antes do histórico existir ganha um registro inicial
insert into public.membership_log (user_id, from_role, to_role, reason, changed_at)
select p.id, null, p.role, 'Registro inicial (antes do histórico do clã)', p.created_at
  from public.profiles p
 where not exists (select 1 from public.membership_log m where m.user_id = p.id);

-- ---------- Malah News -------------------------------------------------
-- Edições (imagens) publicadas por oficiais e líder; membros veem.
create table if not exists public.news_posts (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 1 and 120),
  caption      text check (caption is null or char_length(caption) <= 2000),
  image_path   text not null,                 -- caminho do arquivo no bucket "news"
  author_id    uuid default auth.uid() references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  edited_at    timestamptz
);
create index if not exists news_posts_published_idx on public.news_posts (published_at desc);

-- Espaço PRIVADO para as imagens (até 10 MB cada; só imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- ---------- Funções auxiliares ----------------------------------------

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('member', 'officer', 'leader'), false)
$$;

create or replace function public.is_officer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('officer', 'leader'), false)
$$;

-- Cria o perfil automaticamente no primeiro login com o Google
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, google_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Sem nome'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Alterar cargo de alguém.
--   Líder:   pode definir qualquer cargo para qualquer pessoa.
--   Oficial: pode apenas aprovar (pending -> member) ou tirar o acesso de membros comuns.
--   Ninguém altera o próprio cargo.
create or replace function public.set_member_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me  text := public.my_role();
  cur text;
begin
  if new_role not in ('pending', 'member', 'officer', 'leader') then
    raise exception 'Cargo inválido';
  end if;
  if target = auth.uid() then
    raise exception 'Você não pode alterar o próprio cargo';
  end if;
  select role into cur from public.profiles where id = target;
  if cur is null then
    raise exception 'Membro não encontrado';
  end if;
  if me = 'leader' then
    null;
  elsif me = 'officer' and cur in ('pending', 'member') and new_role in ('pending', 'member') then
    null;
  else
    raise exception 'Sem permissão para essa alteração';
  end if;
  update public.profiles set role = new_role where id = target;
end $$;

revoke execute on function public.set_member_role(uuid, text) from public, anon;
grant  execute on function public.set_member_role(uuid, text) to authenticated;

-- Remover do clã (ou recusar quem está aguardando aprovação).
--   Líder:   qualquer pessoa (menos ele mesmo).
--   Oficial: só quem está aguardando aprovação ou é membro comum.
-- Mantém presenças passadas, histórico e anotações; apaga respostas/vagas de eventos futuros e o telefone.
-- with_managed: remove junto as contas sem login que só essa pessoa pilotava.
drop function if exists public.remove_member(uuid, text);

create or replace function public.remove_member(target uuid, reason text, with_managed boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare
  me  text := public.my_role();
  cur text;
  acc uuid;
begin
  if target = auth.uid() then
    raise exception 'Você não pode remover a si mesmo';
  end if;
  select role into cur from public.profiles where id = target;
  if cur is null then
    raise exception 'Membro não encontrado';
  end if;
  if cur = 'former' then
    raise exception 'Esta pessoa já é ex-membro';
  end if;
  if not (me = 'leader' or (me = 'officer' and cur in ('pending', 'member'))) then
    raise exception 'Sem permissão para remover esta pessoa';
  end if;
  perform set_config('forhonor.reason', left(coalesce(nullif(trim(reason), ''), ''), 300), true);
  update public.profiles set role = 'former' where id = target;
  delete from public.rsvps r
   using public.events e
   where r.event_id = e.id and r.user_id = target and e.starts_at > now();
  delete from public.member_contacts where user_id = target;
  -- Contas sem login que só ele pilotava
  if with_managed then
    for acc in
      select a.account_id
        from public.account_pilots a
        join public.profiles p on p.id = a.account_id
       where a.pilot_id = target and a.status = 'approved' and p.managed and p.role <> 'former'
         and not exists (select 1 from public.account_pilots b
                          where b.account_id = a.account_id and b.pilot_id <> target and b.status = 'approved')
    loop
      perform set_config('forhonor.reason', 'Removida junto com o piloto', true);
      update public.profiles set role = 'former' where id = acc;
      delete from public.rsvps r
       using public.events e
       where r.event_id = e.id and r.user_id = acc and e.starts_at > now();
    end loop;
  end if;
  -- Quem sai do clã deixa de pilotar contas
  delete from public.account_pilots where pilot_id = target;
end $$;

-- Ex-membro pede para voltar (aparece de novo em "Aguardando aprovação")
create or replace function public.request_rejoin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'former' then
    raise exception 'Você não é ex-membro';
  end if;
  perform set_config('forhonor.reason', 'Pediu para voltar ao clã', true);
  update public.profiles set role = 'pending' where id = auth.uid();
end $$;

revoke execute on function public.remove_member(uuid, text, boolean) from public, anon;
revoke execute on function public.request_rejoin()                    from public, anon;
grant  execute on function public.remove_member(uuid, text, boolean) to authenticated;
grant  execute on function public.request_rejoin()                    to authenticated;

-- Registra toda mudança de cargo no histórico do clã
create or replace function public.log_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.membership_log (user_id, from_role, to_role, changed_by, reason)
    values (new.id, null, new.role, auth.uid(),
            coalesce(nullif(current_setting('forhonor.reason', true), ''), 'Primeiro acesso ao site'));
  elsif old.role is distinct from new.role then
    insert into public.membership_log (user_id, from_role, to_role, changed_by, reason)
    values (new.id, old.role, new.role, auth.uid(), nullif(current_setting('forhonor.reason', true), ''));
  end if;
  return new;
end $$;

drop trigger if exists profiles_log_role on public.profiles;
create trigger profiles_log_role
  after insert or update of role on public.profiles
  for each row execute function public.log_role_change();

-- Registra no histórico qualquer mudança de nome, classe ou atributos
create or replace function public.log_profile_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  diff jsonb := '{}'::jsonb;
  f    text;
  o    jsonb := to_jsonb(old);
  n    jsonb := to_jsonb(new);
begin
  foreach f in array array['google_name', 'game_name', 'char_class',
                           'armor', 'armor_pen', 'potency', 'resistance', 'resonance'] loop
    if (o -> f) is distinct from (n -> f) then
      diff := diff || jsonb_build_object(f, jsonb_build_array(o -> f, n -> f));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into public.profile_history (user_id, changes) values (new.id, diff);
  end if;
  return new;
end $$;

drop trigger if exists profiles_log_change on public.profiles;
create trigger profiles_log_change
  after update on public.profiles
  for each row execute function public.log_profile_change();

-- Chamada pelo site a cada login: atualiza nome e foto da conta Google (se mudaram)
create or replace function public.sync_google_profile() returns void
language plpgsql security definer set search_path = public as $$
declare
  meta   jsonb;
  name   text;
  avatar text;
begin
  select raw_user_meta_data into meta from auth.users where id = auth.uid();
  if meta is null then return; end if;
  name   := coalesce(meta ->> 'full_name', meta ->> 'name');
  avatar := coalesce(meta ->> 'avatar_url', meta ->> 'picture');
  update public.profiles
     set google_name = coalesce(name, google_name),
         avatar_url   = coalesce(avatar, avatar_url)
   where id = auth.uid()
     and (google_name is distinct from coalesce(name, google_name)
          or avatar_url is distinct from coalesce(avatar, avatar_url));
end $$;

revoke execute on function public.sync_google_profile() from public, anon;
grant  execute on function public.sync_google_profile() to authenticated;

-- Times: só entra quem confirmou presença, e no máximo 8 por time
create or replace function public.team_slot_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.rsvps
                 where event_id = new.event_id and user_id = new.user_id and going) then
    raise exception 'Este membro não confirmou presença no evento';
  end if;
  if (select count(*) from public.team_slots
      where event_id = new.event_id and team = new.team and user_id <> new.user_id) >= 8 then
    raise exception 'O time % já tem 8 membros', new.team;
  end if;
  return new;
end $$;

drop trigger if exists team_slot_check on public.team_slots;
create trigger team_slot_check
  before insert or update on public.team_slots
  for each row execute function public.team_slot_check();

-- Salva todos os times de um evento de uma vez (botão "Salvar" do painel).
-- Roda numa única transação: se algo falhar (ex.: time com mais de 8), nada é alterado.
create or replace function public.save_teams(p_event bigint, p_slots jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not public.is_officer() then
    raise exception 'Sem permissão para montar times';
  end if;
  delete from public.team_slots where event_id = p_event;
  insert into public.team_slots (event_id, user_id, team)
  select p_event, (s ->> 'user_id')::uuid, s ->> 'team'
    from jsonb_array_elements(coalesce(p_slots, '[]'::jsonb)) as s;
end $$;

revoke execute on function public.save_teams(bigint, jsonb) from public, anon;
grant  execute on function public.save_teams(bigint, jsonb) to authenticated;

-- O prazo de resposta do evento ainda está aberto?
create or replace function public.rsvp_open(p_event bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select e.rsvp_close_minutes is null
        or now() < e.starts_at - make_interval(mins => e.rsvp_close_minutes)
      from public.events e where e.id = p_event), false)
$$;

-- O membro pode mudar a própria resposta? (prazo aberto e não está escalado num time travado)
create or replace function public.can_change_rsvp(p_event bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rsvp_open(p_event) and not exists (
    select 1 from public.events e
      join public.team_slots ts on ts.event_id = e.id
     where e.id = p_event and e.teams_locked and ts.user_id = auth.uid())
$$;

-- Membro pede para sair (quando já não pode mudar a resposta sozinho).
-- p_user = a conta do jogo: a do próprio membro (padrão) ou uma conta que ele pilota.
drop function if exists public.request_withdrawal(bigint, text);
drop function if exists public.cancel_withdrawal(bigint);

create or replace function public.request_withdrawal(p_event bigint, p_reason text, p_user uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  acct uuid := coalesce(p_user, auth.uid());
begin
  if not public.can_act_as(acct) then
    raise exception 'Você não pode responder por esta conta';
  end if;
  if not exists (select 1 from public.rsvps where event_id = p_event and user_id = acct and going) then
    raise exception 'Esta conta não está confirmada neste evento';
  end if;
  if public.can_change_rsvp_for(p_event, acct) then
    raise exception 'Esta conta ainda pode mudar a resposta normalmente';
  end if;
  update public.rsvps
     set withdraw_reason = left(coalesce(nullif(trim(p_reason), ''), 'Sem motivo informado'), 300),
         withdraw_requested_at = now()
   where event_id = p_event and user_id = acct;
end $$;

create or replace function public.cancel_withdrawal(p_event bigint, p_user uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  acct uuid := coalesce(p_user, auth.uid());
begin
  if not public.can_act_as(acct) then
    raise exception 'Você não pode responder por esta conta';
  end if;
  update public.rsvps set withdraw_reason = null, withdraw_requested_at = null
   where event_id = p_event and user_id = acct;
end $$;

-- Oficial aceita (vira "Não vou" e sai do time) ou recusa (continua confirmado) o pedido
create or replace function public.resolve_withdrawal(p_event bigint, p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_officer() then
    raise exception 'Só oficiais e o líder podem decidir pedidos de saída';
  end if;
  if p_accept then
    update public.rsvps
       set going = false, discord = null, withdraw_reason = null, withdraw_requested_at = null, updated_at = now()
     where event_id = p_event and user_id = p_user;
  else
    update public.rsvps set withdraw_reason = null, withdraw_requested_at = null
     where event_id = p_event and user_id = p_user;
  end if;
end $$;

revoke execute on function public.request_withdrawal(bigint, text, uuid)    from public, anon;
revoke execute on function public.cancel_withdrawal(bigint, uuid)           from public, anon;
revoke execute on function public.resolve_withdrawal(bigint, uuid, boolean) from public, anon;
grant  execute on function public.request_withdrawal(bigint, text, uuid)    to authenticated;
grant  execute on function public.cancel_withdrawal(bigint, uuid)           to authenticated;
grant  execute on function public.resolve_withdrawal(bigint, uuid, boolean) to authenticated;

-- Quem desmarca presença sai automaticamente do time
create or replace function public.rsvp_cleanup_slot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.team_slots where event_id = old.event_id and user_id = old.user_id;
    return old;
  end if;
  if not new.going then
    delete from public.team_slots where event_id = new.event_id and user_id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists rsvps_cleanup_slot on public.rsvps;
create trigger rsvps_cleanup_slot
  after update or delete on public.rsvps
  for each row execute function public.rsvp_cleanup_slot();

-- ---------- Segurança (Row Level Security) ---------------------------

alter table public.profiles enable row level security;
alter table public.events   enable row level security;
alter table public.rsvps    enable row level security;
alter table public.team_slots enable row level security;
alter table public.member_contacts enable row level security;
alter table public.attendance enable row level security;
alter table public.profile_history enable row level security;
alter table public.event_types enable row level security;
alter table public.member_notes enable row level security;
alter table public.membership_log enable row level security;
alter table public.news_posts enable row level security;

-- Malah News: membros veem; oficiais e líder publicam, editam e apagam.
drop policy if exists "news_select" on public.news_posts;
create policy "news_select" on public.news_posts
  for select to authenticated using (public.is_member());

drop policy if exists "news_insert" on public.news_posts;
create policy "news_insert" on public.news_posts
  for insert to authenticated with check (public.is_officer() and author_id = auth.uid());

drop policy if exists "news_update" on public.news_posts;
create policy "news_update" on public.news_posts
  for update to authenticated using (public.is_officer()) with check (public.is_officer());

drop policy if exists "news_delete" on public.news_posts;
create policy "news_delete" on public.news_posts
  for delete to authenticated using (public.is_officer());

-- Imagens do bucket "news": só membros veem; só oficiais e líder enviam/apagam.
drop policy if exists "news_images_select" on storage.objects;
create policy "news_images_select" on storage.objects
  for select to authenticated using (bucket_id = 'news' and public.is_member());

drop policy if exists "news_images_insert" on storage.objects;
create policy "news_images_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'news' and public.is_officer());

drop policy if exists "news_images_delete" on storage.objects;
create policy "news_images_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'news' and public.is_officer());

-- Histórico no clã: oficiais e líder veem de todos; cada pessoa vê o próprio. Só o banco escreve.
drop policy if exists "membership_log_select" on public.membership_log;
create policy "membership_log_select" on public.membership_log
  for select to authenticated using (user_id = auth.uid() or public.is_officer());

-- Anotações internas: só oficiais e líder. Ninguém vê (nem escreve) anotações sobre si mesmo.
-- Cada um apaga as próprias; o líder pode apagar qualquer uma.
drop policy if exists "notes_select" on public.member_notes;
create policy "notes_select" on public.member_notes
  for select to authenticated
  using (public.is_officer() and member_id <> auth.uid());

drop policy if exists "notes_insert" on public.member_notes;
create policy "notes_insert" on public.member_notes
  for insert to authenticated
  with check (public.is_officer() and author_id = auth.uid() and member_id <> auth.uid());

drop policy if exists "notes_delete" on public.member_notes;
create policy "notes_delete" on public.member_notes
  for delete to authenticated
  using (public.is_officer() and member_id <> auth.uid()
         and (author_id = auth.uid() or public.my_role() = 'leader'));

-- Tipos de evento: todos que fizeram login veem; só o líder cadastra/edita pelo site.
-- (No Table Editor do Supabase você edita direto, como dono do projeto.)
drop policy if exists "event_types_select" on public.event_types;
create policy "event_types_select" on public.event_types
  for select to authenticated using (true);

drop policy if exists "event_types_write" on public.event_types;
create policy "event_types_write" on public.event_types
  for all to authenticated
  using (public.my_role() = 'leader') with check (public.my_role() = 'leader');

-- Histórico: oficiais e líder veem de todos; cada membro vê o próprio. Só o banco escreve.
drop policy if exists "history_select" on public.profile_history;
create policy "history_select" on public.profile_history
  for select to authenticated using (user_id = auth.uid() or public.is_officer());

-- Presença real: oficiais e líder veem e registram; cada membro vê só a própria.
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance
  for select to authenticated using (user_id = auth.uid() or public.is_officer());

drop policy if exists "attendance_write" on public.attendance;
create policy "attendance_write" on public.attendance
  for all to authenticated using (public.is_officer()) with check (public.is_officer());

-- Telefone: o próprio membro vê e edita; oficiais e líder só veem.
drop policy if exists "contacts_select" on public.member_contacts;
create policy "contacts_select" on public.member_contacts
  for select to authenticated using (user_id = auth.uid() or public.is_officer());

drop policy if exists "contacts_insert_own" on public.member_contacts;
create policy "contacts_insert_own" on public.member_contacts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "contacts_update_own" on public.member_contacts;
create policy "contacts_update_own" on public.member_contacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Em qual time eu estou neste evento (usado pela regra abaixo)
create or replace function public.my_team(p_event bigint) returns text
language sql stable security definer set search_path = public as $$
  select team from public.team_slots where event_id = p_event and user_id = auth.uid()
$$;

-- Times: oficiais e líder veem todos e montam; cada membro vê só o próprio time.
drop policy if exists "team_slots_select" on public.team_slots;
create policy "team_slots_select" on public.team_slots
  for select to authenticated
  using (public.is_officer() or (public.is_member() and team = public.my_team(event_id)));

drop policy if exists "team_slots_write" on public.team_slots;
create policy "team_slots_write" on public.team_slots
  for all to authenticated using (public.is_officer()) with check (public.is_officer());

-- Perfis: cada um vê o próprio; membros aprovados veem todos.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_member());

-- Cada um só altera o próprio nome no jogo, classe e atributos (o cargo muda só pela função acima).
revoke update on public.profiles from anon, authenticated;
grant  update (game_name, char_class, armor, armor_pen, potency, resistance, resonance)
  on public.profiles to authenticated;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Eventos: membros veem; oficiais e líder criam, editam e apagam.
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
  for select to authenticated using (public.is_member());

drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events
  for insert to authenticated with check (public.is_officer());

drop policy if exists "events_update" on public.events;
create policy "events_update" on public.events
  for update to authenticated using (public.is_officer()) with check (public.is_officer());

drop policy if exists "events_delete" on public.events;
create policy "events_delete" on public.events
  for delete to authenticated using (public.is_officer());

-- Respostas: oficiais e líder veem todas. O membro comum vê a própria e a dos
-- colegas do mesmo time (para mostrar o time dele); cada um só cria/altera/apaga a própria.
drop policy if exists "rsvps_select" on public.rsvps;
create policy "rsvps_select" on public.rsvps
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_officer()
    or (public.is_member() and exists (
          select 1 from public.team_slots ts
           where ts.event_id = rsvps.event_id
             and ts.user_id  = rsvps.user_id
             and ts.team     = public.my_team(rsvps.event_id)))
  );

-- Mudar a própria resposta: só dentro do prazo e se não estiver escalado num time travado
-- (oficiais e líder podem sempre).
drop policy if exists "rsvps_insert" on public.rsvps;
create policy "rsvps_insert" on public.rsvps
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member()
              and (public.is_officer() or public.can_change_rsvp(event_id)));

drop policy if exists "rsvps_update" on public.rsvps;
create policy "rsvps_update" on public.rsvps
  for update to authenticated
  using (user_id = auth.uid() and (public.is_officer() or public.can_change_rsvp(event_id)))
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists "rsvps_delete" on public.rsvps;
create policy "rsvps_delete" on public.rsvps
  for delete to authenticated
  using (user_id = auth.uid() and (public.is_officer() or public.can_change_rsvp(event_id)));


-- =====================================================================
--  Contas pilotadas
--  Um "piloto" joga com mais de uma conta do jogo. Cada conta do jogo é um membro no site:
--    • conta com login próprio (o dono entra com a conta Google dele), que pode ter pilotos autorizados;
--    • conta sem login (managed = true), cadastrada por um piloto e respondida só pelos pilotos dela.
--  (Esta seção fica no fim porque substitui algumas regras definidas acima.)
-- =====================================================================

-- Perfis sem login próprio: o id deixa de precisar existir em auth.users (nenhum dado é alterado)
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column if not exists managed boolean not null default false;

-- Quem registrou a resposta (útil quando um piloto responde pela conta)
alter table public.rsvps add column if not exists answered_by uuid references public.profiles(id) on delete set null;

-- Quem pode pilotar qual conta
create table if not exists public.account_pilots (
  account_id   uuid not null references public.profiles(id) on delete cascade,
  pilot_id     uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'approved')),
  reason       text check (reason is null or char_length(reason) <= 300),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles(id) on delete set null,
  primary key (account_id, pilot_id),
  check (account_id <> pilot_id)
);
create index if not exists account_pilots_pilot_idx on public.account_pilots (pilot_id);

-- Posso agir por esta conta? (é a minha, ou sou piloto aprovado dela e membro ativo)
create or replace function public.can_act_as(p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_account = auth.uid()
      or (public.is_member() and exists (
            select 1 from public.account_pilots
             where account_id = p_account and pilot_id = auth.uid() and status = 'approved'))
$$;

-- A conta está ativa no clã?
create or replace function public.is_active_account(p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('member', 'officer', 'leader') from public.profiles where id = p_account), false)
$$;

-- A resposta desta conta ainda pode mudar? (prazo aberto e ela não está num time travado)
create or replace function public.can_change_rsvp_for(p_event bigint, p_account uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.rsvp_open(p_event) and not exists (
    select 1 from public.events e
      join public.team_slots ts on ts.event_id = e.id
     where e.id = p_event and e.teams_locked and ts.user_id = p_account)
$$;

-- Times de todas as contas que eu controlo neste evento
create or replace function public.my_teams(p_event bigint) returns setof text
language sql stable security definer set search_path = public as $$
  select ts.team from public.team_slots ts
   where ts.event_id = p_event
     and (ts.user_id = auth.uid()
          or exists (select 1 from public.account_pilots a
                      where a.account_id = ts.user_id and a.pilot_id = auth.uid() and a.status = 'approved'))
$$;

-- Registra quem respondeu (Vou / Não vou)
create or replace function public.set_answered_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.answered_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists rsvps_answered_by on public.rsvps;
create trigger rsvps_answered_by
  before insert or update of going on public.rsvps
  for each row execute function public.set_answered_by();

-- Piloto cadastra uma conta do jogo sem login (fica aguardando aprovação de um oficial)
create or replace function public.create_piloted_account(
  p_game_name text, p_char_class text,
  p_armor integer, p_armor_pen integer, p_potency integer, p_resistance integer, p_resonance integer
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id     uuid := gen_random_uuid();
  pilot_name text;
begin
  if not public.is_member() then
    raise exception 'Só membros aprovados podem cadastrar contas pilotadas';
  end if;
  if coalesce(trim(p_game_name), '') = '' then
    raise exception 'Informe o nome do personagem';
  end if;
  select coalesce(nullif(game_name, ''), google_name) into pilot_name from public.profiles where id = auth.uid();
  perform set_config('forhonor.reason', 'Conta pilotada cadastrada por ' || coalesce(pilot_name, '?'), true);
  insert into public.profiles (id, google_name, game_name, role, managed,
                               char_class, armor, armor_pen, potency, resistance, resonance)
  values (new_id, '', left(trim(p_game_name), 40), 'pending', true,
          p_char_class, p_armor, p_armor_pen, p_potency, p_resistance, p_resonance);
  insert into public.account_pilots (account_id, pilot_id, status, decided_at, decided_by)
  values (new_id, auth.uid(), 'approved', now(), auth.uid());
  return new_id;
end $$;

-- Piloto pede acesso a uma conta que já existe
create or replace function public.request_pilot_access(p_account uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'Só membros aprovados podem pedir acesso';
  end if;
  if p_account = auth.uid() then
    raise exception 'Esta já é a sua conta';
  end if;
  if not public.is_active_account(p_account) then
    raise exception 'Conta não encontrada ou fora do clã';
  end if;
  if exists (select 1 from public.account_pilots
              where account_id = p_account and pilot_id = auth.uid() and status = 'approved') then
    raise exception 'Você já pilota esta conta';
  end if;
  insert into public.account_pilots (account_id, pilot_id, status, reason, requested_at)
  values (p_account, auth.uid(), 'pending', left(nullif(trim(p_reason), ''), 300), now())
  on conflict (account_id, pilot_id) do update
     set status = 'pending', reason = excluded.reason, requested_at = now(), decided_at = null, decided_by = null;
end $$;

-- O dono da conta (ou um oficial/líder) aprova ou recusa o pedido
create or replace function public.decide_pilot_access(p_account uuid, p_pilot uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_account = auth.uid() or public.is_officer()) then
    raise exception 'Só o dono da conta ou um oficial pode decidir este pedido';
  end if;
  if p_approve then
    update public.account_pilots
       set status = 'approved', decided_at = now(), decided_by = auth.uid()
     where account_id = p_account and pilot_id = p_pilot;
  else
    delete from public.account_pilots
     where account_id = p_account and pilot_id = p_pilot and status = 'pending';
  end if;
end $$;

-- Tirar um piloto (o dono da conta, o próprio piloto ou um oficial/líder)
create or replace function public.remove_pilot(p_account uuid, p_pilot uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_account = auth.uid() or p_pilot = auth.uid() or public.is_officer()) then
    raise exception 'Sem permissão para tirar este piloto';
  end if;
  delete from public.account_pilots where account_id = p_account and pilot_id = p_pilot;
end $$;

-- Oficial/líder autoriza um piloto diretamente
create or replace function public.add_pilot(p_account uuid, p_pilot uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_officer() then
    raise exception 'Só oficiais e o líder podem adicionar pilotos';
  end if;
  if p_account = p_pilot then
    raise exception 'A conta não pode pilotar a si mesma';
  end if;
  if not public.is_active_account(p_pilot) then
    raise exception 'O piloto precisa ser um membro ativo do clã';
  end if;
  insert into public.account_pilots (account_id, pilot_id, status, decided_at, decided_by)
  values (p_account, p_pilot, 'approved', now(), auth.uid())
  on conflict (account_id, pilot_id) do update
     set status = 'approved', decided_at = now(), decided_by = auth.uid();
end $$;

revoke execute on function public.create_piloted_account(text, text, integer, integer, integer, integer, integer) from public, anon;
revoke execute on function public.request_pilot_access(uuid, text)          from public, anon;
revoke execute on function public.decide_pilot_access(uuid, uuid, boolean)  from public, anon;
revoke execute on function public.remove_pilot(uuid, uuid)                  from public, anon;
revoke execute on function public.add_pilot(uuid, uuid)                     from public, anon;
grant  execute on function public.create_piloted_account(text, text, integer, integer, integer, integer, integer) to authenticated;
grant  execute on function public.request_pilot_access(uuid, text)          to authenticated;
grant  execute on function public.decide_pilot_access(uuid, uuid, boolean)  to authenticated;
grant  execute on function public.remove_pilot(uuid, uuid)                  to authenticated;
grant  execute on function public.add_pilot(uuid, uuid)                     to authenticated;

-- Quem vê os vínculos de piloto: oficiais e líder (todos); cada um vê os seus. Só as funções acima escrevem.
alter table public.account_pilots enable row level security;
drop policy if exists "pilots_select" on public.account_pilots;
create policy "pilots_select" on public.account_pilots
  for select to authenticated
  using (public.is_officer() or pilot_id = auth.uid() or account_id = auth.uid());

-- ----- Regras atualizadas para considerar as contas que cada um pilota -----

-- Respostas: as contas que eu controlo, oficiais (todas) e colegas dos meus times
drop policy if exists "rsvps_select" on public.rsvps;
create policy "rsvps_select" on public.rsvps
  for select to authenticated using (
    public.can_act_as(user_id)
    or public.is_officer()
    or (public.is_member() and exists (
          select 1 from public.team_slots ts
           where ts.event_id = rsvps.event_id
             and ts.user_id  = rsvps.user_id
             and ts.team in (select public.my_teams(rsvps.event_id))))
  );

drop policy if exists "rsvps_insert" on public.rsvps;
create policy "rsvps_insert" on public.rsvps
  for insert to authenticated
  with check (public.can_act_as(user_id) and public.is_active_account(user_id)
              and (public.is_officer() or public.can_change_rsvp_for(event_id, user_id)));

drop policy if exists "rsvps_update" on public.rsvps;
create policy "rsvps_update" on public.rsvps
  for update to authenticated
  using (public.can_act_as(user_id) and (public.is_officer() or public.can_change_rsvp_for(event_id, user_id)))
  with check (public.can_act_as(user_id) and public.is_active_account(user_id));

drop policy if exists "rsvps_delete" on public.rsvps;
create policy "rsvps_delete" on public.rsvps
  for delete to authenticated
  using (public.can_act_as(user_id) and (public.is_officer() or public.can_change_rsvp_for(event_id, user_id)));

-- Times: cada membro vê os times das contas que controla
drop policy if exists "team_slots_select" on public.team_slots;
create policy "team_slots_select" on public.team_slots
  for select to authenticated
  using (public.is_officer() or (public.is_member() and team in (select public.my_teams(event_id))));

-- Perfil: o dono e os pilotos aprovados podem atualizar classe e atributos da conta
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (public.can_act_as(id)) with check (public.can_act_as(id));

-- Presença real, histórico de alterações e histórico no clã das contas que eu controlo
drop policy if exists "attendance_select" on public.attendance;
create policy "attendance_select" on public.attendance
  for select to authenticated using (public.can_act_as(user_id) or public.is_officer());

drop policy if exists "history_select" on public.profile_history;
create policy "history_select" on public.profile_history
  for select to authenticated using (public.can_act_as(user_id) or public.is_officer());

drop policy if exists "membership_log_select" on public.membership_log;
create policy "membership_log_select" on public.membership_log
  for select to authenticated using (public.can_act_as(user_id) or public.is_officer());

-- Anotações internas: ninguém vê anotações sobre contas que ele mesmo controla
drop policy if exists "notes_select" on public.member_notes;
create policy "notes_select" on public.member_notes
  for select to authenticated
  using (public.is_officer() and not public.can_act_as(member_id));

drop policy if exists "notes_insert" on public.member_notes;
create policy "notes_insert" on public.member_notes
  for insert to authenticated
  with check (public.is_officer() and author_id = auth.uid() and not public.can_act_as(member_id));

drop policy if exists "notes_delete" on public.member_notes;
create policy "notes_delete" on public.member_notes
  for delete to authenticated
  using (public.is_officer() and not public.can_act_as(member_id)
         and (author_id = auth.uid() or public.my_role() = 'leader'));

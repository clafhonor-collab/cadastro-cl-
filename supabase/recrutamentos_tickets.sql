-- =====================================================================
--  Recrutamentos e Tickets
--  Só ADICIONA tabelas, funções, regras e um espaço privado para as
--  imagens dos tickets. Nenhum dado existente é alterado ou apagado.
--  Depende do trecho "Configurações do líder" (officer_perm/require_perm).
-- =====================================================================

-- ---------- Recrutamentos ----------
create table if not exists public.recruitments (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 80),
  category    text not null default 'other' check (category in ('pvp', 'warband', 'other')),
  description text check (description is null or char_length(description) <= 1000),
  slots       integer not null check (slots between 1 and 50),
  activity_at timestamptz,
  deadline_at timestamptz,
  wanted      jsonb not null default '{}'::jsonb,
  created_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  status      text not null default 'pending' check (status in ('pending', 'open', 'closed', 'rejected')),
  decided_by  uuid references public.profiles(id) on delete set null,
  decided_at  timestamptz,
  note        text check (note is null or char_length(note) <= 300),
  closed_by   uuid references public.profiles(id) on delete set null,
  closed_at   timestamptz
);
create index if not exists recruitments_status_idx on public.recruitments (status, created_at desc);

create table if not exists public.recruit_applications (
  recruit_id  bigint not null references public.recruitments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'applied' check (status in ('applied', 'accepted', 'declined')),
  applied_at  timestamptz not null default now(),
  decided_at  timestamptz,
  primary key (recruit_id, user_id)
);

alter table public.recruitments enable row level security;
alter table public.recruit_applications enable row level security;

-- Abertos: todos os membros. Pendentes/recusados/encerrados: quem criou e a liderança.
drop policy if exists "recruit_select" on public.recruitments;
create policy "recruit_select" on public.recruitments
  for select to authenticated
  using (public.is_member() and (status = 'open' or created_by = auth.uid() or public.is_officer()));

-- Candidaturas: visíveis junto com o recrutamento (as escritas são só pelas funções abaixo)
drop policy if exists "recruit_apps_select" on public.recruit_applications;
create policy "recruit_apps_select" on public.recruit_applications
  for select to authenticated
  using (public.is_member() and exists (select 1 from public.recruitments r where r.id = recruit_id));

-- Limpa os campos recebidos do site
create or replace function public.recruit_clean_wanted(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(k, least(50, (v #>> '{}')::int)), '{}'::jsonb)
  from jsonb_each(coalesce(p, '{}'::jsonb)) as e(k, v)
  where k in ('dh', 'cruzado', 'mago', 'bk', 'monge', 'druida', 'barbaro', 'necromante', 'bruxo', 'tempest')
    and jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric >= 1
$$;

-- Quem criou pode tudo no próprio recrutamento; oficial depende das Configurações; líder pode tudo
create or replace function public.recruit_guard(p_creator uuid, p_key text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_creator = auth.uid() or public.my_role() = 'leader' then return; end if;
  if public.my_role() = 'officer' then perform public.require_perm(p_key); return; end if;
  raise exception 'Sem permissão para alterar este recrutamento' using errcode = '42501';
end $$;

create or replace function public.create_recruit(p jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_status text := case when public.my_role() = 'leader' then 'open' else 'pending' end;
begin
  if not public.is_member() then raise exception 'Só membros do clã podem criar recrutamentos' using errcode = '42501'; end if;
  insert into public.recruitments (title, category, description, slots, activity_at, deadline_at, wanted, created_by, status, decided_by, decided_at)
  values (trim(p->>'title'), coalesce(p->>'category', 'other'), nullif(trim(p->>'description'), ''), (p->>'slots')::int,
          (p->>'activity_at')::timestamptz, (p->>'deadline_at')::timestamptz, public.recruit_clean_wanted(p->'wanted'), auth.uid(), v_status,
          case when v_status = 'open' then auth.uid() end, case when v_status = 'open' then now() end)
  returning id into v_id;
  return json_build_object('id', v_id, 'status', v_status);
end $$;

create or replace function public.update_recruit(p_id bigint, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recruitments; v_acc int;
begin
  select * into r from public.recruitments where id = p_id for update;
  if not found then raise exception 'O recrutamento não existe mais'; end if;
  perform public.recruit_guard(r.created_by, 'recruit_edit');
  select count(*) into v_acc from public.recruit_applications where recruit_id = p_id and status = 'accepted';
  if (p->>'slots')::int < v_acc then raise exception 'Já há % aceitos; as vagas não podem ser menos que isso', v_acc; end if;
  update public.recruitments set
    title = trim(p->>'title'), category = coalesce(p->>'category', 'other'), description = nullif(trim(p->>'description'), ''),
    slots = (p->>'slots')::int, activity_at = (p->>'activity_at')::timestamptz, deadline_at = (p->>'deadline_at')::timestamptz,
    wanted = public.recruit_clean_wanted(p->'wanted'),
    -- recusado e corrigido por quem criou: volta para a aprovação
    status = case when r.status = 'rejected' and r.created_by = auth.uid() then 'pending' else r.status end,
    note = case when r.status = 'rejected' and r.created_by = auth.uid() then null else r.note end,
    decided_by = case when r.status = 'rejected' and r.created_by = auth.uid() then null else r.decided_by end,
    decided_at = case when r.status = 'rejected' and r.created_by = auth.uid() then null else r.decided_at end
  where id = p_id;
end $$;

create or replace function public.delete_recruit(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recruitments;
begin
  select * into r from public.recruitments where id = p_id;
  if not found then return; end if;
  perform public.recruit_guard(r.created_by, 'recruit_delete');
  delete from public.recruitments where id = p_id;
end $$;

create or replace function public.decide_recruit(p_id bigint, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recruitments;
begin
  select * into r from public.recruitments where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Este recrutamento não está aguardando aprovação'; end if;
  if not public.is_officer() then raise exception 'Só oficiais e o líder aprovam recrutamentos' using errcode = '42501'; end if;
  if public.my_role() <> 'leader' then
    if r.created_by = auth.uid() then raise exception 'Você não pode aprovar o próprio recrutamento' using errcode = '42501'; end if;
    perform public.require_perm('recruit_approve');
  end if;
  update public.recruitments set status = case when p_approve then 'open' else 'rejected' end,
    decided_by = auth.uid(), decided_at = now(), note = case when p_approve then null else left(nullif(trim(p_note), ''), 300) end
  where id = p_id;
end $$;

create or replace function public.close_recruit(p_id bigint, p_reopen boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recruitments;
begin
  select * into r from public.recruitments where id = p_id for update;
  if not found then raise exception 'O recrutamento não existe mais'; end if;
  perform public.recruit_guard(r.created_by, 'recruit_close');
  if p_reopen then
    if r.status <> 'closed' then raise exception 'Este recrutamento não está encerrado'; end if;
    update public.recruitments set status = 'open', closed_by = null, closed_at = null where id = p_id;
  else
    if r.status <> 'open' then raise exception 'Este recrutamento não está aberto'; end if;
    update public.recruitments set status = 'closed', closed_by = auth.uid(), closed_at = now() where id = p_id;
  end if;
end $$;

create or replace function public.apply_recruit(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recruitments;
begin
  if not public.is_member() then raise exception 'Só membros do clã podem se candidatar' using errcode = '42501'; end if;
  select * into r from public.recruitments where id = p_id;
  if not found or r.status <> 'open' then raise exception 'Este recrutamento não está aberto'; end if;
  if r.created_by = auth.uid() then raise exception 'Você criou este recrutamento'; end if;
  insert into public.recruit_applications (recruit_id, user_id, status, applied_at, decided_at)
  values (p_id, auth.uid(), 'applied', now(), null)
  on conflict (recruit_id, user_id) do update set status = 'applied', applied_at = now(), decided_at = null;
end $$;

create or replace function public.withdraw_recruit(p_id bigint) returns void
language sql security definer set search_path = public as $$
  delete from public.recruit_applications where recruit_id = p_id and user_id = auth.uid()
$$;

create or replace function public.decide_application(p_id bigint, p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.recruitments; a public.recruit_applications; v_acc int;
begin
  select * into r from public.recruitments where id = p_id for update;
  if not found or r.created_by <> auth.uid() then raise exception 'Só quem criou o recrutamento escolhe os participantes' using errcode = '42501'; end if;
  if p_status not in ('applied', 'accepted', 'declined') then raise exception 'Situação inválida'; end if;
  select * into a from public.recruit_applications where recruit_id = p_id and user_id = p_user for update;
  if not found then raise exception 'Esta candidatura não existe mais'; end if;
  if p_status = 'accepted' and a.status <> 'accepted' then
    select count(*) into v_acc from public.recruit_applications where recruit_id = p_id and status = 'accepted';
    if v_acc >= r.slots then raise exception 'Todas as vagas já foram preenchidas'; end if;
  end if;
  update public.recruit_applications set status = p_status, decided_at = case when p_status = 'applied' then null else now() end
  where recruit_id = p_id and user_id = p_user;
end $$;

-- ---------- Tickets ----------
create table if not exists public.tickets (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 100),
  category    text not null check (category in ('suggestion', 'improvement', 'report', 'question', 'site', 'other')),
  anonymous   boolean not null default false,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'open' check (status in ('open', 'progress', 'resolved')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table if not exists public.ticket_messages (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null default '' check (char_length(body) <= 2000),
  internal    boolean not null default false,
  images      text[] not null default '{}' check (cardinality(images) <= 3),
  created_at  timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- Sem regras de leitura direta: tudo passa pelas funções abaixo,
-- que escondem o autor dos tickets anônimos e as notas internas.
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

-- A liderança pode atender um ticket desta categoria? (líder sempre; oficial conforme as Configurações)
create or replace function public.ticket_staff(p_category text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'leader'
    or (public.my_role() = 'officer' and public.officer_perm('ticket_view') <> 'deny'
        and (p_category <> 'report' or public.officer_perm('ticket_reports') <> 'deny')), false)
$$;

create or replace function public.list_tickets() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select t.id, t.title, t.category, t.anonymous, t.status, t.assigned_to, t.created_at,
      (t.author_id = auth.uid()) as mine,
      case when t.anonymous and t.author_id <> auth.uid() then null else t.author_id end as author_id,
      (select coalesce(json_agg(json_build_object(
          'id', m.id, 'body', m.body, 'internal', m.internal, 'images', m.images, 'created_at', m.created_at,
          'from_author', m.author_id is not distinct from t.author_id,
          'author_id', case when t.anonymous and t.author_id <> auth.uid() and m.author_id = t.author_id then null else m.author_id end)
        order by m.created_at), '[]'::json)
       from public.ticket_messages m
       where m.ticket_id = t.id and (not m.internal or t.author_id <> auth.uid())) as messages
    from public.tickets t
    where public.is_member() and (t.author_id = auth.uid() or public.ticket_staff(t.category))
  ) x
$$;

create or replace function public.create_ticket(p_title text, p_category text, p_anonymous boolean, p_body text, p_images text[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_member() then raise exception 'Só membros do clã podem abrir tickets' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Escreva a mensagem do ticket'; end if;
  insert into public.tickets (title, category, anonymous, author_id) values (trim(p_title), p_category, coalesce(p_anonymous, false), auth.uid())
  returning id into v_id;
  insert into public.ticket_messages (ticket_id, author_id, body, internal, images)
  values (v_id, auth.uid(), trim(p_body), false, coalesce(p_images, '{}'));
  return v_id;
end $$;

create or replace function public.post_ticket_message(p_ticket bigint, p_body text, p_internal boolean, p_images text[]) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tickets; v_mine boolean;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if not found then raise exception 'Este ticket não existe mais'; end if;
  v_mine := t.author_id = auth.uid();
  if not v_mine then
    if not public.ticket_staff(t.category) then raise exception 'Sem permissão para responder este ticket' using errcode = '42501'; end if;
    if public.my_role() = 'officer' then perform public.require_perm('ticket_reply'); end if;
  elsif p_internal then raise exception 'Notas internas são só para quem atende';
  end if;
  if char_length(trim(coalesce(p_body, ''))) = 0 and cardinality(coalesce(p_images, '{}')) = 0 then raise exception 'Mensagem vazia'; end if;
  insert into public.ticket_messages (ticket_id, author_id, body, internal, images)
  values (p_ticket, auth.uid(), trim(coalesce(p_body, '')), coalesce(p_internal, false), coalesce(p_images, '{}'));
  -- membro escrevendo num resolvido reabre; resposta da liderança põe "Em atendimento"
  if v_mine and t.status = 'resolved' then update public.tickets set status = 'open' where id = p_ticket; end if;
  if not v_mine and not coalesce(p_internal, false) and t.status = 'open' then update public.tickets set status = 'progress' where id = p_ticket; end if;
end $$;

create or replace function public.set_ticket_status(p_ticket bigint, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  if p_status not in ('open', 'progress', 'resolved') then raise exception 'Status inválido'; end if;
  select * into t from public.tickets where id = p_ticket for update;
  if not found then raise exception 'Este ticket não existe mais'; end if;
  if t.author_id = auth.uid() then
    if p_status not in ('open', 'resolved') then raise exception 'Você só pode resolver ou reabrir o seu ticket'; end if;
  else
    if not public.ticket_staff(t.category) then raise exception 'Sem permissão' using errcode = '42501'; end if;
    if public.my_role() = 'officer' then perform public.require_perm('ticket_resolve'); end if;
  end if;
  update public.tickets set status = p_status where id = p_ticket;
end $$;

create or replace function public.assign_ticket(p_ticket bigint, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = p_ticket for update;
  if not found or t.author_id = auth.uid() or not public.ticket_staff(t.category) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  if public.my_role() = 'officer' then perform public.require_perm('ticket_reply'); end if;
  if p_user is not null and p_user <> auth.uid() then raise exception 'Você só pode assumir o ticket para você mesmo'; end if;
  update public.tickets set assigned_to = p_user,
    status = case when p_user is not null and t.status = 'open' then 'progress' else t.status end
  where id = p_ticket;
end $$;

-- Só o líder: mostra quem abriu um ticket anônimo (nada fica registrado no ticket)
create or replace function public.reveal_ticket_author(p_ticket bigint) returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'leader' then raise exception 'Só o líder pode ver o autor de um ticket anônimo' using errcode = '42501'; end if;
  return (select author_id from public.tickets where id = p_ticket);
end $$;

-- Imagens dos tickets: espaço PRIVADO (até 5 MB cada; só imagens)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Quem pode ver uma imagem: quem vê a mensagem em que ela está
create or replace function public.can_read_ticket_image(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
    where p_name = any(m.images)
      and (t.author_id = auth.uid() or public.ticket_staff(t.category))
      and (not m.internal or t.author_id <> auth.uid()))
$$;

drop policy if exists "ticket_images_insert" on storage.objects;
create policy "ticket_images_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'tickets' and public.is_member());

drop policy if exists "ticket_images_select" on storage.objects;
create policy "ticket_images_select" on storage.objects
  for select to authenticated using (bucket_id = 'tickets' and public.can_read_ticket_image(name));

-- Quem chama cada função
revoke execute on function public.recruit_clean_wanted(jsonb), public.recruit_guard(uuid, text), public.create_recruit(jsonb),
  public.update_recruit(bigint, jsonb), public.delete_recruit(bigint), public.decide_recruit(bigint, boolean, text),
  public.close_recruit(bigint, boolean), public.apply_recruit(bigint), public.withdraw_recruit(bigint),
  public.decide_application(bigint, uuid, text), public.ticket_staff(text), public.list_tickets(),
  public.create_ticket(text, text, boolean, text, text[]), public.post_ticket_message(bigint, text, boolean, text[]),
  public.set_ticket_status(bigint, text), public.assign_ticket(bigint, uuid), public.reveal_ticket_author(bigint),
  public.can_read_ticket_image(text) from public, anon;
grant execute on function public.recruit_clean_wanted(jsonb), public.recruit_guard(uuid, text), public.create_recruit(jsonb),
  public.update_recruit(bigint, jsonb), public.delete_recruit(bigint), public.decide_recruit(bigint, boolean, text),
  public.close_recruit(bigint, boolean), public.apply_recruit(bigint), public.withdraw_recruit(bigint),
  public.decide_application(bigint, uuid, text), public.ticket_staff(text), public.list_tickets(),
  public.create_ticket(text, text, boolean, text, text[]), public.post_ticket_message(bigint, text, boolean, text[]),
  public.set_ticket_status(bigint, text), public.assign_ticket(bigint, uuid), public.reveal_ticket_author(bigint),
  public.can_read_ticket_image(text) to authenticated;

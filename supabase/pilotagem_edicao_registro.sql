-- =====================================================================
--  Pilotagem: edição dos anúncios com revisão da staff + registro
--  Depende de pilotagem.sql e pilotagem_aprovacao.sql.
--
--  1. Edição: o autor edita o texto de um anúncio já aprovado e a edição
--     vai para a revisão da staff. Enquanto isso, o texto aprovado
--     continua publicado. Se a staff aprovar, o texto novo entra no lugar;
--     se recusar, o texto aprovado continua e o autor vê o motivo.
--     (Anúncio que ainda aguarda a primeira aprovação, ou que foi
--     recusado, é editado direto e continua aguardando a aprovação.)
--  2. Registro permanente: cada envio, edição, aprovação, recusa e
--     remoção, com quem fez, quando, o texto e o motivo. Não é apagado
--     quando o anúncio muda ou sai da Pilotagem. Só a liderança lê.
--
--  Só ADICIONA colunas, uma tabela, um gatilho e funções. Os anúncios
--  que já existem entram no registro com a situação atual. Pode ser
--  executado de novo.
-- =====================================================================

-- ---------- 1. Edição pendente ----------
alter table public.pilot_offers add column if not exists pending_about text;
alter table public.pilot_offers add column if not exists edit_note text;
alter table public.pilot_offers drop constraint if exists pilot_offers_pending_about_chk;
alter table public.pilot_offers add constraint pilot_offers_pending_about_chk
  check (pending_about is null or char_length(pending_about) between 1 and 300);
alter table public.pilot_offers drop constraint if exists pilot_offers_edit_note_chk;
alter table public.pilot_offers add constraint pilot_offers_edit_note_chk
  check (edit_note is null or char_length(edit_note) <= 300);

-- O autor publica ou edita o anúncio
create or replace function public.save_pilot_offer(p_about text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_about text := nullif(left(btrim(coalesce(p_about, '')), 300), '');
  o public.pilot_offers;
begin
  if not public.is_member() then raise exception 'Só membros do clã'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and (is_pilot or pilot_only)) then
    raise exception 'Marque “Também sou piloto” em Editar perfil para se cadastrar na Pilotagem';
  end if;
  if v_about is null then raise exception 'Escreva como você pode ajudar (horários, eventos, etc.)'; end if;
  select * into o from public.pilot_offers where pilot_id = auth.uid() for update;
  if o.pilot_id is null then
    -- Anúncio novo: aguarda a aprovação
    insert into public.pilot_offers (pilot_id, about, active, status)
    values (auth.uid(), v_about, coalesce(p_active, true), 'pending');
  elsif o.status <> 'approved' then
    -- Ainda não aprovado (ou recusado): edita direto e volta a aguardar
    update public.pilot_offers
       set about = v_about, active = coalesce(p_active, true), updated_at = now(),
           status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null,
           pending_about = null, edit_note = null
     where pilot_id = auth.uid();
  elsif v_about is distinct from o.about then
    -- Aprovado: o texto novo vai para a revisão; o aprovado continua publicado
    update public.pilot_offers
       set pending_about = v_about, edit_note = null, active = coalesce(p_active, true), updated_at = now()
     where pilot_id = auth.uid();
  else
    -- Mesmo texto publicado: só muda a disponibilidade (e desiste de uma edição em revisão)
    update public.pilot_offers
       set active = coalesce(p_active, true), pending_about = null, updated_at = now()
     where pilot_id = auth.uid();
  end if;
end $$;

-- Staff aprova ou recusa o anúncio novo ou a edição
create or replace function public.review_pilot_offer(p_pilot uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.pilot_offers;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
  if not public.is_officer() then
    raise exception 'Só oficiais e o líder podem aprovar anúncios de pilotagem' using errcode = '42501';
  end if;
  perform public.require_perm('pilots');
  if p_pilot = auth.uid() and public.my_role() <> 'leader' then
    raise exception 'Outra pessoa da staff precisa aprovar o seu próprio anúncio' using errcode = '42501';
  end if;
  select * into o from public.pilot_offers where pilot_id = p_pilot for update;
  if o.pilot_id is null then raise exception 'Anúncio não encontrado'; end if;
  if o.status = 'approved' and o.pending_about is not null then
    -- Edição de um anúncio já publicado
    update public.pilot_offers
       set about = case when p_approve then o.pending_about else about end,
           pending_about = null,
           edit_note = case when p_approve then null else v_note end,
           reviewed_by = auth.uid(), reviewed_at = now()
     where pilot_id = p_pilot;
  elsif o.status = 'pending' then
    update public.pilot_offers
       set status = case when p_approve then 'approved' else 'rejected' end,
           reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_note
     where pilot_id = p_pilot;
  else
    raise exception 'Este anúncio não tem nada aguardando revisão';
  end if;
end $$;

-- Tudo o que a aba Pilotagem mostra (com a edição em revisão para o autor e a staff)
create or replace function public.pilotage_board() returns json
language sql stable security definer set search_path = public as $$
  select case when not public.is_member() then null else json_build_object(
    'offers', coalesce((select json_agg(json_build_object(
        'pilot_id', o.pilot_id,
        'name', coalesce(nullif(trim(p.game_name), ''), nullif(trim(p.google_name), ''), 'Piloto'),
        'pilot_only', p.pilot_only,
        'about', o.about, 'active', o.active, 'updated_at', o.updated_at,
        'status', o.status, 'reviewed_at', o.reviewed_at,
        'reviewed_by_name', case when public.is_officer() or o.pilot_id = auth.uid() then
            (select coalesce(nullif(trim(r.game_name), ''), nullif(trim(r.google_name), ''), 'Staff') from public.profiles r where r.id = o.reviewed_by) end,
        'review_note', case when public.is_officer() or o.pilot_id = auth.uid() then o.review_note end,
        'pending_about', case when public.is_officer() or o.pilot_id = auth.uid() then o.pending_about end,
        'edit_note', case when public.is_officer() or o.pilot_id = auth.uid() then o.edit_note end,
        'accounts', (select count(*) from public.account_pilots ap
                      join public.profiles a on a.id = ap.account_id
                     where ap.pilot_id = o.pilot_id and ap.status = 'approved' and a.role in ('member', 'officer', 'leader')))
      order by o.active desc, lower(coalesce(nullif(trim(p.game_name), ''), p.google_name)))
      from public.pilot_offers o join public.profiles p on p.id = o.pilot_id
      where p.role in ('member', 'officer', 'leader') and (p.is_pilot or p.pilot_only)
        and (o.status = 'approved' or o.pilot_id = auth.uid() or public.is_officer())), '[]'::json),
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

-- O site lê os anúncios só pela função acima. Sem leitura direta da tabela pela API,
-- a edição ainda em revisão não fica visível para os membros.
revoke select on public.pilot_offers from anon, authenticated;

-- ---------- 2. Registro ----------
create table if not exists public.pilot_offer_log (
  id       bigint generated always as identity primary key,
  pilot_id uuid not null references public.profiles(id) on delete cascade,
  at       timestamptz not null default now(),
  actor    uuid references public.profiles(id) on delete set null,
  action   text not null,
  about    text,
  note     text
);
alter table public.pilot_offer_log drop constraint if exists pilot_offer_log_action_check;
alter table public.pilot_offer_log drop constraint if exists pilot_offer_log_action_chk;
alter table public.pilot_offer_log add constraint pilot_offer_log_action_chk check (action in
  ('submitted', 'approved', 'rejected', 'edit_submitted', 'edit_approved', 'edit_rejected', 'removed'));
create index if not exists pilot_offer_log_pilot_idx on public.pilot_offer_log (pilot_id, at desc);

alter table public.pilot_offer_log enable row level security;
drop policy if exists "pilot_offer_log_select" on public.pilot_offer_log;
create policy "pilot_offer_log_select" on public.pilot_offer_log
  for select to authenticated using (public.is_officer());
-- (ninguém grava direto: só o gatilho abaixo)

create or replace function public.log_pilot_offer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pilot_offer_log (pilot_id, actor, action, about)
    values (new.pilot_id, auth.uid(), 'submitted', new.about);
    return new;
  elsif tg_op = 'DELETE' then
    -- (se a conta inteira foi apagada, o registro dela some junto)
    if exists (select 1 from public.profiles where id = old.pilot_id) then
      insert into public.pilot_offer_log (pilot_id, actor, action, about)
      values (old.pilot_id, auth.uid(), 'removed', old.about);
    end if;
    return old;
  end if;
  if old.pending_about is not null and new.pending_about is null and new.reviewed_at is distinct from old.reviewed_at then
    -- Staff revisou uma edição
    insert into public.pilot_offer_log (pilot_id, actor, action, about, note)
    values (new.pilot_id, coalesce(new.reviewed_by, auth.uid()),
            case when new.about is distinct from old.about then 'edit_approved' else 'edit_rejected' end,
            old.pending_about, new.edit_note);
  elsif new.status in ('approved', 'rejected') and new.status is distinct from old.status then
    -- Staff revisou um anúncio novo
    insert into public.pilot_offer_log (pilot_id, actor, action, about, note)
    values (new.pilot_id, coalesce(new.reviewed_by, auth.uid()), new.status, new.about, new.review_note);
  elsif new.pending_about is not null and new.pending_about is distinct from old.pending_about then
    -- Autor enviou uma edição
    insert into public.pilot_offer_log (pilot_id, actor, action, about)
    values (new.pilot_id, auth.uid(), 'edit_submitted', new.pending_about);
  elsif new.status = 'pending' and (old.status <> 'pending' or new.about is distinct from old.about) then
    -- Autor reenviou (anúncio ainda não aprovado ou recusado)
    insert into public.pilot_offer_log (pilot_id, actor, action, about)
    values (new.pilot_id, auth.uid(), 'submitted', new.about);
  end if;
  return new;
end $$;

drop trigger if exists pilot_offers_log on public.pilot_offers;
create trigger pilot_offers_log after insert or update or delete on public.pilot_offers
  for each row execute function public.log_pilot_offer();

-- Anúncios que já existiam: entram no registro com a situação atual
insert into public.pilot_offer_log (pilot_id, at, actor, action, about, note)
select o.pilot_id, coalesce(o.reviewed_at, o.updated_at),
       case when o.status = 'pending' then o.pilot_id else o.reviewed_by end,
       case when o.status = 'pending' then 'submitted' else o.status end,
       o.about, o.review_note
  from public.pilot_offers o
 where not exists (select 1 from public.pilot_offer_log l where l.pilot_id = o.pilot_id);

-- Registro para a tela (liderança): com os nomes prontos
create or replace function public.pilot_offer_history() returns json
language sql stable security definer set search_path = public as $$
  select case when not public.is_officer() then '[]'::json else coalesce((
    select json_agg(json_build_object(
        'id', l.id, 'pilot_id', l.pilot_id, 'at', l.at, 'action', l.action, 'about', l.about, 'note', l.note,
        'actor', l.actor,
        'pilot_name', coalesce(nullif(trim(p.game_name), ''), nullif(trim(p.google_name), ''), 'Piloto'),
        'actor_name', (select coalesce(nullif(trim(a.game_name), ''), nullif(trim(a.google_name), ''), 'Staff')
                         from public.profiles a where a.id = l.actor),
        'actor_role', (select a.role from public.profiles a where a.id = l.actor))
      order by l.at desc, l.id desc)
    from (select * from public.pilot_offer_log order by at desc, id desc limit 300) l
    join public.profiles p on p.id = l.pilot_id), '[]'::json) end
$$;

revoke execute on function public.log_pilot_offer()      from public, anon, authenticated;
revoke execute on function public.pilot_offer_history()  from public, anon;
grant  execute on function public.pilot_offer_history()  to authenticated;

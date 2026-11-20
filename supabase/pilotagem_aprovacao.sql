-- =====================================================================
--  Pilotagem: a staff aprova os anúncios antes de aparecerem em
--  "Pilotos disponíveis" (Utils → Pilotagem). Depende de pilotagem.sql.
--
--  - Anúncio novo, ou com o texto alterado, fica "aguardando aprovação".
--    Pausar ou voltar a ficar disponível não precisa de nova aprovação.
--  - O líder e os oficiais com a permissão "Gerenciar pilotos de contas"
--    aprovam ou recusam (com motivo opcional, que o piloto vê).
--  - Só anúncios aprovados aparecem para os membros e recebem pedidos.
--  - Anúncios que já existiam antes deste arquivo continuam publicados.
--
--  Só ADICIONA colunas e atualiza funções. Pode ser executado de novo.
-- =====================================================================

-- Os anúncios já existentes ficam aprovados; os novos começam aguardando
alter table public.pilot_offers add column if not exists status text not null default 'approved';
alter table public.pilot_offers alter column status set default 'pending';
alter table public.pilot_offers drop constraint if exists pilot_offers_status_chk;
alter table public.pilot_offers add constraint pilot_offers_status_chk check (status in ('pending', 'approved', 'rejected'));
alter table public.pilot_offers add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.pilot_offers add column if not exists reviewed_at timestamptz;
alter table public.pilot_offers add column if not exists review_note text;
alter table public.pilot_offers drop constraint if exists pilot_offers_review_note_chk;
alter table public.pilot_offers add constraint pilot_offers_review_note_chk check (review_note is null or char_length(review_note) <= 300);

-- Leitura direta: membros veem só os aprovados; o próprio piloto e a staff veem todos
drop policy if exists "pilot_offers_select" on public.pilot_offers;
create policy "pilot_offers_select" on public.pilot_offers
  for select to authenticated
  using (public.is_officer() or pilot_id = auth.uid() or (public.is_member() and status = 'approved'));

-- Tudo o que a aba Pilotagem mostra (agora com a situação de cada anúncio)
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

-- O piloto publica ou edita o anúncio: texto novo (ou anúncio recusado) volta para a aprovação da staff
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
    insert into public.pilot_offers (pilot_id, about, active, status)
    values (auth.uid(), v_about, coalesce(p_active, true), 'pending');
  elsif o.about is distinct from v_about or o.status = 'rejected' then
    update public.pilot_offers
       set about = v_about, active = coalesce(p_active, true), updated_at = now(),
           status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null
     where pilot_id = auth.uid();
  else
    update public.pilot_offers set active = coalesce(p_active, true), updated_at = now() where pilot_id = auth.uid();
  end if;
end $$;

-- Staff aprova ou recusa o anúncio
create or replace function public.review_pilot_offer(p_pilot uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_officer() then
    raise exception 'Só oficiais e o líder podem aprovar anúncios de pilotagem' using errcode = '42501';
  end if;
  perform public.require_perm('pilots');
  if p_pilot = auth.uid() and public.my_role() <> 'leader' then
    raise exception 'Outra pessoa da staff precisa aprovar o seu próprio anúncio' using errcode = '42501';
  end if;
  update public.pilot_offers
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
   where pilot_id = p_pilot;
  if not found then raise exception 'Anúncio não encontrado'; end if;
end $$;

-- Pedido de pilotagem: só para anúncios aprovados e disponíveis
create or replace function public.request_pilotage(p_pilot uuid, p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Só membros do clã'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and pilot_only) then
    raise exception 'Membro piloto não tem conta própria para ser pilotada';
  end if;
  if p_pilot = auth.uid() then raise exception 'Você não pode pedir a si mesmo'; end if;
  if not exists (select 1 from public.pilot_offers o join public.profiles p on p.id = o.pilot_id
                  where o.pilot_id = p_pilot and o.active and o.status = 'approved'
                    and p.role in ('member', 'officer', 'leader')) then
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

revoke execute on function public.review_pilot_offer(uuid, boolean, text) from public, anon;
grant  execute on function public.review_pilot_offer(uuid, boolean, text) to authenticated;

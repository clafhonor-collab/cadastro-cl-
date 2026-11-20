-- =====================================================================
--  Pedido para sair do clã (Novembro/2026)
--  O membro (ou quem pilota a conta) pede para sair, com motivo obrigatório.
--  A liderança aprova ou recusa. Aprovado: a conta vira "Ex-membro", igual
--  ao "Remover do clã" (o histórico é mantido e dá para readmitir depois).
--  Quem aprova: o líder sempre; oficiais conforme a nova permissão
--  "leave_approve" (Configurações → Membros → Aprovar saída do clã).
--  Oficiais só aprovam pedidos de membros comuns; o de oficiais fica com o líder.
--  Só ADICIONA tabela e funções, e atualiza o gatilho de permissões de cargo
--  para aceitar a saída aprovada. Nenhum dado existente é alterado ou apagado.
-- =====================================================================

create table if not exists public.leave_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reason       text not null check (char_length(btrim(reason)) between 1 and 300),
  requested_by uuid default auth.uid() references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by   uuid references public.profiles(id) on delete set null,
  decided_at   timestamptz,
  note         text check (note is null or char_length(note) <= 300)
);
-- No máximo um pedido em aberto por conta
create unique index if not exists leave_requests_one_pending on public.leave_requests (user_id) where status = 'pending';

alter table public.leave_requests enable row level security;
-- Ver: a própria pessoa, quem pilota a conta e a liderança. Escrever: só pelas funções abaixo.
drop policy if exists "leave_select" on public.leave_requests;
create policy "leave_select" on public.leave_requests
  for select to authenticated using (public.can_act_as(user_id) or public.is_officer());

-- Pedir para sair
create or replace function public.request_leave(p_user uuid, p_reason text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_role text; v_id bigint;
begin
  if not public.can_act_as(p_user) then
    raise exception 'Você não pode pedir a saída desta conta' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role = 'leader' then raise exception 'O líder não pode sair do clã por aqui'; end if;
  if v_role is null or v_role not in ('member', 'officer') then raise exception 'Esta conta não está ativa no clã'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then raise exception 'Informe o motivo da saída'; end if;
  if exists (select 1 from public.leave_requests where user_id = p_user and status = 'pending') then
    raise exception 'Já existe um pedido de saída em aberto para esta conta';
  end if;
  insert into public.leave_requests (user_id, reason) values (p_user, left(btrim(p_reason), 300)) returning id into v_id;
  return v_id;
end $$;

-- Desistir do pedido
create or replace function public.cancel_leave(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.leave_requests;
begin
  select * into r from public.leave_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Este pedido não está mais em aberto'; end if;
  if not public.can_act_as(r.user_id) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  update public.leave_requests set status = 'cancelled', decided_by = auth.uid(), decided_at = now() where id = p_id;
end $$;

-- Aprovar ou recusar
create or replace function public.decide_leave(p_id bigint, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.leave_requests; v_cur text; v_me text := public.my_role();
begin
  select * into r from public.leave_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception 'Este pedido já foi decidido'; end if;
  if public.can_act_as(r.user_id) then raise exception 'Você não pode decidir o pedido da sua própria conta'; end if;
  select role into v_cur from public.profiles where id = r.user_id;
  if v_me = 'leader' then
    null;
  elsif v_me = 'officer' and v_cur in ('member', 'former') then
    perform public.require_perm('leave_approve');
  else
    raise exception 'Sem permissão para decidir este pedido' using errcode = '42501';
  end if;
  if p_approve and v_cur is distinct from 'former' then
    -- Mesmo efeito do "Remover do clã"
    perform set_config('forhonor.leave_ok', '1', true);
    perform set_config('forhonor.reason', left('Pediu para sair do clã: ' || r.reason, 300), true);
    update public.profiles set role = 'former' where id = r.user_id;
    delete from public.rsvps v using public.events e
     where v.event_id = e.id and v.user_id = r.user_id and e.starts_at > now();
    delete from public.member_contacts where user_id = r.user_id;
    delete from public.account_pilots where pilot_id = r.user_id;
    perform set_config('forhonor.leave_ok', '', true);
  end if;
  update public.leave_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(),
         note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
   where id = p_id;
end $$;

revoke execute on function public.request_leave(uuid, text) from public, anon;
revoke execute on function public.cancel_leave(bigint) from public, anon;
revoke execute on function public.decide_leave(bigint, boolean, text) from public, anon;
grant  execute on function public.request_leave(uuid, text) to authenticated;
grant  execute on function public.cancel_leave(bigint) to authenticated;
grant  execute on function public.decide_leave(bigint, boolean, text) to authenticated;

-- Gatilho de permissões de cargo: a saída aprovada por decide_leave usa a permissão
-- "leave_approve" (já conferida lá), e não "Remover membros".
create or replace function public.perm_profiles_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('forhonor.leave_ok', true) = '1' then return new; end if;
  if public.my_role() = 'officer' and new.id <> auth.uid() and new.role is distinct from old.role then
    if old.role = 'pending' and new.role = 'member' then
      perform public.require_perm('member_approve');
    elsif new.role = 'former' or (old.role = 'member' and new.role = 'pending') then
      perform public.require_perm('member_remove');
    end if;
  end if;
  return new;
end $$;

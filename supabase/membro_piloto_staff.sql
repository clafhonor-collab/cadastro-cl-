-- =====================================================================
--  Staff transforma um membro em Membro piloto (e de volta em Jogador)
--  Depende de pilotagem.sql.
--
--  Quem pode: o líder (qualquer conta) e oficiais com a permissão
--  "Gerenciar pilotos de contas" (membros e quem aguarda aprovação).
--  Contas sem login não podem virar membro piloto.
--
--  Ao virar membro piloto: as respostas e vagas da própria conta nos
--  próximos eventos são retiradas, quem pilotava a conta dele deixa de
--  pilotar e os pedidos de pilotagem dele em aberto são cancelados.
--  A troca fica no histórico do membro, com quem fez.
--
--  A mesma limpeza passa a valer quando o próprio membro escolhe
--  "Membro piloto" em Editar perfil.
--  Só ADICIONA/atualiza funções. Pode ser executado de novo.
-- =====================================================================

-- Limpeza comum quando uma conta vira membro piloto
create or replace function public.pilot_only_cleanup(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.team_slots ts
   using public.events e
   where e.id = ts.event_id and ts.user_id = p_user and e.starts_at > now();
  delete from public.rsvps r
   using public.events e
   where e.id = r.event_id and r.user_id = p_user and e.starts_at > now();
  -- ninguém pilota a conta de um membro piloto (ela não é uma conta do jogo)
  delete from public.account_pilots where account_id = p_user;
  update public.pilot_service_requests
     set status = 'cancelled', decided_at = now(), answer = coalesce(answer, 'A conta virou membro piloto')
   where account_id = p_user and status = 'pending';
end $$;

-- Staff: muda o tipo da conta de um membro
create or replace function public.set_member_kind(p_user uuid, p_pilot_only boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me     text := public.my_role();
  t      public.profiles;
  v_new  boolean := coalesce(p_pilot_only, false);
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 200), '');
begin
  if me is distinct from 'leader' and me is distinct from 'officer' then
    raise exception 'Só oficiais e o líder podem mudar o tipo de conta dos membros' using errcode = '42501';
  end if;
  perform public.require_perm('pilots');
  select * into t from public.profiles where id = p_user for update;
  if t.id is null then raise exception 'Membro não encontrado'; end if;
  if t.role = 'former' then raise exception 'Esta conta está fora do clã'; end if;
  if t.managed then
    raise exception 'Conta sem login não pode ser membro piloto (ela é uma conta do jogo pilotada por alguém)';
  end if;
  if me = 'officer' and p_user <> auth.uid() and t.role not in ('pending', 'member') then
    raise exception 'Só o líder pode mudar o tipo de conta de oficiais e do líder' using errcode = '42501';
  end if;
  if v_new = t.pilot_only and (not v_new or v_note is null or v_note is not distinct from t.pilot_note) then
    return; -- nada muda
  end if;
  if v_new then
    update public.profiles
       set pilot_only = true, is_pilot = true, pilot_note = coalesce(v_note, pilot_note)
     where id = p_user;
    if not t.pilot_only then perform public.pilot_only_cleanup(p_user); end if;
  else
    -- Volta a ser jogador e continua como piloto ("Também sou piloto")
    update public.profiles set pilot_only = false where id = p_user;
  end if;
  if v_new is distinct from t.pilot_only then
    insert into public.profile_history (user_id, changed_by, changes)
    values (p_user, auth.uid(), jsonb_build_object('pilot_only', jsonb_build_array(t.pilot_only, v_new)));
  end if;
end $$;

-- O próprio membro escolhe o tipo da conta (mesma função do pilotagem.sql, com a limpeza completa e o histórico)
create or replace function public.set_account_kind(p_pilot_only boolean, p_is_pilot boolean, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t       public.profiles;
  v_new   boolean := coalesce(p_pilot_only, false);
  v_note  text := nullif(left(btrim(coalesce(p_note, '')), 200), '');
  v_pilot boolean := coalesce(p_pilot_only, false) or coalesce(p_is_pilot, false);
begin
  select * into t from public.profiles where id = auth.uid() for update;
  if t.id is null or t.role = 'former' then
    raise exception 'Conta fora do clã';
  end if;
  if v_new and v_note is null then
    raise exception 'Informe qual conta você pilota';
  end if;
  update public.profiles
     set pilot_only = v_new,
         is_pilot   = v_pilot,
         pilot_note = case when v_pilot then v_note end
   where id = auth.uid();
  if v_new and not t.pilot_only then
    perform public.pilot_only_cleanup(auth.uid());
  end if;
  if v_new is distinct from t.pilot_only then
    insert into public.profile_history (user_id, changed_by, changes)
    values (auth.uid(), auth.uid(), jsonb_build_object('pilot_only', jsonb_build_array(t.pilot_only, v_new)));
  end if;
  if not v_pilot then
    -- Deixou de ser piloto: sai da Pilotagem e os pedidos em aberto são recusados
    delete from public.pilot_offers where pilot_id = auth.uid();
    update public.pilot_service_requests
       set status = 'declined', decided_at = now(), answer = 'Deixou de oferecer pilotagem'
     where pilot_id = auth.uid() and status = 'pending';
  end if;
end $$;

revoke execute on function public.pilot_only_cleanup(uuid)                    from public, anon, authenticated;
revoke execute on function public.set_member_kind(uuid, boolean, text)        from public, anon;
grant  execute on function public.set_member_kind(uuid, boolean, text)        to authenticated;
revoke execute on function public.set_account_kind(boolean, boolean, text)    from public, anon;
grant  execute on function public.set_account_kind(boolean, boolean, text)    to authenticated;

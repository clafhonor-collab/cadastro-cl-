-- =====================================================================
--  Correções de segurança (bloco 1 da checagem de segurança)
--
--  1. Respostas dos eventos (rsvps), quando gravadas direto pela API:
--     - o prazo e os times travados também valem para o evento de destino;
--     - não dá para mudar o evento nem a conta de uma resposta;
--     - "respondido por" é sempre quem está logado (não dá para forjar);
--     - pedido de saída só pelas funções do site (botão "Não vou poder ir…");
--     - "ausência programada" só pela tela de ausências (não dá para marcar
--       uma resposta como ausência direto e tirar o evento da frequência).
--     As funções do site (pedido de saída, decisão da staff etc.) continuam
--     funcionando como antes.
--  3. Foto de perfil: o endereço só pode ser do espaço de fotos do próprio
--     Supabase, na pasta da pessoa. Fotos com endereço de fora do site são
--     apagadas (a pessoa volta para a foto da conta Google ou a inicial).
--
--  Pode ser executado de novo.
-- =====================================================================

-- ---------- 1. Respostas dos eventos ----------
drop policy if exists "rsvps_update" on public.rsvps;
create policy "rsvps_update" on public.rsvps
  for update to authenticated
  using (public.can_act_as(user_id) and (public.is_officer() or public.can_change_rsvp_for(event_id, user_id)))
  with check (public.can_act_as(user_id) and public.is_active_account(user_id)
              and (public.is_officer() or public.can_change_rsvp_for(event_id, user_id)));

-- Gravação direta pela API (usuário "authenticated"). As funções do banco rodam
-- como dono das tabelas e não passam por estas travas.
create or replace function public.rsvp_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_abs_new bigint;
  v_abs_old bigint;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Ausência programada (coluna absence_id, se existir): só pode ser apagada, nunca criada direto
  v_abs_new := (to_jsonb(new) ->> 'absence_id')::bigint;
  v_abs_old := case when tg_op = 'UPDATE' then (to_jsonb(old) ->> 'absence_id')::bigint end;
  if v_abs_new is not null and v_abs_new is distinct from v_abs_old then
    raise exception 'Ausências são registradas na tela de ausências' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.event_id is distinct from old.event_id or new.user_id is distinct from old.user_id then
      raise exception 'Não é possível mover uma resposta para outro evento ou outra conta' using errcode = '42501';
    end if;
    if (new.withdraw_reason, new.withdraw_requested_at) is distinct from (old.withdraw_reason, old.withdraw_requested_at) then
      raise exception 'Use o botão "Não vou poder ir…" para pedir saída' using errcode = '42501';
    end if;
    if new.going is distinct from old.going then
      new.answered_by := auth.uid();
    else
      new.answered_by := old.answered_by;
    end if;
  else
    if new.withdraw_reason is not null or new.withdraw_requested_at is not null then
      raise exception 'Use o botão "Não vou poder ir…" para pedir saída' using errcode = '42501';
    end if;
    new.answered_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists rsvps_guard on public.rsvps;
create trigger rsvps_guard before insert or update on public.rsvps
  for each row execute function public.rsvp_guard();

-- ---------- 3. Foto de perfil ----------
-- Remove endereços que não são do espaço de fotos do site
update public.profiles
   set custom_avatar_url = null
 where custom_avatar_url is not null
   and custom_avatar_url not like 'https://oxwuryqvoariuxypviae.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%';

alter table public.profiles drop constraint if exists profiles_custom_avatar_url_check;
alter table public.profiles add constraint profiles_custom_avatar_url_check check (
  custom_avatar_url is null
  or custom_avatar_url like 'https://oxwuryqvoariuxypviae.supabase.co/storage/v1/object/public/avatars/' || id::text || '/%'
);

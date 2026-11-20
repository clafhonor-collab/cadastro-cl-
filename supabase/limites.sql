-- =====================================================================
--  Limites contra spam e regra dos pilotos (bloco 2 da checagem de segurança)
--
--  - Tickets: no máximo 3 por pessoa por dia (dia no horário de Brasília).
--  - Mensagens nos tickets: no máximo 30 por pessoa por hora
--    (a staff — oficiais e líder — não tem esse limite, para não travar o atendimento).
--  - Recrutamentos: no máximo 3 ativos por pessoa (aguardando aprovação ou abertos).
--    Reabrir um recrutamento encerrado também conta.
--  - Pilotos: não podem trocar o nick nem a foto da conta do dono
--    (nas contas sem login, criadas pelo próprio piloto, continuam podendo).
--
--  Valem pelo site e direto pela API. Só adiciona gatilhos; nenhum dado é
--  alterado. Pode ser executado de novo.
-- =====================================================================

-- ---------- Tickets: 3 por dia ----------
create or replace function public.limit_tickets() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
begin
  if (select count(*) from public.tickets where author_id = new.author_id and created_at >= v_start) >= 3 then
    raise exception 'Limite de 3 tickets por dia atingido. Continue a conversa em um ticket aberto ou tente de novo amanhã.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists tickets_limit on public.tickets;
create trigger tickets_limit before insert on public.tickets
  for each row execute function public.limit_tickets();

-- ---------- Mensagens: 30 por hora (exceto a staff) ----------
create or replace function public.limit_ticket_messages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is null or public.is_officer() then return new; end if;
  if (select count(*) from public.ticket_messages
       where author_id = new.author_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Limite de 30 mensagens por hora atingido. Aguarde um pouco para escrever de novo.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists ticket_messages_limit on public.ticket_messages;
create trigger ticket_messages_limit before insert on public.ticket_messages
  for each row execute function public.limit_ticket_messages();

-- ---------- Recrutamentos: 3 ativos por pessoa ----------
create or replace function public.limit_recruitments() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- só quando o recrutamento passa a contar (criado, ou reaberto depois de encerrado/recusado)
  if new.status not in ('pending', 'open') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('pending', 'open') then return new; end if;
  if (select count(*) from public.recruitments
       where created_by = new.created_by and status in ('pending', 'open') and id is distinct from new.id) >= 3 then
    raise exception 'Limite de 3 recrutamentos ativos por pessoa (aguardando aprovação ou abertos). Encerre um para criar outro.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists recruitments_limit on public.recruitments;
create trigger recruitments_limit before insert or update of status on public.recruitments
  for each row execute function public.limit_recruitments();

-- ---------- Pilotos: nick e foto só pelo dono ----------
-- Gravação direta pela API (usuário "authenticated"). As funções do banco
-- (ex.: a staff editando o nick) rodam como dono das tabelas e passam.
create or replace function public.profile_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if old.id is distinct from auth.uid() and not old.managed
     and (new.game_name, new.custom_avatar_url, new.avatar_hidden)
         is distinct from (old.game_name, old.custom_avatar_url, old.avatar_hidden) then
    raise exception 'Só o dono da conta pode trocar o nick e a foto (o piloto não pode)' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profile_guard();

revoke execute on function public.limit_tickets(), public.limit_ticket_messages(), public.limit_recruitments()
  from public, anon, authenticated;

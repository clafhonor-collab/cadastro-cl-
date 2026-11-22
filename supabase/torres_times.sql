-- =====================================================================
--  Torre Amaldiçoada / Guerra das Torres: times de até 10 membros
--  Rode este arquivo uma vez no Supabase (SQL Editor). Pode rodar de novo.
--  Só TROCA a função que confere os times: nenhum dado é alterado.
--
--  Eventos de torre (tipo ou nome com "torre") têm de 1 a 4 times de até
--  10 membros. Os outros eventos continuam com no máximo 8 por time.
-- =====================================================================

create or replace function public.team_slot_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim integer := 8;
begin
  if not exists (select 1 from public.rsvps
                 where event_id = new.event_id and user_id = new.user_id and going) then
    raise exception 'Este membro não confirmou presença no evento';
  end if;
  if exists (select 1 from public.events e
               left join public.event_types t on t.id = e.type_id
              where e.id = new.event_id
                and (e.title ilike '%torre%' or coalesce(t.name, '') ilike '%torre%')) then
    lim := 10;
  end if;
  if (select count(*) from public.team_slots
      where event_id = new.event_id and team = new.team and user_id <> new.user_id) >= lim then
    raise exception 'O time % já tem % membros', new.team, lim;
  end if;
  return new;
end $$;

drop trigger if exists team_slot_check on public.team_slots;
create trigger team_slot_check
  before insert or update on public.team_slots
  for each row execute function public.team_slot_check();

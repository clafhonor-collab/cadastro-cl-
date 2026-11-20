-- =====================================================================
--  Resultado das Guerras (Novembro/2026)
--  Oficiais e líder registram o resultado de um evento que já começou:
--  Vitória ou Derrota, clã adversário, placar (Nós × Eles, opcional)
--  e observações. Todos os membros veem o resultado na página do evento;
--  as observações ficam numa tabela separada que só a liderança lê.
--  Permissão nova em Configurações: "results" (Registrar resultados).
--  Só ADICIONA tabelas e funções. Nenhum dado existente é alterado ou apagado.
-- =====================================================================

create table if not exists public.event_results (
  event_id   bigint primary key references public.events(id) on delete cascade,
  outcome    text not null check (outcome in ('win', 'loss')),
  opponent   text check (opponent is null or char_length(opponent) between 1 and 60),
  score_us   integer check (score_us is null or score_us between 0 and 1000000000),
  score_them integer check (score_them is null or score_them between 0 and 1000000000),
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Observações: só oficiais e líder
create table if not exists public.event_result_notes (
  event_id bigint primary key references public.event_results(event_id) on delete cascade,
  notes    text not null check (char_length(notes) between 1 and 1000)
);

alter table public.event_results      enable row level security;
alter table public.event_result_notes enable row level security;

-- Ler: resultado para todos os membros; observações só para a liderança.
-- Escrever: só pelas funções abaixo.
drop policy if exists "results_select" on public.event_results;
create policy "results_select" on public.event_results
  for select to authenticated using (public.is_member());

drop policy if exists "result_notes_select" on public.event_result_notes;
create policy "result_notes_select" on public.event_result_notes
  for select to authenticated using (public.is_officer());

-- Registra ou altera o resultado de um evento
create or replace function public.save_event_result(
  p_event bigint, p_outcome text, p_opponent text, p_us integer, p_them integer, p_notes text
) returns void
language plpgsql security definer set search_path = public as $$
declare v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if not public.is_officer() then
    raise exception 'Só oficiais e o líder registram resultados' using errcode = '42501';
  end if;
  perform public.require_perm('results');
  if not exists (select 1 from public.events where id = p_event and starts_at <= now()) then
    raise exception 'O resultado só pode ser registrado depois que o evento começar';
  end if;
  if p_outcome not in ('win', 'loss') then raise exception 'Escolha Vitória ou Derrota'; end if;
  insert into public.event_results (event_id, outcome, opponent, score_us, score_them, updated_by, updated_at)
  values (p_event, p_outcome, nullif(left(btrim(coalesce(p_opponent, '')), 60), ''), p_us, p_them, auth.uid(), now())
  on conflict (event_id) do update
    set outcome = excluded.outcome, opponent = excluded.opponent, score_us = excluded.score_us,
        score_them = excluded.score_them, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  if v_notes is null then
    delete from public.event_result_notes where event_id = p_event;
  else
    insert into public.event_result_notes (event_id, notes) values (p_event, left(v_notes, 1000))
    on conflict (event_id) do update set notes = excluded.notes;
  end if;
end $$;

-- Tira o resultado de um evento (as observações saem junto)
create or replace function public.delete_event_result(p_event bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_officer() then
    raise exception 'Só oficiais e o líder alteram resultados' using errcode = '42501';
  end if;
  perform public.require_perm('results');
  delete from public.event_results where event_id = p_event;
end $$;

revoke execute on function public.save_event_result(bigint, text, text, integer, integer, text) from public, anon;
revoke execute on function public.delete_event_result(bigint) from public, anon;
grant  execute on function public.save_event_result(bigint, text, text, integer, integer, text) to authenticated;
grant  execute on function public.delete_event_result(bigint) to authenticated;

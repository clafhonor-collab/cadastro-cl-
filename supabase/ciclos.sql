-- =====================================================================
--  Ciclos do jogo para as Estatísticas do clã (Novembro/2026)
--  Cada ciclo começa numa segunda-feira, tem o lado do clã (Sombras ou
--  Imortal) e termina no domingo antes do próximo. Só a liderança vê e cadastra.
--  Quem cadastra, edita e apaga: o líder sempre; oficiais conforme a nova
--  permissão "cycles" (Configurações → Estatísticas → Gerenciar ciclos).
--  Só ADICIONA tabela e funções. Nenhum dado existente é alterado ou
--  apagado. Pode ser executado de novo.
-- =====================================================================

create table if not exists public.clan_cycles (
  id         bigint generated always as identity primary key,
  starts_on  date not null unique,
  side       text not null check (side in ('shadows', 'immortal')),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.clan_cycles enable row level security;
-- Ver: só a liderança. Escrever: só pelas funções abaixo.
drop policy if exists "cycles_select" on public.clan_cycles;
create policy "cycles_select" on public.clan_cycles
  for select to authenticated using (public.is_officer());

create or replace function public.save_cycle(p_id bigint, p_starts_on date, p_side text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.is_officer() then raise exception 'Só oficiais e o líder gerenciam os ciclos' using errcode = '42501'; end if;
  perform public.require_perm('cycles');
  if p_starts_on is null then raise exception 'Informe a data de início do ciclo'; end if;
  if p_starts_on > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'O ciclo não pode começar no futuro'; end if;
  if extract(isodow from p_starts_on) <> 1 then raise exception 'O ciclo sempre começa numa segunda-feira'; end if;
  if p_side is null or p_side not in ('shadows', 'immortal') then raise exception 'Escolha o lado do ciclo'; end if;
  if exists (select 1 from public.clan_cycles where starts_on = p_starts_on and id is distinct from p_id) then
    raise exception 'Já existe um ciclo começando nesta data';
  end if;
  if p_id is null then
    insert into public.clan_cycles (starts_on, side) values (p_starts_on, p_side) returning id into v_id;
  else
    update public.clan_cycles set starts_on = p_starts_on, side = p_side where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Ciclo não encontrado'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.delete_cycle(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_officer() then raise exception 'Só oficiais e o líder gerenciam os ciclos' using errcode = '42501'; end if;
  perform public.require_perm('cycles');
  delete from public.clan_cycles where id = p_id;
end $$;

revoke execute on function public.save_cycle(bigint, date, text) from public, anon;
revoke execute on function public.delete_cycle(bigint) from public, anon;
grant  execute on function public.save_cycle(bigint, date, text) to authenticated;
grant  execute on function public.delete_cycle(bigint) to authenticated;

-- =====================================================================
--  Sorteio: o líder revisa os ganhadores antes de publicar
--  Rode este arquivo uma vez no Supabase (SQL Editor). Pode rodar de novo.
--  Só ADICIONA colunas, uma tabela e funções. Nenhum dado é apagado.
--
--  - No horário, o banco sorteia como antes, mas o resultado fica
--    "em revisão" (status 'review'): os membros e oficiais veem só que o
--    resultado está em revisão, sem os nomes.
--  - Só o LÍDER vê os ganhadores e pode:
--      * sortear outro no lugar de um ganhador (ex.: ganhou o sorteio
--        anterior). Quem sai não volta a ser sorteado neste sorteio;
--      * sortear tudo de novo;
--      * publicar o resultado (status 'drawn'), que aparece para todos.
--  - Cada troca fica registrada (raffle_rerolls), com quem pediu e o motivo.
-- =====================================================================

-- ---------- Novo status e quem publicou ----------
alter table public.raffles drop constraint if exists raffles_status_check;
alter table public.raffles add constraint raffles_status_check check (status in ('open', 'review', 'drawn'));
alter table public.raffles add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.raffles add column if not exists reviewed_at timestamptz;

-- ---------- Trocas pedidas pelo líder ----------
create table if not exists public.raffle_rerolls (
  id         bigint generated always as identity primary key,
  raffle_id  bigint not null references public.raffles(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,   -- quem saiu (nulo = sorteou tudo de novo)
  new_user   uuid references public.profiles(id) on delete set null,  -- quem entrou no lugar
  position   integer,
  reason     text check (reason is null or char_length(reason) <= 200),
  done_by    uuid references public.profiles(id) on delete set null,
  done_at    timestamptz not null default now()
);
create index if not exists raffle_rerolls_idx on public.raffle_rerolls (raffle_id, done_at);
alter table public.raffle_rerolls enable row level security;
revoke all on public.raffle_rerolls from anon, authenticated;
grant select on public.raffle_rerolls to authenticated;
drop policy if exists "raffle_rerolls_select" on public.raffle_rerolls;
create policy "raffle_rerolls_select" on public.raffle_rerolls
  for select to authenticated using (public.my_role() = 'leader');

-- ---------- Ganhadores: só aparecem depois de publicados (o líder vê antes) ----------
drop policy if exists "raffle_winners_select" on public.raffle_winners;
create policy "raffle_winners_select" on public.raffle_winners
  for select to authenticated using (
    public.is_member() and (
      public.my_role() = 'leader'
      or exists (select 1 from public.raffles r where r.id = raffle_id and r.status = 'drawn')));

-- ---------- O sorteio no horário: agora vai para a revisão ----------
create or replace function public.run_raffle_draws() returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles; v_n int;
begin
  -- Pelo site: só membros. Pelo agendamento (pg_cron) não há usuário logado.
  if auth.uid() is not null and not public.is_member() then return; end if;
  for r in select * from public.raffles where status = 'open' and draw_at <= now() order by draw_at for update skip locked loop
    select count(*) into v_n from public.raffle_check(r.id) c where c.eligible;
    insert into public.raffle_winners (raffle_id, user_id, position)
    select r.id, x.user_id, row_number() over ()
    from (select c.user_id from public.raffle_check(r.id) c where c.eligible
          order by gen_random_uuid() limit r.winners_count) x;
    update public.raffles set status = 'review', drawn_at = now(), eligible_count = v_n where id = r.id;
  end loop;
end $$;

-- Só o líder, e só com o sorteio em revisão
create or replace function public.raffle_review_row(p_raffle bigint) returns public.raffles
language plpgsql security definer set search_path = public as $$
declare r public.raffles;
begin
  if public.my_role() is distinct from 'leader' then
    raise exception 'Só o líder revisa o resultado do sorteio' using errcode = '42501';
  end if;
  select * into r from public.raffles where id = p_raffle for update;
  if not found then raise exception 'Sorteio não encontrado'; end if;
  if r.status <> 'review' then raise exception 'Este sorteio não está em revisão'; end if;
  return r;
end $$;

-- Sorteia outro elegível no lugar de um ganhador. Quem sai não volta neste sorteio.
-- Devolve quem entrou (nulo se não houver mais ninguém elegível).
create or replace function public.raffle_reroll(p_raffle bigint, p_user uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r     public.raffles := public.raffle_review_row(p_raffle);
  v_pos int;
  v_new uuid;
begin
  select position into v_pos from public.raffle_winners where raffle_id = r.id and user_id = p_user;
  if v_pos is null then raise exception 'Este membro não está entre os ganhadores'; end if;
  delete from public.raffle_winners where raffle_id = r.id and user_id = p_user;
  select c.user_id into v_new from public.raffle_check(r.id) c
   where c.eligible
     and c.user_id not in (select w.user_id from public.raffle_winners w where w.raffle_id = r.id)
     and c.user_id not in (select x.user_id from public.raffle_rerolls x where x.raffle_id = r.id and x.user_id is not null)
     and c.user_id <> p_user
   order by gen_random_uuid() limit 1;
  if v_new is not null then
    insert into public.raffle_winners (raffle_id, user_id, position) values (r.id, v_new, v_pos);
  end if;
  insert into public.raffle_rerolls (raffle_id, user_id, new_user, position, reason, done_by)
  values (r.id, p_user, v_new, v_pos, left(nullif(trim(p_reason), ''), 200), auth.uid());
  return v_new;
end $$;

-- Sorteia tudo de novo (entre os elegíveis que não foram retirados pelo líder)
create or replace function public.raffle_reroll_all(p_raffle bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles := public.raffle_review_row(p_raffle);
begin
  delete from public.raffle_winners where raffle_id = r.id;
  insert into public.raffle_winners (raffle_id, user_id, position)
  select r.id, x.user_id, row_number() over ()
  from (select c.user_id from public.raffle_check(r.id) c
         where c.eligible
           and c.user_id not in (select x.user_id from public.raffle_rerolls x where x.raffle_id = r.id and x.user_id is not null)
         order by gen_random_uuid() limit r.winners_count) x;
  insert into public.raffle_rerolls (raffle_id, user_id, new_user, position, reason, done_by)
  values (r.id, null, null, null, left(nullif(trim(p_reason), ''), 200), auth.uid());
end $$;

-- Publica o resultado: aparece para todos os membros
create or replace function public.raffle_publish(p_raffle bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.raffles := public.raffle_review_row(p_raffle);
begin
  update public.raffles set status = 'drawn', reviewed_by = auth.uid(), reviewed_at = now(), drawn_at = now() where id = r.id;
end $$;

revoke execute on function public.raffle_review_row(bigint) from public, anon, authenticated;
revoke execute on function public.raffle_reroll(bigint, uuid, text), public.raffle_reroll_all(bigint, text),
  public.raffle_publish(bigint) from public, anon;
grant  execute on function public.raffle_reroll(bigint, uuid, text), public.raffle_reroll_all(bigint, text),
  public.raffle_publish(bigint) to authenticated;

-- ---------- Nomes que o membro recebe: ganhadores só depois de publicados ----------
create or replace function public.my_people() returns json
language sql stable security definer set search_path = public as $$
  with vis as (   -- recrutamentos que eu vejo
    select r.* from public.recruitments r where r.status = 'open' or r.created_by = auth.uid()
  ), ids as (
    -- colegas dos meus times
    select ts.user_id as id, false as attrs from public.team_slots ts
     where ts.team in (select public.my_teams(ts.event_id))
    -- recrutamentos: quem criou, quem aprovou e os candidatos (com atributos)
    union all select v.created_by, false from vis v
    union all select v.decided_by, false from vis v
    union all select a.user_id, true from public.recruit_applications a join vis v on v.id = a.recruit_id
    -- ganhadores dos sorteios
    union all select w.user_id, false from public.raffle_winners w
      join public.raffles rf on rf.id = w.raffle_id and rf.status = 'drawn'   -- só depois de publicado
    -- quem atendeu os meus tickets
    union all select t.assigned_to, false from public.tickets t where t.author_id = auth.uid()
    union all select m.author_id, false from public.ticket_messages m join public.tickets t on t.id = m.ticket_id
     where t.author_id = auth.uid() and not m.internal
    union all select l.actor, false from public.ticket_log l join public.tickets t on t.id = l.ticket_id
     where t.author_id = auth.uid()
    -- pilotos das minhas contas e contas que eu piloto
    union all select ap.pilot_id, false from public.account_pilots ap where public.can_act_as(ap.account_id)
    union all select ap.account_id, false from public.account_pilots ap where ap.pilot_id = auth.uid()
    -- autores do Malah News
    union all select n.author_id, false from public.news_posts n
  ), g as (
    select id, bool_or(attrs) as attrs from ids where id is not null group by id
  )
  select case when not public.is_member() then '[]'::json else coalesce(json_agg(
      jsonb_build_object(
        'id', p.id,
        'game_name', coalesce(nullif(trim(p.game_name), ''), nullif(trim(p.google_name), ''), 'Membro'),
        'google_name', '',
        'char_class', case when p.role = 'former' then null else p.char_class end)
      || case when g.attrs and p.role <> 'former' then jsonb_build_object(
           'armor', p.armor, 'armor_pen', p.armor_pen, 'potency', p.potency,
           'resistance', p.resistance, 'resonance', p.resonance)
         else '{}'::jsonb end), '[]'::json) end
  from g join public.profiles p on p.id = g.id
  where not public.can_act_as(p.id)
$$;

revoke execute on function public.my_people() from public, anon;
grant  execute on function public.my_people() to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  Histórico de status dos tickets (quem encerrou, reabriu ou pôs em atendimento)
--  Só ADICIONA uma tabela e um gatilho, e troca a função list_tickets por uma
--  versão que também devolve esse histórico (mesmo funcionamento).
--  Nenhum dado existente é alterado ou apagado. Pode ser executado de novo.
--  O histórico começa a contar a partir de quando este arquivo for executado.
-- =====================================================================

create table if not exists public.ticket_log (
  id          bigint generated always as identity primary key,
  ticket_id   bigint not null references public.tickets(id) on delete cascade,
  at          timestamptz not null default now(),
  actor       uuid references public.profiles(id) on delete set null,
  by_author   boolean not null default false,   -- true = foi quem abriu o ticket (o jogador)
  from_status text,
  to_status   text not null
);
create index if not exists ticket_log_ticket_idx on public.ticket_log (ticket_id, at);

-- Sem leitura direta: o histórico sai pela list_tickets, que esconde o autor dos anônimos
alter table public.ticket_log enable row level security;

-- Toda mudança de status fica registrada (pelo botão, por uma resposta ou ao assumir)
create or replace function public.log_ticket_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.ticket_log (ticket_id, actor, by_author, from_status, to_status)
    values (new.id, auth.uid(), auth.uid() is not distinct from new.author_id, old.status, new.status);
  end if;
  return null;
end $$;

drop trigger if exists ticket_status_log on public.tickets;
create trigger ticket_status_log after update of status on public.tickets
  for each row execute function public.log_ticket_status();

-- Mesma list_tickets de antes, agora com o campo "log"
create or replace function public.list_tickets() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
    select t.id, t.title, t.category, t.anonymous, t.status, t.assigned_to, t.created_at,
      (t.author_id = auth.uid()) as mine,
      case when t.anonymous and t.author_id <> auth.uid() then null else t.author_id end as author_id,
      (select coalesce(json_agg(json_build_object(
          'id', m.id, 'body', m.body, 'internal', m.internal, 'images', m.images, 'created_at', m.created_at,
          'from_author', m.author_id is not distinct from t.author_id,
          'author_id', case when t.anonymous and t.author_id <> auth.uid() and m.author_id = t.author_id then null else m.author_id end)
        order by m.created_at), '[]'::json)
       from public.ticket_messages m
       where m.ticket_id = t.id and (not m.internal or t.author_id <> auth.uid())) as messages,
      (select coalesce(json_agg(json_build_object(
          'at', l.at, 'from_status', l.from_status, 'to_status', l.to_status, 'by_author', l.by_author,
          'actor', case when l.by_author and t.anonymous and t.author_id <> auth.uid() then null else l.actor end)
        order by l.at, l.id), '[]'::json)
       from public.ticket_log l where l.ticket_id = t.id) as log
    from public.tickets t
    where public.is_member() and (t.author_id = auth.uid() or public.ticket_staff(t.category))
  ) x
$$;

revoke all on function public.list_tickets() from public, anon;
grant execute on function public.list_tickets() to authenticated;

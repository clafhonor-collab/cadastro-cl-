-- =====================================================================
--  Líder edita classe e atributos de qualquer conta + aviso ao membro
--  Rode este arquivo uma vez no Supabase (SQL Editor). Pode rodar de novo.
--  Só ADICIONA uma tabela e funções: nada é apagado.
--
--  - leader_set_build: só o LÍDER usa. Altera a classe e os atributos de
--    uma conta (membro, oficial, conta sem login...). A troca entra no
--    histórico do perfil com quem alterou (changed_by).
--  - member_notices: avisos para o membro. Quando o líder altera algo,
--    o dono da conta (e quem pilota a conta) vê "Seus atributos foram
--    alterados pela liderança, entrar em contato com a staff" até clicar
--    em "Entendi" (ack_member_notices).
-- =====================================================================

create table if not exists public.member_notices (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('build_changed')),
  changes    jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz,
  seen_by    uuid references public.profiles(id) on delete set null
);
create index if not exists member_notices_user_idx on public.member_notices (user_id, created_at desc);

alter table public.member_notices enable row level security;
revoke all on public.member_notices from anon, authenticated;
grant select on public.member_notices to authenticated;

-- O membro vê os avisos das contas que controla; a staff vê todos
drop policy if exists "member_notices_select" on public.member_notices;
create policy "member_notices_select" on public.member_notices
  for select to authenticated using (public.can_act_as(user_id) or public.is_officer());

-- ---------- Líder altera classe e atributos ----------
create or replace function public.leader_set_build(
  p_user uuid, p_char_class text, p_armor integer, p_armor_pen integer,
  p_potency integer, p_resistance integer, p_resonance integer
) returns void
language plpgsql security definer set search_path = public as $$
declare
  o    public.profiles%rowtype;
  diff jsonb := '{}'::jsonb;
begin
  if public.my_role() is distinct from 'leader' then
    raise exception 'Só o líder pode alterar os atributos de outras contas' using errcode = '42501';
  end if;
  select * into o from public.profiles where id = p_user;
  if not found then raise exception 'Conta não encontrada'; end if;
  if o.pilot_only then raise exception 'Membro piloto não tem atributos próprios'; end if;
  if p_armor < 0 or p_armor_pen < 0 or p_potency < 0 or p_resistance < 0 or p_resonance < 0 then
    raise exception 'Os atributos não podem ser negativos';
  end if;

  if o.char_class is distinct from p_char_class then diff := diff || jsonb_build_object('char_class', jsonb_build_array(o.char_class, p_char_class)); end if;
  if o.armor      is distinct from p_armor      then diff := diff || jsonb_build_object('armor',      jsonb_build_array(o.armor, p_armor)); end if;
  if o.armor_pen  is distinct from p_armor_pen  then diff := diff || jsonb_build_object('armor_pen',  jsonb_build_array(o.armor_pen, p_armor_pen)); end if;
  if o.potency    is distinct from p_potency    then diff := diff || jsonb_build_object('potency',    jsonb_build_array(o.potency, p_potency)); end if;
  if o.resistance is distinct from p_resistance then diff := diff || jsonb_build_object('resistance', jsonb_build_array(o.resistance, p_resistance)); end if;
  if o.resonance  is distinct from p_resonance  then diff := diff || jsonb_build_object('resonance',  jsonb_build_array(o.resonance, p_resonance)); end if;
  if diff = '{}'::jsonb then return; end if;

  -- O gatilho do histórico registra a troca com changed_by = líder
  update public.profiles
     set char_class = p_char_class, armor = p_armor, armor_pen = p_armor_pen,
         potency = p_potency, resistance = p_resistance, resonance = p_resonance
   where id = p_user;

  -- Avisa o dono da conta (se o líder alterou a própria conta, não precisa)
  if p_user <> auth.uid() then
    insert into public.member_notices (user_id, kind, changes, created_by)
    values (p_user, 'build_changed', diff, auth.uid());
  end if;
end $$;

revoke execute on function public.leader_set_build(uuid, text, integer, integer, integer, integer, integer) from public, anon;
grant  execute on function public.leader_set_build(uuid, text, integer, integer, integer, integer, integer) to authenticated;

-- ---------- Membro marca os avisos como vistos ("Entendi") ----------
create or replace function public.ack_member_notices(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.member_notices
     set seen_at = now(), seen_by = auth.uid()
   where id = any(p_ids) and seen_at is null and public.can_act_as(user_id);
end $$;

revoke execute on function public.ack_member_notices(bigint[]) from public, anon;
grant  execute on function public.ack_member_notices(bigint[]) to authenticated;

notify pgrst, 'reload schema';

-- =====================================================================
--  Segurança: o que um membro comum consegue ler direto pela API
--  (Postman, console do navegador etc.) fica igual ao que o site mostra.
--
--  1. Perfis: membro comum não lê a tabela "profiles". Pela função
--     list_profiles ele recebe os dados completos só das contas que
--     controla. Dos outros, só nome, foto, cargo e classe; os atributos
--     só de quem se candidatou a um recrutamento que ele vê (o site os
--     mostra ali). Quem aguarda aprovação não aparece para ele.
--  2. Média do clã (painel "Meu perfil"): função clan_averages, que
--     devolve só as médias, sem os atributos de cada um.
--  3. Respostas dos eventos: membro comum lê só as respostas das contas
--     que controla. Os colegas de time continuam aparecendo no site
--     (pelas vagas do time), sem o motivo do pedido de saída, quem
--     respondeu e os atributos daquele evento.
--
--  Oficiais e líder continuam vendo tudo. Nenhum dado é alterado ou
--  apagado. Pode ser executado de novo (sempre a versão mais recente).
-- =====================================================================

-- ---------- 1. Perfis ----------
create or replace function public.list_profiles() returns json
language sql stable security definer set search_path = public as $$
  with me as (select public.is_officer() as staff, public.is_member() as member)
  select coalesce(json_agg(
    case when me.staff or public.can_act_as(p.id) then to_jsonb(p)
    else jsonb_build_object(
      'id', p.id,
      'game_name', p.game_name,
      -- o nome da conta Google só vai para quem ainda não tem nick (é o nome exibido)
      'google_name', case when coalesce(trim(p.game_name), '') = '' then p.google_name else '' end,
      -- só a foto que o site exibe
      'avatar_url', case when p.avatar_hidden or p.custom_avatar_url is not null then null else p.avatar_url end,
      'custom_avatar_url', case when p.avatar_hidden then null else p.custom_avatar_url end,
      'avatar_hidden', p.avatar_hidden,
      'role', p.role,
      'managed', p.managed,
      'char_class', case when p.role = 'former' then null else p.char_class end
    ) || case when exists (
        -- atributos: só de quem se candidatou a um recrutamento que eu vejo
        select 1 from public.recruit_applications a
          join public.recruitments r on r.id = a.recruit_id
         where a.user_id = p.id and (r.status = 'open' or r.created_by = auth.uid()))
      then jsonb_build_object('armor', p.armor, 'armor_pen', p.armor_pen, 'potency', p.potency,
                              'resistance', p.resistance, 'resonance', p.resonance)
      else '{}'::jsonb end
    end order by p.created_at), '[]'::json)
  from public.profiles p, me
  where p.id = auth.uid()
     or me.staff
     or public.can_act_as(p.id)
     or (me.member and p.role <> 'pending')
$$;

revoke execute on function public.list_profiles() from public, anon;
grant  execute on function public.list_profiles() to authenticated;

-- Leitura direta da tabela: só as próprias contas (inclusive pilotadas), oficiais e líder
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (public.can_act_as(id) or public.is_officer());

-- ---------- 2. Média do clã ----------
create or replace function public.clan_averages() returns json
language sql stable security definer set search_path = public as $$
  select case when public.is_member() then json_build_object(
      'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
      'resistance', round(avg(resistance)), 'resonance', round(avg(resonance)), 'count', count(*))
    end
  from public.profiles
  where role in ('member', 'officer', 'leader') and char_class is not null
    and armor is not null and armor_pen is not null and potency is not null
    and resistance is not null and resonance is not null
$$;

revoke execute on function public.clan_averages() from public, anon;
grant  execute on function public.clan_averages() to authenticated;

-- ---------- 3. Respostas dos eventos ----------
drop policy if exists "rsvps_select" on public.rsvps;
create policy "rsvps_select" on public.rsvps
  for select to authenticated
  using (public.can_act_as(user_id) or public.is_officer());

-- =====================================================================
--  Segurança: o que um membro comum consegue ler direto pela API
--  (Postman, console do navegador etc.) fica igual ao que o site mostra.
--
--  1. Perfis: membro comum não lê mais a tabela "profiles" inteira.
--     Ele recebe, pela função list_profiles, os dados completos só das
--     contas que controla e, dos outros, só o que o site exibe
--     (o nome real da conta Google de quem já tem nick fica oculto).
--  2. Respostas dos eventos: membro comum lê só as respostas das contas
--     que controla. Os colegas de time continuam aparecendo no site
--     (pelas vagas do time), mas sem o motivo do pedido de saída, quem
--     respondeu e os atributos daquele evento.
--
--  Oficiais e líder continuam vendo tudo. Nenhum dado é alterado ou
--  apagado. Pode ser executado de novo.
-- =====================================================================

-- ---------- 1. Perfis ----------
create or replace function public.list_profiles() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(
    case when public.is_officer() or public.can_act_as(p.id) then to_jsonb(p)
    else jsonb_build_object(
      'id', p.id,
      'game_name', p.game_name,
      -- o nome da conta Google só aparece para quem ainda não tem nick (é o nome exibido)
      'google_name', case when coalesce(trim(p.game_name), '') = '' then p.google_name else '' end,
      'avatar_url', case when p.avatar_hidden or p.custom_avatar_url is not null then null else p.avatar_url end,
      'custom_avatar_url', case when p.avatar_hidden then null else p.custom_avatar_url end,
      'avatar_hidden', p.avatar_hidden,
      'role', p.role,
      'managed', p.managed,
      'created_at', p.created_at,
      -- classe e atributos aparecem para os membros nos recrutamentos
      'char_class', p.char_class, 'armor', p.armor, 'armor_pen', p.armor_pen,
      'potency', p.potency, 'resistance', p.resistance, 'resonance', p.resonance)
    end order by p.created_at), '[]'::json)
  from public.profiles p
  where public.is_member() or p.id = auth.uid()
$$;

revoke execute on function public.list_profiles() from public, anon;
grant  execute on function public.list_profiles() to authenticated;

-- Leitura direta da tabela: só as próprias contas (inclusive pilotadas), oficiais e líder
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (public.can_act_as(id) or public.is_officer());

-- ---------- 2. Respostas dos eventos ----------
drop policy if exists "rsvps_select" on public.rsvps;
create policy "rsvps_select" on public.rsvps
  for select to authenticated
  using (public.can_act_as(user_id) or public.is_officer());

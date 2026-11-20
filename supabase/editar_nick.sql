-- =====================================================================
--  Oficiais e líder editam o nick (nome do personagem) dos membros
--  Só ADICIONA uma função. Nenhum dado existente é alterado ou apagado.
--  Pode ser executado de novo. A troca entra no histórico do membro,
--  com quem trocou (coluna changed_by do profile_history).
-- =====================================================================

create or replace function public.set_member_name(p_user uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me  text := public.my_role();
  cur text;
  v   text := trim(coalesce(p_name, ''));
begin
  if me is distinct from 'leader' and me is distinct from 'officer' then
    raise exception 'Só oficiais e o líder podem editar o nick dos membros' using errcode = '42501';
  end if;
  if char_length(v) = 0 then raise exception 'Escreva o nick'; end if;
  if char_length(v) > 40 then raise exception 'O nick pode ter no máximo 40 caracteres'; end if;
  select role into cur from public.profiles where id = p_user;
  if cur is null then raise exception 'Membro não encontrado'; end if;
  if me = 'officer' then
    perform public.require_perm('member_rename');
    -- Oficial edita o próprio nick e o dos membros; o de outros oficiais e do líder, só o líder
    if p_user <> auth.uid() and cur not in ('pending', 'member', 'former') then
      raise exception 'Só o líder pode editar o nick de oficiais e do líder' using errcode = '42501';
    end if;
  end if;
  update public.profiles set game_name = v where id = p_user;
end $$;

revoke execute on function public.set_member_name(uuid, text) from public, anon;
grant  execute on function public.set_member_name(uuid, text) to authenticated;

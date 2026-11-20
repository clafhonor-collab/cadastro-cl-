-- =====================================================================
--  Rank de força e comparação com a mesma faixa de Ressonância
--  O membro comum não recebe os atributos dos outros (seguranca_dados.sql).
--  Esta função entrega só o resultado pronto que o site mostra no perfil:
--  média do clã, média da mesma faixa de Ressonância (±500), posição no
--  rank, Top 10 (nome, classe e pontos) e o melhor valor de cada atributo.
--  Só ADICIONA uma função. Nenhum dado é alterado ou apagado.
-- =====================================================================

create or replace function public.power_overview(p_user uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare v json; v_res integer;
begin
  if not public.is_member() or not (public.is_officer() or public.can_act_as(p_user)) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  select coalesce(resonance, 0) into v_res from public.profiles where id = p_user;
  with base as (
    select id, coalesce(nullif(trim(game_name), ''), nullif(trim(google_name), ''), 'Membro') as name, char_class,
           armor, armor_pen, potency, resistance, resonance
      from public.profiles
     where role in ('member', 'officer', 'leader') and char_class is not null
       and armor is not null and armor_pen is not null and potency is not null
       and resistance is not null and resonance is not null
  ), mx as (
    select max(armor) as armor, max(armor_pen) as armor_pen, max(potency) as potency,
           max(resistance) as resistance, max(resonance) as resonance from base
  ), sc as (
    select b.*, round(10 * (
        0.5   * case when mx.resonance  > 0 then 100.0 * b.resonance  / mx.resonance  else 0 end
      + 0.175 * case when mx.armor      > 0 then 100.0 * b.armor      / mx.armor      else 0 end
      + 0.175 * case when mx.armor_pen  > 0 then 100.0 * b.armor_pen  / mx.armor_pen  else 0 end
      + 0.075 * case when mx.potency    > 0 then 100.0 * b.potency    / mx.potency    else 0 end
      + 0.075 * case when mx.resistance > 0 then 100.0 * b.resistance / mx.resistance else 0 end))::int as score
      from base b cross join mx
  ), rk as (
    select sc.*,
           row_number() over (order by score desc, lower(name)) as pos,
           row_number() over (partition by char_class order by score desc, lower(name)) as cls_pos,
           count(*) over (partition by char_class) as cls_total
      from sc
  ), band as (
    select * from base
     where id <> p_user and resonance between greatest(0, v_res - 500) and v_res + 500
  )
  select json_build_object(
    'clan', json_build_object('count', (select count(*) from base), 'avg', (select json_build_object(
        'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
        'resistance', round(avg(resistance)), 'resonance', round(avg(resonance))) from base)),
    'band', json_build_object('lo', greatest(0, v_res - 500), 'hi', v_res + 500, 'count', (select count(*) from band),
        'avg', (select json_build_object(
          'armor', round(avg(armor)), 'armor_pen', round(avg(armor_pen)), 'potency', round(avg(potency)),
          'resistance', round(avg(resistance)), 'resonance', round(avg(resonance))) from band)),
    'best', json_build_object(
        'armor',      (select json_build_object('value', armor,      'name', name) from base order by armor desc,      lower(name) limit 1),
        'armor_pen',  (select json_build_object('value', armor_pen,  'name', name) from base order by armor_pen desc,  lower(name) limit 1),
        'potency',    (select json_build_object('value', potency,    'name', name) from base order by potency desc,    lower(name) limit 1),
        'resistance', (select json_build_object('value', resistance, 'name', name) from base order by resistance desc, lower(name) limit 1),
        'resonance',  (select json_build_object('value', resonance,  'name', name) from base order by resonance desc,  lower(name) limit 1)),
    'total', (select count(*) from rk),
    'top', (select coalesce(json_agg(json_build_object('id', id, 'game_name', name, 'char_class', char_class, 'score', score) order by pos), '[]'::json)
              from rk where pos <= 10),
    'me', (select json_build_object('pos', pos, 'score', score, 'cls_pos', cls_pos, 'cls_total', cls_total) from rk where id = p_user)
  ) into v;
  return v;
end $$;

revoke execute on function public.power_overview(uuid) from public, anon;
grant  execute on function public.power_overview(uuid) to authenticated;

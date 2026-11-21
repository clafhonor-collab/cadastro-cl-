-- =====================================================================
--  Preferência por partidas de 4 pontos (Guerra das Sombras e Vigília)
--  Rode este arquivo uma vez no Supabase (SQL Editor).
--  Só ADICIONA uma coluna na tabela de respostas (rsvps): nada é apagado.
--
--  Quem marca a opção ao confirmar presença fica com uma bandeira vermelha
--  nos times e não vai para Exaltação no "Sugerir times". Oficiais e líder
--  ainda podem colocar a pessoa em Exaltação manualmente (o site avisa).
-- =====================================================================

alter table public.rsvps add column if not exists prefer_4pts boolean not null default false;

-- Faz a API do Supabase enxergar a coluna nova na hora
notify pgrst, 'reload schema';

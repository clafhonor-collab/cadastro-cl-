// Edge Function "agenda" — agenda pessoal do membro do FOR HONOR:
// Guerras das Sombras / Vigílias / Ritos do Exílio / Torres criadas no site
// e os eventos fixos do jogo (Cofre e Assembleia) nos horários escolhidos.
// O Google Agenda, o iPhone e o Outlook buscam este link de tempos em tempos:
//   https://<projeto>.supabase.co/functions/v1/agenda?t=<código pessoal>
// O código fica em member_calendar (supabase/agenda_membro.sql).
//
// Publicar (no Supabase do FOR HONOR): Edge Functions → Deploy a new function → Via Editor,
// nome "agenda", cole este arquivo e publique. Depois, nos detalhes da função,
// DESLIGUE "Verify JWT with legacy secret" (as agendas não mandam login).
// Nenhum segredo novo: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem nas Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://forhonorcla.com.br';
const CLAN = 'FOR HONOR';
const DURATION_MIN = 60; // duração mostrada na agenda para os eventos do site

// Texto no formato da agenda: escapa , ; \ e quebras de linha, e quebra linhas longas em 75 bytes
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// ----- Eventos fixos do jogo (horário de Brasília, com a duração real) -----
const GAME = {
  vault: { title: '💰 Cofre', slots: { 12: 1, 19: 1 } },           // 12h–13h e 19h–20h
  assembly: { title: '🏛️ Assembleia', slots: { 12: 2, 19: 2 } },   // 12h–14h e 19h–21h, só nas Sombras
};
const DAYS_AHEAD = 21;            // a agenda é montada de novo a cada atualização
const IMMORTAL_MAX_DAYS = 49;     // um ciclo dura no máximo 7 semanas; depois de um Imortal vem sempre Sombras
const BRT = -3;                   // horário de Brasília (sem horário de verão)
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Assembleia no dia? Vale o último ciclo cadastrado que começou até o dia:
// Sombras → sim (até a liderança cadastrar outro); Imortal → só 7 semanas depois do início; sem ciclo → sim
function assemblyOn(ymd, cycles) {
  const last = cycles.filter((c) => c.starts_on <= ymd).at(-1);
  if (!last || last.side === 'shadows') return true;
  return ymd >= addDays(last.starts_on, IMMORTAL_MAX_DAYS);
}

function gameOccurrences(data) {
  const out = [];
  const cycles = (data.cycles || []).slice().sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  const today = new Date(Date.now() + BRT * 3600000).toISOString().slice(0, 10);
  for (let i = -1; i <= DAYS_AHEAD; i++) {
    const ymd = addDays(today, i);
    if (new Date(`${ymd}T12:00:00Z`).getUTCDay() === 0) continue; // domingo não tem
    for (const key of Object.keys(GAME)) {
      const pref = data[key];
      if (!pref) continue;
      if (key === 'assembly' && !assemblyOn(ymd, cycles)) continue;
      for (const [hour, hours] of Object.entries(GAME[key].slots)) {
        if (pref.slot !== 'both' && pref.slot !== hour) continue;
        const [y, m, d] = ymd.split('-').map(Number);
        const start = new Date(Date.UTC(y, m - 1, d, Number(hour) - BRT));
        out.push({ uid: `${key}-${ymd.replace(/-/g, '')}-${hour}`, title: GAME[key].title, start,
          end: new Date(start.getTime() + hours * 3600000), alarm: pref.alarm });
      }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t') || '';
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response('Link de agenda inválido', { status: 404 });

  const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const { data, error } = await sb.rpc('calendar_feed', { p_token: token });
  if (error) return new Response('Erro ao montar a agenda', { status: 500 });
  if (!data) return new Response('Link de agenda inválido ou trocado', { status: 404 });

  const now = utc(new Date());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${CLAN}//Agenda do cla//PT-BR`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${CLAN}`, 'X-WR-TIMEZONE:America/Sao_Paulo',
    `X-WR-CALDESC:${icsText(`Eventos do clã ${CLAN} · ${data.name}`)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of data.events) {
    const start = new Date(e.starts_at);
    const end = new Date(start.getTime() + DURATION_MIN * 60000);
    const url = `${SITE}/#/evento/${e.id}`;
    lines.push('BEGIN:VEVENT', `UID:evento-${e.id}@forhonorcla.com.br`, `DTSTAMP:${now}`,
      `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${icsText(e.title)}`,
      `DESCRIPTION:${icsText(`${e.description ? `${e.description}\n\n` : ''}Confirme sua presença: ${url}`)}`,
      `URL:${url}`);
    if (e.alarm != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`,
        `TRIGGER:${e.alarm ? `-PT${e.alarm}M` : 'PT0M'}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  // Eventos do jogo (Cofre e Assembleia): de segunda a sábado, nos horários escolhidos, horário de Brasília
  for (const g of gameOccurrences(data)) {
    lines.push('BEGIN:VEVENT', `UID:${g.uid}@forhonorcla.com.br`, `DTSTAMP:${now}`,
      `DTSTART:${utc(g.start)}`, `DTEND:${utc(g.end)}`, `SUMMARY:${icsText(g.title)}`,
      `DESCRIPTION:${icsText(`Evento do jogo · lembrete do ${CLAN}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(g.title)}`,
      `TRIGGER:${g.alarm ? `-PT${g.alarm}M` : 'PT0M'}`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Disposition': 'inline; filename="forhonor.ics"' },
  });
});

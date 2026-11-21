(() => {
  'use strict';

  const CFG = window.CLAN_CONFIG || {};
  // "?demo" no endereço força o modo demonstração (dados fictícios), útil para testar sem mexer no banco real
  const DEMO = new URLSearchParams(location.search).has('demo') || !CFG.supabaseUrl || !CFG.supabaseAnonKey;
  // Clãs rivais compartilhados com o INFERNUM: ficam no Supabase de lá (função rivals-share; chave pública)
  const RIVALS_HUB = 'https://xvqxggkmrurvcbaxyifh.supabase.co/functions/v1/rivals-share';
  const RIVALS_HUB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cXhnZ2ttcnVydmNiYXh5aWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NTk5MTEsImV4cCI6MjExMDQzNTkxMX0.BcXvqavfY-x5mTB4ETHccVnv41PqC500axBBOO6E99E';

  const ROLE_LABEL = { pending: 'Aguardando aprovação', member: 'Membro', officer: 'Oficial', leader: 'Líder', former: 'Ex-membro' };
  const ROLE_ORDER = { leader: 0, officer: 1, member: 2, pending: 3, former: 4 };
  const ACTIVE_ROLES = ['member', 'officer', 'leader'];

  const CLASSES = [
    { key: 'dh', label: 'DH', short: 'DH', color: '#7cb342' },
    { key: 'cruzado', label: 'Cruzado', short: 'CRU', color: '#e0b84a' },
    { key: 'mago', label: 'Mago', short: 'MAG', color: '#5aa0e6' },
    { key: 'bk', label: 'BK', short: 'BK', color: '#e0524a' },
    { key: 'monge', label: 'Monge', short: 'MON', color: '#f39c4a' },
    { key: 'druida', label: 'Druida', short: 'DRU', color: '#4caf8a' },
    { key: 'barbaro', label: 'Bárbaro', short: 'BAR', color: '#c58a55' },
    { key: 'necromante', label: 'Necromante', short: 'NEC', color: '#a493e0' },
    { key: 'bruxo', label: 'Bruxo', short: 'BRX', color: '#d16ba5' },
    { key: 'tempest', label: 'Tempest', short: 'TMP', color: '#3fc1c9' },
  ];
  const CLASS = Object.fromEntries(CLASSES.map((c) => [c.key, c]));
  const ATTRS = [
    { key: 'armor', label: 'Armadura', short: 'ARM' },
    { key: 'armor_pen', label: 'Perfurar Armadura', short: 'PEN' },
    { key: 'potency', label: 'Potência', short: 'POT' },
    { key: 'resistance', label: 'Resistência', short: 'RES' },
    { key: 'resonance', label: 'Ressonância', short: 'RSN' },
  ];
  const BUILD_KEYS = ['char_class', ...ATTRS.map((a) => a.key)];

  const TEAM_SIZE = 8;
  const RITE_MAX = 10;
  const WAR_GROUPS = ['Exaltação', 'Eminência', 'Renome', 'Orgulho'];
  const FORMAT_LABEL = { guerra: 'Guerra', rito: 'Outros' };
  const TEAM_NAME_MAX = 30;

  // Recrutamentos: membros procurando gente para Grupo Guerreiro, PvP etc.
  const RECRUIT_ON = true;
  const RECRUIT_CATS = [
    { key: 'pvp', label: 'Evento PvP', icon: '⚔️' },
    { key: 'warband', label: 'Grupo Guerreiro', icon: '🛡️' },
    { key: 'other', label: 'Outro', icon: '📣' },
  ];
  const RECRUIT_CAT = Object.fromEntries(RECRUIT_CATS.map((c) => [c.key, c]));
  const RECRUIT_STATUS = { pending: 'Aguardando aprovação', open: 'Aberto', closed: 'Encerrado', rejected: 'Recusado' };

  // Tickets: membros falam com a liderança (podem ser anônimos)
  const TICKETS_ON = true;
  const TICKET_CATS = [
    { key: 'suggestion', label: 'Sugestão', icon: '💡' },
    { key: 'improvement', label: 'Melhorias', icon: '🛠️' },
    { key: 'report', label: 'Reclamação / Denúncia', icon: '🚩' },
    { key: 'question', label: 'Dúvida', icon: '❓' },
    { key: 'site', label: 'Problema no site', icon: '🐞' },
    { key: 'other', label: 'Outros', icon: '📝' },
  ];
  const TICKET_CAT = Object.fromEntries(TICKET_CATS.map((c) => [c.key, c]));
  const TICKET_STATUS = { open: 'Aberto', progress: 'Em atendimento', resolved: 'Resolvido' };
  const TICKET_MAX_IMAGES = 3;
  // Limites contra spam (os mesmos do banco: supabase/limites.sql)
  const LIMITS = { ticketsPerDay: 3, msgsPerHour: 30, recruitsActive: 3 };
  // Dia no horário de Brasília (AAAA-MM-DD), para contar os tickets "de hoje"
  const brDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(d));

  // Sorteio: todo domingo às 22h (Brasília) entre os inscritos com presença nas Guerras das Sombras da semana
  const RAFFLE_ON = true;
  const RAFFLE_TZ = 'America/Sao_Paulo';
  const PRIZES = [
    { key: 'bp_simple', label: 'Passe de Batalha Simples', many: 'Passes de Batalha Simples', icon: '🎟️', max: 5 },
    { key: 'bp_boosted', label: 'Passe de Batalha Potencializado', icon: '💠' },
    { key: 'prodigy', label: 'Via do Prodígio', icon: '🌟' },
    { key: 'other', label: 'Outros', icon: '🎁', max: 10 },
  ];
  const PRIZE = Object.fromEntries(PRIZES.map((p) => [p.key, p]));
  // Próximos domingos às 22h de Brasília (= segunda 01h UTC; o Brasil não tem horário de verão desde 2019)
  function nextDrawDates(n = 8) {
    const d = new Date();
    d.setUTCHours(1, 0, 0, 0);
    while (d.getUTCDay() !== 1 || d.getTime() <= Date.now()) d.setUTCDate(d.getUTCDate() + 1);
    return Array.from({ length: n }, (_, i) => new Date(d.getTime() + i * 7 * 86400e3));
  }
  const isDrawSlot = (iso) => { const d = new Date(iso); return d.getUTCDay() === 1 && d.getUTCHours() === 1 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0; };
  // Início da semana do sorteio: segunda 00h de Brasília (6 dias e 22h antes do domingo 22h)
  function raffleWeekStart(iso) { return new Date(Date.parse(iso) - (6 * 24 + 22) * 3600e3).toISOString(); }
  // Confere o prêmio e calcula os ganhadores (um por item) — mesmas regras do banco
  function cleanRaffleRow(row) {
    const kind = row?.prize_kind;
    const draw = row?.draw_at && Number.isFinite(Date.parse(row.draw_at)) ? new Date(row.draw_at).toISOString() : null;
    if (!draw || !isDrawSlot(draw)) throw new Error('O sorteio é sempre aos domingos às 22h (horário de Brasília)');
    if (!PRIZE[kind]) throw new Error('Prêmio inválido');
    let qty = 1; let text = null;
    if (kind === 'bp_simple') {
      qty = parseInt(row.prize_qty, 10) || 1;
      if (qty < 1 || qty > 5) throw new Error('Escolha de 1 a 5 Passes de Batalha Simples');
    } else if (kind === 'other') {
      text = String(row.prize_text || '').trim().slice(0, 100);
      if (!text) throw new Error('Escreva o que será sorteado');
      qty = row.prize_qty === '' || row.prize_qty == null ? null : parseInt(row.prize_qty, 10);
      if (qty !== null && !(qty >= 1 && qty <= 10)) throw new Error('A quantidade vai de 1 a 10');
    }
    return { draw_at: draw, prize_kind: kind, prize_qty: qty, prize_text: text, winners_count: qty || 1 };
  }

  // Sugestões no campo "título" — o oficial pode digitar qualquer outro nome.
  const EVENT_SUGGESTIONS = [
    'Guerra das Sombras', 'Rito do Exílio', 'Portões Demoníacos', 'Assalto ao Cofre',
    'Arena Ancestral', 'Pesadelo Ancestral', 'Carruagem Assombrada', 'Torre Amaldiçoada',
    'Raid do clã', 'Reunião do clã',
  ];
  // Eventos que começaram há menos disso ainda aparecem em "Próximos" (com o selo "Agora");
  // depois passam sozinhos para "Passados".
  const STILL_UPCOMING_MS = 20 * 60 * 1000;
  // Prazo para responder (minutos antes do início). null = sem prazo.
  const RSVP_CLOSE_OPTIONS = [[null, 'Sem prazo'], [30, '30 min antes'], [60, '1h antes'], [120, '2h antes'], [180, '3h antes'],
    [360, '6h antes'], [720, '12h antes'], [1440, '1 dia antes']];
  const DEFAULT_RSVP_CLOSE = 120;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Botão "← Voltar" com o mesmo visual do "+ Novo evento"
  const backBtn = (href, label) => `<a href="${href}" class="btn primary back-btn">← ${label}</a>`;
  const backRow = (href, label) => `<p class="back-row">${backBtn(href, label)}</p>`;
  const pad = (n) => String(n).padStart(2, '0');
  const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? null]));

  // Texto sem acentos/maiúsculas, para comparar nomes
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  // Sugere o tipo pelo nome do evento (ex.: "Guerra das Sombras – final" → Guerra das Sombras; senão, Outros)
  function guessTypeId(title, types) {
    const t = norm(title);
    if (!t) return null;
    const other = types.find((x) => norm(x.name) === 'outros');
    const hit = types.find((x) => x !== other && t.includes(norm(x.name).split(' ')[0]));
    return (hit || other)?.id ?? null;
  }

  const state = { user: null, me: null, members: [], types: [] };

  // =====================================================================
  //  Acesso aos dados: Supabase (real) ou memória (demonstração)
  // =====================================================================

  // Datas "AAAA-MM-DD" no horário do aparelho (o clã joga no horário de Brasília)
  const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fmtDay2 = (s) => (s ? s.split('-').reverse().slice(0, 2).join('/') : '');
  const fmtDay3 = (s) => (s ? s.split('-').reverse().join('/') : '');

  // Resultado da guerra: só os campos esperados, já limpos
  function cleanResult(o) {
    const n = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.min(1e9, Math.trunc(Number(v)))));
    const t = (v, max) => { const x = String(v ?? '').trim().slice(0, max); return x || null; };
    return { outcome: o?.outcome === 'loss' ? 'loss' : 'win', opponent: t(o?.opponent, 60), score_us: n(o?.score_us), score_them: n(o?.score_them), notes: t(o?.notes, 1000) };
  }
  const scoreText = (r) => (r.score_us == null && r.score_them == null ? '' : `${r.score_us ?? '–'} × ${r.score_them ?? '–'}`);

  function supabaseApi() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    });
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const full = '*, rsvps(*), team_slots(user_id, team), attendance(user_id, present)';
    // Tickets visíveis para mim, com links temporários para as imagens
    async function listTickets() {
      const rows = ok(await sb.rpc('list_tickets')) || [];
      const paths = [...new Set(rows.flatMap((t) => (t.messages || []).flatMap((m) => m.images || [])))];
      let urls = {};
      if (paths.length) {
        const { data, error } = await sb.storage.from('tickets').createSignedUrls(paths, 3600);
        if (!error) urls = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
      }
      rows.forEach((t) => (t.messages || []).forEach((m) => { m.images = (m.images || []).map((p) => urls[p]).filter(Boolean); }));
      return rows;
    }
    // Clãs rivais: chamada à função compartilhada, com o login deste site
    async function rivalsHub(action, payload = {}) {
      const { data } = await sb.auth.getSession();
      const r = await fetch(RIVALS_HUB, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, apikey: RIVALS_HUB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || `Banco compartilhado indisponível (${r.status})`);
      return out;
    }
    return {
      async currentUser() { const { data } = await sb.auth.getSession(); return data.session?.user ?? null; },
      async rivals() { try { return await rivalsHub('list'); } catch (e) { console.warn('rivals', e); return null; } },
      async importRivalScan(o) { return (await rivalsHub('import', o)).id; },
      async deleteRivalScan(id) { await rivalsHub('delete', { id }); },
      // Ciclos do jogo (Sombras / Imortal), cadastrados pela liderança
      async cycles() {
        const r = await sb.from('clan_cycles').select('*').order('starts_on');
        return r.error ? [] : r.data; // SQL dos ciclos ainda não rodado
      },
      async saveCycle(o) { ok(await sb.rpc('save_cycle', { p_id: o.id ?? null, p_starts_on: o.starts_on, p_side: o.side })); },
      async deleteCycle(id) { ok(await sb.rpc('delete_cycle', { p_id: id })); },
      onAuthChange(cb) { sb.auth.onAuthStateChange((evt, s) => { if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') cb(s?.user ?? null); }); },
      signIn() { return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); },
      // Login pelo botão do Google no próprio site: a janela do Google mostra o domínio do site, não o do Supabase
      async signInWithIdToken(token, nonce) { ok(await sb.auth.signInWithIdToken({ provider: 'google', token, nonce })); },
      signOut() { return sb.auth.signOut(); },
      async myProfile() { return ok(await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle()); },
      // Perfis.
      //  - Oficiais e líder: a lista completa (função list_profiles).
      //  - Membro comum: o site NÃO busca a lista de perfis. Lê só as próprias contas (e as que
      //    pilota) e, dos outros, só o nome de quem aparece para ele (função my_people),
      //    sem foto, sem endereço de imagem e sem cargo.
      async members() {
        const missing = (e, fn) => e && (e.code === 'PGRST202' || new RegExp(fn).test(e.message || ''));
        if (isOfficer()) {
          const { data, error } = await sb.rpc('list_profiles');
          if (!error) return data || [];
          if (!missing(error, 'list_profiles')) throw error;
          return ok(await sb.from('profiles').select('*'));
        }
        const own = ok(await sb.from('profiles').select('*')) || []; // o banco só entrega as minhas contas
        const { data, error } = await sb.rpc('my_people');
        if (error) {
          // Só enquanto o supabase/seguranca_dados.sql mais recente não for executado
          if (!missing(error, 'my_people')) throw error;
          const { data: all, error: e2 } = await sb.rpc('list_profiles');
          if (e2) throw e2;
          return all || own;
        }
        const have = new Set(own.map((p) => p.id));
        return [...own, ...(data || []).filter((p) => !have.has(p.id))];
      },
      // Pedido de piloto (membro comum): busca uma conta pelo nick, sem baixar a lista do clã
      async findAccounts(q) { return ok(await sb.rpc('find_accounts', { p_q: q })) || []; },
      // Média dos atributos do clã (só os números, sem os atributos de cada membro)
      async clanAverages() { return ok(await sb.rpc('clan_averages')); },
      // Rank de força, média do clã e da faixa de Ressonância: só o resultado, sem os atributos de cada membro
      async powerOverview(id) { return ok(await sb.rpc('power_overview', { p_user: id })); },
      async myPhone() { return ok(await sb.from('member_contacts').select('phone').eq('user_id', state.user.id).maybeSingle())?.phone ?? ''; },
      async contacts() { return ok(await sb.from('member_contacts').select('user_id, phone')); },
      async syncProfile() { ok(await sb.rpc('sync_google_profile')); },
      async eventTypes() { return ok(await sb.from('event_types').select('*').eq('active', true).order('sort_order').order('name')); },
      async profileHistory() { return ok(await sb.from('profile_history').select('*').order('changed_at', { ascending: false }).limit(5000)); },
      // Ausências: a pessoa, quem pilota a conta e a liderança veem (com o motivo)
      async absences() { return ok(await sb.from('absences').select('*').order('starts_on', { ascending: false }).limit(500)); },
      async saveAbsence(userId, start, end, reason) { return ok(await sb.rpc('save_absence', { p_user: userId, p_start: start, p_end: end, p_reason: reason })); },
      async deleteAbsence(id) { ok(await sb.rpc('delete_absence', { p_id: id })); },
      // Pedidos para sair do clã (a pessoa, quem pilota a conta e a liderança veem)
      async leaves() { return ok(await sb.from('leave_requests').select('*').order('requested_at', { ascending: false }).limit(300)); },
      async requestLeave(userId, reason) { return ok(await sb.rpc('request_leave', { p_user: userId, p_reason: reason })); },
      async cancelLeave(id) { ok(await sb.rpc('cancel_leave', { p_id: id })); },
      async decideLeave(id, approve, note) { ok(await sb.rpc('decide_leave', { p_id: id, p_approve: !!approve, p_note: note || null })); },
      // Resultado da guerra: todos os membros veem; as observações só a liderança
      async eventResult(id) {
        const r = await sb.from('event_results').select('*').eq('event_id', id).maybeSingle();
        if (r.error || !r.data) return null; // sem resultado (ou SQL novo ainda não rodado)
        if (isOfficer()) {
          const n = await sb.from('event_result_notes').select('notes').eq('event_id', id).maybeSingle();
          r.data.notes = n.data?.notes || '';
        }
        return r.data;
      },
      // Resultados de vários eventos de uma vez (lista de eventos)
      async eventResults(ids) {
        if (!ids.length) return [];
        const r = await sb.from('event_results').select('*').in('event_id', ids);
        if (r.error) return []; // SQL novo ainda não rodado
        if (isOfficer() && r.data.length) {
          const n = await sb.from('event_result_notes').select('event_id, notes').in('event_id', r.data.map((x) => x.event_id));
          const by = Object.fromEntries((n.data || []).map((x) => [x.event_id, x.notes]));
          r.data.forEach((x) => { x.notes = by[x.event_id] || ''; });
        }
        return r.data;
      },
      async opponents() {
        const r = await sb.from('event_results').select('opponent').not('opponent', 'is', null).order('updated_at', { ascending: false }).limit(300);
        return r.error ? [] : [...new Set(r.data.map((x) => x.opponent))];
      },
      async saveResult(eventId, o) {
        ok(await sb.rpc('save_event_result', { p_event: eventId, p_outcome: o.outcome, p_opponent: o.opponent || null, p_us: o.score_us ?? null, p_them: o.score_them ?? null, p_notes: o.notes || null }));
      },
      async deleteResult(eventId) { ok(await sb.rpc('delete_event_result', { p_event: eventId })); },
      // Medalhas de todos os membros ativos (o banco calcula; a frequência detalhada continua privada)
      async badges() { return ok(await sb.rpc('member_badges')) || []; },
      async saveProfile(fields, phone) {
        ok(await sb.from('profiles').update(fields).eq('id', state.user.id));
        if (phone !== undefined) ok(await sb.from('member_contacts').upsert({ user_id: state.user.id, phone: phone || null }));
      },
      async events(past) {
        const cut = new Date(Date.now() - STILL_UPCOMING_MS).toISOString();
        const q = sb.from('events').select(full);
        return ok(await (past
          ? q.lt('starts_at', cut).order('starts_at', { ascending: false }).limit(40)
          : q.gte('starts_at', cut).order('starts_at')));
      },
      async event(id) { return ok(await sb.from('events').select(full).eq('id', id).maybeSingle()); },
      // Eventos que já começaram, para o painel de frequência
      async history(sinceIso) {
        let q = sb.from('events').select('id, title, type_id, starts_at, rsvps(user_id, going), attendance(user_id, present), team_slots(user_id, team)')
          .lte('starts_at', new Date().toISOString()).order('starts_at', { ascending: false }).limit(500);
        if (sinceIso) q = q.gte('starts_at', sinceIso);
        return ok(await q);
      },
      async createEvents(rows) { return ok(await sb.from('events').insert(rows).select('id')); },
      async notes() { return ok(await sb.from('member_notes').select('*').order('created_at', { ascending: false })); },
      async addNote(memberId, body) { ok(await sb.from('member_notes').insert({ member_id: memberId, body })); },
      async deleteNote(id) { ok(await sb.from('member_notes').delete().eq('id', id)); },
      // Pedidos de saída (depois do prazo ou com os times travados)
      async requestWithdrawal(eventId, reason, accountId) { ok(await sb.rpc('request_withdrawal', { p_event: eventId, p_reason: reason, p_user: accountId || state.user.id })); },
      async cancelWithdrawal(eventId, accountId) { ok(await sb.rpc('cancel_withdrawal', { p_event: eventId, p_user: accountId || state.user.id })); },
      async resolveWithdrawal(eventId, userId, accept) { ok(await sb.rpc('resolve_withdrawal', { p_event: eventId, p_user: userId, p_accept: accept })); },
      async updateEvent(id, row) { ok(await sb.from('events').update(row).eq('id', id)); },
      async deleteEvent(id) { ok(await sb.from('events').delete().eq('id', id)); },
      // accountId = conta do jogo que está respondendo (a própria ou uma conta pilotada)
      async setRsvp(eventId, going, build, accountId) {
        ok(await sb.from('rsvps').upsert({ event_id: eventId, user_id: accountId || state.user.id, going, updated_at: new Date().toISOString(), ...(build || {}) }));
      },
      async clearRsvp(eventId, accountId) { ok(await sb.from('rsvps').delete().eq('event_id', eventId).eq('user_id', accountId || state.user.id)); },
      async saveBuild(accountId, build) { ok(await sb.from('profiles').update(build).eq('id', accountId)); },
      // ----- Contas pilotadas -----
      async pilots() { return ok(await sb.from('account_pilots').select('*')); },
      async createPilotedAccount(gameName, b) {
        return ok(await sb.rpc('create_piloted_account', {
          p_game_name: gameName, p_char_class: b.char_class, p_armor: b.armor, p_armor_pen: b.armor_pen,
          p_potency: b.potency, p_resistance: b.resistance, p_resonance: b.resonance,
        }));
      },
      async requestPilotAccess(accountId, reason) { ok(await sb.rpc('request_pilot_access', { p_account: accountId, p_reason: reason || '' })); },
      async decidePilotAccess(accountId, pilotId, approve) { ok(await sb.rpc('decide_pilot_access', { p_account: accountId, p_pilot: pilotId, p_approve: approve })); },
      async removePilot(accountId, pilotId) { ok(await sb.rpc('remove_pilot', { p_account: accountId, p_pilot: pilotId })); },
      async addPilot(accountId, pilotId) { ok(await sb.rpc('add_pilot', { p_account: accountId, p_pilot: pilotId })); },
      // ----- Membro piloto e Pilotagem (supabase/pilotagem.sql) -----
      async setAccountKind(pilotOnly, isPilot, note) { ok(await sb.rpc('set_account_kind', { p_pilot_only: !!pilotOnly, p_is_pilot: !!isPilot, p_note: note || null })); },
      // Staff: transforma um membro em membro piloto (ou de volta em jogador)
      async setMemberKind(userId, pilotOnly, note) { ok(await sb.rpc('set_member_kind', { p_user: userId, p_pilot_only: !!pilotOnly, p_note: note || null })); },
      async pilotageBoard() { return ok(await sb.rpc('pilotage_board')) || { offers: [], requests: [] }; },
      async savePilotOffer(about, active) { ok(await sb.rpc('save_pilot_offer', { p_about: about, p_active: !!active })); },
      async deletePilotOffer(pilotId) { ok(await sb.rpc('delete_pilot_offer', { p_pilot: pilotId })); },
      async reviewPilotOffer(pilotId, approve, note) { ok(await sb.rpc('review_pilot_offer', { p_pilot: pilotId, p_approve: !!approve, p_note: note || null })); },
      // Registro dos anúncios (liderança): quem enviou, aprovou, recusou ou removeu cada anúncio
      async pilotOfferHistory() { return ok(await sb.rpc('pilot_offer_history')) || []; },
      async requestPilotage(pilotId, message) { ok(await sb.rpc('request_pilotage', { p_pilot: pilotId, p_message: message || null })); },
      async cancelPilotage(id) { ok(await sb.rpc('cancel_pilotage', { p_id: id })); },
      async answerPilotage(id, accept, answer) { ok(await sb.rpc('answer_pilotage', { p_id: id, p_accept: !!accept, p_answer: answer || null })); },
      async setRole(userId, role) { ok(await sb.rpc('set_member_role', { target: userId, new_role: role })); },
      async removeMember(userId, reason, withManaged) { ok(await sb.rpc('remove_member', { target: userId, reason: reason || '', with_managed: !!withManaged })); },
      async renameMember(userId, name) { ok(await sb.rpc('set_member_name', { p_user: userId, p_name: name })); },
      async requestRejoin() { ok(await sb.rpc('request_rejoin')); },
      // ----- Malah News (imagens no bucket privado "news") -----
      async news() {
        const rows = ok(await sb.from('news_posts').select('*').order('published_at', { ascending: false }).limit(60));
        if (!rows.length) return rows;
        const { data, error } = await sb.storage.from('news').createSignedUrls(rows.map((r) => r.image_path), 3600);
        if (error) throw error;
        const urls = Object.fromEntries((data || []).map((d) => [d.path, d.signedUrl]));
        rows.forEach((r) => { r.image_url = urls[r.image_path] || null; });
        return rows;
      },
      async latestNewsAt() {
        const rows = ok(await sb.from('news_posts').select('published_at').order('published_at', { ascending: false }).limit(1));
        return rows[0]?.published_at || null;
      },
      async uploadNewsImage(file) {
        const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif' }[file.type] || 'jpg';
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from('news').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        return path;
      },
      async createNewsFromPath({ image_path, title, caption }) {
        const { error } = await sb.from('news_posts').insert({ title, caption: caption || null, image_path });
        if (error) throw error;
      },
      async removeNewsImage(path) { if (path) await sb.storage.from('news').remove([path]); },
      async createNews({ file, title, caption }) {
        const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif' }[file.type] || 'jpg';
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from('news').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        const { error } = await sb.from('news_posts').insert({ title, caption: caption || null, image_path: path });
        if (error) { await sb.storage.from('news').remove([path]); throw error; }
      },
      // ----- Recrutamentos (regras garantidas pelas funções do banco) -----
      async recruitments() { return ok(await sb.from('recruitments').select('*, applications:recruit_applications(*)').order('created_at', { ascending: false }).limit(300)); },
      async recruitment(id) { return ok(await sb.from('recruitments').select('*, applications:recruit_applications(*)').eq('id', id).maybeSingle()); },
      async createRecruit(row) { return ok(await sb.rpc('create_recruit', { p: row })); },
      async updateRecruit(id, row) { ok(await sb.rpc('update_recruit', { p_id: id, p: row })); },
      async deleteRecruit(id) { ok(await sb.rpc('delete_recruit', { p_id: id })); },
      async decideRecruit(id, approve, note) { ok(await sb.rpc('decide_recruit', { p_id: id, p_approve: !!approve, p_note: note || null })); },
      async closeRecruit(id, reopen = false) { ok(await sb.rpc('close_recruit', { p_id: id, p_reopen: !!reopen })); },
      async applyRecruit(id) { ok(await sb.rpc('apply_recruit', { p_id: id })); },
      async withdrawRecruit(id) { ok(await sb.rpc('withdraw_recruit', { p_id: id })); },
      async decideApplication(id, userId, status) { ok(await sb.rpc('decide_application', { p_id: id, p_user: userId, p_status: status })); },
      // ----- Tickets (o banco esconde o autor dos anônimos; imagens no bucket privado "tickets") -----
      async tickets() { return listTickets(); },
      async ticket(id) { return (await listTickets()).find((t) => t.id === id) || null; },
      async uploadTicketImage(file) {
        const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif' }[file.type] || 'jpg';
        // o caminho não leva o id de quem enviou (para não revelar autores anônimos)
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from('tickets').upload(path, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
        return path;
      },
      async createTicket({ title, category, anonymous, body, images }) {
        return ok(await sb.rpc('create_ticket', { p_title: title, p_category: category, p_anonymous: !!anonymous, p_body: body, p_images: images || [] }));
      },
      async postTicketMessage(id, { body, internal, images }) {
        ok(await sb.rpc('post_ticket_message', { p_ticket: id, p_body: body || '', p_internal: !!internal, p_images: images || [] }));
      },
      async setTicketStatus(id, status) { ok(await sb.rpc('set_ticket_status', { p_ticket: id, p_status: status })); },
      async assignTicket(id, userId) { ok(await sb.rpc('assign_ticket', { p_ticket: id, p_user: userId || null })); },
      async revealTicketAuthor(id) { return ok(await sb.rpc('reveal_ticket_author', { p_ticket: id })); },
      // ----- Sorteio (o sorteio em si acontece no banco, em run_raffle_draws) -----
      async raffles() {
        return ok(await sb.from('raffles').select('*, entries:raffle_entries(raffle_id, user_id, entered_at, removed_at), winners:raffle_winners(*)')
          .order('draw_at', { ascending: false }).limit(60));
      },
      async runRaffleDraws() { ok(await sb.rpc('run_raffle_draws')); },
      async raffleStaff(id) { return ok(await sb.rpc('raffle_staff_view', { p_raffle: id })); },
      async raffleRemovals() { return ok(await sb.rpc('raffle_removals')) || []; },
      async createRaffle(row) { return ok(await sb.rpc('create_raffle', { p: cleanRaffleRow(row) })); },
      async updateRaffle(id, row) { ok(await sb.rpc('update_raffle', { p_id: id, p: cleanRaffleRow(row) })); },
      async deleteRaffle(id) { ok(await sb.rpc('delete_raffle', { p_id: id })); },
      async joinRaffle(id) { ok(await sb.rpc('join_raffle', { p_id: id })); },
      async leaveRaffle(id) { ok(await sb.rpc('leave_raffle', { p_id: id })); },
      async removeRaffleEntry(id, userId, reason) { ok(await sb.rpc('remove_raffle_entry', { p_id: id, p_user: userId, p_reason: reason })); },
      // ----- Configurações do líder -----
      async perms() { return ok(await sb.from('officer_permissions').select('perm_key, mode')); },
      async setPerm(key, mode) { ok(await sb.from('officer_permissions').upsert({ perm_key: key, mode, updated_by: state.user.id, updated_at: new Date().toISOString() })); },
      async resetPerms() { ok(await sb.from('officer_permissions').delete().neq('perm_key', '')); },
      async requests() { return ok(await sb.from('officer_requests').select('*').order('requested_at', { ascending: false }).limit(100)); },
      async createRequest(r) { ok(await sb.from('officer_requests').insert(r)); },
      async decideRequest(id, status, note, summary) {
        ok(await sb.from('officer_requests').update({ status, note: note ? String(note).slice(0, 300) : null, decided_by: state.user.id, decided_at: new Date().toISOString(), ...(summary ? { summary: summary.slice(0, 500) } : {}) })
          .eq('id', id).eq('status', 'pending'));
      },
      async updateNews(id, fields) { ok(await sb.from('news_posts').update({ ...fields, edited_at: new Date().toISOString() }).eq('id', id)); },
      async deleteNews(post) {
        ok(await sb.from('news_posts').delete().eq('id', post.id));
        await sb.storage.from('news').remove([post.image_path]);
      },
      async membershipLog(userId) {
        let q = sb.from('membership_log').select('*').order('changed_at', { ascending: false });
        if (userId) q = q.eq('user_id', userId);
        return ok(await q);
      },
      async assign(eventId, userId, team) { ok(await sb.from('team_slots').upsert({ event_id: eventId, user_id: userId, team })); },
      async unassign(eventId, userId) { ok(await sb.from('team_slots').delete().eq('event_id', eventId).eq('user_id', userId)); },
      async removeTeams(eventId, teams) {
        let q = sb.from('team_slots').delete().eq('event_id', eventId);
        if (teams) q = q.in('team', teams);
        ok(await q);
      },
      async saveTeams(eventId, slots) { ok(await sb.rpc('save_teams', { p_event: eventId, p_slots: slots })); },
      // Histórico de alterações do evento e das salas (só líder e oficiais)
      async eventLog(eventId) {
        return ok(await sb.from('event_log').select('*').eq('event_id', eventId)
          .order('at', { ascending: false }).order('id', { ascending: false }).limit(300));
      },
      async renameTeam(eventId, index, name) { ok(await sb.rpc('rename_team', { p_event: eventId, p_index: index + 1, p_name: name })); },
      // Foto de perfil: blob = nova foto; null + hidden = sem foto; null sem hidden = volta a da conta Google
      async setAvatar(blob, hidden = false) {
        const uid = state.user.id;
        const old = state.me?.custom_avatar_url;
        let url = null;
        if (blob) {
          const path = `${uid}/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
          const up = await sb.storage.from('avatars').upload(path, blob, { contentType: blob.type, upsert: false });
          if (up.error) throw up.error;
          url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        }
        const { error } = await sb.from('profiles').update({ custom_avatar_url: url, avatar_hidden: !blob && hidden }).eq('id', uid);
        if (error) { if (url) await sb.storage.from('avatars').remove([url.split('/avatars/').pop()]); throw error; }
        const oldPath = old?.includes('/avatars/') ? old.split('/avatars/').pop() : null;
        if (oldPath) await sb.storage.from('avatars').remove([oldPath]);
        return url;
      },
      async saveAttendance(eventId, rows) {
        ok(await sb.from('attendance').upsert(rows.map((r) => ({ event_id: eventId, user_id: r.user_id, present: r.present }))));
      },
    };
  }

  function demoApi() {
    // Gerador pseudoaleatório fixo, para os dados de demonstração serem sempre os mesmos
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const between = (a, b) => Math.round(a + rnd() * (b - a));
    const randomBuild = () => ({
      char_class: CLASSES[Math.floor(rnd() * CLASSES.length)].key,
      armor: between(1500, 4500), armor_pen: between(1500, 4500), potency: between(2500, 6500),
      resistance: between(1500, 4000), resonance: between(1000, 5500),
    });
    const day = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
    const NICKS = ['Corvo', 'Lâmina', 'Sombra', 'Fênix', 'Trovão', 'Lobo', 'Cinza', 'Ferro', 'Rúnico', 'Vento', 'Brasa', 'Gelo',
      'Espectro', 'Falcão', 'Titã', 'Raio', 'Névoa', 'Aço', 'Víbora', 'Eco', 'Abismo', 'Órion', 'Kraken', 'Zênite', 'Ônix',
      'Rubi', 'Jade', 'Ártico', 'Magma', 'Cobalto', 'Pantera', 'Granito', 'Furacão', 'Lótus', 'Escorpião', 'Basalto'];
    const longAgo = '2025-01-01T00:00:00Z';

    const db = {
      profiles: [
        { id: 'u0', google_name: 'Você (demo)', game_name: 'Sangrento', role: 'leader', created_at: longAgo, ...randomBuild() },
        ...NICKS.map((n, i) => ({
          id: `u${i + 1}`, google_name: `${n.toLowerCase()}_br`, game_name: n, role: i === 0 ? 'officer' : 'member',
          created_at: i === NICKS.length - 1 ? day(-4, 12) : longAgo, ...randomBuild(),
        })),
        { id: 'p1', google_name: 'novato123', game_name: null, role: 'pending', created_at: day(-1, 12) },
        { id: 'f1', google_name: 'desertor_br', game_name: 'Desertor', role: 'former', created_at: longAgo, ...randomBuild() },
        // Membros piloto: não têm conta própria no jogo, só pilotam contas de outros
        { id: 'pl1', google_name: 'ze.piloto', game_name: 'Zé Piloto', role: 'member', pilot_only: true, is_pilot: true, pilot_note: 'Conta do Granito', created_at: day(-20, 19) },
        { id: 'p2', google_name: 'amigo_do_titan', game_name: 'Marcos', role: 'pending', pilot_only: true, is_pilot: true, pilot_note: 'Titã (nas guerras de sábado)', created_at: day(0, 9) },
        // Conta sem login, pilotada pelo usuário da demonstração
        { id: 'm1', google_name: '', game_name: 'Ceifador', role: 'member', managed: true, created_at: day(-30, 20), ...randomBuild() },
      ],
      contacts: [{ user_id: 'u1', phone: '(11) 98765-4321' }, { user_id: 'u3', phone: '(21) 99876-5432' }],
      events: [
        { id: 1, title: 'Guerra das Sombras', description: 'Todos online 15 min antes. Tragam poções!', starts_at: day(1, 20, 30), team_format: 'guerra', team_count: 10, rsvp_close_minutes: 120, teams_locked: true },
        { id: 2, title: 'Portões Demoníacos', description: '', starts_at: day(2, 21), team_format: null, team_count: 10 },
        { id: 3, title: 'Rito do Exílio', description: 'Defesa do trono.', starts_at: day(4, 20), team_format: 'rito', team_count: 4, rsvp_close_minutes: 8640 },
      ],
      rsvps: [],
      slots: [],
      attendance: [],
      history: [],
      absences: [],
      results: [],
      resultNotes: [],
      nextId: 100,
    };
    const profile = (id) => db.profiles.find((p) => p.id === id);
    db.events.forEach((e, i) => { e.created_by = i === 1 ? 'u1' : 'u0'; e.created_at = day(-3 - i, 19, 15); });
    // Nick único entre contas ativas (mesma regra do supabase/nick_unico.sql)
    const nickKey = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ') || null;
    const nickFree = (name, exceptId) => {
      const k = nickKey(name);
      if (k && db.profiles.some((p) => p.id !== exceptId && ['pending', 'member', 'officer', 'leader'].includes(p.role) && nickKey(p.game_name) === k)) {
        throw new Error(`O nick "${String(name).trim()}" já é usado por outro membro do clã. Escolha outro.`);
      }
    };
    const answer = (eventId, userId, going) => db.rsvps.push({
      event_id: eventId, user_id: userId, going, discord: going ? rnd() < 0.7 : null, ...(going ? pick(profile(userId), BUILD_KEYS) : {}),
    });
    // Alguns exemplos de histórico de alterações
    const u2 = profile('u2'); const u5 = profile('u5');
    db.history.push(
      { id: 1, user_id: 'u2', changed_at: day(-40, 18), changes: { game_name: ['Navalha', 'Lâmina'] } },
      { id: 2, user_id: 'u2', changed_at: day(-6, 19), changes: { potency: [u2.potency - 640, u2.potency], resonance: [u2.resonance - 210, u2.resonance] } },
      { id: 3, user_id: 'u5', changed_at: day(-12, 21), changes: { char_class: [u5.char_class === 'dh' ? 'mago' : 'dh', u5.char_class], google_name: ['trovao_antigo', u5.google_name] } },
    );
    // Evolução de Ressonância nos últimos meses (alimenta os gráficos de Estatísticas)
    // Sua conta na demonstração: evolução mais completa (alimenta o gráfico "Evolução do personagem")
    {
      const me0 = profile('u0');
      const chain = (key, steps) => {
        let v = me0[key];
        steps.forEach(([d, gain]) => { db.history.push({ id: db.history.length + 1, user_id: 'u0', changed_at: day(d, 21), changes: { [key]: [v - gain, v] } }); v -= gain; });
      };
      chain('resonance', [[-3, 120], [-14, 210], [-33, 90], [-51, 260], [-78, 180], [-110, 150]]);
      chain('armor', [[-14, 180], [-51, 320], [-95, 240]]);
      chain('potency', [[-33, 150]]);
    }
    db.profiles.filter((p) => p.resonance && p.role !== 'pending' && p.id !== 'u2' && p.id !== 'u0').forEach((p) => {
      let v = p.resonance;
      for (let k = 1; k <= 3; k++) {
        if (rnd() < 0.3) continue;
        const gain = 40 + Math.floor(rnd() * 260);
        db.history.push({ id: db.history.length + 1, user_id: p.id, changed_at: day(-(k - 1) * 28 - 1 - Math.floor(rnd() * 25), 20), changes: { resonance: [v - gain, v] } });
        v -= gain;
      }
    });
    // Exemplos de anotações internas
    db.notes = [
      { id: 900, member_id: 'u5', author_id: 'u1', body: 'Avisou que troca de turno no trabalho às quintas; pode chegar atrasado na Guerra.', created_at: day(-3, 22) },
      { id: 901, member_id: 'u2', author_id: 'u0', body: 'Ótimo shotcaller. Considerar para liderar uma sala de Exaltação.', created_at: day(-10, 21) },
    ];
    // Malah News: uma edição de exemplo (imagem desenhada aqui mesmo, sem arquivos externos)
    const demoNewsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
      <rect width="800" height="1100" fill="#efe1c2"/><rect x="20" y="20" width="760" height="1060" fill="none" stroke="#5a2a12" stroke-width="6"/>
      <text x="400" y="120" font-family="Georgia,serif" font-size="84" font-weight="700" text-anchor="middle" fill="#2a0d07">MALAH NEWS</text>
      <text x="400" y="170" font-family="Georgia,serif" font-size="22" text-anchor="middle" fill="#6b3b1a">EDIÇÃO DE DEMONSTRAÇÃO</text>
      <line x1="60" y1="200" x2="740" y2="200" stroke="#5a2a12" stroke-width="3"/>
      <text x="400" y="320" font-family="Georgia,serif" font-size="84" font-weight="700" text-anchor="middle" fill="#9b1b10">FOR HONOR</text>
      <text x="400" y="390" font-family="Georgia,serif" font-size="36" text-anchor="middle" fill="#2a0d07">VENCE MAIS UMA GUERRA!</text>
      <rect x="80" y="440" width="640" height="420" fill="#d9c49a" stroke="#5a2a12" stroke-width="3"/>
      <text x="400" y="670" font-family="Georgia,serif" font-size="30" text-anchor="middle" fill="#5a2a12">(aqui vai a sua arte)</text>
      <text x="400" y="960" font-family="Georgia,serif" font-size="30" font-weight="700" text-anchor="middle" fill="#2a0d07">LEIA HOJE. RIA AMANHÃ. CHORE NA GUERRA.</text>
    </svg>`;
    db.news = [{ id: 950, title: 'Malah News — edição de exemplo', caption: 'Assim aparecem as edições: clique na imagem para abrir no tamanho original.', image_path: 'demo',
      image_url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(demoNewsSvg)}`, author_id: 'u1', published_at: day(-1, 19), edited_at: null }];

    // Histórico no clã (entradas, aprovações, promoções e saídas)
    db.mlog = [];
    const addLog = (user_id, from_role, to_role, at, changed_by = null, reason = null) =>
      db.mlog.push({ id: db.mlog.length + 1, user_id, from_role, to_role, changed_by, reason, changed_at: at });
    db.profiles.forEach((p) => {
      const t0 = Date.parse(p.created_at);
      addLog(p.id, null, 'pending', new Date(t0).toISOString(), null, 'Primeiro acesso ao site');
      if (p.role !== 'pending') addLog(p.id, 'pending', 'member', new Date(t0 + 3600e3).toISOString(), p.id === 'u0' ? null : 'u0');
    });
    addLog('u0', 'member', 'leader', new Date(Date.parse(longAgo) + 7200e3).toISOString(), null, null);
    addLog('u1', 'member', 'officer', day(-90, 20), 'u0');
    addLog('f1', 'member', 'former', day(-20, 21), 'u0', 'Inativo há 2 meses');
    // Pilotos: você pilota o "Ceifador" (sem login) e a conta do Rúnico; o Brasa pediu para pilotar a sua
    db.perms = {};
    db.requests = [];
    // Pedido para sair do clã esperando a liderança
    db.leaves = [{ id: 700, user_id: 'u9', reason: 'Vou dar um tempo do jogo por causa dos estudos.', requested_by: 'u9', requested_at: day(-1, 22), status: 'pending', decided_by: null, decided_at: null, note: null }];
    db.pilots = [
      { account_id: 'm1', pilot_id: 'u0', status: 'approved', reason: null, requested_at: day(-30, 20), decided_at: day(-30, 20), decided_by: 'u0' },
      { account_id: 'u12', pilot_id: 'u0', status: 'approved', reason: 'Jogo na conta dele nas Guerras', requested_at: day(-15, 20), decided_at: day(-15, 21), decided_by: 'u12' },
      { account_id: 'u0', pilot_id: 'u8', status: 'pending', reason: 'Posso jogar na sua conta quando você viajar', requested_at: day(-1, 18), decided_at: null, decided_by: null },
      { account_id: 'u32', pilot_id: 'pl1', status: 'approved', reason: null, requested_at: day(-20, 20), decided_at: day(-20, 21), decided_by: 'u1' },
    ];
    // Pilotagem: quem oferece o serviço e os pedidos (você também é piloto na demonstração)
    Object.assign(profile('u0'), { is_pilot: true, pilot_note: 'Conta do Gelo' });
    Object.assign(profile('u5'), { is_pilot: true });
    db.pilotOffers = [
      { pilot_id: 'pl1', about: 'Piloto Guerras e Ritos à noite (20h–23h). Já piloto a conta do Granito.', active: true, created_at: day(-10, 20), updated_at: day(-10, 20), status: 'approved', reviewed_by: 'u1', reviewed_at: day(-10, 21), review_note: null },
      { pilot_id: 'u5', about: 'Posso pilotar nos fins de semana, de tarde.', active: true, created_at: day(-6, 15), updated_at: day(0, 8), status: 'pending', reviewed_by: null, reviewed_at: null, review_note: null },
      { pilot_id: 'u0', about: 'Piloto em Portões e Guerras quando você precisar viajar.', active: true, created_at: day(-3, 21), updated_at: day(-3, 21), status: 'approved', reviewed_by: 'u1', reviewed_at: day(-3, 22), review_note: null },
    ];
    // Registro dos anúncios (igual à tabela pilot_offer_log do banco)
    db.offerLog = [
      { id: 1, pilot_id: 'pl1', at: day(-10, 20), actor: 'pl1', action: 'submitted', about: db.pilotOffers[0].about, note: null },
      { id: 2, pilot_id: 'pl1', at: day(-10, 21), actor: 'u1', action: 'approved', about: db.pilotOffers[0].about, note: null },
      { id: 3, pilot_id: 'u0', at: day(-3, 21), actor: 'u0', action: 'submitted', about: db.pilotOffers[2].about, note: null },
      { id: 4, pilot_id: 'u0', at: day(-3, 22), actor: 'u1', action: 'approved', about: db.pilotOffers[2].about, note: null },
      { id: 5, pilot_id: 'u5', at: day(-6, 15), actor: 'u5', action: 'submitted', about: 'Posso pilotar.', note: null },
      { id: 6, pilot_id: 'u5', at: day(-5, 19), actor: 'u0', action: 'rejected', about: 'Posso pilotar.', note: 'Escreva os dias e horários' },
      { id: 7, pilot_id: 'u5', at: day(0, 8), actor: 'u5', action: 'submitted', about: db.pilotOffers[1].about, note: null },
    ];
    const offerLogDemo = (pilotId, action, about, note = null, actor = state.user?.id ?? null) =>
      db.offerLog.push({ id: db.offerLog.length + 1, pilot_id: pilotId, at: new Date().toISOString(), actor, action, about, note });
    db.pilotReqs = [
      { id: 900, account_id: 'u7', pilot_id: 'u0', requested_by: 'u7', message: 'Vou viajar sábado, consegue jogar a Guerra na minha conta?', status: 'pending', answer: null, created_at: day(-1, 10), decided_at: null },
    ];
    answer(1, 'm1', true);
    db.profiles.slice(1, 31).forEach((p, i) => answer(1, p.id, i % 7 !== 3));
    db.profiles.slice(5, 26).forEach((p, i) => answer(3, p.id, i % 5 !== 0));
    db.profiles.slice(2, 6).forEach((p, i) => answer(2, p.id, i !== 1));
    // Alguns já distribuídos na Guerra
    db.rsvps.filter((r) => r.event_id === 1 && r.going).slice(0, 11)
      .forEach((r, i) => db.slots.push({ event_id: 1, user_id: r.user_id, team: i < 8 ? 'Exaltação 1' : 'Exaltação 2' }));
    // Exemplo: na Guerra (times travados) um membro escalado pediu para sair
    Object.assign(db.rsvps.find((r) => r.event_id === 1 && r.user_id === db.slots[2].user_id),
      { withdraw_reason: 'Viagem de trabalho de última hora', withdraw_requested_at: new Date(Date.now() - 2 * 3600e3).toISOString() });

    // Histórico: 10 eventos passados, com presença registrada (exceto o mais recente)
    const pastTitles = ['Guerra das Sombras', 'Rito do Exílio', 'Vigília', 'Portões Demoníacos'];
    const reliability = Object.fromEntries(db.profiles.map((p) => [p.id, 0.35 + rnd() * 0.65]));
    for (let w = 1; w <= 10; w++) {
      const id = 10 + w;
      const starts = day(-3 * w + 1, 21);
      db.events.push({ id, title: pastTitles[w % 4], description: '', starts_at: starts, team_format: null, team_count: 10 });
      db.profiles.filter((p) => p.role !== 'pending' && Date.parse(p.created_at) < Date.parse(starts)).forEach((p) => {
        const rel = reliability[p.id];
        const x = rnd();
        const going = x < rel ? true : x < rel + 0.15 ? false : null;
        if (going !== null) answer(id, p.id, going);
        if (w === 1) return; // presença ainda não registrada
        const present = going === true ? rnd() < 0.5 + rel / 2 : going === false ? rnd() < 0.05 : rnd() < rel / 3;
        db.attendance.push({ event_id: id, user_id: p.id, present });
      });
    }

    // Guerras semanais dos últimos ciclos (painel da liderança), com presença e resultado
    const RIVALS = ['Legião Sombria', 'Os Imortais', 'Filhos de Lilith', 'Horda Rubra', 'Clã do Dragão'];
    for (let w = 0; w < 19; w++) {
      const id = 40 + w;
      const starts = day(-7 * w - 5, 20, 30);
      db.events.push({ id, title: 'Guerra de Clãs', description: '', starts_at: starts, team_format: null, team_count: 10 });
      let present = 0, total = 0;
      db.profiles.filter((p) => p.role !== 'pending' && Date.parse(p.created_at) < Date.parse(starts)).forEach((p) => {
        const rel = reliability[p.id];
        const x = rnd();
        const going = x < rel ? true : x < rel + 0.15 ? false : null;
        if (going !== null) answer(id, p.id, going);
        const was = going === true ? rnd() < 0.5 + rel / 2 : going === false ? rnd() < 0.05 : rnd() < rel / 3;
        db.attendance.push({ event_id: id, user_id: p.id, present: was });
        total++; if (was) present++;
      });
      const win = rnd() < 0.15 + present / Math.max(1, total);
      const us = win ? 4 + Math.floor(rnd() * 4) : Math.floor(rnd() * 4);
      const them = win ? Math.floor(rnd() * us) : us + 1 + Math.floor(rnd() * 4);
      db.results.push({ event_id: id, outcome: win ? 'win' : 'loss', opponent: RIVALS[Math.floor(rnd() * RIVALS.length)], score_us: us, score_them: them, updated_by: 'u0', updated_at: starts });
    }
    // Ciclos cadastrados pela liderança (o jogo alterna Sombras e Imortal)
    const ymd = (d) => { const x = new Date(Date.now() + d * 86400000); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return localDay(x); }; // segunda-feira daquela semana
    db.cycles = [
      { id: 600, starts_on: ymd(-135), side: 'immortal' }, { id: 601, starts_on: ymd(-96), side: 'shadows' },
      { id: 602, starts_on: ymd(-54), side: 'immortal' }, { id: 603, starts_on: ymd(-19), side: 'shadows' },
    ];
    // Resultados de duas Guerras passadas (as observações só a liderança vê)
    db.results.push(
      { event_id: 14, outcome: 'win', opponent: 'Legião Sombria', score_us: 5, score_them: 3, updated_by: 'u1', updated_at: day(-8, 23) },
      { event_id: 18, outcome: 'loss', opponent: 'Os Imortais', score_us: 2, score_them: 6, updated_by: 'u0', updated_at: day(-20, 23) });
    db.resultNotes.push({ event_id: 18, notes: 'Faltaram healers no segundo round. Reforçar a escalação dos Cruzados.' });

    // Um evento passado com times no formato "Outros", com um time renomeado e você escalado
    Object.assign(db.events.find((e) => e.id === 12), { title: 'Torre Amaldiçoada', team_format: 'rito', team_count: 3, team_names: ['Revenge', null, null] });
    if (!db.rsvps.some((r) => r.event_id === 12 && r.user_id === 'u0')) answer(12, 'u0', true);
    Object.assign(db.rsvps.find((r) => r.event_id === 12 && r.user_id === 'u0'), { going: true, ...pick(profile('u0'), BUILD_KEYS) });
    db.rsvps.filter((r) => r.event_id === 12 && r.going).sort((a, b) => (a.user_id === 'u0' ? -1 : b.user_id === 'u0' ? 1 : 0)).slice(0, 20)
      .forEach((r, i) => db.slots.push({ event_id: 12, user_id: r.user_id, team: ['Revenge', 'Time 2', 'Time 3'][Math.floor(i / 8)] }));

    // Recrutamentos de exemplo
    db.recruits = [
      { id: 700, title: 'Grupo Guerreiro para a temporada', category: 'warband', description: 'Grupo fixo para jogar à noite (20h–23h). Precisamos de gente ativa e com Discord.',
        slots: 7, activity_at: null, deadline_at: day(5, 23, 59), wanted: { cruzado: 1, monge: 1 }, created_by: 'u3', created_at: day(-2, 19),
        status: 'open', decided_by: 'u1', decided_at: day(-2, 20), note: null, closed_by: null, closed_at: null },
      { id: 701, title: 'Time PvP — Evento global', category: 'pvp', description: 'Fechando o time para o evento global de fim de semana. Treino na sexta às 21h.',
        slots: 4, activity_at: day(3, 21), deadline_at: day(2, 20), wanted: { bk: 1, tempest: 1 }, created_by: 'u0', created_at: day(-1, 18),
        status: 'open', decided_by: 'u0', decided_at: day(-1, 18), note: null, closed_by: null, closed_at: null },
      { id: 702, title: 'Grupo para Fendas Desafiadoras', category: 'other', description: 'Subir Fendas Desafiadoras juntos todo dia depois da Vigília.',
        slots: 3, activity_at: null, deadline_at: null, wanted: {}, created_by: 'u7', created_at: day(-1, 9),
        status: 'pending', decided_by: null, decided_at: null, note: null, closed_by: null, closed_at: null },
      { id: 703, title: 'Grupo Guerreiro — madrugada', category: 'warband', description: 'Para quem joga depois da meia-noite.',
        slots: 7, activity_at: null, deadline_at: null, wanted: {}, created_by: 'u2', created_at: day(-20, 22),
        status: 'closed', decided_by: 'u0', decided_at: day(-20, 23), note: null, closed_by: 'u2', closed_at: day(-12, 10) },
    ];
    db.applications = [];
    const apply = (rid, uid, status, d = -1) => db.applications.push({ recruit_id: rid, user_id: uid, status, applied_at: day(d, 10 + (db.applications.length % 9)), decided_at: status === 'applied' ? null : day(d, 22) });
    ['u4', 'u6', 'u9', 'u11'].forEach((u, i) => apply(700, u, i < 3 ? 'accepted' : 'applied'));
    ['u14', 'u15'].forEach((u) => apply(700, u, 'applied'));
    apply(700, 'u16', 'declined');
    ['u5', 'u8', 'u10', 'u13', 'u17'].forEach((u, i) => apply(701, u, i === 0 ? 'accepted' : 'applied', 0));
    ['u18', 'u19', 'u20', 'u21', 'u22', 'u23', 'u24'].forEach((u) => apply(703, u, 'accepted', -15));
    // O que cada um pode ver (igual às regras do banco): abertos para todos; pendentes, recusados e encerrados só para quem criou e os oficiais
    const listRecruits = () => db.recruits
      .filter((r) => r.status === 'open' || r.created_by === state.user.id || isOfficer())
      .map((r) => ({ ...r, wanted: { ...r.wanted }, applications: db.applications.filter((a) => a.recruit_id === r.id).map((a) => ({ ...a })) }));

    // Tickets de exemplo
    const bugSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#1a0f0b"/><rect x="40" y="40" width="560" height="280" rx="12" fill="#2a1a14" stroke="#e0524a" stroke-width="3"/><text x="320" y="170" font-family="Arial" font-size="28" fill="#ffc9c0" text-anchor="middle">Erro ao confirmar presença</text><text x="320" y="215" font-family="Arial" font-size="18" fill="#cdbdb2" text-anchor="middle">(print de exemplo)</text></svg>`;
    const bugImg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bugSvg)}`;
    db.tickets = [
      { id: 800, title: 'Evento de treino PvP às quartas', category: 'suggestion', anonymous: false, author_id: 'u4', status: 'open', assigned_to: null, created_at: day(-1, 21) },
      { id: 801, title: 'Botão de confirmar presença travou', category: 'site', anonymous: true, author_id: 'u0', status: 'progress', assigned_to: 'u1', created_at: day(-3, 22) },
      { id: 802, title: 'Comportamento na última Guerra', category: 'report', anonymous: true, author_id: 'u9', status: 'open', assigned_to: null, created_at: day(-1, 23) },
      { id: 803, title: 'Como funciona o Rito do Exílio?', category: 'question', anonymous: false, author_id: 'u6', status: 'resolved', assigned_to: 'u0', created_at: day(-9, 19) },
      { id: 804, title: 'Meu nome não aparece no sorteio', category: 'site', anonymous: false, author_id: 'u0', status: 'resolved', assigned_to: 'u1', created_at: day(-2, 18) },
    ];
    db.tmsgs = [
      { id: 1, ticket_id: 800, author_id: 'u4', body: 'Que tal um treino PvP toda quarta às 21h? Ajudaria muito o pessoal novo.', internal: false, images: [], created_at: day(-1, 21) },
      { id: 2, ticket_id: 801, author_id: 'u0', body: 'Quando clico em "Vou" aparece um erro e nada acontece. Segue o print.', internal: false, images: [bugImg], created_at: day(-3, 22) },
      { id: 3, ticket_id: 801, author_id: 'u1', body: 'Obrigado pelo aviso! Já estamos vendo. Isso aconteceu no celular ou no computador?', internal: false, images: [], created_at: day(-2, 10) },
      { id: 4, ticket_id: 801, author_id: 'u1', body: 'Parece ser o mesmo erro que o Lobo relatou no Discord.', internal: true, images: [], created_at: day(-2, 10, 5) },
      { id: 5, ticket_id: 802, author_id: 'u9', body: 'Um membro ficou xingando o time inteiro no Discord durante a Guerra. Não quero me expor.', internal: false, images: [], created_at: day(-1, 23) },
      { id: 6, ticket_id: 803, author_id: 'u6', body: 'Sou novo no clã. Como funciona o Rito do Exílio?', internal: false, images: [], created_at: day(-9, 19) },
      { id: 7, ticket_id: 803, author_id: 'u0', body: 'Bem-vindo! É a disputa pelo trono entre os clãs vencedores. Confirme presença no evento que montamos os times.', internal: false, images: [], created_at: day(-9, 21) },
      { id: 8, ticket_id: 803, author_id: 'u6', body: 'Entendi, valeu!', internal: false, images: [], created_at: day(-8, 12) },
      { id: 9, ticket_id: 804, author_id: 'u0', body: 'Me inscrevi no sorteio, mas meu nome não aparece na lista.', internal: false, images: [], created_at: day(-2, 18) },
    ];
    // Histórico de status (quem encerrou, reabriu ou pôs em atendimento)
    db.tlog = [
      { ticket_id: 801, at: day(-2, 10), actor: 'u1', by_author: false, from_status: 'open', to_status: 'progress' },
      { ticket_id: 803, at: day(-9, 21), actor: 'u0', by_author: false, from_status: 'open', to_status: 'progress' },
      { ticket_id: 803, at: day(-8, 12, 2), actor: 'u6', by_author: true, from_status: 'progress', to_status: 'resolved' },
      { ticket_id: 804, at: day(-1, 9), actor: 'u1', by_author: false, from_status: 'open', to_status: 'resolved' },
    ];
    const tlogStatus = (t, to) => {
      if (t.status === to) return;
      db.tlog.push({ ticket_id: t.id, at: new Date().toISOString(), actor: state.user.id, by_author: t.author_id === state.user.id, from_status: t.status, to_status: to });
      t.status = to;
    };
    // Quem atende pode ver este ticket? (igual às regras do banco)
    const staffSeesTicket = (t) => isOfficer() && (isLeader()
      || (permMode('ticket_view') !== 'deny' && (t.category !== 'report' || permMode('ticket_reports') !== 'deny')));
    const isStaffOn = (t) => t.author_id !== state.user.id && staffSeesTicket(t);
    // O autor de um ticket anônimo nunca sai do "banco" para quem atende
    const listTickets = () => db.tickets
      .filter((t) => t.author_id === state.user.id || staffSeesTicket(t))
      .map((t) => {
        const mine = t.author_id === state.user.id;
        const hide = t.anonymous && !mine;
        return {
          ...t, mine, author_id: hide ? null : t.author_id,
          messages: db.tmsgs.filter((m) => m.ticket_id === t.id && (!m.internal || !mine))
            .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
            .map((m) => ({ ...m, images: [...m.images], from_author: m.author_id === t.author_id, author_id: hide && m.author_id === t.author_id ? null : m.author_id })),
          log: db.tlog.filter((l) => l.ticket_id === t.id).map(({ ticket_id, ...l }) => ({ ...l, actor: hide && l.by_author ? null : l.actor })),
        };
      });
    const ticketRow = (id) => db.tickets.find((t) => t.id === id);

    // Tipos de evento (no site real vêm da tabela event_types)
    db.types = [
      { id: 1, name: 'Guerra das Sombras', sort_order: 10, active: true },
      { id: 2, name: 'Vigília', sort_order: 20, active: true },
      { id: 3, name: 'Rito do Exílio', sort_order: 30, active: true },
      { id: 5, name: 'Torre Amaldiçoada', sort_order: 40, active: true },
      { id: 4, name: 'Outros', sort_order: 999, active: true },
    ];
    db.events.forEach((e) => { e.type_id = guessTypeId(e.title, db.types); });

    // Sorteios de exemplo: um realizado há 2 semanas, o da semana passada (é sorteado ao abrir a demonstração) e o do próximo domingo
    const GDS = db.types.find((t) => t.name === 'Guerra das Sombras').id;
    const nextDraw = nextDrawDates(1)[0].getTime();
    const drawIso = (weeksAgo) => new Date(nextDraw - weeksAgo * 7 * 86400e3).toISOString();
    // Duas Guerras das Sombras na semana passada (qui e sáb, 20h30 de Brasília), com presença registrada
    const lastWeek = Date.parse(raffleWeekStart(drawIso(1)));
    [[31, 3], [32, 5]].forEach(([id, d]) => {
      const starts = new Date(lastWeek + (d * 24 + 20.5) * 3600e3).toISOString();
      db.events.push({ id, title: 'Guerra das Sombras', description: '', starts_at: starts, team_format: null, team_count: 10, type_id: GDS });
      db.profiles.filter((p) => ACTIVE_ROLES.includes(p.role)).forEach((p) => {
        db.attendance.push({ event_id: id, user_id: p.id, present: p.id === 'u0' || rnd() < reliability[p.id] + 0.25 });
      });
    });
    // Nesta semana: uma Guerra já aconteceu (com presença registrada), se a semana já tiver começado há tempo suficiente
    const thisWeek = Date.parse(raffleWeekStart(drawIso(0)));
    const midWeek = thisWeek + (2 * 24 + 20.5) * 3600e3;
    if (midWeek < Date.now() - 3600e3) {
      db.events.push({ id: 33, title: 'Guerra das Sombras', description: '', starts_at: new Date(midWeek).toISOString(), team_format: null, team_count: 10, type_id: GDS });
      db.profiles.filter((p) => ACTIVE_ROLES.includes(p.role)).forEach((p) => {
        db.attendance.push({ event_id: 33, user_id: p.id, present: !['u3', 'u10'].includes(p.id) && rnd() < 0.9 });
      });
    }
    db.raffles = [
      { id: 600, draw_at: drawIso(2), prize_kind: 'bp_simple', prize_qty: 2, prize_text: null, winners_count: 2, status: 'drawn',
        created_by: 'u1', created_at: drawIso(3), drawn_at: drawIso(2), eligible_count: 14 },
      { id: 601, draw_at: drawIso(1), prize_kind: 'prodigy', prize_qty: 1, prize_text: null, winners_count: 1, status: 'open',
        created_by: 'u0', created_at: drawIso(2), drawn_at: null, eligible_count: null },
      { id: 602, draw_at: drawIso(0), prize_kind: 'bp_simple', prize_qty: 3, prize_text: null, winners_count: 3, status: 'open',
        created_by: 'u1', created_at: new Date(Date.now() - 2 * 86400e3).toISOString(), drawn_at: null, eligible_count: null },
    ];
    db.rwinners = [{ raffle_id: 600, user_id: 'u4', position: 1 }, { raffle_id: 600, user_id: 'u9', position: 2 }];
    db.rentries = [];
    const enter = (raffleId, userId, removed) => db.rentries.push({ raffle_id: raffleId, user_id: userId, entered_at: new Date(Date.now() - 3 * 86400e3).toISOString(),
      removed_at: removed ? new Date(Date.now() - 5 * 3600e3).toISOString() : null, removed_by: removed ? 'u1' : null, removed_reason: removed || null });
    ['u0', 'u2', 'u3', 'u4', 'u5', 'u6', 'u8', 'u9', 'u11', 'u12', 'u14', 'u16'].forEach((u) => enter(601, u));
    ['u2', 'u3', 'u4', 'u5', 'u6', 'u8', 'u9', 'u10', 'u11', 'u13', 'u15'].forEach((u) => enter(602, u));
    enter(602, 'u7', 'Conta compartilhada com outro jogador; já combinamos no Discord.');
    // Mesmas regras do banco (raffle_wars / raffle_check)
    const raffleWarsDemo = (r) => {
      const from = Date.parse(raffleWeekStart(r.draw_at)); const to = Date.parse(r.draw_at);
      return db.events.filter((e) => e.type_id === GDS && Date.parse(e.starts_at) >= from && Date.parse(e.starts_at) < to)
        .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
        .map((e) => ({ event_id: e.id, title: e.title, starts_at: e.starts_at, registered: db.attendance.some((a) => a.event_id === e.id) }));
    };
    const raffleChecksDemo = (r) => {
      const wars = raffleWarsDemo(r);
      return db.rentries.filter((e) => e.raffle_id === r.id && !e.removed_at).map((e) => {
        const present = wars.filter((w) => db.attendance.some((a) => a.event_id === w.event_id && a.user_id === e.user_id && a.present)).length;
        return { user_id: e.user_id, wars_total: wars.length, wars_present: present,
          eligible: wars.length > 0 && present === wars.length && ACTIVE_ROLES.includes(profile(e.user_id)?.role) };
      });
    };
    const raffleRow = (id) => db.raffles.find((r) => r.id === id);
    const raffleStaffDemo = () => { if (!isOfficer()) throw new Error('Só a staff (líder e oficiais) pode fazer isso'); };
    const raffleOpenDemo = (r, msg) => { if (!r || r.status !== 'open' || Date.parse(r.draw_at) <= Date.now()) throw new Error(msg); };

    // Conta que vira membro piloto: sai dos próximos eventos e deixa de ser pilotada (igual a pilot_only_cleanup do banco)
    const pilotOnlyCleanupDemo = (id) => {
      const future = new Set(db.events.filter((e) => Date.parse(e.starts_at) > Date.now()).map((e) => e.id));
      db.rsvps = db.rsvps.filter((r) => !(r.user_id === id && future.has(r.event_id)));
      db.slots = db.slots.filter((s) => !(s.user_id === id && future.has(s.event_id)));
      db.pilots = db.pilots.filter((x) => x.account_id !== id);
      db.pilotReqs.filter((r) => r.account_id === id && r.status === 'pending')
        .forEach((r) => Object.assign(r, { status: 'cancelled', decided_at: new Date().toISOString(), answer: r.answer || 'A conta virou membro piloto' }));
    };
    // Posso agir por esta conta? (a minha, ou sou piloto aprovado dela) — igual à regra do banco
    const canActAsDemo = (acct) => acct === state.user?.id
      || (ACTIVE_ROLES.includes(profile(state.user?.id)?.role)
          && db.pilots.some((p) => p.account_id === acct && p.pilot_id === state.user.id && p.status === 'approved'));

    // Simula as regras do banco: membro comum só recebe os times e presenças das contas que controla
    const attach = (e) => {
      const officer = isOfficer();
      const slots = db.slots.filter((s) => s.event_id === e.id);
      const myTeams = new Set(slots.filter((s) => canActAsDemo(s.user_id)).map((s) => s.team));
      return {
        ...e,
        // Mesma regra do banco: membro comum só recebe as respostas das contas que controla
        rsvps: db.rsvps.filter((r) => r.event_id === e.id && (officer || canActAsDemo(r.user_id))).map((r) => ({ ...r })),
        team_slots: slots.filter((s) => officer || myTeams.has(s.team)).map((s) => ({ user_id: s.user_id, team: s.team })),
        attendance: db.attendance.filter((a) => a.event_id === e.id && (officer || canActAsDemo(a.user_id))).map((a) => ({ user_id: a.user_id, present: a.present })),
      };
    };
    // Histórico de alterações dos eventos (mesmas regras dos gatilhos do banco)
    db.elog = [];
    const elog = (event_id, kind, room = null, detail = {}, at = new Date().toISOString(), actor = state.user?.id ?? null) =>
      db.elog.push({ id: db.elog.length + 1, event_id, at, actor, kind, room, detail });
    const slotsOf = (eventId) => db.slots.filter((s) => s.event_id === eventId).map((s) => ({ user_id: s.user_id, team: s.team }));
    const logRoomDiff = (eventId, before, after, extra = {}) => {
      const key = (s) => `${s.team}|${s.user_id}`;
      const added = after.filter((s) => !before.some((o) => key(o) === key(s)));
      const removed = before.filter((s) => !after.some((n) => key(n) === key(s)));
      [...new Set([...added, ...removed].map((s) => s.team))].forEach((room) => elog(eventId, 'room', room, {
        added: added.filter((s) => s.team === room).map((s) => s.user_id),
        removed: removed.filter((s) => s.team === room).map((s) => s.user_id), ...extra }));
    };
    const logEventUpdate = (e, row) => {
      const d = {};
      if ('title' in row && row.title !== e.title) d.title = [e.title, row.title];
      if ('description' in row && (row.description || null) !== (e.description || null)) d.description = true;
      if ('starts_at' in row && Date.parse(row.starts_at) !== Date.parse(e.starts_at)) d.starts_at = [e.starts_at, row.starts_at];
      if ('type_id' in row && (row.type_id ?? null) !== (e.type_id ?? null)) d.type_id = [e.type_id ?? null, row.type_id ?? null];
      if ('rsvp_close_minutes' in row && (row.rsvp_close_minutes ?? null) !== (e.rsvp_close_minutes ?? null)) d.rsvp_close_minutes = [e.rsvp_close_minutes ?? null, row.rsvp_close_minutes ?? null];
      if (Object.keys(d).length) elog(e.id, 'edit', null, d);
      const fmt = 'team_format' in row ? row.team_format : e.team_format;
      const cnt = 'team_count' in row ? row.team_count : e.team_count;
      if (fmt !== e.team_format || cnt !== e.team_count) elog(e.id, 'format', null, { format: [e.team_format ?? null, fmt ?? null], count: [e.team_count, cnt] });
      if ('teams_locked' in row && !!row.teams_locked !== !!e.teams_locked) elog(e.id, row.teams_locked ? 'lock' : 'unlock');
    };
    // Saída de sala fora do painel ("Não vou", saída aceita): auto = a pessoa não vai mais
    const dropSlot = (eventId, userId) => {
      const before = slotsOf(eventId);
      db.slots = db.slots.filter((s) => !(s.event_id === eventId && s.user_id === userId));
      logRoomDiff(eventId, before, slotsOf(eventId), { auto: !db.rsvps.some((r) => r.event_id === eventId && r.user_id === userId && r.going) });
    };
    // Exemplos na Guerra das Sombras de amanhã
    {
      const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
      const inRoom = (t) => db.slots.filter((s) => s.event_id === 1 && s.team === t).map((s) => s.user_id);
      elog(1, 'created', null, {}, ago(72), 'u1');
      elog(1, 'format', null, { format: [null, 'guerra'], count: [10, 10] }, ago(31), 'u1');
      elog(1, 'room', 'Exaltação 1', { added: inRoom('Exaltação 1'), removed: [] }, ago(30), 'u1');
      elog(1, 'edit', null, { description: true }, ago(20), 'u1');
      elog(1, 'room', 'Exaltação 2', { added: inRoom('Exaltação 2'), removed: [] }, ago(6), 'u0');
      elog(1, 'room', 'Exaltação 1', { added: [], removed: ['u30'] }, ago(6), 'u0');
      elog(1, 'lock', null, {}, ago(5), 'u0');
    }
    // Ausência: eventos futuros do período viram "Não vou" (igual à função apply_absence do banco)
    const absenceCovers = (a, ev) => { const d = localDay(new Date(ev.starts_at)); return d >= a.starts_on && d <= a.ends_on; };
    function applyAbsenceDemo(a, events = db.events) {
      let n = 0;
      events.filter((e) => Date.parse(e.starts_at) > Date.now() && absenceCovers(a, e)).forEach((e) => {
        const r = db.rsvps.find((x) => x.event_id === e.id && x.user_id === a.user_id);
        if (!r) { db.rsvps.push({ event_id: e.id, user_id: a.user_id, going: false, absence_id: a.id }); n++; }
        else if (r.going) { Object.assign(r, { going: false, discord: null, absence_id: a.id, withdraw_reason: null, withdraw_requested_at: null }); dropSlot(e.id, a.user_id); n++; }
      });
      return n;
    }
    // Exemplo: Trovão está viajando
    {
      const a = { id: db.nextId++, user_id: 'u5', starts_on: localDay(new Date(Date.now() - 2 * 86400000)), ends_on: localDay(new Date(Date.now() + 9 * 86400000)), reason: 'Viagem a trabalho, sem internet boa', created_by: 'u5', created_at: new Date().toISOString() };
      db.absences.push(a); applyAbsenceDemo(a);
    }
    // Clãs rivais (na demo, só aqui; no site real ficam no banco compartilhado com o INFERNUM)
    db.rivalScans = []; db.rivalPlayers = []; db.rivalLog = [];
    {
      const SYL = ['ka', 'zor', 'mi', 'rax', 'el', 'dun', 'vy', 'tho', 'ga', 'lis', 'mor', 'qu', 'ne', 'ash', 'ty'];
      const rivalName = () => { let n = ''; const k = 2 + Math.floor(rnd() * 2); for (let i = 0; i < k; i++) n += SYL[Math.floor(rnd() * SYL.length)]; return n[0].toUpperCase() + n.slice(1); };
      const scanDay = (d) => localDay(new Date(Date.now() + d * 86400000));
      [['Legião Sombria', 1018267, 0.8, 92], ['Os Imortais', 1028931, 0.7, 96], ['Filhos de Lilith', 1033505, 0.6, 85]].forEach(([clan, num, f, n], ci) => {
        const roster = Array.from({ length: n }, () => {
          const tank = rnd() < 0.25; const b = 0.75 + rnd() * 0.6;
          return { name: rivalName(), armor: Math.round((tank ? 8200 : 5000) * b * f), armor_pen: Math.round((tank ? 4800 : 6900) * b * f),
            potency: Math.round((tank ? 3900 : 5200) * b * f), resistance: Math.round((tank ? 7400 : 4900) * b * f), resonance: Math.round(3900 * b * f) };
        });
        const reads = ci === 0 ? [-40, -6] : [-6];
        reads.forEach((d, ri) => {
          const id = 700 + ci * 10 + ri;
          db.rivalScans.push({ id, clan_name: clan, clan_number: num, scanned_on: scanDay(d), source: `scout ${scanDay(d)}.mkv`, created_by: null,
            created_at: day(d, 20), imported_by: ci === 0 && ri === 0 ? (CFG.clanName || 'FOR HONOR') : 'INFERNUM', imported_by_name: ci === 0 && ri === 0 ? 'Valkyria' : 'Sangrento' });
          db.rivalLog.push({ id: 900 + id, scan_id: id, action: 'import', clan_name: clan, scanned_on: scanDay(d), players: n,
            actor_clan: ci === 0 && ri === 0 ? (CFG.clanName || 'FOR HONOR') : 'INFERNUM', actor_name: ci === 0 && ri === 0 ? 'Valkyria' : 'Sangrento', created_at: day(d, 20) });
          const grow = reads.length > 1 && ri === 0 ? 0.93 : 1;
          roster.forEach((r, i) => db.rivalPlayers.push({ id: 7000 + id * 200 + i, scan_id: id, ...r,
            ...Object.fromEntries(ATTRS.map((a) => [a.key, Math.round(r[a.key] * grow)])), note: i === 3 ? 'conferir: Armadura' : null }));
        });
      });
    }
    let user = null;
    let listener = () => {};
    return {
      async currentUser() { return user; },
      async cycles() { return isOfficer() ? db.cycles.map((c) => ({ ...c })).sort((a, b) => a.starts_on.localeCompare(b.starts_on)) : []; },
      async saveCycle(o) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder gerenciam os ciclos');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(o.starts_on || '')) throw new Error('Informe a data de início do ciclo');
        if (!['shadows', 'immortal'].includes(o.side)) throw new Error('Escolha o lado do ciclo');
        if (o.starts_on > localDay()) throw new Error('O ciclo não pode começar no futuro');
        if (new Date(`${o.starts_on}T12:00:00`).getDay() !== 1) throw new Error('O ciclo sempre começa numa segunda-feira');
        if (db.cycles.some((c) => c.starts_on === o.starts_on && c.id !== o.id)) throw new Error('Já existe um ciclo começando nesta data');
        const c = o.id ? db.cycles.find((x) => x.id === o.id) : null;
        if (c) Object.assign(c, { starts_on: o.starts_on, side: o.side });
        else db.cycles.push({ id: db.nextId++, starts_on: o.starts_on, side: o.side, created_by: state.user.id, created_at: new Date().toISOString() });
      },
      async deleteCycle(id) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder gerenciam os ciclos');
        db.cycles = db.cycles.filter((c) => c.id !== id);
      },
      async rivals() {
        if (!isOfficer()) return { scans: [], players: [] };
        return { scans: db.rivalScans.map((x) => ({ ...x })), players: db.rivalPlayers.map((x) => ({ ...x })),
          log: db.rivalLog.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).map((x) => ({ ...x })) };
      },
      async importRivalScan(o) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder importam clãs rivais');
        if (!String(o.clan_name || '').trim()) throw new Error('Informe o nome do clã');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(o.scanned_on || '') || o.scanned_on > localDay()) throw new Error('Data da leitura inválida');
        if (!o.players?.length || o.players.length > 150) throw new Error('A leitura precisa ter de 1 a 150 jogadores');
        const id = db.nextId++;
        db.rivalScans.push({ id, clan_name: String(o.clan_name).trim().slice(0, 60), clan_number: o.clan_number ?? null, scanned_on: o.scanned_on,
          source: o.source || null, created_by: null, created_at: new Date().toISOString(), imported_by: (CFG.clanName || 'FOR HONOR'), imported_by_name: displayName(state.me) });
        o.players.forEach((pl) => db.rivalPlayers.push({ id: db.nextId++, scan_id: id, ...pl }));
        db.rivalLog.push({ id: db.nextId++, scan_id: id, action: 'import', clan_name: String(o.clan_name).trim(), scanned_on: o.scanned_on,
          players: o.players.length, actor_clan: (CFG.clanName || 'FOR HONOR'), actor_name: displayName(state.me), created_at: new Date().toISOString() });
        return id;
      },
      async deleteRivalScan(id) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder apagam leituras');
        const sc = db.rivalScans.find((x) => x.id === id);
        if (sc) db.rivalLog.push({ id: db.nextId++, scan_id: id, action: 'delete', clan_name: sc.clan_name, scanned_on: sc.scanned_on,
          players: db.rivalPlayers.filter((x) => x.scan_id === id).length, actor_clan: (CFG.clanName || 'FOR HONOR'), actor_name: displayName(state.me), created_at: new Date().toISOString() });
        db.rivalScans = db.rivalScans.filter((x) => x.id !== id);
        db.rivalPlayers = db.rivalPlayers.filter((x) => x.scan_id !== id);
      },
      onAuthChange(cb) { listener = cb; },
      async signIn() { user = { id: 'u0' }; listener(user); },
      async signOut() { user = null; listener(null); },
      async myProfile() { return { ...profile(state.user.id) }; },
      // Mesmas regras do banco: oficiais e líder recebem a lista completa (list_profiles);
      // o membro comum recebe as próprias contas e só o nome de quem aparece para ele (my_people)
      async members() {
        if (isOfficer()) return db.profiles.map((p) => ({ ...p }));
        const own = db.profiles.filter((p) => canActAsDemo(p.id)).map((p) => ({ ...p }));
        if (!isMember()) return own;
        const me = state.user.id;
        const vis = db.recruits.filter((r) => r.status === 'open' || r.created_by === me);
        const myTicket = (tid) => db.tickets.some((t) => t.id === tid && t.author_id === me);
        const ids = new Map(); // id -> mostrar atributos?
        const add = (id, attrs = false) => { if (id) ids.set(id, ids.get(id) || attrs); };
        db.slots.forEach((s) => {
          if (db.slots.some((x) => x.event_id === s.event_id && x.team === s.team && canActAsDemo(x.user_id))) add(s.user_id);
        });
        vis.forEach((r) => { add(r.created_by); add(r.decided_by); });
        db.applications.filter((a) => vis.some((r) => r.id === a.recruit_id)).forEach((a) => add(a.user_id, true));
        (db.rwinners || []).forEach((w) => add(w.user_id));
        db.tickets.filter((t) => t.author_id === me).forEach((t) => add(t.assigned_to));
        db.tmsgs.filter((m) => myTicket(m.ticket_id) && !m.internal).forEach((m) => add(m.author_id));
        (db.tlog || []).filter((l) => myTicket(l.ticket_id)).forEach((l) => add(l.actor));
        db.pilots.filter((p) => canActAsDemo(p.account_id)).forEach((p) => add(p.pilot_id));
        db.pilots.filter((p) => p.pilot_id === me).forEach((p) => add(p.account_id));
        (db.news || []).forEach((n) => add(n.author_id));
        const people = [...ids].map(([id, attrs]) => {
          const p = profile(id);
          if (!p || canActAsDemo(id)) return null;
          const out = { id, game_name: (p.game_name || '').trim() || (p.google_name || '').trim() || 'Membro', google_name: '', char_class: p.role === 'former' ? null : p.char_class };
          if (attrs && p.role !== 'former') ATTRS.forEach((a) => { out[a.key] = p[a.key]; });
          return out;
        }).filter(Boolean);
        return [...own, ...people];
      },
      async findAccounts(q) {
        const s = String(q || '').trim().toLowerCase();
        if (!isMember() || s.length < 3) return [];
        return db.profiles.filter((p) => ['member', 'officer', 'leader'].includes(p.role) && !p.pilot_only && p.id !== state.user.id
          && displayName(p).toLowerCase().includes(s))
          .sort(byName).slice(0, 8).map((p) => ({ id: p.id, game_name: displayName(p), char_class: p.char_class }));
      },
      async myPhone() { return db.contacts.find((c) => c.user_id === state.user.id)?.phone ?? ''; },
      async contacts() { return db.contacts.map((c) => ({ ...c })); },
      async syncProfile() { /* no modo demonstração não há conta Google */ },
      async eventTypes() { return db.types.filter((t) => t.active).sort((a, b) => a.sort_order - b.sort_order).map((t) => ({ ...t })); },
      // Só na demonstração: permite ver o site como líder, oficial ou membro comum
      async demoSetRole(role) { profile(state.user.id).role = role; },
      async profileHistory() { return db.history.filter((h) => isOfficer() || canActAsDemo(h.user_id)).map((h) => ({ ...h })); },
      async clanAverages() {
        const rows = db.profiles.filter((p) => ['member', 'officer', 'leader'].includes(p.role) && !p.pilot_only && hasBuild(p));
        const out = { count: rows.length };
        ATTRS.forEach((a) => { out[a.key] = rows.length ? Math.round(rows.reduce((s, p) => s + p[a.key], 0) / rows.length) : null; });
        return out;
      },
      // Mesmas regras da função power_overview do banco
      async powerOverview(id) {
        const p = profile(id);
        if (!p || !(isOfficer() || canActAsDemo(id))) throw new Error('Sem permissão');
        const list = db.profiles.filter((x) => ['member', 'officer', 'leader'].includes(x.role) && !x.pilot_only && hasBuild(x));
        const d = computePower(list, p);
        return { ...d, top: d.top.map((r) => ({ id: r.m.id, game_name: displayName(r.m), char_class: r.m.char_class, score: r.score })) };
      },
      async saveProfile(fields, phone) {
        // Mesmo comportamento do gatilho do banco: registra o que mudou
        const p = profile(state.user.id);
        if ('game_name' in fields && nickKey(fields.game_name) !== nickKey(p.game_name)) nickFree(fields.game_name, p.id);
        const tracked = ['google_name', 'game_name', ...BUILD_KEYS];
        const changes = {};
        tracked.filter((k) => k in fields).forEach((k) => { if ((p[k] ?? null) !== (fields[k] ?? null)) changes[k] = [p[k] ?? null, fields[k] ?? null]; });
        if (Object.keys(changes).length) db.history.push({ id: db.history.length + 1, user_id: p.id, changed_at: new Date().toISOString(), changes });
        Object.assign(p, fields);
        if (phone !== undefined) {
          db.contacts = db.contacts.filter((c) => c.user_id !== state.user.id);
          db.contacts.push({ user_id: state.user.id, phone: phone || null });
        }
      },
      async events(past) {
        const cut = Date.now() - STILL_UPCOMING_MS;
        return db.events
          .filter((e) => (past ? Date.parse(e.starts_at) < cut : Date.parse(e.starts_at) >= cut))
          .sort((a, b) => (past ? -1 : 1) * (Date.parse(a.starts_at) - Date.parse(b.starts_at)))
          .map(attach);
      },
      async event(id) { const e = db.events.find((x) => x.id === id); return e ? attach(e) : null; },
      // Igual à função member_badges do banco
      async badges() {
        const now = Date.now();
        const monKey = (t) => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
        const reg = db.events.filter((e) => Date.parse(e.starts_at) <= now && db.attendance.some((a) => a.event_id === e.id))
          .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
        return db.profiles.filter((p) => ACTIVE_ROLES.includes(p.role)).map((p) => {
          const joined = Date.parse(p.created_at || 0) || 0;
          const hist = reg.filter((e) => Date.parse(e.starts_at) >= joined)
            .map((e) => ({ e, t: Date.parse(e.starts_at), was: db.attendance.some((a) => a.event_id === e.id && a.user_id === p.id && a.present) }))
            // ausência programada (sem presença) não conta como falta
            .filter((h) => h.was || !db.rsvps.some((r) => r.event_id === h.e.id && r.user_id === p.id && r.absence_id));
          let streak = 0;
          for (const h of hist) { if (h.was) streak++; else break; }
          const months = {};
          hist.forEach((h) => { const m = (months[monKey(h.t)] ||= { n: 0, all: true }); m.n++; if (!h.was) m.all = false; });
          const perfect = Object.entries(months).filter(([k, m]) => Number(k) < monKey(now) && m.n >= 4 && m.all).length;
          const first = db.history.filter((h) => h.user_id === p.id && typeof h.changes?.resonance?.[0] === 'number')
            .sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at))[0];
          const gain = first ? Math.max(0, (p.resonance || 0) - first.changes.resonance[0]) : 0;
          if (isOfficer()) return { user_id: p.id, streak, perfect_months: perfect, res_gain: gain };
          return { user_id: p.id, streak: badgeLevel(streak, STREAK_LV), perfect_months: perfect, res_gain: badgeLevel(gain, GAIN_LV.map(([n]) => n)) };
        });
      },
      async history(sinceIso) {
        const since = sinceIso ? Date.parse(sinceIso) : -Infinity;
        return db.events.filter((e) => Date.parse(e.starts_at) <= Date.now() && Date.parse(e.starts_at) >= since)
          .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)).map(attach);
      },
      async createEvents(rows) {
        return rows.map((r) => {
          const e = { id: db.nextId++, team_format: null, team_count: 10, ...r, created_by: state.user.id, created_at: new Date().toISOString() }; db.events.push(e); elog(e.id, 'created');
          db.absences.forEach((a) => applyAbsenceDemo(a, [e]));
          return { id: e.id };
        });
      },
      async absences() { return db.absences.filter((a) => isOfficer() || canActAsDemo(a.user_id)).map((a) => ({ ...a })); },
      async saveAbsence(userId, start, end, reason) {
        if (!(canActAsDemo(userId) || isOfficer())) throw new Error('Você não pode programar ausência para esta conta');
        if (!start || !end || end < start) throw new Error('Confira as datas da ausência');
        if (start < localDay()) throw new Error('A ausência não pode começar antes de hoje');
        if ((Date.parse(end) - Date.parse(start)) / 86400000 > 180) throw new Error('A ausência pode ter no máximo 180 dias');
        if (!String(reason || '').trim()) throw new Error('Informe o motivo da ausência');
        if (db.absences.some((a) => a.user_id === userId && a.starts_on <= end && a.ends_on >= start)) throw new Error('Já existe uma ausência neste período');
        const a = { id: db.nextId++, user_id: userId, starts_on: start, ends_on: end, reason: String(reason).trim().slice(0, 300), created_by: state.user.id, created_at: new Date().toISOString() };
        db.absences.push(a);
        return { id: a.id, changed: applyAbsenceDemo(a) };
      },
      async deleteAbsence(id) {
        const a = db.absences.find((x) => x.id === id);
        if (!a) return;
        if (!(canActAsDemo(a.user_id) || isOfficer())) throw new Error('Sem permissão para cancelar esta ausência');
        const today = localDay();
        const ongoing = a.starts_on <= today;
        // Encerrar: libera os eventos depois de hoje. Cancelar (ainda não começou): libera todos.
        const freed = new Set(db.events.filter((e) => Date.parse(e.starts_at) > Date.now() && (!ongoing || localDay(new Date(e.starts_at)) > today)).map((e) => e.id));
        db.rsvps = db.rsvps.filter((r) => !(r.absence_id === id && !r.going && freed.has(r.event_id)));
        if (ongoing) a.ends_on = today;
        else db.absences = db.absences.filter((x) => x.id !== id);
      },
      async leaves() { return db.leaves.filter((l) => isOfficer() || canActAsDemo(l.user_id)).map((l) => ({ ...l })); },
      async requestLeave(userId, reason) {
        if (!canActAsDemo(userId)) throw new Error('Você não pode pedir a saída desta conta');
        const p = profile(userId);
        if (p.role === 'leader') throw new Error('O líder não pode sair do clã por aqui');
        if (!['member', 'officer'].includes(p.role)) throw new Error('Esta conta não está ativa no clã');
        if (!String(reason || '').trim()) throw new Error('Informe o motivo da saída');
        if (db.leaves.some((l) => l.user_id === userId && l.status === 'pending')) throw new Error('Já existe um pedido de saída em aberto para esta conta');
        const l = { id: db.nextId++, user_id: userId, reason: String(reason).trim().slice(0, 300), requested_by: state.user.id, requested_at: new Date().toISOString(), status: 'pending', decided_by: null, decided_at: null, note: null };
        db.leaves.unshift(l);
        return l.id;
      },
      async cancelLeave(id) {
        const l = db.leaves.find((x) => x.id === id);
        if (!l || l.status !== 'pending') throw new Error('Este pedido não está mais em aberto');
        if (!canActAsDemo(l.user_id)) throw new Error('Sem permissão');
        Object.assign(l, { status: 'cancelled', decided_by: state.user.id, decided_at: new Date().toISOString() });
      },
      async decideLeave(id, approve, note) {
        const l = db.leaves.find((x) => x.id === id);
        if (!l || l.status !== 'pending') throw new Error('Este pedido já foi decidido');
        if (canActAsDemo(l.user_id)) throw new Error('Você não pode decidir o pedido da sua própria conta');
        const p = profile(l.user_id);
        const me = profile(state.user.id).role;
        if (!(me === 'leader' || (me === 'officer' && ['member', 'former'].includes(p.role)))) throw new Error('Sem permissão para decidir este pedido');
        if (approve && p.role !== 'former') {
          db.mlog.push({ id: db.mlog.length + 1, user_id: p.id, from_role: p.role, to_role: 'former', changed_by: state.user.id, reason: `Pediu para sair do clã: ${l.reason}`.slice(0, 300), changed_at: new Date().toISOString() });
          p.role = 'former';
          const future = new Set(db.events.filter((e) => Date.parse(e.starts_at) > Date.now()).map((e) => e.id));
          db.rsvps = db.rsvps.filter((r) => !(r.user_id === p.id && future.has(r.event_id)));
          db.slots = db.slots.filter((s) => !(s.user_id === p.id && future.has(s.event_id)));
          db.contacts = db.contacts.filter((c) => c.user_id !== p.id);
          db.pilots = db.pilots.filter((x) => x.pilot_id !== p.id);
        }
        Object.assign(l, { status: approve ? 'approved' : 'rejected', decided_by: state.user.id, decided_at: new Date().toISOString(), note: String(note || '').trim().slice(0, 300) || null });
      },
      async eventResult(id) {
        const r = db.results.find((x) => x.event_id === id);
        if (!r) return null;
        return isOfficer() ? { ...r, notes: db.resultNotes.find((n) => n.event_id === id)?.notes || '' } : { ...r };
      },
      async eventResults(ids) {
        const out = [];
        for (const id of ids) { const r = await this.eventResult(id); if (r) out.push(r); }
        return out;
      },
      async opponents() {
        return [...new Set(db.results.slice().sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)).map((r) => r.opponent).filter(Boolean))];
      },
      async saveResult(eventId, o) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder registram resultados');
        const ev = db.events.find((e) => e.id === eventId);
        if (!ev || Date.parse(ev.starts_at) > Date.now()) throw new Error('O resultado só pode ser registrado depois que o evento começar');
        const row = cleanResult(o);
        db.results = db.results.filter((r) => r.event_id !== eventId);
        db.results.push({ event_id: eventId, outcome: row.outcome, opponent: row.opponent, score_us: row.score_us, score_them: row.score_them, updated_by: state.user.id, updated_at: new Date().toISOString() });
        db.resultNotes = db.resultNotes.filter((n) => n.event_id !== eventId);
        if (row.notes) db.resultNotes.push({ event_id: eventId, notes: row.notes });
      },
      async deleteResult(eventId) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder alteram resultados');
        db.results = db.results.filter((r) => r.event_id !== eventId);
        db.resultNotes = db.resultNotes.filter((n) => n.event_id !== eventId);
      },
      async notes() { return isOfficer() ? db.notes.filter((n) => !canActAsDemo(n.member_id)).map((n) => ({ ...n })) : []; },
      async addNote(memberId, body) { db.notes.unshift({ id: db.nextId++, member_id: memberId, author_id: state.user.id, body, created_at: new Date().toISOString() }); },
      async deleteNote(id) { db.notes = db.notes.filter((n) => n.id !== id); },
      async requestWithdrawal(eventId, reason, accountId) {
        const acct = accountId || state.user.id;
        if (!canActAsDemo(acct)) throw new Error('Você não pode responder por esta conta');
        const r = db.rsvps.find((x) => x.event_id === eventId && x.user_id === acct && x.going);
        if (!r) throw new Error('Esta conta não está confirmada neste evento');
        r.withdraw_reason = reason || 'Sem motivo informado';
        r.withdraw_requested_at = new Date().toISOString();
      },
      async cancelWithdrawal(eventId, accountId) {
        const r = db.rsvps.find((x) => x.event_id === eventId && x.user_id === (accountId || state.user.id));
        if (r) { r.withdraw_reason = null; r.withdraw_requested_at = null; }
      },
      // ----- Contas pilotadas (demonstração) -----
      async pilots() {
        return db.pilots.filter((p) => isOfficer() || p.pilot_id === state.user.id || p.account_id === state.user.id).map((p) => ({ ...p }));
      },
      async saveBuild(accountId, build) {
        if (!canActAsDemo(accountId)) throw new Error('Você não pode alterar esta conta');
        Object.assign(profile(accountId), build);
      },
      async createPilotedAccount(gameName, b) {
        if (!isMember()) throw new Error('Só membros aprovados podem cadastrar contas pilotadas');
        nickFree(gameName, null);
        const id = `m${db.nextId++}`;
        const now = new Date().toISOString();
        db.profiles.push({ id, google_name: '', game_name: gameName, role: 'pending', managed: true, created_at: now, ...b });
        db.mlog.push({ id: db.mlog.length + 1, user_id: id, from_role: null, to_role: 'pending', changed_by: state.user.id, reason: `Conta pilotada cadastrada por ${displayName(profile(state.user.id))}`, changed_at: now });
        db.pilots.push({ account_id: id, pilot_id: state.user.id, status: 'approved', reason: null, requested_at: now, decided_at: now, decided_by: state.user.id });
        return id;
      },
      async requestPilotAccess(accountId, reason) {
        if (accountId === state.user.id) throw new Error('Esta já é a sua conta');
        if (profile(accountId)?.pilot_only) throw new Error('Esta pessoa é membro piloto (não tem conta própria no jogo para ser pilotada)');
        if (db.pilots.some((p) => p.account_id === accountId && p.pilot_id === state.user.id && p.status === 'approved')) throw new Error('Você já pilota esta conta');
        db.pilots = db.pilots.filter((p) => !(p.account_id === accountId && p.pilot_id === state.user.id));
        db.pilots.push({ account_id: accountId, pilot_id: state.user.id, status: 'pending', reason: reason || null, requested_at: new Date().toISOString(), decided_at: null, decided_by: null });
      },
      async decidePilotAccess(accountId, pilotId, approve) {
        if (!(accountId === state.user.id || isOfficer())) throw new Error('Só o dono da conta ou um oficial pode decidir este pedido');
        const row = db.pilots.find((p) => p.account_id === accountId && p.pilot_id === pilotId);
        if (!row) return;
        if (approve) Object.assign(row, { status: 'approved', decided_at: new Date().toISOString(), decided_by: state.user.id });
        else db.pilots = db.pilots.filter((p) => p !== row);
      },
      async removePilot(accountId, pilotId) {
        if (!(accountId === state.user.id || pilotId === state.user.id || isOfficer())) throw new Error('Sem permissão para tirar este piloto');
        db.pilots = db.pilots.filter((p) => !(p.account_id === accountId && p.pilot_id === pilotId));
      },
      async addPilot(accountId, pilotId) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder podem adicionar pilotos');
        if (profile(accountId)?.pilot_only) throw new Error('Esta pessoa é membro piloto (não tem conta própria no jogo para ser pilotada)');
        db.pilots = db.pilots.filter((p) => !(p.account_id === accountId && p.pilot_id === pilotId));
        db.pilots.push({ account_id: accountId, pilot_id: pilotId, status: 'approved', reason: null, requested_at: new Date().toISOString(), decided_at: new Date().toISOString(), decided_by: state.user.id });
      },
      // ----- Membro piloto e Pilotagem (mesmas regras do supabase/pilotagem.sql) -----
      async setAccountKind(pilotOnly, isPilot, note) {
        const p = profile(state.user.id);
        if (!p || p.role === 'former') throw new Error('Conta fora do clã');
        const n = String(note || '').trim().slice(0, 200) || null;
        if (pilotOnly && !n) throw new Error('Informe qual conta você pilota');
        const pilot = !!pilotOnly || !!isPilot;
        const was = !!p.pilot_only;
        Object.assign(p, { pilot_only: !!pilotOnly, is_pilot: pilot, pilot_note: pilot ? n : null });
        if (pilotOnly && !was) pilotOnlyCleanupDemo(p.id);
        if (!!pilotOnly !== was) db.history.push({ id: db.history.length + 1, user_id: p.id, changed_by: p.id, changed_at: new Date().toISOString(), changes: { pilot_only: [was, !!pilotOnly] } });
        if (!pilot) {
          const gone = db.pilotOffers.find((o) => o.pilot_id === p.id);
          if (gone) offerLogDemo(p.id, 'removed', gone.about);
          db.pilotOffers = db.pilotOffers.filter((o) => o.pilot_id !== p.id);
          db.pilotReqs.filter((r) => r.pilot_id === p.id && r.status === 'pending')
            .forEach((r) => Object.assign(r, { status: 'declined', decided_at: new Date().toISOString(), answer: 'Deixou de oferecer pilotagem' }));
        }
      },
      async setMemberKind(userId, pilotOnly, note) {
        const me = profile(state.user.id).role;
        if (!['leader', 'officer'].includes(me)) throw new Error('Só oficiais e o líder podem mudar o tipo de conta dos membros');
        if (me === 'officer' && permMode('pilots') !== 'allow') throw new Error('O líder não permite esta ação para oficiais (pilots)');
        const t = profile(userId);
        if (!t) throw new Error('Membro não encontrado');
        if (t.role === 'former') throw new Error('Esta conta está fora do clã');
        if (t.managed) throw new Error('Conta sem login não pode ser membro piloto (ela é uma conta do jogo pilotada por alguém)');
        if (me === 'officer' && userId !== state.user.id && !['pending', 'member'].includes(t.role)) throw new Error('Só o líder pode mudar o tipo de conta de oficiais e do líder');
        const was = !!t.pilot_only;
        const n = String(note || '').trim().slice(0, 200) || null;
        if (pilotOnly) {
          Object.assign(t, { pilot_only: true, is_pilot: true, pilot_note: n || t.pilot_note || null });
          if (!was) pilotOnlyCleanupDemo(userId);
        } else t.pilot_only = false;
        if (!!pilotOnly !== was) db.history.push({ id: db.history.length + 1, user_id: userId, changed_by: state.user.id, changed_at: new Date().toISOString(), changes: { pilot_only: [was, !!pilotOnly] } });
      },
      async pilotageBoard() {
        if (!isMember()) return null;
        const me = state.user.id;
        const active = (p) => p && ['member', 'officer', 'leader'].includes(p.role);
        const offers = db.pilotOffers.filter((o) => { const p = profile(o.pilot_id); return active(p) && (p.is_pilot || p.pilot_only) && (o.status === 'approved' || o.pilot_id === me || isOfficer()); })
          .map((o) => ({ ...o, name: displayName(profile(o.pilot_id)), pilot_only: !!profile(o.pilot_id).pilot_only,
            reviewed_by_name: isOfficer() || o.pilot_id === me ? (o.reviewed_by ? displayName(profile(o.reviewed_by)) : null) : null,
            review_note: isOfficer() || o.pilot_id === me ? o.review_note : null,
            pending_about: isOfficer() || o.pilot_id === me ? (o.pending_about || null) : null,
            edit_note: isOfficer() || o.pilot_id === me ? (o.edit_note || null) : null,
            accounts: db.pilots.filter((x) => x.pilot_id === o.pilot_id && x.status === 'approved' && active(profile(x.account_id))).length }))
          .sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name, 'pt-BR'));
        const recent = Date.now() - 60 * 86400e3;
        const requests = db.pilotReqs.filter((r) => (isOfficer() || [r.pilot_id, r.account_id, r.requested_by].includes(me))
          && (r.status === 'pending' || Date.parse(r.created_at) > recent))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .map((r) => ({ ...r, account_name: displayName(profile(r.account_id)), account_class: profile(r.account_id)?.char_class || null, pilot_name: displayName(profile(r.pilot_id)) }));
        return { offers, requests };
      },
      async savePilotOffer(about, active) {
        const p = profile(state.user.id);
        if (!isMember()) throw new Error('Só membros do clã');
        if (!(p.is_pilot || p.pilot_only)) throw new Error('Marque “Também sou piloto” em Editar perfil para se cadastrar na Pilotagem');
        const text = String(about || '').trim().slice(0, 300);
        if (!text) throw new Error('Escreva como você pode ajudar (horários, eventos, etc.)');
        const now = new Date().toISOString();
        const o = db.pilotOffers.find((x) => x.pilot_id === p.id);
        const review = { status: 'pending', reviewed_by: null, reviewed_at: null, review_note: null };
        if (!o) { db.pilotOffers.push({ pilot_id: p.id, about: text, active: !!active, created_at: now, updated_at: now, ...review, pending_about: null, edit_note: null }); offerLogDemo(p.id, 'submitted', text); }
        else if (o.status !== 'approved') {
          const resent = o.status !== 'pending' || o.about !== text;
          Object.assign(o, { about: text, active: !!active, updated_at: now, ...review, pending_about: null, edit_note: null });
          if (resent) offerLogDemo(p.id, 'submitted', text);
        } else if (o.about !== text) {
          // Aprovado: a edição vai para a revisão; o texto aprovado continua publicado
          const changed = o.pending_about !== text;
          Object.assign(o, { pending_about: text, edit_note: null, active: !!active, updated_at: now });
          if (changed) offerLogDemo(p.id, 'edit_submitted', text);
        } else Object.assign(o, { active: !!active, pending_about: null, updated_at: now });
      },
      async reviewPilotOffer(pilotId, approve, note) {
        const me = profile(state.user.id).role;
        if (!['leader', 'officer'].includes(me)) throw new Error('Só oficiais e o líder podem aprovar anúncios de pilotagem');
        if (me === 'officer' && permMode('pilots') !== 'allow') throw new Error('O líder não permite esta ação para oficiais (pilots)');
        if (pilotId === state.user.id && me !== 'leader') throw new Error('Outra pessoa da staff precisa aprovar o seu próprio anúncio');
        const o = db.pilotOffers.find((x) => x.pilot_id === pilotId);
        if (!o) throw new Error('Anúncio não encontrado');
        const n = String(note || '').trim().slice(0, 300) || null;
        const now = new Date().toISOString();
        if (o.status === 'approved' && o.pending_about) {
          offerLogDemo(pilotId, approve ? 'edit_approved' : 'edit_rejected', o.pending_about, approve ? null : n);
          Object.assign(o, { about: approve ? o.pending_about : o.about, pending_about: null, edit_note: approve ? null : n, reviewed_by: state.user.id, reviewed_at: now });
        } else if (o.status === 'pending') {
          Object.assign(o, { status: approve ? 'approved' : 'rejected', reviewed_by: state.user.id, reviewed_at: now, review_note: n });
          offerLogDemo(pilotId, o.status, o.about, n);
        } else throw new Error('Este anúncio não tem nada aguardando revisão');
      },
      async pilotOfferHistory() {
        if (!isOfficer()) return [];
        return db.offerLog.slice().sort((a, b) => (Date.parse(b.at) - Date.parse(a.at)) || (b.id - a.id)).map((l) => ({
          ...l, pilot_name: displayName(profile(l.pilot_id)), actor_name: l.actor ? displayName(profile(l.actor)) : null, actor_role: profile(l.actor)?.role || null,
        }));
      },
      async deletePilotOffer(pilotId) {
        if (!(pilotId === state.user.id || isOfficer())) throw new Error('Sem permissão');
        const gone = db.pilotOffers.find((o) => o.pilot_id === pilotId);
        if (gone) offerLogDemo(pilotId, 'removed', gone.about);
        db.pilotOffers = db.pilotOffers.filter((o) => o.pilot_id !== pilotId);
        db.pilotReqs.filter((r) => r.pilot_id === pilotId && r.status === 'pending')
          .forEach((r) => Object.assign(r, { status: 'declined', decided_at: new Date().toISOString(), answer: r.answer || 'O piloto saiu da Pilotagem' }));
      },
      async requestPilotage(pilotId, message) {
        const me = state.user.id;
        if (!isMember()) throw new Error('Só membros do clã');
        if (profile(me).pilot_only) throw new Error('Membro piloto não tem conta própria para ser pilotada');
        if (pilotId === me) throw new Error('Você não pode pedir a si mesmo');
        const o = db.pilotOffers.find((x) => x.pilot_id === pilotId);
        if (!o || !o.active || o.status !== 'approved' || !ACTIVE_ROLES.includes(profile(pilotId)?.role)) throw new Error('Este piloto não está disponível no momento');
        if (db.pilots.some((x) => x.account_id === me && x.pilot_id === pilotId && x.status === 'approved')) throw new Error('Este piloto já pilota a sua conta');
        if (db.pilotReqs.some((r) => r.account_id === me && r.pilot_id === pilotId && r.status === 'pending')) throw new Error('Você já tem um pedido em aberto com este piloto');
        if (db.pilotReqs.filter((r) => r.requested_by === me && r.status === 'pending').length >= 3) throw new Error('Limite de 3 pedidos de pilotagem em aberto. Aguarde a resposta ou cancele um pedido.');
        db.pilotReqs.push({ id: db.nextId++, account_id: me, pilot_id: pilotId, requested_by: me, message: String(message || '').trim().slice(0, 300) || null,
          status: 'pending', answer: null, created_at: new Date().toISOString(), decided_at: null });
      },
      async cancelPilotage(id) {
        const r = db.pilotReqs.find((x) => x.id === id && x.status === 'pending' && (x.requested_by === state.user.id || x.account_id === state.user.id));
        if (!r) throw new Error('Pedido não encontrado ou já respondido');
        Object.assign(r, { status: 'cancelled', decided_at: new Date().toISOString() });
      },
      async answerPilotage(id, accept, answer) {
        const r = db.pilotReqs.find((x) => x.id === id);
        if (!r || r.pilot_id !== state.user.id) throw new Error('Pedido não encontrado');
        if (r.status !== 'pending') throw new Error('Este pedido já foi respondido');
        const now = new Date().toISOString();
        if (accept) {
          if (!ACTIVE_ROLES.includes(profile(r.account_id)?.role)) throw new Error('A conta não está mais no clã');
          db.pilots = db.pilots.filter((x) => !(x.account_id === r.account_id && x.pilot_id === r.pilot_id));
          db.pilots.push({ account_id: r.account_id, pilot_id: r.pilot_id, status: 'approved', reason: 'Pedido pela Pilotagem', requested_at: r.created_at, decided_at: now, decided_by: r.account_id });
        }
        Object.assign(r, { status: accept ? 'accepted' : 'declined', decided_at: now, answer: String(answer || '').trim().slice(0, 300) || null });
      },
      async resolveWithdrawal(eventId, userId, accept) {
        if (!isOfficer()) throw new Error('Sem permissão');
        const r = db.rsvps.find((x) => x.event_id === eventId && x.user_id === userId);
        if (!r) return;
        if (accept) { r.going = false; r.discord = null; dropSlot(eventId, userId); }
        r.withdraw_reason = null; r.withdraw_requested_at = null;
      },
      async updateEvent(id, row) { const e = db.events.find((x) => x.id === id); logEventUpdate(e, row); Object.assign(e, row); },
      async eventLog(eventId) {
        if (!isOfficer()) return [];
        return db.elog.filter((x) => x.event_id === eventId)
          .sort((a, b) => (Date.parse(b.at) - Date.parse(a.at)) || (b.id - a.id))
          .map((x) => ({ ...x, detail: JSON.parse(JSON.stringify(x.detail)) }));
      },
      async deleteEvent(id) {
        db.events = db.events.filter((e) => e.id !== id);
        db.rsvps = db.rsvps.filter((r) => r.event_id !== id);
        db.slots = db.slots.filter((s) => s.event_id !== id);
        db.attendance = db.attendance.filter((a) => a.event_id !== id);
        db.elog = db.elog.filter((x) => x.event_id !== id);
      },
      async setRsvp(eventId, going, build, accountId) {
        const acct = accountId || state.user.id;
        if (!canActAsDemo(acct)) throw new Error('Você não pode responder por esta conta');
        if (profile(acct)?.pilot_only) throw new Error('Membro piloto não responde eventos com a própria conta: escolha a conta que você pilota em “Respondendo como”');
        let r = db.rsvps.find((x) => x.event_id === eventId && x.user_id === acct);
        if (!r) { r = { event_id: eventId, user_id: acct }; db.rsvps.push(r); }
        Object.assign(r, { going, answered_by: state.user.id }, build || {});
        if (going) r.absence_id = null;
        if (!going) dropSlot(eventId, acct);
      },
      async clearRsvp(eventId, accountId) {
        const acct = accountId || state.user.id;
        db.rsvps = db.rsvps.filter((x) => !(x.event_id === eventId && x.user_id === acct));
        dropSlot(eventId, acct);
      },
      async setRole(userId, role) {
        if (userId === state.user.id) throw new Error('Você não pode alterar o próprio cargo');
        const p = profile(userId);
        db.mlog.push({ id: db.mlog.length + 1, user_id: userId, from_role: p.role, to_role: role, changed_by: state.user.id, reason: null, changed_at: new Date().toISOString() });
        p.role = role;
      },
      // Oficiais e líder trocam o nick (nome do personagem); vai para o histórico com quem trocou
      async renameMember(userId, name) {
        const p = profile(userId);
        const me = profile(state.user.id).role;
        const v = String(name || '').trim();
        if (!p) throw new Error('Membro não encontrado');
        if (!v) throw new Error('Escreva o nick');
        if (v.length > 40) throw new Error('O nick pode ter no máximo 40 caracteres');
        if (me !== 'leader' && me !== 'officer') throw new Error('Só oficiais e o líder podem editar o nick dos membros');
        if (nickKey(v) !== nickKey(p.game_name)) nickFree(v, p.id);
        if (me === 'officer' && userId !== state.user.id && !['pending', 'member', 'former'].includes(p.role)) throw new Error('Só o líder pode editar o nick de oficiais e do líder');
        if ((p.game_name || null) !== v) db.history.push({ id: db.history.length + 1, user_id: p.id, changed_by: state.user.id, changed_at: new Date().toISOString(), changes: { game_name: [p.game_name || null, v] } });
        p.game_name = v;
      },
      async removeMember(userId, reason, withManaged) {
        const p = profile(userId);
        const me = profile(state.user.id).role;
        if (userId === state.user.id) throw new Error('Você não pode remover a si mesmo');
        if (p.role === 'former') throw new Error('Esta pessoa já é ex-membro');
        if (!(me === 'leader' || (me === 'officer' && ['pending', 'member'].includes(p.role)))) throw new Error('Sem permissão para remover esta pessoa');
        db.mlog.push({ id: db.mlog.length + 1, user_id: userId, from_role: p.role, to_role: 'former', changed_by: state.user.id, reason: reason || null, changed_at: new Date().toISOString() });
        p.role = 'former';
        const future = new Set(db.events.filter((e) => Date.parse(e.starts_at) > Date.now()).map((e) => e.id));
        db.rsvps = db.rsvps.filter((r) => !(r.user_id === userId && future.has(r.event_id)));
        db.slots = db.slots.filter((s) => !(s.user_id === userId && future.has(s.event_id)));
        db.contacts = db.contacts.filter((c) => c.user_id !== userId);
        if (withManaged) {
          // contas sem login que só esta pessoa pilotava saem junto
          db.pilots.filter((x) => x.pilot_id === userId && x.status === 'approved').forEach((x) => {
            const acc = profile(x.account_id);
            const others = db.pilots.some((y) => y.account_id === acc.id && y.pilot_id !== userId && y.status === 'approved');
            if (acc.managed && acc.role !== 'former' && !others) {
              db.mlog.push({ id: db.mlog.length + 1, user_id: acc.id, from_role: acc.role, to_role: 'former', changed_by: state.user.id, reason: 'Removida junto com o piloto', changed_at: new Date().toISOString() });
              acc.role = 'former';
            }
          });
        }
        db.pilots = db.pilots.filter((x) => x.pilot_id !== userId); // quem sai deixa de pilotar
      },
      async requestRejoin() {
        const p = profile(state.user.id);
        if (p.role !== 'former') throw new Error('Você não é ex-membro');
        db.mlog.push({ id: db.mlog.length + 1, user_id: p.id, from_role: 'former', to_role: 'pending', changed_by: p.id, reason: 'Pediu para voltar ao clã', changed_at: new Date().toISOString() });
        p.role = 'pending';
      },
      // Malah News na demonstração: imagens ficam só na memória do navegador
      async news() { return db.news.slice().sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).map((n) => ({ ...n })); },
      async latestNewsAt() { return db.news.reduce((m, n) => (!m || n.published_at > m ? n.published_at : m), null); },
      async createNews({ file, title, caption }) {
        if (!isOfficer()) throw new Error('Só oficiais e o líder podem publicar');
        db.news.push({ id: db.nextId++, title, caption: caption || null, image_path: 'demo', image_url: URL.createObjectURL(file), author_id: state.user.id, published_at: new Date().toISOString(), edited_at: null });
      },
      async updateNews(id, fields) { Object.assign(db.news.find((n) => n.id === id), fields, { edited_at: new Date().toISOString() }); },
      async uploadNewsImage(file) { return URL.createObjectURL(file); },
      async createNewsFromPath({ image_path, title, caption }) {
        db.news.push({ id: db.nextId++, title, caption: caption || null, image_path, image_url: image_path, author_id: state.user.id, published_at: new Date().toISOString(), edited_at: null });
      },
      async removeNewsImage() { /* na demonstração a imagem fica só na memória */ },
      // ----- Configurações do líder (na memória) -----
      async perms() { return isOfficer() ? Object.entries(db.perms).map(([perm_key, mode]) => ({ perm_key, mode })) : []; },
      async setPerm(key, mode) { if (!isLeader()) throw new Error('Só o líder altera as configurações'); db.perms[key] = mode; },
      async resetPerms() { if (!isLeader()) throw new Error('Só o líder altera as configurações'); db.perms = {}; },
      async requests() { return db.requests.filter((r) => isLeader() || r.requested_by === state.user.id).map((r) => ({ ...r })); },
      async createRequest(r) {
        if (state.me?.role !== 'officer' || db.perms[r.perm_key] !== 'approval') throw new Error('Esta ação não está marcada para aprovação');
        db.requests.unshift({ id: db.nextId++, ...r, requested_by: state.user.id, requested_at: new Date().toISOString(), status: 'pending', decided_by: null, decided_at: null, note: null });
      },
      async decideRequest(id, status, note, summary) {
        if (!isLeader()) throw new Error('Só o líder decide');
        const r = db.requests.find((x) => x.id === id && x.status === 'pending');
        if (r) Object.assign(r, { status, note: note || null, decided_by: state.user.id, decided_at: new Date().toISOString(), ...(summary ? { summary } : {}) });
      },
      async deleteNews(post) { db.news = db.news.filter((n) => n.id !== post.id); },
      // ----- Tickets (mesmas regras que o banco terá) -----
      async tickets() { return listTickets(); },
      async ticket(id) { return listTickets().find((t) => t.id === id) || null; },
      async uploadTicketImage(file) { return URL.createObjectURL(file); },
      async createTicket({ title, category, anonymous, body, images }) {
        if (!isMember()) throw new Error('Só membros do clã podem abrir tickets');
        if (db.tickets.filter((x) => x.author_id === state.user.id && brDay(x.created_at) === brDay(Date.now())).length >= LIMITS.ticketsPerDay) {
          throw new Error(`Limite de ${LIMITS.ticketsPerDay} tickets por dia atingido. Continue a conversa em um ticket aberto ou tente de novo amanhã.`);
        }
        const now = new Date().toISOString();
        const t = { id: db.nextId++, title, category, anonymous: !!anonymous, author_id: state.user.id, status: 'open', assigned_to: null, created_at: now };
        db.tickets.push(t);
        db.tmsgs.push({ id: db.nextId++, ticket_id: t.id, author_id: state.user.id, body, internal: false, images: images || [], created_at: now });
        return t.id;
      },
      async postTicketMessage(id, { body, internal, images }) {
        const t = ticketRow(id);
        if (!t) throw new Error('Este ticket não existe mais');
        const mine = t.author_id === state.user.id;
        if (!mine && !isStaffOn(t)) throw new Error('Sem permissão para responder este ticket');
        if (internal && mine) throw new Error('Notas internas são só para quem atende');
        if (!isOfficer() && db.tmsgs.filter((m) => m.author_id === state.user.id && Date.parse(m.created_at) > Date.now() - 3600e3).length >= LIMITS.msgsPerHour) {
          throw new Error(`Limite de ${LIMITS.msgsPerHour} mensagens por hora atingido. Aguarde um pouco para escrever de novo.`);
        }
        db.tmsgs.push({ id: db.nextId++, ticket_id: id, author_id: state.user.id, body, internal: !!internal, images: images || [], created_at: new Date().toISOString() });
        // Membro escrevendo num ticket resolvido reabre; resposta de quem atende põe "Em andamento"
        if (mine && t.status === 'resolved') tlogStatus(t, 'open');
        if (!mine && !internal && t.status === 'open') tlogStatus(t, 'progress');
      },
      async setTicketStatus(id, status) {
        const t = ticketRow(id);
        if (!t) throw new Error('Este ticket não existe mais');
        const mine = t.author_id === state.user.id;
        if (!mine && !isStaffOn(t)) throw new Error('Sem permissão');
        if (mine && !['open', 'resolved'].includes(status)) throw new Error('Você só pode resolver ou reabrir o seu ticket');
        tlogStatus(t, status);
      },
      async assignTicket(id, userId) {
        const t = ticketRow(id);
        if (!t || !isStaffOn(t)) throw new Error('Sem permissão');
        t.assigned_to = userId || null;
        if (userId && t.status === 'open') tlogStatus(t, 'progress'); // assumiu = Em atendimento
      },
      async revealTicketAuthor(id) {
        if (!isLeader()) throw new Error('Só o líder pode ver o autor de um ticket anônimo');
        return ticketRow(id)?.author_id || null;
      },
      // ----- Recrutamentos (mesmas regras que o banco terá) -----
      async recruitments() { return listRecruits(); },
      async recruitment(id) { return listRecruits().find((r) => r.id === id) || null; },
      async createRecruit(row) {
        if (!isMember()) throw new Error('Só membros do clã podem criar recrutamentos');
        if (db.recruits.filter((x) => x.created_by === state.user.id && ['pending', 'open'].includes(x.status)).length >= LIMITS.recruitsActive) {
          throw new Error(`Limite de ${LIMITS.recruitsActive} recrutamentos ativos por pessoa (aguardando aprovação ou abertos). Encerre um para criar outro.`);
        }
        const now = new Date().toISOString();
        // O líder publica direto; os demais passam pela aprovação de um oficial ou do líder
        const direct = isLeader();
        const r = { id: db.nextId++, ...row, created_by: state.user.id, created_at: now, status: direct ? 'open' : 'pending',
          decided_by: direct ? state.user.id : null, decided_at: direct ? now : null, note: null, closed_by: null, closed_at: null };
        db.recruits.push(r);
        return { id: r.id, status: r.status };
      },
      async updateRecruit(id, row) {
        const r = db.recruits.find((x) => x.id === id);
        if (!r) throw new Error('O recrutamento não existe mais');
        if (r.created_by !== state.user.id && !isOfficer()) throw new Error('Só quem criou pode editar');
        const accepted = db.applications.filter((a) => a.recruit_id === id && a.status === 'accepted').length;
        if (row.slots != null && row.slots < accepted) throw new Error(`Já há ${accepted} aceitos; as vagas não podem ser menos que isso`);
        Object.assign(r, row);
        // Recusado e corrigido por quem criou: volta para a fila de aprovação
        if (r.status === 'rejected' && r.created_by === state.user.id) Object.assign(r, { status: 'pending', note: null, decided_by: null, decided_at: null });
      },
      async deleteRecruit(id) {
        const r = db.recruits.find((x) => x.id === id);
        if (r && r.created_by !== state.user.id && !isOfficer()) throw new Error('Só quem criou pode apagar');
        db.recruits = db.recruits.filter((x) => x.id !== id);
        db.applications = db.applications.filter((a) => a.recruit_id !== id);
      },
      async decideRecruit(id, approve, note) {
        const r = db.recruits.find((x) => x.id === id);
        if (!r || r.status !== 'pending') throw new Error('Este recrutamento não está aguardando aprovação');
        if (!isOfficer()) throw new Error('Só oficiais e o líder aprovam recrutamentos');
        if (r.created_by === state.user.id && !isLeader()) throw new Error('Você não pode aprovar o próprio recrutamento');
        Object.assign(r, { status: approve ? 'open' : 'rejected', decided_by: state.user.id, decided_at: new Date().toISOString(), note: approve ? null : (note || null) });
      },
      async closeRecruit(id, reopen = false) {
        const r = db.recruits.find((x) => x.id === id);
        if (!r) throw new Error('O recrutamento não existe mais');
        if (r.created_by !== state.user.id && !isOfficer()) throw new Error('Só quem criou pode encerrar');
        if (reopen && db.recruits.filter((x) => x.created_by === r.created_by && x.id !== r.id && ['pending', 'open'].includes(x.status)).length >= LIMITS.recruitsActive) {
          throw new Error(`Limite de ${LIMITS.recruitsActive} recrutamentos ativos por pessoa (aguardando aprovação ou abertos). Encerre um para criar outro.`);
        }
        if (reopen) Object.assign(r, { status: 'open', closed_by: null, closed_at: null });
        else Object.assign(r, { status: 'closed', closed_by: state.user.id, closed_at: new Date().toISOString() });
      },
      async applyRecruit(id) {
        const r = db.recruits.find((x) => x.id === id);
        if (!r || r.status !== 'open') throw new Error('Este recrutamento não está aberto');
        if (r.created_by === state.user.id) throw new Error('Você criou este recrutamento');
        db.applications = db.applications.filter((a) => !(a.recruit_id === id && a.user_id === state.user.id));
        db.applications.push({ recruit_id: id, user_id: state.user.id, status: 'applied', applied_at: new Date().toISOString(), decided_at: null });
      },
      async withdrawRecruit(id) { db.applications = db.applications.filter((a) => !(a.recruit_id === id && a.user_id === state.user.id)); },
      async decideApplication(id, userId, status) {
        const r = db.recruits.find((x) => x.id === id);
        if (!r || r.created_by !== state.user.id) throw new Error('Só quem criou o recrutamento escolhe os participantes');
        const a = db.applications.find((x) => x.recruit_id === id && x.user_id === userId);
        if (!a) throw new Error('Esta candidatura não existe mais');
        if (status === 'accepted' && a.status !== 'accepted' && db.applications.filter((x) => x.recruit_id === id && x.status === 'accepted').length >= r.slots) throw new Error('Todas as vagas já foram preenchidas');
        Object.assign(a, { status, decided_at: status === 'applied' ? null : new Date().toISOString() });
      },
      async membershipLog(userId) {
        return db.mlog.filter((h) => (!userId || h.user_id === userId) && (isOfficer() || canActAsDemo(h.user_id)))
          .sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).map((h) => ({ ...h }));
      },
      async assign(eventId, userId, team) {
        if (!db.rsvps.some((r) => r.event_id === eventId && r.user_id === userId && r.going)) throw new Error('Este membro não confirmou presença no evento');
        if (db.slots.filter((s) => s.event_id === eventId && s.team === team && s.user_id !== userId).length >= TEAM_SIZE) throw new Error(`O time ${team} já tem 8 membros`);
        dropSlot(eventId, userId);
        db.slots.push({ event_id: eventId, user_id: userId, team });
      },
      async unassign(eventId, userId) { dropSlot(eventId, userId); },
      async removeTeams(eventId, teams) {
        const before = slotsOf(eventId);
        db.slots = db.slots.filter((s) => !(s.event_id === eventId && (!teams || teams.includes(s.team))));
        logRoomDiff(eventId, before, slotsOf(eventId), { auto: false });
      },
      // Mesmas regras da função rename_team do banco
      async renameTeam(eventId, index, name) {
        const e = db.events.find((x) => x.id === eventId);
        if (e.team_format !== 'rito') throw new Error('Só é possível renomear times no formato Outros');
        const clean = String(name || '').trim();
        if (clean.length > TEAM_NAME_MAX) throw new Error(`O nome do time pode ter até ${TEAM_NAME_MAX} caracteres`);
        const oldName = customTeamName(e, index);
        const names = Array.from({ length: RITE_MAX }, (_, i) => e.team_names?.[i] ?? null);
        names[index] = clean || null;
        const next = { ...e, team_names: names };
        const newName = customTeamName(next, index);
        if (teamNames(next).some((t, i) => i !== index && norm(t) === norm(newName))) throw new Error('Já existe um time com esse nome');
        e.team_names = names;
        db.slots.forEach((s) => { if (s.event_id === eventId && s.team === oldName) s.team = newName; });
        if (oldName !== newName) elog(eventId, 'rename', newName, { from: oldName, to: newName });
      },
      async setAvatar(blob, hidden = false) {
        const p = profile(state.user.id);
        p.custom_avatar_url = blob ? URL.createObjectURL(blob) : null;
        p.avatar_hidden = !blob && hidden;
        return p.custom_avatar_url;
      },
      async saveTeams(eventId, slots) {
        const count = {};
        slots.forEach((s) => {
          if (!db.rsvps.some((r) => r.event_id === eventId && r.user_id === s.user_id && r.going)) throw new Error('Um dos membros não confirmou presença no evento');
          count[s.team] = (count[s.team] || 0) + 1;
          if (count[s.team] > TEAM_SIZE) throw new Error(`O time ${s.team} passou de 8 membros`);
        });
        const before = slotsOf(eventId);
        db.slots = db.slots.filter((s) => s.event_id !== eventId).concat(slots.map((s) => ({ event_id: eventId, user_id: s.user_id, team: s.team })));
        logRoomDiff(eventId, before, slotsOf(eventId));
      },
      async saveAttendance(eventId, rows) {
        rows.forEach((r) => {
          db.attendance = db.attendance.filter((a) => !(a.event_id === eventId && a.user_id === r.user_id));
          db.attendance.push({ event_id: eventId, user_id: r.user_id, present: r.present });
        });
      },
      // ----- Sorteio (mesmas regras do banco) -----
      async raffles() {
        return db.raffles.slice().sort((a, b) => Date.parse(b.draw_at) - Date.parse(a.draw_at)).map((r) => ({
          ...r,
          entries: db.rentries.filter((e) => e.raffle_id === r.id && (isOfficer() || e.user_id === state.user.id))
            .map((e) => pick(e, ['raffle_id', 'user_id', 'entered_at', 'removed_at'])),
          winners: db.rwinners.filter((w) => w.raffle_id === r.id).map((w) => ({ ...w })),
        }));
      },
      async runRaffleDraws() {
        db.raffles.filter((r) => r.status === 'open' && Date.parse(r.draw_at) <= Date.now()).forEach((r) => {
          const pool = raffleChecksDemo(r).filter((c) => c.eligible).map((c) => c.user_id);
          for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          pool.slice(0, r.winners_count).forEach((u, i) => db.rwinners.push({ raffle_id: r.id, user_id: u, position: i + 1 }));
          Object.assign(r, { status: 'drawn', drawn_at: new Date().toISOString(), eligible_count: pool.length });
        });
      },
      async raffleStaff(id) {
        raffleStaffDemo();
        const r = raffleRow(id);
        return r ? { wars: raffleWarsDemo(r), checks: raffleChecksDemo(r) } : { wars: [], checks: [] };
      },
      async raffleRemovals() {
        if (!isOfficer()) return [];
        return db.rentries.filter((e) => e.removed_at).sort((a, b) => Date.parse(b.removed_at) - Date.parse(a.removed_at))
          .map((e) => pick(e, ['raffle_id', 'user_id', 'removed_at', 'removed_by', 'removed_reason']));
      },
      async createRaffle(row) {
        raffleStaffDemo();
        const c = cleanRaffleRow(row);
        if (Date.parse(c.draw_at) <= Date.now()) throw new Error('Escolha um domingo que ainda não passou');
        if (db.raffles.some((r) => Date.parse(r.draw_at) === Date.parse(c.draw_at))) throw new Error('Já existe um sorteio neste domingo');
        const r = { id: db.nextId++, ...c, status: 'open', created_by: state.user.id, created_at: new Date().toISOString(), drawn_at: null, eligible_count: null };
        db.raffles.push(r);
        return r.id;
      },
      async updateRaffle(id, row) {
        raffleStaffDemo();
        const r = raffleRow(id);
        raffleOpenDemo(r, 'O horário deste sorteio já passou');
        const c = cleanRaffleRow(row);
        if (Date.parse(c.draw_at) <= Date.now()) throw new Error('Escolha um domingo que ainda não passou');
        if (db.raffles.some((x) => x.id !== id && Date.parse(x.draw_at) === Date.parse(c.draw_at))) throw new Error('Já existe um sorteio neste domingo');
        Object.assign(r, c);
      },
      async deleteRaffle(id) {
        raffleStaffDemo();
        const r = raffleRow(id);
        if (!r) return;
        raffleOpenDemo(r, 'Um sorteio já realizado não pode ser cancelado');
        db.raffles = db.raffles.filter((x) => x.id !== id);
        db.rentries = db.rentries.filter((e) => e.raffle_id !== id);
      },
      async joinRaffle(id) {
        const r = raffleRow(id);
        raffleOpenDemo(r, 'As inscrições deste sorteio já fecharam');
        const e = db.rentries.find((x) => x.raffle_id === id && x.user_id === state.user.id);
        if (e?.removed_at) throw new Error('Sua inscrição foi removida pela staff. Entre em contato com a staff.');
        if (!e) db.rentries.push({ raffle_id: id, user_id: state.user.id, entered_at: new Date().toISOString(), removed_at: null, removed_by: null, removed_reason: null });
      },
      async leaveRaffle(id) {
        raffleOpenDemo(raffleRow(id), 'As inscrições deste sorteio já fecharam');
        db.rentries = db.rentries.filter((e) => !(e.raffle_id === id && e.user_id === state.user.id && !e.removed_at));
      },
      async removeRaffleEntry(id, userId, reason) {
        raffleStaffDemo();
        const why = String(reason || '').trim();
        if (why.length < 5) throw new Error('Escreva o motivo da remoção (pelo menos 5 letras)');
        raffleOpenDemo(raffleRow(id), 'O horário deste sorteio já passou');
        const e = db.rentries.find((x) => x.raffle_id === id && x.user_id === userId && !x.removed_at);
        if (!e) throw new Error('Esta inscrição não existe mais');
        Object.assign(e, { removed_at: new Date().toISOString(), removed_by: state.user.id, removed_reason: why.slice(0, 300) });
      },
    };
  }

  // =====================================================================
  //  Configurações do líder: permissões dos oficiais
  //  Para cada função o líder escolhe: Permitido, Precisa de aprovação ou Bloqueado.
  //  O site esconde/segura as ações e o banco (gatilhos) garante a regra.
  // =====================================================================
  const PERMS = [
    { group: 'Eventos', items: [
      { key: 'event_create', label: 'Criar e repetir eventos', approval: true },
      { key: 'event_edit', label: 'Editar eventos', approval: true },
      { key: 'event_delete', label: 'Apagar eventos', approval: true },
      { key: 'results', label: 'Registrar resultados', desc: 'Vitória ou derrota, clã adversário, placar e observações', approval: true },
    ] },
    { group: 'Times e presença', items: [
      { key: 'teams_build', label: 'Montar e revisar times', desc: 'Formato, sugestão, renomear e salvar os times' },
      { key: 'teams_lock', label: 'Travar e destravar times' },
      { key: 'withdraw_decide', label: 'Decidir pedidos de saída' },
      { key: 'attendance', label: 'Registrar presença real' },
    ] },
    { group: 'Membros', items: [
      { key: 'member_approve', label: 'Aprovar novos membros', approval: true },
      { key: 'member_remove', label: 'Remover ou recusar membros', approval: true },
      { key: 'member_rename', label: 'Editar o nick dos membros', desc: 'Trocar o nome do personagem de membros e de quem aguarda aprovação', approval: true },
      { key: 'leave_approve', label: 'Aprovar saída do clã', desc: 'Pedidos de membros que querem sair do clã (o de oficiais fica com o líder)', approval: true },
      { key: 'pilots', label: 'Gerenciar pilotos de contas', desc: 'Aprovar pedidos de piloto e adicionar pilotos' },
      { key: 'notes', label: 'Anotações internas', desc: 'Ver e escrever anotações sobre os membros' },
      { key: 'view_phone', label: 'Ver telefones' },
      { key: 'stats', label: 'Ver Estatísticas do clã', desc: 'Só esconde na tela' },
      { key: 'csv', label: 'Exportar lista em CSV', desc: 'Só esconde na tela' },
      { key: 'freq_view', label: 'Ver o painel de Frequência', desc: 'Só esconde na tela' },
    ] },
    { group: 'Estatísticas', items: [
      { key: 'panel_view', label: 'Ver o menu Estatísticas', desc: 'Ícone 📊 ao lado do sininho, com os indicadores por ciclo (só esconde na tela)' },
      { key: 'cycles', label: 'Gerenciar ciclos', desc: 'Cadastrar, editar e apagar os ciclos (Sombras / Imortal)', approval: true },
    ] },
    { group: 'Clãs rivais', items: [
      { key: 'rivals_view', label: 'Ver os clãs rivais', desc: 'Estatísticas dos outros clãs, compartilhadas com o INFERNUM, no menu 📊 (só esconde na tela)' },
      { key: 'rivals_import', label: 'Importar e apagar leituras', desc: 'Enviar a planilha de mapeamento (Scout) e apagar leituras (vale para os dois clãs)' },
    ] },
    { group: 'Malah News', items: [
      { key: 'news_publish', label: 'Publicar e editar edições', approval: true },
      { key: 'news_delete', label: 'Apagar edições', approval: true },
    ] },
    ...(RECRUIT_ON ? [{ group: 'Recrutamentos', items: [
      { key: 'recruit_approve', label: 'Aprovar recrutamentos', desc: 'Aprovar ou recusar recrutamentos criados pelos membros', approval: true },
      { key: 'recruit_close', label: 'Encerrar recrutamentos', desc: 'Encerrar ou reabrir recrutamentos de outros membros', approval: true },
      { key: 'recruit_edit', label: 'Editar recrutamentos', desc: 'Alterar recrutamentos de outros membros', approval: true },
      { key: 'recruit_delete', label: 'Apagar recrutamentos', desc: 'Apagar recrutamentos de outros membros', approval: true },
    ] }] : []),
    ...(TICKETS_ON ? [{ group: 'Tickets', items: [
      { key: 'ticket_view', label: 'Ver tickets', desc: 'Se bloqueado, o oficial só vê os próprios tickets na Central de Atendimento' },
      { key: 'ticket_reply', label: 'Responder tickets', desc: 'Responder, escrever notas internas e assumir tickets' },
      { key: 'ticket_resolve', label: 'Resolver tickets', desc: 'Mudar o status (Em andamento, Resolvido ou reabrir)' },
      { key: 'ticket_reports', label: 'Ver denúncias', desc: 'Se bloqueado, os tickets de Reclamação / Denúncia ficam só com o líder' },
    ] }] : []),
    ...(RAFFLE_ON ? [{ group: 'Sorteio', items: [
      { key: 'raffle_manage', label: 'Ativar (criar), editar e cancelar sorteios', desc: 'O sorteio só acontece no domingo em que a staff ativar um, com o prêmio escolhido', approval: true },
      { key: 'raffle_remove', label: 'Remover inscrições do sorteio', desc: 'Sempre com o motivo por escrito' },
    ] }] : []),
  ];
  const PERM_BY_KEY = Object.fromEntries(PERMS.flatMap((g) => g.items).map((p) => [p.key, p]));
  const PERM_MODES = [['allow', 'Permitido'], ['approval', 'Precisa de aprovação'], ['deny', 'Bloqueado']];
  // settings: modo de cada função; requests: pedidos que eu posso ver (líder: todos; oficial: os meus)
  const perms = { settings: {}, requests: [], ready: false };
  const isLeader = () => state.me?.role === 'leader';
  const permMode = (key) => perms.settings[key] || 'allow';
  // O oficial (ou o líder) pode ver/usar esta função?
  const can = (key) => isOfficer() && (isLeader() || permMode(key) !== 'deny');
  const pendingRequests = () => perms.requests.filter((r) => r.status === 'pending');
  class PendingApproval extends Error {}

  // Qual permissão cada operação usa, e como descrevê-la para o líder
  const nameOf = (id) => displayName(memberById(id));
  const GATED = {
    createEvents: (raw, rows) => ['event_create', `Criar o evento “${rows[0]?.title}” em ${fmtShortDate(rows[0]?.starts_at)} às ${fmtTime(rows[0]?.starts_at)}${rows.length > 1 ? ` (repetindo por ${rows.length} semanas)` : ''}`],
    updateEvent: async (raw, id, row) => {
      if ('teams_locked' in row) return ['teams_lock'];
      if ('team_format' in row || 'team_count' in row || 'team_names' in row) return ['teams_build'];
      const ev = await raw.event(id);
      if (!ev) throw new Error('O evento não existe mais');
      return ['event_edit', `Editar o evento “${ev.title}”${row.title && row.title !== ev.title ? ` (novo nome: “${row.title}”)` : ''}${row.starts_at && Date.parse(row.starts_at) !== Date.parse(ev.starts_at) ? ` · nova data ${fmtShortDate(row.starts_at)} às ${fmtTime(row.starts_at)}` : ''}`];
    },
    deleteEvent: async (raw, id) => {
      const ev = await raw.event(id);
      if (!ev) throw new Error('O evento não existe mais');
      return ['event_delete', `Apagar o evento “${ev.title}” de ${fmtShortDate(ev.starts_at)}`];
    },
    saveResult: async (raw, id, o) => {
      const ev = await raw.event(id);
      if (!ev) throw new Error('O evento não existe mais');
      const r = cleanResult(o);
      return ['results', `Registrar ${r.outcome === 'win' ? 'vitória' : 'derrota'} no evento “${ev.title}” de ${fmtShortDate(ev.starts_at)}${r.opponent ? ` contra ${r.opponent}` : ''}${scoreText(r) ? ` · placar ${scoreText(r)}` : ''}`];
    },
    deleteResult: async (raw, id) => {
      const ev = await raw.event(id);
      if (!ev) throw new Error('O evento não existe mais');
      return ['results', `Tirar o resultado do evento “${ev.title}” de ${fmtShortDate(ev.starts_at)}`];
    },
    decideLeave: async (raw, id, approve, note) => {
      const l = (await raw.leaves()).find((x) => x.id === id);
      if (!l || l.status !== 'pending') throw new Error('Este pedido já foi decidido');
      return ['leave_approve', `${approve ? 'Aprovar' : 'Recusar'} a saída do clã de ${nameOf(l.user_id)} · motivo: “${l.reason}”${note ? ` · observação: “${note}”` : ''}`];
    },
    saveTeams: () => ['teams_build'],
    renameTeam: () => ['teams_build'],
    removeTeams: () => ['teams_build'],
    saveAttendance: () => ['attendance'],
    resolveWithdrawal: () => ['withdraw_decide'],
    setRole: (raw, id, role) => (role === 'member' && memberById(id)?.role === 'pending' ? ['member_approve', `Aprovar ${nameOf(id)} como membro do clã`] : null),
    removeMember: (raw, id, reason) => ['member_remove', `${memberById(id)?.role === 'pending' ? 'Recusar a entrada de' : 'Remover do clã'} ${nameOf(id)}${reason ? ` · motivo: “${reason}”` : ''}`],
    saveCycle: (raw, o) => ['cycles', `${o?.id ? 'Editar o' : 'Cadastrar um'} ciclo ${o?.side === 'immortal' ? 'Imortal' : 'das Sombras'} começando em ${String(o?.starts_on || '').split('-').reverse().join('/')}`],
    deleteCycle: () => ['cycles', 'Apagar um ciclo'],
    importRivalScan: (raw, o) => ['rivals_import', `Importar a leitura do clã ${o?.clan_name || ''}`],
    deleteRivalScan: () => ['rivals_import', 'Apagar uma leitura de clã rival'],
    renameMember: (raw, id, name) => (id === state.user.id ? null : ['member_rename', `Trocar o nick de ${nameOf(id)} para “${String(name || '').trim()}”`]),
    addNote: () => ['notes'],
    addPilot: () => ['pilots'],
    decidePilotAccess: (raw, acc) => (acc === state.user.id ? null : ['pilots']),
    createNews: (raw, o) => ['news_publish', `Publicar a edição “${o.title}” na Malah News`],
    createNewsFromPath: (raw, o) => ['news_publish', `Publicar a edição “${o.title}” na Malah News`],
    updateNews: (raw, id, f) => ['news_publish', `Editar a edição “${f.title}” da Malah News`],
    deleteNews: (raw, post) => ['news_delete', `Apagar a edição “${post.title}” da Malah News`],
    // Recrutamentos: a permissão só vale quando o oficial mexe no recrutamento de outra pessoa
    decideRecruit: (raw, id, approve, note) => recruitGate(raw, id, 'recruit_approve', (r) => `${approve ? 'Aprovar' : 'Recusar'} o recrutamento “${r.title}” de ${nameOf(r.created_by)}${!approve && note ? ` · motivo: “${note}”` : ''}`),
    closeRecruit: (raw, id, reopen) => recruitGate(raw, id, 'recruit_close', (r) => `${reopen ? 'Reabrir' : 'Encerrar'} o recrutamento “${r.title}” de ${nameOf(r.created_by)}`),
    updateRecruit: (raw, id, row) => recruitGate(raw, id, 'recruit_edit', (r) => `Editar o recrutamento “${r.title}” de ${nameOf(r.created_by)}${row?.title && row.title !== r.title ? ` (novo título: “${row.title}”)` : ''}`),
    deleteRecruit: (raw, id) => recruitGate(raw, id, 'recruit_delete', (r) => `Apagar o recrutamento “${r.title}” de ${nameOf(r.created_by)}`),
    // Tickets: só vale para quem atende (no próprio ticket, o oficial é um membro como os outros)
    postTicketMessage: (raw, id) => ticketGate(raw, id, 'ticket_reply'),
    assignTicket: (raw, id) => ticketGate(raw, id, 'ticket_reply'),
    setTicketStatus: (raw, id) => ticketGate(raw, id, 'ticket_resolve'),
    // Sorteio: ativar/editar/cancelar pode precisar da aprovação do líder; remover inscrição é só Permitido ou Bloqueado
    createRaffle: (raw, row) => ['raffle_manage', `Ativar o sorteio de ${fmtDraw(row?.draw_at)} · prêmio: ${prizeText(cleanRaffleRow(row))}`],
    updateRaffle: (raw, id, row) => raffleGate(raw, id, (r) => `Editar o sorteio de ${fmtDraw(r.draw_at)} (${prizeText(r)}) → ${fmtDraw(row?.draw_at)} · prêmio: ${prizeText(cleanRaffleRow(row))}`),
    deleteRaffle: (raw, id) => raffleGate(raw, id, (r) => `Cancelar o sorteio de ${fmtDraw(r.draw_at)} (${prizeText(r)})`),
    removeRaffleEntry: () => ['raffle_remove', ''],
  };
  async function ticketGate(raw, id, key) {
    const t = await raw.ticket(id);
    if (!t) throw new Error('Este ticket não existe mais');
    return t.mine ? null : [key, ''];
  }
  async function raffleGate(raw, id, text) {
    const r = (await raw.raffles()).find((x) => x.id === Number(id));
    if (!r) throw new Error('Este sorteio não existe mais');
    return ['raffle_manage', text(r)];
  }
  async function recruitGate(raw, id, key, text) {
    const r = await raw.recruitment(id);
    if (!r) throw new Error('O recrutamento não existe mais');
    return r.created_by === state.user.id ? null : [key, text(r)];
  }
  // Para ir para a fila de aprovação, a operação precisa virar dados (JSON)
  const PREPARE = {
    createNews: async (raw, o) => ['createNewsFromPath', [{ image_path: await raw.uploadNewsImage(o.file), title: o.title, caption: o.caption || null }]],
    deleteNews: (raw, post) => ['deleteNews', [{ id: post.id, image_path: post.image_path, title: post.title }]],
  };
  // Ao aprovar, o site só executa operações conhecidas e só com os campos esperados
  const only = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && k in obj).map((k) => [k, obj[k]]));
  const SANITIZE = {
    createEvents: ([rows]) => [(rows || []).slice(0, 12).map((r) => only(r, ['title', 'description', 'type_id', 'rsvp_close_minutes', 'starts_at', 'team_format', 'team_count', 'team_names']))],
    updateEvent: ([id, row]) => [Number(id), only(row, ['title', 'description', 'type_id', 'rsvp_close_minutes', 'starts_at'])],
    deleteEvent: ([id]) => [Number(id)],
    setRole: ([id]) => [String(id), 'member'],
    removeMember: ([id, reason, withManaged]) => [String(id), String(reason || '').slice(0, 300), !!withManaged],
    renameMember: ([id, name]) => [String(id), String(name || '').trim().slice(0, 40)],
    createNewsFromPath: ([o]) => [{ image_path: String(o?.image_path || ''), title: String(o?.title || ''), caption: o?.caption ? String(o.caption) : null }],
    updateNews: ([id, f]) => [Number(id), { title: String(f?.title || ''), caption: f?.caption ? String(f.caption) : null }],
    deleteNews: ([p]) => [{ id: Number(p?.id), image_path: String(p?.image_path || ''), title: String(p?.title || '') }],
    decideRecruit: ([id, approve, note]) => [Number(id), !!approve, note ? String(note).slice(0, 300) : null],
    closeRecruit: ([id, reopen]) => [Number(id), !!reopen],
    updateRecruit: ([id, row]) => [Number(id), cleanRecruitRow(row)],
    deleteRecruit: ([id]) => [Number(id)],
    createRaffle: ([row]) => [only(row, ['draw_at', 'prize_kind', 'prize_qty', 'prize_text'])],
    updateRaffle: ([id, row]) => [Number(id), only(row, ['draw_at', 'prize_kind', 'prize_qty', 'prize_text'])],
    deleteRaffle: ([id]) => [Number(id)],
    saveResult: ([id, o]) => [Number(id), cleanResult(o)],
    decideLeave: ([id, approve, note]) => [Number(id), !!approve, note ? String(note).slice(0, 300) : null],
    deleteResult: ([id]) => [Number(id)],
    saveCycle: ([o]) => [{ id: o?.id ? Number(o.id) : null, starts_on: String(o?.starts_on || '').slice(0, 10), side: o?.side === 'immortal' ? 'immortal' : 'shadows' }],
    deleteCycle: ([id]) => [Number(id)],
  };
  let RAW = null; // operações sem a checagem de permissão (o líder usa ao aprovar)
  function withPermissions(raw) {
    RAW = raw;
    const wrapped = { ...raw };
    Object.entries(GATED).forEach(([name, describe]) => {
      if (!raw[name]) return;
      wrapped[name] = async (...args) => {
        if (!isOfficer() || isLeader()) return raw[name](...args);
        const g = await describe(raw, ...args);
        if (!g) return raw[name](...args);
        const [key, text] = g;
        const mode = permMode(key);
        if (mode === 'deny') throw new Error(`O líder bloqueou esta ação para oficiais (${PERM_BY_KEY[key].label})`);
        if (mode === 'approval' && PERM_BY_KEY[key].approval) {
          const [method, margs] = PREPARE[name] ? await PREPARE[name](raw, ...args) : [name, args];
          await raw.createRequest({ perm_key: key, method, args: JSON.parse(JSON.stringify(margs)), summary: text.slice(0, 500) });
          throw new PendingApproval(text);
        }
        return raw[name](...args);
      };
    });
    return wrapped;
  }
  // Carrega as regras (oficiais e líder). Se o SQL novo ainda não foi rodado, tudo fica "Permitido".
  async function loadPerms() {
    if (!isOfficer()) { perms.settings = {}; perms.requests = []; return; }
    try {
      const [rows, reqs] = await Promise.all([RAW.perms(), RAW.requests()]);
      perms.settings = Object.fromEntries(rows.map((r) => [r.perm_key, r.mode]));
      perms.requests = reqs;
      perms.ready = true;
    } catch (e) {
      console.warn('Configurações do líder indisponíveis (rode o SQL novo no Supabase)', e);
      perms.settings = {}; perms.requests = []; perms.ready = false;
    }
  }
  // O líder confere o pedido de novo (com os dados atuais) antes de executar
  async function checkRequest(r) {
    const san = SANITIZE[r.method];
    if (!san || !GATED[r.method]) throw new Error('Operação desconhecida');
    const args = san(Array.isArray(r.args) ? r.args : []);
    const g = await GATED[r.method](RAW, ...args);
    if (!g || g[0] !== r.perm_key) throw new Error('O pedido não confere mais com a situação atual');
    return { args, text: g[1] };
  }

  // Depois de qualquer ação que muda dados, o sininho recalcula as pendências
  const MUTATES = /^(set|clear|request|cancel|decide|create|update|delete|save|post|assign|close|reopen|apply|withdraw|remove|approve|reject|add|record|mark|reveal|lock|unlock|leave|join|publish|answer|review)/;
  function withBellRefresh(raw) {
    const out = {};
    Object.keys(raw).forEach((k) => {
      out[k] = typeof raw[k] !== 'function' ? raw[k]
        : !MUTATES.test(k) ? raw[k].bind(raw)
        : async (...a) => { const r = await raw[k](...a); refreshBellSoon(); return r; };
    });
    return out;
  }
  const api = withBellRefresh(withPermissions(DEMO ? demoApi() : supabaseApi()));
  if (DEMO) window.__demo = { state, api, actingId: () => actingId(), myAccounts: () => myAccounts() }; // ajuda nos testes (só na demonstração)

  // =====================================================================
  //  Utilidades de interface
  // =====================================================================

  const isMember = () => ['member', 'officer', 'leader'].includes(state.me?.role);
  const isOfficer = () => ['officer', 'leader'].includes(state.me?.role);
  const activeMembers = () => state.members.filter((m) => ACTIVE_ROLES.includes(m.role));
  // Membro piloto: não tem conta própria no jogo (fica fora do rank, da média e da frequência)
  const isPilotOnly = (m) => !!m?.pilot_only;
  const isPilot = (m) => !!(m?.pilot_only || m?.is_pilot);
  // Contas do jogo ativas no clã (sem os membros piloto): rank, frequência, presença e estatísticas
  const activePlayers = () => activeMembers().filter((m) => !m.pilot_only);

  // ---------- Contas pilotadas ----------
  // state.pilots = vínculos (conta ↔ piloto) que eu posso ver; state.acting = conta que está respondendo agora
  const memberById = (id) => state.members.find((m) => m.id === id);
  const approvedPilotIds = (accountId) => (state.pilots || []).filter((p) => p.account_id === accountId && p.status === 'approved').map((p) => p.pilot_id);
  const pilotedByMe = () => (state.pilots || []).filter((p) => p.pilot_id === state.user?.id && p.status === 'approved').map((p) => p.account_id);
  const canActAs = (id) => id === state.user?.id || pilotedByMe().includes(id);
  // Contas pelas quais posso responder agora: a minha + as contas pilotadas que estão ativas no clã
  // (o membro piloto responde só pelas contas que pilota, nunca pela própria)
  const myAccounts = () => [isPilotOnly(state.me) ? null : state.me, ...pilotedByMe().map(memberById).filter((m) => m && ACTIVE_ROLES.includes(m.role))].filter(Boolean);
  const actingId = () => (state.acting && myAccounts().some((a) => a.id === state.acting) ? state.acting : (myAccounts()[0]?.id ?? state.user?.id));
  const actingProfile = () => memberById(actingId()) || state.me;
  // Quem controla cada conta: o dono (se tiver login) e os pilotos aprovados
  const controllersOf = (m) => [...(m && !m.managed ? [m.id] : []), ...approvedPilotIds(m?.id)];
  function pilotLabel(m) {
    const names = approvedPilotIds(m.id).map((id) => displayName(memberById(id))).filter(Boolean);
    if (!names.length) return m.managed ? '<span class="pilot-tag warn" title="Esta conta não tem piloto">🧑‍✈️ sem piloto</span>' : '';
    return `<span class="pilot-tag" title="Pode ser respondida por: ${esc(names.join(', '))}">🧑‍✈️ pilotada por ${esc(names.join(', '))}</span>`;
  }
  function setActing(id) {
    state.acting = id;
    try { localStorage.setItem(`acting-${state.user.id}`, id); } catch { /* ignora */ }
  }
  const displayName = (p) => p?.game_name || p?.google_name || 'Desconhecido';
  const hasBuild = (b) => !!b?.char_class && ATTRS.every((a) => Number.isFinite(b[a.key]));
  const fmtNum = (n) => (Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—');
  const byName = (a, b) => displayName(a).localeCompare(displayName(b), 'pt-BR');

  // Classe/atributos confirmados no evento; se não houver, os do perfil.
  function buildFor(rsvp, profile) { return hasBuild(rsvp) ? pick(rsvp, BUILD_KEYS) : pick(profile, BUILD_KEYS); }

  function avatar(p, cls = '') {
    // Foto enviada pelo site > foto da conta Google; "avatar_hidden" = o membro removeu a foto
    const url = p?.avatar_hidden ? null : (p?.custom_avatar_url || p?.avatar_url);
    if (url) return `<img class="avatar ${cls}" src="${esc(url)}" alt="" loading="lazy">`;
    return `<span class="avatar ${cls}" aria-hidden="true">${esc(displayName(p).charAt(0).toUpperCase())}</span>`;
  }
  function classTag(key) {
    const c = CLASS[key];
    return c ? `<span class="cls" style="--c:${c.color}" title="${esc(c.label)}">${esc(c.short)}</span>` : '<span class="cls none" title="Sem classe">?</span>';
  }
  function statsLine(b) {
    return ATTRS.map((a) => `<span title="${esc(a.label)}">${a.short} <b>${fmtNum(b?.[a.key])}</b></span>`).join('');
  }
  const dcIcon = '<span class="dc" title="Vai usar o Discord neste evento">🎧</span>';
  function personLine(p, build, discord, note) {
    const sub = [p.managed ? 'conta sem login' : (p.game_name ? p.google_name : ''), note].filter(Boolean).join(' · ');
    return `<li>${avatar(p)}<span class="name">${esc(displayName(p))}${sub ? `<small>${esc(sub)}</small>` : ''}</span>${discord ? dcIcon : ''}${build?.char_class ? classTag(build.char_class) : ''}</li>`;
  }

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (iso) => {
    const s = new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const fmtShortDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const fmtShortWeekday = (iso) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const toLocalInput = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  function relativeDay(iso) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    return diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : diff === -1 ? 'Ontem' : null;
  }
  const isOpen = (ev) => Date.parse(ev.starts_at) > Date.now() - STILL_UPCOMING_MS;
  const typeName = (id) => state.types.find((t) => t.id === id)?.name || '';
  const hasStarted = (ev) => Date.parse(ev.starts_at) <= Date.now();

  // Formato "Outros": o oficial pode renomear cada time (ex.: "Time 1" → "Revenge"). Vazio = nome padrão.
  const customTeamName = (ev, i) => (ev.team_names?.[i] || '').trim() || `Time ${i + 1}`;
  function teamNames(ev) {
    if (ev.team_format === 'guerra') return WAR_GROUPS.flatMap((g) => [1, 2, 3].map((n) => `${g} ${n}`));
    if (ev.team_format === 'rito') return Array.from({ length: ev.team_count || RITE_MAX }, (_, i) => customTeamName(ev, i));
    return [];
  }

  let toastTimer;
  function toast(msg, isErr = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show${isErr ? ' err' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
  }
  function fail(err) {
    // Ação que precisa do líder: não é erro, foi enviada para aprovação
    if (err instanceof PendingApproval) {
      if (dlg.open) dlg.close();
      toast('⏳ Enviado para aprovação do líder. Acompanhe em “Solicitações”.');
      renderHeader(currentRouteKey());
      return;
    }
    console.error(err);
    const blocked = String(err?.message || '').match(/^O líder não permite esta ação para oficiais \(([a-z_]+)\)/);
    if (blocked) { toast(`O líder bloqueou esta ação para oficiais (${PERM_BY_KEY[blocked[1]]?.label || blocked[1]})`, true); return; }
    toast(err?.message ? `Erro: ${err.message}` : 'Algo deu errado.', true);
  }

  const dlg = $('#dlg');
  function openDialog(html, onReady) {
    dlg.innerHTML = html;
    if (!dlg.open) dlg.showModal();
    dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
    onReady?.(dlg);
  }
  function confirmDialog(text, okLabel = 'Confirmar') {
    return new Promise((resolve) => {
      let answered = false;
      openDialog(`<p>${esc(text)}</p><div class="row end"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`, (d) => {
        $('#ok', d).addEventListener('click', () => { answered = true; dlg.close(); resolve(true); });
        dlg.addEventListener('close', () => { if (!answered) resolve(false); }, { once: true });
      });
    });
  }
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast('Não foi possível copiar', true); }
  }

  // Campos de classe e atributos (usados no perfil e na confirmação de presença)
  function buildFields(b, required) {
    const req = required ? 'required' : '';
    return `
      <div class="field">
        <label for="b-class">Classe</label>
        <select id="b-class" ${req}>
          <option value="" disabled hidden ${b?.char_class ? '' : 'selected'}>Selecione sua classe…</option>
          ${CLASSES.map((c) => `<option value="${c.key}" ${b?.char_class === c.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}
        </select>
      </div>
      <div class="attrs">
        ${ATTRS.map((a) => `<div class="field"><label for="b-${a.key}">${a.label}</label>
          <input id="b-${a.key}" type="number" min="0" max="1000000" step="1" inputmode="numeric" ${req} value="${b?.[a.key] ?? ''}"></div>`).join('')}
      </div>`;
  }
  function readBuild(d) {
    const out = { char_class: $('#b-class', d).value || null };
    ATTRS.forEach((a) => { const v = $(`#b-${a.key}`, d).value.trim(); out[a.key] = v === '' ? null : Math.max(0, parseInt(v, 10)); });
    return out;
  }

  // =====================================================================
  //  Cabeçalho
  // =====================================================================

  const main = $('#app');
  const loading = () => { main.innerHTML = '<div class="spinner" aria-label="Carregando"></div>'; };

  function renderHeader(currentKey) {
    $('#clan-name').textContent = CFG.clanName || 'Clã';
    document.title = `${CFG.clanName || 'Clã'} · Eventos`;
    const banner = $('#demo-banner');
    banner.hidden = !DEMO;
    if (DEMO) {
      banner.innerHTML = `Modo demonstração: dados fictícios, nada é salvo.${state.me ? `
        <label class="demo-role">Ver como
          <select id="demo-role" class="inline">${['leader', 'officer', 'member', 'former'].map((r) => `<option value="${r}" ${state.me.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
        </label>` : ''}`;
      $('#demo-role')?.addEventListener('change', async (e) => {
        await api.demoSetRole(e.target.value);
        await boot();
        toast(`Agora você está vendo o site como ${ROLE_LABEL[e.target.value]}`);
      });
    }
    main.classList.toggle('wide', currentKey === 'teams' || currentKey === 'freq');

    // Botão flutuante da Central de Atendimento (membros: os meus tickets; liderança: aba Atendimento)
    let fab = $('#help-fab');
    if (!fab) {
      fab = document.createElement('a');
      fab.id = 'help-fab';
      fab.className = 'help-fab';
      fab.innerHTML = '<span class="help-fab-icon" aria-hidden="true">💬</span><span class="help-fab-label">Central de Atendimento</span>';
      document.body.appendChild(fab);
    }
    fab.hidden = !(TICKETS_ON && memberUI()) || currentKey === 'teams';
    fab.href = supportOn() ? '#/atendimento' : '#/tickets';
    fab.title = supportOn() ? 'Central de Atendimento: tickets dos membros' : 'Central de Atendimento: fale com a liderança';
    fab.setAttribute('aria-label', 'Central de Atendimento');
    fab.classList.toggle('active', ['tickets', 'support'].includes(currentKey));
    document.body.classList.toggle('has-fab', !fab.hidden);

    const nav = $('#nav');
    if (memberUI()) {
      const links = [['#/', 'Próximos', 'upcoming'], ['#/passados', 'Passados', 'past'], ['#/news', 'Malah News', 'news']];
      if (RECRUIT_ON) links.push(['#/recrutamentos', 'Recrutamentos', 'recruits']);
      if (RAFFLE_ON) links.push(['#/sorteio', 'Sorteio', 'raffle']);
      if (isOfficer()) links.push(['#/membros', 'Membros', 'members']);
      if (can('freq_view')) links.push(['#/frequencia', 'Frequência', 'freq']);
      links.push(['#/perfil', 'Meu perfil', 'profile'], ['#/utils', 'Utils', 'utils']);
      if (!isLeader() && isOfficer()) links.push(['#/solicitacoes', 'Solicitações', 'requests']);
      // Os contadores ficam no sininho (ao lado da foto), não no menu
      nav.innerHTML = links.map(([href, label, key]) => `<a href="${href}" class="${currentKey === key || (key === 'utils' && currentKey === 'pilotage') ? 'active' : ''}">${label}</a>`).join('');
    } else nav.innerHTML = '';

    const box = $('#userbox');
    if (state.me) {
      const accounts = memberUI() ? myAccounts() : [];
      box.innerHTML = `${accounts.length > 1 || (isPilotOnly(state.me) && accounts.length) ? `<label class="acting" title="Escolha a conta do jogo pela qual você está respondendo">
          <span>Respondendo como</span>
          <select id="acting-select" class="inline">${accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === actingId() ? 'selected' : ''}>${esc(displayName(a))}${a.id === state.user.id ? ' (você)' : ' 🧑‍✈️'}</option>`).join('')}</select>
        </label>` : ''}
        ${memberUI() ? '<div class="bell-wrap" id="bell-wrap"></div>' : ''}
        ${memberUI() && (can('panel_view') || can('rivals_view')) ? `<a class="gear${currentKey === 'panel' || currentKey === 'rivals' ? ' active' : ''}" href="${can('panel_view') ? '#/estatisticas' : '#/rivais'}" title="Estatísticas" aria-label="Estatísticas"><span aria-hidden="true">📊</span></a>` : ''}
        ${isLeader() ? `<a class="gear${currentKey === 'config' ? ' active' : ''}" href="#/config" title="Configurações" aria-label="Configurações"><span aria-hidden="true">⚙️</span></a>` : ''}
        <button class="who" id="btn-profile" title="Meu perfil">${avatar(state.me)}<span class="label">${esc(displayName(state.me))}</span></button>
        <button class="btn ghost small" id="btn-logout">Sair</button>`;
      $('#acting-select')?.addEventListener('change', (e) => {
        setActing(e.target.value);
        toast(`Agora você está respondendo como ${displayName(actingProfile())}`);
        route();
      });
      $('#btn-profile').addEventListener('click', () => openProfile());
      renderBell();
      $('#btn-logout').addEventListener('click', () => api.signOut().catch(fail));
    } else box.innerHTML = '';
  }

  // =====================================================================
  //  Telas
  // =====================================================================

  function viewLogin() {
    main.innerHTML = `<div class="hero">
      <svg class="emblem hero-emblem" viewBox="0 0 64 64" aria-hidden="true"><use href="#emblem"></use></svg>
      <h1 class="wordmark big">${esc(CFG.clanName || 'Clã')}</h1>
      ${CFG.tagline ? `<p class="tagline">${esc(CFG.tagline)}</p>` : ''}
      <div class="divider" aria-hidden="true"></div>
      <p>Entre com sua conta Google para ver os eventos da semana e confirmar presença.</p>
      <button class="btn google" id="btn-login"><svg class="g-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Entrar com Google</button>
    </div>`;
    $('#btn-login').addEventListener('click', () => {
      try { sessionStorage.setItem('after-login', location.hash); } catch { /* ignora */ }
      api.signIn().catch(fail);
    });
    if (CFG.googleClientId && !DEMO) mountGoogleButton();
  }

  // Botão oficial do Google (Google Identity Services). Com ele, a janela de login do Google
  // diz "Fazer login em forhonorcla.com.br", e não mostra o endereço do Supabase.
  // Se o script do Google não carregar, fica o botão antigo (que continua funcionando).
  let gisLoading = null;
  const loadGis = () => (gisLoading ||= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('Não foi possível carregar o login do Google')); };
    document.head.appendChild(s);
  }));
  async function mountGoogleButton() {
    const old = $('#btn-login');
    if (!old) return;
    try {
      // nonce: o Google recebe o hash e o Supabase confere com o valor original
      const raw = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))]
        .map((b) => b.toString(16).padStart(2, '0')).join('');
      await loadGis();
      if (!document.body.contains(old)) return; // a tela mudou enquanto carregava
      google.accounts.id.initialize({
        client_id: CFG.googleClientId,
        nonce: hash,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: async (resp) => {
          try { await api.signInWithIdToken(resp.credential, raw); } catch (e) { fail(e); }
        },
      });
      const box = document.createElement('div');
      box.className = 'gis-btn';
      old.replaceWith(box);
      google.accounts.id.renderButton(box, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', logo_alignment: 'left', locale: 'pt-BR', width: 280 });
    } catch (e) {
      console.warn('login Google', e); // segue com o botão antigo
    }
  }

  function viewPending() {
    main.innerHTML = `<div class="hero">
      <span class="sigil">⏳</span>
      <h1>Aguardando aprovação</h1>
      <p>Olá, <strong>${esc(displayName(state.me))}</strong>! Seu acesso precisa ser aprovado por um oficial ou pelo líder do clã. Enquanto isso, preencha seu perfil:</p>
      <ul class="pending-kinds">
        <li><b>🎮 Jogador</b>: tem a própria conta no jogo. Informe o nome do personagem, a classe e os atributos.</li>
        <li><b>🧑‍✈️ Membro piloto</b>: não tem conta própria, só pilota contas de outros membros. Informe seu nome e qual conta você pilota (sem classe e atributos).</li>
      </ul>
      ${state.me.pilot_only ? `<p class="muted small">Cadastrado como membro piloto${state.me.pilot_note ? ` · pilota: ${esc(state.me.pilot_note)}` : ''}.</p>` : ''}
      <div class="row" style="justify-content:center">
        <button class="btn primary" id="btn-pf">Preencher perfil</button>
        <button class="btn" id="btn-recheck">Verificar de novo</button>
      </div>
    </div>`;
    $('#btn-pf').addEventListener('click', () => openProfile());
    $('#btn-recheck').addEventListener('click', () => boot());
  }

  // Quem foi removido do clã: pode pedir para voltar
  function viewFormer() {
    main.innerHTML = `<div class="hero">
      <span class="sigil">🚪</span>
      <h1>Você não faz mais parte do clã</h1>
      <p>Olá, <strong>${esc(displayName(state.me))}</strong>. Seu acesso ao ${esc(CFG.clanName || 'clã')} foi encerrado.
        Se quiser voltar, envie um pedido: ele aparece para os oficiais em “Aguardando aprovação”.</p>
      <div class="row" style="justify-content:center">
        <button class="btn primary" id="btn-rejoin">Pedir para voltar</button>
        <button class="btn ghost" id="btn-out">Sair</button>
      </div>
    </div>`;
    $('#btn-rejoin').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await api.requestRejoin(); toast('Pedido enviado! Aguarde a aprovação de um oficial.'); await boot(); } catch (err) { fail(err); e.target.disabled = false; }
    });
    $('#btn-out').addEventListener('click', () => api.signOut().catch(fail));
  }

  // Pediu para sair do clã: mesma tela de ex-membro enquanto a liderança decide
  function viewLeaving() {
    const l = myLeave();
    main.innerHTML = `<div class="hero">
      <span class="sigil">🚪</span>
      <h1>Você pediu para sair do clã</h1>
      <p>Olá, <strong>${esc(displayName(state.me))}</strong>. Seu pedido foi enviado em ${new Date(l.requested_at).toLocaleDateString('pt-BR')} e está com a liderança.
        Você não tem mais acesso ao site do ${esc(CFG.clanName || 'clã')}.</p>
      <div class="row" style="justify-content:center">
        <button class="btn" id="btn-leave-undo">Desistir do pedido</button>
        <button class="btn ghost" id="btn-out">Sair</button>
      </div>
    </div>`;
    $('#btn-leave-undo').addEventListener('click', async (e) => {
      if (!(await confirmDialog('Desistir do pedido e continuar no clã?', 'Desistir do pedido'))) return;
      e.target.disabled = true;
      try { await api.cancelLeave(l.id); toast('Pedido cancelado. Bem-vindo de volta!'); await loadLeaves(); await route(); } catch (err) { fail(err); e.target.disabled = false; }
    });
    $('#btn-out').addEventListener('click', () => api.signOut().catch(fail));
  }

  // Descrição de uma mudança de cargo no histórico do clã
  function roleChangeLabel(h) {
    const f = h.from_role; const t = h.to_role;
    if (!f) return t === 'pending' ? 'Entrou no site (aguardando aprovação)' : `Registro inicial: ${ROLE_LABEL[t] || t}`;
    if (t === 'former') return f === 'pending' ? 'Pedido de entrada recusado' : /^Pediu para sair do clã/.test(h.reason || '') ? 'Saiu do clã (pedido aprovado)' : 'Removido do clã';
    if (f === 'former' && t === 'pending') return 'Pediu para voltar ao clã';
    if (f === 'former') return `Readmitido como ${ROLE_LABEL[t] || t}`;
    if (f === 'pending' && t === 'member') return 'Aprovado no clã';
    const rank = { member: 1, officer: 2, leader: 3 };
    if (rank[f] && rank[t]) return rank[t] > rank[f] ? `Promovido a ${ROLE_LABEL[t]}` : `Passou a ${ROLE_LABEL[t]}`;
    return `Cargo: ${ROLE_LABEL[f] || f} → ${ROLE_LABEL[t] || t}`;
  }

  function membershipCard(entries, members) {
    const byId = Object.fromEntries(members.map((m) => [m.id, m]));
    const auto = /^(Primeiro acesso|Registro inicial)/;
    const items = entries.map((h) => `<div class="hist-item${h.to_role === 'former' ? ' out' : ''}">
        <div class="hist-date">${new Date(h.changed_at).toLocaleDateString('pt-BR')} · ${fmtTime(h.changed_at)}</div>
        <div>${esc(roleChangeLabel(h))}${h.changed_by && byId[h.changed_by] && h.changed_by !== h.user_id ? ` <span class="muted small">por ${esc(displayName(byId[h.changed_by]))}</span>` : ''}</div>
        ${h.reason && !auto.test(h.reason) ? `<div class="muted small">“${esc(h.reason)}”</div>` : ''}
      </div>`).join('');
    return `<div class="card member-log"><h2>🛡 Histórico no clã</h2><div class="hist">${items || '<p class="muted">Nenhum registro.</p>'}</div></div>`;
  }

  // Remover do clã (ou recusar quem está aguardando aprovação)
  function openRemoveDialog(m, after) {
    const reject = m.role === 'pending';
    const name = esc(displayName(m));
    // Contas sem login em que esta pessoa é o único piloto
    const soloManaged = (state.pilots || []).filter((p) => p.pilot_id === m.id && p.status === 'approved')
      .map((p) => memberById(p.account_id))
      .filter((a) => a && a.managed && a.role !== 'former' && approvedPilotIds(a.id).length === 1);
    openDialog(`
      <form id="rm-form" class="stack">
        <h2>${reject ? 'Recusar entrada' : 'Remover do clã'}</h2>
        <p class="small" style="margin:0">${reject ? `<b>${name}</b> sai da lista de aprovação` : `<b>${name}</b> perde o acesso ao site e vai para a lista de <b>Ex-membros</b>`}.
          O histórico (presenças, alterações e anotações) é mantido. Se a pessoa entrar de novo no site, poderá pedir para voltar.</p>
        ${reject ? '' : '<p class="muted small" style="margin:0">As respostas e vagas em times de eventos futuros são apagadas, e o telefone é descartado.</p>'}
        ${soloManaged.length ? `<label class="radio"><input type="checkbox" id="rm-managed" checked>
          Remover também as contas sem login que só ${name} pilota: <b>${soloManaged.map((a) => esc(displayName(a))).join(', ')}</b></label>` : ''}
        <div class="field">
          <label for="rm-reason">Motivo <span class="muted small">(opcional, fica no histórico)</span></label>
          <textarea id="rm-reason" maxlength="300" placeholder="Ex.: conta de teste, inativo há 2 meses…"></textarea>
        </div>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${reject ? 'Recusar' : 'Remover do clã'}</button>
        </div>
      </form>`, (d) => {
      $('#rm-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.removeMember(m.id, $('#rm-reason', d).value.trim(), !!$('#rm-managed', d)?.checked);
          dlg.close();
          toast(reject ? 'Pedido recusado' : `${displayName(m)} foi removido do clã`);
          await after();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  function counts(ev) {
    const yes = ev.rsvps.filter((r) => r.going).length;
    const no = ev.rsvps.filter((r) => !r.going).length;
    const total = activePlayers().length;
    const responded = new Set(ev.rsvps.map((r) => r.user_id));
    const pending = activePlayers().filter((m) => !responded.has(m.id)).length;
    return { yes, no, pending, total };
  }
  // Resposta e time da conta que está respondendo agora (a própria ou uma conta pilotada)
  const myRsvp = (ev) => ev.rsvps.find((r) => r.user_id === actingId());
  const myTeam = (ev) => ev.team_slots?.find((s) => s.user_id === actingId())?.team;

  // Prazo de resposta e times travados
  const rsvpDeadline = (ev) => (ev.rsvp_close_minutes == null ? null : new Date(Date.parse(ev.starts_at) - ev.rsvp_close_minutes * 60000));
  const rsvpOpen = (ev) => { const d = rsvpDeadline(ev); return isOpen(ev) && (!d || Date.now() < d.getTime()); };
  const lockedForMe = (ev) => !!ev.teams_locked && !!myTeam(ev);
  const canChangeRsvp = (ev) => isOfficer() || (rsvpOpen(ev) && !lockedForMe(ev));
  const fmtDeadline = (d) => `${fmtShortWeekday(d.toISOString())} ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${fmtTime(d.toISOString())}`;
  function deadlineTag(ev) {
    const d = rsvpDeadline(ev);
    if (!d || !isOpen(ev)) return '';
    return rsvpOpen(ev)
      ? `<span class="deadline" title="Prazo para responder">⏳ Responda até ${esc(fmtDeadline(d))}</span>`
      : '<span class="deadline closed">⛔ Respostas encerradas</span>';
  }

  function rsvpButtons(ev) {
    const html = rsvpButtonsRaw(ev);
    const mine = myRsvp(ev);
    // aviso dentro do mesmo bloco dos botões
    return mine && !mine.going && mine.absence_id
      ? html.replace(/<\/div>\s*$/, '<div class="abs-note" title="Você pode trocar para “Vou” se for participar">✈️ Ausência programada</div></div>') : html;
  }
  function rsvpButtonsRaw(ev) {
    if (isPilotOnly(state.me) && !myAccounts().length) {
      return '<div class="rsvp-locked"><span class="muted small" title="Peça acesso à conta em Meu perfil → Pilotos">🧑‍✈️ Membro piloto: você responde pelas contas que pilota</span></div>';
    }
    const mine = myRsvp(ev);
    if (!canChangeRsvp(ev)) {
      const why = !rsvpOpen(ev) ? 'Respostas encerradas' : '🔒 Times travados';
      if (mine?.going) {
        return mine.withdraw_requested_at
          ? `<div class="rsvp-locked"><span class="c-gold small">⏳ Pedido de saída enviado</span>
              <button class="btn small ghost" data-cancel-wd="${ev.id}">Cancelar pedido</button></div>`
          : `<div class="rsvp-locked"><span class="c-yes small">✔ Você vai · ${why}</span>
              <button class="btn small ghost danger" data-withdraw="${ev.id}">Não vou poder ir…</button></div>`;
      }
      return `<div class="rsvp-locked"><span class="muted small">${mine ? '✖ Não vou' : 'Sem resposta'} · ${why}</span></div>`;
    }
    const a = mine?.going;
    return `<div class="actions">
      <button class="btn small yes ${a === true ? 'on' : ''}" data-rsvp="${ev.id}" data-going="1" aria-pressed="${a === true}" title="${a === true ? 'Ver ou corrigir classe e atributos' : 'Confirmar presença'}">✔ Vou</button>
      <button class="btn small no ${a === false ? 'on' : ''}" data-rsvp="${ev.id}" data-going="0" aria-pressed="${a === false}">✖ Não vou</button>
    </div>`;
  }

  // Selo do resultado na lista de eventos
  function resultBadge(r) {
    const win = r.outcome === 'win';
    const sc = scoreText(r);
    return `<div class="res-line ${win ? 'win' : 'loss'}">${win ? '🏆' : '💀'} <b>${win ? 'Vitória' : 'Derrota'}</b>${r.opponent ? ` contra <b>${esc(r.opponent)}</b>` : ''}${sc ? ` <span class="res-sc">${sc}</span>` : ''}</div>`;
  }
  function eventCard(ev) {
    const c = counts(ev);
    const rel = relativeDay(ev.starts_at);
    const live = hasStarted(ev) && isOpen(ev);
    const pct = (n) => (c.total ? (100 * n) / c.total : 0);
    const team = myTeam(ev);
    const needsAttendance = can('attendance') && hasStarted(ev) && !ev.attendance?.length;
    return `<div class="card event">
      <div class="time">${fmtTime(ev.starts_at)}<small>${esc(fmtShortWeekday(ev.starts_at))}</small></div>
      <div>
        <a class="title" href="#/evento/${ev.id}">${esc(ev.title)}</a>
        ${live ? '<span class="badge">Agora</span>' : rel === 'Hoje' ? '<span class="badge gold">Hoje</span>' : ''}
        ${team ? `<span class="badge team">Seu time: ${esc(team)}</span>` : ''}
        ${ev.teams_locked && isOpen(ev) ? '<span class="badge lock" title="Times travados">🔒 Times travados</span>' : ''}
        ${isOfficer() && ev.rsvps.some((r) => r.going && r.withdraw_requested_at) ? `<span class="badge warn">⚠ ${ev.rsvps.filter((r) => r.going && r.withdraw_requested_at).length} pedido(s) de saída</span>` : ''}
        ${deadlineTag(ev) ? `<div>${deadlineTag(ev)}</div>` : ''}
        ${needsAttendance ? '<span class="badge warn">Registrar presença</span>' : ''}
        ${ev.result ? resultBadge(ev.result) : ''}
        ${ev.description ? `<div class="desc">${esc(ev.description)}</div>` : ''}
        ${isOfficer() ? `<div class="counts"><span class="c-yes">✔ ${c.yes} vão</span><span class="c-no">✖ ${c.no} não vão</span><span class="muted">${c.pending} sem resposta</span></div>
        <div class="bar"><span class="y" style="width:${pct(c.yes)}%"></span><span class="n" style="width:${pct(c.no)}%"></span></div>` : ''}
        <div class="ev-foot"><a class="btn small ghost" href="#/evento/${ev.id}">🔎 Detalhar evento</a>${calBtn(ev)}${can('results') && hasStarted(ev) ? `<button class="btn small ${ev.result ? 'ghost' : 'primary'}" type="button" data-result="${ev.id}">${ev.result ? '✏️ Editar resultado' : '🏆 Registrar resultado'}</button>` : ''}</div>
      </div>
      ${isOpen(ev) ? rsvpButtons(ev) : ''}
    </div>`;
  }

  // Confirmação de presença: o membro confirma (ou corrige) classe e atributos
  function openRsvpDialog(ev, after) {
    const mine = myRsvp(ev);
    const already = mine?.going === true;
    const acct = actingProfile();
    const piloting = acct.id !== state.user.id;
    const initial = already && hasBuild(mine) ? pick(mine, BUILD_KEYS) : pick(acct, BUILD_KEYS);
    // Discord: se já respondeu, mantém; senão, sugere a última escolha feita neste navegador
    let dcInit = already ? (mine?.discord ?? null) : null;
    if (dcInit === null) { try { const v = localStorage.getItem('last-discord'); dcInit = v === null ? null : v === '1'; } catch { /* ignora */ } }
    openDialog(`
      <form id="rsvp-form" class="stack">
        <h2>${already ? 'Sua presença está confirmada' : 'Confirmar presença'}</h2>
        <p class="muted" style="margin:0">${esc(ev.title)} · ${esc(fmtDay(ev.starts_at))} às ${fmtTime(ev.starts_at)}</p>
        ${piloting ? `<p class="piloting-note">🧑‍✈️ Respondendo pela conta <b>${esc(displayName(acct))}</b></p>` : ''}
        <p class="small" style="margin:0">Confira a classe e os atributos ${piloting ? 'desta conta' : 'sua'} para este evento. Se algo mudou, corrija aqui (o perfil da conta também será atualizado).</p>
        ${buildFields(initial, true)}
        <fieldset class="discord-q">
          <legend>Vai usar o Discord neste evento?</legend>
          <label class="radio"><input type="radio" name="discord" value="1" required ${dcInit === true ? 'checked' : ''}> 🎧 Sim, vou estar no Discord</label>
          <label class="radio"><input type="radio" name="discord" value="0" ${dcInit === false ? 'checked' : ''}> Não vou usar o Discord</label>
        </fieldset>
        <div class="row end">
          ${already ? '<button type="button" class="btn ghost danger" id="btn-unrsvp">Remover presença</button><span class="spacer"></span>' : ''}
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${already ? 'Salvar' : '✔ Confirmar presença'}</button>
        </div>
      </form>`, (d) => {
      $('#rsvp-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        const build = readBuild(d);
        const discord = d.querySelector('input[name="discord"]:checked')?.value === '1';
        try { localStorage.setItem('last-discord', discord ? '1' : '0'); } catch { /* ignora */ }
        submit.disabled = true;
        try {
          await api.saveBuild(acct.id, build);
          await api.setRsvp(ev.id, true, { ...build, discord }, acct.id);
          if (!piloting) Object.assign(state.me, build);
          const m = memberById(acct.id);
          if (m) Object.assign(m, build);
          dlg.close();
          toast(already ? 'Dados atualizados' : 'Presença confirmada!');
          await after();
        } catch (err) { fail(err); submit.disabled = false; }
      });
      $('#btn-unrsvp', d)?.addEventListener('click', async () => {
        const team = myTeam(ev);
        if (team && !(await confirmDialog(`Você está no time ${team}. Ao remover a presença, você sai do time. Continuar?`, 'Remover'))) return;
        dlg.close();
        try { await api.clearRsvp(ev.id, actingId()); toast('Presença removida'); await after(); } catch (err) { fail(err); }
      });
    });
  }

  // Pedido de saída: quando o membro não pode mais mudar a resposta sozinho
  function openWithdrawDialog(ev, after) {
    const team = myTeam(ev);
    openDialog(`
      <form id="wd-form" class="stack">
        <h2>Não vou poder ir</h2>
        <p class="muted" style="margin:0">${esc(ev.title)} · ${esc(fmtDay(ev.starts_at))} às ${fmtTime(ev.starts_at)}</p>
        <p class="small" style="margin:0">${!rsvpOpen(ev) ? 'O prazo de resposta já encerrou' : 'Os times já foram travados'}${team ? ` e você está no time <b>${esc(team)}</b>` : ''}.
          Seu pedido vai para os oficiais, que decidem se aceitam a saída.</p>
        <div class="field">
          <label for="wd-reason">Motivo <span class="muted small">(ajuda o oficial a reorganizar)</span></label>
          <textarea id="wd-reason" maxlength="300" placeholder="Ex.: surgiu um compromisso, internet caiu…"></textarea>
        </div>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Enviar pedido</button>
        </div>
      </form>`, (d) => {
      $('#wd-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.requestWithdrawal(ev.id, $('#wd-reason', d).value.trim(), actingId());
          dlg.close();
          toast('Pedido enviado aos oficiais');
          await after();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  // ---------- Adicionar à agenda ----------
  // Aparece nos eventos futuros em que a conta escolhida respondeu "Vou"
  const CAL_MINUTES = 15;
  const calBtn = (ev) => (isOpen(ev) && !hasStarted(ev) && myRsvp(ev)?.going
    ? ` <button class="btn small ghost" type="button" data-cal="${ev.id}" title="Colocar este evento na sua agenda">📅 Adicionar à Agenda</button>` : '');
  function calInfo(ev) {
    const start = new Date(ev.starts_at);
    const end = new Date(start.getTime() + CAL_MINUTES * 60000);
    const url = `${location.origin}${location.pathname}#/evento/${ev.id}`;
    const team = myTeam(ev);
    const details = [ev.description || '', team ? `Seu time: ${team}` : '', `Detalhes e times: ${url}`].filter(Boolean).join('\n\n');
    return { start, end, url, details, title: `${ev.title} · ${CFG.clanName || 'Clã'}` };
  }
  const calStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function googleCalUrl(ev) {
    const c = calInfo(ev);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: c.title, dates: `${calStamp(c.start)}/${calStamp(c.end)}`, details: c.details });
    return `https://calendar.google.com/calendar/render?${q}`;
  }
  function icsText(ev) {
    const c = calInfo(ev);
    // texto no formato .ics: escapa \ ; , e quebras de linha
    const e = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FOR HONOR//Eventos//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:forhonor-evento-${ev.id}@${location.host || 'forhonor'}`, `DTSTAMP:${calStamp(new Date())}`,
      `DTSTART:${calStamp(c.start)}`, `DTEND:${calStamp(c.end)}`, `SUMMARY:${e(c.title)}`, `DESCRIPTION:${e(c.details)}`, `URL:${c.url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e(c.title)}`, 'TRIGGER:-PT30M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  }
  function openCalendar(ev) {
    openDialog(`
      <h2>📅 Adicionar à agenda</h2>
      <p class="muted small" style="margin:0 0 12px"><b>${esc(ev.title)}</b> · ${esc(fmtDay(ev.starts_at))} às ${fmtTime(ev.starts_at)}</p>
      <div class="stack cal-opts">
        <a class="btn" href="${esc(googleCalUrl(ev))}" target="_blank" rel="noopener">Google Agenda</a>
        <button class="btn" type="button" id="cal-ics">Celular / Outlook</button>
      </div>
      <div class="row end" style="margin-top:12px"><button class="btn ghost" data-close>Fechar</button></div>`, (d) => {
      $('#cal-ics', d).addEventListener('click', () => {
        const blob = new Blob([icsText(ev)], { type: 'text/calendar;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `forhonor-evento-${ev.id}.ics`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('Abra o arquivo baixado para salvar na agenda');
      });
    });
  }

  function bindRsvp(root, events, rerender) {
    root.querySelectorAll('[data-cal]').forEach((b) => b.addEventListener('click', () => {
      const ev = events.find((x) => x.id === Number(b.dataset.cal));
      if (ev) openCalendar(ev);
    }));
    root.querySelectorAll('[data-withdraw]').forEach((b) => b.addEventListener('click', () => {
      const ev = events.find((x) => x.id === Number(b.dataset.withdraw));
      if (ev) openWithdrawDialog(ev, rerender);
    }));
    root.querySelectorAll('[data-cancel-wd]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Cancelar o pedido de saída? Você continua confirmado no evento.', 'Cancelar pedido'))) return;
      try { await api.cancelWithdrawal(Number(b.dataset.cancelWd), actingId()); toast('Pedido cancelado'); await rerender(); } catch (e) { fail(e); }
    }));
    root.querySelectorAll('[data-rsvp]').forEach((b) => b.addEventListener('click', async () => {
      const ev = events.find((x) => x.id === Number(b.dataset.rsvp));
      if (!ev) return;
      if (b.dataset.going === '1') { openRsvpDialog(ev, rerender); return; }
      const already = b.classList.contains('on');
      const team = myTeam(ev);
      if (!already && team && !(await confirmDialog(`Você está no time ${team}. Ao marcar “Não vou”, você sai do time. Continuar?`, 'Não vou'))) return;
      root.querySelectorAll(`[data-rsvp="${ev.id}"]`).forEach((x) => { x.disabled = true; });
      try {
        if (already) { await api.clearRsvp(ev.id, actingId()); toast('Resposta removida'); } else { await api.setRsvp(ev.id, false, null, actingId()); toast('Ausência registrada'); }
        await rerender();
      } catch (e) { fail(e); root.querySelectorAll(`[data-rsvp="${ev.id}"]`).forEach((x) => { x.disabled = false; }); }
    }));
  }

  function groupByDay(events) {
    let last = null;
    return events.map((ev) => {
      const k = dayKey(ev.starts_at);
      const rel = relativeDay(ev.starts_at);
      const head = k !== last ? `<div class="day-label">${esc(rel ? `${rel} · ` : '')}${esc(fmtDay(ev.starts_at))}</div>` : '';
      last = k;
      return head + eventCard(ev);
    }).join('');
  }

  let eventsTimer = null;
  async function viewEvents(past) {
    clearTimeout(eventsTimer);
    loading();
    const events = await api.events(past);
    // Quem está com a lista aberta vê o selo "Agora" aparecer no início e o evento
    // sair para "Passados" 20 min depois, sem recarregar a página
    if (!past) {
      const now = Date.now();
      const next = Math.min(...events.flatMap((ev) => [Date.parse(ev.starts_at), Date.parse(ev.starts_at) + STILL_UPCOMING_MS]).filter((t) => t > now));
      const wait = next - now;
      const key = currentRouteKey();
      const refresh = () => {
        if (currentRouteKey() !== key) return;
        if ($('#dlg').open) { eventsTimer = setTimeout(refresh, 30000); return; }
        route();
      };
      if (Number.isFinite(wait) && wait < 2 * 86400e3) eventsTimer = setTimeout(refresh, wait + 1500);
    }
    // Resultado das guerras: só para eventos que já começaram
    const started = events.filter(hasStarted).map((e) => e.id);
    const results = started.length ? await api.eventResults(started).catch(() => []) : [];
    const resBy = Object.fromEntries(results.map((r) => [r.event_id, r]));
    events.forEach((e) => { e.result = resBy[e.id] || null; });
    const head = `<div class="page-head"><h1>${past ? 'Eventos passados' : 'Próximos eventos'}</h1>
      ${can('event_create') && !past ? '<button class="btn primary" id="btn-new">+ Novo evento</button>' : ''}</div>`;
    const body = events.length
      ? groupByDay(events)
      : `<div class="card empty">${past ? 'Nenhum evento passado ainda.' : 'Nenhum evento agendado.'}${can('event_create') && !past ? '<br><br>Crie o primeiro em “+ Novo evento”.' : ''}</div>`;
    main.innerHTML = head + body;
    $('#btn-new')?.addEventListener('click', () => openEventForm());
    main.querySelectorAll('[data-result]').forEach((b) => b.addEventListener('click', () => {
      const ev = events.find((e) => e.id === Number(b.dataset.result));
      if (ev) openResultDialog(ev, ev.result, () => viewEvents(past));
    }));
    bindRsvp(main, events, () => viewEvents(past));
  }

  // ---------- Times: blocos compartilhados ----------

  // Lista de quem confirmou presença, já com classe/atributos do evento
  function goingPeople(ev) {
    const byId = Object.fromEntries(state.members.map((m) => [m.id, m]));
    const out = ev.rsvps.filter((r) => r.going && byId[r.user_id]).map((r) => {
      const p = byId[r.user_id];
      return { id: p.id, name: displayName(p), profile: p, build: buildFor(r, p), discord: !!r.discord, wd: r.withdraw_requested_at ? (r.withdraw_reason || 'Sem motivo') : null };
    });
    // Membro comum: o banco só entrega as respostas das contas dele. Os colegas do time
    // vêm das vagas do time, com o nome e a classe do perfil (o que o membro vê).
    if (!isOfficer()) {
      const have = new Set(out.map((p) => p.id));
      (ev.team_slots || []).forEach((s) => {
        const p = byId[s.user_id];
        if (!p || have.has(p.id)) return;
        have.add(p.id);
        out.push({ id: p.id, name: displayName(p), profile: p, build: buildFor(null, p), discord: false, wd: null });
      });
    }
    return out;
  }

  // bare = só nome e classe (sem atributos), usado na visão do membro e na opção "Ocultar"
  function chip(p, { draggable = false, removable = false, selected = false, compact = false, bare = false, medals = false } = {}) {
    const mine = p.id === actingId();
    const who = `${p.name} · ${CLASS[p.build.char_class]?.label || 'sem classe'}`;
    // Oficiais e líder veem os 5 atributos (também nos times); a dica (title) repete os nomes completos
    const full = ATTRS.map((a) => `${a.label}: ${fmtNum(p.build[a.key])}`).join('\n');
    const stats = bare ? '' : statsLine(p.build);
    return `<div class="chip${selected ? ' sel' : ''}${mine ? ' mine' : ''}${compact ? ' compact' : ''}${bare ? ' bare' : ''}" data-uid="${esc(p.id)}" title="${esc(bare ? who : `${who}\n${full}`)}" ${draggable ? 'draggable="true" tabindex="0" role="button"' : ''}>
      ${classTag(p.build.char_class)}
      <div class="chip-body"><div class="chip-name">${esc(p.name)}${medals ? medalsHtml(p.id) : ''}${p.discord ? ` ${dcIcon}` : ''}${p.wd && isOfficer() ? ` <span class="wd-flag" title="Pediu para sair: ${esc(p.wd)}">⚠</span>` : ''}${isOfficer() && approvedPilotIds(p.id).length ? ` <span class="pilot-flag" title="Pilotada por ${esc(approvedPilotIds(p.id).map((i) => displayName(memberById(i))).join(', '))}">🧑‍✈️</span>` : ''}</div>${bare ? `<div class="chip-class">${esc(CLASS[p.build.char_class]?.label || 'Sem classe')}</div>` : `<div class="chip-stats">${stats}</div>`}</div>
      ${removable ? `<button class="chip-x" data-unassign="${esc(p.id)}" title="Tirar do time" aria-label="Tirar ${esc(p.name)} do time">×</button>` : ''}
    </div>`;
  }

  function avg(people, key) {
    const vals = people.map((p) => p.build[key]).filter(Number.isFinite);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  function total(people, key) {
    const vals = people.map((p) => p.build[key]).filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }
  // Preferência "Média", "Totalizador" ou "Ocultar" nos times (fica lembrada neste navegador)
  let aggPref = 'avg';
  try { const v = localStorage.getItem('team-agg'); aggPref = v === 'sum' || v === 'hide' ? v : 'avg'; } catch { /* ignora */ }
  const aggMode = () => aggPref;
  function setAggMode(v) { aggPref = v; try { localStorage.setItem('team-agg', v); } catch { /* ignora */ } }

  function teamFoot(people) {
    const sum = aggMode() === 'sum';
    return `<div class="team-foot"><div class="avg-title">${sum ? 'Total do time' : 'Média do time'}</div><div class="avg-grid">
      ${ATTRS.map((a) => `<span title="${esc(a.label)} (${sum ? 'soma' : 'média'})"><small>${a.short}</small><b>${fmtNum(sum ? total(people, a.key) : avg(people, a.key))}</b></span>`).join('')}
    </div></div>`;
  }

  // Última alteração de cada sala feita pela staff (o histórico vem do mais novo para o mais antigo)
  function lastRoomEdits(log) {
    const out = {};
    (log || []).forEach((x) => {
      if ((x.kind === 'room' || x.kind === 'rename') && x.room && !out[x.room] && ['officer', 'leader'].includes(memberById(x.actor)?.role)) out[x.room] = x;
    });
    return out;
  }
  const editTag = (x) => (x ? `<div class="team-edit" title="Último oficial ou líder a alterar esta sala">✎ ${esc(nameOf(x.actor))} · ${esc(fmtShortDate(x.at))} ${esc(fmtTime(x.at))}</div>` : '');

  function teamCard(name, people, { editable = false, sel = null, showFoot = true, bare = false, renameIndex = null, edits = null } = {}) {
    const hide = bare || aggMode() === 'hide';
    const mineHere = people.some((p) => p.id === actingId());
    const empties = editable ? Array.from({ length: TEAM_SIZE - people.length }, () => '<div class="slot-empty">vazio</div>').join('') : '';
    return `<div class="team${mineHere ? ' mine' : ''}${people.length >= TEAM_SIZE ? ' full' : ''}${editable && sel ? ' target' : ''}" data-team="${esc(name)}">
      <div class="team-head"><strong>${esc(name)}${renameIndex !== null ? ` <button type="button" class="team-rename" data-rename="${renameIndex}" title="Renomear este time" aria-label="Renomear ${esc(name)}">✏️</button>` : ''}</strong><span class="muted small">${people.some((p) => p.discord) ? `<span class="dc-count" title="Integrantes no Discord">🎧 ${people.filter((p) => p.discord).length}</span> · ` : ''}${people.length}/${TEAM_SIZE}</span></div>
      ${edits ? editTag(edits[name]) : ''}
      <div class="team-slots">${people.map((p) => chip(p, { draggable: editable, removable: editable, selected: sel === p.id, compact: true, bare: hide, medals: true })).join('')}${empties}</div>
      ${people.length && showFoot && !hide ? teamFoot(people) : ''}
    </div>`;
  }

  function teamsHtml(ev, people, slots, opts = {}) {
    const byTeam = (t) => people.filter((p) => slots.get(p.id) === t);
    if (ev.team_format === 'guerra') {
      return WAR_GROUPS.map((g) => `<div class="team-group"><h3>${esc(g)}</h3><div class="teams-grid g3">
        ${[1, 2, 3].map((n) => teamCard(`${g} ${n}`, byTeam(`${g} ${n}`), opts)).join('')}</div></div>`).join('');
    }
    const names = teamNames(ev);
    const shown = names.map((t, i) => [t, i]).filter(([t]) => opts.editable || byTeam(t).length);
    return `<div class="teams-grid">${shown.map(([t, i]) => teamCard(t, byTeam(t), { ...opts, renameIndex: opts.renamable ? i : null })).join('')}</div>`;
  }

  function teamsText(ev, people, slots) {
    const lines = [`**${ev.title}** — ${fmtDay(ev.starts_at)} às ${fmtTime(ev.starts_at)} (${FORMAT_LABEL[ev.team_format] || ''})`];
    teamNames(ev).forEach((t) => {
      const ps = people.filter((p) => slots.get(p.id) === t);
      if (ps.length) lines.push(`__${t}__ (${ps.length}/${TEAM_SIZE}): ${ps.map((p) => `${p.name} (${CLASS[p.build.char_class]?.label || '?'})${p.discord ? ' 🎧' : ''}`).join(', ')}`);
    });
    const out = people.filter((p) => !slots.has(p.id));
    if (out.length) lines.push(`Sem time (${out.length}): ${out.map((p) => p.name).join(', ')}`);
    return lines.join('\n');
  }

  // ---------- Histórico de alterações do evento (líder e oficiais) ----------
  const closeLabel = (m) => RSVP_CLOSE_OPTIONS.find(([v]) => v === (m ?? null))?.[1] || (m == null ? 'Sem prazo' : `${m} min antes`);
  const whenLabel = (iso) => `${fmtShortDate(iso)} ${fmtTime(iso)}`;
  function eventLogLine(x) {
    const d = x.detail || {};
    const who = (ids) => ids.map((u) => `<b>${esc(nameOf(u))}</b>`).join(', ');
    if (x.kind === 'created') return '🆕 Criou o evento';
    if (x.kind === 'lock') return '🔒 Travou os times';
    if (x.kind === 'unlock') return '🔓 Destravou os times';
    if (x.kind === 'rename') return `✏️ Renomeou o time <b>${esc(d.from)}</b> para <b>${esc(d.to)}</b>`;
    if (x.kind === 'format') {
      const [fo, fn] = d.format || []; const [, cn] = d.count || [];
      return `⚔ Formato dos times: ${esc(FORMAT_LABEL[fo] || 'nenhum')} → <b>${esc(FORMAT_LABEL[fn] || 'nenhum')}</b>${fn === 'rito' && cn ? ` (${cn} times)` : ''}`;
    }
    if (x.kind === 'edit') {
      const parts = [];
      if (d.title) parts.push(`nome “${esc(d.title[0])}” → “${esc(d.title[1])}”`);
      if (d.starts_at) parts.push(`data ${esc(whenLabel(d.starts_at[0]))} → ${esc(whenLabel(d.starts_at[1]))}`);
      if (d.type_id) parts.push(`tipo ${esc(typeName(d.type_id[0]) || '—')} → ${esc(typeName(d.type_id[1]) || '—')}`);
      if (d.rsvp_close_minutes) parts.push(`prazo para responder ${esc(closeLabel(d.rsvp_close_minutes[0]))} → ${esc(closeLabel(d.rsvp_close_minutes[1]))}`);
      if (d.description) parts.push('descrição');
      return `📝 Editou o evento: ${parts.join(' · ')}`;
    }
    if (x.kind === 'room') {
      const bits = [];
      if (d.added?.length) bits.push(`<span class="c-yes">entrou</span> ${who(d.added)}`);
      if (d.removed?.length) bits.push(`<span class="c-no">saiu</span> ${who(d.removed)}`);
      return `🛡 <b>${esc(x.room)}</b>: ${bits.join(' · ')}${d.auto ? ' <span class="muted">(marcou “Não vou” ou teve a saída aceita)</span>' : ''}`;
    }
    return esc(x.kind);
  }
  // Quem criou o evento (só a liderança vê). Se veio de uma solicitação aprovada pelo líder, mostra quem pediu.
  function eventCreatorText(ev) {
    if (!ev.created_by && !ev.created_at) return '';
    const req = (perms.requests || []).find((r) => r.method === 'createEvents' && r.status === 'approved'
      && (Array.isArray(r.args?.[0]) ? r.args[0] : []).some((x) => x?.title === ev.title && Date.parse(x?.starts_at) === Date.parse(ev.starts_at)));
    const who = ev.created_by ? nameOf(ev.created_by) : 'Desconhecido';
    const role = ROLE_LABEL[memberById(ev.created_by)?.role];
    return `Criado por <b>${esc(who)}</b>${role ? ` <span class="muted">(${esc(role)})</span>` : ''}`
      + `${req && req.requested_by !== ev.created_by ? ` a pedido de <b>${esc(nameOf(req.requested_by))}</b>` : ''}`
      + `${ev.created_at ? ` · ${esc(fmtWhen(ev.created_at))}` : ''}`;
  }
  function openEventLog(ev, log) {
    // Junta o que a mesma pessoa fez no mesmo momento (ex.: salvar várias salas de uma vez)
    const blocks = [];
    (log || []).forEach((x) => {
      const last = blocks[blocks.length - 1];
      if (last && last.actor === x.actor && Math.abs(Date.parse(last.at) - Date.parse(x.at)) < 5000) last.items.push(x);
      else blocks.push({ actor: x.actor, at: x.at, items: [x] });
    });
    const actorLabel = (id) => {
      if (!id) return '<b>Sistema</b>';
      const p = memberById(id);
      return `<b>${esc(nameOf(id))}</b>${p ? ` <span class="muted small">(${esc(ROLE_LABEL[p.role] || p.role)})</span>` : ''}`;
    };
    openDialog(`<div class="stack ev-log">
        <h2>🕘 Histórico de alterações</h2>
        <p class="muted small" style="margin:0">${esc(ev.title)} · ${esc(fmtDay(ev.starts_at))}. Quem alterou o evento e cada sala, do mais recente para o mais antigo.</p>
        ${eventCreatorText(ev) ? `<p class="small ev-creator" style="margin:0">🆕 ${eventCreatorText(ev)}</p>` : ''}
        ${blocks.length ? `<div class="ev-log-list">${blocks.map((b) => `<div class="ev-log-item">
            <div class="ev-log-head">${actorLabel(b.actor)} <span class="muted small">· ${esc(fmtWhen(b.at))}</span></div>
            <ul>${b.items.map((x) => `<li>${eventLogLine(x)}</li>`).join('')}</ul>
          </div>`).join('')}</div>`
          : '<p class="muted">Nenhuma alteração registrada ainda. O histórico conta a partir de quando ele foi ativado no site.</p>'}
        <div class="row end"><button type="button" class="btn ghost" data-close>Fechar</button></div>
      </div>`, () => {});
  }

  // ---------- Detalhe do evento ----------

  // Resultado da guerra na página do evento (todos veem; observações só a liderança)
  function resultCard(ev, r) {
    const canEdit = can('results') && hasStarted(ev);
    if (!r) {
      return canEdit ? `<div class="card result-card empty-res row">
          <span>⚔ Como foi? Registre o resultado deste evento.</span>
          <span class="spacer"></span><button class="btn small primary" id="btn-result">🏆 Registrar resultado</button></div>` : '';
    }
    const win = r.outcome === 'win';
    const hasScore = r.score_us != null || r.score_them != null;
    return `<div class="card result-card ${win ? 'win' : 'loss'}">
        <div class="row">
          <span class="res-icon" aria-hidden="true">${win ? '🏆' : '💀'}</span>
          <div class="spacer">
            <div class="res-title"><b>${win ? 'Vitória' : 'Derrota'}</b>${r.opponent ? ` <span class="muted">contra</span> <b>${esc(r.opponent)}</b>` : ''}</div>
            ${hasScore ? `<div class="res-score"><span>FOR HONOR</span> <b>${r.score_us ?? '–'}</b> <span class="muted">×</span> <b>${r.score_them ?? '–'}</b> <span>${esc(r.opponent || 'Adversário')}</span></div>` : ''}
          </div>
          ${canEdit ? '<button class="btn small" id="btn-result">Editar resultado</button>' : ''}
        </div>
        ${isOfficer() && r.notes ? `<div class="res-notes"><span class="muted small">📝 Observações · só a liderança vê</span><div style="white-space:pre-line">${esc(r.notes)}</div></div>` : ''}
      </div>`;
  }

  async function openResultDialog(ev, r, reload) {
    const names = await api.opponents().catch(() => []);
    const outcome = r?.outcome || '';
    openDialog(`
      <form id="res-form" class="stack">
        <h2>🏆 Resultado · ${esc(ev.title)}</h2>
        <p class="muted small" style="margin:0">${esc(fmtDay(ev.starts_at))} · ${fmtTime(ev.starts_at)}</p>
        <div class="seg res-outcome" role="radiogroup" aria-label="Resultado">
          <label class="${outcome === 'win' ? 'on' : ''}"><input type="radio" name="res-out" value="win" ${outcome === 'win' ? 'checked' : ''}> 🏆 Vitória</label>
          <label class="${outcome === 'loss' ? 'on' : ''}"><input type="radio" name="res-out" value="loss" ${outcome === 'loss' ? 'checked' : ''}> 💀 Derrota</label>
        </div>
        <div class="field">
          <label for="res-opp">Clã adversário <span class="muted small">(opcional)</span></label>
          <input id="res-opp" maxlength="60" list="res-opp-list" value="${esc(r?.opponent || '')}" placeholder="Nome do clã" autocomplete="off">
          <datalist id="res-opp-list">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        </div>
        <div class="field">
          <label>Placar <span class="muted small">(opcional)</span></label>
          <div class="row res-score-in">
            <input type="number" id="res-us" min="0" step="1" inputmode="numeric" placeholder="Nós" aria-label="Pontos do FOR HONOR" value="${r?.score_us ?? ''}">
            <span class="muted">×</span>
            <input type="number" id="res-them" min="0" step="1" inputmode="numeric" placeholder="Eles" aria-label="Pontos do adversário" value="${r?.score_them ?? ''}">
          </div>
        </div>
        <div class="field">
          <label for="res-notes">Observações <span class="muted small">(opcional; só a liderança vê)</span></label>
          <textarea id="res-notes" maxlength="1000" placeholder="O que funcionou, o que melhorar…">${esc(r?.notes || '')}</textarea>
        </div>
        <p class="le-msg small bad" id="res-msg" hidden></p>
        <div class="row end">
          ${r ? '<button type="button" class="btn ghost danger" id="res-del">Tirar resultado</button><span class="spacer"></span>' : ''}
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Salvar</button>
        </div>
      </form>`, (d) => {
      const msg = (t) => { const m = $('#res-msg', d); m.hidden = !t; m.textContent = t || ''; };
      d.querySelectorAll('input[name=res-out]').forEach((i) => i.addEventListener('change', () => {
        d.querySelectorAll('.res-outcome label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      }));
      $('#res-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const out = d.querySelector('input[name=res-out]:checked')?.value;
        if (!out) { msg('Escolha Vitória ou Derrota.'); return; }
        const us = $('#res-us', d).value; const them = $('#res-them', d).value;
        if ([us, them].some((v) => v !== '' && !(Number(v) >= 0 && Number.isInteger(Number(v))))) { msg('O placar precisa ser um número inteiro (0 ou mais).'); return; }
        const b = $('button[type=submit]', d); b.disabled = true; msg('');
        try {
          await api.saveResult(ev.id, { outcome: out, opponent: $('#res-opp', d).value, score_us: us, score_them: them, notes: $('#res-notes', d).value });
          dlg.close(); toast('Resultado salvo'); await reload();
        } catch (err) { b.disabled = false; if (err instanceof PendingApproval) fail(err); else msg(err?.message || String(err)); }
      });
      $('#res-del', d)?.addEventListener('click', async () => {
        dlg.close();
        if (!(await confirmDialog('Tirar o resultado deste evento? As observações também saem.', 'Tirar resultado'))) return;
        try { await api.deleteResult(ev.id); toast('Resultado removido'); await reload(); } catch (err) { fail(err); }
      });
    });
  }

  async function viewEvent(id) {
    loading();
    const [ev, result] = await Promise.all([api.event(id), api.eventResult(id).catch(() => null)]);
    if (!ev) { main.innerHTML = `<div class="card empty">Evento não encontrado (talvez tenha sido apagado).<br><br>${backBtn('#/', 'Voltar')}</div>`; return; }
    const byId = Object.fromEntries(state.members.map((m) => [m.id, m]));
    const sortX = (a, b) => byName(a.p, b.p);
    const withP = (r) => ({ p: byId[r.user_id], r });
    const yes = ev.rsvps.filter((r) => r.going).map(withP).filter((x) => x.p).sort(sortX);
    const no = ev.rsvps.filter((r) => !r.going).map(withP).filter((x) => x.p).sort(sortX);
    const responded = new Set(ev.rsvps.map((r) => r.user_id));
    const none = activePlayers().filter((m) => !responded.has(m.id)).map((p) => ({ p })).sort(sortX);
    const onDiscord = yes.filter((x) => x.r.discord);
    const list = (arr, withClass) => (arr.length
      ? `<ul class="people">${arr.map((x) => {
        // Quando um piloto respondeu pela conta, mostra quem foi
        const by = x.r?.answered_by && x.r.answered_by !== x.p.id ? memberById(x.r.answered_by) : null;
        const note = x.r?.absence_id && !x.r.going ? '✈️ ausência programada' : by ? `respondido por ${displayName(by)}` : '';
        return personLine(x.p, withClass ? buildFor(x.r, x.p) : null, withClass && x.r?.discord, note);
      }).join('')}</ul>`
      : '<p class="muted small">Ninguém</p>');

    const slots = new Map((ev.team_slots || []).map((s) => [s.user_id, s.team]));
    const people = goingPeople(ev);
    const officer = isOfficer();
    const mine = myTeam(ev);
    // Oficiais veem todos os times; membro comum vê só o próprio (sem totais e sem copiar)
    const showTeams = officer ? ev.team_format && slots.size > 0 : !!mine;
    // Histórico de alterações (líder e oficiais): quem mexeu em cada sala por último
    const log = officer ? await api.eventLog(ev.id).catch((e) => { console.warn('histórico do evento', e); return []; }) : [];
    const edits = lastRoomEdits(log);

    // Resumo da presença real (oficiais)
    let attendanceBox = '';
    if (can('attendance') && hasStarted(ev)) {
      const att = ev.attendance || [];
      if (att.length) {
        const present = att.filter((a) => a.present).length;
        const noShow = yes.filter((x) => !att.find((a) => a.user_id === x.p.id && a.present)).length;
        attendanceBox = `<div class="card attend-sum row">
          <span>📋 Presença registrada: <b class="c-yes">${present}</b> compareceram${noShow ? ` · <b class="c-no">${noShow}</b> confirmaram e faltaram` : ''}</span>
          <span class="spacer"></span><button class="btn small" id="btn-attend">Editar presença</button></div>`;
      } else {
        attendanceBox = `<div class="card attend-sum warn row">
          <span>O evento já começou. Registre quem realmente compareceu para calcular a frequência.</span>
          <span class="spacer"></span><button class="btn small primary" id="btn-attend">📋 Registrar presença</button></div>`;
      }
    }

    // Pedidos de saída (oficiais e líder decidem)
    const requests = can('withdraw_decide') ? ev.rsvps.filter((r) => r.going && r.withdraw_requested_at).map(withP).filter((x) => x.p) : [];
    const wdBox = requests.length ? `<div class="card withdraw-box">
        <h3>⚠ Pedidos de saída (${requests.length})</h3>
        ${requests.map(({ p, r }) => `<div class="wd-row">
          ${avatar(p)}
          <div class="wd-info"><b>${esc(displayName(p))}</b>${slots.get(p.id) ? ` <span class="muted small">· 🛡 ${esc(slots.get(p.id))}</span>` : ''}
            <div class="muted small">“${esc(r.withdraw_reason || 'Sem motivo informado')}” · ${new Date(r.withdraw_requested_at).toLocaleDateString('pt-BR')} ${fmtTime(r.withdraw_requested_at)}</div></div>
          <button class="btn small danger" data-wd-accept="${esc(p.id)}" title="Marca como “Não vou” e tira do time">Aceitar saída</button>
          <button class="btn small ghost" data-wd-keep="${esc(p.id)}" title="Recusa o pedido; o membro continua confirmado">Manter</button>
        </div>`).join('')}
      </div>` : '';

    const finished = !isOpen(ev);
    const resultBox = resultCard(ev, result);
    main.innerHTML = `
      ${backRow(finished ? '#/passados' : '#/', finished ? 'Voltar aos eventos passados' : 'Voltar')}
      <div class="card stack">
        <div class="row">
          <div class="spacer">
            <h1>${esc(ev.title)}</h1>
            <div class="muted">${esc(fmtDay(ev.starts_at))} · ${fmtTime(ev.starts_at)}${typeName(ev.type_id) ? ` · <span class="type-tag">${esc(typeName(ev.type_id))}</span>` : ''}</div>
            ${officer && eventCreatorText(ev) ? `<div class="small ev-creator" title="Só a liderança vê">🆕 ${eventCreatorText(ev)}</div>` : ''}
            ${deadlineTag(ev) || ev.teams_locked ? `<div class="row" style="gap:8px;margin-top:6px">${deadlineTag(ev)}${ev.teams_locked && isOpen(ev) ? '<span class="badge lock">🔒 Times travados</span>' : ''}</div>` : ''}
          </div>
          ${isOpen(ev) ? rsvpButtons(ev) : '<span class="muted small">Evento encerrado</span>'}
        </div>
        ${ev.description ? `<div class="desc" style="white-space:pre-line">${esc(ev.description)}</div>` : ''}
        <div class="row">
          <button class="btn small ghost" id="btn-copy">🔗 Copiar link</button>${calBtn(ev)}
          ${isOfficer() ? `<button class="btn small ghost" id="btn-copy-list">📋 Copiar lista</button>
            <button class="btn small ghost" id="btn-history" title="Quem alterou o evento e cada sala">🕘 Histórico de alterações</button>
            <span class="spacer"></span>
            ${can('teams_build') ? `<a class="btn small primary" id="btn-teams" href="#/evento/${ev.id}/times">⚔ ${finished ? 'Revisar times' : 'Montar times'}</a>` : ''}
            ${can('event_edit') ? '<button class="btn small" id="btn-edit">Editar</button>' : ''}
            ${can('event_create') ? '<button class="btn small" id="btn-dup">Repetir na próxima semana</button>' : ''}
            ${can('event_delete') ? '<button class="btn small danger" id="btn-del">Apagar</button>' : ''}` : ''}
        </div>
      </div>
      ${resultBox}
      ${wdBox}
      ${myTeam(ev) ? `<div class="card my-team row">
          <span class="my-team-icon" aria-hidden="true">🛡</span>
          <span>Você está no time <b>${esc(myTeam(ev))}</b>${ev.team_format ? ` <span class="muted">· ${FORMAT_LABEL[ev.team_format]}</span>` : ''}</span>
        </div>` : ''}
      ${attendanceBox}
      ${!showTeams ? '' : officer
        ? `<div class="section-head"><h2>Times · ${FORMAT_LABEL[ev.team_format]}</h2>
            <div class="seg" role="group" aria-label="Mostrar nos times">
              <button class="${aggMode() === 'avg' ? 'on' : ''}" data-agg="avg" title="Média dos atributos de cada time">Média</button>
              <button class="${aggMode() === 'sum' ? 'on' : ''}" data-agg="sum" title="Soma dos atributos de cada time">Totalizador</button>
              <button class="${aggMode() === 'hide' ? 'on' : ''}" data-agg="hide" title="Mostrar só nome e classe de cada membro">Ocultar</button>
            </div>
            <button class="btn small ghost" id="btn-copy-teams">📋 Copiar times</button></div>
          <div id="ev-teams">${teamsHtml(ev, people, slots, { edits })}</div>`
        : `<div class="section-head"><h2>Seu time</h2></div>
          <div class="teams-grid single">${teamCard(mine, people.filter((p) => slots.get(p.id) === mine), { showFoot: false, bare: true })}</div>`}
      ${officer ? `<div class="lists">
        <div class="card"><h3 class="c-yes">✔ Vão (${yes.length})</h3>
          ${yes.length ? `<div class="muted small dc-sum">🎧 ${onDiscord.length} no Discord · ${yes.length - onDiscord.length} sem Discord</div>` : ''}
          ${list(yes, true)}</div>
        <div class="card"><h3 class="c-no">✖ Não vão (${no.length})</h3>${list(no)}</div>
        <div class="card"><h3 class="muted">… Sem resposta (${none.length})</h3>${list(none)}</div>
      </div>` : ''}`;

    bindRsvp(main, [ev], () => viewEvent(id));
    $('#btn-copy').addEventListener('click', () => copy(location.href, 'Link copiado'));
    $('#btn-copy-teams')?.addEventListener('click', () => copy(teamsText(ev, people, slots), 'Times copiados — cole no Discord'));
    $('#btn-history')?.addEventListener('click', () => openEventLog(ev, log));
    const resolve = async (uid, accept) => {
      const p = state.members.find((m) => m.id === uid);
      const msg = accept
        ? `Aceitar a saída de ${displayName(p)}? Ele passa para “Não vou”${slots.get(uid) ? ` e sai do time ${slots.get(uid)}` : ''}.`
        : `Manter ${displayName(p)} confirmado e recusar o pedido de saída?`;
      if (!(await confirmDialog(msg, accept ? 'Aceitar saída' : 'Manter'))) return;
      try { await api.resolveWithdrawal(ev.id, uid, accept); toast(accept ? 'Saída aceita' : 'Pedido recusado'); await viewEvent(id); } catch (e) { fail(e); }
    };
    main.querySelectorAll('[data-wd-accept]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.wdAccept, true)));
    main.querySelectorAll('[data-wd-keep]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.wdKeep, false)));
    // Média / Totalizador (oficiais): redesenha só os times, sem recarregar a página
    main.querySelectorAll('[data-agg]').forEach((b) => b.addEventListener('click', () => {
      setAggMode(b.dataset.agg);
      $('#ev-teams').innerHTML = teamsHtml(ev, people, slots, { edits });
      main.querySelectorAll('[data-agg]').forEach((x) => x.classList.toggle('on', x.dataset.agg === aggMode()));
    }));
    $('#btn-attend')?.addEventListener('click', () => openAttendanceDialog(ev, () => viewEvent(id)));
    $('#btn-result')?.addEventListener('click', () => openResultDialog(ev, result, () => viewEvent(id)));
    if (isOfficer()) {
      $('#btn-copy-list').addEventListener('click', () => {
        const names = (arr) => arr.map((x) => displayName(x.p)).join(', ') || '—';
        const text = `**${ev.title}** — ${fmtDay(ev.starts_at)} às ${fmtTime(ev.starts_at)}\n`
          + `✔ Vão (${yes.length}): ${names(yes)}\n🎧 No Discord (${onDiscord.length}): ${names(onDiscord)}\n`
          + `✖ Não vão (${no.length}): ${names(no)}\n… Sem resposta (${none.length}): ${names(none)}`;
        copy(text, 'Lista copiada — cole no Discord');
      });
      $('#btn-edit')?.addEventListener('click', () => openEventForm(ev));
      // Evento já finalizado: avisa antes de abrir a revisão dos times
      $('#btn-teams')?.addEventListener('click', async (e) => {
        if (!finished) return;
        e.preventDefault();
        if (await confirmDialog('Atenção: este evento já foi finalizado. Você está revisando os times de um evento encerrado; as mudanças alteram o histórico de quem participou de cada time. Continuar?', 'Revisar times')) {
          location.hash = `#/evento/${ev.id}/times`;
        }
      });
      $('#btn-dup')?.addEventListener('click', async () => {
        const d = new Date(ev.starts_at); d.setDate(d.getDate() + 7);
        try {
          await api.createEvents([{ title: ev.title, description: ev.description || null, type_id: ev.type_id ?? null, rsvp_close_minutes: ev.rsvp_close_minutes ?? null, starts_at: d.toISOString(), team_format: ev.team_format, team_count: ev.team_count, ...(ev.team_names?.some(Boolean) ? { team_names: ev.team_names } : {}) }]);
          toast(`Criado para ${d.toLocaleDateString('pt-BR')}`);
        } catch (e) { fail(e); }
      });
      $('#btn-del')?.addEventListener('click', async () => {
        if (!(await confirmDialog(`Apagar “${ev.title}”? As respostas, os times e a presença também serão apagados.`, 'Apagar'))) return;
        try { await api.deleteEvent(ev.id); toast('Evento apagado'); location.hash = '#/'; } catch (e) { fail(e); }
      });
    }
  }

  // ---------- Registro de presença real ----------

  function openAttendanceDialog(ev, after) {
    const rsvp = Object.fromEntries(ev.rsvps.map((r) => [r.user_id, r.going]));
    const att = Object.fromEntries((ev.attendance || []).map((a) => [a.user_id, a.present]));
    const recorded = (ev.attendance || []).length > 0;
    const order = (m) => (rsvp[m.id] === true ? 0 : rsvp[m.id] === undefined ? 1 : 2);
    const members = activePlayers().slice().sort((a, b) => order(a) - order(b) || byName(a, b));
    const initial = (m) => (recorded ? att[m.id] === true : rsvp[m.id] === true);
    const tag = (m) => (rsvp[m.id] === true ? '<span class="c-yes small">confirmou</span>'
      : rsvp[m.id] === false ? '<span class="c-no small">disse que não ia</span>' : '<span class="muted small">sem resposta</span>');

    openDialog(`
      <form id="att-form" class="stack">
        <h2>Presença · ${esc(ev.title)}</h2>
        <p class="muted small" style="margin:0">${esc(fmtDay(ev.starts_at))} às ${fmtTime(ev.starts_at)}. Marque quem <b>realmente compareceu</b>.
          ${recorded ? '' : 'Já deixamos marcado quem confirmou “Vou”; desmarque quem faltou.'}</p>
        <div class="row">
          <input type="search" id="att-search" placeholder="Buscar membro…" style="flex:1;min-width:160px">
          <button type="button" class="btn small ghost" id="att-all" title="Marca todos os membros da lista (com a busca, só os encontrados)">Selecionar todos</button>
          <button type="button" class="btn small ghost" id="att-going">Marcar quem confirmou</button>
          <button type="button" class="btn small ghost" id="att-none">Desmarcar todos</button>
        </div>
        <div class="attend-list">
          ${members.map((m) => `<label class="attend-row" data-name="${esc(displayName(m).toLowerCase())} ${esc((m.google_name || '').toLowerCase())}">
            <input type="checkbox" value="${esc(m.id)}" ${initial(m) ? 'checked' : ''}>
            ${avatar(m)}<span class="name">${esc(displayName(m))}</span>${tag(m)}</label>`).join('')}
        </div>
        <div class="row end">
          <span class="muted small" id="att-count"></span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Salvar presença</button>
        </div>
      </form>`, (d) => {
      const boxes = [...d.querySelectorAll('.attend-row input')];
      const updateCount = () => { $('#att-count', d).textContent = `${boxes.filter((b) => b.checked).length} de ${boxes.length} presentes`; };
      boxes.forEach((b) => b.addEventListener('change', updateCount));
      updateCount();
      $('#att-going', d).addEventListener('click', () => { boxes.forEach((b) => { b.checked = rsvp[b.value] === true; }); updateCount(); });
      $('#att-none', d).addEventListener('click', () => { boxes.forEach((b) => { b.checked = false; }); updateCount(); });
      // Selecionar todos: marca todos os membros (se houver busca, só os que aparecem na lista)
      $('#att-all', d).addEventListener('click', () => { boxes.forEach((b) => { if (!b.closest('.attend-row').hidden) b.checked = true; }); updateCount(); });
      $('#att-search', d).addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        d.querySelectorAll('.attend-row').forEach((r) => { r.hidden = q && !r.dataset.name.includes(q); });
      });
      $('#att-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.saveAttendance(ev.id, boxes.map((b) => ({ user_id: b.value, present: b.checked })));
          dlg.close();
          toast('Presença salva');
          await after();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  // ---------- Painel de frequência (oficiais e líder) ----------

  // type: '' = todos, 'none' = eventos sem tipo, ou o id do tipo
  const F = { days: 30, type: '', sort: 'pct', dir: 1 };

  function computeFrequency(events, members) {
    return members.map((m) => {
      const joined = Date.parse(m.created_at || 0) || 0;
      const row = { m, total: 0, present: 0, confirmed: 0, noShow: 0, declined: 0, noAnswer: 0, last: null, history: [] };
      events.forEach((ev) => {
        if (!ev.attendance.length || Date.parse(ev.starts_at) < joined) return;
        const was = ev.attendance.some((a) => a.user_id === m.id && a.present);
        const r = ev.rsvps.find((x) => x.user_id === m.id);
        if (r?.absence_id && !was) return; // ausência programada: fica fora da frequência
        row.total++;
        if (was) { row.present++; if (!row.last) row.last = ev.starts_at; }
        if (r?.going) row.confirmed++;
        if (r?.going && !was) row.noShow++;
        if (r && !r.going) row.declined++;
        if (!r) row.noAnswer++;
        row.history.push({ ev, was, r });
      });
      row.pct = row.total ? row.present / row.total : null;
      return row;
    });
  }

  async function viewFrequency() {
    if (!can('freq_view')) { location.hash = '#/'; return; }
    loading();
    const since = F.days ? new Date(Date.now() - F.days * 86400000).toISOString() : null;
    const all = await api.history(since);
    const hasUntyped = all.some((e) => !e.type_id);
    if (F.type === 'none' && !hasUntyped) F.type = '';
    const events = all.filter((e) => !F.type || (F.type === 'none' ? !e.type_id : e.type_id === Number(F.type)));
    const typeCount = (id) => all.filter((e) => e.type_id === id).length;
    const filterLabel = !F.type ? 'todos os eventos' : F.type === 'none' ? 'eventos sem tipo' : typeName(Number(F.type));
    const withAtt = events.filter((e) => e.attendance.length);
    const missing = events.filter((e) => !e.attendance.length);
    const rows = computeFrequency(events, activePlayers());

    const dir = F.dir;
    const val = (r) => ({
      name: displayName(r.m).toLowerCase(), pct: r.pct ?? -1, present: r.present, total: r.total,
      noShow: r.noShow, noAnswer: r.noAnswer, last: r.last ? Date.parse(r.last) : 0,
    }[F.sort]);
    rows.sort((a, b) => {
      // Quem ainda não tem eventos contados vai sempre para o fim
      if (!a.total !== !b.total) return a.total ? -1 : 1;
      const x = val(a); const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y;
      return (dir * c) || byName(a.m, b.m);
    });

    const counted = rows.filter((r) => r.total);
    const avgPct = counted.length ? counted.reduce((s, r) => s + r.pct, 0) / counted.length : null;
    const low = counted.filter((r) => r.pct < 0.5).length;
    const totalNoShow = rows.reduce((s, r) => s + r.noShow, 0);
    const pctClass = (p) => (p == null ? 'muted' : p >= 0.75 ? 'c-yes' : p >= 0.5 ? 'c-gold' : 'c-no');
    const pctText = (p) => (p == null ? '—' : `${Math.round(p * 100)}%`);
    const th = (key, label, cls = '') => {
      const arrow = F.sort === key ? (F.dir === 1 ? ' ▲' : ' ▼') : '';
      return `<th class="${cls}"><button class="th-sort" data-sort="${key}">${label}${arrow}</button></th>`;
    };
    // Últimos 8 eventos com presença registrada: ● presente, ○ faltou, – não era membro
    const dots = (r) => withAtt.slice(0, 8).reverse().map((ev) => {
      const h = r.history.find((x) => x.ev.id === ev.id);
      if (!h) return `<span class="dot na" title="${esc(ev.title)} ${fmtShortDate(ev.starts_at)}: ainda não era membro">–</span>`;
      const why = h.was ? 'presente' : h.r?.going ? 'confirmou e faltou' : h.r ? 'avisou que não ia' : 'faltou sem responder';
      return `<span class="dot ${h.was ? 'yes' : h.r?.going ? 'noshow' : 'no'}" title="${esc(ev.title)} ${fmtShortDate(ev.starts_at)}: ${why}"></span>`;
    }).join('');

    main.innerHTML = `
      <div class="page-head">
        <h1>Frequência</h1>
        <div class="row">
          <select class="inline" id="f-days" aria-label="Período">
            ${[[30, 'Últimos 30 dias'], [60, 'Últimos 60 dias'], [90, 'Últimos 90 dias'], [0, 'Todo o histórico']].map(([v, l]) => `<option value="${v}" ${F.days === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <select class="inline" id="fq-type" aria-label="Tipo de evento">
            <option value="">Todos os tipos</option>
            ${state.types.map((t) => `<option value="${t.id}" ${F.type === String(t.id) ? 'selected' : ''}>${esc(t.name)} (${typeCount(t.id)})</option>`).join('')}
            ${hasUntyped ? `<option value="none" ${F.type === 'none' ? 'selected' : ''}>Sem tipo</option>` : ''}
          </select>
          <button class="btn small" id="f-copy">📋 Copiar</button>
        </div>
      </div>

      <div class="stats">
        <div class="card stat"><div class="stat-num">${withAtt.length}</div><div class="muted small">eventos com presença registrada</div></div>
        <div class="card stat"><div class="stat-num ${pctClass(avgPct)}">${pctText(avgPct)}</div><div class="muted small">frequência média do clã</div></div>
        <div class="card stat"><div class="stat-num c-no">${low}</div><div class="muted small">membros abaixo de 50%</div></div>
        <div class="card stat"><div class="stat-num c-gold">${totalNoShow}</div><div class="muted small">vezes que alguém confirmou e faltou</div></div>
      </div>

      ${missing.length ? `<div class="card attend-sum warn">
        <b>${missing.length} evento(s) sem presença registrada</b> (não entram na conta):
        ${missing.map((e) => `<a href="#/evento/${e.id}">${esc(e.title)} ${fmtShortDate(e.starts_at)}</a>`).join(' · ')}
      </div>` : ''}

      ${withAtt.length ? `<div class="card table-wrap">
        <table class="freq">
          <thead><tr>
            ${th('name', 'Membro')}
            ${th('pct', 'Frequência')}
            ${th('present', 'Presenças', 'num')}
            ${th('noShow', 'Confirmou e faltou', 'num')}
            ${th('noAnswer', 'Sem resposta', 'num')}
            <th>Últimos eventos</th>
            ${th('last', 'Última presença')}
          </tr></thead>
          <tbody>
            ${rows.map((r) => `<tr>
              <td><div class="row" style="gap:8px;flex-wrap:nowrap">${avatar(r.m)}<span class="name"><a class="member-link" href="#/membro/${encodeURIComponent(r.m.id)}">${esc(displayName(r.m))}</a>${medalsHtml(r.m.id)}${r.m.char_class ? ` ${classTag(r.m.char_class)}` : ''}</span></div></td>
              <td><div class="pct"><b class="${pctClass(r.pct)}">${pctText(r.pct)}</b><span class="pct-bar"><span class="${pctClass(r.pct)}" style="width:${Math.round((r.pct || 0) * 100)}%"></span></span></div></td>
              <td class="num">${r.present}<span class="muted">/${r.total}</span></td>
              <td class="num ${r.noShow ? 'c-no' : 'muted'}">${r.noShow}</td>
              <td class="num ${r.noAnswer ? '' : 'muted'}">${r.noAnswer}</td>
              <td><div class="dots">${dots(r)}</div></td>
              <td class="muted small">${r.last ? fmtShortDate(r.last) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="muted small">Só contam eventos com presença registrada e posteriores à entrada de cada membro.
        Legenda: <span class="dot yes"></span> presente · <span class="dot noshow"></span> confirmou e faltou · <span class="dot no"></span> faltou (avisou ou não respondeu) · – ainda não era membro.</p>`
      : '<div class="card empty">Nenhum evento com presença registrada neste período.<br><br>Abra um evento que já aconteceu e clique em “Registrar presença”.</div>'}`;

    $('#f-days').addEventListener('change', (e) => { F.days = Number(e.target.value); viewFrequency(); });
    $('#fq-type').addEventListener('change', (e) => { F.type = e.target.value; viewFrequency(); });
    main.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.sort;
      if (F.sort === k) F.dir *= -1; else { F.sort = k; F.dir = k === 'name' ? 1 : -1; }
      viewFrequency();
    }));
    $('#f-copy').addEventListener('click', () => {
      const period = F.days ? `últimos ${F.days} dias` : 'todo o histórico';
      const text = [`**Frequência — ${filterLabel} (${period}, ${withAtt.length} eventos)**`,
        ...rows.filter((r) => r.total).map((r) => `${displayName(r.m)}: ${pctText(r.pct)} (${r.present}/${r.total})${r.noShow ? ` · confirmou e faltou ${r.noShow}x` : ''}`)].join('\n');
      copy(text, 'Frequência copiada');
    });
  }

  // ---------- Painel de montagem de times ----------

  // slots = rascunho atual; orig = o que está salvo no banco
  const T = { ev: null, people: [], slots: new Map(), orig: new Map(), sel: null, sort: 'potency', cls: '' };

  // Alerta: a mesma pessoa controla 2+ contas confirmadas neste evento (dono e/ou piloto)
  function samePilotBanner() {
    const byPerson = new Map();
    T.people.forEach((p) => controllersOf(p.profile).forEach((c) => {
      if (!byPerson.has(c)) byPerson.set(c, []);
      byPerson.get(c).push(p);
    }));
    const multi = [...byPerson].filter(([, accs]) => accs.length > 1);
    if (!multi.length) return '';
    return `<div class="lock-banner warn">🧑‍✈️ <b>Mesmo piloto em mais de uma conta:</b> ${multi.map(([c, accs]) => {
      const where = accs.map((a) => `${esc(a.name)}${T.slots.get(a.id) ? ` <span class="muted">(${esc(T.slots.get(a.id))})</span>` : ''}`).join(', ');
      return `${esc(displayName(memberById(c)))} controla ${accs.length} contas confirmadas: ${where}`;
    }).join(' · ')}. Confira se ele consegue jogar com todas ao mesmo tempo.</div>`;
  }

  async function viewTeams(id) {
    if (!can('teams_build')) { location.hash = `#/evento/${id}`; return; }
    loading();
    const ev = await api.event(id);
    if (!ev) { main.innerHTML = `<div class="card empty">Evento não encontrado.<br><br>${backBtn('#/', 'Voltar')}</div>`; return; }
    T.ev = ev;
    state.pilots = await api.pilots().catch(() => state.pilots || []);
    T.people = goingPeople(ev);
    T.slots = new Map((ev.team_slots || []).map((s) => [s.user_id, s.team]));
    T.orig = new Map(T.slots);
    T.sel = null;
    T.log = await api.eventLog(id).catch((e) => { console.warn('histórico do evento', e); return []; });
    renderTeams();
  }

  function sortedPool() {
    const pool = T.people.filter((p) => !T.slots.has(p.id) && (!T.cls || p.build.char_class === T.cls));
    const n = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
    if (T.sort === 'name') return pool.sort(n);
    if (T.sort === 'class') return pool.sort((a, b) => (a.build.char_class || 'zz').localeCompare(b.build.char_class || 'zz') || n(a, b));
    return pool.sort((a, b) => (b.build[T.sort] ?? -1) - (a.build[T.sort] ?? -1));
  }

  function classSummary() {
    const n = (k) => T.people.filter((p) => p.build.char_class === k).length;
    const parts = CLASSES.filter((c) => n(c.key)).map((c) => `<span>${classTag(c.key)} ${n(c.key)}</span>`);
    return parts.length ? `<div class="class-sum small">${parts.join('')}</div>` : '';
  }

  function renderTeams() {
    const { ev } = T;
    const assigned = T.people.filter((p) => T.slots.has(p.id)).length;
    const pool = sortedPool();
    const capacity = teamNames(ev).length * TEAM_SIZE;
    const finished = !isOpen(ev);

    const head = `
      ${backRow(`#/evento/${ev.id}`, 'Voltar ao evento')}
      ${finished ? '<div class="lock-banner warn finished-banner">⚠ <b>Evento já finalizado.</b> Você está revisando os times de um evento encerrado. O que for salvo aqui altera o histórico de quem participou de cada time.</div>' : ''}
      <div class="page-head">
        <div style="flex:1;min-width:200px">
          <h1 style="margin:0">${finished ? 'Revisar times' : 'Times'} · ${esc(ev.title)}</h1>
          <div class="muted small">${esc(fmtDay(ev.starts_at))} · ${fmtTime(ev.starts_at)} · ${T.people.length} confirmados · ${assigned} em times${capacity ? ` · ${capacity} vagas` : ''}</div>
        </div>
        <div class="row">
          <div class="seg" role="group" aria-label="Formato">
            <button class="${ev.team_format === 'guerra' ? 'on' : ''}" data-format="guerra">Guerra</button>
            <button class="${ev.team_format === 'rito' ? 'on' : ''}" data-format="rito">Outros</button>
          </div>
          ${ev.team_format === 'rito' ? `<label class="inline-label">Times
            <select class="inline" id="rite-count">${Array.from({ length: RITE_MAX }, (_, i) => i + 1).map((n) => `<option ${n === (ev.team_count || RITE_MAX) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
          ${ev.team_format ? `<div class="seg" role="group" aria-label="Mostrar nos times">
              <button class="${aggMode() === 'avg' ? 'on' : ''}" data-agg="avg" title="Média dos atributos de cada time">Média</button>
              <button class="${aggMode() === 'sum' ? 'on' : ''}" data-agg="sum" title="Soma dos atributos de cada time">Totalizador</button>
              <button class="${aggMode() === 'hide' ? 'on' : ''}" data-agg="hide" title="Mostrar só nome e classe de cada membro">Ocultar</button>
            </div>
            <button class="btn small primary" id="btn-suggest" title="Monta uma sugestão de times pela Ressonância">✨ Sugerir times</button>
            <button class="btn small" id="btn-copy-teams">📋 Copiar times</button>
            <button class="btn small ghost danger" id="btn-clear">Limpar</button>
            ${can('teams_lock') ? '' : '<!--'}<button class="btn small ${ev.teams_locked ? 'locked' : ''}" id="btn-lock" title="${ev.teams_locked ? 'Destravar: membros voltam a poder sair sozinhos' : 'Travar: quem está escalado só sai pedindo ao oficial'}">${ev.teams_locked ? '🔒 Travados' : '🔓 Travar times'}</button>${can('teams_lock') ? '' : '-->'}` : ''}
        </div>
      </div>
      ${ev.team_format ? saveBar() : ''}
      ${samePilotBanner()}
      ${ev.teams_locked ? `<div class="lock-banner">🔒 <b>Times travados.</b> Quem está escalado não consegue sair sozinho: precisa enviar um pedido de saída, que aparece na página do evento. Você continua podendo editar os times.</div>` : ''}
      ${T.people.some((p) => p.wd) ? `<div class="lock-banner warn">⚠ ${T.people.filter((p) => p.wd).length} membro(s) pediram para sair. Decida na <a href="#/evento/${ev.id}">página do evento</a>.</div>` : ''}`;

    if (!ev.team_format) {
      main.innerHTML = `${head}<div class="card empty">
        <p>Escolha o formato dos times para este evento:</p>
        <div class="row" style="justify-content:center;gap:16px;margin-top:12px">
          <button class="btn primary big" data-format="guerra">Guerra<small>12 times · Exaltação, Eminência, Renome, Orgulho</small></button>
          <button class="btn primary big" data-format="rito">Outros<small>até 10 times de 8 · nomes editáveis</small></button>
        </div></div>`;
      bindTeamControls();
      return;
    }

    main.innerHTML = `${head}
      <p class="muted small hint">Clique em um membro e depois no time (ou arraste). Para tirar do time, clique no × ou arraste de volta para a lista.${ev.team_format === 'rito' ? ' Para renomear um time (ex.: “Revenge”), clique no ✏️ ao lado do nome.' : ''}</p>
      <div class="tb">
        <aside class="pool card${T.sel && T.slots.has(T.sel) ? ' target' : ''}" id="pool">
          <div class="pool-head">
            <strong>Sem time (${T.people.length - assigned})</strong>
            <div class="row">
              <select class="inline" id="pool-sort" aria-label="Ordenar">
                ${ATTRS.map((a) => `<option value="${a.key}" ${T.sort === a.key ? 'selected' : ''}>${a.label}</option>`).join('')}
                <option value="class" ${T.sort === 'class' ? 'selected' : ''}>Classe</option>
                <option value="name" ${T.sort === 'name' ? 'selected' : ''}>Nome</option>
              </select>
              <select class="inline" id="pool-class" aria-label="Filtrar classe">
                <option value="">Todas as classes</option>
                ${CLASSES.map((c) => `<option value="${c.key}" ${T.cls === c.key ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="pool-list">
            ${pool.map((p) => chip(p, { draggable: true, selected: T.sel === p.id, medals: true })).join('')
              || `<p class="muted small center">${T.people.length ? 'Todos os confirmados já estão em times.' : 'Ninguém confirmou presença ainda.'}</p>`}
          </div>
          ${classSummary()}
        </aside>
        <section class="teams-area">${teamsHtml(ev, T.people, T.slots, { editable: true, sel: T.sel, renamable: ev.team_format === 'rito', edits: lastRoomEdits(T.log) })}</section>
      </div>`;
    // Destaca quem foi movido e ainda não foi salvo
    main.querySelectorAll('.chip[data-uid]').forEach((c) => {
      if ((T.orig.get(c.dataset.uid) ?? null) !== (T.slots.get(c.dataset.uid) ?? null)) c.classList.add('changed');
    });
    bindTeamControls();
  }

  // ---------- Sugestão automática de times ----------
  // A força de cada membro é a Ressonância. Os mais fortes vão para as salas mais altas,
  // e as salas de uma mesma categoria (ex.: Exaltação 1, 2 e 3) ficam equilibradas entre si.

  const SUGGEST_MODES = {
    exaltacao: {
      label: 'Foco Exaltação',
      desc: 'Os mais fortes preenchem as 3 salas de Exaltação; depois Eminência, Renome e Orgulho.',
      rooms: { 'Exaltação': [1, 2, 3], 'Eminência': [1, 2, 3], 'Renome': [1, 2, 3], 'Orgulho': [1, 2, 3] },
    },
    '2x2': {
      label: 'Foco 2/2',
      desc: 'Exaltação 1 e 2 com os mais fortes (Exaltação 3 vazia). Eminência 1 e 2 em seguida (Eminência 3 vazia). Renome e Orgulho completas.',
      rooms: { 'Exaltação': [1, 2], 'Eminência': [1, 2], 'Renome': [1, 2, 3], 'Orgulho': [1, 2, 3] },
    },
    '1exaltacao': {
      label: 'Foco 1 Exaltação',
      desc: 'Os mais fortes só na Exaltação 1 (Exaltação 2 e 3 vazias). Eminência, Renome e Orgulho completas, sempre os mais fortes nas salas mais altas.',
      rooms: { 'Exaltação': [1], 'Eminência': [1, 2, 3], 'Renome': [1, 2, 3], 'Orgulho': [1, 2, 3] },
    },
    equilibrado: {
      label: 'Equilibrado',
      desc: 'Distribui os confirmados entre os times, deixando a Ressonância dos times o mais parecida possível.',
    },
  };

  const resOf = (p) => (Number.isFinite(p.build.resonance) ? p.build.resonance : 0);

  // Divide um grupo (já ordenado do mais forte para o mais fraco) entre salas de mesmo peso,
  // com quantidades iguais (diferença máxima de 1) e somas de Ressonância equilibradas.
  function balanceInto(roomCount, chunk) {
    const size = Array.from({ length: roomCount }, (_, r) => Math.floor(chunk.length / roomCount) + (r < chunk.length % roomCount ? 1 : 0));
    const groups = Array.from({ length: roomCount }, () => []);
    const sum = Array(roomCount).fill(0);
    for (const p of chunk) {
      let best = -1;
      for (let r = 0; r < roomCount; r++) if (groups[r].length < size[r] && (best < 0 || sum[r] < sum[best])) best = r;
      groups[best].push(p); sum[best] += resOf(p);
    }
    // Ajuste fino: troca membros entre a sala mais forte e a mais fraca enquanto reduzir a diferença
    for (let it = 0; it < 500; it++) {
      let hi = 0; let lo = 0;
      for (let r = 1; r < roomCount; r++) { if (sum[r] > sum[hi]) hi = r; if (sum[r] < sum[lo]) lo = r; }
      const diff = sum[hi] - sum[lo];
      if (diff <= 0) break;
      let swap = null; let bestNew = diff;
      for (const a of groups[hi]) {
        for (const b of groups[lo]) {
          const d = resOf(a) - resOf(b);
          if (d > 0 && Math.abs(diff - 2 * d) < bestNew) { bestNew = Math.abs(diff - 2 * d); swap = [a, b, d]; }
        }
      }
      if (!swap) break;
      const [a, b, d] = swap;
      groups[hi][groups[hi].indexOf(a)] = b; groups[lo][groups[lo].indexOf(b)] = a;
      sum[hi] -= d; sum[lo] += d;
    }
    return groups;
  }

  function suggestTeams(modeKey) {
    const pool = [...T.people].sort((a, b) => resOf(b) - resOf(a) || a.name.localeCompare(b.name, 'pt-BR'));
    let tiers;
    if (modeKey === 'equilibrado') {
      const names = teamNames(T.ev);
      tiers = [names.slice(0, Math.max(1, Math.min(names.length, Math.ceil(pool.length / TEAM_SIZE))))];
    } else {
      const m = SUGGEST_MODES[modeKey].rooms;
      tiers = WAR_GROUPS.map((g) => m[g].map((n) => `${g} ${n}`));
    }
    const slots = new Map();
    let i = 0;
    for (const rooms of tiers) {
      if (i >= pool.length) break;
      const chunk = pool.slice(i, i + rooms.length * TEAM_SIZE);
      i += chunk.length;
      balanceInto(rooms.length, chunk).forEach((members, r) => members.forEach((p) => slots.set(p.id, rooms[r])));
    }
    return { slots, left: pool.length - i, noRes: pool.filter((p) => !Number.isFinite(p.build.resonance)).length };
  }

  function openSuggestDialog() {
    const war = T.ev.team_format === 'guerra';
    const modes = war ? ['exaltacao', '2x2', '1exaltacao'] : ['equilibrado'];
    const capacity = (k) => (k === 'equilibrado' ? teamNames(T.ev).length : Object.values(SUGGEST_MODES[k].rooms).flat().length) * TEAM_SIZE;
    openDialog(`
      <form id="sg-form" class="stack">
        <h2>✨ Sugerir times</h2>
        <p class="muted small" style="margin:0">${T.people.length} confirmados. A força de cada membro é a <b>Ressonância</b>.
          ${war ? 'Os mais fortes vão para as salas mais altas, e as salas da mesma categoria ficam equilibradas entre si.' : ''}</p>
        <div class="sg-modes">
          ${modes.map((k, i) => `<label class="sg-mode">
            <input type="radio" name="mode" value="${k}" ${i === 0 ? 'checked' : ''}>
            <span><b>${SUGGEST_MODES[k].label}</b> <span class="muted small">· ${capacity(k)} vagas</span><br><span class="muted small">${SUGGEST_MODES[k].desc}</span></span>
          </label>`).join('')}
        </div>
        <p class="small" style="margin:0">${T.slots.size ? '⚠ A sugestão substitui a distribuição atual do rascunho. ' : ''}Nada é salvo até você revisar e clicar em <b>💾 Salvar</b>.</p>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Aplicar sugestão</button>
        </div>
      </form>`, (d) => {
      $('#sg-form', d).addEventListener('submit', (e) => {
        e.preventDefault();
        const mode = d.querySelector('input[name="mode"]:checked').value;
        const { slots, left, noRes } = suggestTeams(mode);
        T.slots = slots;
        T.sel = null;
        dlg.close();
        renderTeams();
        const rooms = new Set(slots.values()).size;
        toast(`${SUGGEST_MODES[mode].label}: ${slots.size} membros em ${rooms} salas${left ? ` · ${left} sem vaga` : ''}${noRes ? ` · ${noRes} sem Ressonância informada` : ''}. Revise e salve.`);
      });
    });
  }

  function saveBar() {
    const n = dirtyCount();
    return `<div class="savebar${n ? ' dirty' : ''}">
      <span>${n
        ? `⚠ <b>${n}</b> ${n === 1 ? 'alteração não salva' : 'alterações não salvas'}. Os membros só veem os times depois de salvar.`
        : '✔ Tudo salvo. Os membros já veem estes times.'}</span>
      <span class="spacer"></span>
      <button class="btn small ghost" id="btn-discard" ${n ? '' : 'disabled'}>Descartar</button>
      <button class="btn small primary" id="btn-save" ${n ? '' : 'disabled'}>💾 Salvar</button>
    </div>`;
  }

  function dirtyCount() {
    if (!T.ev) return 0;
    const ids = new Set([...T.orig.keys(), ...T.slots.keys()]);
    return [...ids].filter((u) => T.orig.get(u) !== T.slots.get(u)).length;
  }
  const teamsDirty = () => dirtyCount() > 0;

  async function saveTeams() {
    const btn = $('#btn-save');
    if (btn) btn.disabled = true;
    try {
      // Confere se outro oficial salvou mudanças enquanto você editava
      const fresh = await api.event(T.ev.id);
      const server = new Map((fresh.team_slots || []).map((s) => [s.user_id, s.team]));
      const same = server.size === T.orig.size && [...server].every(([u, t]) => T.orig.get(u) === t);
      let who = 'Outro oficial';
      if (!same) {
        const last = (await api.eventLog(T.ev.id).catch(() => [])).find((x) => x.kind === 'room' && x.actor && x.actor !== state.user.id);
        if (last) who = `${nameOf(last.actor)} (às ${fmtTime(last.at)})`;
      }
      if (!same && !(await confirmDialog(`${who} alterou estes times depois que você abriu a página. Salvar agora vai substituir essas alterações. Continuar?`, 'Substituir'))) {
        renderTeams(); return;
      }
      // Quem desmarcou presença nesse meio-tempo fica de fora
      const going = new Set(fresh.rsvps.filter((r) => r.going).map((r) => r.user_id));
      const slots = [...T.slots].filter(([u]) => going.has(u)).map(([user_id, team]) => ({ user_id, team }));
      const dropped = T.slots.size - slots.length;
      await api.saveTeams(T.ev.id, slots);
      toast(dropped ? `Times salvos. ${dropped} membro(s) desmarcaram presença e saíram dos times.` : 'Times salvos!');
      await viewTeams(T.ev.id);
    } catch (e) { fail(e); renderTeams(); }
  }

  // As mudanças ficam só no rascunho até clicar em "Salvar"
  function assign(uid, team) {
    if (T.slots.get(uid) === team) { T.sel = null; renderTeams(); return; }
    const count = [...T.slots.values()].filter((t) => t === team).length;
    if (count >= TEAM_SIZE) { toast(`${team} já está completo (8/8)`, true); return; }
    T.slots.set(uid, team);
    T.sel = null;
    renderTeams();
  }
  function unassign(uid) {
    if (!T.slots.has(uid)) return;
    T.slots.delete(uid);
    T.sel = null;
    renderTeams();
  }

  // Formato "Outros": renomear um time (vale na hora; quem está no time continua nele)
  function openRenameTeam(index) {
    if (teamsDirty()) { toast('Salve ou descarte as alterações antes de renomear um time', true); return; }
    const current = customTeamName(T.ev, index);
    openDialog(`
      <form id="rn-form" class="stack">
        <h2>Renomear time</h2>
        <div class="field">
          <label for="rn-name">Nome do time</label>
          <input id="rn-name" maxlength="${TEAM_NAME_MAX}" value="${esc(T.ev.team_names?.[index] || '')}" placeholder="Time ${index + 1}" autocomplete="off">
          <div class="muted small field-hint">Ex.: o nome de um clã, como “Revenge”. Deixe vazio para voltar a “Time ${index + 1}”. Até ${TEAM_NAME_MAX} caracteres.</div>
        </div>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Salvar nome</button>
        </div>
      </form>`, (d) => {
      const input = $('#rn-name', d);
      input.focus(); input.select();
      $('#rn-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        const next = customTeamName({ team_names: Object.assign([], T.ev.team_names, { [index]: name || null }) }, index);
        if (next === current) { dlg.close(); return; }
        if (teamNames(T.ev).some((t, i) => i !== index && norm(t) === norm(next))) { toast('Já existe um time com esse nome', true); return; }
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.renameTeam(T.ev.id, index, name);
          dlg.close();
          toast(`Time renomeado para “${next}”`);
          await viewTeams(T.ev.id);
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  async function changeFormat(format, count) {
    const ev = T.ev;
    const newCount = count ?? ev.team_count ?? RITE_MAX;
    if (format === ev.team_format && newCount === ev.team_count) return;
    if (teamsDirty()) {
      if (!(await confirmDialog('Você tem alterações não salvas nos times. Mudar o formato ou a quantidade de times descarta essas alterações. Continuar?', 'Continuar'))) { renderTeams(); return; }
      T.slots = new Map(T.orig);
    }
    let drop = null; // null = apagar todos
    if (format === ev.team_format) {
      const keep = new Set(teamNames({ ...ev, team_count: newCount }));
      drop = teamNames(ev).filter((t) => !keep.has(t));
      const affected = [...T.slots.values()].filter((t) => drop.includes(t)).length;
      if (affected && !(await confirmDialog(`${affected} membro(s) estão nos times que serão removidos e voltarão para “Sem time”. Continuar?`, 'Continuar'))) { renderTeams(); return; }
    } else if (T.slots.size && !(await confirmDialog(`Trocar para ${FORMAT_LABEL[format]} desfaz os times atuais (${T.slots.size} membros voltam para “Sem time”). Continuar?`, 'Trocar'))) {
      renderTeams(); return;
    }
    try {
      if (drop === null) { if (T.slots.size) await api.removeTeams(ev.id, null); } else if (drop.length) await api.removeTeams(ev.id, drop);
      await api.updateEvent(ev.id, { team_format: format, team_count: newCount, ...(format !== ev.team_format && ev.team_names ? { team_names: null } : {}) });
      await viewTeams(ev.id);
    } catch (e) { fail(e); }
  }

  function bindTeamControls() {
    main.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => changeFormat(b.dataset.format)));
    $('#rite-count')?.addEventListener('change', (e) => changeFormat('rito', Number(e.target.value)));
    $('#pool-sort')?.addEventListener('change', (e) => { T.sort = e.target.value; renderTeams(); });
    $('#pool-class')?.addEventListener('change', (e) => { T.cls = e.target.value; renderTeams(); });
    $('#btn-copy-teams')?.addEventListener('click', () => copy(teamsText(T.ev, T.people, T.slots), 'Times copiados — cole no Discord'));
    $('#btn-clear')?.addEventListener('click', async () => {
      if (!T.slots.size) return;
      if (!(await confirmDialog('Tirar todos os membros dos times? (Só vale depois de clicar em Salvar.)', 'Limpar'))) return;
      T.slots.clear(); T.sel = null; renderTeams();
    });
    $('#btn-save')?.addEventListener('click', saveTeams);
    main.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openRenameTeam(Number(b.dataset.rename)); }));
    $('#btn-suggest')?.addEventListener('click', openSuggestDialog);
    $('#btn-lock')?.addEventListener('click', async () => {
      if (teamsDirty()) { toast('Salve ou descarte as alterações antes de travar/destravar os times', true); return; }
      const lock = !T.ev.teams_locked;
      const msg = lock
        ? 'Travar os times? Quem está escalado não poderá mais sair sozinho: terá que enviar um pedido de saída para os oficiais.'
        : 'Destravar os times? Os membros escalados voltam a poder mudar a resposta sozinhos (se o prazo ainda estiver aberto).';
      if (!(await confirmDialog(msg, lock ? 'Travar' : 'Destravar'))) return;
      try { await api.updateEvent(T.ev.id, { teams_locked: lock }); toast(lock ? 'Times travados' : 'Times destravados'); await viewTeams(T.ev.id); } catch (e) { fail(e); }
    });
    $('#btn-discard')?.addEventListener('click', async () => {
      if (!(await confirmDialog('Descartar as alterações e voltar aos times salvos?', 'Descartar'))) return;
      T.slots = new Map(T.orig); T.sel = null; renderTeams();
    });
    main.querySelectorAll('[data-agg]').forEach((b) => b.addEventListener('click', () => { setAggMode(b.dataset.agg); renderTeams(); }));

    // Clique: seleciona um membro; depois clique no time para colocá-lo lá
    main.querySelectorAll('.chip[data-uid]').forEach((c) => {
      const toggle = (e) => {
        if (e.target.closest('[data-unassign]')) return;
        e.stopPropagation();
        T.sel = T.sel === c.dataset.uid ? null : c.dataset.uid;
        renderTeams();
      };
      c.addEventListener('click', toggle);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } });
      c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.dataset.uid); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
      c.addEventListener('dragend', () => c.classList.remove('dragging'));
    });
    main.querySelectorAll('[data-unassign]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); unassign(b.dataset.unassign); }));

    main.querySelectorAll('.team[data-team]').forEach((t) => {
      t.addEventListener('click', () => { if (T.sel) assign(T.sel, t.dataset.team); });
      t.addEventListener('dragover', (e) => { e.preventDefault(); t.classList.add('over'); });
      t.addEventListener('dragleave', () => t.classList.remove('over'));
      t.addEventListener('drop', (e) => { e.preventDefault(); t.classList.remove('over'); const uid = e.dataTransfer.getData('text/plain'); if (uid) assign(uid, t.dataset.team); });
    });
    const pool = $('#pool');
    if (pool) {
      pool.addEventListener('click', () => { if (T.sel && T.slots.has(T.sel)) unassign(T.sel); });
      pool.addEventListener('dragover', (e) => { e.preventDefault(); pool.classList.add('over'); });
      pool.addEventListener('dragleave', () => pool.classList.remove('over'));
      pool.addEventListener('drop', (e) => { e.preventDefault(); pool.classList.remove('over'); const uid = e.dataTransfer.getData('text/plain'); if (uid) unassign(uid); });
    }
  }

  // ---------- Membros ----------

  // ---------- Histórico de alterações ----------

  const FIELD_LABEL = {
    game_name: 'Nome do personagem', google_name: 'Nome na conta Google', char_class: 'Classe',
    ...Object.fromEntries(ATTRS.map((a) => [a.key, a.label])),
    pilot_only: 'Tipo de conta',
  };
  const isAttr = (f) => ATTRS.some((a) => a.key === f);
  function fmtField(f, v) {
    if (f === 'pilot_only') return v ? 'Membro piloto' : 'Jogador';
    if (v === null || v === undefined || v === '') return '—';
    if (f === 'char_class') return CLASS[v]?.label || String(v);
    if (isAttr(f)) return fmtNum(Number(v));
    return String(v);
  }

  function histItemsHtml(entries) {
    return entries.slice().sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).map((h) => {
      const lines = Object.keys(FIELD_LABEL).filter((f) => Array.isArray(h.changes?.[f])).map((f) => {
        const [o, n] = h.changes[f];
        const delta = isAttr(f) && o !== null && n !== null ? Number(n) - Number(o) : null;
        const deltaTxt = delta ? ` <span class="${delta > 0 ? 'c-yes' : 'c-no'} small">(${delta > 0 ? '+' : ''}${fmtNum(delta)})</span>` : '';
        return `<li><span class="muted">${FIELD_LABEL[f]}:</span> <s>${esc(fmtField(f, o))}</s> → <b>${esc(fmtField(f, n))}</b>${deltaTxt}</li>`;
      }).join('');
      // Alteração feita por outra pessoa (ex.: oficial trocou o nick): mostra quem
      const by = h.changed_by && h.changed_by !== h.user_id ? ` · por ${esc(nameOf(h.changed_by))}` : '';
      return `<div class="hist-item"><div class="hist-date">${esc(new Date(h.changed_at).toLocaleDateString('pt-BR'))} · ${fmtTime(h.changed_at)}${by}</div><ul>${lines}</ul></div>`;
    }).join('');
  }

  // ---------- Editar o nick de um membro (oficiais e líder) ----------
  // Oficial: membros, quem aguarda aprovação e ex-membros. Líder: qualquer um. O próprio nick: em "Editar perfil".
  const canRename = (m) => !!m && m.id !== state.user.id
    && (isLeader() || (can('member_rename') && ['pending', 'member', 'former'].includes(m.role)));
  function openRenameDialog(m, after) {
    openDialog(`<form id="rn" class="stack">
      <h2>Editar nick</h2>
      <p class="muted small" style="margin:0">Nome que aparece no site para <b>${esc(displayName(m))}</b>${m.google_name ? ` (conta Google: ${esc(m.google_name)})` : ''}.
        A troca fica no histórico do membro, com o seu nome.</p>
      <div class="field">
        <label for="rn-name">Nick / nome do personagem</label>
        <input id="rn-name" maxlength="40" required value="${esc(m.game_name || '')}" placeholder="${esc(m.google_name || 'Nome no jogo')}">
      </div>
      <div class="row end">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary">Salvar</button>
      </div>
    </form>`, (d) => {
      const input = $('#rn-name', d);
      input.focus(); input.select();
      $('#rn', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = input.value.trim();
        if (!name) { toast('Escreva o nick', true); return; }
        if (name === (m.game_name || '')) { dlg.close(); return; }
        const btn = $('button[type=submit]', d);
        btn.disabled = true;
        try {
          await api.renameMember(m.id, name);
          dlg.close();
          toast(`Nick alterado para “${name}”`);
          await after?.();
        } catch (err) { fail(err); btn.disabled = false; }
      });
    });
  }

  // ---------- Tipo de conta: Jogador × Membro piloto (staff) ----------
  // Líder: qualquer conta. Oficial com a permissão "Gerenciar pilotos de contas": membros e quem aguarda aprovação.
  const canChangeKind = (m) => !!m && isOfficer() && m.id !== state.user.id && !m.managed && m.role !== 'former'
    && (isLeader() || (can('pilots') && ['pending', 'member'].includes(m.role)));
  function openKindDialog(m, after) {
    const toPilot = !isPilotOnly(m);
    const who = esc(displayName(m));
    const pilotsOfIt = approvedPilotIds(m.id).map((id) => displayName(memberById(id)));
    openDialog(`<form id="kd" class="stack">
      <h2>${toPilot ? `Tornar ${who} membro piloto` : `Tornar ${who} jogador`}</h2>
      ${toPilot ? `<p style="margin:0">${who} passa a ser <b>🧑‍✈️ membro piloto</b>: não tem conta própria no jogo, só pilota contas de outros membros.</p>
        <ul class="kd-list small">
          <li>Sai do rank de força, da média do clã e da frequência (contam só as contas que ele pilota).</li>
          <li>As respostas e vagas da própria conta nos próximos eventos são retiradas.</li>
          ${pilotsOfIt.length ? `<li><b>${esc(pilotsOfIt.join(', '))}</b> ${pilotsOfIt.length === 1 ? 'deixa' : 'deixam'} de pilotar a conta de ${who}.</li>` : ''}
          <li>Classe e atributos ficam guardados: se ele voltar a ser jogador, voltam a contar.</li>
        </ul>
        <div class="field">
          <label for="kd-note">Qual conta ele pilota <span class="muted small">(opcional)</span></label>
          <input id="kd-note" maxlength="200" value="${esc(m.pilot_note || '')}" placeholder="Nick da conta (ou contas) que ele pilota">
        </div>
        <p class="muted small" style="margin:0">Depois, use <b>+ Vincular conta</b> no perfil dele para ligar as contas que ele pilota.</p>`
        : `<p style="margin:0">${who} volta a ser <b>🎮 jogador</b>, com a própria conta no jogo: volta ao rank, à média do clã e à frequência e responde aos eventos pela própria conta.
          Continua podendo pilotar outras contas.</p>
          ${hasBuild(m) ? '' : '<p class="muted small" style="margin:0">Ele ainda não tem classe e atributos: precisa preencher em Editar perfil para entrar no rank.</p>'}`}
      <p class="muted small" style="margin:0">A mudança fica no histórico de ${who}, com o seu nome.</p>
      <div class="row end">
        <button type="button" class="btn ghost" data-close>Cancelar</button>
        <button type="submit" class="btn primary">${toPilot ? 'Tornar membro piloto' : 'Tornar jogador'}</button>
      </div>
    </form>`, (d) => {
      $('#kd', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', d);
        btn.disabled = true;
        try {
          await api.setMemberKind(m.id, toPilot, toPilot ? $('#kd-note', d).value.trim() : null);
          dlg.close();
          toast(toPilot ? `${displayName(m)} agora é membro piloto` : `${displayName(m)} voltou a ser jogador`);
          state.pilots = await api.pilots().catch(() => state.pilots);
          await after?.();
        } catch (err) { fail(err); btn.disabled = false; }
      });
    });
  }

  function openHistory(m, entries) {
    const items = histItemsHtml(entries);
    openDialog(`<div class="stack">
      <h2>Histórico · ${esc(displayName(m))}</h2>
      <div class="hist">${items || '<p class="muted">Nenhuma alteração registrada.</p>'}</div>
      <div class="row end"><button class="btn primary" data-close>Fechar</button></div></div>`);
  }

  // ---------- Exportação CSV (separado por ";", abre direto no Excel) ----------

  function csvCell(v) {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // evita que o Excel interprete o texto como fórmula
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  async function exportMembersCsv(phones) {
    const days = 90;
    const events = await api.history(new Date(Date.now() - days * 86400000).toISOString());
    const freq = Object.fromEntries(computeFrequency(events, activePlayers()).map((r) => [r.m.id, r]));
    const header = ['Personagem', 'Conta Google', 'Cargo', 'Classe', ...ATTRS.map((a) => a.label), 'Telefone',
      `Frequência ${days} dias`, 'Presenças', 'Eventos contados', 'Confirmou e faltou', 'Sem resposta', 'Membro desde'];
    const rows = state.members.filter((m) => m.role !== 'former')
      .sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || byName(a, b))
      .map((m) => {
        const f = freq[m.id];
        return [m.game_name || '', m.google_name || '', `${ROLE_LABEL[m.role]}${m.pilot_only ? ' (membro piloto)' : ''}`, CLASS[m.char_class]?.label || '',
          ...ATTRS.map((a) => m[a.key] ?? ''), phones[m.id] || '',
          f?.total ? `${Math.round(f.pct * 100)}%` : '', f?.total ? f.present : '', f?.total ?? '', f?.total ? f.noShow : '', f?.total ? f.noAnswer : '',
          m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : ''];
      });
    const csv = `﻿${[header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `membros-${(CFG.clanName || 'cla').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`${rows.length} membros exportados`);
  }

  // ---------- Malah News ----------

  // Aviso de edição nova no menu: compara com a última edição vista neste navegador
  function hasUnreadNews() {
    if (!state.latestNews) return false;
    try { return (localStorage.getItem('news-seen') || '') < state.latestNews; } catch { return false; }
  }
  function markNewsSeen() {
    try { if (state.latestNews) localStorage.setItem('news-seen', state.latestNews); } catch { /* ignora */ }
  }

  // Reduz imagens muito grandes antes do envio (economiza espaço; GIF fica como está para manter a animação)
  // Toda imagem é redesenhada antes do envio: isso reduz o tamanho e APAGA os metadados
  // da foto (EXIF: localização GPS, modelo do celular, data), inclusive em tickets anônimos.
  async function prepareImage(file) {
    const MAX_W = 2000;
    if (file.type === 'image/gif') return file; // GIF não guarda localização; redesenhar perderia a animação
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) throw new Error('Não foi possível ler esta imagem. Use uma imagem JPG, PNG ou WebP.');
    const scale = Math.min(1, MAX_W / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
    let blob = await toBlob('image/webp', 0.9);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.9); // navegadores sem WebP
    if (!blob) throw new Error('Não foi possível preparar esta imagem para envio.');
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `imagem.${ext}`, { type: blob.type });
  }

  async function viewNews() {
    loading();
    const posts = await api.news();
    if (posts[0]) { state.latestNews = posts[0].published_at; markNewsSeen(); renderHeader('news'); }
    const byId = Object.fromEntries(state.members.map((m) => [m.id, m]));
    const officer = can('news_publish');
    const canDel = can('news_delete');
    main.innerHTML = `
      <div class="page-head">
        <h1>Malah News</h1>
        ${officer ? '<button class="btn primary" id="btn-new-news">+ Nova edição</button>' : ''}
      </div>
      ${posts.length ? posts.map((p, i) => `<article class="card news-post${i === 0 ? ' latest' : ''}">
          <div class="news-head">
            <div class="spacer">
              <h2>${esc(p.title)}${i === 0 ? ' <span class="badge gold">Mais recente</span>' : ''}</h2>
              <div class="muted small">${esc(fmtDay(p.published_at))} · ${fmtTime(p.published_at)}${byId[p.author_id] ? ` · por ${esc(displayName(byId[p.author_id]))}` : ''}${p.edited_at ? ' · editado' : ''}</div>
            </div>
            ${officer ? `<button class="btn small ghost" data-news-edit="${p.id}">Editar</button>` : ''}
            ${canDel ? `<button class="btn small ghost danger" data-news-del="${p.id}">Apagar</button>` : ''}
          </div>
          ${p.image_url
            ? `<a class="news-img" href="${esc(p.image_url)}" target="_blank" rel="noopener" title="Abrir no tamanho original">
                <img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="${i < 2 ? 'eager' : 'lazy'}"></a>`
            : '<p class="muted">Imagem indisponível.</p>'}
          ${p.caption ? `<p class="news-caption">${esc(p.caption)}</p>` : ''}
        </article>`).join('')
        : `<div class="card empty">Nenhuma edição publicada ainda.${officer ? '<br><br>Publique a primeira em “+ Nova edição”.' : ''}</div>`}`;

    $('#btn-new-news')?.addEventListener('click', () => openNewsForm());
    main.querySelectorAll('[data-news-edit]').forEach((b) => b.addEventListener('click', () => openNewsForm(posts.find((p) => p.id === Number(b.dataset.newsEdit)))));
    main.querySelectorAll('[data-news-del]').forEach((b) => b.addEventListener('click', async () => {
      const post = posts.find((p) => p.id === Number(b.dataset.newsDel));
      if (!(await confirmDialog(`Apagar a edição “${post.title}”? A imagem também será apagada.`, 'Apagar'))) return;
      try { await api.deleteNews(post); toast('Edição apagada'); state.latestNews = await api.latestNewsAt().catch(() => null); await viewNews(); } catch (e) { fail(e); }
    }));
  }

  // Nova edição (com imagem) ou edição do título/legenda de uma existente
  function openNewsForm(post) {
    const editing = !!post;
    const today = new Date().toLocaleDateString('pt-BR');
    openDialog(`
      <form id="news-form" class="stack">
        <h2>${editing ? 'Editar edição' : 'Nova edição do Malah News'}</h2>
        ${editing ? '' : `<div class="field">
          <label for="news-file">Imagem</label>
          <input id="news-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required>
          <div class="muted small field-hint">PNG, JPG, WEBP ou GIF. Imagens muito grandes são otimizadas automaticamente.</div>
          <img id="news-preview" class="news-preview" alt="" hidden>
        </div>`}
        <div class="field">
          <label for="news-title">Título</label>
          <input id="news-title" maxlength="120" required value="${esc(post?.title || `Malah News — ${today}`)}">
        </div>
        <div class="field">
          <label for="news-caption">Legenda <span class="muted small">(opcional)</span></label>
          <textarea id="news-caption" maxlength="2000" placeholder="Um resumo ou comentário sobre a edição…">${esc(post?.caption || '')}</textarea>
        </div>
        <div class="row end">
          <span class="muted small" id="news-status"></span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${editing ? 'Salvar' : 'Publicar'}</button>
        </div>
      </form>`, (d) => {
      const fileIn = $('#news-file', d);
      fileIn?.addEventListener('change', () => {
        const f = fileIn.files[0];
        const prev = $('#news-preview', d);
        if (prev.src) URL.revokeObjectURL(prev.src);
        if (f) { prev.src = URL.createObjectURL(f); prev.hidden = false; } else prev.hidden = true;
      });
      $('#news-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        const status = $('#news-status', d);
        const title = $('#news-title', d).value.trim();
        const caption = $('#news-caption', d).value.trim();
        if (!title) return;
        submit.disabled = true;
        try {
          if (editing) {
            await api.updateNews(post.id, { title, caption: caption || null });
            toast('Edição atualizada');
          } else {
            const raw = fileIn.files[0];
            if (!raw) { submit.disabled = false; return; }
            status.textContent = 'Preparando imagem…';
            const file = await prepareImage(raw);
            if (file.size > 10 * 1024 * 1024) throw new Error('A imagem passa de 10 MB mesmo depois de otimizada. Use uma imagem menor.');
            status.textContent = 'Enviando…';
            await api.createNews({ file, title, caption });
            state.latestNews = await api.latestNewsAt().catch(() => null);
            toast('Edição publicada!');
          }
          dlg.close();
          await viewNews();
        } catch (err) { fail(err); status.textContent = ''; submit.disabled = false; }
      });
    });
  }

  // =====================================================================
  //  Recrutamentos: membros procurando gente para Grupo Guerreiro, PvP etc.
  //  O membro cria → oficial/líder aprova → candidatos se inscrevem → o criador escolhe.
  // =====================================================================
  state.recruits = [];
  async function loadRecruits() {
    if (!RECRUIT_ON || !isMember()) { state.recruits = []; return; }
    try { state.recruits = await api.recruitments(); } catch (e) { console.warn('recrutamentos', e); state.recruits = []; }
  }
  const recruitApps = (r, status) => (r.applications || []).filter((a) => !status || a.status === status);
  const myApplication = (r) => (r.applications || []).find((a) => a.user_id === state.user.id);
  const isMyRecruit = (r) => r.created_by === state.user.id;
  // Posso fazer isto neste recrutamento? (quem criou sempre; oficiais conforme as Configurações do líder)
  const canOnRecruit = (r, key) => isMyRecruit(r) || can(key);
  const canApproveRecruit = (r) => r.status === 'pending' && (isLeader() || (!isMyRecruit(r) && can('recruit_approve')));
  // Contador no menu: recrutamentos para eu aprovar + candidatos novos nos meus recrutamentos abertos
  function recruitBadge() {
    return (state.recruits || []).reduce((n, r) => n + (canApproveRecruit(r) && !isMyRecruit(r) ? 1 : 0)
      + (isMyRecruit(r) && r.status === 'open' ? recruitApps(r, 'applied').length : 0), 0);
  }
  // Só os campos conhecidos e dentro dos limites (usado no formulário e ao aprovar pedidos)
  function cleanRecruitRow(row) {
    const iso = (v) => (v && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);
    const wanted = {};
    Object.entries(row?.wanted || {}).forEach(([k, n]) => { const v = Math.min(50, Math.max(0, parseInt(n, 10) || 0)); if (CLASS[k] && v) wanted[k] = v; });
    return {
      title: String(row?.title || '').trim().slice(0, 80),
      category: RECRUIT_CAT[row?.category] ? row.category : 'other',
      description: String(row?.description || '').trim().slice(0, 1000) || null,
      slots: Math.min(50, Math.max(1, parseInt(row?.slots, 10) || 1)),
      activity_at: iso(row?.activity_at),
      deadline_at: iso(row?.deadline_at),
      wanted,
    };
  }
  const fmtWhenShort = (iso) => `${fmtShortWeekday(iso)} ${fmtShortDate(iso)} às ${fmtTime(iso)}`;
  function recruitPerson(id) {
    const p = memberById(id);
    return p ? { id: p.id, name: displayName(p), profile: p, build: pick(p, BUILD_KEYS), discord: false } : null;
  }
  // "Procura: 1/2 CRU · 0/1 MON" (aceitos / pedidos de cada classe)
  function wantedLine(r, withAccepted = true) {
    const acc = recruitApps(r, 'accepted').map((a) => memberById(a.user_id)?.char_class);
    const parts = Object.entries(r.wanted || {}).filter(([, n]) => n > 0)
      .map(([k, n]) => `<span class="rc-want">${withAccepted ? `<b>${acc.filter((c) => c === k).length}/${n}</b>` : `${n}×`} ${classTag(k)}</span>`);
    return parts.length ? `<span class="rc-want-list">Procura: ${parts.join('')}</span>` : '';
  }
  function recruitBadges(r) {
    const acc = recruitApps(r, 'accepted').length;
    const mine = myApplication(r);
    const fresh = isMyRecruit(r) && r.status === 'open' ? recruitApps(r, 'applied').length : 0;
    return [
      `<span class="badge rc-cat cat-${esc(r.category)}">${esc(RECRUIT_CAT[r.category]?.label || 'Outro')}</span>`,
      r.status === 'pending' ? '<span class="badge warn">Aguardando aprovação</span>' : '',
      r.status === 'rejected' ? '<span class="badge rc-rejected">Recusado</span>' : '',
      r.status === 'closed' ? '<span class="badge rc-closed">Encerrado</span>' : '',
      r.status === 'open' && acc >= r.slots ? '<span class="badge gold">Completo</span>' : '',
      isMyRecruit(r) ? '<span class="badge rc-mine">Seu recrutamento</span>' : '',
      fresh ? `<span class="badge warn">${fresh} candidato${fresh > 1 ? 's' : ''} aguardando</span>` : '',
      mine?.status === 'applied' ? '<span class="badge rc-mine">Você se candidatou</span>' : '',
      mine?.status === 'accepted' ? '<span class="badge rc-ok">✔ Você foi aceito</span>' : '',
      mine?.status === 'declined' ? '<span class="badge rc-closed">Não selecionado</span>' : '',
    ].join('');
  }
  function recruitMeta(r) {
    const acc = recruitApps(r, 'accepted').length;
    const late = r.deadline_at && Date.parse(r.deadline_at) < Date.now();
    return `<div class="rc-meta">
      <span title="Aceitos / vagas">👥 <b>${acc}/${r.slots}</b> vaga${r.slots > 1 ? 's' : ''}</span>
      ${r.activity_at ? `<span title="Data da atividade">📅 ${esc(fmtWhenShort(r.activity_at))}</span>` : ''}
      ${r.deadline_at ? `<span title="Prazo de inscrição (informativo)" class="${late ? 'muted' : ''}">⏳ Inscrições até ${esc(fmtWhenShort(r.deadline_at))}${late ? ' (prazo passou)' : ''}</span>` : ''}
      ${wantedLine(r)}
    </div>`;
  }
  function recruitCard(r) {
    const cat = RECRUIT_CAT[r.category] || RECRUIT_CAT.other;
    return `<div class="card recruit cat-${esc(r.category)}">
      <div class="rc-icon" aria-hidden="true">${cat.icon}</div>
      <div class="rc-body">
        <a class="title" href="#/recrutamento/${r.id}">${esc(r.title)}</a>
        <div class="rc-badges">${recruitBadges(r)}</div>
        <div class="muted small">Criado por <b>${esc(nameOf(r.created_by))}</b> · ${esc(fmtShortDate(r.created_at))}</div>
        ${recruitMeta(r)}
        ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
        <div class="ev-foot"><a class="btn small ghost" href="#/recrutamento/${r.id}">🔎 Ver recrutamento</a></div>
      </div>
    </div>`;
  }

  let recruitFilter = '';
  async function viewRecruits() {
    renderHeader('recruits');
    const list = state.recruits.filter((r) => !recruitFilter || r.category === recruitFilter);
    const byNew = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at);
    const waiting = list.filter((r) => r.status === 'pending' || (r.status === 'rejected' && isMyRecruit(r))).sort(byNew);
    const open = list.filter((r) => r.status === 'open').sort(byNew);
    const closed = list.filter((r) => r.status === 'closed').sort((a, b) => Date.parse(b.closed_at || b.created_at) - Date.parse(a.closed_at || a.created_at)).slice(0, 10);
    const active = myActiveRecruits();
    const full = active >= LIMITS.recruitsActive;
    main.innerHTML = `
      <div class="page-head"><h1>Recrutamentos</h1><button class="btn primary" id="btn-new-rc"${full ? ` disabled title="Limite de ${LIMITS.recruitsActive} recrutamentos ativos atingido"` : ''}>+ Novo recrutamento</button></div>
      <p class="muted small">Procurando gente para um Grupo Guerreiro, um time PvP ou outra atividade? Crie um recrutamento: ele aparece para todos depois que um oficial ou o líder aprovar. Os candidatos aparecem com classe e atributos do perfil, e quem criou escolhe quem entra.</p>
      <p class="small rc-note limit-note">📏 <b>Limite:</b> cada pessoa pode ter até <b>${LIMITS.recruitsActive} recrutamentos ativos</b> (aguardando aprovação ou abertos).
        Você tem <b>${active} de ${LIMITS.recruitsActive}</b>${full ? ': encerre um para criar outro' : ''}.</p>
      <div class="seg rc-filter" role="group" aria-label="Filtrar por categoria">
        <button class="${recruitFilter ? '' : 'on'}" data-rc-cat="">Todos</button>
        ${RECRUIT_CATS.map((c) => `<button class="${recruitFilter === c.key ? 'on' : ''}" data-rc-cat="${c.key}">${c.icon} ${esc(c.label)}</button>`).join('')}
      </div>
      ${waiting.length ? `<div class="section-head"><h2>Aguardando aprovação</h2></div>${waiting.map(recruitCard).join('')}` : ''}
      <div class="section-head"><h2>Abertos</h2></div>
      ${open.length ? open.map(recruitCard).join('') : '<div class="card empty">Nenhum recrutamento aberto agora.<br><br>Crie um em “+ Novo recrutamento”.</div>'}
      ${closed.length ? `<div class="section-head"><h2>Encerrados</h2></div>${closed.map(recruitCard).join('')}` : ''}`;
    $('#btn-new-rc').addEventListener('click', () => openRecruitForm());
    main.querySelectorAll('[data-rc-cat]').forEach((b) => b.addEventListener('click', () => { recruitFilter = b.dataset.rcCat; viewRecruits(); }));
  }

  async function viewRecruit(id) {
    const r = state.recruits.find((x) => x.id === id);
    renderHeader('recruits');
    if (!r) {
      main.innerHTML = backRow('#/recrutamentos', 'Recrutamentos') + '<div class="card empty">Recrutamento não encontrado (pode ter sido apagado).</div>';
      return;
    }
    const mine = isMyRecruit(r);
    const app = myApplication(r);
    const acc = recruitApps(r, 'accepted');
    const cands = recruitApps(r, 'applied').sort((a, b) => Date.parse(a.applied_at) - Date.parse(b.applied_at));
    const declined = recruitApps(r, 'declined');
    const full = acc.length >= r.slots;
    const wanted = new Set(Object.keys(r.wanted || {}));
    const cat = RECRUIT_CAT[r.category] || RECRUIT_CAT.other;
    const person = (a, buttons) => {
      const p = recruitPerson(a.user_id);
      if (!p) return '';
      const want = wanted.has(p.build.char_class);
      return `<div class="rc-person${want ? ' want' : ''}">${chip(p)}
        <div class="rc-act">${want ? '<span class="rc-want-flag" title="Classe que o recrutamento procura">★ classe procurada</span>' : ''}
          <span class="muted small">${esc(fmtShortDate(a.applied_at))}</span>${buttons || ''}</div></div>`;
    };
    const btn = (attr, uid, label, cls = 'ghost') => `<button class="btn small ${cls}" ${attr}="${esc(uid)}">${label}</button>`;
    const decided = r.decided_by && r.decided_by !== r.created_by && r.status !== 'pending'
      ? `${r.status === 'rejected' ? 'Recusado' : 'Aprovado'} por ${esc(nameOf(r.decided_by))} em ${esc(fmtShortDate(r.decided_at))}` : '';

    const actions = [];
    if (r.status === 'open' && !mine) {
      if (!app) actions.push(`<button class="btn primary" id="rc-apply">🙋 Quero participar</button>`);
      else if (app.status === 'applied') actions.push(`<button class="btn ghost" id="rc-withdraw">Desistir da candidatura</button>`);
      else if (app.status === 'accepted') actions.push(`<button class="btn ghost danger" id="rc-withdraw">Sair do grupo</button>`);
    }
    if (canApproveRecruit(r)) actions.push('<button class="btn primary" id="rc-approve">✔ Aprovar</button>', '<button class="btn ghost danger" id="rc-reject">Recusar</button>');
    if (['open', 'pending', 'rejected'].includes(r.status) && canOnRecruit(r, 'recruit_edit')) actions.push('<button class="btn ghost" id="rc-edit">Editar</button>');
    if (r.status === 'open' && canOnRecruit(r, 'recruit_close')) actions.push('<button class="btn ghost" id="rc-close">Encerrar recrutamento</button>');
    if (r.status === 'closed' && canOnRecruit(r, 'recruit_close')) actions.push('<button class="btn ghost" id="rc-reopen">Reabrir</button>');
    if (canOnRecruit(r, 'recruit_delete')) actions.push('<button class="btn ghost danger" id="rc-delete">Apagar</button>');

    main.innerHTML = `
      ${backRow('#/recrutamentos', 'Recrutamentos')}
      <div class="page-head"><h1>${cat.icon} ${esc(r.title)}</h1></div>
      <div class="card rc-detail">
        <div class="rc-badges">${recruitBadges(r)}</div>
        <div class="muted small">Criado por <b>${esc(nameOf(r.created_by))}</b> em ${esc(fmtShortDate(r.created_at))}${decided ? ` · ${decided}` : ''}${r.status === 'closed' && r.closed_by ? ` · encerrado por ${esc(nameOf(r.closed_by))} em ${esc(fmtShortDate(r.closed_at))}` : ''}</div>
        ${recruitMeta(r)}
        ${r.description ? `<p class="rc-desc">${esc(r.description)}</p>` : ''}
        ${r.status === 'pending' ? `<p class="small rc-note">⏳ ${mine ? 'Seu recrutamento está aguardando a aprovação de um oficial ou do líder. Ninguém vê ele ainda.' : 'Este recrutamento só aparece para os membros depois de aprovado.'}</p>` : ''}
        ${r.status === 'rejected' ? `<p class="small rc-note bad">✖ Recusado${r.note ? `: “${esc(r.note)}”` : ''}. Você pode editar e enviar de novo, ou apagar.</p>` : ''}
        ${app?.status === 'declined' ? '<p class="small rc-note">Você não foi selecionado desta vez.</p>' : ''}
        ${r.status === 'open' && full && !mine && !app ? '<p class="small rc-note">As vagas estão preenchidas, mas você ainda pode se candidatar: se alguém sair, quem criou pode chamar você.</p>' : ''}
        ${actions.length ? `<div class="row rc-actions">${actions.join('')}</div>` : ''}
      </div>

      <div class="section-head"><h2>Participantes aceitos <span class="muted">${acc.length}/${r.slots}</span></h2></div>
      <div class="card rc-people">${acc.length ? acc.map((a) => person(a, mine && r.status === 'open' ? btn('data-rc-undo', a.user_id, 'Remover') : '')).join('') : '<p class="muted small" style="margin:0">Ninguém aceito ainda.</p>'}</div>

      ${r.status !== 'pending' && r.status !== 'rejected' ? `<div class="section-head"><h2>Candidatos <span class="muted">${cands.length}</span></h2></div>
      <div class="card rc-people">${cands.length ? cands.map((a) => person(a, mine && r.status === 'open'
        ? `${btn('data-rc-decline', a.user_id, 'Recusar', 'ghost danger')}${full ? '<button class="btn small ghost" disabled title="Todas as vagas estão preenchidas. Tire alguém ou aumente as vagas em Editar.">Aceitar</button>' : btn('data-rc-accept', a.user_id, 'Aceitar', 'primary')}` : '')).join('')
        : '<p class="muted small" style="margin:0">Nenhum candidato aguardando.</p>'}</div>` : ''}

      ${declined.length && (mine || isOfficer()) ? `<div class="section-head"><h2>Não selecionados <span class="muted">${declined.length}</span></h2></div>
      <div class="card rc-people">${declined.map((a) => person(a, mine && r.status === 'open' ? btn('data-rc-undo', a.user_id, 'Voltar para candidatos') : '')).join('')}</div>` : ''}`;

    const refresh = () => route();
    const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); } catch (e) { fail(e); } await refresh(); };

    $('#rc-apply')?.addEventListener('click', async () => {
      if (!hasBuild(state.me)) {
        if (await confirmDialog('Para se candidatar, preencha primeiro sua classe e seus atributos no perfil: é isso que quem criou o recrutamento vai ver.', 'Abrir meu perfil')) openProfile();
        return;
      }
      const b = pick(state.me, BUILD_KEYS);
      if (!(await confirmDialog(`Candidatar-se a “${r.title}”? Você vai aparecer como ${displayName(state.me)} · ${CLASS[b.char_class]?.label} · ${ATTRS.map((a) => `${a.short} ${fmtNum(b[a.key])}`).join(' · ')}. Se algo mudou, atualize o perfil antes.`, 'Candidatar'))) return;
      run(() => api.applyRecruit(r.id), 'Candidatura enviada! Agora é só aguardar quem criou o recrutamento.');
    });
    $('#rc-withdraw')?.addEventListener('click', async () => {
      if (!(await confirmDialog(app?.status === 'accepted' ? 'Sair do grupo? Sua vaga fica livre para outra pessoa.' : 'Desistir da candidatura?', app?.status === 'accepted' ? 'Sair' : 'Desistir'))) return;
      run(() => api.withdrawRecruit(r.id), app?.status === 'accepted' ? 'Você saiu do grupo' : 'Candidatura retirada');
    });
    $('#rc-approve')?.addEventListener('click', () => run(() => api.decideRecruit(r.id, true), 'Recrutamento aprovado: já aparece para todos'));
    $('#rc-reject')?.addEventListener('click', () => openRecruitReject(r));
    $('#rc-edit')?.addEventListener('click', () => openRecruitForm(r));
    $('#rc-close')?.addEventListener('click', async () => {
      if (!(await confirmDialog(`Encerrar “${r.title}”? Ninguém mais poderá se candidatar. ${mine ? 'Você' : 'Quem criou'} pode reabrir depois.`, 'Encerrar'))) return;
      run(() => api.closeRecruit(r.id, false), 'Recrutamento encerrado');
    });
    $('#rc-reopen')?.addEventListener('click', () => run(() => api.closeRecruit(r.id, true), 'Recrutamento reaberto'));
    $('#rc-delete')?.addEventListener('click', async () => {
      if (!(await confirmDialog(`Apagar “${r.title}” e todas as candidaturas? Isso não pode ser desfeito.`, 'Apagar'))) return;
      try { await api.deleteRecruit(r.id); toast('Recrutamento apagado'); location.hash = '#/recrutamentos'; } catch (e) { fail(e); }
    });
    const decide = (attr, status, msg) => main.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener('click', () =>
      run(() => api.decideApplication(r.id, b.getAttribute(attr), status), msg)));
    decide('data-rc-accept', 'accepted', 'Candidato aceito');
    decide('data-rc-decline', 'declined', 'Candidato recusado');
    decide('data-rc-undo', 'applied', 'Voltou para a lista de candidatos');
  }

  function openRecruitReject(r) {
    openDialog(`<form id="rcr-form" class="stack">
        <h2>Recusar recrutamento</h2>
        <p class="muted small" style="margin:0">“${esc(r.title)}” de ${esc(nameOf(r.created_by))}</p>
        <div class="field"><label for="rcr-note">Motivo <span class="muted small">(opcional, quem criou vê)</span></label>
          <textarea id="rcr-note" maxlength="300" placeholder="Ex.: já existe um recrutamento igual aberto"></textarea></div>
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn danger">Recusar</button></div>
      </form>`, (d) => {
      $('#rcr-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.decideRecruit(r.id, false, $('#rcr-note', d).value.trim() || null);
          dlg.close();
          toast('Recrutamento recusado');
          await route();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  const myActiveRecruits = () => (state.recruits || []).filter((x) => isMyRecruit(x) && ['pending', 'open'].includes(x.status)).length;
  function openRecruitForm(r) {
    if (!r && myActiveRecruits() >= LIMITS.recruitsActive) {
      toast(`Limite de ${LIMITS.recruitsActive} recrutamentos ativos por pessoa. Encerre um para criar outro.`, true);
      return;
    }
    const editing = !!r;
    const v = r || { category: 'warband', slots: 7, wanted: {} };
    openDialog(`
      <form id="rc-form" class="stack">
        <h2>${editing ? 'Editar recrutamento' : 'Novo recrutamento'}</h2>
        ${!editing && !isLeader() ? '<p class="muted small" style="margin:0">Depois de criado, o recrutamento passa pela aprovação de um oficial ou do líder antes de aparecer para todos.</p>' : ''}
        <div class="field"><label for="rc-title">Título</label>
          <input id="rc-title" maxlength="80" required placeholder="Ex.: Procuro 7 para Grupo Guerreiro" value="${esc(v.title || '')}"></div>
        <div class="row rc-form-row">
          <div class="field spacer"><label for="rc-cat">Categoria</label>
            <select id="rc-cat" required>${RECRUIT_CATS.map((c) => `<option value="${c.key}" ${v.category === c.key ? 'selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}</select></div>
          <div class="field"><label for="rc-slots">Vagas</label>
            <input id="rc-slots" type="number" min="1" max="50" step="1" required value="${esc(v.slots)}" style="width:90px"></div>
        </div>
        <div class="field"><label for="rc-desc">Descrição <span class="muted small">(opcional)</span></label>
          <textarea id="rc-desc" maxlength="1000" placeholder="Horários, o que o grupo vai fazer, se precisa de Discord…">${esc(v.description || '')}</textarea></div>
        <div class="row rc-form-row">
          <div class="field spacer"><label for="rc-when">Data e hora da atividade <span class="muted small">(opcional)</span></label>
            <input id="rc-when" type="datetime-local" value="${v.activity_at ? toLocalInput(v.activity_at) : ''}"></div>
          <div class="field spacer"><label for="rc-deadline">Prazo de inscrição <span class="muted small">(opcional)</span></label>
            <input id="rc-deadline" type="datetime-local" value="${v.deadline_at ? toLocalInput(v.deadline_at) : ''}"></div>
        </div>
        <fieldset class="rc-classes">
          <legend>Classes procuradas <span class="muted small">(opcional: quantas de cada; qualquer classe pode se candidatar)</span></legend>
          <div class="rc-class-grid">${CLASSES.map((c) => `<label>${classTag(c.key)}<span>${esc(c.label)}</span>
            <input type="number" min="0" max="50" step="1" inputmode="numeric" data-want="${c.key}" value="${v.wanted?.[c.key] || ''}" placeholder="0" aria-label="${esc(c.label)}"></label>`).join('')}</div>
        </fieldset>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${editing ? 'Salvar' : isLeader() ? 'Publicar' : 'Enviar para aprovação'}</button>
        </div>
      </form>`, (d) => {
      $('#rc-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const wanted = {};
        d.querySelectorAll('[data-want]').forEach((i) => { wanted[i.dataset.want] = i.value; });
        const row = cleanRecruitRow({
          title: $('#rc-title', d).value, category: $('#rc-cat', d).value, description: $('#rc-desc', d).value,
          slots: $('#rc-slots', d).value, activity_at: $('#rc-when', d).value, deadline_at: $('#rc-deadline', d).value, wanted,
        });
        if (!row.title) return;
        const asked = Object.values(row.wanted).reduce((a, b) => a + b, 0);
        if (asked > row.slots) { toast(`As classes procuradas somam ${asked}, mais que as ${row.slots} vagas`, true); return; }
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          if (editing) {
            await api.updateRecruit(r.id, row);
            dlg.close();
            toast('Recrutamento atualizado');
            await route();
          } else {
            const res = await api.createRecruit(row);
            dlg.close();
            toast(res.status === 'open' ? 'Recrutamento publicado!' : 'Recrutamento enviado! Ele aparece para todos depois que um oficial ou o líder aprovar.');
            location.hash = `#/recrutamento/${res.id}`;
          }
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  // =====================================================================
  //  Tickets: o membro fala com a liderança (pode ser anônimo)
  //  Aba "Tickets" = os meus; aba "Atendimento" = líder e oficiais respondem.
  // =====================================================================
  state.tickets = [];
  state.revealed = {}; // autor revelado pelo líder (só na memória desta página)
  async function loadTickets() {
    if (!TICKETS_ON || !isMember()) { state.tickets = []; return; }
    try { state.tickets = await api.tickets(); } catch (e) { console.warn('tickets', e); state.tickets = []; }
  }
  const ticketSeenKey = (id) => `tk-seen-${state.user?.id}-${id}`;
  const ticketSeen = (id) => { try { return Number(localStorage.getItem(ticketSeenKey(id))) || 0; } catch { return 0; } };
  const markTicketSeen = (id) => { try { localStorage.setItem(ticketSeenKey(id), String(Date.now())); } catch { /* ignora */ } };
  const lastPublic = (t) => [...(t.messages || [])].reverse().find((m) => !m.internal);
  const lastActivity = (t) => t.messages?.[t.messages.length - 1]?.created_at || t.created_at;
  // Novidade num ticket meu que eu ainda não abri: resposta da staff e/ou encerramento pela staff
  function ticketNews(t) {
    if (!t.mine) return null;
    const seen = ticketSeen(t.id);
    const m = lastPublic(t);
    const reply = m && !m.from_author && Date.parse(m.created_at) > seen ? m : null;
    const close = (t.log || []).filter((l) => l.to_status === 'resolved' && !l.by_author && Date.parse(l.at) > seen).pop() || null;
    if (!reply && !close) return null;
    const at = Math.max(reply ? Date.parse(reply.created_at) : 0, close && t.status === 'resolved' ? Date.parse(close.at) : 0);
    return { reply, resolved: !!close && t.status === 'resolved', at, key: `${reply?.created_at || ''}|${close?.at || ''}` };
  }
  const ticketHasNews = (t) => !!ticketNews(t)?.at;
  const ticketNewsText = (n) => (n.reply && n.resolved ? '💬 A staff respondeu e encerrou' : n.resolved ? '✔ A staff resolveu e encerrou' : '💬 A staff respondeu');
  // Pendência pela última mensagem pública: 'staff' = pendente atendimento; 'author' = pendente autor
  const ticketPending = (t) => (t.status === 'resolved' ? null : lastPublic(t)?.from_author ? 'staff' : 'author');
  // Ticket de outra pessoa esperando a liderança
  const ticketAwaiting = (t) => !t.mine && ticketPending(t) === 'staff';
  // Líder e oficiais (com "Ver tickets") usam só a aba Atendimento, que também tem os tickets deles
  const supportOn = () => TICKETS_ON && isOfficer() && can('ticket_view');
  const ticketBadgeMine = () => (state.tickets || []).filter(ticketHasNews).length;
  const ticketBadgeStaff = () => (supportOn() ? (state.tickets || []).filter(ticketAwaiting).length + ticketBadgeMine() : 0);
  // Contador no botão 💬 da Central de Atendimento
  function updateHelpFab() {
    const fab = $('#help-fab');
    if (!fab) return;
    let b = fab.querySelector('.help-fab-badge');
    if (!b) { b = document.createElement('span'); b.className = 'help-fab-badge'; fab.appendChild(b); }
    const n = supportOn() ? ticketBadgeStaff() : ticketBadgeMine();
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n);
    const mine = ticketBadgeMine();
    fab.title = mine ? `Central de Atendimento: a staff respondeu ${mine === 1 ? '1 ticket seu' : `${mine} tickets seus`}`
      : supportOn() ? 'Central de Atendimento: tickets dos membros' : 'Central de Atendimento: fale com a liderança';
  }
  // Aviso ao entrar no site (e enquanto ele está aberto) quando a staff responde ou resolve um ticket meu,
  // com atalho direto para o ticket. Some ao abrir o ticket ou ao fechar o aviso (✕).
  const tkToastKey = () => `tk-notice-${state.user?.id}`;
  function notifyTicketReplies() {
    const old = $('#tk-notice');
    if (!TICKETS_ON || !state.user || !isMember()) { old?.remove(); return; }
    let done = {};
    try { done = JSON.parse(localStorage.getItem(tkToastKey()) || '{}') || {}; } catch { done = {}; }
    const here = parseRoute().tk;
    const items = (state.tickets || []).map((t) => ({ t, n: ticketNews(t) }))
      .filter(({ t, n }) => n && !(here && Number(here[1]) === t.id) && done[t.id] !== n.key)
      .sort((a, b) => b.n.at - a.n.at);
    if (!items.length) { old?.remove(); return; }
    const box = old || document.createElement('div');
    box.id = 'tk-notice';
    box.className = 'tk-notice';
    box.setAttribute('role', 'status');
    box.innerHTML = `<div class="tk-notice-head"><b>📬 ${items.length === 1 ? 'Novidade no seu ticket' : `Novidades em ${items.length} tickets seus`}</b>
        <button type="button" class="tk-notice-x" aria-label="Fechar aviso" title="Fechar (o ticket continua marcado no 💬)">✕</button></div>
      ${items.slice(0, 4).map(({ t, n }) => `<a class="tk-notice-item" href="#/ticket/${t.id}">
        <span class="tk-notice-txt"><b>${esc(t.title)}</b><small>${ticketNewsText(n)} · ${esc(fmtWhenShort(new Date(n.at).toISOString()))}</small></span>
        <span class="btn small primary">Abrir →</span></a>`).join('')}
      ${items.length > 4 ? `<a class="tk-notice-more" href="#/tickets">Ver todos os ${items.length} tickets →</a>` : ''}`;
    if (!old) document.body.appendChild(box);
    const dismiss = () => {
      items.forEach(({ t, n }) => { done[t.id] = n.key; });
      try { localStorage.setItem(tkToastKey(), JSON.stringify(done)); } catch { /* ignora */ }
      box.remove();
    };
    box.querySelector('.tk-notice-x').addEventListener('click', dismiss);
    box.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => box.remove()));
  }
  // Enquanto o site está aberto, confere novas respostas a cada minuto (e ao voltar para a aba)
  let ticketPollBusy = false;
  async function pollTickets() {
    if (ticketPollBusy || document.hidden || !TICKETS_ON || !state.user || !isMember()) return;
    ticketPollBusy = true;
    try {
      const here = parseRoute().tk;
      const count = (id) => (state.tickets || []).find((t) => t.id === id)?.messages?.length || 0;
      const before = here ? count(Number(here[1])) : 0;
      await loadTickets();
      renderBell();
      notifyTicketReplies();
      // Na conversa aberta, mostra a mensagem nova (se a pessoa não estiver escrevendo)
      if (here && count(Number(here[1])) !== before && !$('#tk-body')?.value.trim()) await viewTicket(Number(here[1]));
    } catch (e) { console.warn('tickets', e); } finally { ticketPollBusy = false; }
  }
  setInterval(pollTickets, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollTickets(); });
  const ownerLabel = (t) => (t.assigned_to === state.user.id ? 'Com você' : `Responsável: ${nameOf(t.assigned_to)}`);
  function ticketAuthorLabel(t) {
    if (t.mine) return t.anonymous ? 'Você (anônimo)' : 'Você';
    if (t.author_id) return nameOf(t.author_id);
    return state.revealed[t.id] ? `🕶️ Anônimo (${nameOf(state.revealed[t.id])})` : '🕶️ Anônimo';
  }
  function ticketBadges(t, staff = supportOn()) {
    const cat = TICKET_CAT[t.category] || TICKET_CAT.other;
    const pend = ticketPending(t);
    return [
      `<span class="badge rc-cat tk-cat-${esc(t.category)}">${esc(cat.label)}</span>`,
      `<span class="badge tk-st tk-st-${esc(t.status)}">${esc(TICKET_STATUS[t.status] || t.status)}</span>`,
      t.anonymous ? '<span class="badge rc-closed">🕶️ Anônimo</span>' : '',
      t.mine && staff ? '<span class="badge rc-mine">Seu ticket</span>' : '',
      ticketHasNews(t) ? '<span class="badge warn">Resposta nova</span>' : '',
      staff && !t.mine && pend ? (ticketStage(t) === 'triage' ? '<span class="badge tk-pend-staff">🆕 Triagem</span>'
        : `<span class="badge tk-pend-${pend}">${pend === 'staff' ? '⏳ Pendente retorno' : '💬 Pendente solicitante'}</span>`) : '',
    ].join('');
  }
  // Responsável em destaque (quem atende)
  function ownerTag(t) {
    if (t.status === 'resolved' && !t.assigned_to) return '';
    return t.assigned_to
      ? `<span class="tk-owner${t.assigned_to === state.user.id ? ' me' : ''}">👤 ${esc(ownerLabel(t))}</span>`
      : '<span class="tk-owner none">👤 Sem responsável</span>';
  }
  // Histórico de status: quem encerrou ou reabriu (o jogador que abriu ou a staff)
  const lastClose = (t) => (t.status === 'resolved' ? [...(t.log || [])].reverse().find((l) => l.to_status === 'resolved') : null);
  function tkWho(t, l) {
    if (l.by_author) return t.mine ? 'por você' : `pelo jogador${t.author_id ? ` (${nameOf(t.author_id)})` : t.anonymous ? ' (anônimo)' : ''}`;
    if (!l.actor) return '';
    return l.actor === state.user.id ? 'por você (staff)' : `pela staff (${nameOf(l.actor)})`;
  }
  function tkLogText(t, l) {
    const who = tkWho(t, l);
    const w = who ? ` ${who}` : '';
    if (l.to_status === 'resolved') return `✔ Encerrado${w}`;
    if (l.from_status === 'resolved') return `↺ Reaberto${w}`;
    if (l.to_status === 'progress') return `💬 Colocado em atendimento${w}`;
    return `Voltou para Aberto${w}`;
  }
  const closedLine = (t) => { const l = lastClose(t); return l ? `${tkLogText(t, l)} em ${fmtWhen(l.at)}` : ''; };

  function ticketRowHtml(t, staff) {
    const cat = TICKET_CAT[t.category] || TICKET_CAT.other;
    const n = t.messages.filter((m) => !m.internal).length;
    const closed = closedLine(t);
    return `<a class="card tk-row" href="#/ticket/${t.id}">
      <span class="rc-icon" aria-hidden="true">${cat.icon}</span>
      <div class="rc-body">
        <div class="tk-row-top"><div class="tk-title">${esc(t.title)}</div>${staff ? ownerTag(t) : ''}</div>
        <div class="rc-badges">${ticketBadges(t, staff)}</div>
        <div class="muted small">${staff ? `Aberto por <b>${esc(ticketAuthorLabel(t))}</b> · ` : ''}${n} mensage${n === 1 ? 'm' : 'ns'} · atualizado ${esc(fmtWhen(lastActivity(t)))}${!staff && t.assigned_to ? ` · com ${esc(nameOf(t.assigned_to))}` : ''}</div>
        ${closed ? `<div class="tk-closed small">${esc(closed)}</div>` : ''}
      </div>
    </a>`;
  }

  // ---------- Anexos (imagens) ----------
  const imagePickerHtml = () => `<div class="tk-files">
      <label class="btn small ghost tk-attach">📎 Anexar imagens<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden></label>
      <span class="muted small">até ${TICKET_MAX_IMAGES} por mensagem</span>
      <div class="tk-previews"></div>
    </div>`;
  function bindImagePicker(root) {
    const input = $('.tk-files input[type=file]', root);
    const prev = $('.tk-previews', root);
    let files = [];
    const draw = () => {
      prev.innerHTML = files.map((f, i) => `<span class="tk-thumb"><img src="${esc(f.url)}" alt=""><button type="button" data-rm="${i}" title="Tirar esta imagem" aria-label="Tirar esta imagem">×</button></span>`).join('');
      prev.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
        const [f] = files.splice(Number(b.dataset.rm), 1);
        URL.revokeObjectURL(f.url);
        draw();
      }));
    };
    input.addEventListener('change', () => {
      const add = [...input.files].filter((f) => f.type.startsWith('image/'));
      if (files.length + add.length > TICKET_MAX_IMAGES) toast(`Máximo de ${TICKET_MAX_IMAGES} imagens por mensagem`, true);
      add.slice(0, TICKET_MAX_IMAGES - files.length).forEach((f) => files.push({ file: f, url: URL.createObjectURL(f) }));
      input.value = '';
      draw();
    });
    return { files: () => files.map((f) => f.file) };
  }
  async function uploadTicketImages(files, status) {
    const urls = [];
    for (const raw of files) {
      if (status) status.textContent = `Enviando imagem ${urls.length + 1} de ${files.length}…`;
      const f = await prepareImage(raw);
      if (f.size > 5 * 1024 * 1024) throw new Error('Uma das imagens passa de 5 MB mesmo depois de otimizada. Use uma imagem menor.');
      urls.push(await api.uploadTicketImage(f));
    }
    return urls;
  }
  const imagesHtml = (imgs) => (imgs?.length ? `<div class="tk-imgs">${imgs.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener" title="Abrir imagem"><img src="${esc(u)}" alt="Imagem anexada" loading="lazy"></a>`).join('')}</div>` : '');

  // ---------- Aba "Tickets" (os meus) ----------
  // ---------- Limites (aviso visível nas páginas) ----------
  const ticketsToday = () => (state.tickets || []).filter((t) => t.mine && brDay(t.created_at) === brDay(Date.now())).length;
  const ticketLimitFull = () => ticketsToday() >= LIMITS.ticketsPerDay;
  function ticketLimitNote(staff) {
    const n = ticketsToday();
    return `<p class="small rc-note limit-note">📏 <b>Limites:</b> cada pessoa pode abrir até <b>${LIMITS.ticketsPerDay} tickets por dia</b> e enviar até <b>${LIMITS.msgsPerHour} mensagens por hora</b>${staff ? ' (a staff não tem limite de mensagens)' : ''}.
      Hoje você abriu <b>${n} de ${LIMITS.ticketsPerDay}</b>${n >= LIMITS.ticketsPerDay ? ': continue a conversa em um ticket aberto ou volte amanhã' : ''}.</p>`;
  }
  const newTicketBtn = (label) => `<button class="btn primary" id="btn-new-tk"${ticketLimitFull() ? ` disabled title="Limite de ${LIMITS.ticketsPerDay} tickets por dia atingido"` : ''}>${label}</button>`;

  async function viewTickets() {
    if (supportOn()) { location.hash = '#/atendimento'; return; }
    renderHeader('tickets');
    const mine = state.tickets.filter((t) => t.mine).sort((a, b) => Date.parse(lastActivity(b)) - Date.parse(lastActivity(a)));
    const open = mine.filter((t) => t.status !== 'resolved');
    const done = mine.filter((t) => t.status === 'resolved');
    main.innerHTML = `
      <div class="page-head"><h1>Central de Atendimento</h1>${newTicketBtn('+ Novo ticket')}</div>
      <p class="muted small">Fale com a liderança do clã: sugestões, melhorias, dúvidas, problemas no site, reclamações ou denúncias. O líder e os oficiais respondem aqui mesmo, e você pode abrir o ticket de forma anônima.</p>
      ${ticketLimitNote(false)}
      <div class="section-head"><h2>Em aberto</h2></div>
      ${open.length ? open.map((t) => ticketRowHtml(t, false)).join('') : '<div class="card empty">Você não tem tickets em aberto.</div>'}
      ${done.length ? `<div class="section-head"><h2>Resolvidos</h2></div>${done.map((t) => ticketRowHtml(t, false)).join('')}` : ''}`;
    $('#btn-new-tk').addEventListener('click', openTicketForm);
  }

  // ---------- Aba "Atendimento" (líder e oficiais) ----------
  // me = só os tickets atendidos por mim (responsável = eu); vale nas abas Pendentes, Encerrados e Todos
  const SUP = { view: 'p_return', cat: '', me: true };
  const SUP_VIEWS = [
    ['triage', 'Triagem'], ['p_return', 'Pendente Retorno'], ['p_req', 'Pendente Solicitante'],
    ['closed', 'Encerrados'], ['opened', 'Abertos por mim'], ['all', 'Todos'],
  ];
  const SUP_WHO = ['p_return', 'p_req', 'closed', 'all'];
  // Etapa do ticket: triagem (ninguém assumiu nem respondeu), pendente retorno (última mensagem do solicitante),
  // pendente solicitante (última mensagem da liderança) ou encerrado
  function ticketStage(t) {
    if (t.status === 'resolved') return 'closed';
    if (!t.assigned_to && !t.messages.some((m) => !m.from_author && !m.internal)) return 'triage';
    return ticketPending(t) === 'staff' ? 'p_return' : 'p_req';
  }
  const STAGE_LABEL = { triage: 'Triagem', p_return: 'Pendente Retorno', p_req: 'Pendente Solicitante', closed: 'Encerrados' };
  const SUP_PICK = {
    triage: (t) => !t.mine && ticketStage(t) === 'triage',
    p_return: (t) => !t.mine && ticketStage(t) === 'p_return',
    p_req: (t) => !t.mine && ticketStage(t) === 'p_req',
    closed: (t) => !t.mine && ticketStage(t) === 'closed',
    opened: (t) => t.mine,
    all: () => true,
  };
  const attendedByMe = (t) => t.assigned_to === state.user.id;
  async function viewSupport() {
    if (!supportOn()) { location.hash = '#/tickets'; return; }
    renderHeader('support');
    const all = state.tickets;
    if (!SUP_PICK[SUP.view]) SUP.view = 'p_return';
    const who = SUP_WHO.includes(SUP.view);
    const onlyMe = who && SUP.me;
    const list = all.filter(SUP_PICK[SUP.view]).filter((t) => !SUP.cat || t.category === SUP.cat).filter((t) => !onlyMe || attendedByMe(t))
      .sort((a, b) => (ticketAwaiting(b) - ticketAwaiting(a)) || (Date.parse(lastActivity(b)) - Date.parse(lastActivity(a))));
    const nTriage = all.filter(SUP_PICK.triage).length;
    const nReturnMe = all.filter((t) => SUP_PICK.p_return(t) && attendedByMe(t)).length;
    const nReturn = all.filter(SUP_PICK.p_return).length;
    const nNews = all.filter(ticketHasNews).length;
    const reportsHidden = !isLeader() && permMode('ticket_reports') === 'deny';
    const fcount = { triage: nTriage, p_return: SUP.me ? nReturnMe : nReturn, opened: nNews };
    const rows = (arr) => arr.map((t) => ticketRowHtml(t, true)).join('');
    // Em "Todos", um bloco por etapa
    const sections = () => ['triage', 'p_return', 'p_req', 'closed']
      .map((k) => [k, list.filter((t) => ticketStage(t) === k)]).filter(([, arr]) => arr.length)
      .map(([k, arr]) => `<div class="section-head"><h2>${STAGE_LABEL[k]} <span class="muted small">(${arr.length})</span></h2></div>${rows(arr)}`).join('');
    main.innerHTML = `
      <div class="page-head"><h1>Central de Atendimento</h1>${newTicketBtn('+ Abrir ticket')}</div>
      ${ticketLimitNote(true)}
      <p class="muted small"><b>${nTriage}</b> na triagem · <b>${nReturnMe}</b> pendente${nReturnMe === 1 ? '' : 's'} de retorno com você · <b>${nReturn}</b> pendente${nReturn === 1 ? '' : 's'} de retorno no total.${reportsHidden ? ' Os tickets de Reclamação / Denúncia ficam só com o líder.' : ''}</p>
      <div class="row tk-filters">
        <div class="seg rc-filter" role="group" aria-label="Filtrar tickets">
          ${SUP_VIEWS.map(([k, l]) => `<button class="${SUP.view === k ? 'on' : ''}" data-sup-v="${k}">${l}${fcount[k] ? ` <span class="tk-fcount">${fcount[k]}</span>` : ''}</button>`).join('')}
        </div>
      </div>
      <div class="row tk-filters tk-sub">
        <select class="inline" id="sup-cat" aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          ${TICKET_CATS.filter((c) => !(reportsHidden && c.key === 'report')).map((c) => `<option value="${c.key}" ${SUP.cat === c.key ? 'selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}
        </select>
        ${who ? `<div class="tk-who" role="radiogroup" aria-label="Quem atende">
          <label><input type="radio" name="tk-who" value="all" ${SUP.me ? '' : 'checked'}> Todos</label>
          <label><input type="radio" name="tk-who" value="me" ${SUP.me ? 'checked' : ''}> Atendidos por mim</label>
        </div>` : ''}
      </div>
      ${!list.length ? `<div class="card empty">Nenhum ticket aqui${onlyMe ? ' atendido por você' : ''}.</div>`
        : SUP.view === 'all' ? sections() : rows(list)}`;
    main.querySelectorAll('input[name=tk-who]').forEach((r) => r.addEventListener('change', () => { SUP.me = r.value === 'me'; viewSupport(); }));
    $('#btn-new-tk').addEventListener('click', openTicketForm);
    main.querySelectorAll('[data-sup-v]').forEach((b) => b.addEventListener('click', () => { SUP.view = b.dataset.supV; viewSupport(); }));
    $('#sup-cat').addEventListener('change', (e) => { SUP.cat = e.target.value; viewSupport(); });
  }

  // ---------- Um ticket (conversa) ----------
  async function viewTicket(id) {
    const t = state.tickets.find((x) => x.id === id);
    if (t?.mine) { markTicketSeen(t.id); renderBell(); }
    const staff = !!t && !t.mine;
    const home = supportOn() ? ['#/atendimento', 'Central de Atendimento'] : ['#/tickets', 'Central de Atendimento'];
    renderHeader(supportOn() ? 'support' : 'tickets');
    if (!t) {
      main.innerHTML = `${backRow(home[0], home[1])}<div class="card empty">Ticket não encontrado.</div>`;
      return;
    }
    const cat = TICKET_CAT[t.category] || TICKET_CAT.other;
    const canReply = t.mine || can('ticket_reply');
    const canStatus = t.mine || can('ticket_resolve');
    const who = (m) => {
      if (m.from_author) return t.mine ? 'Você' : ticketAuthorLabel(t);
      return m.author_id === state.user.id ? 'Você' : nameOf(m.author_id);
    };
    const msgHtml = (m) => {
      const me = m.author_id === state.user.id || (t.mine && m.from_author);
      return `<div class="tk-msg${me ? ' me' : ''}${m.internal ? ' internal' : ''}${m.from_author ? '' : ' staff'}">
        <div class="tk-msg-head"><b>${esc(who(m))}</b>${!m.from_author ? ' <span class="tk-role">Liderança</span>' : ''}${m.internal ? ' <span class="tk-int">🔒 Nota interna</span>' : ''}<span class="muted small">${esc(fmtWhen(m.created_at))}</span></div>
        ${m.body ? `<div class="tk-text">${esc(m.body)}</div>` : ''}
        ${imagesHtml(m.images)}
      </div>`;
    };
    // Mensagens e mudanças de status (encerrado, reaberto…) na ordem em que aconteceram
    const logHtml = (l) => `<div class="tk-event${l.to_status === 'resolved' ? ' done' : ''}"><span>${esc(tkLogText(t, l))}</span><span class="muted small">${esc(fmtWhen(l.at))}</span></div>`;
    const msgs = [
      ...t.messages.map((m) => ({ at: Date.parse(m.created_at), html: msgHtml(m) })),
      ...(t.log || []).map((l) => ({ at: Date.parse(l.at), html: logHtml(l) })),
    ].sort((a, b) => a.at - b.at).map((x) => x.html).join('');
    const closed = closedLine(t);
    const closedNote = t.status !== 'resolved' ? ''
      : `<p class="small rc-note ok">${closed ? esc(closed) : '✔ Ticket encerrado (antes do histórico existir, sem registro de quem encerrou)'}.${!staff ? ' Se precisar, escreva abaixo que ele é reaberto.' : ''}</p>`;

    const controls = [];
    if (staff) {
      if (can('ticket_reply')) {
        controls.push(t.assigned_to === state.user.id
          ? '<button class="btn small ghost" id="tk-unassign">Deixar de ser o responsável</button>'
          : `<button class="btn small ${t.assigned_to ? 'ghost' : 'primary'}" id="tk-assign">🙋 Assumir${t.assigned_to ? ' no lugar' : ''}</button>`);
      }
      if (can('ticket_resolve')) {
        controls.push(`<div class="seg" role="group" aria-label="Status do ticket">${Object.entries(TICKET_STATUS)
          .map(([k, l]) => `<button class="${t.status === k ? 'on' : ''}" data-tk-st="${k}">${l}</button>`).join('')}</div>`);
      }
      if (isLeader() && t.anonymous && !t.author_id && !state.revealed[t.id]) controls.push('<button class="btn small ghost" id="tk-reveal">🕶️ Revelar autor</button>');
    } else if (t.status !== 'resolved') controls.push('<button class="btn small ghost" id="tk-done">✔ Marcar como resolvido</button>');

    main.innerHTML = `
      ${backRow(home[0], home[1])}
      <div class="page-head"><h1>${cat.icon} ${esc(t.title)}</h1></div>
      <div class="card tk-info">
        <div class="tk-row-top"><div class="rc-badges">${ticketBadges(t)}</div>${staff ? ownerTag(t) : ''}</div>
        <div class="muted small">Aberto por <b>${esc(ticketAuthorLabel(t))}</b> em ${esc(fmtWhen(t.created_at))}${!staff && t.assigned_to ? ` · Responsável: <b>${esc(nameOf(t.assigned_to))}</b>` : ''}</div>
        ${staff && state.revealed[t.id] ? `<p class="small rc-note">🕶️ Autor: <b>${esc(nameOf(state.revealed[t.id]))}</b>. Só você está vendo; nada fica registrado no ticket.</p>` : ''}
        ${t.mine && t.anonymous ? '<p class="small rc-note">🕶️ Seu nome fica oculto para os oficiais e o líder. Em casos graves, o líder pode ver quem abriu.</p>' : ''}
        ${closedNote}
        ${controls.length ? `<div class="row tk-controls">${controls.join('')}</div>` : ''}
      </div>
      <div class="tk-thread">${msgs}</div>
      ${canReply ? `<form id="tk-reply" class="card tk-compose stack">
        <textarea id="tk-body" maxlength="2000" placeholder="${staff ? 'Responder ao membro…' : 'Escreva uma mensagem…'}"></textarea>
        ${imagePickerHtml()}
        <div class="row">
          ${staff ? '<label class="tk-check"><input type="checkbox" id="tk-internal"> 🔒 Nota interna <span class="muted small">(só líder e oficiais veem)</span></label>' : ''}
          <span class="spacer"></span><span class="muted small" id="tk-status"></span>
          <button class="btn primary" type="submit">Enviar</button>
        </div>
      </form>` : '<p class="muted small">O líder não permite que oficiais respondam tickets.</p>'}`;
    const thread = $('.tk-thread');
    thread.lastElementChild?.scrollIntoView({ block: 'nearest' });

    const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); } catch (e) { fail(e); } await route(); };
    $('#tk-assign')?.addEventListener('click', () => run(() => api.assignTicket(t.id, state.user.id), 'Você assumiu o ticket: agora ele está Em atendimento'));
    $('#tk-unassign')?.addEventListener('click', () => run(() => api.assignTicket(t.id, null), 'Ticket sem responsável'));
    main.querySelectorAll('[data-tk-st]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.tkSt !== t.status) run(() => api.setTicketStatus(t.id, b.dataset.tkSt), `Status: ${TICKET_STATUS[b.dataset.tkSt]}`);
    }));
    $('#tk-done')?.addEventListener('click', () => run(() => api.setTicketStatus(t.id, 'resolved'), 'Ticket marcado como resolvido'));
    $('#tk-reveal')?.addEventListener('click', async () => {
      if (!(await confirmDialog('Ver quem abriu este ticket anônimo? Só você vai ver o nome, e nada fica registrado no ticket. Use apenas em casos graves.', 'Revelar autor'))) return;
      try { state.revealed[t.id] = await api.revealTicketAuthor(t.id); } catch (e) { fail(e); }
      await viewTicket(t.id);
    });
    const form = $('#tk-reply');
    if (form) {
      const picker = bindImagePicker(form);
      // A caixa cresce com o texto (até 60% da tela; depois rola)
      const box = $('#tk-body'); const grow = () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight + 2, window.innerHeight * 0.6)}px`; };
      box.addEventListener('input', grow);
      const internal = $('#tk-internal');
      internal?.addEventListener('change', () => form.classList.toggle('internal', internal.checked));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = $('#tk-body').value.trim();
        const files = picker.files();
        if (!body && !files.length) { toast('Escreva uma mensagem ou anexe uma imagem', true); return; }
        const submit = $('button[type=submit]', form);
        const status = $('#tk-status');
        submit.disabled = true;
        try {
          const images = await uploadTicketImages(files, status);
          await api.postTicketMessage(t.id, { body, internal: !!internal?.checked, images });
          toast(internal?.checked ? 'Nota interna salva' : 'Mensagem enviada');
          await route();
        } catch (err) { fail(err); status.textContent = ''; submit.disabled = false; }
      });
    }
  }

  function openTicketForm() {
    if (ticketLimitFull()) { toast(`Limite de ${LIMITS.ticketsPerDay} tickets por dia atingido. Continue a conversa em um ticket aberto ou volte amanhã.`, true); return; }
    openDialog(`
      <form id="tk-form" class="stack">
        <h2>Novo ticket</h2>
        <div class="field"><label for="tk-title">Assunto</label>
          <input id="tk-title" maxlength="100" required placeholder="Ex.: Sugestão de horário para a Vigília"></div>
        <div class="field"><label for="tk-cat">Categoria</label>
          <select id="tk-cat" required>
            <option value="" disabled selected hidden>Selecione…</option>
            ${TICKET_CATS.map((c) => `<option value="${c.key}">${c.icon} ${esc(c.label)}</option>`).join('')}
          </select></div>
        <div class="field"><label for="tk-msg">Mensagem</label>
          <textarea id="tk-msg" maxlength="2000" required placeholder="Conte com detalhes. Você poderá continuar a conversa depois."></textarea></div>
        ${imagePickerHtml()}
        <label class="tk-check tk-anon"><input type="checkbox" id="tk-anon"> 🕶️ Enviar anonimamente</label>
        <p class="muted small tk-anon-note" hidden>Seu nome fica oculto para os oficiais e o líder; só você vê que o ticket é seu. Em casos graves, o líder pode ver quem abriu.</p>
        <div class="row end">
          <span class="muted small" id="tk-fstatus"></span><span class="spacer"></span>
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Abrir ticket</button>
        </div>
      </form>`, (d) => {
      const picker = bindImagePicker(d);
      const anon = $('#tk-anon', d);
      anon.addEventListener('change', () => { $('.tk-anon-note', d).hidden = !anon.checked; });
      $('#tk-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = $('#tk-title', d).value.trim();
        const body = $('#tk-msg', d).value.trim();
        const category = $('#tk-cat', d).value;
        if (!title || !body || !TICKET_CAT[category]) return;
        const submit = $('button[type=submit]', d);
        const status = $('#tk-fstatus', d);
        submit.disabled = true;
        try {
          const images = await uploadTicketImages(picker.files(), status);
          const id = await api.createTicket({ title, category, anonymous: anon.checked, body, images });
          dlg.close();
          toast(anon.checked ? 'Ticket anônimo aberto! A liderança vai responder aqui.' : 'Ticket aberto! A liderança vai responder aqui.');
          location.hash = `#/ticket/${id}`;
        } catch (err) { fail(err); status.textContent = ''; submit.disabled = false; }
      });
    });
  }

  // =====================================================================
  //  Sorteio: todo domingo às 22h (Brasília) o banco sorteia entre os
  //  inscritos com presença registrada em todas as Guerras das Sombras da semana.
  //  Membros: inscrever/retirar e ver o resultado. Staff: painel e remoções.
  // =====================================================================
  state.raffles = [];
  state.raffleRemovals = [];
  state.raffleError = false;
  async function loadRaffles() {
    if (!RAFFLE_ON || !isMember()) { state.raffles = []; state.raffleRemovals = []; return; }
    try {
      let list = await api.raffles();
      // Chegou a hora de algum sorteio? O banco sorteia (uma única vez) e a lista é recarregada
      if (list.some((r) => r.status === 'open' && Date.parse(r.draw_at) <= Date.now())) {
        try { await api.runRaffleDraws(); list = await api.raffles(); } catch (e) { console.warn('sorteio: sortear', e); }
      }
      state.raffles = list;
      state.raffleRemovals = isOfficer() ? await api.raffleRemovals().catch(() => []) : [];
      state.raffleError = false;
    } catch (e) {
      console.warn('sorteio', e);
      state.raffles = []; state.raffleRemovals = []; state.raffleError = true;
    }
  }
  const brt = (iso, o) => new Intl.DateTimeFormat('pt-BR', { timeZone: RAFFLE_TZ, ...o }).format(new Date(iso));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtDraw = (iso) => cap(`${brt(iso, { weekday: 'long' })}, ${brt(iso, { day: '2-digit', month: '2-digit' })} às ${brt(iso, { hour: '2-digit', hour12: false })}h (Brasília)`);
  const fmtDrawShort = (iso) => `dom ${brt(iso, { day: '2-digit', month: '2-digit' })}`;
  function prizeText(r) {
    if (r.prize_kind === 'bp_simple') return `${r.prize_qty} ${r.prize_qty > 1 ? PRIZE.bp_simple.many : PRIZE.bp_simple.label}`;
    if (r.prize_kind === 'other') return `${r.prize_qty ? `${r.prize_qty}× ` : ''}${r.prize_text || ''}`;
    return PRIZE[r.prize_kind]?.label || 'Prêmio';
  }
  // O que cada ganhador leva (um item por ganhador)
  function prizeEach(r) {
    if (r.prize_kind === 'bp_simple') return `1 ${PRIZE.bp_simple.label}`;
    if (r.prize_kind === 'other') return r.prize_qty > 1 ? `1× ${r.prize_text}` : r.prize_text || '';
    return PRIZE[r.prize_kind]?.label || 'Prêmio';
  }
  const prizeIcon = (r) => PRIZE[r.prize_kind]?.icon || '🎁';
  const winnersNote = (n) => (n > 1 ? `${n} ganhadores, 1 item para cada` : '1 ganhador');
  function untilText(iso) {
    const ms = Date.parse(iso) - Date.now();
    if (ms <= 0) return 'sorteando agora…';
    const d = Math.floor(ms / 864e5); const h = Math.floor((ms % 864e5) / 36e5); const m = Math.floor((ms % 36e5) / 6e4);
    if (d) return `faltam ${d} dia${d > 1 ? 's' : ''}${h ? ` e ${h}h` : ''}`;
    if (h) return `faltam ${h}h${m ? ` ${m}min` : ''}`;
    return `faltam ${Math.max(1, m)} min`;
  }
  const sortedWinners = (r) => [...(r.winners || [])].sort((a, b) => a.position - b.position);
  // Troféu dourado
  const trophy = (cls = '') => `<svg class="trophy ${cls}" viewBox="0 0 64 64" aria-hidden="true">
      <defs><linearGradient id="trophy-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".45" stop-color="#e9b949"/><stop offset="1" stop-color="#9c6a17"/></linearGradient></defs>
      <path fill="url(#trophy-gold)" fill-rule="evenodd" d="M18 6H46V12H56V18C56 26 50 32 43 33C41 38 38 41 34 42V48H42V54H22V48H30V42C26 41 23 38 21 33C14 32 8 26 8 18V12H18ZM14 18C14 22 17 26 20 27C19 24 18 21 18 18ZM46 18C46 21 45 24 44 27C47 26 50 22 50 18Z"/>
      <rect x="18" y="56" width="28" height="4" rx="1.5" fill="url(#trophy-gold)"/></svg>`;

  // Notificações do sininho (o que mudou desde a última visita à página do sorteio)
  const raffleSeenKey = () => `raffle-seen-${state.user?.id}`;
  const raffleSeen = () => { try { return Date.parse(localStorage.getItem(raffleSeenKey()) || '') || 0; } catch { return 0; } };
  const markRaffleSeen = () => { try { localStorage.setItem(raffleSeenKey(), new Date().toISOString()); } catch { /* ignora */ } };
  function raffleBell(mine, lead) {
    if (!RAFFLE_ON) return;
    const me = state.user.id;
    const since = Math.max(raffleSeen(), Date.now() - 14 * 86400e3);
    const fresh = (iso) => !!iso && Date.parse(iso) > since;
    state.raffles.forEach((r) => {
      const my = (r.entries || []).find((e) => e.user_id === me);
      if (r.status === 'drawn' && fresh(r.drawn_at) && (r.winners || []).some((w) => w.user_id === me)) {
        mine.push({ icon: '🏆', text: '<b>Você ganhou o sorteio!</b>', sub: 'Entre em contato com a staff para retirar seu prêmio', href: '#/sorteio' });
      }
      if (my?.removed_at && fresh(my.removed_at)) {
        mine.push({ icon: '⚠️', text: 'Você foi <b>removido do sorteio</b>', sub: `Sorteio de ${esc(fmtDrawShort(r.draw_at))} · entre em contato com a staff`, href: '#/sorteio' });
      }
      if (r.status === 'open' && Date.parse(r.draw_at) > Date.now() && !my && fresh(r.created_at)) {
        mine.push({ icon: '🎟️', text: `Sorteio aberto: <b>${esc(prizeText(r))}</b>`, sub: `${esc(fmtDrawShort(r.draw_at))} às 22h · inscreva-se`, href: '#/sorteio' });
      }
    });
    // Para a staff: remoções feitas pelos outros (quem removeu não recebe o próprio alerta)
    if (isOfficer()) {
      state.raffleRemovals.filter((x) => x.removed_by !== me && x.user_id !== me && fresh(x.removed_at)).forEach((x) => {
        lead.push({ icon: '🎟️', text: `<b>${esc(nameOf(x.user_id))}</b> foi removido do sorteio`, sub: `Por ${esc(nameOf(x.removed_by))}: “${esc(x.removed_reason || '')}”`, href: '#/sorteio' });
      });
    }
  }

  let raffleTimer = null;
  const RAFFLE_RESULT_DAYS = 6; // por quantos dias o resultado fica em destaque no topo
  async function viewRaffle() {
    renderHeader('raffle');
    clearTimeout(raffleTimer);
    const me = state.user.id;
    const staff = isOfficer();
    const now = Date.now();
    const byDate = (a, b) => Date.parse(a.draw_at) - Date.parse(b.draw_at);
    const open = state.raffles.filter((r) => r.status === 'open').sort(byDate);
    const drawn = state.raffles.filter((r) => r.status === 'drawn').sort((a, b) => byDate(b, a));
    const latest = drawn[0];
    const showResult = !!latest && now - Date.parse(latest.draw_at) < RAFFLE_RESULT_DAYS * 86400e3;
    const history = drawn.flatMap((r) => sortedWinners(r).map((w) => ({ ...w, raffle: r }))).slice(0, 3);
    const staffData = {};
    if (staff && open.length) {
      const rows = await Promise.all(open.map((r) => api.raffleStaff(r.id).catch((e) => { console.warn('sorteio: painel', e); return null; })));
      open.forEach((r, i) => { staffData[r.id] = rows[i]; });
    }

    const resultCard = (r) => `<div class="card raffle-result">
        <h2>🏆 Resultado do sorteio</h2>
        <div class="muted small">${esc(fmtDraw(r.draw_at))} · Prêmio: <b>${esc(prizeText(r))}</b>${r.winners_count > 1 ? ' (1 item para cada ganhador)' : ''}</div>
        ${r.winners?.length ? `<ul class="raffle-winners">${sortedWinners(r).map((w) => `<li class="raffle-winner${w.user_id === me ? ' me' : ''}">
            ${trophy()}
            <div><div class="raffle-winner-name">${esc(nameOf(w.user_id))}${w.user_id === me ? ' <span class="badge gold">Você</span>' : ''}</div>
              <div class="raffle-congrats">Parabéns, entre em contato com a staff para retirar seu prêmio!</div></div>
          </li>`).join('')}</ul>`
          : '<p class="muted" style="margin:12px 0 0">Nenhum inscrito estava elegível neste sorteio.</p>'}
      </div>`;

    const openCard = (r) => {
      const my = (r.entries || []).find((e) => e.user_id === me);
      const closed = Date.parse(r.draw_at) <= now;
      let note = ''; let btn = '';
      if (closed) note = '<p class="small rc-note">⏳ Sorteando… o resultado aparece em instantes.</p>';
      else if (my?.removed_at) note = '<p class="small rc-note bad">⚠️ Sua inscrição foi removida pela staff. Entre em contato com a staff.</p>';
      else if (my) {
        note = '<p class="small rc-note ok">✔ Você está inscrito neste sorteio.</p>';
        btn = `<button class="btn ghost" data-rf-leave="${r.id}">Retirar inscrição</button>`;
      } else btn = `<button class="btn primary" data-rf-join="${r.id}">🎟️ Quero participar</button>`;
      return `<div class="card raffle-card">
        <div class="raffle-prize"><span class="raffle-ic" aria-hidden="true">${prizeIcon(r)}</span>
          <div><div class="muted small">Prêmio</div><div class="raffle-prize-name">${esc(prizeText(r))}</div><div class="muted small">${winnersNote(r.winners_count)}</div></div></div>
        <div class="raffle-when">📅 ${esc(fmtDraw(r.draw_at))}${closed ? '' : ` · <span class="muted">${esc(untilText(r.draw_at))}</span>`}</div>
        ${note}${btn ? `<div class="row raffle-actions">${btn}</div>` : ''}
      </div>`;
    };

    const historyHtml = history.length
      ? `<div class="section-head"><h2>Últimos sorteados</h2></div>
        <div class="card raffle-history">${history.map((h) => `<div class="raffle-hist-row">${trophy('sm')}
          <div><b>${esc(nameOf(h.user_id))}</b><div class="muted small">${esc(prizeEach(h.raffle))} · ${esc(fmtDrawShort(h.raffle.draw_at))}</div></div></div>`).join('')}</div>`
      : `<div class="raffle-history-empty"><button class="btn ghost" id="rf-history" aria-expanded="false">🏆 Conferir últimos sorteios</button>
          <p class="muted small" id="rf-history-msg" hidden>Ainda não houve nenhum sorteado. O primeiro resultado aparece aqui depois do próximo sorteio.</p></div>`;

    main.innerHTML = `
      <div class="page-head"><h1>Sorteio</h1>${staff && can('raffle_manage') ? '<button class="btn primary" id="btn-new-rf">+ Ativar sorteio</button>' : ''}</div>
      <p class="muted small">Quando a staff ativa um sorteio, o site sorteia <b>no domingo às 22h (horário de Brasília)</b> um membro inscrito e elegível para cada item do prêmio.
        Para concorrer, inscreva-se e tenha <b>presença registrada nas duas Guerras das Sombras da semana</b>.</p>
      ${staff && !isLeader() && can('raffle_manage') && permMode('raffle_manage') === 'approval' ? '<p class="small rc-note">⏳ Os sorteios que você ativar, editar ou cancelar só valem depois que o líder aprovar. Acompanhe em “Solicitações”.</p>' : ''}
      ${staff && state.raffleError ? '<div class="card attend-sum warn">O sorteio ainda não está ativo no banco. Rode no Supabase o arquivo <code>supabase/sorteio.sql</code> e recarregue a página.</div>' : ''}
      ${showResult ? resultCard(latest) : ''}
      ${open.length ? `<div class="section-head"><h2>${open.length > 1 ? 'Próximos sorteios' : 'Próximo sorteio'}</h2></div>${open.map(openCard).join('')}`
        : `<div class="card empty">Nenhum sorteio ativado no momento.${staff
          ? (can('raffle_manage') ? '<br><br>Sem um sorteio ativado, nada é sorteado no domingo. Ative um em “+ Ativar sorteio”.' : '<br><br>Sem um sorteio ativado, nada é sorteado no domingo. O líder não permite que oficiais ativem sorteios.')
          : ' A staff avisa quando houver um novo.'}</div>`}
      ${historyHtml}
      ${staff ? raffleStaffPanel(open, drawn, staffData) : ''}`;

    markRaffleSeen();
    renderBell();

    const run = async (fn, msg) => { try { await fn(); if (msg) toast(msg); } catch (e) { fail(e); } await route(); };
    main.querySelectorAll('[data-rf-join]').forEach((b) => b.addEventListener('click', () =>
      run(() => api.joinRaffle(Number(b.dataset.rfJoin)), 'Inscrição feita! Esteja presente nas duas Guerras das Sombras da semana para concorrer.')));
    main.querySelectorAll('[data-rf-leave]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Retirar sua inscrição deste sorteio? Você pode se inscrever de novo até o horário do sorteio.', 'Retirar'))) return;
      run(() => api.leaveRaffle(Number(b.dataset.rfLeave)), 'Inscrição retirada');
    }));
    $('#rf-history')?.addEventListener('click', (e) => {
      const msg = $('#rf-history-msg');
      msg.hidden = !msg.hidden;
      e.currentTarget.setAttribute('aria-expanded', String(!msg.hidden));
    });
    $('#btn-new-rf')?.addEventListener('click', () => openRaffleForm());
    main.querySelectorAll('[data-rf-edit]').forEach((b) => b.addEventListener('click', () => openRaffleForm(state.raffles.find((r) => r.id === Number(b.dataset.rfEdit)))));
    main.querySelectorAll('[data-rf-delete]').forEach((b) => b.addEventListener('click', async () => {
      const r = state.raffles.find((x) => x.id === Number(b.dataset.rfDelete));
      if (!r || !(await confirmDialog(`Cancelar o sorteio de ${fmtDraw(r.draw_at)} (${prizeText(r)})? As inscrições dele são apagadas.`, 'Cancelar sorteio'))) return;
      run(() => api.deleteRaffle(r.id), 'Sorteio cancelado');
    }));
    main.querySelectorAll('[data-rf-remove]').forEach((b) => b.addEventListener('click', () =>
      openRaffleRemove(state.raffles.find((r) => r.id === Number(b.dataset.rfRemove)), b.dataset.user)));

    // Quem está na página no horário do sorteio vê o resultado sem recarregar
    const next = open.find((r) => Date.parse(r.draw_at) > now);
    const wait = next ? Date.parse(next.draw_at) - now : 0;
    if (next && wait < 2 * 86400e3) raffleTimer = setTimeout(() => { if (currentRouteKey() === 'raffle') route(); }, wait + 2500);
  }

  // Painel da staff: inscritos, elegibilidade, remoções e sorteios anteriores
  function raffleStaffPanel(open, drawn, staffData) {
    const canManage = can('raffle_manage');
    const canRemove = can('raffle_remove');
    const card = (r) => {
      const d = staffData[r.id];
      const wars = d?.wars || [];
      const checks = [...(d?.checks || [])].sort((a, b) => (b.eligible - a.eligible) || norm(nameOf(a.user_id)).localeCompare(norm(nameOf(b.user_id))));
      const removed = state.raffleRemovals.filter((x) => x.raffle_id === r.id);
      const unreg = wars.filter((w) => !w.registered).length;
      const closed = Date.parse(r.draw_at) <= Date.now();
      const nElig = checks.filter((c) => c.eligible).length;
      const situation = (c) => {
        if (c.eligible) return '<span class="rf-st ok">✔ Elegível</span>';
        if (!ACTIVE_ROLES.includes(memberById(c.user_id)?.role)) return '<span class="rf-st bad">✖ Fora do clã</span>';
        if (!c.wars_total) return '<span class="rf-st bad">✖ Sem Guerras na semana</span>';
        const missing = c.wars_total - c.wars_present;
        // Faltas que ainda podem virar presença (Guerras sem presença registrada) = aguardando
        return missing > unreg
          ? `<span class="rf-st bad">✖ Faltou em ${plural(missing - unreg, 'Guerra', 'Guerras')}</span>`
          : '<span class="rf-st wait">⏳ Aguardando registro de presença</span>';
      };
      const warn = !d ? 'Não foi possível carregar a situação dos inscritos.'
        : !wars.length ? 'Nenhuma Guerra das Sombras cadastrada nesta semana: ninguém fica elegível.'
        : wars.length !== 2 ? `Esta semana tem ${plural(wars.length, 'Guerra das Sombras cadastrada', 'Guerras das Sombras cadastradas')}; para ser elegível, o membro precisa estar presente em todas.`
        : unreg ? 'Registre a presença das Guerras antes do horário do sorteio: sem presença registrada, o membro não concorre.' : '';
      return `<div class="card raffle-staff">
        <div class="row">
          <span class="raffle-ic sm" aria-hidden="true">${prizeIcon(r)}</span>
          <div class="spacer"><b>${esc(prizeText(r))}</b><div class="muted small">${esc(fmtDraw(r.draw_at))} · ${winnersNote(r.winners_count)}</div></div>
          ${canManage && !closed ? `<button class="btn small ghost" data-rf-edit="${r.id}">Editar</button><button class="btn small ghost danger" data-rf-delete="${r.id}">Cancelar sorteio</button>` : ''}
        </div>
        <div class="rf-wars"><span class="muted small">Guerras das Sombras da semana:</span>
          ${wars.length ? wars.map((w) => `<span class="rf-war ${w.registered ? 'ok' : 'wait'}">⚔️ ${esc(fmtShortWeekday(w.starts_at))} ${esc(fmtShortDate(w.starts_at))} · ${w.registered ? 'presença registrada' : 'presença não registrada'}</span>`).join('') : '<span class="muted small">nenhuma</span>'}
        </div>
        ${warn ? `<p class="small rc-note">${warn}</p>` : ''}
        <div class="muted small rf-counts"><b>${checks.length}</b> inscrito${checks.length === 1 ? '' : 's'} · <b>${nElig}</b> elegíve${nElig === 1 ? 'l' : 'is'} · <b>${removed.length}</b> removido${removed.length === 1 ? '' : 's'}</div>
        <div class="rf-list">${checks.length ? checks.map((c) => {
          const p = memberById(c.user_id);
          return `<div class="rf-row">
            <span class="rf-who">${avatar(p)}<b>${esc(nameOf(c.user_id))}</b></span>
            <span class="rf-count muted small" title="Presenças nas Guerras das Sombras da semana">${c.wars_present}/${c.wars_total} Guerras</span>
            ${situation(c)}
            ${canRemove && !closed ? `<button class="btn small ghost danger" data-rf-remove="${r.id}" data-user="${esc(c.user_id)}">Remover</button>` : '<span></span>'}
          </div>`;
        }).join('') : '<p class="muted small" style="margin:0">Ninguém se inscreveu ainda.</p>'}</div>
        ${removed.length ? `<h3 class="rf-sub">Removidos</h3><div class="rf-list">${removed.map((x) => `<div class="rf-removed">
            <b>${esc(nameOf(x.user_id))}</b> <span class="muted small">· por ${esc(nameOf(x.removed_by))} em ${esc(fmtWhen(x.removed_at))}</span>
            <div class="small">“${esc(x.removed_reason || '')}”</div></div>`).join('')}</div>` : ''}
      </div>`;
    };
    return `<div class="section-head"><h2>Painel da staff</h2></div>
      <p class="muted small">Só a staff vê esta parte. Quem tiver a inscrição removida recebe um aviso para falar com a staff; os outros oficiais e o líder são avisados com o motivo.</p>
      ${open.length ? open.map(card).join('') : '<div class="card empty">Nenhum sorteio ativado.</div>'}
      ${drawn.length ? `<div class="section-head"><h2>Sorteios realizados</h2></div>
        <div class="card rf-past">${drawn.slice(0, 10).map((r) => `<div class="rf-past-row">
          <div><b>${esc(fmtDrawShort(r.draw_at))}</b> · ${esc(prizeText(r))}</div>
          <div class="small">${r.winners?.length ? sortedWinners(r).map((w) => `🏆 ${esc(nameOf(w.user_id))}`).join(' · ') : '<span class="muted">Sem ganhadores</span>'}
            <span class="muted">· ${plural(r.eligible_count || 0, 'elegível', 'elegíveis')}</span></div>
        </div>`).join('')}</div>` : ''}`;
  }

  function openRaffleRemove(r, userId) {
    if (!r) return;
    openDialog(`<form id="rfr-form" class="stack">
        <h2>Remover do sorteio</h2>
        <p class="muted small" style="margin:0">Remover <b>${esc(nameOf(userId))}</b> do sorteio de ${esc(fmtDraw(r.draw_at))}.
          O membro recebe um aviso para entrar em contato com a staff, e os outros oficiais e o líder são avisados com o motivo.</p>
        <div class="field"><label for="rfr-reason">Motivo <span class="muted small">(obrigatório)</span></label>
          <textarea id="rfr-reason" required minlength="5" maxlength="300" placeholder="Ex.: conta compartilhada com outro jogador"></textarea></div>
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn danger">Remover</button></div>
      </form>`, (d) => {
      $('#rfr-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const reason = $('#rfr-reason', d).value.trim();
        if (reason.length < 5) { toast('Escreva o motivo da remoção (pelo menos 5 letras)', true); return; }
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.removeRaffleEntry(r.id, userId, reason);
          dlg.close();
          toast('Inscrição removida. O membro e a staff foram avisados.');
          await route();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  function openRaffleForm(r) {
    const editing = !!r;
    const used = new Set(state.raffles.filter((x) => x.id !== r?.id).map((x) => Date.parse(x.draw_at)));
    const dates = nextDrawDates(8).filter((d) => !used.has(d.getTime()));
    if (editing && !dates.some((d) => d.getTime() === Date.parse(r.draw_at))) dates.unshift(new Date(r.draw_at));
    if (!dates.length) { toast('Os próximos 8 domingos já têm sorteio', true); return; }
    const kind = r?.prize_kind || 'bp_simple';
    const opt = (key, inner) => `<label class="rf-opt"><input type="radio" name="rf-kind" value="${key}" ${kind === key ? 'checked' : ''}> ${inner}</label>`;
    openDialog(`<form id="rf-form" class="stack">
        <h2>${editing ? 'Editar sorteio' : 'Ativar sorteio'}</h2>
        <div class="field"><label for="rf-when">Data do sorteio</label>
          <select id="rf-when" required>${dates.map((d) => `<option value="${d.toISOString()}" ${editing && d.getTime() === Date.parse(r.draw_at) ? 'selected' : ''}>${esc(fmtDraw(d.toISOString()))}</option>`).join('')}</select>
          <div class="muted small field-hint">O sorteio é sempre aos domingos às 22h (horário de Brasília).</div></div>
        <fieldset class="rf-prizes"><legend>O que será sorteado</legend>
          ${opt('bp_simple', `${PRIZE.bp_simple.icon} <select id="rf-qty-simple" class="inline" aria-label="Quantidade de passes">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${r?.prize_kind === 'bp_simple' && r.prize_qty === n ? 'selected' : ''}>${n}</option>`).join('')}</select> Passe(s) de Batalha Simples`)}
          ${opt('bp_boosted', `${PRIZE.bp_boosted.icon} 1 Passe de Batalha Potencializado`)}
          ${opt('prodigy', `${PRIZE.prodigy.icon} 1 Via do Prodígio`)}
          ${opt('other', `${PRIZE.other.icon} Outros`)}
          <div class="rf-other" ${kind === 'other' ? '' : 'hidden'}>
            <div class="field"><label for="rf-text">O que será sorteado</label>
              <input id="rf-text" maxlength="100" placeholder="Ex.: Pacote de Platinas" value="${esc(r?.prize_kind === 'other' ? r.prize_text || '' : '')}"></div>
            <div class="field"><label for="rf-qty-other">Quantidade <span class="muted small">(opcional, de 1 a 10)</span></label>
              <input id="rf-qty-other" type="number" min="1" max="10" inputmode="numeric" value="${r?.prize_kind === 'other' && r.prize_qty ? r.prize_qty : ''}"></div>
          </div>
        </fieldset>
        <p class="small rc-note" id="rf-winners"></p>
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${editing ? 'Salvar' : 'Ativar sorteio'}</button></div>
      </form>`, (d) => {
      const read = () => {
        const k = $('input[name=rf-kind]:checked', d)?.value;
        return {
          draw_at: $('#rf-when', d).value, prize_kind: k,
          prize_qty: k === 'bp_simple' ? $('#rf-qty-simple', d).value : k === 'other' ? $('#rf-qty-other', d).value.trim() : 1,
          prize_text: k === 'other' ? $('#rf-text', d).value : null,
        };
      };
      const update = () => {
        const k = $('input[name=rf-kind]:checked', d)?.value;
        $('.rf-other', d).hidden = k !== 'other';
        const note = $('#rf-winners', d);
        try {
          const c = cleanRaffleRow(read());
          note.textContent = c.winners_count > 1
            ? `Serão sorteados ${c.winners_count} ganhadores diferentes; cada um leva ${prizeEach(c)}.`
            : `Será sorteado 1 ganhador, que leva ${prizeText(c)}.`;
        } catch { note.textContent = k === 'other' ? 'Escreva o que será sorteado.' : ''; }
      };
      d.querySelectorAll('input, select').forEach((el) => { el.addEventListener('input', update); el.addEventListener('change', update); });
      $('#rf-qty-simple', d).addEventListener('focus', () => { $('input[value=bp_simple]', d).checked = true; update(); });
      update();
      $('#rf-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          const row = read();
          cleanRaffleRow(row);
          if (editing) await api.updateRaffle(r.id, row); else await api.createRaffle(row);
          dlg.close();
          toast(editing ? 'Sorteio atualizado' : 'Sorteio ativado! Os membros já podem se inscrever.');
          await route();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  // ---------- Painel individual do membro (menu "Meu perfil") ----------

  const P = { days: 90 };

  // Sem userId = o próprio perfil. Oficiais e líder podem abrir o perfil de qualquer membro.
  async function viewMyPanel(userId) {
    const targetId = userId || state.user.id;
    const self = targetId === state.user.id;
    // Oficiais veem qualquer perfil; membros veem o próprio e o das contas que pilotam
    if (!self && !isOfficer() && !canActAs(targetId)) { location.hash = '#/perfil'; return; }
    loading();
    const since = P.days ? new Date(Date.now() - P.days * 86400000).toISOString() : null;
    const showNotes = !self && can('notes') && !canActAs(targetId);
    const [members, past, upcoming, changes, allNotes, mlog, pilots, absences] = await Promise.all([
      api.members(), api.history(since), api.events(false), api.profileHistory(), showNotes ? api.notes() : Promise.resolve([]),
      api.membershipLog(targetId).catch(() => []), // se o banco ainda não tiver o histórico, mostra vazio
      api.pilots().catch(() => state.pilots || []),
      api.absences().catch(() => null), // null = o SQL das ausências ainda não foi rodado
    ]);
    state.pilots = pilots;
    state.members = members;
    const me = members.find((m) => m.id === targetId) || (self ? state.me : null);
    if (!me) { main.innerHTML = `<div class="card empty">Membro não encontrado.<br><br>${backBtn('#/membros', 'Voltar')}</div>`; return; }
    const phone = !self && can('view_phone') ? (await api.contacts()).find((c) => c.user_id === me.id)?.phone : null;
    const who = displayName(me);
    const [f] = computeFrequency(past, [me]);
    const myChanges = changes.filter((h) => h.user_id === me.id);
    const teamIn = (ev) => ev.team_slots?.find((s) => s.user_id === me.id)?.team;

    // Sequência atual de presenças (do evento mais recente para trás)
    let streak = 0;
    for (const h of f.history) { if (h.was) streak++; else break; }

    const pctClass = (p) => (p == null ? 'muted' : p >= 0.75 ? 'c-yes' : p >= 0.5 ? 'c-gold' : 'c-no');
    const pctText = (p) => (p == null ? '—' : `${Math.round(p * 100)}%`);
    const periodLabel = P.days ? `últimos ${P.days} dias` : 'todo o histórico';

    // Próximos eventos com a minha resposta e o meu time
    const po = isPilotOnly(me); // membro piloto: sem frequência, médias e evolução (só as contas que pilota contam)
    const pending = po ? 0 : upcoming.filter((ev) => !ev.rsvps.some((r) => r.user_id === me.id)).length;
    const upRows = upcoming.slice(0, 8).map((ev) => {
      const r = ev.rsvps.find((x) => x.user_id === me.id);
      const ans = po ? '' : !r ? (self ? '<span class="badge warn">Responder</span>' : '<span class="muted small">Sem resposta</span>')
        : r.going ? `<span class="c-yes small">✔ Vou${r.discord ? ' · 🎧' : ''}</span>` : '<span class="c-no small">✖ Não vou</span>';
      const t = teamIn(ev);
      return `<a class="ev-row" href="#/evento/${ev.id}">
        <span class="ev-date">${fmtShortDate(ev.starts_at)}<small>${fmtTime(ev.starts_at)}</small></span>
        <span class="ev-title">${esc(ev.title)}${t ? `<small>🛡 ${esc(t)}</small>` : ''}</span>${ans}</a>`;
    }).join('');

    // Últimos eventos com presença registrada
    const statusOf = (h) => (h.was ? ['Presente', 'c-yes'] : h.r?.going ? ['Confirmou e faltou', 'c-gold']
      : h.r ? ['Avisou que não ia', 'muted'] : ['Faltou sem responder', 'c-no']);
    const recentRows = f.history.slice(0, 10).map((h) => {
      const [label, cls] = statusOf(h);
      const t = teamIn(h.ev);
      return `<a class="ev-row" href="#/evento/${h.ev.id}">
        <span class="ev-date">${fmtShortDate(h.ev.starts_at)}<small>${fmtTime(h.ev.starts_at)}</small></span>
        <span class="ev-title">${esc(h.ev.title)}${t ? `<small>🛡 ${esc(t)}</small>` : ''}</span>
        <span class="${cls} small">${label}</span></a>`;
    }).join('');

    // Meus atributos comparados com a média do clã e com a mesma faixa de Ressonância.
    // Membro comum não recebe os atributos de todos: médias, faixa e rank vêm prontos do banco (power_overview).
    let pw = null;
    try { pw = await powerOverview(me); } catch (e) { pw = null; }
    if (!pw && !isOfficer() && hasBuild(me)) {
      // Só enquanto o supabase/rank_forca.sql não for executado: usa a média do clã antiga
      const avgs = await api.clanAverages().catch(() => null);
      if (avgs) pw = { clan: { count: avgs.count || 0, avg: avgs }, band: null, unavailable: true };
    }
    const cmpRows = (avg, groupLabel) => ATTRS.map((a) => {
      const mean = avg && Number.isFinite(Number(avg[a.key])) ? Math.round(Number(avg[a.key])) : null;
      const mineVal = me[a.key];
      const scale = Math.max(mineVal, mean || 0) * 1.1 || 1;
      const diff = mean ? (mineVal - mean) / mean : 0;
      return `<div class="cmp-row">
        <span class="cmp-label">${a.label}</span>
        <div class="cmp-track" title="${self ? 'Você' : esc(who)}: ${fmtNum(mineVal)} · ${groupLabel}: ${fmtNum(mean)}">
          <span class="me" style="width:${(100 * mineVal) / scale}%"></span>
          <span class="clan" style="width:${(100 * (mean || 0)) / scale}%"></span>
        </div>
        <span class="cmp-val"><b>${fmtNum(mineVal)}</b><small>${groupLabel === 'Média do clã' ? 'clã' : 'faixa'} ${fmtNum(mean)}</small></span>
        <span class="cmp-diff ${diff >= 0 ? 'c-yes' : 'c-no'}">${diff >= 0 ? '+' : ''}${Math.round(diff * 100)}%</span>
      </div>`;
    }).join('');
    const noBuild = `<p class="muted">${self ? 'Informe sua classe e seus atributos em “Editar perfil” para comparar com o clã.' : 'Este membro ainda não informou classe e atributos.'}</p>`;
    const clanCount = pw?.clan?.count || 0;
    const cmp = !hasBuild(me) ? noBuild : pw ? cmpRows(pw.clan.avg, 'Média do clã') : '<p class="muted">Não foi possível carregar a média do clã.</p>';
    // Mesma faixa de Ressonância (±500)
    const band = pw?.band;
    const bandHtml = !hasBuild(me) ? noBuild
      : !band ? '<p class="muted">Comparação indisponível no momento.</p>'
        : !band.count ? `<p class="muted">Nenhum outro membro com Ressonância entre ${fmtNum(band.lo)} e ${fmtNum(band.hi)}.</p>`
          : cmpRows(band.avg, 'Média da faixa');

    main.innerHTML = `
      ${self ? '' : backRow('#/membros', 'Membros')}
      <div class="page-head">
        <h1>${self ? 'Meu perfil' : 'Perfil do membro'}</h1>
        <select class="inline" id="p-days" aria-label="Período"${po ? ' hidden' : ''}>
          ${[[30, 'Últimos 30 dias'], [90, 'Últimos 90 dias'], [0, 'Todo o histórico']].map(([v, l]) => `<option value="${v}" ${P.days === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>

      <div class="card me-card">
        <div class="row">
          ${avatar(me, 'xl')}
          <div class="spacer">
            <div class="me-name">${esc(displayName(me))}${medalsHtml(me.id, 4)}${me.role === 'former' ? ' <span class="badge former-badge">Ex-membro</span>' : ''}</div>
            <div class="muted small">${me.game_name ? `${esc(me.google_name)} · ` : ''}${ROLE_LABEL[me.role]}${me.created_at ? ` · no clã desde ${new Date(me.created_at).toLocaleDateString('pt-BR')}` : ''}${phone ? ` · <a href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">📞 ${esc(phone)}</a>` : ''}</div>
            ${po ? `<div class="member-build"><span class="pilot-kind">🧑‍✈️ Membro piloto</span>${me.pilot_note ? `<span class="muted small">pilota: ${esc(me.pilot_note)}</span>` : ''}</div>`
              : me.char_class ? `<div class="member-build">${classTag(me.char_class)} <span>${esc(CLASS[me.char_class].label)}</span><span class="chip-stats">${statsLine(me)}</span></div>` : ''}
            ${!po && me.is_pilot ? '<div class="muted small">🧑‍✈️ Também é piloto</div>' : ''}
          </div>
          ${self ? `<div class="row me-actions"><button class="btn small" id="btn-photo-pf">📷 ${me.custom_avatar_url ? 'Trocar foto' : 'Enviar foto'}</button><button class="btn small" id="btn-edit-pf">✎ Editar perfil</button></div>`
            : canRename(me) || canChangeKind(me) ? `<div class="row me-actions">${canRename(me) ? '<button class="btn small" id="btn-rename">✎ Editar nick</button>' : ''}${canChangeKind(me) ? `<button class="btn small" id="btn-kind">${po ? '🎮 Tornar jogador' : '🧑‍✈️ Tornar membro piloto'}</button>` : ''}</div>` : ''}
        </div>
      </div>

      ${po ? '' : `<div class="stats" style="margin-top:12px">
        <div class="card stat"><div class="stat-num ${pctClass(f.pct)}">${pctText(f.pct)}</div><div class="muted small">${self ? 'sua frequência' : 'frequência'} (${periodLabel})</div></div>
        <div class="card stat"><div class="stat-num">${f.present}<span class="muted" style="font-size:1rem">/${f.total}</span></div><div class="muted small">presenças em eventos registrados</div></div>
        <div class="card stat"><div class="stat-num c-gold">${streak}</div><div class="muted small">${streak === 1 ? 'presença seguida' : 'presenças seguidas'} (sequência atual)</div></div>
        <div class="card stat"><div class="stat-num ${f.noShow ? 'c-no' : 'c-yes'}">${f.noShow}</div><div class="muted small">vezes que confirmou e faltou</div></div>
      </div>`}

      ${powerRankCard(me, self, pw)}
      ${po ? '' : evoCard()}

      <div class="panels">
        ${po ? '' : `<div class="card">
          <h2>${self ? 'Você' : esc(who)} × média do clã</h2>
          <div class="cmp-legend small"><span><i class="lg me"></i>${self ? 'Você' : esc(who)}</span><span><i class="lg clan"></i>Média de ${clanCount} membros</span></div>
          ${cmp}
        </div>
        <div class="card">
          <h2>${self ? 'Você' : esc(who)} × mesma faixa</h2>
          <div class="cmp-legend small"><span><i class="lg me"></i>${self ? 'Você' : esc(who)}</span><span><i class="lg clan"></i>${hasBuild(me) && band ? `Média de ${band.count} ${band.count === 1 ? 'membro' : 'membros'} com Ressonância ${fmtNum(band.lo)}–${fmtNum(band.hi)}` : 'Mesma faixa de Ressonância (±500)'}</span></div>
          ${bandHtml}
        </div>`}
        <div class="card">
          <h2>Próximos eventos ${pending ? `<span class="badge warn">${pending} sem resposta</span>` : ''}</h2>
          ${upRows || '<p class="muted">Nenhum evento agendado.</p>'}
        </div>
        ${po ? '' : `<div class="card">
          <h2>Últimos eventos</h2>
          ${recentRows || '<p class="muted">Ainda não há eventos com presença registrada neste período.</p>'}
        </div>`}
        <div class="card">
          <h2>Histórico de alterações</h2>
          <div class="hist">${histItemsHtml(myChanges) || '<p class="muted">Nenhuma alteração registrada ainda.</p>'}</div>
        </div>
        ${absences && !po && ACTIVE_ROLES.includes(me.role) && (canActAs(me.id) || isOfficer()) ? absencesCard(me, absences) : ''}
      </div>
      ${pilotsCard(me, self)}
      ${membershipCard(mlog.filter((h) => h.user_id === me.id), members)}
      ${leaveCard(me)}
      ${ticketsCard(me, self)}
      ${showNotes ? notesCard(me, allNotes.filter((n) => n.member_id === me.id), members) : ''}`;

    $('#btn-edit-pf')?.addEventListener('click', () => openProfile());
    // Trocar a foto direto do painel, sem abrir o formulário
    $('#btn-photo-pf')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      pickImageFile(async (file) => {
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = 'Enviando…';
        try { if (await uploadAvatarFile(file)) await viewMyPanel(userId); } catch (err) { fail(err); }
        finally { if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = label; } }
      });
    });
    $('#btn-rename')?.addEventListener('click', () => openRenameDialog(me, () => viewMyPanel(userId)));
    $('#btn-kind')?.addEventListener('click', () => openKindDialog(me, () => viewMyPanel(userId)));
    $('#btn-pr-fill')?.addEventListener('click', () => openProfile());
    $('#btn-pr-info')?.addEventListener('click', () => openPowerInfo(me, pw));
    if (!po) bindEvo(me, myChanges, self);
    bindPilotsCard(me, () => viewMyPanel(userId));
    bindAbsences(me, absences || [], () => viewMyPanel(userId));
    bindLeave(me, () => viewMyPanel(userId));
    $('#p-days').addEventListener('change', (e) => { P.days = Number(e.target.value); viewMyPanel(userId); });

    // Anotações internas
    $('#note-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ta = $('#note-body');
      const body = ta.value.trim();
      if (!body) return;
      e.submitter && (e.submitter.disabled = true);
      try { await api.addNote(me.id, body); toast('Anotação adicionada'); await viewMyPanel(userId); } catch (err) { fail(err); if (e.submitter) e.submitter.disabled = false; }
    });
    main.querySelectorAll('[data-del-note]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Apagar esta anotação? Não dá para desfazer.', 'Apagar'))) return;
      try { await api.deleteNote(Number(b.dataset.delNote)); toast('Anotação apagada'); await viewMyPanel(userId); } catch (err) { fail(err); }
    }));
  }

  // ---------- Rank de força (perfil) ----------
  // Cada atributo vira uma nota de 0 a 100 comparada ao melhor do clã; a pontuação (0 a 1000) é a média ponderada.
  // A mesma conta existe no banco (supabase/rank_forca.sql, função power_overview).
  const POWER_WEIGHTS = { resonance: 0.5, armor: 0.175, armor_pen: 0.175, potency: 0.075, resistance: 0.075 };
  const POWER_BAND = 500;
  function computePower(list, person) {
    const max = Object.fromEntries(ATTRS.map((a) => [a.key, Math.max(0, ...list.map((m) => m[a.key] || 0))]));
    const rows = list.map((m) => ({
      m,
      score: Math.round(10 * ATTRS.reduce((s, a) => s + (POWER_WEIGHTS[a.key] || 0) * (max[a.key] ? (100 * (m[a.key] || 0)) / max[a.key] : 0), 0)),
    })).sort((a, b) => (b.score - a.score) || byName(a.m, b.m));
    const avgOf = (g) => Object.fromEntries(ATTRS.map((a) => [a.key, g.length ? Math.round(g.reduce((s, m) => s + (m[a.key] || 0), 0) / g.length) : null]));
    const idx = rows.findIndex((r) => r.m.id === person.id);
    const sameClass = idx < 0 ? [] : rows.filter((r) => r.m.char_class === rows[idx].m.char_class);
    const res = person.resonance || 0;
    const lo = Math.max(0, res - POWER_BAND);
    const hi = res + POWER_BAND;
    const band = list.filter((m) => m.id !== person.id && m.resonance >= lo && m.resonance <= hi);
    const best = Object.fromEntries(ATTRS.map((a) => {
      const b = list.reduce((x, m) => ((m[a.key] || 0) > (x?.[a.key] || 0) ? m : x), null);
      return [a.key, b ? { value: b[a.key], name: displayName(b) } : null];
    }));
    return {
      clan: { count: list.length, avg: avgOf(list) },
      band: { lo, hi, count: band.length, avg: avgOf(band) },
      best,
      total: rows.length,
      top: rows.slice(0, 10),
      me: idx < 0 ? null : { pos: idx + 1, score: rows[idx].score, cls_pos: sameClass.findIndex((r) => r.m.id === person.id) + 1, cls_total: sameClass.length },
    };
  }
  // Oficiais e líder têm a lista completa e fazem a conta no navegador.
  // O membro comum recebe do banco só o resultado (médias, Top 10, posição e o melhor de cada atributo).
  async function powerOverview(person) {
    if (isOfficer()) return computePower(activePlayers().filter(hasBuild), person);
    const d = await api.powerOverview(person.id);
    if (!d) return null;
    const asRow = (r) => ({ m: r.id === person.id ? person : { id: r.id, game_name: r.game_name, google_name: '', char_class: r.char_class }, score: r.score });
    return { ...d, top: (d.top || []).map(asRow) };
  }
  const ordinal = (n) => `${n}º`;
  // ---------- Evolução do personagem ----------
  // Pontos de um atributo ao longo do tempo, a partir do histórico de alterações do perfil
  function evoSeries(person, changes, key) {
    const list = changes.filter((h) => h.changes && h.changes[key])
      .map((h) => ({ t: Date.parse(h.changed_at), from: h.changes[key][0], to: h.changes[key][1] }))
      .filter((h) => Number.isFinite(h.t)).sort((a, b) => a.t - b.t);
    const pts = [];
    const fmtD = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    // Valor antes da primeira alteração registrada (marcado um dia antes dela)
    if (list.length && list[0].from != null) {
      const t = list[0].t - 86400000;
      pts.push({ t, v: Number(list[0].from), label: fmtD(t), tip: `${fmtD(t)}: ${fmtNum(Number(list[0].from))} (valor inicial)` });
    }
    list.forEach((h) => { if (h.to != null) pts.push({ t: h.t, v: Number(h.to), label: fmtD(h.t), tip: `${fmtD(h.t)}: ${fmtNum(Number(h.to))}` }); });
    // Até hoje, com o valor atual
    const now = Date.now(); const cur = person[key];
    if (pts.length && cur != null && now - pts[pts.length - 1].t > 3600e3) pts.push({ t: now, v: Number(cur), label: 'hoje', tip: `Hoje: ${fmtNum(Number(cur))}`, dot: false });
    return { pts, last: list.length ? list[list.length - 1].t : null };
  }

  function evoCard() {
    return `<div class="card evo-card">
      <h2>📈 Evolução do personagem</h2>
      <div class="evo-tabs" role="tablist">${ATTRS.slice().sort((a, b) => (a.key === 'resonance' ? -1 : b.key === 'resonance' ? 1 : 0))
        .map((a) => `<button type="button" class="evo-tab" role="tab" data-evo="${a.key}">${esc(a.label)}</button>`).join('')}</div>
      <div id="evo-body"></div>
    </div>`;
  }

  function bindEvo(person, changes, self) {
    const body = $('#evo-body');
    if (!body) return;
    const show = (key) => {
      document.querySelectorAll('.evo-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.evo === key)));
      const attr = ATTRS.find((a) => a.key === key);
      const { pts, last } = evoSeries(person, changes, key);
      if (pts.length < 2) {
        body.innerHTML = `<p class="muted small evo-empty">Ainda não há alterações de ${esc(attr.label)} registradas. O gráfico aparece quando ${self ? 'você atualizar' : 'o perfil for atualizado'} com um valor novo.</p>`;
        return;
      }
      const first = pts[0].v; const cur = pts[pts.length - 1].v; const diff = cur - first;
      const pct = first ? (diff / first) * 100 : null;
      const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
      const cls = diff > 0 ? 'c-yes' : diff < 0 ? 'c-no' : 'muted';
      const since = new Date(pts[0].t).toLocaleDateString('pt-BR');
      // Maior valor já registrado (só aparece quando o atual está abaixo dele)
      const top = pts.reduce((b, p, i) => (p.v > b.p.v ? { p, i } : b), { p: pts[0], i: 0 });
      const topWhen = top.i === 0 && pts[0].tip.includes('valor inicial')
        ? `antes de ${new Date(pts[1].t).toLocaleDateString('pt-BR')}` : `em ${new Date(top.p.t).toLocaleDateString('pt-BR')}`;
      // Destaque no canto superior direito do quadro
      const peak = top.p.v > cur ? `<div class="evo-peak-box" title="Maior valor de ${esc(attr.label)} já registrado">
          <span class="evo-peak-label">🏔️ Maior já registrado</span>
          <span class="evo-peak-num">${fmtNum(top.p.v)}</span>
          <span class="evo-peak-sub">${topWhen} · <b>${fmtNum(top.p.v - cur)}</b> acima do atual</span>
        </div>` : '';
      body.innerHTML = `<div class="evo-sum">
          <span class="evo-gain ${cls}">${sign}${fmtNum(Math.abs(diff))}</span>
          <span class="small">de ${esc(attr.label)} desde ${since}${pct != null && diff ? ` <b class="${cls}">(${sign}${Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</b>` : ''}<br>
          <span class="muted">Agora: <b>${fmtNum(cur)}</b>${last ? ` · última atualização em ${new Date(last).toLocaleDateString('pt-BR')}` : ''}</span></span>
          ${peak}
        </div>
        ${lineChart(pts.map((p, i) => (i === top.i ? { ...p, record: true } : p)), { time: true, aria: `${attr.label} ao longo do tempo` })}
        <div class="evo-legend small"><span><i class="lg-record" aria-hidden="true"></i>Recorde de ${esc(attr.label)}: <b>${fmtNum(top.p.v)}</b> (${topWhen})</span></div>`;
    };
    document.querySelectorAll('.evo-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.evo)));
    show('resonance');
  }

  // Ranking sem fotos (proteção de dados): cada jogador é uma armadura.
  // 1º ouro, 2º prata, 3º bronze (um pouco maiores); do 4º em diante, todas iguais.
  const ARMOR_PATH = 'M12.5 7.2h7c1-1.2 2.5-2.2 4.5-2.2l5 3-2 6-3-1v11c0 3-3.5 5-8 6-4.5-1-8-3-8-6V13l-3 1-2-6 5-3c2 0 3.5 1 4.5 2.2z';
  function rankArmor(pos) {
    const tier = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : 'base';
    const label = { gold: '1º lugar (ouro)', silver: '2º lugar (prata)', bronze: '3º lugar (bronze)' }[tier] || `${pos}º lugar`;
    return `<span class="pr-armor ${tier}" title="${label}" aria-hidden="true"><svg viewBox="0 0 32 32">
      <path d="${ARMOR_PATH}" fill="currentColor"/>
      <path d="M16 9.5v19.5M11.5 14.5h9M12 20h8" stroke="rgba(0,0,0,.32)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M9.5 13.5v9.8c0 1.3.7 2.4 2 3.2" stroke="rgba(255,255,255,.35)" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    </svg></span>`;
  }

  function powerRankCard(person, self, pw) {
    if (!pw || pw.unavailable) {
      return `<div class="card pr-card" style="margin-top:12px"><h2>💪 Rank de força</h2><p class="muted">O rank de força ainda não está disponível.</p></div>`;
    }
    const mine = pw.me;
    const cls = CLASS[person.char_class];
    const rowHtml = (r, i) => `<li class="${r.m.id === person.id ? 'me' : ''}">
          <span class="pr-n">${i + 1}</span>${rankArmor(i + 1)}
          <span class="pr-name">${esc(displayName(r.m))}${medalsHtml(r.m.id)}</span>${classTag(r.m.char_class)}
          <span class="pr-score">${r.score}</span></li>`;
    const head = isPilotOnly(person)
      ? `<div class="pr-missing">🧑‍✈️ ${self ? 'Você é membro piloto: membros piloto' : 'Membros piloto'} não entram no rank. Contam só as contas que ${self ? 'você pilota' : 'essa pessoa pilota'}.</div>`
      : !mine
      ? `<div class="pr-missing">${self
        ? `Complete sua classe e os 5 atributos no perfil para entrar no rank.${state.me.id === person.id ? ' <button class="btn small primary" id="btn-pr-fill" type="button">Completar perfil</button>' : ''}`
        : 'Este membro ainda não completou a classe e os 5 atributos, então não entra no rank.'}</div>`
      : `<div class="pr-pos">
          <div class="card stat"><div class="stat-num c-gold">${ordinal(mine.pos)}<span class="muted" style="font-size:1rem"> de ${pw.total}</span></div><div class="muted small">no clã</div></div>
          <div class="card stat"><div class="stat-num">${ordinal(mine.cls_pos)}<span class="muted" style="font-size:1rem"> de ${mine.cls_total}</span></div><div class="muted small">entre ${cls ? `os ${esc(cls.label)}` : 'a mesma classe'}</div></div>
          <div class="card stat"><div class="stat-num">${mine.score}</div><div class="muted small">pontos de força (de 1000)</div></div>
        </div>`;
    const top = pw.top || [];
    return `<div class="card pr-card" style="margin-top:12px">
      <h2>💪 Rank de força <button class="pr-info" id="btn-pr-info" type="button" title="Como a pontuação é calculada" aria-label="Como a pontuação é calculada">!</button></h2>
      ${head}
      <h3 class="pr-sub">Top 10 do clã</h3>
      ${top.length ? `<ol class="pr-top">${top.map(rowHtml).join('')}${mine && mine.pos > 10 ? `<li class="pr-gap" aria-hidden="true">⋯</li>${rowHtml({ m: person, score: mine.score }, mine.pos - 1)}` : ''}</ol>` : '<p class="muted">Ninguém completou o perfil ainda.</p>'}
    </div>`;
  }
  // Janela do "!": explica a conta, com os melhores do clã e a conta deste membro
  function openPowerInfo(person, pw) {
    if (!pw || pw.unavailable) return;
    const ranked = !!pw.me;
    const fmtW = (w) => `${String(Math.round(w * 1000) / 10).replace('.', ',')}%`;
    const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
    let total = 0;
    const rows = [...ATTRS].sort((a, b) => (POWER_WEIGHTS[b.key] || 0) - (POWER_WEIGHTS[a.key] || 0)).map((a) => {
      const w = POWER_WEIGHTS[a.key] || 0;
      const best = pw.best?.[a.key];
      const max = best?.value || 0;
      const nota = max ? (100 * (person[a.key] || 0)) / max : 0;
      const pts = 10 * w * nota;
      total += pts;
      return `<tr><td>${esc(a.label)}</td><td>${fmtW(w)}</td>
        <td>${fmtNum(max)}${best ? `<br><span class="muted small">${esc(best.name)}</span>` : ''}</td>
        ${ranked ? `<td>${fmtNum(person[a.key])}</td><td>${fmt1(nota)}</td><td><b>${fmt1(pts)}</b></td>` : ''}</tr>`;
    }).join('');
    const self = person.id === state.me.id;
    openDialog(`<div class="stack pr-help">
      <h2>Como é calculada a pontuação</h2>
      <ol class="small">
        <li>Cada atributo é comparado com o <b>maior valor do clã</b> naquele atributo e vira uma nota de 0 a 100. Ter o maior valor = nota 100; metade do maior = nota 50.</li>
        <li>Cada nota é multiplicada pelo peso do atributo e as notas são somadas. O total vai de 0 a 1000.</li>
        <li>Para ter 1000 pontos, é preciso ser o melhor do clã nos 5 atributos ao mesmo tempo.</li>
        <li>Como a comparação é com o clã, a pontuação pode mudar quando outro membro evolui.</li>
        <li>Só entra no rank quem preencheu a classe e os 5 atributos no perfil.</li>
      </ol>
      <div class="pr-table-wrap"><table class="pr-table small">
        <thead><tr><th>Atributo</th><th>Peso</th><th>Melhor do clã</th>${ranked ? `<th>${self ? 'Você' : esc(displayName(person))}</th><th>Nota</th><th>Pontos</th>` : ''}</tr></thead>
        <tbody>${rows}</tbody>
        ${ranked ? `<tfoot><tr><td colspan="5">Total</td><td><b>${Math.round(total)}</b></td></tr></tfoot>` : ''}
      </table></div>
      <div class="row end"><button class="btn primary" data-close>Entendi</button></div>
    </div>`);
  }

  // ---------- Tickets no perfil ----------
  // No próprio perfil: todos os meus (inclusive anônimos). No perfil de outra pessoa (liderança): só os não anônimos.
  function ticketsCard(person, self) {
    if (!TICKETS_ON || !(self || supportOn())) return '';
    const list = (state.tickets || [])
      .filter((t) => (self ? t.mine : !t.anonymous && t.author_id === person.id))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const open = list.filter((t) => t.status !== 'resolved').length;
    return `<div class="card" style="margin-top:12px">
      <h2>${self ? 'Meus tickets' : 'Tickets abertos por este membro'} ${open ? `<span class="badge warn">${open} em aberto</span>` : ''}</h2>
      ${list.length ? `<div class="tk-mini-list">${list.map((t) => {
        const cat = TICKET_CAT[t.category] || TICKET_CAT.other;
        return `<a class="tk-mini" href="#/ticket/${t.id}">
          <span aria-hidden="true">${cat.icon}</span>
          <span class="spacer"><b>${esc(t.title)}</b>${t.anonymous ? ' <span class="muted small">🕶️ anônimo</span>' : ''}<br><span class="muted small">${esc(cat.label)} · aberto em ${esc(fmtShortDate(t.created_at))}${t.assigned_to && !self ? ` · com ${esc(t.assigned_to === state.user.id ? 'você' : nameOf(t.assigned_to))}` : ''}</span></span>
          <span class="badge tk-st tk-st-${esc(t.status)}">${esc(TICKET_STATUS[t.status] || t.status)}</span>
        </a>`;
      }).join('')}</div>` : `<p class="muted">${self ? 'Você ainda não abriu nenhum ticket.' : 'Nenhum ticket aberto por este membro.'}</p>`}
      ${!self ? '<p class="muted small" style="margin:8px 0 0">Tickets enviados de forma anônima não aparecem aqui.</p>' : ''}
    </div>`;
  }

  // ---------- Contas pilotadas no perfil ----------

  // ---------- Ausência programada ----------
  function absencesCard(account, list) {
    const today = localDay();
    const mineOnly = list.filter((a) => a.user_id === account.id);
    const open = mineOnly.filter((a) => a.ends_on >= today).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    const past = mineOnly.filter((a) => a.ends_on < today).sort((a, b) => b.starts_on.localeCompare(a.starts_on)).slice(0, 5);
    const own = account.id === state.user.id;
    const row = (a, live) => {
      const now = a.starts_on <= today && a.ends_on >= today;
      // Membro comum não recebe os nomes da staff: aparece só "pela staff"
      const by = a.created_by && a.created_by !== account.id
        ? ` · registrada ${memberById(a.created_by) ? `por ${esc(nameOf(a.created_by))}` : 'pela staff'}` : '';
      return `<div class="abs-row${now ? ' now' : ''}">
        <div class="spacer"><b>✈️ ${esc(fmtDay3(a.starts_on))} a ${esc(fmtDay3(a.ends_on))}</b> ${now ? `<span class="badge warn">${a.ends_on === today ? 'termina hoje' : 'em andamento'}</span>` : live ? '<span class="badge">programada</span>' : ''}
          <div class="muted small">“${esc(a.reason || '')}”${by}</div></div>
        ${live && !(now && a.ends_on === today) ? `<button class="btn small ghost danger" data-abs-del="${a.id}">${now ? 'Encerrar' : 'Cancelar'}</button>` : ''}
      </div>`;
    };
    return `<div class="card abs-card">
      <div class="row"><h2 class="spacer" style="margin:0">✈️ Ausências</h2><button class="btn small" id="btn-abs-new" type="button">Programar ausência</button></div>
      <p class="muted small">Os eventos do período ficam “Não vou” e não contam como falta. Motivo visível só para ${own ? 'você' : 'a conta'} e a liderança.</p>
      ${open.length ? open.map((a) => row(a, true)).join('') : '<p class="muted small" style="margin:0">Nenhuma ausência programada.</p>'}
      ${past.length ? `<details class="abs-past"><summary class="small">Ausências anteriores</summary>${past.map((a) => row(a, false)).join('')}</details>` : ''}
    </div>`;
  }

  function bindAbsences(account, list, reload) {
    $('#btn-abs-new')?.addEventListener('click', () => {
      const today = localDay();
      const week = localDay(new Date(Date.now() + 6 * 86400000));
      openDialog(`
        <form id="abs-form" class="stack">
          <h2>✈️ Programar ausência${account.id === state.user.id ? '' : ` · ${esc(displayName(account))}`}</h2>
          <p class="muted small" style="margin:0">Todos os eventos do período ficam “Não vou” e não contam como falta. Se já tiver confirmado “Vou” em algum, ele também muda (enquanto o prazo estiver aberto).</p>
          <div class="row" style="gap:12px">
            <div class="field spacer"><label for="abs-start">De</label><input type="date" id="abs-start" required min="${today}" value="${today}"></div>
            <div class="field spacer"><label for="abs-end">Até</label><input type="date" id="abs-end" required min="${today}" value="${week}"></div>
          </div>
          <div class="field">
            <label for="abs-reason">Motivo <span class="muted small">(obrigatório; só você e a liderança veem)</span></label>
            <textarea id="abs-reason" maxlength="300" required placeholder="Ex.: viagem, trabalho, sem internet…"></textarea>
          </div>
          <p class="small c-no" id="abs-msg" hidden></p>
          <div class="row end">
            <button type="button" class="btn ghost" data-close>Cancelar</button>
            <button type="submit" class="btn primary">Programar</button>
          </div>
        </form>`, (d) => {
        const msg = (t) => { const m = $('#abs-msg', d); m.hidden = !t; m.textContent = t || ''; };
        $('#abs-start', d).addEventListener('change', (e) => { const end = $('#abs-end', d); end.min = e.target.value; if (end.value < e.target.value) end.value = e.target.value; });
        $('#abs-form', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const start = $('#abs-start', d).value; const end = $('#abs-end', d).value; const reason = $('#abs-reason', d).value.trim();
          if (!start || !end) { msg('Informe as duas datas.'); return; }
          if (end < start) { msg('A data final precisa ser depois da inicial.'); return; }
          if (!reason) { msg('Informe o motivo da ausência.'); $('#abs-reason', d).focus(); return; }
          const b = $('button[type=submit]', d); b.disabled = true; msg('');
          try {
            const r = await api.saveAbsence(account.id, start, end, reason);
            dlg.close();
            const n = r?.changed || 0;
            toast(`Ausência programada${n ? ` · ${n} ${n === 1 ? 'evento marcado' : 'eventos marcados'} como “Não vou”` : ''}`);
            await reload();
          } catch (err) { msg(err?.message || String(err)); b.disabled = false; }
        });
      });
    });
    document.querySelectorAll('[data-abs-del]').forEach((btn) => btn.addEventListener('click', async () => {
      const a = list.find((x) => x.id === Number(btn.dataset.absDel));
      if (!a) return;
      const now = a.starts_on <= localDay();
      if (!(await confirmDialog(now
        ? 'Encerrar esta ausência hoje? A data final passa a ser hoje e os eventos dos próximos dias voltam a ficar sem resposta.'
        : 'Cancelar esta ausência? Os eventos do período voltam a ficar sem resposta.', now ? 'Encerrar' : 'Cancelar ausência'))) return;
      try { await api.deleteAbsence(a.id); toast(now ? 'Ausência encerrada' : 'Ausência cancelada'); await reload(); } catch (err) { fail(err); }
    }));
  }

  // ---------- Sair do clã (pedido com aprovação da liderança) ----------
  function leaveCard(account) {
    const mine = canActAs(account.id);
    const open = pendingLeaves().find((l) => l.user_id === account.id);
    const last = (state.leaves || []).filter((l) => l.user_id === account.id && l.status === 'rejected')
      .sort((a, b) => Date.parse(b.decided_at) - Date.parse(a.decided_at))[0];
    const self = account.id === state.user.id;
    if (open) {
      const who = open.requested_by && open.requested_by !== open.user_id ? ` por ${esc(nameOf(open.requested_by))}` : '';
      return `<div class="card leave-card pending">
        <h2>🚪 Pedido para sair do clã</h2>
        <p class="small" style="margin:0">Enviado${who} em ${new Date(open.requested_at).toLocaleDateString('pt-BR')} · <b>aguardando a liderança</b></p>
        <p class="muted small">Motivo: “${esc(open.reason)}”</p>
        <div class="row" style="gap:8px">
          ${mine ? `<button class="btn small ghost" data-leave-cancel="${open.id}">Desistir do pedido</button>` : ''}
          ${canDecideLeave(open) ? `<span class="spacer"></span><button class="btn small ghost danger" data-leave-deny="${open.id}">Recusar</button>
            <button class="btn small primary" data-leave-ok="${open.id}">Aprovar saída</button>` : ''}
        </div>
      </div>`;
    }
    if (!mine || !['member', 'officer'].includes(account.role)) return '';
    return `<div class="card leave-card">
      <h2>🚪 Sair do clã</h2>
      <p class="muted small" style="margin:0">Após sair do clã, ${self ? 'você não terá' : 'a conta não terá'} mais acesso ao site.</p>
      ${last ? `<p class="small c-no" style="margin:6px 0 0">O último pedido foi recusado em ${new Date(last.decided_at).toLocaleDateString('pt-BR')}${last.note ? `: “${esc(last.note)}”` : ''}.</p>` : ''}
      <div class="row end"><button class="btn small ghost danger" id="btn-leave">Pedir para sair do clã</button></div>
    </div>`;
  }

  function bindLeave(account, reload) {
    $('#btn-leave')?.addEventListener('click', () => {
      const self = account.id === state.user.id;
      openDialog(`
        <form id="leave-form" class="stack">
          <h2>🚪 Sair do clã${self ? '' : ` · ${esc(displayName(account))}`}</h2>
          <p class="small" style="margin:0">Após sair do clã, ${self ? 'você não terá' : 'a conta não terá'} mais acesso ao site.${self ? ' O bloqueio vale assim que o pedido for enviado.' : ''}</p>
          <div class="field">
            <label for="leave-reason">Motivo <span class="muted small">(obrigatório; a liderança vê)</span></label>
            <textarea id="leave-reason" maxlength="300" required placeholder="Ex.: vou parar de jogar, mudei de clã…"></textarea>
          </div>
          <p class="le-msg small bad" id="leave-msg" hidden></p>
          <div class="row end">
            <button type="button" class="btn ghost" data-close>Cancelar</button>
            <button type="submit" class="btn danger">Enviar pedido</button>
          </div>
        </form>`, (d) => {
        $('#leave-form', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const reason = $('#leave-reason', d).value.trim();
          const msg = $('#leave-msg', d);
          if (!reason) { msg.hidden = false; msg.textContent = 'Informe o motivo da saída.'; return; }
          const b = $('button[type=submit]', d); b.disabled = true;
          try {
            await api.requestLeave(account.id, reason);
            dlg.close(); toast('Pedido enviado. A liderança vai analisar.');
            await loadLeaves();
            if (self) { location.hash = '#/'; await route(); } else await reload();
          } catch (err) { msg.hidden = false; msg.textContent = err?.message || String(err); b.disabled = false; }
        });
      });
    });
    bindLeaveDecisions(reload);
    document.querySelectorAll('[data-leave-cancel]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Desistir do pedido para sair do clã?', 'Desistir'))) return;
      try { await api.cancelLeave(Number(b.dataset.leaveCancel)); toast('Pedido cancelado'); await loadLeaves(); await reload(); } catch (err) { fail(err); }
    }));
  }

  // Aprovar / recusar (perfil e página Membros)
  function bindLeaveDecisions(reload) {
    const open = (id, approve) => {
      const l = pendingLeaves().find((x) => x.id === id);
      if (!l) return;
      const name = esc(displayName(memberById(l.user_id)));
      openDialog(`
        <form id="leave-dec" class="stack">
          <h2>${approve ? 'Aprovar saída do clã' : 'Recusar pedido de saída'}</h2>
          <p class="small" style="margin:0">${approve ? `<b>${name}</b> perde o acesso ao site e vai para <b>Ex-membros</b>. O histórico é mantido e dá para readmitir depois.` : `<b>${name}</b> continua no clã.`}</p>
          <p class="muted small" style="margin:0">Motivo informado: “${esc(l.reason)}”</p>
          <div class="field">
            <label for="leave-note">Observação <span class="muted small">(opcional${approve ? '' : '; a pessoa vê'})</span></label>
            <textarea id="leave-note" maxlength="300"></textarea>
          </div>
          <div class="row end">
            <button type="button" class="btn ghost" data-close>Cancelar</button>
            <button type="submit" class="btn ${approve ? 'danger' : 'primary'}">${approve ? 'Aprovar saída' : 'Recusar pedido'}</button>
          </div>
        </form>`, (d) => {
        $('#leave-dec', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const b = $('button[type=submit]', d); b.disabled = true;
          try {
            await api.decideLeave(l.id, approve, $('#leave-note', d).value.trim());
            dlg.close(); toast(approve ? `${displayName(memberById(l.user_id))} saiu do clã` : 'Pedido recusado');
            state.members = await api.members(); await loadLeaves(); await reload();
          } catch (err) { fail(err); b.disabled = false; }
        });
      });
    };
    document.querySelectorAll('[data-leave-ok]').forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.leaveOk), true)));
    document.querySelectorAll('[data-leave-deny]').forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.leaveDeny), false)));
  }

  function pilotsCard(account, self) {
    const me = state.user.id;
    const canManage = account.id === me || isOfficer(); // dono da conta ou oficial/líder
    const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
    const rowsFor = state.pilots.filter((p) => p.account_id === account.id);
    const pilotRows = rowsFor.map((p) => {
      const pilot = memberById(p.pilot_id);
      const pending = p.status === 'pending';
      return `<div class="pilot-row${pending ? ' pending' : ''}">
        ${avatar(pilot)}
        <div class="spacer"><b>${esc(displayName(pilot))}</b>
          <div class="muted small">${pending ? `⏳ pediu em ${fmtD(p.requested_at)}` : `✔ autorizado em ${fmtD(p.decided_at)}`}${p.reason ? ` · “${esc(p.reason)}”` : ''}</div></div>
        ${pending && canManage ? `<button class="btn small ghost danger" data-pilot-deny="${esc(p.pilot_id)}">Recusar</button>
          <button class="btn small primary" data-pilot-approve="${esc(p.pilot_id)}">Aprovar</button>` : ''}
        ${!pending && (canManage || p.pilot_id === me) ? `<button class="btn small ghost danger" data-pilot-remove="${esc(p.pilot_id)}">${p.pilot_id === me ? 'Parar de pilotar' : 'Remover piloto'}</button>` : ''}
      </div>`;
    }).join('');

    // Contas que eu piloto (só no meu próprio perfil)
    const mine = self ? state.pilots.filter((p) => p.pilot_id === me) : [];
    const mineRows = mine.map((p) => {
      const acc = memberById(p.account_id);
      if (!acc) return '';
      const status = p.status === 'pending' ? '⏳ aguardando o dono da conta (ou um oficial) aprovar'
        : acc.role === 'pending' ? '⏳ conta aguardando aprovação do clã'
          : acc.role === 'former' ? 'conta fora do clã' : `✔ ${acc.managed ? 'conta sem login' : 'conta com dono'}`;
      return `<div class="pilot-row">
        ${avatar(acc)}
        <div class="spacer"><a class="member-link" href="#/membro/${encodeURIComponent(acc.id)}">${esc(displayName(acc))}</a>
          ${acc.char_class ? classTag(acc.char_class) : ''}<div class="muted small">${status}</div></div>
        <button class="btn small ghost danger" data-pilot-leave="${esc(acc.id)}">${p.status === 'pending' ? 'Cancelar pedido' : 'Parar de pilotar'}</button>
      </div>`;
    }).join('');

    // Membro piloto: a conta dele não é pilotada; mostra só as contas que ele pilota
    if (isPilotOnly(account)) {
      if (self) {
        return `<div class="card pilots-card">
          <h2>🧑‍✈️ Contas pilotadas</h2>
          <p class="muted small" style="margin:0 0 8px">Você é <b>membro piloto</b>: responde aos eventos pelas contas que pilota, escolhendo a conta no topo do site em <b>“Respondendo como”</b>.${account.pilot_note ? ` No cadastro você informou: “${esc(account.pilot_note)}”.` : ''}</p>
          <div class="row" style="margin-bottom:10px">
            <button class="btn small primary" id="btn-ask-pilot">Pedir acesso a uma conta existente</button>
            <button class="btn small" id="btn-new-piloted">+ Cadastrar conta sem login</button>
          </div>
          ${mineRows || '<p class="muted small">Nenhuma conta ainda. Peça acesso à conta que você pilota: o dono da conta (ou um oficial) aprova.</p>'}
        </div>`;
      }
      const flown = state.pilots.filter((p) => p.pilot_id === account.id);
      const flownRows = flown.map((p) => {
        const acc = memberById(p.account_id);
        if (!acc) return '';
        return `<div class="pilot-row${p.status === 'pending' ? ' pending' : ''}">
          ${avatar(acc)}
          <div class="spacer"><a class="member-link" href="#/membro/${encodeURIComponent(acc.id)}">${esc(displayName(acc))}</a> ${acc.char_class ? classTag(acc.char_class) : ''}
            <div class="muted small">${p.status === 'pending' ? `⏳ pediu em ${fmtD(p.requested_at)}` : `✔ autorizado em ${fmtD(p.decided_at)}`}${p.reason ? ` · “${esc(p.reason)}”` : ''}</div></div>
          ${isOfficer() ? `<button class="btn small ghost danger" data-unlink="${esc(acc.id)}">${p.status === 'pending' ? 'Recusar' : 'Desvincular'}</button>` : ''}
        </div>`;
      }).join('');
      return `<div class="card pilots-card">
        <h2>🧑‍✈️ Contas que pilota <span class="muted small">· membro piloto</span></h2>
        ${account.pilot_note ? `<p class="muted small" style="margin:0 0 8px">Informado no cadastro: “${esc(account.pilot_note)}”</p>` : ''}
        ${flownRows || '<p class="muted small">Ainda não pilota nenhuma conta no site.</p>'}
        ${can('pilots') ? '<button class="btn small" id="btn-link-account" style="margin-top:8px">+ Vincular conta</button>' : ''}
      </div>`;
    }
    if (!self && !rowsFor.length && !isOfficer()) return '';
    return `<div class="card pilots-card">
      <h2>🧑‍✈️ ${self ? 'Contas pilotadas' : 'Pilotos desta conta'}${account.managed ? ' <span class="muted small">· conta sem login</span>' : ''}</h2>
      ${self ? `<p class="muted small" style="margin:0 0 8px">Jogue com mais de uma conta: depois de aprovada, escolha a conta no topo do site em <b>“Respondendo como”</b>.</p>
        <div class="row" style="margin-bottom:10px">
          <button class="btn small primary" id="btn-new-piloted">+ Cadastrar conta sem login</button>
          <button class="btn small" id="btn-ask-pilot">Pedir acesso a uma conta existente</button>
        </div>
        <h3 class="pilot-sub">Contas que você pilota</h3>
        ${mineRows || '<p class="muted small">Nenhuma ainda.</p>'}
        <h3 class="pilot-sub">Quem pode pilotar a sua conta</h3>` : ''}
      ${pilotRows || `<p class="muted small">${self ? 'Ninguém pilota a sua conta.' : 'Nenhum piloto.'}</p>`}
      ${!self && can('pilots') ? '<button class="btn small" id="btn-add-pilot" style="margin-top:8px">+ Adicionar piloto</button>' : ''}
    </div>`;
  }

  function bindPilotsCard(account, refresh) {
    const done = async (msg) => {
      toast(msg);
      state.pilots = await api.pilots().catch(() => state.pilots);
      await refresh();
      renderHeader(location.hash.startsWith('#/membro/') ? 'members' : 'profile');
    };
    const run = (fn, msg) => async () => { try { await fn(); await done(msg); } catch (e) { fail(e); } };
    // (done) recarrega os vínculos, redesenha o perfil e depois o topo, para o seletor já mostrar as contas novas
    main.querySelectorAll('[data-pilot-approve]').forEach((b) => b.addEventListener('click', run(() => api.decidePilotAccess(account.id, b.dataset.pilotApprove, true), 'Piloto aprovado')));
    main.querySelectorAll('[data-pilot-deny]').forEach((b) => b.addEventListener('click', run(() => api.decidePilotAccess(account.id, b.dataset.pilotDeny, false), 'Pedido recusado')));
    main.querySelectorAll('[data-pilot-remove]').forEach((b) => b.addEventListener('click', async () => {
      const p = memberById(b.dataset.pilotRemove);
      if (!(await confirmDialog(`${b.dataset.pilotRemove === state.user.id ? 'Parar de pilotar' : `Remover ${displayName(p)} como piloto de`} ${displayName(account)}?`, 'Confirmar'))) return;
      await run(() => api.removePilot(account.id, b.dataset.pilotRemove), 'Piloto removido')();
    }));
    main.querySelectorAll('[data-pilot-leave]').forEach((b) => b.addEventListener('click', async () => {
      const acc = memberById(b.dataset.pilotLeave);
      if (!(await confirmDialog(`Deixar de pilotar ${displayName(acc)}?${acc?.managed ? ' Se ninguém mais pilotar esta conta, ela fica sem piloto até um oficial adicionar outro.' : ''}`, 'Confirmar'))) return;
      await run(() => api.removePilot(acc.id, state.user.id), 'Pronto')();
    }));
    $('#btn-new-piloted')?.addEventListener('click', () => openNewPilotedDialog(() => done('Conta cadastrada! Ela aparece para os oficiais em “Aguardando aprovação”.')));
    $('#btn-ask-pilot')?.addEventListener('click', () => openAskPilotDialog(() => done('Pedido enviado ao dono da conta (e aos oficiais)')));
    $('#btn-add-pilot')?.addEventListener('click', () => openAddPilotDialog(account, () => done('Piloto adicionado')));
    // Perfil de um membro piloto (liderança): vincular ou desvincular as contas que ele pilota
    $('#btn-link-account')?.addEventListener('click', () => openLinkAccountDialog(account, () => done('Conta vinculada ao piloto')));
    main.querySelectorAll('[data-unlink]').forEach((b) => b.addEventListener('click', async () => {
      const acc = memberById(b.dataset.unlink);
      if (!(await confirmDialog(`${displayName(account)} deixa de pilotar ${displayName(acc)}?`, 'Confirmar'))) return;
      await run(() => api.removePilot(acc.id, account.id), 'Pronto')();
    }));
  }
  // Liderança: escolhe a conta que o membro piloto vai pilotar
  function openLinkAccountDialog(pilot, after) {
    const taken = new Set(state.pilots.filter((p) => p.pilot_id === pilot.id && p.status === 'approved').map((p) => p.account_id));
    const list = activePlayers().filter((m) => m.id !== pilot.id && !taken.has(m.id)).sort(byName);
    openDialog(`<form class="stack" id="link-form">
        <h2>Vincular conta a ${esc(displayName(pilot))}</h2>
        ${pilot.pilot_note ? `<p class="muted small" style="margin:0">Informado no cadastro: “${esc(pilot.pilot_note)}”</p>` : ''}
        ${memberPickerHtml(list)}
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Vincular</button></div>
      </form>`, (d) => {
      bindPicker(d);
      // Já sugere a conta escrita no cadastro, se o nick bater
      const hint = norm(pilot.pilot_note || '');
      if (hint) {
        const guess = list.find((m) => hint.includes(norm(displayName(m))));
        if (guess) { const r = d.querySelector(`input[name=pk][value="${CSS.escape(guess.id)}"]`); if (r) r.checked = true; }
      }
      $('#link-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = d.querySelector('input[name=pk]:checked')?.value;
        if (!id) return;
        e.submitter && (e.submitter.disabled = true);
        try { await api.addPilot(id, pilot.id); dlg.close(); await after(); } catch (err) { fail(err); if (e.submitter) e.submitter.disabled = false; }
      });
    });
  }

  // Seletor de membros com busca (usado nos pedidos de piloto)
  function memberPickerHtml(list) {
    return `<input type="search" id="pk-search" placeholder="Buscar pelo nome…">
      <div class="picker">${list.map((m) => `<label class="pick-row" data-name="${esc(`${displayName(m)} ${m.google_name || ''}`.toLowerCase())}">
        <input type="radio" name="pk" value="${esc(m.id)}" required> ${avatar(m)}<span>${esc(displayName(m))}</span>${m.char_class ? classTag(m.char_class) : ''}
      </label>`).join('') || '<p class="muted small">Nenhum membro disponível.</p>'}</div>`;
  }
  function bindPicker(d) {
    $('#pk-search', d)?.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      d.querySelectorAll('.pick-row').forEach((r) => { r.hidden = !!q && !r.dataset.name.includes(q); });
    });
  }

  function openNewPilotedDialog(after) {
    openDialog(`
      <form id="np-form" class="stack">
        <h2>Cadastrar conta sem login</h2>
        <p class="small" style="margin:0">Use para uma conta do jogo que <b>só você</b> joga e que não tem login próprio no site.
          Ela vai para <b>Aguardando aprovação</b>; depois de aprovada, você responde por ela escolhendo-a em “Respondendo como”.</p>
        <div class="field"><label for="np-name">Nome do personagem</label><input id="np-name" maxlength="40" required></div>
        ${buildFields({}, true)}
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Cadastrar</button>
        </div>
      </form>`, (d) => {
      $('#np-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try { await api.createPilotedAccount($('#np-name', d).value.trim(), readBuild(d)); dlg.close(); await after(); } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  function openAskPilotDialog(after) {
    const taken = new Set(state.pilots.filter((p) => p.pilot_id === state.user.id).map((p) => p.account_id));
    const list = activePlayers().filter((m) => m.id !== state.user.id && !taken.has(m.id)).sort(byName);
    // Membro comum não recebe a lista do clã: busca a conta pelo nick (mínimo de 3 letras)
    const search = !isOfficer();
    openDialog(`
      <form id="ap-form" class="stack">
        <h2>Pedir acesso a uma conta</h2>
        <p class="small" style="margin:0">Escolha a conta que você também joga. O <b>dono da conta</b> aprova no perfil dele; se ele não puder, um oficial ou o líder aprova.</p>
        ${search ? `<input type="search" id="ap-q" placeholder="Digite o nick da conta (mínimo 3 letras)…" autocomplete="off">
          <div class="picker" id="ap-results"><p class="muted small">Digite pelo menos 3 letras do nick.</p></div>` : memberPickerHtml(list)}
        <div class="field"><label for="ap-reason">Motivo <span class="muted small">(opcional)</span></label>
          <textarea id="ap-reason" maxlength="300" placeholder="Ex.: jogo na conta dele nas Guerras"></textarea></div>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Enviar pedido</button>
        </div>
      </form>`, (d) => {
      bindPicker(d);
      const q = $('#ap-q', d);
      if (q) {
        const box = $('#ap-results', d);
        let timer = null; let seq = 0;
        q.addEventListener('input', () => {
          clearTimeout(timer);
          const text = q.value.trim();
          if (text.length < 3) { box.innerHTML = '<p class="muted small">Digite pelo menos 3 letras do nick.</p>'; return; }
          timer = setTimeout(async () => {
            const mine = ++seq;
            box.innerHTML = '<p class="muted small">Buscando…</p>';
            let found = [];
            try { found = await api.findAccounts(text); } catch (err) { fail(err); }
            if (mine !== seq) return; // chegou uma busca mais nova
            found = found.filter((m) => !taken.has(m.id));
            box.innerHTML = found.length ? found.map((m) => `<label class="pick-row">
                <input type="radio" name="pk" value="${esc(m.id)}" required> ${avatar(m)}<span>${esc(displayName(m))}</span>${m.char_class ? classTag(m.char_class) : ''}
              </label>`).join('') : '<p class="muted small">Nenhuma conta encontrada com esse nick.</p>';
          }, 350);
        });
        q.focus();
      }
      $('#ap-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = d.querySelector('input[name="pk"]:checked')?.value;
        if (!id) return;
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try { await api.requestPilotAccess(id, $('#ap-reason', d).value.trim()); dlg.close(); await after(); } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  function openAddPilotDialog(account, after) {
    const current = new Set(approvedPilotIds(account.id));
    const list = activeMembers().filter((m) => m.id !== account.id && !current.has(m.id)).sort(byName);
    openDialog(`
      <form id="adp-form" class="stack">
        <h2>Adicionar piloto · ${esc(displayName(account))}</h2>
        <p class="small" style="margin:0">O piloto passa a poder responder pelos eventos desta conta.</p>
        ${memberPickerHtml(list)}
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Adicionar</button>
        </div>
      </form>`, (d) => {
      bindPicker(d);
      $('#adp-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = d.querySelector('input[name="pk"]:checked')?.value;
        if (!id) return;
        try { await api.addPilot(account.id, id); dlg.close(); await after(); } catch (err) { fail(err); }
      });
    });
  }

  function notesCard(member, notes, members) {
    const byId = Object.fromEntries(members.map((m) => [m.id, m]));
    const canDelete = (n) => n.author_id === state.user.id || state.me.role === 'leader';
    const items = notes.map((n) => `<div class="note">
        <div class="note-head">
          <span class="note-author">${esc(displayName(byId[n.author_id]) || 'Autor removido')}</span>
          <span class="muted small">${new Date(n.created_at).toLocaleDateString('pt-BR')} · ${fmtTime(n.created_at)}</span>
          ${canDelete(n) ? `<button class="btn small ghost danger note-del" data-del-note="${n.id}" title="Apagar anotação">✕</button>` : ''}
        </div>
        <div class="note-body">${esc(n.body)}</div>
      </div>`).join('');
    return `<div class="card notes-card">
      <h2>📝 Anotações internas <span class="muted small">· só oficiais e o líder veem; ${esc(displayName(member))} não vê</span></h2>
      <form id="note-form" class="note-form">
        <textarea id="note-body" maxlength="1000" required placeholder="Ex.: avisou que troca de turno às quintas; ótimo em defesa…"></textarea>
        <button type="submit" class="btn primary small">Adicionar</button>
      </form>
      <div class="notes">${items || '<p class="muted small">Nenhuma anotação ainda.</p>'}</div>
    </div>`;
  }

  // ---------- Estatísticas do clã (tela Membros, só oficiais e líder) ----------

  const S = { open: false, type: '' };
  const STATS_DAYS = 90;
  const intFmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const pctFmt = (p) => `${Math.round(p * 100)}%`;
  const pctColor = (p) => (p >= 0.75 ? 'var(--yes)' : p >= 0.5 ? 'var(--gold)' : 'var(--no)');

  // Valor de um atributo numa data: parte do valor atual e desfaz as alterações posteriores.
  // hist deve estar do mais recente para o mais antigo. Antes da 1ª alteração, vale o 1º valor conhecido.
  function valueAt(m, key, t, hist) {
    let v = m[key];
    for (const h of hist) {
      if (Date.parse(h.changed_at) <= t) break;
      if (h.changes && key in h.changes) v = h.changes[key][0];
    }
    const n = Number(v);
    return v == null || !Number.isFinite(n) || n <= 0 ? null : n;
  }

  // Barras horizontais: [{ label | labelHtml, value, color?, valHtml?, title? }]
  function hbars(items, { max, fmt = intFmt } = {}) {
    const top = max ?? Math.max(1, ...items.map((i) => i.value));
    return `<div class="hbars">${items.map((i) => `<div class="hbar" title="${esc(i.title || `${i.label}: ${fmt(i.value)}`)}">
      <span class="hbar-label">${i.labelHtml || esc(i.label)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${Math.max(0, (i.value / top) * 100)}%${i.color ? `;background:${i.color}` : ''}"></span></span>
      <span class="hbar-val">${i.valHtml ?? fmt(i.value)}</span></div>`).join('')}</div>`;
  }

  // Colunas verticais: [{ label, title, bars: [{ v, cls }] }]
  function vcols(items) {
    const top = Math.max(1, ...items.flatMap((i) => i.bars.map((b) => b.v)));
    return `<div class="vcols">${items.map((i) => `<div class="vcol" title="${esc(i.title || i.label)}">
      <div class="vcol-bars">${i.bars.map((b) => `<span class="vbar ${b.cls || ''}" style="height:${(b.v / top) * 100}%"><em>${b.v || ''}</em></span>`).join('')}</div>
      <div class="vcol-label">${esc(i.label)}</div></div>`).join('')}</div>`;
  }

  // Barras empilhadas Sim / Não / Sem resposta
  function stackRows(rows) {
    return `<div class="stack-rows">${rows.map((r) => {
      const tot = Math.max(1, r.total);
      const seg = (n, cls, what) => (n ? `<span class="seg ${cls}" style="width:${(n / tot) * 100}%" title="${n} ${what}">${n / tot >= 0.08 ? n : ''}</span>` : '');
      return `<div class="stack-row">
        <span class="stack-label" title="${esc(r.title)}">${r.labelHtml}</span>
        <span class="stack-track">${seg(r.yes, 'yes', 'vão')}${seg(r.no, 'no', 'não vão')}${seg(r.none, 'none', 'sem resposta')}</span>
        <span class="stack-val ${r.none ? 'c-no' : 'muted'}" title="Sem resposta">${r.none ? `${r.none} ⏳` : '✓'}</span>
      </div>`;
    }).join('')}</div>`;
  }

  // opts.time: posição no eixo X pela data (p.t); opts.aria: descrição; p.tip: texto ao passar o mouse
  function lineChart(points, opts = {}) {
    const W = 640, H = 210, L = 58, R = 16, T = 16, B = 30;
    const vs = points.map((p) => p.v);
    let lo = Math.min(...vs); let hi = Math.max(...vs);
    if (hi - lo < 20) { lo -= 20; hi += 20; }
    const pad = (hi - lo) * 0.18; const y0 = lo - pad; const y1 = hi + pad;
    const t0 = opts.time ? points[0].t : 0; const tSpan = opts.time ? Math.max(1, points[points.length - 1].t - t0) : 1;
    const x = opts.time ? (i) => L + ((points[i].t - t0) * (W - L - R)) / tSpan
      : (i) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
    const y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${H - B}L${x(0).toFixed(1)},${H - B}Z`;
    const every = Math.ceil(points.length / 6);
    const last = points.length - 1;
    // Com datas, só escreve rótulos que não se encostam (o último sempre aparece)
    const showLabel = new Set();
    if (opts.time) {
      let prev = Infinity;
      for (let i = last; i >= 0; i--) if (prev - x(i) >= 80) { showLabel.add(i); prev = x(i); }
    }
    const labelAt = (i) => (opts.time ? showLabel.has(i) : (i === last || (i % every === 0 && last - i >= every)));
    return `<svg class="line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'Ressonância média ao longo do tempo')}">
      <defs><linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a2f" stop-opacity=".35"/><stop offset="1" stop-color="#ff7a2f" stop-opacity="0"/></linearGradient></defs>
      ${[lo, (lo + hi) / 2, hi].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
        <text class="axis" x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${intFmt(v)}</text>`).join('')}
      <path d="${area}" fill="url(#g-area)"/>
      <path class="line" d="${line}"/>
      ${points.map((p, i) => (p.dot === false && !p.record ? '' : `<circle class="pt${p.record ? ' record' : ''}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.record ? 7 : 4}"><title>${esc(p.tip || `${p.label}: ${intFmt(p.v)} (${p.n} membros)`)}${p.record ? ' · recorde' : ''}</title></circle>`)).join('')}
      ${points.map((p, i) => (labelAt(i)
        ? `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${opts.time && i === last ? 'end' : opts.time && i === 0 ? 'start' : 'middle'}">${esc(p.label)}</text>` : '')).join('')}
    </svg>`;
  }

  async function renderClanStats(box) {
    box.innerHTML = '<div class="muted small stats-loading">Carregando estatísticas…</div>';
    const since = new Date(Date.now() - STATS_DAYS * 86400000).toISOString();
    const [past, upcoming, histAll] = await Promise.all([
      api.history(since), api.events(false).catch(() => []), api.profileHistory().catch(() => []),
    ]);
    const members = activePlayers();
    const now = Date.now();
    const empty = (msg) => `<div class="muted small chart-empty">${msg}</div>`;
    const link = (m) => `<a class="member-link" href="#/membro/${encodeURIComponent(m.id)}">${esc(displayName(m))}</a>`;

    // ----- Composição -----
    const counts = CLASSES.map((c) => ({ c, n: members.filter((m) => m.char_class === c.key).length }))
      .sort((a, b) => b.n - a.n || a.c.label.localeCompare(b.c.label, 'pt-BR'));
    const noClass = members.filter((m) => !CLASS[m.char_class]).length;
    const classChart = hbars(counts.map(({ c, n }) => ({
      label: c.label, labelHtml: `${classTag(c.key)} ${esc(c.label)}`, value: n, color: c.color,
      title: `${c.label}: ${n} membro(s)`,
    })));

    const res = members.map((m) => Number(m.resonance)).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    let resChart = empty('Ninguém informou a Ressonância ainda.');
    let resSummary = '';
    if (res.length) {
      const lo = res[0]; const hi = res[res.length - 1];
      const step = [100, 250, 500, 1000, 2000, 5000].find((s) => Math.floor(hi / s) - Math.floor(lo / s) + 1 <= 8) || 10000;
      const bins = [];
      for (let b = Math.floor(lo / step) * step; b <= hi; b += step) bins.push({ from: b, to: b + step - 1, n: res.filter((v) => v >= b && v < b + step).length });
      resChart = vcols(bins.map((b) => ({ label: intFmt(b.from), title: `${intFmt(b.from)} a ${intFmt(b.to)}: ${b.n} membro(s)`, bars: [{ v: b.n, cls: 'pres' }] })));
      const median = res.length % 2 ? res[(res.length - 1) / 2] : (res[res.length / 2 - 1] + res[res.length / 2]) / 2;
      resSummary = `<div class="chart-foot">Média <b>${intFmt(res.reduce((s, v) => s + v, 0) / res.length)}</b> · Mediana <b>${intFmt(median)}</b> · Menor <b>${intFmt(lo)}</b> · Maior <b>${intFmt(hi)}</b></div>`;
    }

    // ----- Engajamento (filtrável por tipo) -----
    const typeOk = (e) => !S.type || (S.type === 'none' ? !e.type_id : e.type_id === Number(S.type));
    const evs = past.filter(typeOk);
    const withAtt = evs.filter((e) => e.attendance.length).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(-12);
    const presenceChart = withAtt.length ? vcols(withAtt.map((e) => {
      const conf = e.rsvps.filter((r) => r.going).length;
      const pres = e.attendance.filter((a) => a.present).length;
      return { label: fmtShortDate(e.starts_at), title: `${e.title} ${fmtShortDate(e.starts_at)}: ${conf} confirmaram, ${pres} estiveram presentes`,
        bars: [{ v: conf, cls: 'conf' }, { v: pres, cls: 'pres' }] };
    })) + '<div class="chart-legend"><span class="lg conf"></span> confirmaram <span class="lg pres"></span> estiveram presentes</div>'
      : empty('Nenhum evento com presença registrada nos últimos 90 dias.');

    const nextEvs = upcoming.filter(typeOk).slice(0, 3);
    const respEvents = [
      ...evs.slice().sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(-6).map((e) => ({ e, soon: false })),
      ...nextEvs.map((e) => ({ e, soon: true })),
    ];
    const respChart = respEvents.length ? stackRows(respEvents.map(({ e, soon }) => {
      const t = Date.parse(e.starts_at);
      const elig = members.filter((m) => soon || (Date.parse(m.created_at || 0) || 0) < t);
      const eligIds = new Set(elig.map((m) => m.id));
      const rs = e.rsvps.filter((r) => eligIds.has(r.user_id));
      const yes = rs.filter((r) => r.going).length; const no = rs.length - yes;
      return { total: elig.length, yes, no, none: elig.length - rs.length, title: `${e.title} · ${fmtShortDate(e.starts_at)}`,
        labelHtml: `${soon ? '<span class="soon-tag">próximo</span> ' : ''}<b>${fmtShortDate(e.starts_at)}</b> <span class="muted">${esc(e.title)}</span>` };
    })) + '<div class="chart-legend"><span class="lg yes"></span> vão <span class="lg no"></span> não vão <span class="lg none"></span> sem resposta</div>'
      : empty('Nenhum evento no período.');
    const nextEv = nextEvs[0];
    const pendingNames = nextEv ? members.filter((m) => !nextEv.rsvps.some((r) => r.user_id === m.id)).sort(byName) : [];
    const pendingBox = nextEv ? `<div class="pending-answer">
        <b>Ainda não responderam a <a href="#/evento/${nextEv.id}">${esc(nextEv.title)} ${fmtShortDate(nextEv.starts_at)}</a> (${pendingNames.length}):</b>
        ${pendingNames.length ? `<div class="name-chips">${pendingNames.map((m) => `<span class="name-chip">${link(m)}</span>`).join('')}</div>
          <button class="btn small" id="st-copy-pending">📋 Copiar lista</button>` : '<span class="c-yes"> todos responderam! 🎉</span>'}
      </div>` : '';

    const freq = computeFrequency(evs, members).filter((r) => r.total);
    const maxTotal = Math.max(0, ...freq.map((r) => r.total));
    const ranked = freq.filter((r) => r.total >= Math.min(3, maxTotal));
    const byPct = (dir) => (a, b) => dir * (a.pct - b.pct) || dir * (a.present - b.present) || byName(a.m, b.m);
    const best = ranked.slice().sort(byPct(-1)).slice(0, 10);
    const worst = ranked.slice().sort(byPct(1)).filter((r) => !best.includes(r)).slice(0, 10);
    const rankBars = (rows) => hbars(rows.map((r) => ({
      label: displayName(r.m), labelHtml: link(r.m), value: r.pct, color: pctColor(r.pct),
      valHtml: `${pctFmt(r.pct)} <span class="muted">${r.present}/${r.total}</span>`, title: `${displayName(r.m)}: ${r.present} de ${r.total} eventos`,
    })), { max: 1, fmt: pctFmt });

    // ----- Evolução da Ressonância -----
    const histBy = {};
    histAll.slice().sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at))
      .forEach((h) => { (histBy[h.user_id] ||= []).push(h); });
    const firstSeen = Math.min(now, ...members.map((m) => Date.parse(m.created_at || 0) || now));
    const start = Math.max(now - STATS_DAYS * 86400000, firstSeen);
    const nPts = 12;
    const stepMs = Math.max(86400000, Math.round((now - start) / (nPts - 1) / 86400000) * 86400000);
    const points = [];
    for (let t = now; t >= start - 1 && points.length < nPts; t -= stepMs) {
      const vals = members.map((m) => valueAt(m, 'resonance', t, histBy[m.id] || [])).filter((v) => v != null);
      if (vals.length) points.unshift({ label: fmtShortDate(new Date(t).toISOString()), v: vals.reduce((s, v) => s + v, 0) / vals.length, n: vals.length });
    }
    let evoChart = empty('Ainda não há histórico suficiente. O gráfico ganha forma conforme os membros atualizam a Ressonância.');
    if (points.length >= 2) {
      const diff = points[points.length - 1].v - points[0].v;
      evoChart = lineChart(points) + `<div class="chart-foot">Desde ${points[0].label}: <b class="${diff > 0 ? 'c-yes' : diff < 0 ? 'c-no' : ''}">${diff > 0 ? '+' : ''}${intFmt(diff)}</b> na média do clã</div>`;
    }
    const t30 = now - 30 * 86400000;
    const gains = members.map((m) => {
      const h = histBy[m.id] || [];
      const before = valueAt(m, 'resonance', t30, h); const after = valueAt(m, 'resonance', now, h);
      return { m, before, after, gain: before != null && after != null ? after - before : 0 };
    }).filter((g) => g.gain > 0).sort((a, b) => b.gain - a.gain || byName(a.m, b.m)).slice(0, 8);
    const gainChart = gains.length ? hbars(gains.map((g) => ({
      label: displayName(g.m), labelHtml: link(g.m), value: g.gain, color: 'var(--ember)',
      valHtml: `<b class="c-yes">+${intFmt(g.gain)}</b> <span class="muted">${intFmt(g.before)} → ${intFmt(g.after)}</span>`,
      title: `${displayName(g.m)}: ${intFmt(g.before)} → ${intFmt(g.after)}`,
    }))) : empty('Ninguém aumentou a Ressonância nos últimos 30 dias (ou ainda não atualizou no site).');

    const hasUntyped = past.some((e) => !e.type_id);
    box.innerHTML = `
      <section class="stats-section">
        <h3>🧙 Composição do clã <span class="muted small">· ${members.length} membros ativos</span></h3>
        <div class="chart-grid">
          <div class="card chart"><h4>Membros por classe</h4>${classChart}
            ${noClass ? `<div class="chart-foot">${noClass} membro(s) ainda sem classe informada</div>` : ''}</div>
          <div class="card chart"><h4>Distribuição de Ressonância</h4>${resChart}${resSummary}</div>
        </div>
      </section>
      <section class="stats-section">
        <h3>📈 Engajamento <span class="muted small">· últimos ${STATS_DAYS} dias</span>
          <select class="inline" id="st-type" aria-label="Tipo de evento">
            <option value="">Todos os tipos</option>
            ${state.types.map((t) => `<option value="${t.id}" ${S.type === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
            ${hasUntyped ? `<option value="none" ${S.type === 'none' ? 'selected' : ''}>Sem tipo</option>` : ''}
          </select></h3>
        <div class="chart-grid">
          <div class="card chart"><h4>Presença por evento</h4>${presenceChart}</div>
          <div class="card chart"><h4>Respostas por evento</h4>${respChart}${pendingBox}</div>
          <div class="card chart"><h4>🏆 Mais presentes</h4>${best.length ? rankBars(best) : empty('Sem presença registrada no período.')}</div>
          <div class="card chart"><h4>⚠️ Mais faltam</h4>${worst.length ? rankBars(worst) : empty(best.length ? 'Todos já aparecem no ranking ao lado.' : 'Sem presença registrada no período.')}</div>
        </div>
        ${ranked.length ? `<p class="muted small">O ranking conta só eventos com presença registrada${maxTotal >= 3 ? ' e membros com pelo menos 3 deles' : ''}. Detalhes na aba <a href="#/frequencia">Frequência</a>.</p>` : ''}
      </section>
      <section class="stats-section">
        <h3>💪 Evolução</h3>
        <div class="chart-grid evo">
          <div class="card chart wide"><h4>Ressonância média do clã</h4>${evoChart}
            <div class="muted small">Considera os membros ativos de hoje. Antes da primeira atualização de cada um, vale o primeiro valor informado.</div></div>
          <div class="card chart"><h4>🔥 Quem mais evoluiu (30 dias)</h4>${gainChart}</div>
        </div>
      </section>`;

    $('#st-type').addEventListener('change', (e) => { S.type = e.target.value; renderClanStats(box).catch(fail); });
    $('#st-copy-pending')?.addEventListener('click', () => {
      copy([`**Ainda não responderam: ${nextEv.title} ${fmtShortDate(nextEv.starts_at)}**`, ...pendingNames.map((m) => `• ${displayName(m)}`)].join('\n'), 'Lista copiada');
    });
  }

  // ---------- Utils: links úteis (todos os membros) ----------

  const UTIL_LINKS = [
    { icon: '🛡️', title: 'Discord da Aliança', desc: 'Servidor da nossa aliança no Discord', url: 'https://discord.gg/YncQxQ4bzB' },
    { icon: '⚔️', title: 'Builds', desc: 'Builds das classes, com itens e gemas recomendados', url: 'https://diablo.tv/builds' },
    { icon: '💎', title: 'Gemas', desc: 'Lista das gemas lendárias e seus efeitos', url: 'https://diablo.tv/legendary-gems' },
    { icon: '🏆', title: 'Rank PvP Mundial', desc: 'Ranking mundial dos jogadores', url: 'https://diablo.tv/leaderboards' },
    { icon: '💬', title: 'Reddit', desc: 'Comunidade r/DiabloImmortal: notícias, dúvidas e discussões', url: 'https://www.reddit.com/r/DiabloImmortal/' },
    { icon: '📜', title: 'Patch Notes NA', desc: 'Notícias e atualizações oficiais da Blizzard (Ocidente)', url: 'https://news.blizzard.com/en-us/feed/diablo-immortal' },
    { icon: '🐉', title: 'Patch Notes CN', desc: 'Notícias do servidor chinês, que recebe as novidades antes', url: 'https://di.blizzard.cn/news/index.html' },
    { icon: '🗣️', title: 'Fórum Oficial', desc: 'Discussão geral no fórum oficial da Blizzard', url: 'https://us.forums.blizzard.com/en/diablo-immortal/c/general-discussion/5' },
    { icon: '🧮', title: 'Calculadora de Gemas', desc: 'Calcula a Ressonância das suas gemas lendárias', url: 'https://diforge.kr/resonance-calc' },
    { icon: '🎧', title: 'Discord Oficial', desc: 'Servidor oficial do Diablo Immortal no Discord', url: 'https://discord.com/invite/QBkEExsmQa' },
  ];

  // ---------- Configurações (só o líder) ----------
  const fmtWhen = (iso) => `${new Date(iso).toLocaleDateString('pt-BR')} ${fmtTime(iso)}`;
  const STATUS_LABEL = { pending: '⏳ Aguardando o líder', approved: '✔ Aprovada', rejected: '✖ Recusada', failed: '⚠ Não aplicada' };
  const permGroupOf = (key) => PERMS.find((g) => g.items.some((i) => i.key === key))?.group || '';

  function requestRow(r, { actions = false } = {}) {
    return `<div class="req-row ${esc(r.status)}">
      <div class="spacer">
        <div><span class="req-area">${esc(permGroupOf(r.perm_key))}</span> ${esc(r.summary)}</div>
        <div class="muted small">pedido por <b>${esc(nameOf(r.requested_by))}</b> em ${fmtWhen(r.requested_at)}${r.decided_at ? ` · ${STATUS_LABEL[r.status] || ''} em ${fmtWhen(r.decided_at)}${r.decided_by && r.decided_by !== r.requested_by ? ` por ${esc(nameOf(r.decided_by))}` : ''}` : ''}${r.note ? ` · “${esc(r.note)}”` : ''}</div>
      </div>
      ${actions ? `<button class="btn small ghost danger" data-req-reject="${r.id}">Recusar</button>
        <button class="btn small primary" data-req-approve="${r.id}">Aprovar</button>` : `<span class="req-status ${esc(r.status)}">${STATUS_LABEL[r.status] || esc(r.status)}</span>`}
    </div>`;
  }

  const sqlMissingCard = () => '<div class="card attend-sum warn">As Configurações ainda não estão ativas no banco. Rode no Supabase o trecho “Configurações do líder” do arquivo <code>supabase/schema.sql</code> e recarregue a página.</div>';

  async function viewConfig() {
    if (!isLeader()) { location.hash = '#/'; return; }
    await loadPerms();
    renderHeader('config');
    const pend = pendingRequests();
    const done = perms.requests.filter((r) => r.status !== 'pending').slice(0, 15);
    main.innerHTML = `
      <div class="page-head"><h1>Configurações</h1><span class="badge gold">Só o líder</span></div>
      ${DEMO ? '<p class="muted small">Modo demonstração: as escolhas valem até recarregar a página. Para testar como oficial, use “Ver como” na faixa amarela.</p>' : ''}
      ${!DEMO && !perms.ready ? sqlMissingCard() : ''}

      <h2>Aprovações pendentes ${pend.length ? `<span class="badge warn">${pend.length}</span>` : ''}</h2>
      <div class="card req-list">${pend.length ? pend.map((r) => requestRow(r, { actions: true })).join('') : '<p class="muted small" style="margin:0">Nenhuma solicitação aguardando você.</p>'}</div>

      <div class="section-head" style="margin-top:24px"><h2>Permissões dos oficiais</h2>
        <button class="btn small ghost" id="perm-reset">Restaurar padrão (tudo permitido)</button></div>
      <p class="muted small">Você (líder) sempre pode tudo. <b>Precisa de aprovação</b>: a ação do oficial só acontece depois que você aprovar aqui. <b>Bloqueado</b>: a opção some para os oficiais e o banco recusa a ação.</p>
      ${PERMS.map((g) => `<div class="card perm-group">
        <h3>${esc(g.group)}</h3>
        ${g.items.map((p) => `<div class="perm-row">
          <div class="spacer"><b>${esc(p.label)}</b>${p.desc ? `<div class="muted small">${esc(p.desc)}</div>` : ''}</div>
          <div class="seg" role="group" aria-label="${esc(p.label)}">
            ${PERM_MODES.filter(([m]) => m !== 'approval' || p.approval).map(([m, l]) => `<button class="${permMode(p.key) === m ? 'on' : ''} mode-${m}" data-perm="${p.key}" data-mode="${m}">${l}</button>`).join('')}
          </div>
        </div>`).join('')}
      </div>`).join('')}

      ${done.length ? `<h2 style="margin-top:24px">Decisões recentes</h2><div class="card req-list">${done.map((r) => requestRow(r)).join('')}</div>` : ''}`;

    main.querySelectorAll('[data-perm]').forEach((b) => b.addEventListener('click', async () => {
      if (permMode(b.dataset.perm) === b.dataset.mode) return;
      main.querySelectorAll('[data-perm]').forEach((x) => { x.disabled = true; });
      try {
        await RAW.setPerm(b.dataset.perm, b.dataset.mode);
        toast(`${PERM_BY_KEY[b.dataset.perm].label}: ${PERM_MODES.find(([m]) => m === b.dataset.mode)[1]}`);
      } catch (e) { fail(e); }
      await viewConfig();
    }));
    $('#perm-reset').addEventListener('click', async () => {
      if (!(await confirmDialog('Voltar todas as permissões dos oficiais para “Permitido”?', 'Restaurar'))) return;
      try { await RAW.resetPerms(); toast('Permissões restauradas'); } catch (e) { fail(e); }
      await viewConfig();
    });
    main.querySelectorAll('[data-req-approve]').forEach((b) => b.addEventListener('click', async () => {
      const r = perms.requests.find((x) => x.id === Number(b.dataset.reqApprove));
      let checked;
      try { checked = await checkRequest(r); } catch (e) {
        if (await confirmDialog(`Este pedido não pode ser aplicado: ${e.message}. Marcar como “não aplicada”?`, 'Marcar')) {
          try { await RAW.decideRequest(r.id, 'failed', e.message); } catch (err) { fail(err); }
          await viewConfig();
        }
        return;
      }
      if (!(await confirmDialog(`Aprovar e aplicar agora? ${checked.text}`, 'Aprovar'))) return;
      try {
        await RAW[r.method](...checked.args);
      } catch (e) {
        fail(e);
        try { await RAW.decideRequest(r.id, 'failed', e?.message || 'Erro ao aplicar'); } catch (err) { console.error(err); }
        await viewConfig();
        return;
      }
      try { await RAW.decideRequest(r.id, 'approved', null, checked.text); toast('Aprovado e aplicado'); } catch (e) { fail(e); }
      state.members = await api.members();
      await viewConfig();
    }));
    main.querySelectorAll('[data-req-reject]').forEach((b) => b.addEventListener('click', () => {
      const r = perms.requests.find((x) => x.id === Number(b.dataset.reqReject));
      openDialog(`<form id="rj-form" class="stack">
          <h2>Recusar solicitação</h2>
          <p class="muted small" style="margin:0">${esc(r.summary)}</p>
          <div class="field"><label for="rj-note">Motivo <span class="muted small">(opcional, o oficial vê)</span></label>
            <textarea id="rj-note" maxlength="300" placeholder="Ex.: já temos evento nesse horário"></textarea></div>
          <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn danger">Recusar</button></div>
        </form>`, (d) => {
        $('#rj-form', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const submit = $('button[type=submit]', d);
          submit.disabled = true;
          try {
            await RAW.decideRequest(r.id, 'rejected', $('#rj-note', d).value.trim() || null);
            // Imagem enviada para uma edição recusada não fica guardada
            if (r.method === 'createNewsFromPath') await RAW.removeNewsImage(r.args?.[0]?.image_path).catch(() => {});
            dlg.close();
            toast('Solicitação recusada');
            await viewConfig();
          } catch (err) { fail(err); submit.disabled = false; }
        });
      });
    }));
  }

  // ---------- Minhas solicitações (oficiais) ----------
  async function viewRequests() {
    if (!isOfficer() || isLeader()) { location.hash = '#/'; return; }
    await loadPerms();
    const mine = perms.requests.filter((r) => r.requested_by === state.user.id);
    markReqSeen(); renderBell();
    const rules = PERMS.flatMap((g) => g.items).filter((p) => permMode(p.key) !== 'allow');
    main.innerHTML = `
      <div class="page-head"><h1>Minhas solicitações</h1></div>
      ${!DEMO && !perms.ready ? sqlMissingCard() : ''}
      <p class="muted small">Ações que dependem da aprovação do líder ficam aqui até ele decidir. Nada muda no clã enquanto estiverem aguardando.</p>
      <div class="card req-list">${mine.length ? mine.map((r) => requestRow(r)).join('') : '<p class="muted small" style="margin:0">Você ainda não enviou nenhuma solicitação.</p>'}</div>
      <h2 style="margin-top:24px">Regras definidas pelo líder</h2>
      <div class="card">${rules.length ? rules.map((p) => `<div class="perm-row"><span class="spacer">${esc(p.label)}</span><span class="req-status ${permMode(p.key) === 'deny' ? 'rejected' : 'pending'}">${permMode(p.key) === 'deny' ? 'Bloqueado' : 'Precisa de aprovação'}</span></div>`).join('')
        : '<p class="muted small" style="margin:0">Tudo permitido para oficiais.</p>'}</div>`;
  }

  const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // ---------- Estatísticas do clã (por ciclo do jogo; ícone 📊 ao lado do sininho) ----------
  const PANEL = { sel: 'cur', inactiveN: 3, type: '', attr: 'resonance' };
  const SIDE = { shadows: { icon: '🌑', label: 'das Sombras' }, immortal: { icon: '👑', label: 'Imortal' } };
  const DAY_MS = 86400000;
  const dmy = (t) => new Date(t).toLocaleDateString('pt-BR');
  const cycleName = (c) => `${SIDE[c.side]?.icon || ''} Ciclo ${SIDE[c.side]?.label || ''}`;
  // Ordena e calcula o fim de cada ciclo (termina quando o próximo começa)
  function cycleSpans(rows) {
    const list = rows.slice().sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    return list.map((c, i) => ({ ...c, from: Date.parse(`${c.starts_on}T00:00:00`),
      to: i < list.length - 1 ? Date.parse(`${list[i + 1].starts_on}T00:00:00`) : Infinity }));
  }
  const spanText = (p) => `${dmy(p.from)} → ${p.to === Infinity || p.to > Date.now() ? 'hoje' : dmy(p.to - 1)}`;
  // Variação em relação ao período anterior
  function deltaHtml(cur, prev, { fmt = intFmt, pct = false, invert = false } = {}) {
    if (cur == null || prev == null) return '';
    const d = cur - prev;
    if (Math.abs(d) < (pct ? 0.005 : 0.5)) return '<span class="kpi-delta muted">= ciclo anterior</span>';
    const good = invert ? d < 0 : d > 0;
    const txt = pct ? `${d > 0 ? '+' : ''}${Math.round(d * 100)} p.p.` : `${d > 0 ? '+' : ''}${fmt(d)}`;
    return `<span class="kpi-delta ${good ? 'c-yes' : 'c-no'}">${d > 0 ? '▲' : '▼'} ${txt} <span class="muted">vs. anterior</span></span>`;
  }
  const kpi = (icon, label, value, sub = '', delta = '') => `<div class="card kpi"><div class="kpi-label">${icon} ${label}</div>
    <div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub muted small">${sub}</div>` : ''}${delta}</div>`;
  const fmtHours = (h) => (h == null ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} dias`);

  async function viewPanel() {
    if (!can('panel_view')) { location.hash = '#/'; return; }
    loading();
    const [cyclesRaw, past, histAll, mlog, upcoming] = await Promise.all([
      api.cycles().catch(() => []), api.history(null), api.profileHistory().catch(() => []), api.membershipLog().catch(() => []),
      api.events(false).catch(() => []),
    ]);
    const results = await api.eventResults(past.map((e) => e.id)).catch(() => []);
    const resBy = Object.fromEntries(results.map((r) => [r.event_id, r]));
    const now = Date.now();
    const cycles = cycleSpans(cyclesRaw);
    const members = activeMembers();
    const link = (m) => (m ? `<a class="member-link" href="#/membro/${encodeURIComponent(m.id)}">${esc(displayName(m))}</a>` : '—');
    const empty = (msg) => `<div class="muted small chart-empty">${msg}</div>`;

    // ----- Período escolhido (ciclo atual, outro ciclo ou todos) -----
    let per; let prev = null;
    if (PANEL.sel === 'all') {
      const first = Math.min(now, ...past.map((e) => Date.parse(e.starts_at)), ...cycles.map((c) => c.from));
      per = { label: 'Todos os ciclos', from: first, to: now };
    } else if (cycles.length) {
      let i = PANEL.sel === 'cur' ? cycles.length - 1 : cycles.findIndex((c) => String(c.id) === String(PANEL.sel));
      if (i < 0) i = cycles.length - 1;
      const c = cycles[i];
      per = { label: cycleName(c), from: c.from, to: Math.min(c.to, now), cycle: c, cur: i === cycles.length - 1 };
      if (i > 0) prev = { from: cycles[i - 1].from, to: cycles[i - 1].to };
    } else {
      per = { label: 'Últimos 45 dias', from: now - 45 * DAY_MS, to: now };
      prev = { from: now - 90 * DAY_MS, to: now - 45 * DAY_MS };
    }
    const inSpan = (t, p) => t >= p.from && t < p.to;

    // ----- Indicadores de um período -----
    const histBy = {};
    histAll.slice().sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).forEach((h) => { (histBy[h.user_id] ||= []).push(h); });
    function metrics(p) {
      const evs = past.filter((e) => inSpan(Date.parse(e.starts_at), p));
      const wars = evs.filter((e) => resBy[e.id]).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
      const wins = wars.filter((e) => resBy[e.id].outcome === 'win').length;
      const att = evs.filter((e) => e.attendance.length);
      const rate = att.length ? att.reduce((s, e) => s + e.attendance.filter((a) => a.present).length / e.attendance.length, 0) / att.length : null;
      const joins = mlog.filter((l) => l.to_role === 'member' && ['pending', 'former'].includes(l.from_role) && inSpan(Date.parse(l.changed_at), p));
      const exits = mlog.filter((l) => l.to_role === 'former' && ACTIVE_ROLES.includes(l.from_role) && inSpan(Date.parse(l.changed_at), p));
      const tEnd = Math.min(p.to, now) - 1;
      const resAt = (t) => { const v = members.map((m) => valueAt(m, 'resonance', t, histBy[m.id] || [])).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
      const tks = (state.tickets || []).filter((t) => inSpan(Date.parse(t.created_at), p));
      const firstReply = tks.map((t) => {
        const m = (t.messages || []).find((x) => !x.internal && !x.from_author);
        return m ? (Date.parse(m.created_at) - Date.parse(t.created_at)) / 3600000 : null;
      }).filter((h) => h != null);
      return { evs, wars, wins, losses: wars.length - wins, winPct: wars.length ? wins / wars.length : null, att, rate,
        joins, exits, resStart: resAt(p.from), resEnd: resAt(tEnd), tks,
        firstReply: firstReply.length ? firstReply.reduce((s, h) => s + h, 0) / firstReply.length : null };
    }
    const M = metrics(per);
    const P = prev ? metrics(prev) : null;

    // Sequência atual (todas as Guerras até o fim do período)
    const allWars = past.filter((e) => resBy[e.id] && Date.parse(e.starts_at) < per.to).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
    let streak = 0;
    const streakKind = allWars[0] ? resBy[allWars[0].id].outcome : null;
    for (const e of allWars) { if (resBy[e.id].outcome === streakKind) streak++; else break; }

    const logAsc = mlog.slice().sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at));
    const activeAt = (t) => {
      const last = {};
      for (const l of logAsc) { if (Date.parse(l.changed_at) > t) break; last[l.user_id] = l.to_role; }
      return Object.values(last).filter((r) => ACTIVE_ROLES.includes(r)).length;
    };
    // ----- KPIs -----
    const activeEnd = per.to >= now - DAY_MS ? members.length : activeAt(per.to - 1);
    const kpis = `<div class="kpi-grid">
      ${kpi('⚔️', 'Guerras', M.wars.length ? `<span class="c-yes">${M.wins}V</span> · <span class="c-no">${M.losses}D</span>` : '—',
        M.wars.length ? `${pctFmt(M.winPct)} de vitórias${streak >= 2 ? ` · ${streak} ${streakKind === 'win' ? 'vitórias' : 'derrotas'} seguidas` : ''}` : 'Nenhum resultado registrado',
        deltaHtml(M.winPct, P?.winPct, { pct: true }))}
      ${kpi('📋', 'Presença média', M.rate == null ? '—' : pctFmt(M.rate), `${M.att.length} evento(s) com presença registrada`, deltaHtml(M.rate, P?.rate, { pct: true }))}
      ${kpi('👥', per.to >= now - DAY_MS ? 'Membros ativos' : 'Membros ativos no fim do ciclo', activeEnd, `<span class="c-yes">+${M.joins.length} entraram</span> · <span class="c-no">−${M.exits.length} saíram</span>`,
        P ? deltaHtml(M.joins.length - M.exits.length, P.joins.length - P.exits.length) : '')}
      ${kpi('💎', 'Ressonância média', M.resEnd == null ? '—' : intFmt(M.resEnd),
        M.resStart != null && M.resEnd != null ? `${M.resEnd - M.resStart >= 0 ? '+' : ''}${intFmt(M.resEnd - M.resStart)} no período` : '',
        P && M.resStart != null && P.resStart != null ? deltaHtml(M.resEnd - M.resStart, P.resEnd - P.resStart) : '')}
      ${supportOn() ? kpi('🎫', 'Tickets', M.tks.length, `1ª resposta em ${fmtHours(M.firstReply)} (média)`, deltaHtml(M.firstReply, P?.firstReply, { fmt: (h) => fmtHours(Math.abs(h)), invert: true })) : ''}
    </div>`;

    // ----- Guerras -----
    const warRow = (e) => { const r = resBy[e.id]; return `<a class="war-chip ${r.outcome}" href="#/evento/${e.id}" title="${esc(`${fmtShortDate(e.starts_at)} · ${r.outcome === 'win' ? 'Vitória' : 'Derrota'}${r.opponent ? ` contra ${r.opponent}` : ''}${scoreText(r) ? ` · ${scoreText(r)}` : ''}`)}">${r.outcome === 'win' ? 'V' : 'D'}</a>`; };
    const seq = M.wars.length ? `<div class="war-seq">${M.wars.map(warRow).join('')}</div><div class="muted small">Da mais antiga para a mais recente. Passe o mouse para ver o adversário e o placar.</div>` : empty('Nenhuma Guerra com resultado registrado neste período.');
    const cycleBars = cycles.length >= 2 ? vcols(cycles.slice(-6).map((c) => {
      const m = metrics({ from: c.from, to: Math.min(c.to, now) });
      return { label: `${SIDE[c.side].icon} ${fmtShortDate(new Date(c.from).toISOString())}`, title: `${cycleName(c)} (${spanText(c)}): ${m.wins} vitória(s), ${m.losses} derrota(s)`,
        bars: [{ v: m.wins, cls: 'win' }, { v: m.losses, cls: 'loss' }] };
    })) + '<div class="chart-legend"><span class="lg win"></span> vitórias <span class="lg loss"></span> derrotas</div>' : '';

    const opp = {};
    M.wars.forEach((e) => { const r = resBy[e.id]; const k = r.opponent || 'Não informado'; const o = (opp[k] ||= { name: k, n: 0, w: 0, us: 0, them: 0, scored: 0 });
      o.n++; if (r.outcome === 'win') o.w++; if (r.score_us != null && r.score_them != null) { o.us += r.score_us; o.them += r.score_them; o.scored++; } });
    const oppRows = Object.values(opp).sort((a, b) => b.n - a.n || b.w - a.w || a.name.localeCompare(b.name, 'pt-BR'));
    const oppTable = oppRows.length ? `<table class="mini-table"><thead><tr><th>Clã</th><th>Jogos</th><th>V–D</th><th>Placar total</th></tr></thead><tbody>
      ${oppRows.map((o) => `<tr><td>${esc(o.name)}</td><td>${o.n}</td><td><span class="c-yes">${o.w}</span>–<span class="c-no">${o.n - o.w}</span></td>
        <td>${o.scored ? `${o.us} × ${o.them}` : '—'}</td></tr>`).join('')}</tbody></table>` : empty('Sem adversários registrados no período.');

    const scored = M.wars.filter((e) => resBy[e.id].score_us != null && resBy[e.id].score_them != null);
    const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);
    const margin = (e) => resBy[e.id].score_us - resBy[e.id].score_them;
    const bigWin = scored.filter((e) => margin(e) > 0).sort((a, b) => margin(b) - margin(a))[0];
    const bigLoss = scored.filter((e) => margin(e) < 0).sort((a, b) => margin(a) - margin(b))[0];
    const evLine = (e) => `<a href="#/evento/${e.id}">${fmtShortDate(e.starts_at)}</a> ${resBy[e.id].opponent ? `contra <b>${esc(resBy[e.id].opponent)}</b>` : ''} · ${esc(scoreText(resBy[e.id]))}`;
    const dec = (n) => n.toFixed(1).replace('.', ',');
    const scoreBox = scored.length ? `<div class="score-big">${dec(avg(scored, (e) => resBy[e.id].score_us))} <span class="muted">×</span> ${dec(avg(scored, (e) => resBy[e.id].score_them))}</div>
      <div class="muted small" style="text-align:center">placar médio (nós × eles) em ${scored.length} Guerra(s)</div>
      <ul class="plain-list">${bigWin ? `<li>🏆 Maior vitória: ${evLine(bigWin)}</li>` : ''}${bigLoss ? `<li>💀 Maior derrota: ${evLine(bigLoss)}</li>` : ''}</ul>`
      : empty('Nenhuma Guerra com placar registrado no período.');

    const presOf = (e) => e.attendance.filter((a) => a.present).length;
    const confOf = (e) => e.rsvps.filter((r) => r.going).length;
    const warsAtt = M.wars.filter((e) => e.attendance.length);
    const byOut = (o) => warsAtt.filter((e) => resBy[e.id].outcome === o);
    const wA = byOut('win'); const lA = byOut('loss');
    const presBox = warsAtt.length ? hbars([
      { label: 'Vitórias', labelHtml: '<span class="c-yes">Vitórias</span>', value: avg(wA, presOf) || 0, color: 'var(--yes)',
        valHtml: wA.length ? `<b>${intFmt(avg(wA, presOf))}</b> <span class="muted">presentes · ${intFmt(avg(wA, confOf))} confirmaram</span>` : '—' },
      { label: 'Derrotas', labelHtml: '<span class="c-no">Derrotas</span>', value: avg(lA, presOf) || 0, color: 'var(--no)',
        valHtml: lA.length ? `<b>${intFmt(avg(lA, presOf))}</b> <span class="muted">presentes · ${intFmt(avg(lA, confOf))} confirmaram</span>` : '—' },
    ]) + '<div class="muted small">Média de membros presentes por Guerra (só as Guerras com presença registrada).</div>'
      : empty('Registre a presença das Guerras para comparar com o resultado.');

    // ----- Engajamento no período (filtrável por tipo) -----
    const typeOk = (e) => !PANEL.type || (PANEL.type === 'none' ? !e.type_id : e.type_id === Number(PANEL.type));
    const evsT = M.evs.filter(typeOk);
    const withAtt = evsT.filter((e) => e.attendance.length).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(-14);
    const presenceChart = withAtt.length ? vcols(withAtt.map((e) => ({ label: fmtShortDate(e.starts_at),
      title: `${e.title} ${fmtShortDate(e.starts_at)}: ${confOf(e)} confirmaram, ${presOf(e)} estiveram presentes`,
      bars: [{ v: confOf(e), cls: 'conf' }, { v: presOf(e), cls: 'pres' }] })))
      + '<div class="chart-legend"><span class="lg conf"></span> confirmaram <span class="lg pres"></span> estiveram presentes</div>'
      : empty('Nenhum evento com presença registrada no período.');
    const freq = computeFrequency(evsT, members).filter((r) => r.total);
    const maxTotal = Math.max(0, ...freq.map((r) => r.total));
    const ranked = freq.filter((r) => r.total >= Math.min(3, maxTotal));
    const byPct = (dir) => (a, b) => dir * (a.pct - b.pct) || dir * (a.present - b.present) || byName(a.m, b.m);
    const best = ranked.slice().sort(byPct(-1)).slice(0, 8);
    const worst = ranked.slice().sort(byPct(1)).filter((r) => !best.includes(r)).slice(0, 8);
    const rankBars = (rows) => hbars(rows.map((r) => ({ label: displayName(r.m), labelHtml: link(r.m), value: r.pct, color: pctColor(r.pct),
      valHtml: `${pctFmt(r.pct)} <span class="muted">${r.present}/${r.total}</span>`, title: `${displayName(r.m)}: ${r.present} de ${r.total} eventos` })), { max: 1, fmt: pctFmt });

    // Respostas: últimos eventos do período e, no ciclo atual, os próximos
    const nextEvs = per.to >= now - DAY_MS ? upcoming.filter(typeOk).slice(0, 3) : [];
    const respEvents = [
      ...evsT.slice().sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)).slice(-6).map((e) => ({ e, soon: false })),
      ...nextEvs.map((e) => ({ e, soon: true })),
    ];
    const respChart = respEvents.length ? stackRows(respEvents.map(({ e, soon }) => {
      const t = Date.parse(e.starts_at);
      const elig = members.filter((m) => soon || (Date.parse(m.created_at || 0) || 0) < t);
      const eligIds = new Set(elig.map((m) => m.id));
      const rs = e.rsvps.filter((r) => eligIds.has(r.user_id));
      const yes = rs.filter((r) => r.going).length;
      return { total: elig.length, yes, no: rs.length - yes, none: elig.length - rs.length, title: `${e.title} · ${fmtShortDate(e.starts_at)}`,
        labelHtml: `${soon ? '<span class="soon-tag">próximo</span> ' : ''}<b>${fmtShortDate(e.starts_at)}</b> <span class="muted">${esc(e.title)}</span>` };
    })) + '<div class="chart-legend"><span class="lg yes"></span> vão <span class="lg no"></span> não vão <span class="lg none"></span> sem resposta</div>'
      : empty('Nenhum evento no período.');
    const nextEv = nextEvs[0];
    const pendingNames = nextEv ? members.filter((m) => !nextEv.rsvps.some((r) => r.user_id === m.id)).sort(byName) : [];
    const pendingBox = nextEv ? `<div class="pending-answer">
        <b>Ainda não responderam a <a href="#/evento/${nextEv.id}">${esc(nextEv.title)} ${fmtShortDate(nextEv.starts_at)}</a> (${pendingNames.length}):</b>
        ${pendingNames.length ? `<div><button class="btn small" id="pn-copy-pending">📋 Copiar lista de membros sem resposta</button></div>` : '<span class="c-yes"> todos responderam! 🎉</span>'}
      </div>` : '';
    const hasUntyped = past.some((e) => !e.type_id);

    // ----- Composição (hoje) -----
    const counts = CLASSES.map((c) => ({ c, n: members.filter((m) => m.char_class === c.key).length }))
      .sort((a, b) => b.n - a.n || a.c.label.localeCompare(b.c.label, 'pt-BR'));
    const noClass = members.filter((m) => !CLASS[m.char_class]).length;
    const classChart = hbars(counts.map(({ c, n }) => ({ label: c.label, labelHtml: `${classTag(c.key)} ${esc(c.label)}`, value: n, color: c.color, title: `${c.label}: ${n} membro(s)` })));
    const res = members.map((m) => Number(m.resonance)).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
    let resChart = empty('Ninguém informou a Ressonância ainda.');
    let resSummary = '';
    if (res.length) {
      const lo = res[0]; const hi = res[res.length - 1];
      const step = [100, 250, 500, 1000, 2000, 5000].find((s) => Math.floor(hi / s) - Math.floor(lo / s) + 1 <= 8) || 10000;
      const bins = [];
      for (let b = Math.floor(lo / step) * step; b <= hi; b += step) bins.push({ from: b, to: b + step - 1, n: res.filter((v) => v >= b && v < b + step).length });
      resChart = vcols(bins.map((b) => ({ label: intFmt(b.from), title: `${intFmt(b.from)} a ${intFmt(b.to)}: ${b.n} membro(s)`, bars: [{ v: b.n, cls: 'pres' }] })));
      const median = res.length % 2 ? res[(res.length - 1) / 2] : (res[res.length / 2 - 1] + res[res.length / 2]) / 2;
      resSummary = `<div class="chart-foot">Média <b>${intFmt(res.reduce((s, v) => s + v, 0) / res.length)}</b> · Mediana <b>${intFmt(median)}</b> · Menor <b>${intFmt(lo)}</b> · Maior <b>${intFmt(hi)}</b></div>`;
    }

    // ----- Evolução da Ressonância no período -----
    const tEndEvo = Math.min(per.to, now) - 1;
    const evoStart = Math.max(per.from, Math.min(now, ...members.map((m) => Date.parse(m.created_at || 0) || now)));
    const evoPts = [];
    for (let k = 0; k <= 11; k++) {
      const t = evoStart + ((tEndEvo - evoStart) * k) / 11;
      const vals = members.map((m) => valueAt(m, 'resonance', t, histBy[m.id] || [])).filter((v) => v != null);
      if (vals.length) evoPts.push({ t, label: fmtShortDate(new Date(t).toISOString()), v: vals.reduce((s, v) => s + v, 0) / vals.length, n: vals.length });
    }
    let evoChart = empty('Ainda não há histórico suficiente. O gráfico ganha forma conforme os membros atualizam a Ressonância.');
    if (evoPts.length >= 2) {
      const diff = evoPts[evoPts.length - 1].v - evoPts[0].v;
      evoChart = lineChart(evoPts, { time: true }) + `<div class="chart-foot">Desde ${evoPts[0].label}: <b class="${diff > 0 ? 'c-yes' : diff < 0 ? 'c-no' : ''}">${diff > 0 ? '+' : ''}${intFmt(diff)}</b> na média do clã</div>`;
    }
    // Quem mais evoluiu: atributo escolhido no quadro
    const gAttr = ATTRS.find((a) => a.key === PANEL.attr) || ATTRS.find((a) => a.key === 'resonance');
    const gains = members.map((m) => {
      const h = histBy[m.id] || [];
      const before = valueAt(m, gAttr.key, per.from, h); const after = valueAt(m, gAttr.key, tEndEvo, h);
      return { m, before, after, gain: before != null && after != null ? after - before : 0 };
    }).filter((g) => g.gain > 0).sort((a, b) => b.gain - a.gain || byName(a.m, b.m)).slice(0, 8);
    const gainChart = gains.length ? hbars(gains.map((g) => ({ label: displayName(g.m), labelHtml: link(g.m), value: g.gain, color: 'var(--ember)',
      valHtml: `<b class="c-yes">+${intFmt(g.gain)}</b> <span class="muted">${intFmt(g.before)} → ${intFmt(g.after)}</span>`,
      title: `${displayName(g.m)} · ${gAttr.label}: ${intFmt(g.before)} → ${intFmt(g.after)}` }))) : empty(`Ninguém aumentou ${gAttr.label === 'Perfurar Armadura' ? 'o' : 'a'} ${gAttr.label} no período (ou ainda não atualizou no site).`);

    // ----- Saúde do clã -----
    const span = Math.max(DAY_MS, Math.min(per.to, now) - per.from);
    const pts = [];
    for (let k = 0; k <= 10; k++) { const t = per.from + (span * k) / 10; const v = activeAt(t); pts.push({ t, label: fmtShortDate(new Date(t).toISOString()), v, tip: `${dmy(t)}: ${v} membros ativos` }); }
    const healthChart = mlog.length ? lineChart(pts, { time: true, aria: 'Membros ativos ao longo do período' }) : empty('Sem histórico de entradas e saídas.');
    const moveList = (rows, kind) => (rows.length ? `<ul class="plain-list">${rows.slice().sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).map((l) => {
      const m = memberById(l.user_id);
      return `<li>${fmtShortDate(l.changed_at)} · ${link(m)}${kind === 'out' && l.reason ? ` <span class="muted small">· ${esc(l.reason)}</span>` : kind === 'in' && l.from_role === 'former' ? ' <span class="muted small">· readmitido</span>' : ''}</li>`;
    }).join('')}</ul>` : empty(kind === 'in' ? 'Ninguém entrou no período.' : 'Ninguém saiu no período.'));

    // ----- Atendimento -----
    const openTk = (state.tickets || []).filter((t) => t.status !== 'resolved');
    const stale = openTk.filter((t) => ticketPending(t) === 'staff' && now - Date.parse(lastActivity(t)) > 48 * 3600000)
      .sort((a, b) => Date.parse(lastActivity(a)) - Date.parse(lastActivity(b)));
    const resolvedN = M.tks.filter((t) => t.status === 'resolved').length;
    const supportBox = supportOn() ? `<section class="stats-section">
        <h3>🎫 Atendimento <span class="muted small">· ${esc(per.label)}</span></h3>
        <div class="chart-grid">
          <div class="card chart"><h4>Tickets no período</h4>
            <div class="kpi-row"><div><b>${M.tks.length}</b><span class="muted small">abertos</span></div><div><b>${resolvedN}</b><span class="muted small">já resolvidos</span></div>
              <div><b>${fmtHours(M.firstReply)}</b><span class="muted small">até a 1ª resposta (média)</span></div></div></div>
          <div class="card chart"><h4>⏳ Parados há mais de 48 h <span class="muted small">(esperando a liderança)</span></h4>
            ${stale.length ? `<ul class="plain-list">${stale.map((t) => `<li><a href="#/ticket/${t.id}">${esc(t.title)}</a> <span class="muted small">· sem resposta há ${fmtHours((now - Date.parse(lastActivity(t))) / 3600000)}</span></li>`).join('')}</ul>`
              : empty('Nenhum ticket parado. 🎉')}</div>
        </div></section>` : '';

    // ----- Perfis incompletos -----
    const lastAttrUpdate = (m) => {
      const h = (histBy[m.id] || []).find((x) => ATTRS.some((a) => x.changes && a.key in x.changes));
      return h ? Date.parse(h.changed_at) : Date.parse(m.created_at || 0) || 0;
    };
    const incomplete = members.map((m) => {
      const miss = [];
      if (!CLASS[m.char_class]) miss.push('sem classe');
      const noAttr = ATTRS.filter((a) => !(Number(m[a.key]) > 0));
      if (noAttr.length) miss.push(noAttr.length === ATTRS.length ? 'sem atributos' : `sem ${noAttr.map((a) => a.label).join(', ')}`);
      const age = (now - lastAttrUpdate(m)) / DAY_MS;
      if (!noAttr.length && age > 30) miss.push(`atributos sem atualizar há ${Math.floor(age)} dias`);
      return { m, miss, age };
    }).filter((r) => r.miss.length).sort((a, b) => b.miss.length - a.miss.length || b.age - a.age || byName(a.m, b.m));

    // ----- Inativos -----
    const N = PANEL.inactiveN;
    const lastN = past.filter((e) => e.attendance.length).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)).slice(0, N);
    const oldest = lastN.length ? Date.parse(lastN[lastN.length - 1].starts_at) : 0;
    const lastPresence = (m) => past.filter((e) => e.attendance.some((a) => a.user_id === m.id && a.present)).map((e) => Date.parse(e.starts_at)).sort((a, b) => b - a)[0];
    const inactive = lastN.length < N ? [] : members.filter((m) => (Date.parse(m.created_at || 0) || 0) < oldest
      && lastN.every((e) => !e.attendance.some((a) => a.user_id === m.id && a.present)
        && !e.rsvps.some((r) => r.user_id === m.id && r.absence_id)))
      .map((m) => ({ m, last: lastPresence(m), answered: lastN.filter((e) => e.rsvps.some((r) => r.user_id === m.id)).length }))
      .sort((a, b) => (a.last || 0) - (b.last || 0) || byName(a.m, b.m));

    // ----- Tela -----
    const cycleOpts = cycles.slice().reverse().map((c, i) => `<option value="${i === 0 ? 'cur' : c.id}" ${(i === 0 ? PANEL.sel === 'cur' : String(PANEL.sel) === String(c.id)) ? 'selected' : ''}>${esc(`${cycleName(c)} · ${spanText(c)}${i === 0 ? ' (atual)' : ''}`)}</option>`).join('');
    const weekN = per.cycle ? Math.floor((Math.min(per.to, now) - per.from) / (7 * DAY_MS)) + 1 : null;
    main.innerHTML = `
      <div class="page-head"><h1>Estatísticas do clã</h1>
        ${can('rivals_view') ? '<a class="btn" href="#/rivais">🛡️ Clãs rivais</a>' : ''}
        ${can('cycles') ? '<button class="btn" id="pn-cycles">🗓 Ciclos</button>' : ''}</div>
      <div class="card panel-period">
        <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
          <label for="pn-sel" class="muted small">Período</label>
          <select id="pn-sel">${cycleOpts}<option value="all" ${PANEL.sel === 'all' ? 'selected' : ''}>Todos os ciclos</option></select>
        </div>
        <div class="panel-cycle">${cycles.length ? `<b>${esc(per.label)}</b> <span class="muted">· ${per.cycle ? spanText(per.cycle) : `${dmy(per.from)} → hoje`}</span>
          ${per.cur ? ` <span class="badge">Semana ${weekN}</span>` : ''}${prev ? '<div class="muted small">As setas comparam com o ciclo anterior.</div>' : ''}`
          : `<span class="c-no">Nenhum ciclo cadastrado.</span> <span class="muted small">Mostrando os últimos 45 dias.${can('cycles') ? ' Cadastre o ciclo atual em 🗓 Ciclos.' : ''}</span>`}</div>
      </div>
      ${kpis}
      <section class="stats-section">
        <h3>⚔️ Guerras <span class="muted small">· ${esc(per.label)}</span></h3>
        <div class="chart-grid">
          <div class="card chart"><h4>Resultados</h4>${seq}</div>
          ${cycleBars ? `<div class="card chart"><h4>Vitórias e derrotas por ciclo</h4>${cycleBars}</div>` : ''}
          <div class="card chart"><h4>🛡️ Adversários</h4>${oppTable}</div>
          <div class="card chart"><h4>🎯 Placar</h4>${scoreBox}</div>
          <div class="card chart"><h4>👥 Presença × resultado</h4>${presBox}</div>
        </div>
      </section>
      <section class="stats-section">
        <h3>📈 Engajamento <span class="muted small">· ${esc(per.label)}</span>
          <select class="inline" id="pn-type" aria-label="Tipo de evento">
            <option value="">Todos os tipos</option>
            ${state.types.map((t) => `<option value="${t.id}" ${PANEL.type === String(t.id) ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
            ${hasUntyped ? `<option value="none" ${PANEL.type === 'none' ? 'selected' : ''}>Sem tipo</option>` : ''}
          </select></h3>
        <div class="chart-grid">
          <div class="card chart"><h4>Presença por evento</h4>${presenceChart}</div>
          <div class="card chart"><h4>Respostas por evento</h4>${respChart}${pendingBox}</div>
          <div class="card chart"><h4>🏆 Mais presentes</h4>${best.length ? rankBars(best) : empty('Sem presença registrada no período.')}</div>
          <div class="card chart"><h4>⚠️ Mais faltam</h4>${worst.length ? rankBars(worst) : empty(best.length ? 'Todos já aparecem no ranking ao lado.' : 'Sem presença registrada no período.')}</div>
        </div>
      </section>
      <section class="stats-section">
        <h3>🧙 Composição do clã <span class="muted small">· hoje · ${members.length} membros ativos</span></h3>
        <div class="chart-grid">
          <div class="card chart"><h4>Membros por classe</h4>${classChart}
            ${noClass ? `<div class="chart-foot">${noClass} membro(s) ainda sem classe informada</div>` : ''}</div>
          <div class="card chart"><h4>Distribuição de Ressonância</h4>${resChart}${resSummary}</div>
        </div>
      </section>
      <section class="stats-section">
        <h3>💪 Evolução <span class="muted small">· ${esc(per.label)}</span></h3>
        <div class="chart-grid evo">
          <div class="card chart wide"><h4>Ressonância média do clã</h4>${evoChart}
            <div class="muted small">Considera os membros ativos de hoje. Antes da primeira atualização de cada um, vale o primeiro valor informado.</div></div>
          <div class="card chart wide"><h4>🔥 Quem mais evoluiu no período</h4>
            <div class="evo-tabs" role="tablist">${ATTRS.slice().sort((a, b) => (a.key === 'resonance' ? -1 : b.key === 'resonance' ? 1 : 0))
              .map((a) => `<button type="button" class="evo-tab" role="tab" data-pn-attr="${a.key}" aria-selected="${a.key === gAttr.key}">${esc(a.label)}</button>`).join('')}</div>
            ${gainChart}</div>
        </div>
      </section>
      <section class="stats-section">
        <h3>🫀 Saúde do clã <span class="muted small">· ${esc(per.label)}</span></h3>
        <div class="chart-grid">
          <div class="card chart wide"><h4>Membros ativos</h4>${healthChart}</div>
          <div class="card chart"><h4>✅ Entraram (${M.joins.length})</h4>${moveList(M.joins, 'in')}</div>
          <div class="card chart"><h4>🚪 Saíram (${M.exits.length})</h4>${moveList(M.exits, 'out')}</div>
        </div>
      </section>
      ${supportBox}
      <section class="stats-section">
        <h3>🔎 Atenção</h3>
        <div class="chart-grid">
          <div class="card chart"><h4>💤 Inativos
              <span class="muted small">· faltaram os últimos <input type="number" id="pn-n" min="2" max="15" value="${N}" class="inline-num"> eventos com presença</span></h4>
            ${lastN.length < N ? empty(`Ainda não há ${N} eventos com presença registrada.`) : inactive.length
              ? `<ul class="plain-list">${inactive.map((r) => `<li>${link(r.m)} <span class="muted small">· última presença: ${r.last ? dmy(r.last) : 'nunca'}${r.answered ? ` · respondeu ${r.answered} de ${N}` : ' · não respondeu nenhum'}</span></li>`).join('')}</ul>
                <button class="btn small" id="pn-copy-inactive">📋 Copiar lista</button>`
              : empty('Ninguém faltou a todos esses eventos. 🎉')}
            <div class="muted small">Não conta quem tinha ausência programada nem quem entrou depois desses eventos.</div></div>
          <div class="card chart"><h4>📝 Perfis incompletos ou desatualizados (${incomplete.length})</h4>
            ${incomplete.length ? `<ul class="plain-list">${incomplete.slice(0, 30).map((r) => `<li>${link(r.m)} <span class="muted small">· ${esc(r.miss.join(' · '))}</span></li>`).join('')}</ul>
              ${incomplete.length > 30 ? `<div class="muted small">e mais ${incomplete.length - 30}…</div>` : ''}<button class="btn small" id="pn-copy-incomplete">📋 Copiar lista</button>`
              : empty('Todos os perfis estão completos e atualizados. 🎉')}
            <div class="muted small">Desatualizado: atributos sem nenhuma alteração há mais de 30 dias.</div></div>
        </div>
      </section>`;

    $('#pn-sel').addEventListener('change', (e) => { PANEL.sel = e.target.value; viewPanel().catch(fail); });
    $('#pn-n')?.addEventListener('change', (e) => { PANEL.inactiveN = Math.min(15, Math.max(2, Number(e.target.value) || 3)); viewPanel().catch(fail); });
    $('#pn-cycles')?.addEventListener('click', () => openCyclesDialog(cycles, () => viewPanel()));
    $('#pn-copy-inactive')?.addEventListener('click', () => copy([`**Inativos: faltaram os últimos ${N} eventos**`, ...inactive.map((r) => `• ${displayName(r.m)}`)].join('\n'), 'Lista copiada'));
    $('#pn-copy-incomplete')?.addEventListener('click', () => copy(['**Perfis para atualizar no site**', ...incomplete.map((r) => `• ${displayName(r.m)} (${r.miss.join(', ')})`)].join('\n'), 'Lista copiada'));
    $('#pn-type').addEventListener('change', (e) => { PANEL.type = e.target.value; viewPanel().catch(fail); });
    main.querySelectorAll('[data-pn-attr]').forEach((b) => b.addEventListener('click', () => {
      if (PANEL.attr === b.dataset.pnAttr) return;
      PANEL.attr = b.dataset.pnAttr;
      const y = window.scrollY;
      viewPanel().then(() => window.scrollTo(0, y)).catch(fail);
    }));
    $('#pn-copy-pending')?.addEventListener('click', () => {
      copy([`**Ainda não responderam: ${nextEv.title} ${fmtShortDate(nextEv.starts_at)}**`, ...pendingNames.map((m) => `• ${displayName(m)}`)].join('\n'), 'Lista copiada');
    });
  }

  // Segundas-feiras para o início do ciclo: da desta semana até 1 ano atrás
  function mondays(keep) {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const out = [];
    for (let i = 0; i < 53; i++, d.setDate(d.getDate() - 7)) out.push(ymdOf(d));
    if (keep && !out.includes(keep)) out.push(keep);
    return out;
  }
  const mondayLabel = (v) => new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).replace('.', '');


  // Cadastro dos ciclos (Sombras / Imortal): começa numa segunda e termina no domingo antes do próximo
  function openCyclesDialog(cycles, after) {
    const rows = cycles.slice().reverse();
    const render = (edit) => openDialog(`<form id="cy" class="stack">
      <h2>🗓 Ciclos</h2>
      <p class="muted small" style="margin:0">Cadastre a segunda-feira em que cada ciclo começa e o lado do clã. O ciclo termina no domingo antes do próximo.</p>
      <div class="cy-list">${rows.length ? rows.map((c, i) => `<div class="cy-row"><span><b>${esc(cycleName(c))}</b> <span class="muted small">· ${spanText(c)}${i === 0 ? ' (atual)' : ''}</span></span>
        <span class="row" style="gap:6px"><button type="button" class="btn small ghost" data-cy-edit="${c.id}">Editar</button><button type="button" class="btn small ghost" data-cy-del="${c.id}">Apagar</button></span></div>`).join('')
        : '<p class="muted small">Nenhum ciclo cadastrado ainda.</p>'}</div>
      <h3 style="margin:6px 0 0">${edit ? 'Editar ciclo' : 'Novo ciclo'}</h3>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:150px"><label for="cy-date">Começou na segunda-feira</label><select id="cy-date" required>${mondays(edit?.starts_on).map((v, i) => `<option value="${v}" ${(edit ? v === edit.starts_on : i === 0) ? 'selected' : ''}>${esc(mondayLabel(v))}</option>`).join('')}</select></div>
        <div class="field" style="flex:1;min-width:150px"><label for="cy-side">Lado</label><select id="cy-side">
          <option value="shadows" ${edit?.side !== 'immortal' ? 'selected' : ''}>🌑 Sombras</option><option value="immortal" ${edit?.side === 'immortal' ? 'selected' : ''}>👑 Imortal</option></select></div>
      </div>
      <div class="row end">
        ${edit ? '<button type="button" class="btn ghost" id="cy-new">Cancelar edição</button>' : '<button type="button" class="btn ghost" data-close>Fechar</button>'}
        <button type="submit" class="btn primary">${edit ? 'Salvar' : 'Cadastrar ciclo'}</button>
      </div>
    </form>`, (d) => {
      $('#cy-new', d)?.addEventListener('click', () => render(null));
      d.querySelectorAll('[data-cy-edit]').forEach((b) => b.addEventListener('click', () => render(rows.find((c) => String(c.id) === b.dataset.cyEdit))));
      d.querySelectorAll('[data-cy-del]').forEach((b) => b.addEventListener('click', async () => {
        const c = rows.find((x) => String(x.id) === b.dataset.cyDel);
        if (!(await confirmDialog(`Apagar o ${cycleName(c)} que começou em ${dmy(c.from)}? Os eventos e resultados não são apagados.`, 'Apagar'))) { render(edit); return; }
        try { await api.deleteCycle(c.id); toast('Ciclo apagado'); await after(); } catch (err) { fail(err); }
      }));
      $('#cy', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button[type=submit]', d); btn.disabled = true;
        try {
          await api.saveCycle({ id: edit?.id ?? null, starts_on: $('#cy-date', d).value, side: $('#cy-side', d).value });
          dlg.close(); toast(edit ? 'Ciclo atualizado' : 'Ciclo cadastrado'); await after();
        } catch (err) { fail(err); btn.disabled = false; }
      });
    });
    render(null);
  }

  // =====================================================================
  //  Clãs rivais (compartilhados com o INFERNUM)
  //  As leituras ficam no Supabase do INFERNUM; este site lê e grava pela
  //  função rivals-share, que confere aqui se a pessoa é líder ou oficial com permissão.
  // =====================================================================
  const OUR = CFG.clanName || 'Clã';

  // =====================================================================

  // Lê um .xlsx no navegador (zip + XML), sem biblioteca externa: { nomeDaAba: [[célula, ...], ...] }
  async function readXlsx(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('O arquivo não é uma planilha .xlsx válida');
    const files = {};
    let p = dv.getUint32(eocd + 16, true);
    for (let n = dv.getUint16(eocd + 10, true); n > 0 && dv.getUint32(p, true) === 0x02014b50; n--) {
      const nlen = dv.getUint16(p + 28, true);
      files[new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen))] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true) };
      p += 46 + nlen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    const read = async (name) => {
      const f = files[name];
      if (!f) return null;
      const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
      let data = buf.subarray(start, start + f.size);
      if (f.method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      return new DOMParser().parseFromString(new TextDecoder().decode(data), 'application/xml');
    };
    const wb = await read('xl/workbook.xml');
    if (!wb) throw new Error('O arquivo não é uma planilha .xlsx válida');
    const rels = await read('xl/_rels/workbook.xml.rels');
    const target = (rid) => {
      const t = [...(rels?.getElementsByTagName('Relationship') || [])].find((x) => x.getAttribute('Id') === rid)?.getAttribute('Target') || '';
      return t.startsWith('/') ? t.slice(1) : `xl/${t}`;
    };
    const ss = await read('xl/sharedStrings.xml');
    const shared = ss ? [...ss.getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join('')) : [];
    const colOf = (ref) => { let n = 0; for (const ch of ref.replace(/[^A-Z]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    const out = {};
    for (const sh of wb.getElementsByTagName('sheet')) {
      const doc = await read(target(sh.getAttribute('r:id')));
      if (!doc) continue;
      const rows = [];
      for (const r of doc.getElementsByTagName('row')) {
        const row = [];
        for (const c of r.getElementsByTagName('c')) {
          const ref = c.getAttribute('r');
          const t = c.getAttribute('t');
          const v = c.getElementsByTagName('v')[0]?.textContent;
          let val = null;
          if (t === 's') val = shared[Number(v)] ?? null;
          else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
          else if (t === 'str' || t === 'e') val = v ?? null;
          else if (v != null && v !== '') val = Number(v);
          row[ref ? colOf(ref) : row.length] = val;
        }
        rows.push(row);
      }
      out[sh.getAttribute('name')] = rows;
    }
    return out;
  }

  // Monta as leituras por clã a partir da planilha, tirando os repetidos
  function parseScout(sheets, fileName) {
    const COLS = { clan: ['cla'], number: ['n do cla', 'no do cla', 'nº do cla', 'numero do cla'], name: ['personagem', 'nome', 'jogador'],
      armor: ['armadura'], armor_pen: ['perfurar armadura'], potency: ['potencia'], resistance: ['resistencia'], resonance: ['ressonancia'], note: ['observacao', 'obs'] };
    let rows = null; let idx = null;
    for (const r of Object.values(sheets)) {
      const head = (r[0] || []).map((h) => norm(h));
      const find = (alts) => head.findIndex((h) => alts.includes(h));
      if (find(COLS.name) >= 0 && find(COLS.resonance) >= 0) { rows = r.slice(1); idx = Object.fromEntries(Object.entries(COLS).map(([k, alts]) => [k, find(alts)])); break; }
    }
    if (!rows) throw new Error('Não encontrei as colunas Personagem e Ressonância na planilha');
    if (idx.clan < 0) throw new Error('Não encontrei a coluna Clã na planilha');
    const all = Object.values(sheets).flat().flat().map((v) => String(v ?? ''));
    const dateSrc = [fileName, ...all].find((v) => /\d{4}-\d{2}-\d{2}/.test(v));
    const found = dateSrc?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    const scanned_on = found && found <= localDay() ? found : localDay();
    const video = all.find((v) => /\.(mkv|mp4|mov|avi)$/i.test(v)) || fileName;
    const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d]/g, '')); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null; };
    const groups = new Map();
    rows.forEach((r, i) => {
      const clan = String(r[idx.clan] ?? '').trim();
      const hasAttr = ATTRS.some((a) => num(r[idx[a.key]]) != null);
      if (!clan || (!hasAttr && !String(r[idx.name] ?? '').trim())) return;
      const k = norm(clan);
      if (!groups.has(k)) groups.set(k, { clan_name: clan, numbers: {}, rows: [] });
      const g = groups.get(k);
      const n = idx.number >= 0 ? num(r[idx.number]) : null;
      if (n != null) g.numbers[n] = (g.numbers[n] || 0) + 1;
      let name = String(r[idx.name] ?? '').trim();
      const notes = [];
      if (idx.note >= 0 && r[idx.note]) notes.push(String(r[idx.note]).trim());
      if (!name) { name = '(sem nome)'; notes.push('nome não lido'); } else if (/^#|�/.test(name)) notes.push('nome a conferir');
      g.rows.push({ line: i + 2, name: name.slice(0, 60), ...Object.fromEntries(ATTRS.map((a) => [a.key, num(r[idx[a.key]])])), note: notes.join(' · ').slice(0, 200) || null });
    });
    // Repetido = mesmo clã e os 5 atributos iguais (o nome pode ter sido lido diferente no vídeo)
    const nameScore = (x) => (x.name === '(sem nome)' ? 0 : /^#|�/.test(x.name) || x.name.length < 3 ? 1 : 2);
    return [...groups.values()].map((g) => {
      const byKey = new Map(); const dups = [];
      g.rows.forEach((x) => {
        const complete = ATTRS.every((a) => x[a.key] != null);
        const key = complete ? ATTRS.map((a) => x[a.key]).join('|') : `${norm(x.name)}|${ATTRS.map((a) => x[a.key]).join('|')}`;
        const prev = byKey.get(key);
        if (!prev) { byKey.set(key, x); return; }
        const keep = nameScore(x) > nameScore(prev) ? x : prev;
        const drop = keep === x ? prev : x;
        byKey.set(key, keep);
        dups.push({ keep, drop });
      });
      const nums = Object.entries(g.numbers).sort((a, b) => b[1] - a[1]);
      const players = [...byKey.values()];
      return { clan_name: g.clan_name, clan_number: nums[0] ? Number(nums[0][0]) : null, otherNumbers: nums.slice(1).map(([n, c]) => `${n} (${c})`),
        players, dups, missing: players.filter((x) => ATTRS.some((a) => x[a.key] == null)).length,
        toCheck: players.filter((x) => x.note).length, include: true };
    }).map((c) => ({ ...c, scanned_on, source: String(video).slice(0, 200) }));
  }

  function openScoutImport(file, after) {
    const fail2 = (e) => { fail(e); };
    readXlsx(file).then((sheets) => {
      const clans = parseScout(sheets, file.name);
      if (!clans.length) throw new Error('Nenhum jogador encontrado na planilha');
      const existing = RIV_DATA?.scans || [];
      const render = () => openDialog(`<form id="sc" class="stack">
        <h2>📥 Importar planilha</h2>
        <p class="muted small" style="margin:0">${esc(file.name)} · confira antes de salvar. Cada clã vira uma nova leitura; as anteriores continuam guardadas.</p>
        <div class="field"><label for="sc-date">Data da leitura</label><input type="date" id="sc-date" value="${clans[0].scanned_on}" max="${localDay()}" required></div>
        ${clans.map((c, i) => {
          const same = existing.some((s) => sameClan(s, c) && s.scanned_on === clans[0].scanned_on);
          const known = existing.filter((s) => sameClan(s, c) && norm(s.clan_name) !== norm(c.clan_name)).map((s) => s.clan_name);
          return `<div class="card sc-clan">
          <label class="sc-top"><input type="checkbox" data-sc-inc="${i}" ${c.include ? 'checked' : ''}>
            <input type="text" data-sc-name="${i}" value="${esc(c.clan_name)}" maxlength="60" aria-label="Nome do clã"></label>
          <div class="muted small">Nº ${c.clan_number ?? '—'} · <b>${c.players.length}</b> jogadores${c.dups.length ? ` · ${c.dups.length} repetido${c.dups.length > 1 ? 's' : ''} removido${c.dups.length > 1 ? 's' : ''}` : ''}</div>
          <ul class="plain-list small">
            ${c.otherNumbers.length ? `<li>⚠️ Também apareceu com outro nº: ${esc(c.otherNumbers.join(', '))}. Juntei tudo pelo nome do clã.</li>` : ''}
            ${c.players.length > 100 ? `<li>⚠️ Mais de 100 jogadores: confira se não há alguém repetido com valores diferentes.</li>` : ''}
            ${c.missing ? `<li>⚠️ ${c.missing} com algum atributo faltando (fica em branco nas contas).</li>` : ''}
            ${c.toCheck ? `<li>🔎 ${c.toCheck} marcado${c.toCheck > 1 ? 's' : ''} para conferir (observação da planilha ou nome estranho).</li>` : ''}
            ${same ? '<li>ℹ️ Já existe uma leitura deste clã nesta data. Ela será guardada como outra leitura.</li>' : ''}
            ${known.length ? `<li>🔗 Parece ser o mesmo clã já mapeado como “${esc(known[known.length - 1])}” (nome e número parecidos): as leituras ficam juntas.</li>` : ''}
          </ul>
          ${c.dups.length ? `<details><summary class="small">Ver os repetidos removidos</summary><table class="mini-table"><thead><tr><th>Ficou</th><th>Removido</th><th>Linha</th></tr></thead><tbody>
            ${c.dups.map((d) => `<tr><td>${esc(d.keep.name)}</td><td class="muted">${esc(d.drop.name)}</td><td class="muted">${d.drop.line}</td></tr>`).join('')}</tbody></table></details>` : ''}
        </div>`;
        }).join('')}
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="sc-go">Importar</button></div>
      </form>`, (d) => {
        $('#sc', d).addEventListener('submit', async (e) => {
          e.preventDefault();
          const date = $('#sc-date', d).value;
          clans.forEach((c, i) => { c.include = $(`[data-sc-inc="${i}"]`, d).checked; c.clan_name = $(`[data-sc-name="${i}"]`, d).value.trim() || c.clan_name; });
          const go = clans.filter((c) => c.include);
          if (!go.length) { toast('Marque ao menos um clã', true); return; }
          const btn = $('#sc-go', d); btn.disabled = true; btn.textContent = 'Importando…';
          try {
            for (const c of go) {
              await api.importRivalScan({ clan_name: c.clan_name, clan_number: c.clan_number, scanned_on: date, source: c.source,
                players: c.players.map(({ line, ...x }) => x) });
            }
            dlg.close();
            toast(`${go.length} clã${go.length > 1 ? 's' : ''} importado${go.length > 1 ? 's' : ''}`);
            await after();
          } catch (err) { btn.disabled = false; btn.textContent = 'Importar'; fail(err); }
        });
      });
      render();
    }).catch(fail2);
  }

  const RIV = { stat: 'avg', clan: '', attr: 'resonance', q: '' };
  let RIV_DATA = null;
  const RIV_STATS = { avg: 'Média', median: 'Mediana', top10: 'Média do Top 10' };
  const RIV_BANDS = [[0, 4000, 'até 3.999'], [4000, 6000, '4.000–5.999'], [6000, 8000, '6.000–7.999'], [8000, 10000, '8.000–9.999'], [10000, 12000, '10.000–11.999'], [12000, Infinity, '12.000+']];

  // Mesmo clã em importações diferentes: o vídeo às vezes lê o nome ou o número com um erro
  function editDist(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const nearNumber = (x, y) => {
    if (x == null || y == null) return true; // sem número: decide pelo nome
    const a = String(x); const b = String(y);
    return a.length === b.length && [...a].filter((ch, i) => ch !== b[i]).length <= 1;
  };
  function sameClan(a, b) {
    if (a.clan_number != null && a.clan_number === b.clan_number) return true;
    const na = norm(a.clan_name); const nb = norm(b.clan_name);
    const similar = na === nb || editDist(na, nb) <= (Math.min(na.length, nb.length) >= 8 ? 2 : 1);
    return similar && nearNumber(a.clan_number, b.clan_number);
  }
  // Agrupa as leituras por clã: [{ key, scans: [...] }]
  function groupClans(scans) {
    const groups = [];
    scans.forEach((sc) => {
      const g = groups.find((x) => x.scans.some((y) => sameClan(y, sc)));
      if (g) g.scans.push(sc); else groups.push({ scans: [sc] });
    });
    // junta grupos que ficaram ligados por leituras novas
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (groups[i].scans.some((x) => groups[j].scans.some((y) => sameClan(x, y)))) { groups[i].scans.push(...groups[j].scans); groups.splice(j, 1); j = i; }
      }
    }
    return groups.map((g) => ({ ...g, key: `c${Math.min(...g.scans.map((x) => x.id))}` }));
  }

  function statOf(list, key, mode) {
    const v = list.map((x) => Number(x[key])).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => b - a);
    if (!v.length) return null;
    if (mode === 'median') return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
    const use = mode === 'top10' ? v.slice(0, 10) : v;
    return use.reduce((s, n) => s + n, 0) / use.length;
  }

  async function viewRivals(keepScroll) {
    if (!can('rivals_view')) { location.hash = '#/'; return; }
    if (!keepScroll || !RIV_DATA) { loading(); RIV_DATA = await api.rivals().catch(() => null); }
    const y = keepScroll ? scrollY : 0;
    const data = RIV_DATA;
    const head = `<div class="page-head"><h1>Clãs rivais</h1>
      ${can('panel_view') ? '<a class="btn ghost" href="#/estatisticas">📊 Estatísticas do clã</a>' : ''}
      ${can('rivals_import') ? '<button class="btn primary" id="rv-import">📥 Importar planilha</button><input type="file" id="rv-file" accept=".xlsx" hidden>' : ''}</div>`;
    const bind = () => {
      $('#rv-import')?.addEventListener('click', () => $('#rv-file').click());
      $('#rv-file')?.addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openScoutImport(f, () => viewRivals()); });
    };
    if (!data) { main.innerHTML = `${head}<div class="card empty">Não foi possível carregar os clãs rivais do banco compartilhado com o INFERNUM. Tente de novo em instantes.</div>`; bind(); return; }
    if (!data.scans.length) {
      main.innerHTML = `${head}<div class="card empty">Nenhum clã mapeado ainda.${can('rivals_import') ? ' Use <b>📥 Importar planilha</b> para enviar o arquivo .xlsx do Scout (colunas Clã, Nº do clã, Personagem, os 5 atributos e Observação).' : ''}</div>`;
      bind(); return;
    }
    // Clãs: a leitura mais recente de cada um vale para as comparações
    const playersBy = {};
    data.players.forEach((x) => { (playersBy[x.scan_id] ||= []).push(x); });
    const clans = groupClans(data.scans).map((c) => {
      c.scans.sort((a, b) => a.scanned_on.localeCompare(b.scanned_on) || a.id - b.id);
      c.last = c.scans[c.scans.length - 1];
      // Nome: o que mais aparece nas leituras (um erro de leitura isolado não troca o nome); no empate fica o primeiro
      const freq = {};
      c.scans.forEach((x) => { freq[x.clan_name] = (freq[x.clan_name] || 0) + 1; });
      c.name = c.scans.reduce((best, x) => (freq[x.clan_name] > freq[best] ? x.clan_name : best), c.scans[0].clan_name);
      const nfreq = {};
      c.scans.forEach((x) => { if (x.clan_number != null) nfreq[x.clan_number] = (nfreq[x.clan_number] || 0) + 1; });
      c.number = c.scans.reduce((best, x) => (x.clan_number != null && (best == null || nfreq[x.clan_number] > nfreq[best]) ? x.clan_number : best), null);
      c.players = playersBy[c.last.id] || [];
      c.names = new Set(c.scans.map((x) => norm(x.clan_name)));
      c.ids = new Set(c.scans.map((x) => x.id));
      return c;
    });
    const us = { key: '__us', name: OUR, us: true, players: activeMembers() };
    const statK = RIV.stat in RIV_STATS ? RIV.stat : 'avg';
    clans.sort((a, b) => (statOf(b.players, 'resonance', statK) || 0) - (statOf(a.players, 'resonance', statK) || 0));
    const rowsAll = [us, ...clans];
    const fmt0 = (v) => (v == null ? '—' : fmtNum(Math.round(v)));
    const dmyS = (ymd) => ymd.split('-').reverse().join('/');

    // ----- Comparativo -----
    const ourStat = Object.fromEntries(ATTRS.map((a) => [a.key, statOf(us.players, a.key, statK)]));
    const best = Object.fromEntries(ATTRS.map((a) => [a.key, Math.max(...rowsAll.map((r) => statOf(r.players, a.key, statK) || 0))]));
    const cmpTable = `<div class="table-scroll"><table class="mini-table rv-cmp"><thead><tr><th>Clã</th><th>Jog.</th>${ATTRS.map((a) => `<th title="${esc(a.label)}">${a.short}</th>`).join('')}<th>Leitura</th></tr></thead><tbody>
      ${rowsAll.map((r) => `<tr class="${r.us ? 'rv-us' : ''}"><td>${r.us ? `<b>⚔️ ${esc(OUR)}</b>` : `<a href="#" data-rv-clan="${esc(r.key)}">${esc(r.name)}</a>${clans.filter((x) => norm(x.name) === norm(r.name)).length > 1 && r.number ? ` <small class="muted">nº ${r.number}</small>` : ''}`}</td><td>${r.players.length}</td>
        ${ATTRS.map((a) => {
          const v = statOf(r.players, a.key, statK);
          const d = !r.us && v != null && ourStat[a.key] ? (v - ourStat[a.key]) / ourStat[a.key] : null;
          return `<td class="${v != null && Math.round(v) === Math.round(best[a.key]) ? 'rv-best' : ''}">${fmt0(v)}${d != null && Math.abs(d) >= 0.005
            ? `<div class="rv-delta ${d > 0 ? 'c-no' : 'c-yes'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</div>` : ''}</td>`;
        }).join('')}
        <td class="muted small">${r.us ? 'perfis' : dmyS(r.last.scanned_on)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="muted small">▲ o rival está acima do ${esc(OUR)} · ▼ está abaixo · em dourado, o melhor de cada atributo. Do ${esc(OUR)} contam os membros ativos com o atributo preenchido no perfil.</div>`;

    // ----- Ressonância por faixa -----
    const bandTable = `<div class="table-scroll"><table class="mini-table"><thead><tr><th>Clã</th>${RIV_BANDS.map((b) => `<th>${b[2]}</th>`).join('')}</tr></thead><tbody>
      ${rowsAll.map((r) => {
        const v = r.players.map((x) => Number(x.resonance)).filter((n) => n > 0);
        return `<tr class="${r.us ? 'rv-us' : ''}"><td>${r.us ? `<b>⚔️ ${esc(OUR)}</b>` : esc(r.name)}</td>${RIV_BANDS.map(([lo, hi]) => {
          const n = v.filter((x) => x >= lo && x < hi).length;
          return `<td title="${n} jogador${n === 1 ? '' : 'es'}">${v.length ? `${Math.round((100 * n) / v.length)}%` : '—'}<span class="muted small"> (${n})</span></td>`;
        }).join('')}</tr>`;
      }).join('')}</tbody></table></div>`;

    // ----- Clã em detalhe -----
    const sel = clans.find((c) => c.key === RIV.clan) || clans[0];
    RIV.clan = sel.key;
    const attr = ATTRS.find((a) => a.key === RIV.attr) || ATTRS.find((a) => a.key === 'resonance');
    const sorted = sel.players.slice().sort((a, b) => (Number(b[attr.key]) || 0) - (Number(a[attr.key]) || 0));
    const top = sorted.filter((x) => Number(x[attr.key]) > 0).slice(0, 10);
    const ourTop = statOf(us.players, attr.key, 'top10');
    const history = sel.scans.slice().reverse().map((sc, i, arr) => {
      const pl = playersBy[sc.id] || [];
      const prevPl = arr[i + 1] ? playersBy[arr[i + 1].id] || [] : null;
      return `<tr><td>${dmyS(sc.scanned_on)}</td><td class="small">${esc(sc.imported_by || 'INFERNUM')}${sc.imported_by_name ? `<div class="muted">${esc(sc.imported_by_name)}</div>` : ''}</td><td>${pl.length}</td>${ATTRS.map((a) => {
        const v = statOf(pl, a.key, 'avg'); const pv = prevPl ? statOf(prevPl, a.key, 'avg') : null;
        const d = v != null && pv ? (v - pv) / pv : null;
        return `<td>${fmt0(v)}${d != null && Math.abs(d) >= 0.005 ? `<div class="rv-delta ${d > 0 ? 'c-no' : 'c-yes'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</div>` : ''}</td>`;
      }).join('')}<td>${can('rivals_import') ? `<button class="btn small ghost" data-rv-del="${sc.id}" title="Apagar esta leitura">🗑</button>` : ''}</td></tr>`;
    }).join('');
    const whenTxt = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    const clanLog = (data.log || []).filter((l) => sel.ids.has(l.scan_id) || sel.names.has(norm(l.clan_name))).slice(0, 20);
    const logHtml = clanLog.length ? `<ul class="plain-list small rv-log">${clanLog.map((l) => `<li>${l.action === 'delete' ? '🗑' : '📥'} <b>${esc(l.actor_name || 'Desconhecido')}</b> <span class="muted">(${esc(l.actor_clan)})</span>
      ${l.action === 'delete' ? '<span class="c-no">apagou</span>' : 'importou'} a leitura de ${l.scanned_on ? dmyS(l.scanned_on) : '—'}${l.players != null ? ` (${l.players} jogadores)` : ''}
      <span class="muted">· ${whenTxt(l.created_at)}</span></li>`).join('')}</ul>`
      : '<div class="muted small">Nenhum registro ainda.</div>';
    const detail = `
      ${clans.length >= 8 ? `<input type="search" id="rv-clan-q" class="rv-clan-q" placeholder="Buscar clã (${clans.length} mapeados)…" value="${esc(RIV.clanQ || '')}" autocomplete="off">` : ''}
      <div class="evo-tabs" role="tablist" id="rv-clan-tabs">${clans.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((c) => `<button type="button" class="evo-tab" role="tab" data-rv-clan="${esc(c.key)}" data-rv-names="${esc([...c.names].join(' '))}" aria-selected="${c.key === sel.key}">${esc(c.name)}${clans.filter((x) => norm(x.name) === norm(c.name)).length > 1 && c.number ? ` <small>· nº ${c.number}</small>` : ''}</button>`).join('')}</div>
      <div class="kpi-grid">
        ${kpi('👥', 'Jogadores', sel.players.length, `Nº ${sel.number ?? '—'}`)}
        ${kpi('💠', 'Ressonância média', fmt0(statOf(sel.players, 'resonance', 'avg')), `${OUR}: ${fmt0(statOf(us.players, 'resonance', 'avg'))}`)}
        ${kpi('🏅', 'Ressonância Top 10', fmt0(statOf(sel.players, 'resonance', 'top10')), `${OUR}: ${fmt0(statOf(us.players, 'resonance', 'top10'))}`)}
        ${kpi('📅', 'Última leitura', dmyS(sel.last.scanned_on), `${sel.scans.length} leitura${sel.scans.length > 1 ? 's' : ''}`)}
      </div>
      <div class="chart-grid">
        <div class="card chart wide"><h4>🏆 Top 10 · ${esc(sel.name)}</h4>
          <div class="evo-tabs" role="tablist">${ATTRS.slice().sort((a, b) => (a.key === 'resonance' ? -1 : b.key === 'resonance' ? 1 : 0))
            .map((a) => `<button type="button" class="evo-tab" role="tab" data-rv-attr="${a.key}" aria-selected="${a.key === attr.key}">${esc(a.label)}</button>`).join('')}</div>
          ${top.length ? hbars(top.map((x) => ({ label: x.name, value: Number(x[attr.key]), title: `${x.name}: ${fmtNum(Number(x[attr.key]))}${x.note ? ` · ${x.note}` : ''}` })), { fmt: fmtNum }) : '<div class="muted small">Sem valores.</div>'}
          <div class="muted small">Média do Top 10: <b>${fmt0(statOf(sel.players, attr.key, 'top10'))}</b> · ${esc(OUR)}: <b>${fmt0(ourTop)}</b></div></div>
        <div class="card chart wide"><h4>📅 Leituras</h4>
          <div class="table-scroll"><table class="mini-table"><thead><tr><th>Data</th><th title="Clã que importou a leitura">Por</th><th>Jog.</th>${ATTRS.map((a) => `<th title="Média de ${esc(a.label)}">${a.short}</th>`).join('')}<th></th></tr></thead><tbody>${history}</tbody></table></div>
          <div class="muted small">Médias de cada leitura · as setas comparam com a leitura anterior · “Por” é o clã e quem importou (as leituras são compartilhadas com o INFERNUM).</div></div>
        <div class="card chart wide"><h4>📝 Registro · ${esc(sel.name)}</h4>${logHtml}</div>
        <div class="card chart wide"><details><summary><b>Ver os ${sel.players.length} jogadores</b> <span class="muted small">· ordenados por ${esc(attr.label)}</span></summary>
          <div class="table-scroll"><table class="mini-table"><thead><tr><th>#</th><th>Jogador</th>${ATTRS.map((a) => `<th>${a.short}</th>`).join('')}</tr></thead><tbody>
          ${sorted.map((x, i) => `<tr><td class="muted">${i + 1}</td><td>${esc(x.name)}${x.note ? ` <span title="${esc(x.note)}">⚠️</span>` : ''}</td>${ATTRS.map((a) => `<td>${fmt0(x[a.key])}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div></details></div>
      </div>`;

    main.innerHTML = `${head}
      <section class="stats-section">
        <h3>🛡️ Comparativo <span class="muted small">· última leitura de cada clã</span>
          <select id="rv-stat" aria-label="Como comparar">${Object.entries(RIV_STATS).map(([k, l]) => `<option value="${k}" ${k === statK ? 'selected' : ''}>${l}</option>`).join('')}</select></h3>
        <div class="chart-grid">
          <div class="card chart wide">${cmpTable}</div>
          <div class="card chart wide"><h4>💠 Ressonância por faixa</h4>${bandTable}</div>
        </div>
      </section>
      <section class="stats-section">
        <h3>🔍 Clã em detalhe</h3>
        ${detail}
      </section>
      <section class="stats-section">
        <h3>🔎 Buscar jogador</h3>
        <div class="card chart">
          <input type="search" id="rv-q" placeholder="Nome do jogador rival…" value="${esc(RIV.q)}" autocomplete="off">
          <div id="rv-found"></div>
        </div>
      </section>`;
    bind();

    // Busca: todas as leituras; mostra a mais recente de cada jogador
    const allRows = data.scans.slice().sort((a, b) => b.scanned_on.localeCompare(a.scanned_on) || b.id - a.id)
      .flatMap((sc) => (playersBy[sc.id] || []).map((x) => ({ ...x, clan: sc.clan_name, on: sc.scanned_on })));
    const search = () => {
      const q = norm(RIV.q);
      const box = $('#rv-found');
      if (q.length < 2) { box.innerHTML = '<div class="muted small" style="margin-top:8px">Digite ao menos 2 letras.</div>'; return; }
      const seen = new Set();
      const hits = allRows.filter((x) => norm(x.name).includes(q)).filter((x) => { const k = `${norm(x.clan)}|${norm(x.name)}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 50);
      box.innerHTML = hits.length ? `<div class="table-scroll"><table class="mini-table" style="margin-top:8px"><thead><tr><th>Jogador</th><th>Clã</th>${ATTRS.map((a) => `<th>${a.short}</th>`).join('')}<th>Leitura</th></tr></thead><tbody>
        ${hits.map((x) => `<tr><td>${esc(x.name)}${x.note ? ` <span title="${esc(x.note)}">⚠️</span>` : ''}</td><td>${esc(x.clan)}</td>${ATTRS.map((a) => `<td>${fmt0(x[a.key])}</td>`).join('')}<td class="muted small">${dmyS(x.on)}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="muted small" style="margin-top:8px">Nenhum jogador encontrado.</div>';
    };
    search();
    $('#rv-q').addEventListener('input', (e) => { RIV.q = e.target.value; search(); });
    const filterClans = () => {
      const q = norm(RIV.clanQ || '');
      main.querySelectorAll('#rv-clan-tabs .evo-tab').forEach((b) => { b.hidden = !!q && !b.dataset.rvNames.includes(q) && b.getAttribute('aria-selected') !== 'true'; });
    };
    $('#rv-clan-q')?.addEventListener('input', (e) => { RIV.clanQ = e.target.value; filterClans(); });
    filterClans();
    $('#rv-stat').addEventListener('change', (e) => { RIV.stat = e.target.value; viewRivals(true); });
    main.querySelectorAll('[data-rv-clan]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault(); RIV.clan = b.dataset.rvClan;
      viewRivals(true).then(() => { if (b.tagName === 'A') main.querySelector('.evo-tab[aria-selected="true"]')?.scrollIntoView({ block: 'center' }); });
    }));
    main.querySelectorAll('[data-rv-attr]').forEach((b) => b.addEventListener('click', () => { RIV.attr = b.dataset.rvAttr; viewRivals(true); }));
    main.querySelectorAll('[data-rv-del]').forEach((b) => b.addEventListener('click', async () => {
      const sc = data.scans.find((x) => x.id === Number(b.dataset.rvDel));
      if (!(await confirmDialog(`Apagar a leitura de ${sc.clan_name} do dia ${dmyS(sc.scanned_on)}? Os jogadores dessa leitura também serão apagados.`, 'Apagar'))) return;
      try { await api.deleteRivalScan(sc.id); toast('Leitura apagada'); await viewRivals(); } catch (err) { fail(err); }
    }));
    if (keepScroll) window.scrollTo(0, y);
  }


  function viewUtils() {
    main.innerHTML = `
      <div class="page-head"><h1>Utils</h1><span class="muted">Links úteis para o clã</span></div>
      <div class="util-grid">
        <a class="card util-card util-internal" href="#/pilotagem">
          <span class="util-icon" aria-hidden="true">✈️</span>
          <span class="util-body"><b>Pilotagem</b><span class="muted small">Pilotos do clã: ofereça seus serviços ou peça alguém para pilotar a sua conta</span>
            <span class="util-host">${pilotageInbox().length ? `${plural(pilotageInbox().length, 'pedido', 'pedidos')} para você · ` : ''}${offersToReview().length ? `${plural(offersToReview().length, 'anúncio aguardando', 'anúncios aguardando')} aprovação · ` : ''}Abrir →</span></span>
        </a>
        ${UTIL_LINKS.map((l) => `<a class="card util-card" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="util-icon" aria-hidden="true">${l.icon}</span>
          <span class="util-body"><b>${esc(l.title)}</b><span class="muted small">${esc(l.desc)}</span>
            <span class="util-host">${esc(new URL(l.url).hostname.replace(/^www\./, ''))} ↗</span></span>
        </a>`).join('')}
      </div>
      <p class="muted small">Os links externos abrem em uma nova aba.</p>`;
  }

  // ---------- Pilotagem (Utils) ----------
  // Pilotos anunciam seus serviços; os membros pedem a pilotagem da própria conta;
  // o piloto recebe o aviso no sininho e aceita (passa a pilotar a conta) ou recusa.
  const PILOTAGE_MAX_OPEN = 3;
  const PILOTAGE_STATUS = { pending: ['⏳ Aguardando o piloto', 'c-gold'], accepted: ['✔ Aceito', 'c-yes'], declined: ['✖ Recusado', 'c-no'], cancelled: ['Cancelado', 'muted'] };
  async function loadPilotage() {
    try { state.pilotage = await api.pilotageBoard(); } catch { state.pilotage = null; } // null = SQL ainda não rodado
  }
  // Pedidos de pilotagem esperando a minha resposta (sou o piloto)
  const pilotageInbox = () => (state.pilotage?.requests || []).filter((r) => r.pilot_id === state.user?.id && r.status === 'pending');
  // Anúncios esperando a aprovação da staff (líder e oficiais com a permissão "Gerenciar pilotos de contas")
  const canReviewOffers = () => isOfficer() && can('pilots');
  const canReviewOffer = (o) => canReviewOffers() && (o.pilot_id !== state.user?.id || isLeader());
  const isEditReview = (o) => o.status === 'approved' && !!o.pending_about; // edição de anúncio já publicado
  const offersToReview = () => (canReviewOffers() ? (state.pilotage?.offers || []).filter((o) => o.status === 'pending' || isEditReview(o)) : []);

  // Uma linha do registro dos anúncios
  function offerLogLine(l) {
    const pilot = `<b>${esc(l.pilot_name)}</b>`;
    const actor = l.actor_name ? `<b>${esc(l.actor_name)}</b>${ROLE_LABEL[l.actor_role] ? ` <span class="muted">(${esc(ROLE_LABEL[l.actor_role])})</span>` : ''}` : null;
    const text = l.action === 'submitted' ? `📝 ${pilot} enviou o anúncio para aprovação`
      : l.action === 'edit_submitted' ? `✏️ ${pilot} enviou uma edição do anúncio`
      : l.action === 'edit_approved' ? `✔ ${actor || 'A staff'} aprovou a edição do anúncio de ${pilot}`
      : l.action === 'edit_rejected' ? `✖ ${actor || 'A staff'} recusou a edição do anúncio de ${pilot}`
      : l.action === 'approved' ? (actor ? `✔ ${actor} aprovou o anúncio de ${pilot}` : `✔ Anúncio de ${pilot} aprovado (antes do registro)`)
        : l.action === 'rejected' ? (actor ? `✖ ${actor} recusou o anúncio de ${pilot}` : `✖ Anúncio de ${pilot} recusado`)
          : l.actor === l.pilot_id ? `🗑 ${pilot} saiu da Pilotagem` : `🗑 ${actor || 'A staff'} removeu o anúncio de ${pilot}`;
    return `<div class="pg-log-row"><div class="muted small">${esc(fmtWhen(l.at))}</div><div>${text}</div>
      ${l.note ? `<div class="small">Motivo: “${esc(l.note)}”</div>` : ''}
      ${l.about ? `<div class="muted small pg-log-about">“${esc(l.about)}”</div>` : ''}</div>`;
  }

  async function viewPilotage(focusId = null) {
    loading();
    const [, history] = await Promise.all([loadPilotage(), isOfficer() ? api.pilotOfferHistory().catch(() => []) : []]);
    const board = state.pilotage;
    // Quem aprovou cada anúncio (a aprovação mais recente)
    const approvalOf = (id) => (history || []).find((l) => l.pilot_id === id && (l.action === 'approved' || l.action === 'edit_approved'));
    const approvedLine = (o) => {
      if (!isOfficer()) return '';
      const a = approvalOf(o.pilot_id);
      if (!a) return '';
      return `<div class="small pg-approved" title="Só a liderança vê">🛡 ${a.action === 'edit_approved' ? 'Edição aprovada' : 'Aprovado'} ${a.actor_name ? `por <b>${esc(a.actor_name)}</b>${ROLE_LABEL[a.actor_role] ? ` (${esc(ROLE_LABEL[a.actor_role])})` : ''} ` : ''}em ${esc(fmtShortDate(a.at))}</div>`;
    };
    const head = `${backRow('#/utils', 'Utils')}
      <div class="page-head"><h1>✈️ Pilotagem</h1><span class="muted">Pilotos do clã que podem jogar na sua conta</span></div>`;
    if (!board) {
      main.innerHTML = `${head}<div class="card empty">A Pilotagem ainda não está ativada. Peça ao líder para rodar o arquivo <b>supabase/pilotagem.sql</b> no Supabase.</div>`;
      return;
    }
    const me = state.me;
    const myId = state.user.id;
    const amPilot = isPilot(me);
    const myOffer = board.offers.find((o) => o.pilot_id === myId);
    const inbox = pilotageInbox();
    const answered = board.requests.filter((r) => r.pilot_id === myId && r.status !== 'pending');
    const mineOut = board.requests.filter((r) => r.pilot_id !== myId && (r.requested_by === myId || r.account_id === myId));
    const openOut = mineOut.filter((r) => r.status === 'pending');
    const staffOthers = isOfficer() ? board.requests.filter((r) => r.pilot_id !== myId && r.requested_by !== myId && r.account_id !== myId) : [];
    const flyingMe = new Set(approvedPilotIds(myId));
    const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
    const status = (r) => { const [t, c] = PILOTAGE_STATUS[r.status] || [r.status, 'muted']; return `<span class="small ${c}">${esc(t)}</span>`; };

    // Botão de pedido em cada anúncio
    const askBtn = (o) => {
      if (o.pilot_id === myId) return '<span class="muted small">Seu anúncio</span>';
      if (isPilotOnly(me)) return '';
      if (!o.active) return '<span class="muted small">Pausado</span>';
      if (flyingMe.has(o.pilot_id)) return '<span class="c-yes small">✔ Já pilota a sua conta</span>';
      if (openOut.some((r) => r.pilot_id === o.pilot_id)) return '<span class="c-gold small">⏳ Pedido enviado</span>';
      if (openOut.length >= PILOTAGE_MAX_OPEN) return `<span class="muted small" title="Aguarde a resposta ou cancele um pedido">Limite de ${PILOTAGE_MAX_OPEN} pedidos em aberto</span>`;
      return `<button class="btn small primary" data-pg-ask="${esc(o.pilot_id)}">Solicitar pilotagem</button>`;
    };
    // Pilotos disponíveis: só anúncios aprovados pela staff
    const offers = board.offers.filter((o) => (o.status || 'approved') === 'approved' && (o.active || o.pilot_id === myId || isOfficer()));
    const review = offersToReview();
    const rejected = canReviewOffers() ? board.offers.filter((o) => o.status === 'rejected') : [];
    const reviewedBy = (o) => (o.reviewed_by_name ? ` por ${esc(o.reviewed_by_name)}` : '');
    const reviewCard = (o) => `<div class="pilot-row pg-req">
        <div class="spacer"><b>${esc(o.name)}</b>${o.pilot_only ? ' <span class="pilot-tag">membro piloto</span>' : ''}${isEditReview(o) ? ' <span class="badge">✏️ Edição</span>' : ''}
          <div class="muted small">${o.status === 'rejected' ? `recusado${reviewedBy(o)} em ${fmtD(o.reviewed_at)}${o.review_note ? ` · “${esc(o.review_note)}”` : ''}` : `enviado em ${fmtD(o.updated_at)}`}</div>
          ${isEditReview(o) ? `<div class="pg-diff">
              <div><span class="muted small">Publicado agora</span><p class="pg-about"><s>${esc(o.about)}</s></p></div>
              <div><span class="muted small">Novo texto</span><p class="pg-about"><b>${esc(o.pending_about)}</b></p></div>
            </div>` : `<p class="pg-about" style="margin-top:6px">${esc(o.about)}</p>`}</div>
        ${o.status === 'pending' || isEditReview(o) ? (canReviewOffer(o) ? `<button class="btn small ghost danger" data-pg-reject="${esc(o.pilot_id)}">Recusar</button>
          <button class="btn small primary" data-pg-approve="${esc(o.pilot_id)}">Aprovar</button>`
          : '<span class="muted small">Outra pessoa da staff aprova o seu anúncio</span>') : ''}
      </div>`;
    // Situação do meu anúncio
    const myStatus = (o) => (isEditReview(o)
      ? '<span class="c-gold small">✏️ Edição aguardando a revisão da staff. Até lá, os membros veem o texto aprovado acima.</span>'
      : o.status === 'pending'
      ? '<span class="c-gold small">⏳ Aguardando aprovação da staff: ainda não aparece para os membros</span>'
      : o.status === 'rejected'
        ? `<span class="c-no small">✖ Recusado${reviewedBy(o)}${o.review_note ? `: “${esc(o.review_note)}”` : ''}. Edite o texto e salve para enviar de novo.</span>`
        : `<span class="${o.active ? 'c-yes' : 'muted'} small">${o.active ? '● Aprovado e disponível: aparece para os membros' : '● Pausado: não aparece para os membros'}</span>`);
    const offerCard = (o) => `<div class="card pg-offer${o.active ? '' : ' paused'}" data-pilot="${esc(o.pilot_id)}">
        <div class="pg-offer-head"><span class="pg-icon" aria-hidden="true">✈️</span>
          <div class="spacer"><b>${esc(o.name)}</b>${o.pilot_only ? ' <span class="pilot-tag">membro piloto</span>' : ''}${o.active ? '' : ' <span class="badge">Pausado</span>'}
            <div class="muted small">${o.accounts ? `pilota ${plural(o.accounts, 'conta', 'contas')} no clã` : 'ainda não pilota contas no site'} · desde ${fmtD(o.updated_at)}</div></div></div>
        <p class="pg-about">${esc(o.about)}</p>
        ${approvedLine(o)}
        <div class="row" style="gap:8px">${askBtn(o)}<span class="spacer"></span>
          ${isOfficer() && o.pilot_id !== myId ? `<button class="btn small ghost danger" data-pg-remove="${esc(o.pilot_id)}" title="Tirar este anúncio da Pilotagem">Remover anúncio</button>` : ''}</div>
      </div>`;
    const reqRow = (r, { asPilot = false, staff = false } = {}) => `<div class="pilot-row pg-req">
        <div class="spacer">${asPilot ? `<b>${esc(r.account_name)}</b> ${r.account_class ? classTag(r.account_class) : ''} pediu para você pilotar a conta`
          : staff ? `<b>${esc(r.account_name)}</b> → piloto <b>${esc(r.pilot_name)}</b>`
            : `Piloto <b>${esc(r.pilot_name)}</b>`}
          <div class="muted small">${fmtD(r.created_at)}${r.message ? ` · “${esc(r.message)}”` : ''}${r.answer ? ` · resposta: “${esc(r.answer)}”` : ''}</div></div>
        ${asPilot && r.status === 'pending' ? `<button class="btn small ghost danger" data-pg-decline="${r.id}">Recusar</button>
          <button class="btn small primary" data-pg-accept="${r.id}">Aceitar</button>`
          : `${status(r)}${!asPilot && !staff && r.status === 'pending' ? ` <button class="btn small ghost" data-pg-cancel="${r.id}">Cancelar</button>` : ''}`}
      </div>`;

    main.innerHTML = `${head}
      <p class="muted small" style="margin-top:0">Peça a um piloto para jogar na sua conta (por exemplo, quando você for viajar). Quando ele aceita, passa a pilotar a sua conta:
        pode responder aos eventos por ela em <b>“Respondendo como”</b>. Você tira o piloto quando quiser em <b>Meu perfil → Pilotos</b>. Até ${PILOTAGE_MAX_OPEN} pedidos em aberto por pessoa.</p>
      ${review.length ? `<h2>🛡 Anúncios aguardando aprovação (${review.length})</h2>
        <p class="muted small" style="margin:0 0 8px">Só a staff vê. O anúncio aparece em “Pilotos disponíveis” depois de aprovado.</p>
        <div class="card" style="margin-bottom:16px">${review.map(reviewCard).join('')}</div>` : ''}
      ${inbox.length ? `<h2>📨 Pedidos para você (${inbox.length})</h2><div class="card" style="margin-bottom:16px">${inbox.map((r) => reqRow(r, { asPilot: true })).join('')}</div>` : ''}
      <div class="card pg-mine" style="margin-bottom:16px">
        <h2>Seu anúncio</h2>
        ${!amPilot ? `<p class="muted small" style="margin:0 0 8px">Quer pilotar contas de outros membros? Marque <b>“Também sou piloto”</b> em Editar perfil e depois cadastre seus serviços aqui.</p>
            <button class="btn small" id="pg-become">✎ Editar perfil</button>`
          : myOffer ? `<p class="pg-about">${esc(myOffer.about)}</p>
            ${isEditReview(myOffer) ? `<div class="pg-pending-edit"><span class="muted small">Sua edição em revisão:</span><p class="pg-about">${esc(myOffer.pending_about)}</p></div>` : ''}
            ${myOffer.edit_note && !isEditReview(myOffer) ? `<p class="c-no small" style="margin:4px 0">✖ Sua última edição foi recusada${reviewedBy(myOffer)}: “${esc(myOffer.edit_note)}”. O texto acima continua publicado.</p>` : ''}
            <div class="row" style="gap:8px">${myStatus(myOffer)}<span class="spacer"></span>
              <button class="btn small" id="pg-edit">Editar</button>
              ${(myOffer.status || 'approved') === 'approved' ? `<button class="btn small" id="pg-toggle">${myOffer.active ? 'Pausar' : 'Ficar disponível'}</button>` : ''}
              <button class="btn small ghost danger" id="pg-leave">Sair da Pilotagem</button></div>
            ${myOffer.status === 'approved' ? `<div class="row pg-share" style="gap:8px;margin-top:10px">
              <span class="muted small">Divulgue seu anúncio:</span>
              <button class="btn small" id="pg-qr">▣ Gerar QR Code</button>
              <button class="btn small" id="pg-link">🔗 Copiar link</button></div>` : ''}`
            : `<p class="muted small" style="margin:0 0 8px">Você é piloto. Cadastre seus serviços para que os membros possam pedir a pilotagem da conta deles.</p>
              <button class="btn small primary" id="pg-edit">+ Cadastrar meus serviços</button>`}
      </div>
      <h2>Pilotos disponíveis (${offers.filter((o) => o.active).length})</h2>
      ${offers.length ? `<div class="pg-grid">${offers.map(offerCard).join('')}</div>` : '<div class="card empty">Nenhum piloto cadastrado ainda.</div>'}
      ${isPilotOnly(me) ? '<p class="muted small">Como membro piloto, você não tem conta própria para pedir pilotagem.</p>' : ''}
      ${mineOut.length ? `<h2 style="margin-top:20px">Seus pedidos</h2><div class="card">${mineOut.map((r) => reqRow(r)).join('')}</div>` : ''}
      ${answered.length ? `<details class="former-box" style="margin-top:16px"><summary>Pedidos que você já respondeu (${answered.length})</summary>
          <div class="card">${answered.map((r) => reqRow(r, { asPilot: true })).join('')}</div></details>` : ''}
      ${(history || []).length ? `<details class="former-box" style="margin-top:16px"><summary>📜 Registro dos anúncios (${history.length}) <span class="muted small">· liderança: quem enviou, aprovou, recusou ou removeu</span></summary>
          <div class="card pg-log">${history.map(offerLogLine).join('')}</div></details>` : ''}
      ${rejected.length ? `<details class="former-box" style="margin-top:16px"><summary>Anúncios recusados (${rejected.length}) <span class="muted small">· liderança</span></summary>
          <div class="card">${rejected.map(reviewCard).join('')}</div></details>` : ''}
      ${staffOthers.length ? `<details class="former-box" style="margin-top:16px"><summary>Todos os pedidos de pilotagem <span class="muted small">· liderança, últimos 60 dias</span> (${staffOthers.length})</summary>
          <div class="card">${staffOthers.map((r) => reqRow(r, { staff: true })).join('')}</div></details>` : ''}`;

    const after = async (msg) => {
      toast(msg);
      state.pilots = await api.pilots().catch(() => state.pilots);
      await viewPilotage();
      renderHeader('pilotage');
    };
    $('#pg-become')?.addEventListener('click', () => openProfile());
    $('#pg-link')?.addEventListener('click', () => copy(offerUrl(myId), 'Link do anúncio copiado'));
    $('#pg-qr')?.addEventListener('click', () => openOfferShare(myOffer));
    // Aberto por um link de anúncio: rola até ele e destaca
    if (focusId) {
      const card = main.querySelector(`.pg-offer[data-pilot="${CSS.escape(focusId)}"]`);
      if (card) {
        card.classList.add('focus');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else toast('Este anúncio não está disponível no momento (pode ter sido pausado ou removido).', true);
    }
    $('#pg-edit')?.addEventListener('click', () => openPilotOfferForm(myOffer, (kind) => after({
      new: 'Anúncio enviado! Ele aparece na Pilotagem depois que a staff aprovar.',
      edit: 'Edição enviada para a revisão da staff. Até lá, os membros continuam vendo o texto aprovado.',
      resent: 'Anúncio enviado para nova aprovação da staff',
    }[kind] || 'Anúncio atualizado')));
    main.querySelectorAll('[data-pg-approve]').forEach((b) => b.addEventListener('click', async () => {
      const o = board.offers.find((x) => x.pilot_id === b.dataset.pgApprove);
      const edit = isEditReview(o);
      if (!(await confirmDialog(edit ? `Aprovar a edição do anúncio de ${o.name}? O texto novo substitui o publicado.`
        : `Aprovar o anúncio de ${o?.name || 'este piloto'}? Ele passa a aparecer em “Pilotos disponíveis” para todos os membros.`, 'Aprovar'))) return;
      try { await api.reviewPilotOffer(o.pilot_id, true, null); await after(edit ? `Edição de ${o.name} publicada` : `Anúncio de ${o.name} aprovado`); } catch (e) { fail(e); }
    }));
    main.querySelectorAll('[data-pg-reject]').forEach((b) => b.addEventListener('click', () => {
      const o = board.offers.find((x) => x.pilot_id === b.dataset.pgReject);
      if (o) openOfferReject(o, () => after(isEditReview(o) ? 'Edição recusada' : 'Anúncio recusado'));
    }));
    $('#pg-toggle')?.addEventListener('click', async () => {
      try { await api.savePilotOffer(myOffer.about, !myOffer.active); await after(myOffer.active ? 'Anúncio pausado' : 'Você está disponível de novo'); } catch (e) { fail(e); }
    });
    $('#pg-leave')?.addEventListener('click', async () => {
      if (!(await confirmDialog(`Sair da Pilotagem? Seu anúncio some${inbox.length ? ' e os pedidos em aberto são recusados' : ''}. As contas que você já pilota continuam com você.`, 'Sair'))) return;
      try { await api.deletePilotOffer(myId); await after('Você saiu da Pilotagem'); } catch (e) { fail(e); }
    });
    main.querySelectorAll('[data-pg-remove]').forEach((b) => b.addEventListener('click', async () => {
      const o = board.offers.find((x) => x.pilot_id === b.dataset.pgRemove);
      if (!(await confirmDialog(`Remover o anúncio de ${o?.name || 'este piloto'} da Pilotagem? Os pedidos em aberto com ele são recusados.`, 'Remover'))) return;
      try { await api.deletePilotOffer(b.dataset.pgRemove); await after('Anúncio removido'); } catch (e) { fail(e); }
    }));
    main.querySelectorAll('[data-pg-ask]').forEach((b) => b.addEventListener('click', () => {
      const o = board.offers.find((x) => x.pilot_id === b.dataset.pgAsk);
      if (o) openPilotageRequest(o, () => after(`Pedido enviado para ${o.name}. Ele recebe o aviso no sininho.`));
    }));
    main.querySelectorAll('[data-pg-cancel]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmDialog('Cancelar este pedido de pilotagem?', 'Cancelar pedido'))) return;
      try { await api.cancelPilotage(Number(b.dataset.pgCancel)); await after('Pedido cancelado'); } catch (e) { fail(e); }
    }));
    main.querySelectorAll('[data-pg-accept]').forEach((b) => b.addEventListener('click', async () => {
      const r = inbox.find((x) => x.id === Number(b.dataset.pgAccept));
      if (!(await confirmDialog(`Aceitar pilotar a conta ${r?.account_name || ''}? Ela passa a aparecer para você em “Respondendo como”.`, 'Aceitar'))) return;
      try { await api.answerPilotage(r.id, true, null); await after(`Agora você pilota a conta ${r.account_name}`); } catch (e) { fail(e); }
    }));
    main.querySelectorAll('[data-pg-decline]').forEach((b) => b.addEventListener('click', () => {
      const r = inbox.find((x) => x.id === Number(b.dataset.pgDecline));
      if (r) openPilotageDecline(r, () => after('Pedido recusado'));
    }));
  }

  // ---------- Divulgar o anúncio: link e QR Code ----------
  const offerUrl = (id) => `${location.origin}${location.pathname}#/pilotagem/${encodeURIComponent(id)}`;
  // Gerador de QR Code (qrcode-generator, MIT), guardado no próprio site e carregado só quando usado
  let qrLib = null;
  function loadQrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    qrLib ||= new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/qrcode-generator-1.4.4.js';
      sc.onload = () => (window.qrcode ? resolve(window.qrcode) : reject(new Error('Gerador de QR Code indisponível')));
      sc.onerror = () => { qrLib = null; reject(new Error('Não foi possível carregar o gerador de QR Code')); };
      document.head.appendChild(sc);
    });
    return qrLib;
  }
  // Quebra o texto em linhas que cabem na largura (com reticências se passar do limite)
  function wrapLines(ctx, text, maxW, maxLines) {
    const out = [];
    String(text || '').split(/\n+/).forEach((para) => {
      let line = '';
      para.split(/\s+/).filter(Boolean).forEach((w) => {
        const t = line ? `${line} ${w}` : w;
        if (ctx.measureText(t).width <= maxW || !line) line = t; else { out.push(line); line = w; }
      });
      if (line) out.push(line);
    });
    if (out.length > maxLines) {
      out.length = maxLines;
      let last = out[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      out[maxLines - 1] = `${last.trimEnd()}…`;
    }
    return out;
  }
  // Imagem do anúncio (1080×1350, boa para WhatsApp, Discord e stories): nome, texto e QR Code do link
  async function offerImage(o, url) {
    const qr = (await loadQrLib())(0, 'M');
    qr.addData(url);
    qr.make();
    try { await Promise.all(['700 64px Cinzel', '400 36px Inter', '600 36px Inter'].map((f) => document.fonts.load(f))); } catch { /* usa a fonte padrão */ }
    const W = 1080; const H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    // Fundo
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a140c'); bg.addColorStop(0.55, '#140a07'); bg.addColorStop(1, '#0b0605');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, 0, 40, W / 2, 0, 700);
    glow.addColorStop(0, 'rgba(232,70,31,.35)'); glow.addColorStop(1, 'rgba(232,70,31,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(220,170,82,.55)'; g.lineWidth = 4;
    g.strokeRect(28, 28, W - 56, H - 56);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // Cabeçalho
    g.fillStyle = '#dcaa52'; g.font = '700 46px Cinzel, serif';
    g.fillText((CFG.clanName || 'Clã').toUpperCase(), W / 2, 112);
    g.fillStyle = '#ff7a2f'; g.font = '600 34px Inter, sans-serif';
    g.fillText('✈️  PILOTAGEM', W / 2, 166);
    // Nome do piloto
    g.fillStyle = '#ffffff'; g.font = '700 74px Cinzel, serif';
    let name = o.name;
    while (g.measureText(name).width > W - 160 && name.length > 3) name = name.slice(0, -1);
    g.fillText(name === o.name ? name : `${name}…`, W / 2, 274);
    g.fillStyle = '#c9b8ff'; g.font = '600 30px Inter, sans-serif';
    g.fillText(o.pilot_only ? 'Membro piloto' : 'Piloto do clã', W / 2, 322);
    // Texto do anúncio
    g.fillStyle = '#f1e6dc'; g.font = '400 38px Inter, sans-serif';
    const lines = wrapLines(g, `“${o.about}”`, W - 180, 6);
    lines.forEach((l, i) => g.fillText(l, W / 2, 404 + i * 54));
    // QR Code em um quadro branco
    const box = 420; const bx = (W - box) / 2; const by = H - box - 210;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.roundRect ? g.roundRect(bx, by, box, box, 24) : g.rect(bx, by, box, box); g.fill();
    const n = qr.getModuleCount(); const quiet = 28; const cell = Math.floor((box - quiet * 2) / n);
    const off = (box - cell * n) / 2;
    g.fillStyle = '#0b0605';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect(bx + off + k * cell, by + off + r * cell, cell, cell);
    // Rodapé
    g.fillStyle = '#dcaa52'; g.font = '600 34px Inter, sans-serif';
    g.fillText('Escaneie para pedir pilotagem', W / 2, by + box + 70);
    g.fillStyle = '#b79f8f'; g.font = '400 26px Inter, sans-serif';
    g.fillText(url.replace(/^https?:\/\//, ''), W / 2, by + box + 118);
    return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem'))), 'image/png'));
  }
  async function openOfferShare(o) {
    const url = offerUrl(o.pilot_id);
    let blob;
    try { blob = await offerImage(o, url); } catch (e) { fail(e); return; }
    const src = URL.createObjectURL(blob);
    const fileName = `pilotagem-${norm(o.name).replace(/[^a-z0-9]+/g, '-') || 'anuncio'}.png`;
    const file = typeof File === 'function' ? new File([blob], fileName, { type: 'image/png' }) : null;
    const canShareFile = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    openDialog(`<div class="stack pg-share-dlg">
        <h2>Divulgar seu anúncio</h2>
        <img class="pg-share-img" src="${src}" alt="Imagem do anúncio de ${esc(o.name)} com QR Code">
        <p class="muted small" style="margin:0">Quem escanear o QR Code ou abrir o link vai direto para o seu anúncio na Pilotagem (precisa entrar no site com a conta do clã).</p>
        <div class="field"><label for="pg-url">Link do anúncio</label><input id="pg-url" readonly value="${esc(url)}"></div>
        <div class="row end" style="flex-wrap:wrap">
          <button type="button" class="btn ghost" data-close>Fechar</button>
          <button type="button" class="btn" id="pgs-copy">🔗 Copiar link</button>
          ${canShareFile ? '<button type="button" class="btn" id="pgs-share">📤 Compartilhar</button>' : ''}
          <a class="btn primary" id="pgs-dl" href="${src}" download="${esc(fileName)}">⬇ Baixar imagem</a>
        </div>
      </div>`, (d) => {
      $('#pg-url', d).addEventListener('focus', (e) => e.target.select());
      $('#pgs-copy', d).addEventListener('click', () => copy(url, 'Link do anúncio copiado'));
      $('#pgs-share', d)?.addEventListener('click', async () => {
        try { await navigator.share({ files: [file], title: `Pilotagem · ${o.name}`, text: `${o.about}\n${url}` }); }
        catch (e) { if (e?.name !== 'AbortError') toast('Não foi possível compartilhar. Use “Baixar imagem”.', true); }
      });
      dlg.addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(src), 1000), { once: true });
    });
  }

  function openPilotOfferForm(offer, after) {
    openDialog(`<form class="stack" id="pg-form">
        <h2>${offer ? 'Editar seu anúncio' : 'Cadastrar meus serviços de piloto'}</h2>
        <div class="field"><label for="pg-about">Como você pode ajudar</label>
          <textarea id="pg-about" rows="4" maxlength="300" required placeholder="Ex.: piloto Guerras e Ritos à noite (20h–23h), nos fins de semana também.">${esc(offer?.pending_about || offer?.about || '')}</textarea>
          <span class="muted small">Até 300 caracteres. Todos os membros do clã veem o seu nome e este texto.</span></div>
        <p class="muted small" style="margin:0">🛡 A staff aprova o anúncio antes de ele aparecer para os membros. ${offer?.status === 'approved'
          ? 'A edição do texto também passa pela staff: até ela aprovar, os membros continuam vendo o texto aprovado.'
          : 'Se você mudar o texto, ele continua aguardando a aprovação.'}</p>
        <label class="check-line"><input type="checkbox" id="pg-active" ${!offer || offer.active ? 'checked' : ''}> <span>Disponível para novos pedidos</span></label>
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Salvar</button></div>
      </form>`, (d) => {
      $('#pg-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        e.submitter && (e.submitter.disabled = true);
        const about = $('#pg-about', d).value.trim();
        // O que aconteceu: 'new' (anúncio novo), 'edit' (edição de aprovado em revisão), 'resent' (volta a aguardar), '' (só disponibilidade)
        const kind = !offer ? 'new'
          : offer.status === 'approved' ? (about !== offer.about && about !== offer.pending_about ? 'edit' : '')
            : (about !== offer.about || offer.status === 'rejected' ? 'resent' : '');
        try { await api.savePilotOffer(about, $('#pg-active', d).checked); dlg.close(); await after(kind); }
        catch (err) { fail(err); if (e.submitter) e.submitter.disabled = false; }
      });
    });
  }

  // Staff recusa um anúncio (o motivo aparece para o piloto)
  function openOfferReject(o, after) {
    openDialog(`<form class="stack" id="por-form">
        <h2>${isEditReview(o) ? `Recusar a edição de ${esc(o.name)}` : `Recusar o anúncio de ${esc(o.name)}`}</h2>
        <p class="pg-about">${esc(isEditReview(o) ? o.pending_about : o.about)}</p>
        <div class="field"><label for="por-msg">Motivo <span class="muted small">(opcional, aparece para o piloto)</span></label>
          <textarea id="por-msg" rows="3" maxlength="300" placeholder="Ex.: escreva os horários em que você pode pilotar"></textarea></div>
        <p class="muted small" style="margin:0">${isEditReview(o) ? 'O texto aprovado continua publicado.' : ''} O piloto pode editar o texto e enviar de novo.</p>
        <div class="row end"><button type="button" class="btn ghost" data-close>Voltar</button><button type="submit" class="btn danger">Recusar anúncio</button></div>
      </form>`, (d) => {
      $('#por-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        e.submitter && (e.submitter.disabled = true);
        try { await api.reviewPilotOffer(o.pilot_id, false, $('#por-msg', d).value.trim()); dlg.close(); await after(); }
        catch (err) { fail(err); if (e.submitter) e.submitter.disabled = false; }
      });
    });
  }

  function openPilotageRequest(offer, after) {
    openDialog(`<form class="stack" id="pgr-form">
        <h2>Pedir pilotagem a ${esc(offer.name)}</h2>
        <p class="pg-about">${esc(offer.about)}</p>
        <div class="field"><label for="pgr-msg">Mensagem <span class="muted small">(opcional)</span></label>
          <textarea id="pgr-msg" rows="3" maxlength="300" placeholder="Ex.: vou viajar no sábado, consegue jogar a Guerra na minha conta?"></textarea></div>
        <p class="muted small" style="margin:0">${esc(offer.name)} recebe o aviso no sininho. Se aceitar, passa a pilotar a <b>sua conta</b> (${esc(displayName(state.me))}) e pode responder aos eventos por ela. Você tira o piloto quando quiser em Meu perfil → Pilotos.</p>
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button type="submit" class="btn primary">Enviar pedido</button></div>
      </form>`, (d) => {
      $('#pgr-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        e.submitter && (e.submitter.disabled = true);
        try { await api.requestPilotage(offer.pilot_id, $('#pgr-msg', d).value.trim()); dlg.close(); await after(); }
        catch (err) { fail(err); if (e.submitter) e.submitter.disabled = false; }
      });
    });
  }

  function openPilotageDecline(r, after) {
    openDialog(`<form class="stack" id="pgd-form">
        <h2>Recusar o pedido de ${esc(r.account_name)}</h2>
        <div class="field"><label for="pgd-msg">Motivo <span class="muted small">(opcional, aparece para quem pediu)</span></label>
          <textarea id="pgd-msg" rows="3" maxlength="300" placeholder="Ex.: não consigo nesse horário"></textarea></div>
        <div class="row end"><button type="button" class="btn ghost" data-close>Voltar</button><button type="submit" class="btn danger">Recusar pedido</button></div>
      </form>`, (d) => {
      $('#pgd-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        e.submitter && (e.submitter.disabled = true);
        try { await api.answerPilotage(r.id, false, $('#pgd-msg', d).value.trim()); dlg.close(); await after(); }
        catch (err) { fail(err); if (e.submitter) e.submitter.disabled = false; }
      });
    });
  }

  // ---------- Membros ----------

  const M = { q: '', tab: 'members' };

  async function viewMembers() {
    loading();
    state.members = await api.members();
    const phones = can('view_phone') ? Object.fromEntries((await api.contacts()).map((c) => [c.user_id, c.phone])) : {};
    state.pilots = await api.pilots().catch(() => state.pilots || []);
    const pilotRequests = can('pilots') ? state.pilots.filter((p) => p.status === 'pending') : [];
    await loadLeaves();
    const leaveRows = pendingLeaves().filter((l) => ACTIVE_ROLES.includes(memberById(l.user_id)?.role) && canDecideLeave(l));
    const histBy = {};
    if (isOfficer()) (await api.profileHistory()).forEach((h) => { (histBy[h.user_id] ||= []).push(h); });
    const noteCount = {};
    if (can('notes')) (await api.notes()).forEach((n) => { noteCount[n.member_id] = (noteCount[n.member_id] || 0) + 1; });
    // Ausência atual ou a próxima de cada membro (o motivo aparece ao passar o mouse)
    const today = localDay();
    const absBy = {};
    (await api.absences().catch(() => [])).filter((a) => a.ends_on >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on)).forEach((a) => { absBy[a.user_id] ||= a; });
    const absTag = (m) => {
      const a = absBy[m.id];
      if (!a) return '';
      const txt = a.starts_on <= today ? `ausente até ${fmtDay2(a.ends_on)}` : `ausente de ${fmtDay2(a.starts_on)} a ${fmtDay2(a.ends_on)}`;
      return `<span class="abs-tag" title="${esc(`Motivo: ${a.reason || ''}`)}">✈️ ${txt}</span>`;
    };
    const noteBadge = (m) => (noteCount[m.id] ? `<span class="note-badge" title="${noteCount[m.id]} anotação(ões) interna(s)">📝 ${noteCount[m.id]}</span>` : '');
    const oldNames = (id) => (histBy[id] || []).flatMap((h) => ['game_name', 'google_name'].map((f) => h.changes?.[f]?.[0])).filter(Boolean);
    const sorted = [...state.members].sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || byName(a, b));
    const pending = sorted.filter((m) => m.role === 'pending');
    const activeAll = sorted.filter((m) => ACTIVE_ROLES.includes(m.role));
    // Membros piloto ficam numa aba própria; os membros jogadores, na aba principal
    const active = activeAll.filter((m) => !isPilotOnly(m));
    const pilotsOnly = activeAll.filter(isPilotOnly);
    const flownBy = (id) => state.pilots.filter((p) => p.pilot_id === id && p.status === 'approved').map((p) => memberById(p.account_id))
      .filter((a) => a && ACTIVE_ROLES.includes(a.role));
    const helpers = active.filter((m) => m.is_pilot || flownBy(m.id).length);
    const pilotsTab = M.tab === 'pilots';
    const former = sorted.filter((m) => m.role === 'former');
    const amLeader = state.me.role === 'leader';
    // Quando e por que cada ex-membro saiu
    const mlog = isOfficer() && former.length ? await api.membershipLog() : [];
    const byIdAll = Object.fromEntries(state.members.map((m) => [m.id, m]));
    const leftInfo = (m) => {
      const h = mlog.find((x) => x.user_id === m.id && x.to_role === 'former');
      if (!h) return '<span class="muted small">Ex-membro</span>';
      return `<span class="muted small left-info">${h.from_role === 'pending' ? 'Recusado' : /^Pediu para sair do clã/.test(h.reason || '') ? 'Saiu (a pedido)' : 'Removido'} em ${new Date(h.changed_at).toLocaleDateString('pt-BR')}`
        + `${byIdAll[h.changed_by] ? ` por ${esc(displayName(byIdAll[h.changed_by]))}` : ''}${h.reason ? `<br>“${esc(h.reason)}”` : ''}</span>`;
    };

    const roleControl = (m) => {
      if (m.id === state.user.id) return `<span class="role-tag ${m.role}">${ROLE_LABEL[m.role]} (você)</span>`;
      if (amLeader) {
        return `<select class="inline" data-role="${esc(m.id)}" aria-label="Cargo de ${esc(displayName(m))}">
          ${['member', 'officer', 'leader'].map((r) => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}
          <option value="former">Remover do clã…</option>
        </select>`;
      }
      if (can('member_remove') && m.role === 'member') return `<span class="role-tag">${ROLE_LABEL[m.role]}</span> <button class="btn small ghost danger" data-remove="${esc(m.id)}">Remover</button>`;
      return `<span class="role-tag ${m.role}">${ROLE_LABEL[m.role]}</span>`;
    };
    const phoneLink = (m) => {
      const ph = phones[m.id];
      if (!ph) return '';
      return `<a class="phone" href="tel:${esc(ph.replace(/[^\d+]/g, ''))}">📞 ${esc(ph)}</a>`;
    };
    const searchText = (m) => [displayName(m), m.google_name, ...oldNames(m.id)].join(' ').toLowerCase();
    const formerly = (m) => { const n = [...new Set(oldNames(m.id))].filter((x) => x !== displayName(m) && x !== m.google_name); return n.length ? `<span class="formerly">antes: ${esc(n.join(', '))}</span>` : ''; };
    const histBtn = (m) => (histBy[m.id]?.length
      ? `<button class="btn small ghost" data-history="${esc(m.id)}" title="Ver histórico de alterações">🕘 ${histBy[m.id].length}</button>` : '');
    const kindBtn = (m) => (canChangeKind(m)
      ? `<button class="btn small ghost" data-kind="${esc(m.id)}" title="${isPilotOnly(m) ? `Tornar ${esc(displayName(m))} jogador (com conta própria no jogo)` : `Tornar ${esc(displayName(m))} membro piloto (sem conta própria no jogo)`}">${isPilotOnly(m) ? '🎮 Tornar jogador' : '🧑‍✈️ Tornar piloto'}</button>` : '');
    // Membro piloto: no lugar da classe, as contas que ele pilota (ou o que escreveu no cadastro)
    const pilotLine = (m) => {
      const flown = flownBy(m.id);
      return `<div class="member-build"><span class="pilot-kind">🧑‍✈️ Membro piloto</span>${flown.length
        ? `<span class="small">pilota ${flown.map((a) => `<a class="member-link" href="#/membro/${encodeURIComponent(a.id)}">${esc(displayName(a))}</a>`).join(', ')}</span>`
        : `<span class="muted small">${m.pilot_note ? `informou: “${esc(m.pilot_note)}” · ` : ''}ainda sem conta vinculada</span>`}</div>`;
    };
    const row = (m, ctrl) => `<div class="member clickable" data-search="${esc(searchText(m))}" data-profile="${esc(m.id)}" title="Abrir o perfil de ${esc(displayName(m))}">${avatar(m, 'lg')}
      <div class="name"><a class="member-link" href="#/membro/${encodeURIComponent(m.id)}">${esc(displayName(m))}</a>${medalsHtml(m.id)} ${absTag(m)} ${noteBadge(m)} ${pilotLabel(m)} ${formerly(m)}
        <small>${m.managed ? 'conta sem login' : (m.game_name ? esc(m.google_name) : '')} ${phoneLink(m)}</small>
        ${isPilotOnly(m) ? pilotLine(m)
          : m.char_class ? `<div class="member-build">${classTag(m.char_class)} <span>${esc(CLASS[m.char_class].label)}</span><span class="chip-stats">${statsLine(m)}</span></div>` : '<div class="member-build muted small">Classe e atributos não informados</div>'}
      </div>${canRename(m) ? `<button class="btn small ghost" data-rename="${esc(m.id)}" title="Editar o nick de ${esc(displayName(m))}">✎ Nick</button>` : ''}${kindBtn(m)}${histBtn(m)}${ctrl}</div>`;

    main.innerHTML = `
      <div class="page-head"><h1>Membros</h1><span class="muted">${active.length} ativos${pilotsOnly.length ? ` · ${pilotsOnly.length} ${pilotsOnly.length === 1 ? 'membro piloto' : 'membros piloto'}` : ''}</span>
        ${can('csv') ? '<button class="btn small" id="btn-csv" title="Baixar planilha (CSV separado por ;)">⬇ Exportar CSV</button>' : ''}</div>
      ${can('stats') ? `<details class="stats-box" id="stats-box"${S.open ? ' open' : ''}>
        <summary>📊 Estatísticas do clã <span class="muted small">· composição, engajamento e evolução</span></summary>
        <div id="clan-stats"></div>
      </details>` : ''}
      ${isOfficer() ? `<input type="search" id="m-search" class="search" placeholder="Buscar por nome atual ou antigo…" value="${esc(M.q)}">` : ''}
      ${leaveRows.length ? `<h2>🚪 Pedidos para sair do clã (${leaveRows.length})</h2>
        <div class="card" style="margin-bottom:20px">${leaveRows.map((l) => {
          const m = memberById(l.user_id);
          return `<div class="pilot-row">${avatar(m)}
            <div class="spacer"><a class="member-link" href="#/membro/${encodeURIComponent(l.user_id)}"><b>${esc(displayName(m))}</b></a> quer sair do clã
              <div class="muted small">pediu em ${new Date(l.requested_at).toLocaleDateString('pt-BR')}${l.requested_by && l.requested_by !== l.user_id ? ` (por ${esc(nameOf(l.requested_by))})` : ''} · “${esc(l.reason)}”</div></div>
            <button class="btn small ghost danger" data-leave-deny="${l.id}">Recusar</button>
            <button class="btn small primary" data-leave-ok="${l.id}">Aprovar saída</button>
          </div>`;
        }).join('')}</div>` : ''}
      ${pilotRequests.length ? `<h2>🧑‍✈️ Pedidos de piloto (${pilotRequests.length})</h2>
        <div class="card" style="margin-bottom:20px">${pilotRequests.map((p) => {
          const pilot = memberById(p.pilot_id); const acc = memberById(p.account_id);
          return `<div class="pilot-row">${avatar(pilot)}
            <div class="spacer"><b>${esc(displayName(pilot))}</b> quer pilotar <a class="member-link" href="#/membro/${encodeURIComponent(p.account_id)}">${esc(displayName(acc))}</a>
              <div class="muted small">pediu em ${new Date(p.requested_at).toLocaleDateString('pt-BR')}${p.reason ? ` · “${esc(p.reason)}”` : ''}${acc && !acc.managed ? ' · o dono da conta também pode aprovar' : ''}</div></div>
            <button class="btn small ghost danger" data-pr-deny="${esc(p.account_id)}|${esc(p.pilot_id)}">Recusar</button>
            <button class="btn small primary" data-pr-approve="${esc(p.account_id)}|${esc(p.pilot_id)}">Aprovar</button>
          </div>`;
        }).join('')}</div>` : ''}
      ${isOfficer() && pending.length ? `<h2>Aguardando aprovação (${pending.length})</h2>
        <div class="card" style="margin-bottom:20px">${pending.map((m) => row(m, `${can('member_remove') ? `<button class="btn small ghost danger" data-remove="${esc(m.id)}">Recusar</button>` : ''}
          ${can('member_approve') ? `<button class="btn small primary" data-approve="${esc(m.id)}">Aprovar</button>` : ''}`)).join('')}</div>` : ''}
      ${isOfficer() ? `<div class="seg rc-filter m-tabs" role="tablist" aria-label="Tipo de membro">
          <button type="button" role="tab" data-mtab="members" class="${pilotsTab ? '' : 'on'}" aria-selected="${!pilotsTab}">Membros (${active.length})</button>
          <button type="button" role="tab" data-mtab="pilots" class="${pilotsTab ? 'on' : ''}" aria-selected="${pilotsTab}">🧑‍✈️ Membros piloto (${pilotsOnly.length})</button>
        </div>` : ''}
      <div class="card" id="m-tab-members"${pilotsTab ? ' hidden' : ''}>${active.map((m) => row(m, roleControl(m))).join('')}</div>
      <div id="m-tab-pilots"${pilotsTab ? '' : ' hidden'}>
        <p class="muted small" style="margin:0 0 10px">Membros piloto não têm conta própria no jogo: não respondem eventos pela própria conta e não entram no rank de força nem na frequência. Contam só as contas que eles pilotam.</p>
        <div class="card">${pilotsOnly.map((m) => row(m, roleControl(m))).join('') || '<p class="muted">Nenhum membro piloto ainda. Quem se cadastra como membro piloto aparece primeiro em “Aguardando aprovação”.</p>'}</div>
        ${helpers.length ? `<h2 style="margin-top:20px">Membros que também pilotam (${helpers.length})</h2>
          <div class="card">${helpers.map((m) => {
            const flown = flownBy(m.id);
            return `<div class="pilot-row">${avatar(m)}<div class="spacer"><a class="member-link" href="#/membro/${encodeURIComponent(m.id)}"><b>${esc(displayName(m))}</b></a>${m.is_pilot ? ' <span class="pilot-tag">🧑‍✈️ piloto</span>' : ''}
              <div class="muted small">${flown.length ? `pilota ${flown.map((a) => esc(displayName(a))).join(', ')}` : 'ainda não pilota nenhuma conta'}${m.pilot_note ? ` · “${esc(m.pilot_note)}”` : ''}</div></div></div>`;
          }).join('')}</div>` : ''}
      </div>
      ${isOfficer() && former.length ? `<details class="former-box"${M.q ? ' open' : ''}>
        <summary>Ex-membros (${former.length}) <span class="muted small">· saíram ou foram removidos; o histórico é mantido</span></summary>
        <div class="card">${former.map((m) => row(m, `${leftInfo(m)}${amLeader ? `<button class="btn small" data-readmit="${esc(m.id)}">Readmitir</button>` : ''}`)).join('')}</div>
      </details>` : ''}
      ${isOfficer() ? '<p class="muted small">Novos membros aparecem aqui depois do primeiro login com o Google. Só o líder pode promover oficiais. Telefones são visíveis apenas para oficiais e líder.</p>' : ''}`;
    renderHeader('members'); // atualiza o seletor "Respondendo como" (ex.: conta pilotada recém-aprovada)

    const change = async (id, role, msg) => {
      try { await api.setRole(id, role); toast(msg); await viewMembers(); } catch (e) { fail(e); await viewMembers(); }
    };
    const applySearch = () => {
      const q = M.q.trim().toLowerCase();
      main.querySelectorAll('.member[data-search]').forEach((r) => { r.hidden = !!q && !r.dataset.search.includes(q); });
      // Se a busca encontrar algum ex-membro, abre a lista deles
      const fb = main.querySelector('.former-box');
      if (fb && q) fb.open = [...fb.querySelectorAll('.member')].some((r) => !r.hidden);
    };
    $('#m-search')?.addEventListener('input', (e) => { M.q = e.target.value; applySearch(); });
    main.querySelectorAll('[data-mtab]').forEach((b) => b.addEventListener('click', () => {
      M.tab = b.dataset.mtab;
      main.querySelectorAll('[data-mtab]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      $('#m-tab-members').hidden = M.tab === 'pilots';
      $('#m-tab-pilots').hidden = M.tab !== 'pilots';
    }));
    // Estatísticas: só carregam quando o painel é aberto (e lembram se estava aberto)
    const statsBox = $('#stats-box');
    if (statsBox) {
      let loaded = false;
      const load = () => { if (!loaded) { loaded = true; renderClanStats($('#clan-stats')).catch((e) => { loaded = false; fail(e); }); } };
      statsBox.addEventListener('toggle', () => { S.open = statsBox.open; if (statsBox.open) load(); });
      if (statsBox.open) load();
    }
    // Clique na linha abre o perfil (exceto em botões, seletores e links)
    main.querySelectorAll('.member[data-profile]').forEach((r) => r.addEventListener('click', (e) => {
      if (e.target.closest('a, button, select, input, label')) return;
      location.hash = `#/membro/${encodeURIComponent(r.dataset.profile)}`;
    }));
    applySearch();
    main.querySelectorAll('[data-history]').forEach((b) => b.addEventListener('click', () => {
      openHistory(state.members.find((x) => x.id === b.dataset.history), histBy[b.dataset.history] || []);
    }));
    main.querySelectorAll('[data-rename]').forEach((b) => b.addEventListener('click', () => {
      const m = [...pending, ...activeAll, ...former].find((x) => x.id === b.dataset.rename);
      if (m) openRenameDialog(m, () => viewMembers());
    }));
    main.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      const m = [...pending, ...activeAll].find((x) => x.id === b.dataset.kind);
      if (m) openKindDialog(m, () => viewMembers());
    }));
    $('#btn-csv')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try { await exportMembersCsv(phones); } catch (err) { fail(err); } finally { e.target.disabled = false; }
    });
    main.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => change(b.dataset.approve, 'member', 'Membro aprovado')));
    const decide = (approve) => (b) => b.addEventListener('click', async () => {
      const [acc, pilot] = (approve ? b.dataset.prApprove : b.dataset.prDeny).split('|');
      try { await api.decidePilotAccess(acc, pilot, approve); toast(approve ? 'Piloto aprovado' : 'Pedido recusado'); await viewMembers(); } catch (e) { fail(e); }
    });
    main.querySelectorAll('[data-pr-approve]').forEach(decide(true));
    bindLeaveDecisions(viewMembers);
    main.querySelectorAll('[data-pr-deny]').forEach(decide(false));
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      openRemoveDialog(state.members.find((x) => x.id === b.dataset.remove), viewMembers);
    }));
    main.querySelectorAll('[data-readmit]').forEach((b) => b.addEventListener('click', async () => {
      const m = state.members.find((x) => x.id === b.dataset.readmit);
      if (await confirmDialog(`Readmitir ${displayName(m)} como Membro? O histórico anterior continua guardado.`, 'Readmitir')) change(m.id, 'member', 'Membro readmitido');
    }));
    main.querySelectorAll('[data-role]').forEach((s) => s.addEventListener('change', () => {
      const m = state.members.find((x) => x.id === s.dataset.role);
      if (s.value === 'former') { s.value = m.role; openRemoveDialog(m, viewMembers); return; }
      change(s.dataset.role, s.value, 'Cargo atualizado');
    }));
  }

  // =====================================================================
  //  Formulários
  // =====================================================================

  // ---------- Dias e horários fixos de alguns tipos de evento (horário de Brasília) ----------
  const TYPE_SCHEDULE = [
    { match: (n) => n.includes('guerra das sombras'), days: [4, 6], hh: 19, mm: 30, label: 'quintas e sábados, às 19:30' },
    { match: (n) => n.includes('vigilia'), days: [0], hh: 20, mm: 0, label: 'domingos, às 20:00' },
    { match: (n) => n.includes('torre'), days: [4, 6], hh: 20, mm: 0, label: 'quintas e sábados, às 20:00' },
  ];
  const typeNameOf = (id) => state.types.find((t) => t.id === id)?.name || '';
  const scheduleFor = (typeId) => { const n = norm(typeNameOf(typeId)); return n ? TYPE_SCHEDULE.find((x) => x.match(n)) || null : null; };
  // Dia da semana, hora e minuto em Brasília
  function brWhen(d) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: RAFFLE_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hh: Number(parts.hour) % 24, mm: Number(parts.minute) };
  }
  const fitsSchedule = (sc, d) => { const w = brWhen(d); return sc.days.includes(w.day) && w.hh === sc.hh && w.mm === sc.mm; };
  // Próximo dia permitido a partir de uma data (no horário fixo, em Brasília; o Brasil não tem horário de verão)
  function nextScheduleSlot(sc, from) {
    const min = Math.max(Date.now(), from.getTime() - 86400e3);
    for (let i = 0; i < 15; i++) {
      const ymd = brDay(new Date(from.getTime() + i * 86400e3));
      const day = new Date(`${ymd}T12:00:00Z`).getUTCDay();
      if (!sc.days.includes(day)) continue;
      const slot = new Date(`${ymd}T${pad(sc.hh)}:${pad(sc.mm)}:00-03:00`);
      if (slot.getTime() > min) return slot;
    }
    return from;
  }

  function openEventForm(ev) {
    const editing = !!ev;
    let start = ev?.starts_at;
    if (!start) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(20, 0, 0, 0); start = d.toISOString(); }
    openDialog(`
      <form id="ev-form" class="stack">
        <h2>${editing ? 'Editar evento' : 'Novo evento'}</h2>
        <div class="field">
          <label for="f-title">Nome do evento</label>
          <input id="f-title" list="f-suggestions" required maxlength="100" value="${esc(ev?.title || '')}" placeholder="Ex.: Guerra das Sombras">
          <datalist id="f-suggestions">${[...new Set([...state.types.map((t) => t.name).filter((n) => norm(n) !== 'outros'), ...EVENT_SUGGESTIONS])].map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
        </div>
        <div class="field">
          <label for="f-type">Tipo do evento</label>
          <select id="f-type" required>
            <option value="" disabled hidden ${ev?.type_id ? '' : 'selected'}>Selecione o tipo…</option>
            ${state.types.map((t) => `<option value="${t.id}" ${t.id === ev?.type_id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
          <div class="muted small field-hint">Agrupa os eventos no painel de Frequência. Novos tipos são cadastrados na tabela <code>event_types</code>.</div>
          <div class="small field-hint ev-sched" id="f-sched" hidden></div>
        </div>
        <div class="grid2">
          <div class="field"><label for="f-start">Data e hora</label><input id="f-start" type="datetime-local" required value="${toLocalInput(start)}"></div>
          ${editing ? '' : `<div class="field"><label for="f-weeks">Repetir por quantas semanas</label>
            <select id="f-weeks">${[1, 2, 3, 4, 6, 8, 12].map((n) => `<option value="${n}">${n === 1 ? 'Só esta vez' : `${n} semanas`}</option>`).join('')}</select></div>`}
        </div>
        ${editing ? '' : `<div class="field"><label for="f-format">Formato dos times <span class="muted small">(pode escolher depois)</span></label>
          <select id="f-format"><option value="">Sem times</option><option value="guerra">Guerra (12 times)</option><option value="rito">Outros (até 10 times)</option></select></div>`}
        <div class="field">
          <label for="f-close">Prazo para responder</label>
          <select id="f-close">
            ${RSVP_CLOSE_OPTIONS.map(([v, l]) => `<option value="${v ?? ''}" ${(editing ? (ev.rsvp_close_minutes ?? null) : DEFAULT_RSVP_CLOSE) === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <div class="muted small field-hint">Depois do prazo, os membros não conseguem mais mudar a resposta (quem estiver escalado pode pedir para sair).</div>
        </div>
        <div class="field">
          <label for="f-desc">Detalhes <span class="muted small">(opcional)</span></label>
          <textarea id="f-desc" maxlength="1000" placeholder="Horário de chegada, requisitos, estratégia…">${esc(ev?.description || '')}</textarea>
        </div>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${editing ? 'Salvar' : 'Criar'}</button>
        </div>
      </form>`, (d) => {
      const titleInput = $('#f-title', d);
      const fmt = $('#f-format', d);
      const typeSel = $('#f-type', d);
      // Sugere o formato dos times pelo tipo/nome do evento
      const suggestFormat = () => {
        if (!fmt || fmt.dataset.touched) return;
        const t = norm(`${typeSel.selectedOptions[0]?.value ? typeSel.selectedOptions[0].textContent : ''} ${titleInput.value}`);
        fmt.value = t.includes('guerra') ? 'guerra' : t.includes('rito') ? 'rito' : '';
      };
      // Sugere o tipo pelo nome digitado, até o oficial escolher um manualmente
      titleInput.addEventListener('input', () => {
        if (!typeSel.dataset.touched && !editing) {
          const g = guessTypeId(titleInput.value, state.types);
          typeSel.value = g ? String(g) : '';
        }
        suggestFormat();
      });
      typeSel.addEventListener('change', () => { typeSel.dataset.touched = '1'; suggestFormat(); });
      fmt?.addEventListener('change', () => { fmt.dataset.touched = '1'; });
      // Tipos com dia e horário fixos: ajusta a data para o próximo dia permitido e avisa se estiver fora
      const startInput = $('#f-start', d);
      const schedHint = $('#f-sched', d);
      let lastType = typeSel.value;
      const checkSchedule = (adjust) => {
        const sc = scheduleFor(Number(typeSel.value));
        if (!sc) { schedHint.hidden = true; startInput.setCustomValidity(''); return; }
        let when = new Date(startInput.value);
        if (adjust && (Number.isNaN(when.getTime()) || !fitsSchedule(sc, when))) {
          when = nextScheduleSlot(sc, Number.isNaN(when.getTime()) ? new Date() : when);
          startInput.value = toLocalInput(when.toISOString());
        }
        const ok = !Number.isNaN(when.getTime()) && fitsSchedule(sc, when);
        schedHint.hidden = false;
        schedHint.className = `small field-hint ev-sched ${ok ? 'ok' : 'bad'}`;
        schedHint.textContent = `⏰ ${typeNameOf(Number(typeSel.value))}: só ${sc.label} (horário de Brasília).${ok ? '' : ' Escolha um desses dias e horários.'}`;
        startInput.setCustomValidity(ok ? '' : `${typeNameOf(Number(typeSel.value))} só ${sc.label}`);
      };
      // Ao trocar o tipo (escolhido ou sugerido pelo nome), já coloca no próximo dia e horário permitidos
      const onType = () => { if (typeSel.value !== lastType) { lastType = typeSel.value; checkSchedule(true); } };
      typeSel.addEventListener('change', onType);
      titleInput.addEventListener('input', onType);
      startInput.addEventListener('input', () => checkSchedule(false));
      if (!editing && typeSel.value) checkSchedule(true); else checkSchedule(false);

      $('#ev-form', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        const title = titleInput.value.trim();
        const description = $('#f-desc', d).value.trim() || null;
        const startDate = new Date($('#f-start', d).value);
        const type_id = Number(typeSel.value) || null;
        const closeVal = $('#f-close', d).value;
        const rsvp_close_minutes = closeVal === '' ? null : Number(closeVal);
        if (!title || !type_id || Number.isNaN(startDate.getTime())) return;
        // Dia e horário fixos (ao editar, só confere se a data ou o tipo mudaram)
        const sc = scheduleFor(type_id);
        const changedWhen = !editing || type_id !== ev.type_id || startDate.getTime() !== Date.parse(ev.starts_at);
        if (sc && changedWhen && !fitsSchedule(sc, startDate)) { toast(`${typeNameOf(type_id)} só ${sc.label} (horário de Brasília).`, true); return; }
        submit.disabled = true;
        try {
          if (editing) {
            await api.updateEvent(ev.id, { title, description, type_id, rsvp_close_minutes, starts_at: startDate.toISOString() });
            toast('Evento atualizado');
          } else {
            const weeks = Number($('#f-weeks', d).value);
            const team_format = fmt.value || null;
            const rows = Array.from({ length: weeks }, (_, i) => {
              const s = new Date(startDate); s.setDate(s.getDate() + 7 * i);
              return { title, description, type_id, rsvp_close_minutes, starts_at: s.toISOString(), team_format, team_count: RITE_MAX };
            });
            await api.createEvents(rows);
            toast(weeks > 1 ? `${weeks} eventos criados` : 'Evento criado');
          }
          dlg.close();
          route();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  // Recorta a imagem em quadrado (centro) e reduz para 256×256 antes de enviar
  async function squareAvatar(file, size = 256) {
    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const i = new Image();
      i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
      i.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('imagem inválida');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
    let blob = await toBlob('image/webp', 0.88);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.9);
    if (!blob) throw new Error('falha ao converter');
    return blob;
  }

  // Foto de perfil: salva na hora e atualiza o topo e a lista de membros
  async function saveAvatar(blob, hidden, msg) {
    const url = await api.setAvatar(blob, hidden);
    const patch = { custom_avatar_url: url, avatar_hidden: !blob && hidden };
    Object.assign(state.me, patch);
    const m = memberById(state.me.id);
    if (m) Object.assign(m, patch);
    toast(msg);
    renderHeader(currentRouteKey());
  }
  // Abre o seletor de arquivos do aparelho (celular: galeria ou câmera)
  function pickImageFile(onFile) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => { const f = input.files?.[0]; if (f) onFile(f); }, { once: true });
    input.click();
  }
  // Recorta e envia a foto escolhida. Devolve true se a foto foi trocada.
  async function uploadAvatarFile(file) {
    // Alguns celulares não informam o tipo do arquivo: nesse caso, tenta ler mesmo assim
    if (file.type && !file.type.startsWith('image/')) { toast('Escolha um arquivo de imagem (JPG, PNG ou WebP)', true); return false; }
    if (file.size > 15 * 1024 * 1024) { toast('Imagem muito grande (máximo 15 MB)', true); return false; }
    let blob;
    try { blob = await squareAvatar(file); } catch {
      toast('Não foi possível ler esta imagem. Use uma foto JPG ou PNG (no iPhone, se for HEIC, tire um print da foto e envie o print).', true);
      return false;
    }
    await saveAvatar(blob, false, 'Foto de perfil atualizada');
    return true;
  }
  const photoBlockHtml = (me) => `
    <span id="pf-avatar">${avatar(me, 'xl')}</span>
    <div class="stack" style="gap:6px">
      <div><strong>${esc(me.google_name)}</strong><div class="muted small">${ROLE_LABEL[me.role]}${me.pilot_only ? ' · 🧑‍✈️ Membro piloto' : ''}</div></div>
      <div class="row pf-photo-btns" style="gap:6px">
        <button type="button" class="btn small" id="pf-pick">📷 ${me.custom_avatar_url ? 'Trocar foto' : 'Enviar foto'}</button>
        ${!me.avatar_hidden && (me.custom_avatar_url || me.avatar_url) ? '<button type="button" class="btn small ghost danger" id="pf-remove">Remover foto</button>' : ''}
        ${(me.custom_avatar_url || me.avatar_hidden) && me.avatar_url ? '<button type="button" class="btn small ghost" id="pf-google">Usar foto da conta Google</button>' : ''}
      </div>
      <div class="muted small">Use uma foto do seu computador ou celular. Ela é recortada em quadrado e salva na hora; o resto do formulário continua como está.</div>
    </div>`;

  async function openProfile() {
    const me = state.me;
    let phone = '';
    try { phone = await api.myPhone(); } catch (e) { console.error(e); }
    openDialog(`
      <form id="pf" class="stack">
        <h2>Meu perfil</h2>
        <div class="row pf-photo">${photoBlockHtml(me)}</div>
        <fieldset class="kind-pick" aria-label="Tipo de conta">
          <label class="kind-opt"><input type="radio" name="f-kind" value="player" ${me.pilot_only ? '' : 'checked'}>
            <span><b>🎮 Jogador</b><small>Tenho minha própria conta no jogo</small></span></label>
          <label class="kind-opt"><input type="radio" name="f-kind" value="pilot" ${me.pilot_only ? 'checked' : ''}>
            <span><b>🧑‍✈️ Membro piloto</b><small>Não tenho conta própria: piloto contas de outros membros</small></span></label>
        </fieldset>
        <div class="grid2">
          <div class="field">
            <label for="f-game" id="f-game-label">Nome do personagem</label>
            <input id="f-game" maxlength="40" value="${esc(me.game_name || '')}" placeholder="Seu nome no jogo">
          </div>
          <div class="field">
            <label for="f-phone">Telefone <span class="muted small">(opcional)</span></label>
            <input id="f-phone" type="tel" inputmode="tel" maxlength="30" autocomplete="tel" value="${esc(phone || '')}" placeholder="(11) 91234-5678">
          </div>
        </div>
        <div id="pf-player" class="stack">
          ${buildFields(me, false)}
          <label class="check-line"><input type="checkbox" id="f-is-pilot" ${me.is_pilot ? 'checked' : ''}>
            <span>Também sou piloto <span class="muted small">(piloto contas de outros membros e posso me cadastrar na Pilotagem, em Utils)</span></span></label>
        </div>
        <div class="field" id="pf-note-box">
          <label for="f-pnote" id="f-pnote-label">Qual conta você pilota</label>
          <input id="f-pnote" maxlength="200" value="${esc(me.pilot_note || '')}" placeholder="Nick da conta (ou contas) que você pilota">
          <span class="muted small" id="f-pnote-help"></span>
        </div>
        <p class="muted small" style="margin:0">Seu telefone só é visível para os oficiais e o líder.</p>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Salvar</button>
        </div>
      </form>`, (d) => {
      // Foto: salva na hora e só o bloco da foto é redesenhado. O que já foi digitado
      // no formulário (nome, telefone, classe e atributos) não é apagado.
      const photo = $('.pf-photo', d);
      const busy = (on) => photo.querySelectorAll('.btn').forEach((b) => { b.disabled = on; b.classList.toggle('disabled', on); });
      const redraw = () => { photo.innerHTML = photoBlockHtml(state.me); bindPhoto(); };
      const run = async (fn) => {
        busy(true);
        try { await fn(); redraw(); } catch (err) { fail(err); busy(false); }
      };
      function bindPhoto() {
        $('#pf-pick', photo).addEventListener('click', () => pickImageFile((file) => run(() => uploadAvatarFile(file))));
        $('#pf-google', photo)?.addEventListener('click', () => run(() => saveAvatar(null, false, 'Voltou a foto da conta Google')));
        // Confirmação dentro do próprio bloco (sem trocar a janela do formulário)
        $('#pf-remove', photo)?.addEventListener('click', () => {
          const btns = $('.pf-photo-btns', photo);
          btns.innerHTML = `<span class="small">Remover sua foto? No lugar dela aparece a inicial do seu nome.</span>
            <button type="button" class="btn small ghost" id="pf-rm-no">Cancelar</button>
            <button type="button" class="btn small danger" id="pf-rm-yes">Remover foto</button>`;
          $('#pf-rm-no', photo).addEventListener('click', redraw);
          $('#pf-rm-yes', photo).addEventListener('click', () => run(() => saveAvatar(null, true, 'Foto removida')));
        });
      }
      bindPhoto();
      // Jogador × Membro piloto: o membro piloto não informa classe e atributos, só o nome e a conta que pilota
      const pilotMode = () => $('input[name=f-kind]:checked', d)?.value === 'pilot';
      const syncKind = () => {
        const pilot = pilotMode();
        const helper = $('#f-is-pilot', d).checked;
        $('#pf-player', d).hidden = pilot;
        $('#f-game-label', d).textContent = pilot ? 'Seu nome' : 'Nome do personagem';
        $('#f-game', d).placeholder = pilot ? 'Como você quer ser chamado no clã' : 'Seu nome no jogo';
        $('#pf-note-box', d).hidden = !pilot && !helper;
        $('#f-pnote', d).required = pilot;
        $('#f-pnote-label', d).innerHTML = pilot ? 'Qual conta você pilota' : 'Contas que você pilota <span class="muted small">(opcional)</span>';
        $('#f-pnote-help', d).textContent = pilot
          ? `Membros piloto não entram no rank de força nem na frequência: contam só as contas que pilotam.${me.pilot_only ? '' : ' Suas respostas nos próximos eventos (da sua própria conta) serão retiradas.'} Depois da aprovação, peça acesso à conta em Meu perfil → Pilotos.`
          : '';
      };
      d.querySelectorAll('input[name=f-kind]').forEach((r) => r.addEventListener('change', syncKind));
      $('#f-is-pilot', d).addEventListener('change', syncKind);
      syncKind();
      $('#pf', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          const pilot = pilotMode();
          const helper = pilot || $('#f-is-pilot', d).checked;
          const note = helper ? $('#f-pnote', d).value.trim() : '';
          if (pilot && !$('#f-game', d).value.trim()) throw new Error('Informe seu nome');
          if (pilot && !note) throw new Error('Informe qual conta você pilota');
          await api.saveProfile({ game_name: $('#f-game', d).value.trim() || null, ...(pilot ? {} : readBuild(d)) }, $('#f-phone', d).value.trim());
          if (pilot !== !!me.pilot_only || helper !== !!me.is_pilot || (note || null) !== (me.pilot_note || null)) {
            await api.setAccountKind(pilot, helper, note);
          }
          dlg.close();
          toast('Perfil salvo');
          await boot();
        } catch (err) { fail(err); submit.disabled = false; }
      });
    });
  }

  // =====================================================================
  //  Navegação
  // =====================================================================

  // =====================================================================
  //  Sininho: só as pendências de cada pessoa (somem quando resolvidas)
  // =====================================================================
  state.bellUp = []; state.bellPast = [];
  const BELL_ATT_DAYS = 14; // presença sem registro: só eventos dos últimos 14 dias
  // Pedidos para sair do clã (se o SQL novo ainda não foi rodado, fica vazio)
  async function loadLeaves() {
    try { state.leaves = await api.leaves(); } catch { state.leaves = []; }
  }
  const pendingLeaves = () => (state.leaves || []).filter((l) => l.status === 'pending');
  // Pedi para sair do clã (minha própria conta): o site fica bloqueado até a decisão
  const myLeave = () => (state.user ? pendingLeaves().find((l) => l.user_id === state.user.id) : null);
  const memberUI = () => isMember() && !myLeave();
  // Posso decidir este pedido? (líder sempre; oficial só de membro comum e com a permissão)
  const canDecideLeave = (l) => !canActAs(l.user_id) && (isLeader() || (can('leave_approve') && memberById(l.user_id)?.role === 'member'));

  // ---------- Medalhas ----------
  // 🔥 sequência atual de presenças · 📅 meses perfeitos · 📈 Ressonância ganha (registrada no site)
  // O membro comum recebe do banco só o nível de cada medalha (sem os números exatos) e o Top 10 do Rank de força.
  async function loadBadges() {
    try { state.badges = Object.fromEntries((await api.badges()).map((b) => [b.user_id, b])); } catch { state.badges = {}; }
    if (!isOfficer()) {
      try { state.rankTop = Object.fromEntries(((await api.powerOverview(state.user.id))?.top || []).map((r, i) => [r.id, i + 1])); } catch { state.rankTop = {}; }
    }
  }
  const STREAK_LV = [50, 20, 10, 5];
  // Nível alcançado (ex.: sequência 13 → 10); é o que o membro comum recebe do banco
  const badgeLevel = (v, levels) => levels.find((n) => v >= n) || 0;
  // Evolução: quanto mais Ressonância ganha, mais setas
  const GAIN_LV = [[2000, '+2.000', 4], [1000, '+1.000', 3], [500, '+500', 2]];
  // Posição no Rank de força (recalcula só quando a lista de membros muda)
  // (só o Top 10 vira medalha; oficiais e líder calculam com a lista completa, o membro comum usa o Top 10 do banco)
  let rankCache = { list: null, pos: {} };
  function rankPos(id) {
    if (!isOfficer()) return state.rankTop?.[id] || 0;
    if (rankCache.list !== state.members) {
      rankCache = { list: state.members, pos: Object.fromEntries(computePower(activePlayers().filter(hasBuild), { id: null }).top.map((r, i) => [r.m.id, i + 1])) };
    }
    return rankCache.pos[id] || 0;
  }
  const RANK_MEDAL = { 1: ['gold', 'ouro'], 2: ['silver', 'prata'], 3: ['bronze', 'bronze'] };
  // Medalhas ao lado do nome, na ordem: rank → sequência → mês perfeito → evolução (no máximo "max")
  function medalsHtml(id, max = 3) {
    const out = [];
    const pos = rankPos(id);
    if (RANK_MEDAL[pos]) out.push(`<span class="medal m-rank m-${RANK_MEDAL[pos][0]}" title="Coroa de ${RANK_MEDAL[pos][1]}: ${pos}º lugar no Rank de força do clã"><i>👑</i>${pos}º</span>`);
    else if (pos && pos <= 10) out.push(`<span class="medal m-top10" title="Top 10 do Rank de força do clã (${pos}º lugar)">⭐Top 10</span>`);
    const b = state.badges?.[id];
    if (!b) return out.length ? ` <span class="medals">${out.slice(0, max).join('')}</span>` : '';
    const s = STREAK_LV.find((n) => b.streak >= n);
    if (s) out.push(`<span class="medal m-streak" title="Sequência: ${s}+ presenças seguidas${isOfficer() ? ` (atual: ${b.streak})` : ''}">🔥${s}</span>`);
    if (b.perfect_months > 0) out.push(`<span class="medal m-month" title="Mês perfeito: 100% de presença em ${b.perfect_months} ${b.perfect_months === 1 ? 'mês' : 'meses'} (mínimo 4 eventos no mês)">📅${b.perfect_months > 1 ? `×${b.perfect_months}` : ''}</span>`);
    const g = GAIN_LV.find(([n]) => b.res_gain >= n);
    if (g) out.push(`<span class="medal m-gain" title="Evolução: ${g[1]} de Ressonância registrada no site${isOfficer() ? ` (total: +${fmtNum(b.res_gain)})` : ''}"><img src="img/evolucao-${g[2]}.png" alt="Evolução ${g[1]}"></span>`);
    return out.length ? ` <span class="medals">${out.slice(0, max).join('')}</span>` : '';
  }

  async function loadBell() {
    if (!state.user || !isMember()) { state.bellUp = []; state.bellPast = []; return; }
    const [up, past] = await Promise.all([
      api.events(false).catch(() => []),
      can('attendance') ? api.events(true).catch(() => []) : [],
    ]);
    state.bellUp = up || []; state.bellPast = past || [];
    await loadPilotage();
  }
  let bellTimer = null;
  function refreshBellSoon() {
    clearTimeout(bellTimer);
    bellTimer = setTimeout(async () => {
      if (!state.user || !isMember()) return;
      try {
        await Promise.all([
          loadBell(), loadRecruits(), loadTickets(), loadRaffles(), isOfficer() ? loadPerms() : null,
          api.pilots().then((p) => { state.pilots = p; }).catch(() => {}),
          isOfficer() ? api.members().then((m) => { state.members = m; }).catch(() => {}) : null,
        ]);
      } catch (e) { console.warn('sininho', e); }
      renderBell();
    }, 400);
  }
  // Solicitações do oficial já decididas pelo líder e ainda não vistas
  const reqSeenKey = () => `req-seen-${state.user?.id}`;
  const reqSeen = () => { try { return localStorage.getItem(reqSeenKey()) || ''; } catch { return ''; } };
  const markReqSeen = () => { try { localStorage.setItem(reqSeenKey(), new Date().toISOString()); } catch { /* ignora */ } };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function bellItems() {
    const me = state.user.id;
    const mine = []; const lead = [];
    // --- Para mim ---
    const accs = myAccounts();
    state.bellUp.filter((ev) => rsvpOpen(ev)).forEach((ev) => {
      const missing = accs.filter((a) => !ev.rsvps.some((r) => r.user_id === a.id));
      if (!missing.length) return;
      const who = accs.length > 1 ? ` · ${missing.map((a) => (a.id === me ? 'você' : esc(displayName(a)))).join(', ')}` : '';
      const d = rsvpDeadline(ev);
      mine.push({ icon: '📅', text: `Responder: <b>${esc(ev.title)}</b>`, sub: `${esc(fmtWhenShort(ev.starts_at))}${d ? ` · responda até ${esc(fmtDeadline(d))}` : ''}${who}`, href: `#/evento/${ev.id}` });
    });
    (state.tickets || []).filter(ticketHasNews).forEach((t) => {
      const n = ticketNews(t);
      mine.push({ icon: n.resolved && !n.reply ? '✔' : '💬', text: `${ticketNewsText(n).replace(/^\S+ /, '')} seu ticket <b>${esc(t.title)}</b>`, sub: n.reply ? 'Toque para ver a resposta' : 'Toque para ver o ticket', href: `#/ticket/${t.id}` });
    });
    (state.recruits || []).filter((r) => isMyRecruit(r) && r.status === 'open' && recruitApps(r, 'applied').length).forEach((r) => {
      mine.push({ icon: '📣', text: `${plural(recruitApps(r, 'applied').length, 'candidato aguardando', 'candidatos aguardando')} você`, sub: `Recrutamento “${esc(r.title)}”`, href: `#/recrutamento/${r.id}` });
    });
    (state.pilots || []).filter((p) => p.account_id === me && p.status === 'pending').forEach((p) => {
      mine.push({ icon: '🧑‍✈️', text: `<b>${esc(nameOf(p.pilot_id))}</b> pediu para pilotar sua conta`, href: '#/perfil' });
    });
    pilotageInbox().forEach((r) => {
      mine.push({ icon: '🧑‍✈️', text: `<b>${esc(r.account_name)}</b> pediu seus serviços de pilotagem`, sub: r.message ? `“${esc(r.message)}”` : 'Aceite ou recuse na Pilotagem', href: '#/pilotagem' });
    });
    if (hasUnreadNews()) mine.push({ icon: '📰', text: 'Edição nova do <b>Malah News</b>', href: '#/news' });

    // --- Liderança (conforme as Configurações do líder) ---
    if (isOfficer()) {
      if (can('member_approve')) {
        const n = state.members.filter((m) => m.role === 'pending').length;
        if (n) lead.push({ icon: '🙋', text: `${plural(n, 'membro aguardando', 'membros aguardando')} aprovação`, href: '#/membros' });
      }
      if (can('pilots')) {
        const n = (state.pilots || []).filter((p) => p.status === 'pending' && p.account_id !== me).length;
        if (n) lead.push({ icon: '🧑‍✈️', text: `${plural(n, 'pedido de piloto', 'pedidos de piloto')}`, href: '#/membros' });
      }
      if (offersToReview().length) {
        const n = offersToReview().length;
        lead.push({ icon: '🧑‍✈️', text: `${plural(n, 'anúncio de pilotagem', 'anúncios de pilotagem')} aguardando aprovação`, href: '#/pilotagem' });
      }
      if (can('withdraw_decide')) {
        state.bellUp.forEach((ev) => {
          const n = ev.rsvps.filter((r) => r.going && r.withdraw_requested_at).length;
          if (n) lead.push({ icon: '🚪', text: `${plural(n, 'pedido de saída', 'pedidos de saída')}: <b>${esc(ev.title)}</b>`, sub: esc(fmtWhenShort(ev.starts_at)), href: `#/evento/${ev.id}` });
        });
      }
      if (can('attendance')) {
        const since = Date.now() - BELL_ATT_DAYS * 86400e3;
        const seen = new Set();
        [...state.bellPast, ...state.bellUp].filter((ev) => hasStarted(ev) && Date.parse(ev.starts_at) >= since && !(ev.attendance || []).length)
          .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))
          .forEach((ev) => {
            if (seen.has(ev.id)) return; seen.add(ev.id);
            lead.push({ icon: '✅', text: `Registrar presença: <b>${esc(ev.title)}</b>`, sub: esc(fmtWhenShort(ev.starts_at)), href: `#/evento/${ev.id}` });
          });
      }
      (state.recruits || []).filter((r) => canApproveRecruit(r) && !isMyRecruit(r)).forEach((r) => {
        lead.push({ icon: '📣', text: `Aprovar recrutamento <b>${esc(r.title)}</b>`, sub: `Criado por ${esc(nameOf(r.created_by))}`, href: `#/recrutamento/${r.id}` });
      });
      pendingLeaves().filter((l) => ACTIVE_ROLES.includes(memberById(l.user_id)?.role) && canDecideLeave(l)).forEach((l) => {
        lead.push({ icon: '🚪', text: `<b>${esc(nameOf(l.user_id))}</b> pediu para sair do clã`, sub: `“${esc(l.reason)}”`, href: '#/membros' });
      });
      if (supportOn()) {
        const all = state.tickets || [];
        const nNew = all.filter(SUP_PICK.triage).length;
        const nMine = all.filter((t) => SUP_PICK.p_return(t) && attendedByMe(t)).length;
        if (nNew) lead.push({ icon: '🎫', text: `${plural(nNew, 'ticket na triagem', 'tickets na triagem')}`, href: '#/atendimento', sup: 'triage' });
        if (nMine) lead.push({ icon: '🎫', text: `${plural(nMine, 'ticket pendente', 'tickets pendentes')} de retorno com você`, sub: 'O solicitante respondeu', href: '#/atendimento', sup: 'p_return:me' });
      }
      if (isLeader()) {
        const n = pendingRequests().length;
        if (n) lead.push({ icon: '⚙️', text: `${plural(n, 'solicitação', 'solicitações')} dos oficiais`, href: '#/config' });
      } else {
        const last = reqSeen();
        perms.requests.filter((r) => r.requested_by === me && r.status !== 'pending' && r.decided_at && r.decided_at > last).forEach((r) => {
          lead.push({ icon: r.status === 'approved' ? '👍' : '👎', text: `Sua solicitação foi <b>${{ approved: 'aprovada', rejected: 'recusada', failed: 'não aplicada' }[r.status] || esc(r.status)}</b>`, sub: esc(r.summary || ''), href: '#/solicitacoes' });
        });
      }
    }
    raffleBell(mine, lead);
    return { mine, lead };
  }

  let bellOpen = false;
  function renderBell() {
    updateHelpFab();
    const wrap = $('#bell-wrap');
    if (!wrap) return;
    const { mine, lead } = bellItems();
    const total = mine.length + lead.length;
    const row = (i) => `<a class="bell-item" href="${i.href}"${i.sup ? ` data-sup="${i.sup}"` : ''}>
        <span class="bell-ic" aria-hidden="true">${i.icon}</span>
        <span class="bell-tx"><span>${i.text}</span>${i.sub ? `<span class="muted small">${i.sub}</span>` : ''}</span></a>`;
    const group = (title, list) => (list.length ? `<div class="bell-group"><div class="bell-gt">${title}</div>${list.map(row).join('')}</div>` : '');
    wrap.innerHTML = `<button class="bell${total ? ' has' : ''}" id="btn-bell" type="button" aria-haspopup="true" aria-expanded="${bellOpen}"
        title="${total ? plural(total, 'pendência', 'pendências') : 'Nenhuma pendência'}" aria-label="Pendências${total ? ` (${total})` : ''}">
        <span aria-hidden="true">🔔</span>${total ? `<span class="bell-count">${total > 99 ? '99+' : total}</span>` : ''}</button>
      <div class="bell-pop" ${bellOpen ? '' : 'hidden'}>
        <div class="bell-head">Pendências ${total ? `<span class="bell-total">${total}</span>` : ''}</div>
        ${total ? group('Para você', mine) + group('Liderança', lead) : '<p class="bell-empty muted">✨ Tudo em dia! Nenhuma pendência.</p>'}
      </div>`;
    $('#btn-bell').addEventListener('click', (e) => { e.stopPropagation(); bellOpen = !bellOpen; renderBell(); });
    wrap.querySelectorAll('.bell-item').forEach((a) => a.addEventListener('click', () => {
      if (a.dataset.sup) { const [v, who] = a.dataset.sup.split(':'); SUP.view = v; if (who) SUP.me = who === 'me'; }
      bellOpen = false;
      if (a.getAttribute('href') === location.hash) route(); else renderBell();
    }));
  }
  document.addEventListener('click', (e) => { if (bellOpen && !e.target.closest('#bell-wrap')) { bellOpen = false; renderBell(); } });
  document.addEventListener('keydown', (e) => { if (bellOpen && e.key === 'Escape') { bellOpen = false; renderBell(); $('#btn-bell')?.focus(); } });

  function parseRoute() {
    const h = location.hash.replace(/^#/, '') || '/';
    const ev = h.match(/^\/evento\/(\d+)$/);
    const tm = h.match(/^\/evento\/(\d+)\/times$/);
    const mp = h.match(/^\/membro\/([\w%-]+)$/); // perfil de um membro (oficiais e líder)
    const rc = RECRUIT_ON ? h.match(/^\/recrutamento\/(\d+)$/) : null;
    const tk = TICKETS_ON ? h.match(/^\/ticket\/(\d+)$/) : null;
    const pg = h.match(/^\/pilotagem\/([\w%-]+)$/); // link de um anúncio de pilotagem
    const key = h === '/passados' ? 'past' : h === '/frequencia' ? 'freq' : h === '/news' ? 'news' : h === '/utils' ? 'utils' : h === '/estatisticas' ? 'panel' : h === '/rivais' ? 'rivals' : h === '/pilotagem' || pg ? 'pilotage'
      : h === '/config' ? 'config' : h === '/solicitacoes' ? 'requests'
      : RECRUIT_ON && h === '/recrutamentos' ? 'recruits' : rc ? 'recruits'
      : RAFFLE_ON && h === '/sorteio' ? 'raffle'
      : TICKETS_ON && h === '/tickets' ? 'tickets' : TICKETS_ON && h === '/atendimento' ? 'support' : tk ? 'ticket'
      : h === '/perfil' ? 'profile' : h === '/membros' ? (isOfficer() ? 'members' : 'profile') : mp ? 'members'
      : tm ? 'teams' : ev ? 'event' : 'upcoming';
    return { ev, tm, mp, rc, tk, pg, key };
  }
  const currentRouteKey = () => parseRoute().key;

  async function route() {
    const { ev, tm, mp, rc, tk, pg, key } = parseRoute();
    if (state.user && isOfficer()) await loadPerms();
    if (state.user && isMember()) await Promise.all([loadRecruits(), loadTickets(), loadRaffles(), loadBell(), loadLeaves(), loadBadges()]);
    bellOpen = false;
    renderHeader(key);
    if (!state.user) return viewLogin();
    if (!isMember()) return state.me?.role === 'former' ? viewFormer() : viewPending();
    if (myLeave()) return viewLeaving();
    notifyTicketReplies();
    try {
      if (key === 'past') await viewEvents(true);
      else if (key === 'news') await viewNews();
      else if (key === 'utils') viewUtils();
      else if (key === 'pilotage') await viewPilotage(pg ? decodeURIComponent(pg[1]) : null);
      else if (key === 'raffle') await viewRaffle();
      else if (key === 'config') await viewConfig();
      else if (key === 'requests') await viewRequests();
      else if (rc) await viewRecruit(Number(rc[1]));
      else if (tk) await viewTicket(Number(tk[1]));
      else if (key === 'tickets') await viewTickets();
      else if (key === 'support') await viewSupport();
      else if (key === 'recruits') await viewRecruits();
      else if (mp) await viewMyPanel(decodeURIComponent(mp[1]));
      else if (key === 'profile') await viewMyPanel();
      else if (key === 'members') await viewMembers();
      else if (key === 'freq') await viewFrequency();
      else if (key === 'panel') await viewPanel();
      else if (key === 'rivals') await viewRivals();
      else if (key === 'teams') await viewTeams(Number(tm[1]));
      else if (key === 'event') await viewEvent(Number(ev[1]));
      else await viewEvents(false);
    } catch (e) {
      fail(e);
      main.innerHTML = '<div class="card empty">Não foi possível carregar. Tente recarregar a página.</div>';
    }
  }

  let askedBuild = false;
  async function boot() {
    loading();
    try {
      state.user = await api.currentUser();
      // Mantém nome e foto da conta Google atualizados (as mudanças vão para o histórico)
      if (state.user) { try { await api.syncProfile(); } catch (e) { console.warn('sync_google_profile', e); } }
      state.me = state.user ? await api.myProfile() : null;
      if (state.user && !state.me) {
        throw new Error('Perfil não encontrado. Verifique se o schema.sql foi executado no Supabase.');
      }
      state.members = isMember() ? await api.members() : [];
      state.types = isMember() ? await api.eventTypes() : [];
      // Data da edição mais recente do Malah News (para o aviso de "novo" no menu)
      state.latestNews = isMember() ? await api.latestNewsAt().catch(() => null) : null;
      // Contas pilotadas e a conta escolhida para responder (lembrada neste navegador)
      state.pilots = isMember() ? await api.pilots().catch(() => []) : [];
      try { state.acting = localStorage.getItem(`acting-${state.user?.id}`) || null; } catch { state.acting = null; }
    } catch (e) {
      fail(e);
    }
    try {
      const back = sessionStorage.getItem('after-login');
      if (state.user && back !== null) { sessionStorage.removeItem('after-login'); if (back && back !== location.hash) { location.hash = back; return; } }
    } catch { /* ignora */ }
    await route();
    // Primeiro acesso: lembra de informar classe e atributos
    if (state.me && isMember() && !isPilotOnly(state.me) && !hasBuild(state.me) && !askedBuild) {
      askedBuild = true;
      toast('Complete seu perfil: clique no seu nome no topo e informe classe e atributos.');
    }
  }

  // Avisa antes de sair do painel de times com alterações não salvas
  let lastHash = location.hash;
  const onTeamsPage = (h) => /^#\/evento\/\d+\/times$/.test(h);
  window.addEventListener('hashchange', async () => {
    if (onTeamsPage(lastHash) && location.hash !== lastHash && teamsDirty()) {
      const target = location.hash;
      history.replaceState(null, '', lastHash); // volta o endereço sem recarregar
      if (!(await confirmDialog('Há alterações nos times que não foram salvas. Sair e descartar?', 'Descartar e sair'))) return;
      T.slots = new Map(T.orig);
      location.hash = target;
      return;
    }
    lastHash = location.hash;
    route();
  });
  window.addEventListener('beforeunload', (e) => {
    if (onTeamsPage(location.hash) && teamsDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
  // Só recarrega quando a pessoa logada muda de fato (o Supabase também avisa ao renovar a sessão).
  api.onAuthChange((u) => { if ((u?.id ?? null) !== (state.user?.id ?? null)) boot(); });
  boot();
})();

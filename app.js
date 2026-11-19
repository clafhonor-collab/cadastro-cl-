(() => {
  'use strict';

  const CFG = window.CLAN_CONFIG || {};
  // "?demo" no endereço força o modo demonstração (dados fictícios), útil para testar sem mexer no banco real
  const DEMO = new URLSearchParams(location.search).has('demo') || !CFG.supabaseUrl || !CFG.supabaseAnonKey;

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

  // Sugestões no campo "título" — o oficial pode digitar qualquer outro nome.
  const EVENT_SUGGESTIONS = [
    'Guerra das Sombras', 'Rito do Exílio', 'Portões Demoníacos', 'Assalto ao Cofre',
    'Arena Ancestral', 'Pesadelo Ancestral', 'Carruagem Assombrada', 'Torre Amaldiçoada',
    'Raid do clã', 'Reunião do clã',
  ];
  // Eventos que começaram há menos disso ainda aparecem em "Próximos".
  const STILL_UPCOMING_MS = 3 * 3600 * 1000;
  // Prazo para responder (minutos antes do início). null = sem prazo.
  const RSVP_CLOSE_OPTIONS = [[null, 'Sem prazo'], [30, '30 min antes'], [60, '1h antes'], [120, '2h antes'], [180, '3h antes'],
    [360, '6h antes'], [720, '12h antes'], [1440, '1 dia antes']];
  const DEFAULT_RSVP_CLOSE = 120;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    return {
      async currentUser() { const { data } = await sb.auth.getSession(); return data.session?.user ?? null; },
      onAuthChange(cb) { sb.auth.onAuthStateChange((evt, s) => { if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') cb(s?.user ?? null); }); },
      signIn() { return sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }); },
      signOut() { return sb.auth.signOut(); },
      async myProfile() { return ok(await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle()); },
      async members() { return ok(await sb.from('profiles').select('*')); },
      async myPhone() { return ok(await sb.from('member_contacts').select('phone').eq('user_id', state.user.id).maybeSingle())?.phone ?? ''; },
      async contacts() { return ok(await sb.from('member_contacts').select('user_id, phone')); },
      async syncProfile() { ok(await sb.rpc('sync_google_profile')); },
      async eventTypes() { return ok(await sb.from('event_types').select('*').eq('active', true).order('sort_order').order('name')); },
      async profileHistory() { return ok(await sb.from('profile_history').select('*').order('changed_at', { ascending: false }).limit(5000)); },
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
      async setRole(userId, role) { ok(await sb.rpc('set_member_role', { target: userId, new_role: role })); },
      async removeMember(userId, reason, withManaged) { ok(await sb.rpc('remove_member', { target: userId, reason: reason || '', with_managed: !!withManaged })); },
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
      nextId: 100,
    };
    const profile = (id) => db.profiles.find((p) => p.id === id);
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
    db.profiles.filter((p) => p.resonance && p.role !== 'pending' && p.id !== 'u2').forEach((p) => {
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
    db.pilots = [
      { account_id: 'm1', pilot_id: 'u0', status: 'approved', reason: null, requested_at: day(-30, 20), decided_at: day(-30, 20), decided_by: 'u0' },
      { account_id: 'u12', pilot_id: 'u0', status: 'approved', reason: 'Jogo na conta dele nas Guerras', requested_at: day(-15, 20), decided_at: day(-15, 21), decided_by: 'u12' },
      { account_id: 'u0', pilot_id: 'u8', status: 'pending', reason: 'Posso jogar na sua conta quando você viajar', requested_at: day(-1, 18), decided_at: null, decided_by: null },
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
    ];
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

    // Posso agir por esta conta? (a minha, ou sou piloto aprovado dela) — igual à regra do banco
    const canActAsDemo = (acct) => acct === state.user?.id
      || (ACTIVE_ROLES.includes(profile(state.user?.id)?.role)
          && db.pilots.some((p) => p.account_id === acct && p.pilot_id === state.user.id && p.status === 'approved'));

    // Simula as regras do banco: membro comum só recebe os times e presenças das contas que controla
    const attach = (e) => {
      const officer = isOfficer();
      const slots = db.slots.filter((s) => s.event_id === e.id);
      const myTeams = new Set(slots.filter((s) => canActAsDemo(s.user_id)).map((s) => s.team));
      const teammate = (u) => slots.some((s) => s.user_id === u && myTeams.has(s.team));
      return {
        ...e,
        rsvps: db.rsvps.filter((r) => r.event_id === e.id && (officer || canActAsDemo(r.user_id) || teammate(r.user_id))).map((r) => ({ ...r })),
        team_slots: slots.filter((s) => officer || myTeams.has(s.team)).map((s) => ({ user_id: s.user_id, team: s.team })),
        attendance: db.attendance.filter((a) => a.event_id === e.id && (officer || canActAsDemo(a.user_id))).map((a) => ({ user_id: a.user_id, present: a.present })),
      };
    };
    const dropSlot = (eventId, userId) => { db.slots = db.slots.filter((s) => !(s.event_id === eventId && s.user_id === userId)); };
    let user = null;
    let listener = () => {};
    return {
      async currentUser() { return user; },
      onAuthChange(cb) { listener = cb; },
      async signIn() { user = { id: 'u0' }; listener(user); },
      async signOut() { user = null; listener(null); },
      async myProfile() { return { ...profile(state.user.id) }; },
      async members() { return db.profiles.map((p) => ({ ...p })); },
      async myPhone() { return db.contacts.find((c) => c.user_id === state.user.id)?.phone ?? ''; },
      async contacts() { return db.contacts.map((c) => ({ ...c })); },
      async syncProfile() { /* no modo demonstração não há conta Google */ },
      async eventTypes() { return db.types.filter((t) => t.active).sort((a, b) => a.sort_order - b.sort_order).map((t) => ({ ...t })); },
      // Só na demonstração: permite ver o site como líder, oficial ou membro comum
      async demoSetRole(role) { profile(state.user.id).role = role; },
      async profileHistory() { return db.history.filter((h) => isOfficer() || canActAsDemo(h.user_id)).map((h) => ({ ...h })); },
      async saveProfile(fields, phone) {
        // Mesmo comportamento do gatilho do banco: registra o que mudou
        const p = profile(state.user.id);
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
      async history(sinceIso) {
        const since = sinceIso ? Date.parse(sinceIso) : -Infinity;
        return db.events.filter((e) => Date.parse(e.starts_at) <= Date.now() && Date.parse(e.starts_at) >= since)
          .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at)).map(attach);
      },
      async createEvents(rows) {
        return rows.map((r) => { const e = { id: db.nextId++, team_format: null, team_count: 10, ...r }; db.events.push(e); return { id: e.id }; });
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
        const id = `m${db.nextId++}`;
        const now = new Date().toISOString();
        db.profiles.push({ id, google_name: '', game_name: gameName, role: 'pending', managed: true, created_at: now, ...b });
        db.mlog.push({ id: db.mlog.length + 1, user_id: id, from_role: null, to_role: 'pending', changed_by: state.user.id, reason: `Conta pilotada cadastrada por ${displayName(profile(state.user.id))}`, changed_at: now });
        db.pilots.push({ account_id: id, pilot_id: state.user.id, status: 'approved', reason: null, requested_at: now, decided_at: now, decided_by: state.user.id });
        return id;
      },
      async requestPilotAccess(accountId, reason) {
        if (accountId === state.user.id) throw new Error('Esta já é a sua conta');
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
        db.pilots = db.pilots.filter((p) => !(p.account_id === accountId && p.pilot_id === pilotId));
        db.pilots.push({ account_id: accountId, pilot_id: pilotId, status: 'approved', reason: null, requested_at: new Date().toISOString(), decided_at: new Date().toISOString(), decided_by: state.user.id });
      },
      async resolveWithdrawal(eventId, userId, accept) {
        if (!isOfficer()) throw new Error('Sem permissão');
        const r = db.rsvps.find((x) => x.event_id === eventId && x.user_id === userId);
        if (!r) return;
        if (accept) { r.going = false; r.discord = null; dropSlot(eventId, userId); }
        r.withdraw_reason = null; r.withdraw_requested_at = null;
      },
      async updateEvent(id, row) { Object.assign(db.events.find((e) => e.id === id), row); },
      async deleteEvent(id) {
        db.events = db.events.filter((e) => e.id !== id);
        db.rsvps = db.rsvps.filter((r) => r.event_id !== id);
        db.slots = db.slots.filter((s) => s.event_id !== id);
        db.attendance = db.attendance.filter((a) => a.event_id !== id);
      },
      async setRsvp(eventId, going, build, accountId) {
        const acct = accountId || state.user.id;
        if (!canActAsDemo(acct)) throw new Error('Você não pode responder por esta conta');
        let r = db.rsvps.find((x) => x.event_id === eventId && x.user_id === acct);
        if (!r) { r = { event_id: eventId, user_id: acct }; db.rsvps.push(r); }
        Object.assign(r, { going, answered_by: state.user.id }, build || {});
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
        db.tmsgs.push({ id: db.nextId++, ticket_id: id, author_id: state.user.id, body, internal: !!internal, images: images || [], created_at: new Date().toISOString() });
        // Membro escrevendo num ticket resolvido reabre; resposta de quem atende põe "Em andamento"
        if (mine && t.status === 'resolved') t.status = 'open';
        if (!mine && !internal && t.status === 'open') t.status = 'progress';
      },
      async setTicketStatus(id, status) {
        const t = ticketRow(id);
        if (!t) throw new Error('Este ticket não existe mais');
        const mine = t.author_id === state.user.id;
        if (!mine && !isStaffOn(t)) throw new Error('Sem permissão');
        if (mine && !['open', 'resolved'].includes(status)) throw new Error('Você só pode resolver ou reabrir o seu ticket');
        t.status = status;
      },
      async assignTicket(id, userId) {
        const t = ticketRow(id);
        if (!t || !isStaffOn(t)) throw new Error('Sem permissão');
        t.assigned_to = userId || null;
        if (userId && t.status === 'open') t.status = 'progress'; // assumiu = Em atendimento
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
      async removeTeams(eventId, teams) { db.slots = db.slots.filter((s) => !(s.event_id === eventId && (!teams || teams.includes(s.team)))); },
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
        db.slots = db.slots.filter((s) => s.event_id !== eventId).concat(slots.map((s) => ({ event_id: eventId, user_id: s.user_id, team: s.team })));
      },
      async saveAttendance(eventId, rows) {
        rows.forEach((r) => {
          db.attendance = db.attendance.filter((a) => !(a.event_id === eventId && a.user_id === r.user_id));
          db.attendance.push({ event_id: eventId, user_id: r.user_id, present: r.present });
        });
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
      { key: 'pilots', label: 'Gerenciar pilotos de contas', desc: 'Aprovar pedidos de piloto e adicionar pilotos' },
      { key: 'notes', label: 'Anotações internas', desc: 'Ver e escrever anotações sobre os membros' },
      { key: 'view_phone', label: 'Ver telefones' },
      { key: 'stats', label: 'Ver Estatísticas do clã', desc: 'Só esconde na tela' },
      { key: 'csv', label: 'Exportar lista em CSV', desc: 'Só esconde na tela' },
      { key: 'freq_view', label: 'Ver o painel de Frequência', desc: 'Só esconde na tela' },
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
    saveTeams: () => ['teams_build'],
    renameTeam: () => ['teams_build'],
    removeTeams: () => ['teams_build'],
    saveAttendance: () => ['attendance'],
    resolveWithdrawal: () => ['withdraw_decide'],
    setRole: (raw, id, role) => (role === 'member' && memberById(id)?.role === 'pending' ? ['member_approve', `Aprovar ${nameOf(id)} como membro do clã`] : null),
    removeMember: (raw, id, reason) => ['member_remove', `${memberById(id)?.role === 'pending' ? 'Recusar a entrada de' : 'Remover do clã'} ${nameOf(id)}${reason ? ` · motivo: “${reason}”` : ''}`],
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
  };
  async function ticketGate(raw, id, key) {
    const t = await raw.ticket(id);
    if (!t) throw new Error('Este ticket não existe mais');
    return t.mine ? null : [key, ''];
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
    createNewsFromPath: ([o]) => [{ image_path: String(o?.image_path || ''), title: String(o?.title || ''), caption: o?.caption ? String(o.caption) : null }],
    updateNews: ([id, f]) => [Number(id), { title: String(f?.title || ''), caption: f?.caption ? String(f.caption) : null }],
    deleteNews: ([p]) => [{ id: Number(p?.id), image_path: String(p?.image_path || ''), title: String(p?.title || '') }],
    decideRecruit: ([id, approve, note]) => [Number(id), !!approve, note ? String(note).slice(0, 300) : null],
    closeRecruit: ([id, reopen]) => [Number(id), !!reopen],
    updateRecruit: ([id, row]) => [Number(id), cleanRecruitRow(row)],
    deleteRecruit: ([id]) => [Number(id)],
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
  const MUTATES = /^(set|clear|request|cancel|decide|create|update|delete|save|post|assign|close|reopen|apply|withdraw|remove|approve|reject|add|record|mark|reveal|lock|unlock|leave|join|publish)/;
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

  // ---------- Contas pilotadas ----------
  // state.pilots = vínculos (conta ↔ piloto) que eu posso ver; state.acting = conta que está respondendo agora
  const memberById = (id) => state.members.find((m) => m.id === id);
  const approvedPilotIds = (accountId) => (state.pilots || []).filter((p) => p.account_id === accountId && p.status === 'approved').map((p) => p.pilot_id);
  const pilotedByMe = () => (state.pilots || []).filter((p) => p.pilot_id === state.user?.id && p.status === 'approved').map((p) => p.account_id);
  const canActAs = (id) => id === state.user?.id || pilotedByMe().includes(id);
  // Contas pelas quais posso responder agora: a minha + as contas pilotadas que estão ativas no clã
  const myAccounts = () => [state.me, ...pilotedByMe().map(memberById).filter((m) => m && ACTIVE_ROLES.includes(m.role))].filter(Boolean);
  const actingId = () => (state.acting && myAccounts().some((a) => a.id === state.acting) ? state.acting : state.user?.id);
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
    fab.hidden = !(TICKETS_ON && isMember()) || currentKey === 'teams';
    fab.href = supportOn() ? '#/atendimento' : '#/tickets';
    fab.title = supportOn() ? 'Central de Atendimento: tickets dos membros' : 'Central de Atendimento: fale com a liderança';
    fab.setAttribute('aria-label', 'Central de Atendimento');
    fab.classList.toggle('active', ['tickets', 'support'].includes(currentKey));
    document.body.classList.toggle('has-fab', !fab.hidden);

    const nav = $('#nav');
    if (isMember()) {
      const links = [['#/', 'Próximos', 'upcoming'], ['#/passados', 'Passados', 'past'], ['#/news', 'Malah News', 'news']];
      if (RECRUIT_ON) links.push(['#/recrutamentos', 'Recrutamentos', 'recruits']);
      if (isOfficer()) links.push(['#/membros', 'Membros', 'members']);
      if (can('freq_view')) links.push(['#/frequencia', 'Frequência', 'freq']);
      links.push(['#/perfil', 'Meu perfil', 'profile'], ['#/utils', 'Utils', 'utils']);
      if (!isLeader() && isOfficer()) links.push(['#/solicitacoes', 'Solicitações', 'requests']);
      // Os contadores ficam no sininho (ao lado da foto), não no menu
      nav.innerHTML = links.map(([href, label, key]) => `<a href="${href}" class="${currentKey === key ? 'active' : ''}">${label}</a>`).join('');
    } else nav.innerHTML = '';

    const box = $('#userbox');
    if (state.me) {
      const accounts = isMember() ? myAccounts() : [];
      box.innerHTML = `${accounts.length > 1 ? `<label class="acting" title="Escolha a conta do jogo pela qual você está respondendo">
          <span>Respondendo como</span>
          <select id="acting-select" class="inline">${accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === actingId() ? 'selected' : ''}>${esc(displayName(a))}${a.id === state.user.id ? ' (você)' : ' 🧑‍✈️'}</option>`).join('')}</select>
        </label>` : ''}
        ${isMember() ? '<div class="bell-wrap" id="bell-wrap"></div>' : ''}
        ${isLeader() ? `<a class="gear${currentKey === 'config' ? ' active' : ''}" href="#/config" title="Configurações" aria-label="Configurações"><span aria-hidden="true">⚙️</span></a>` : ''}
        <button class="who" id="btn-profile" title="Meu perfil">${avatar(state.me)}<span class="label">${esc(displayName(state.me))}</span></button>
        <button class="btn ghost small" id="btn-logout">Sair</button>`;
      $('#acting-select')?.addEventListener('change', (e) => {
        setActing(e.target.value);
        toast(`Agora você está respondendo como ${displayName(actingProfile())}`);
        route();
      });
      $('#btn-profile').addEventListener('click', openProfile);
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
  }

  function viewPending() {
    main.innerHTML = `<div class="hero">
      <span class="sigil">⏳</span>
      <h1>Aguardando aprovação</h1>
      <p>Olá, <strong>${esc(displayName(state.me))}</strong>! Seu acesso precisa ser aprovado por um oficial ou pelo líder do clã. Enquanto isso, preencha seu perfil com sua classe e atributos.</p>
      <div class="row" style="justify-content:center">
        <button class="btn primary" id="btn-pf">Preencher perfil</button>
        <button class="btn" id="btn-recheck">Verificar de novo</button>
      </div>
    </div>`;
    $('#btn-pf').addEventListener('click', openProfile);
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

  // Descrição de uma mudança de cargo no histórico do clã
  function roleChangeLabel(h) {
    const f = h.from_role; const t = h.to_role;
    if (!f) return t === 'pending' ? 'Entrou no site (aguardando aprovação)' : `Registro inicial: ${ROLE_LABEL[t] || t}`;
    if (t === 'former') return f === 'pending' ? 'Pedido de entrada recusado' : 'Removido do clã';
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
    const total = activeMembers().length;
    const responded = new Set(ev.rsvps.map((r) => r.user_id));
    const pending = activeMembers().filter((m) => !responded.has(m.id)).length;
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
        ${ev.description ? `<div class="desc">${esc(ev.description)}</div>` : ''}
        ${isOfficer() ? `<div class="counts"><span class="c-yes">✔ ${c.yes} vão</span><span class="c-no">✖ ${c.no} não vão</span><span class="muted">${c.pending} sem resposta</span></div>
        <div class="bar"><span class="y" style="width:${pct(c.yes)}%"></span><span class="n" style="width:${pct(c.no)}%"></span></div>` : ''}
        <div class="ev-foot"><a class="btn small ghost" href="#/evento/${ev.id}">🔎 Detalhar evento</a></div>
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

  function bindRsvp(root, events, rerender) {
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

  async function viewEvents(past) {
    loading();
    const events = await api.events(past);
    const head = `<div class="page-head"><h1>${past ? 'Eventos passados' : 'Próximos eventos'}</h1>
      ${can('event_create') && !past ? '<button class="btn primary" id="btn-new">+ Novo evento</button>' : ''}</div>`;
    const body = events.length
      ? groupByDay(events)
      : `<div class="card empty">${past ? 'Nenhum evento passado ainda.' : 'Nenhum evento agendado.'}${can('event_create') && !past ? '<br><br>Crie o primeiro em “+ Novo evento”.' : ''}</div>`;
    main.innerHTML = head + body;
    $('#btn-new')?.addEventListener('click', () => openEventForm());
    bindRsvp(main, events, () => viewEvents(past));
  }

  // ---------- Times: blocos compartilhados ----------

  // Lista de quem confirmou presença, já com classe/atributos do evento
  function goingPeople(ev) {
    const byId = Object.fromEntries(state.members.map((m) => [m.id, m]));
    return ev.rsvps.filter((r) => r.going && byId[r.user_id]).map((r) => {
      const p = byId[r.user_id];
      return { id: p.id, name: displayName(p), profile: p, build: buildFor(r, p), discord: !!r.discord, wd: r.withdraw_requested_at ? (r.withdraw_reason || 'Sem motivo') : null };
    });
  }

  // bare = só nome e classe (sem atributos), usado na visão do membro e na opção "Ocultar"
  function chip(p, { draggable = false, removable = false, selected = false, compact = false, bare = false } = {}) {
    const mine = p.id === actingId();
    const who = `${p.name} · ${CLASS[p.build.char_class]?.label || 'sem classe'}`;
    // Oficiais e líder veem os 5 atributos (também nos times); a dica (title) repete os nomes completos
    const full = ATTRS.map((a) => `${a.label}: ${fmtNum(p.build[a.key])}`).join('\n');
    const stats = bare ? '' : statsLine(p.build);
    return `<div class="chip${selected ? ' sel' : ''}${mine ? ' mine' : ''}${compact ? ' compact' : ''}${bare ? ' bare' : ''}" data-uid="${esc(p.id)}" title="${esc(bare ? who : `${who}\n${full}`)}" ${draggable ? 'draggable="true" tabindex="0" role="button"' : ''}>
      ${classTag(p.build.char_class)}
      <div class="chip-body"><div class="chip-name">${esc(p.name)}${p.discord ? ` ${dcIcon}` : ''}${p.wd && isOfficer() ? ` <span class="wd-flag" title="Pediu para sair: ${esc(p.wd)}">⚠</span>` : ''}${isOfficer() && approvedPilotIds(p.id).length ? ` <span class="pilot-flag" title="Pilotada por ${esc(approvedPilotIds(p.id).map((i) => displayName(memberById(i))).join(', '))}">🧑‍✈️</span>` : ''}</div>${bare ? `<div class="chip-class">${esc(CLASS[p.build.char_class]?.label || 'Sem classe')}</div>` : `<div class="chip-stats">${stats}</div>`}</div>
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

  function teamCard(name, people, { editable = false, sel = null, showFoot = true, bare = false, renameIndex = null } = {}) {
    const hide = bare || aggMode() === 'hide';
    const mineHere = people.some((p) => p.id === actingId());
    const empties = editable ? Array.from({ length: TEAM_SIZE - people.length }, () => '<div class="slot-empty">vazio</div>').join('') : '';
    return `<div class="team${mineHere ? ' mine' : ''}${people.length >= TEAM_SIZE ? ' full' : ''}${editable && sel ? ' target' : ''}" data-team="${esc(name)}">
      <div class="team-head"><strong>${esc(name)}${renameIndex !== null ? ` <button type="button" class="team-rename" data-rename="${renameIndex}" title="Renomear este time" aria-label="Renomear ${esc(name)}">✏️</button>` : ''}</strong><span class="muted small">${people.some((p) => p.discord) ? `<span class="dc-count" title="Integrantes no Discord">🎧 ${people.filter((p) => p.discord).length}</span> · ` : ''}${people.length}/${TEAM_SIZE}</span></div>
      <div class="team-slots">${people.map((p) => chip(p, { draggable: editable, removable: editable, selected: sel === p.id, compact: true, bare: hide })).join('')}${empties}</div>
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

  // ---------- Detalhe do evento ----------

  async function viewEvent(id) {
    loading();
    const ev = await api.event(id);
    if (!ev) { main.innerHTML = '<div class="card empty">Evento não encontrado (talvez tenha sido apagado).<br><br><a href="#/">Voltar</a></div>'; return; }
    const byId = Object.fromEntries(state.members.map((m) => [m.id, m]));
    const sortX = (a, b) => byName(a.p, b.p);
    const withP = (r) => ({ p: byId[r.user_id], r });
    const yes = ev.rsvps.filter((r) => r.going).map(withP).filter((x) => x.p).sort(sortX);
    const no = ev.rsvps.filter((r) => !r.going).map(withP).filter((x) => x.p).sort(sortX);
    const responded = new Set(ev.rsvps.map((r) => r.user_id));
    const none = activeMembers().filter((m) => !responded.has(m.id)).map((p) => ({ p })).sort(sortX);
    const onDiscord = yes.filter((x) => x.r.discord);
    const list = (arr, withClass) => (arr.length
      ? `<ul class="people">${arr.map((x) => {
        // Quando um piloto respondeu pela conta, mostra quem foi
        const by = x.r?.answered_by && x.r.answered_by !== x.p.id ? memberById(x.r.answered_by) : null;
        return personLine(x.p, withClass ? buildFor(x.r, x.p) : null, withClass && x.r?.discord, by ? `respondido por ${displayName(by)}` : '');
      }).join('')}</ul>`
      : '<p class="muted small">Ninguém</p>');

    const slots = new Map((ev.team_slots || []).map((s) => [s.user_id, s.team]));
    const people = goingPeople(ev);
    const officer = isOfficer();
    const mine = myTeam(ev);
    // Oficiais veem todos os times; membro comum vê só o próprio (sem totais e sem copiar)
    const showTeams = officer ? ev.team_format && slots.size > 0 : !!mine;

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
    main.innerHTML = `
      <p><a href="${finished ? '#/passados' : '#/'}" class="small">← Voltar${finished ? ' aos eventos passados' : ''}</a></p>
      <div class="card stack">
        <div class="row">
          <div class="spacer">
            <h1>${esc(ev.title)}</h1>
            <div class="muted">${esc(fmtDay(ev.starts_at))} · ${fmtTime(ev.starts_at)}${typeName(ev.type_id) ? ` · <span class="type-tag">${esc(typeName(ev.type_id))}</span>` : ''}</div>
            ${deadlineTag(ev) || ev.teams_locked ? `<div class="row" style="gap:8px;margin-top:6px">${deadlineTag(ev)}${ev.teams_locked && isOpen(ev) ? '<span class="badge lock">🔒 Times travados</span>' : ''}</div>` : ''}
          </div>
          ${isOpen(ev) ? rsvpButtons(ev) : '<span class="muted small">Evento encerrado</span>'}
        </div>
        ${ev.description ? `<div class="desc" style="white-space:pre-line">${esc(ev.description)}</div>` : ''}
        <div class="row">
          <button class="btn small ghost" id="btn-copy">🔗 Copiar link</button>
          ${isOfficer() ? `<button class="btn small ghost" id="btn-copy-list">📋 Copiar lista</button>
            <span class="spacer"></span>
            ${can('teams_build') ? `<a class="btn small primary" id="btn-teams" href="#/evento/${ev.id}/times">⚔ ${finished ? 'Revisar times' : 'Montar times'}</a>` : ''}
            ${can('event_edit') ? '<button class="btn small" id="btn-edit">Editar</button>' : ''}
            ${can('event_create') ? '<button class="btn small" id="btn-dup">Repetir na próxima semana</button>' : ''}
            ${can('event_delete') ? '<button class="btn small danger" id="btn-del">Apagar</button>' : ''}` : ''}
        </div>
      </div>
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
          <div id="ev-teams">${teamsHtml(ev, people, slots)}</div>`
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
      $('#ev-teams').innerHTML = teamsHtml(ev, people, slots);
      main.querySelectorAll('[data-agg]').forEach((x) => x.classList.toggle('on', x.dataset.agg === aggMode()));
    }));
    $('#btn-attend')?.addEventListener('click', () => openAttendanceDialog(ev, () => viewEvent(id)));
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
    const members = activeMembers().slice().sort((a, b) => order(a) - order(b) || byName(a, b));
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
    const rows = computeFrequency(events, activeMembers());

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
              <td><div class="row" style="gap:8px;flex-wrap:nowrap">${avatar(r.m)}<span class="name"><a class="member-link" href="#/membro/${encodeURIComponent(r.m.id)}">${esc(displayName(r.m))}</a>${r.m.char_class ? ` ${classTag(r.m.char_class)}` : ''}</span></div></td>
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
    if (!ev) { main.innerHTML = '<div class="card empty">Evento não encontrado.<br><br><a href="#/">Voltar</a></div>'; return; }
    T.ev = ev;
    state.pilots = await api.pilots().catch(() => state.pilots || []);
    T.people = goingPeople(ev);
    T.slots = new Map((ev.team_slots || []).map((s) => [s.user_id, s.team]));
    T.orig = new Map(T.slots);
    T.sel = null;
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
      <p><a href="#/evento/${ev.id}" class="small">← Voltar ao evento</a></p>
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
            ${pool.map((p) => chip(p, { draggable: true, selected: T.sel === p.id })).join('')
              || `<p class="muted small center">${T.people.length ? 'Todos os confirmados já estão em times.' : 'Ninguém confirmou presença ainda.'}</p>`}
          </div>
          ${classSummary()}
        </aside>
        <section class="teams-area">${teamsHtml(ev, T.people, T.slots, { editable: true, sel: T.sel, renamable: ev.team_format === 'rito' })}</section>
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
      if (!same && !(await confirmDialog('Outro oficial alterou estes times depois que você abriu a página. Salvar agora vai substituir as alterações dele. Continuar?', 'Substituir'))) {
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
  };
  const isAttr = (f) => ATTRS.some((a) => a.key === f);
  function fmtField(f, v) {
    if (v === null || v === undefined || v === '') return '—';
    if (f === 'char_class') return CLASS[v]?.label || String(v);
    if (isAttr(f)) return fmtNum(Number(v));
    return String(v);
  }

  function histItemsHtml(entries) {
    return entries.slice().sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at)).map((h) => {
      const lines = Object.keys(FIELD_LABEL).filter((f) => h.changes?.[f]).map((f) => {
        const [o, n] = h.changes[f];
        const delta = isAttr(f) && o !== null && n !== null ? Number(n) - Number(o) : null;
        const deltaTxt = delta ? ` <span class="${delta > 0 ? 'c-yes' : 'c-no'} small">(${delta > 0 ? '+' : ''}${fmtNum(delta)})</span>` : '';
        return `<li><span class="muted">${FIELD_LABEL[f]}:</span> <s>${esc(fmtField(f, o))}</s> → <b>${esc(fmtField(f, n))}</b>${deltaTxt}</li>`;
      }).join('');
      return `<div class="hist-item"><div class="hist-date">${esc(new Date(h.changed_at).toLocaleDateString('pt-BR'))} · ${fmtTime(h.changed_at)}</div><ul>${lines}</ul></div>`;
    }).join('');
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
    const freq = Object.fromEntries(computeFrequency(events, activeMembers()).map((r) => [r.m.id, r]));
    const header = ['Personagem', 'Conta Google', 'Cargo', 'Classe', ...ATTRS.map((a) => a.label), 'Telefone',
      `Frequência ${days} dias`, 'Presenças', 'Eventos contados', 'Confirmou e faltou', 'Sem resposta', 'Membro desde'];
    const rows = state.members.filter((m) => m.role !== 'former')
      .sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || byName(a, b))
      .map((m) => {
        const f = freq[m.id];
        return [m.game_name || '', m.google_name || '', ROLE_LABEL[m.role], CLASS[m.char_class]?.label || '',
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
  async function prepareImage(file) {
    const MAX_W = 2000;
    const MAX_BYTES = 1.5 * 1024 * 1024;
    if (file.type === 'image/gif') return file;
    const img = await createImageBitmap(file).catch(() => null);
    if (!img) return file;
    if (file.size <= MAX_BYTES && img.width <= MAX_W) return file;
    const scale = Math.min(1, MAX_W / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.9));
    return blob && blob.size < file.size ? new File([blob], 'malah-news.webp', { type: 'image/webp' }) : file;
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
    main.innerHTML = `
      <div class="page-head"><h1>Recrutamentos</h1><button class="btn primary" id="btn-new-rc">+ Novo recrutamento</button></div>
      <p class="muted small">Procurando gente para um Grupo Guerreiro, um time PvP ou outra atividade? Crie um recrutamento: ele aparece para todos depois que um oficial ou o líder aprovar. Os candidatos aparecem com classe e atributos do perfil, e quem criou escolhe quem entra.</p>
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
      main.innerHTML = '<p><a href="#/recrutamentos" class="small">← Recrutamentos</a></p><div class="card empty">Recrutamento não encontrado (pode ter sido apagado).</div>';
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
      <p><a href="#/recrutamentos" class="small">← Recrutamentos</a></p>
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

  function openRecruitForm(r) {
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
  // Meu ticket com resposta nova da liderança que eu ainda não abri
  const ticketHasNews = (t) => { if (!t.mine) return false; const m = lastPublic(t); return !!m && !m.from_author && Date.parse(m.created_at) > ticketSeen(t.id); };
  // Pendência pela última mensagem pública: 'staff' = pendente atendimento; 'author' = pendente autor
  const ticketPending = (t) => (t.status === 'resolved' ? null : lastPublic(t)?.from_author ? 'staff' : 'author');
  // Ticket de outra pessoa esperando a liderança
  const ticketAwaiting = (t) => !t.mine && ticketPending(t) === 'staff';
  // Líder e oficiais (com "Ver tickets") usam só a aba Atendimento, que também tem os tickets deles
  const supportOn = () => TICKETS_ON && isOfficer() && can('ticket_view');
  const ticketBadgeMine = () => (state.tickets || []).filter(ticketHasNews).length;
  const ticketBadgeStaff = () => (supportOn() ? (state.tickets || []).filter(ticketAwaiting).length + ticketBadgeMine() : 0);
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
      staff && !t.mine && pend ? `<span class="badge tk-pend-${pend}">${pend === 'staff' ? '⏳ Pendente atendimento' : '💬 Pendente autor'}</span>` : '',
    ].join('');
  }
  // Responsável em destaque (quem atende)
  function ownerTag(t) {
    if (t.status === 'resolved' && !t.assigned_to) return '';
    return t.assigned_to
      ? `<span class="tk-owner${t.assigned_to === state.user.id ? ' me' : ''}">👤 ${esc(ownerLabel(t))}</span>`
      : '<span class="tk-owner none">👤 Sem responsável</span>';
  }
  function ticketRowHtml(t, staff) {
    const cat = TICKET_CAT[t.category] || TICKET_CAT.other;
    const n = t.messages.filter((m) => !m.internal).length;
    return `<a class="card tk-row" href="#/ticket/${t.id}">
      <span class="rc-icon" aria-hidden="true">${cat.icon}</span>
      <div class="rc-body">
        <div class="tk-row-top"><div class="tk-title">${esc(t.title)}</div>${staff ? ownerTag(t) : ''}</div>
        <div class="rc-badges">${ticketBadges(t, staff)}</div>
        <div class="muted small">${staff ? `Aberto por <b>${esc(ticketAuthorLabel(t))}</b> · ` : ''}${n} mensage${n === 1 ? 'm' : 'ns'} · atualizado ${esc(fmtWhen(lastActivity(t)))}${!staff && t.assigned_to ? ` · com ${esc(nameOf(t.assigned_to))}` : ''}</div>
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
  async function viewTickets() {
    if (supportOn()) { location.hash = '#/atendimento'; return; }
    renderHeader('tickets');
    const mine = state.tickets.filter((t) => t.mine).sort((a, b) => Date.parse(lastActivity(b)) - Date.parse(lastActivity(a)));
    const open = mine.filter((t) => t.status !== 'resolved');
    const done = mine.filter((t) => t.status === 'resolved');
    main.innerHTML = `
      <div class="page-head"><h1>Central de Atendimento</h1><button class="btn primary" id="btn-new-tk">+ Novo ticket</button></div>
      <p class="muted small">Fale com a liderança do clã: sugestões, melhorias, dúvidas, problemas no site, reclamações ou denúncias. O líder e os oficiais respondem aqui mesmo, e você pode abrir o ticket de forma anônima.</p>
      <div class="section-head"><h2>Em aberto</h2></div>
      ${open.length ? open.map((t) => ticketRowHtml(t, false)).join('') : '<div class="card empty">Você não tem tickets em aberto.</div>'}
      ${done.length ? `<div class="section-head"><h2>Resolvidos</h2></div>${done.map((t) => ticketRowHtml(t, false)).join('')}` : ''}`;
    $('#btn-new-tk').addEventListener('click', openTicketForm);
  }

  // ---------- Aba "Atendimento" (líder e oficiais) ----------
  const SUP = { view: 'open', cat: '' };
  const SUP_VIEWS = [
    ['open', 'Em aberto'], ['new', 'Não iniciado'], ['mine_pending', 'Pendente comigo'], ['p_author', 'Pendente autor'],
    ['opened', 'Abertos por mim'], ['resolved', 'Resolvidos'], ['all', 'Todos'],
  ];
  const SUP_PICK = {
    open: (t) => !t.mine && t.status !== 'resolved',
    // Ninguém assumiu nem respondeu ainda
    new: (t) => !t.mine && t.status !== 'resolved' && !t.assigned_to && !t.messages.some((m) => !m.from_author && !m.internal),
    // Estou atendendo e a última mensagem é do autor
    mine_pending: (t) => !t.mine && t.assigned_to === state.user.id && ticketPending(t) === 'staff',
    p_author: (t) => !t.mine && ticketPending(t) === 'author',
    opened: (t) => t.mine,
    resolved: (t) => !t.mine && t.status === 'resolved',
    all: () => true,
  };
  async function viewSupport() {
    if (!supportOn()) { location.hash = '#/tickets'; return; }
    renderHeader('support');
    const all = state.tickets;
    const list = all.filter(SUP_PICK[SUP.view] || SUP_PICK.all).filter((t) => !SUP.cat || t.category === SUP.cat)
      .sort((a, b) => (ticketAwaiting(b) - ticketAwaiting(a)) || (Date.parse(lastActivity(b)) - Date.parse(lastActivity(a))));
    const nNew = all.filter(SUP_PICK.new).length;
    const nMine = all.filter(SUP_PICK.mine_pending).length;
    const nNews = all.filter(ticketHasNews).length;
    const nWaiting = all.filter(ticketAwaiting).length;
    const reportsHidden = !isLeader() && permMode('ticket_reports') === 'deny';
    const fcount = { new: nNew, mine_pending: nMine, opened: nNews };
    // Em "Todos" e "Abertos por mim", os resolvidos ficam numa seção separada
    const split = ['all', 'opened'].includes(SUP.view);
    const active = list.filter((t) => t.status !== 'resolved');
    const done = list.filter((t) => t.status === 'resolved');
    const rows = (arr) => arr.map((t) => ticketRowHtml(t, true)).join('');
    main.innerHTML = `
      <div class="page-head"><h1>Central de Atendimento</h1><button class="btn primary" id="btn-new-tk">+ Abrir ticket</button></div>
      <p class="muted small">Tickets dos membros; os que você abriu ficam em “Abertos por mim”. <b>${nNew}</b> não iniciado${nNew === 1 ? '' : 's'} · <b>${nMine}</b> pendente${nMine === 1 ? '' : 's'} com você · <b>${nWaiting}</b> pendente${nWaiting === 1 ? '' : 's'} de atendimento no total.${reportsHidden ? ' Os tickets de Reclamação / Denúncia ficam só com o líder.' : ''}</p>
      <div class="row tk-filters">
        <div class="seg rc-filter" role="group" aria-label="Filtrar tickets">
          ${SUP_VIEWS.map(([k, l]) => `<button class="${SUP.view === k ? 'on' : ''}" data-sup-v="${k}">${l}${fcount[k] ? ` <span class="tk-fcount">${fcount[k]}</span>` : ''}</button>`).join('')}
        </div>
        <select class="inline" id="sup-cat" aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          ${TICKET_CATS.filter((c) => !(reportsHidden && c.key === 'report')).map((c) => `<option value="${c.key}" ${SUP.cat === c.key ? 'selected' : ''}>${c.icon} ${esc(c.label)}</option>`).join('')}
        </select>
      </div>
      ${!list.length ? '<div class="card empty">Nenhum ticket aqui.</div>'
        : split ? `${active.length ? `<div class="section-head"><h2>Em aberto</h2></div>${rows(active)}` : ''}${done.length ? `<div class="section-head"><h2>Resolvidos</h2></div>${rows(done)}` : ''}`
        : rows(list)}`;
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
      main.innerHTML = `<p><a href="${home[0]}" class="small">← ${home[1]}</a></p><div class="card empty">Ticket não encontrado.</div>`;
      return;
    }
    const cat = TICKET_CAT[t.category] || TICKET_CAT.other;
    const canReply = t.mine || can('ticket_reply');
    const canStatus = t.mine || can('ticket_resolve');
    const who = (m) => {
      if (m.from_author) return t.mine ? 'Você' : ticketAuthorLabel(t);
      return m.author_id === state.user.id ? 'Você' : nameOf(m.author_id);
    };
    const msgs = t.messages.map((m) => {
      const me = m.author_id === state.user.id || (t.mine && m.from_author);
      return `<div class="tk-msg${me ? ' me' : ''}${m.internal ? ' internal' : ''}${m.from_author ? '' : ' staff'}">
        <div class="tk-msg-head"><b>${esc(who(m))}</b>${!m.from_author ? ' <span class="tk-role">Liderança</span>' : ''}${m.internal ? ' <span class="tk-int">🔒 Nota interna</span>' : ''}<span class="muted small">${esc(fmtWhen(m.created_at))}</span></div>
        ${m.body ? `<div class="tk-text">${esc(m.body)}</div>` : ''}
        ${imagesHtml(m.images)}
      </div>`;
    }).join('');

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
      <p><a href="${home[0]}" class="small">← ${home[1]}</a></p>
      <div class="page-head"><h1>${cat.icon} ${esc(t.title)}</h1></div>
      <div class="card tk-info">
        <div class="tk-row-top"><div class="rc-badges">${ticketBadges(t)}</div>${staff ? ownerTag(t) : ''}</div>
        <div class="muted small">Aberto por <b>${esc(ticketAuthorLabel(t))}</b> em ${esc(fmtWhen(t.created_at))}${!staff && t.assigned_to ? ` · Responsável: <b>${esc(nameOf(t.assigned_to))}</b>` : ''}</div>
        ${staff && state.revealed[t.id] ? `<p class="small rc-note">🕶️ Autor: <b>${esc(nameOf(state.revealed[t.id]))}</b>. Só você está vendo; nada fica registrado no ticket.</p>` : ''}
        ${t.mine && t.anonymous ? '<p class="small rc-note">🕶️ Seu nome fica oculto para os oficiais e o líder. Em casos graves, o líder pode ver quem abriu.</p>' : ''}
        ${!staff && t.status === 'resolved' ? '<p class="small rc-note">✔ Ticket resolvido. Se precisar, escreva abaixo que ele é reaberto.</p>' : ''}
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
    const [members, past, upcoming, changes, allNotes, mlog, pilots] = await Promise.all([
      api.members(), api.history(since), api.events(false), api.profileHistory(), showNotes ? api.notes() : Promise.resolve([]),
      api.membershipLog(targetId).catch(() => []), // se o banco ainda não tiver o histórico, mostra vazio
      api.pilots().catch(() => state.pilots || []),
    ]);
    state.pilots = pilots;
    state.members = members;
    const me = members.find((m) => m.id === targetId) || (self ? state.me : null);
    if (!me) { main.innerHTML = '<div class="card empty">Membro não encontrado.<br><br><a href="#/membros">Voltar</a></div>'; return; }
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
    const pending = upcoming.filter((ev) => !ev.rsvps.some((r) => r.user_id === me.id)).length;
    const upRows = upcoming.slice(0, 8).map((ev) => {
      const r = ev.rsvps.find((x) => x.user_id === me.id);
      const ans = !r ? (self ? '<span class="badge warn">Responder</span>' : '<span class="muted small">Sem resposta</span>')
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

    // Meus atributos comparados com a média do clã
    const clan = activeMembers().filter(hasBuild);
    const cmp = hasBuild(me) ? ATTRS.map((a) => {
      const vals = clan.map((m) => m[a.key]);
      const mean = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      const mineVal = me[a.key];
      const scale = Math.max(mineVal, mean || 0) * 1.1 || 1;
      const diff = mean ? (mineVal - mean) / mean : 0;
      return `<div class="cmp-row">
        <span class="cmp-label">${a.label}</span>
        <div class="cmp-track" title="${self ? 'Você' : esc(who)}: ${fmtNum(mineVal)} · Média do clã: ${fmtNum(mean)}">
          <span class="me" style="width:${(100 * mineVal) / scale}%"></span>
          <span class="clan" style="width:${(100 * (mean || 0)) / scale}%"></span>
        </div>
        <span class="cmp-val"><b>${fmtNum(mineVal)}</b><small>clã ${fmtNum(mean)}</small></span>
        <span class="cmp-diff ${diff >= 0 ? 'c-yes' : 'c-no'}">${diff >= 0 ? '+' : ''}${Math.round(diff * 100)}%</span>
      </div>`;
    }).join('') : `<p class="muted">${self ? 'Informe sua classe e seus atributos em “Editar perfil” para comparar com o clã.' : 'Este membro ainda não informou classe e atributos.'}</p>`;

    main.innerHTML = `
      ${self ? '' : '<p><a href="#/membros" class="small">← Membros</a></p>'}
      <div class="page-head">
        <h1>${self ? 'Meu perfil' : 'Perfil do membro'}</h1>
        <select class="inline" id="p-days" aria-label="Período">
          ${[[30, 'Últimos 30 dias'], [90, 'Últimos 90 dias'], [0, 'Todo o histórico']].map(([v, l]) => `<option value="${v}" ${P.days === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>

      <div class="card me-card">
        <div class="row">
          ${avatar(me, 'xl')}
          <div class="spacer">
            <div class="me-name">${esc(displayName(me))}${me.role === 'former' ? ' <span class="badge former-badge">Ex-membro</span>' : ''}</div>
            <div class="muted small">${me.game_name ? `${esc(me.google_name)} · ` : ''}${ROLE_LABEL[me.role]}${me.created_at ? ` · no clã desde ${new Date(me.created_at).toLocaleDateString('pt-BR')}` : ''}${phone ? ` · <a href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">📞 ${esc(phone)}</a>` : ''}</div>
            ${me.char_class ? `<div class="member-build">${classTag(me.char_class)} <span>${esc(CLASS[me.char_class].label)}</span><span class="chip-stats">${statsLine(me)}</span></div>` : ''}
          </div>
          ${self ? '<button class="btn small" id="btn-edit-pf">✎ Editar perfil</button>' : ''}
        </div>
      </div>

      <div class="stats" style="margin-top:12px">
        <div class="card stat"><div class="stat-num ${pctClass(f.pct)}">${pctText(f.pct)}</div><div class="muted small">${self ? 'sua frequência' : 'frequência'} (${periodLabel})</div></div>
        <div class="card stat"><div class="stat-num">${f.present}<span class="muted" style="font-size:1rem">/${f.total}</span></div><div class="muted small">presenças em eventos registrados</div></div>
        <div class="card stat"><div class="stat-num c-gold">${streak}</div><div class="muted small">${streak === 1 ? 'presença seguida' : 'presenças seguidas'} (sequência atual)</div></div>
        <div class="card stat"><div class="stat-num ${f.noShow ? 'c-no' : 'c-yes'}">${f.noShow}</div><div class="muted small">vezes que confirmou e faltou</div></div>
      </div>

      <div class="panels">
        <div class="card">
          <h2>Próximos eventos ${pending ? `<span class="badge warn">${pending} sem resposta</span>` : ''}</h2>
          ${upRows || '<p class="muted">Nenhum evento agendado.</p>'}
        </div>
        <div class="card">
          <h2>${self ? 'Você' : esc(who)} × média do clã</h2>
          <div class="cmp-legend small"><span><i class="lg me"></i>${self ? 'Você' : esc(who)}</span><span><i class="lg clan"></i>Média de ${clan.length} membros</span></div>
          ${cmp}
        </div>
        <div class="card">
          <h2>Últimos eventos</h2>
          ${recentRows || '<p class="muted">Ainda não há eventos com presença registrada neste período.</p>'}
        </div>
        <div class="card">
          <h2>Histórico de alterações</h2>
          <div class="hist">${histItemsHtml(myChanges) || '<p class="muted">Nenhuma alteração registrada ainda.</p>'}</div>
        </div>
      </div>
      ${pilotsCard(me, self)}
      ${membershipCard(mlog.filter((h) => h.user_id === me.id), members)}
      ${ticketsCard(me, self)}
      ${showNotes ? notesCard(me, allNotes.filter((n) => n.member_id === me.id), members) : ''}`;

    $('#btn-edit-pf')?.addEventListener('click', openProfile);
    bindPilotsCard(me, () => viewMyPanel(userId));
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
    const list = activeMembers().filter((m) => m.id !== state.user.id && !taken.has(m.id)).sort(byName);
    openDialog(`
      <form id="ap-form" class="stack">
        <h2>Pedir acesso a uma conta</h2>
        <p class="small" style="margin:0">Escolha a conta que você também joga. O <b>dono da conta</b> aprova no perfil dele; se ele não puder, um oficial ou o líder aprova.</p>
        ${memberPickerHtml(list)}
        <div class="field"><label for="ap-reason">Motivo <span class="muted small">(opcional)</span></label>
          <textarea id="ap-reason" maxlength="300" placeholder="Ex.: jogo na conta dele nas Guerras"></textarea></div>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Enviar pedido</button>
        </div>
      </form>`, (d) => {
      bindPicker(d);
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

  function lineChart(points) {
    const W = 640, H = 210, L = 58, R = 16, T = 16, B = 30;
    const vs = points.map((p) => p.v);
    let lo = Math.min(...vs); let hi = Math.max(...vs);
    if (hi - lo < 20) { lo -= 20; hi += 20; }
    const pad = (hi - lo) * 0.18; const y0 = lo - pad; const y1 = hi + pad;
    const x = (i) => L + (i * (W - L - R)) / Math.max(1, points.length - 1);
    const y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${H - B}L${x(0).toFixed(1)},${H - B}Z`;
    const every = Math.ceil(points.length / 6);
    const last = points.length - 1;
    return `<svg class="line-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ressonância média ao longo do tempo">
      <defs><linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a2f" stop-opacity=".35"/><stop offset="1" stop-color="#ff7a2f" stop-opacity="0"/></linearGradient></defs>
      ${[lo, (lo + hi) / 2, hi].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
        <text class="axis" x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${intFmt(v)}</text>`).join('')}
      <path d="${area}" fill="url(#g-area)"/>
      <path class="line" d="${line}"/>
      ${points.map((p, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4"><title>${esc(p.label)}: ${intFmt(p.v)} (${p.n} membros)</title></circle>`).join('')}
      ${points.map((p, i) => (i === last || (i % every === 0 && last - i >= every)
        ? `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>` : '')).join('')}
    </svg>`;
  }

  async function renderClanStats(box) {
    box.innerHTML = '<div class="muted small stats-loading">Carregando estatísticas…</div>';
    const since = new Date(Date.now() - STATS_DAYS * 86400000).toISOString();
    const [past, upcoming, histAll] = await Promise.all([
      api.history(since), api.events(false).catch(() => []), api.profileHistory().catch(() => []),
    ]);
    const members = activeMembers();
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

  function viewUtils() {
    main.innerHTML = `
      <div class="page-head"><h1>Utils</h1><span class="muted">Links úteis para o clã</span></div>
      <div class="util-grid">
        ${UTIL_LINKS.map((l) => `<a class="card util-card" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="util-icon" aria-hidden="true">${l.icon}</span>
          <span class="util-body"><b>${esc(l.title)}</b><span class="muted small">${esc(l.desc)}</span>
            <span class="util-host">${esc(new URL(l.url).hostname.replace(/^www\./, ''))} ↗</span></span>
        </a>`).join('')}
      </div>
      <p class="muted small">Os links abrem em uma nova aba.</p>`;
  }

  // ---------- Membros ----------

  const M = { q: '' };

  async function viewMembers() {
    loading();
    state.members = await api.members();
    const phones = can('view_phone') ? Object.fromEntries((await api.contacts()).map((c) => [c.user_id, c.phone])) : {};
    state.pilots = await api.pilots().catch(() => state.pilots || []);
    const pilotRequests = can('pilots') ? state.pilots.filter((p) => p.status === 'pending') : [];
    const histBy = {};
    if (isOfficer()) (await api.profileHistory()).forEach((h) => { (histBy[h.user_id] ||= []).push(h); });
    const noteCount = {};
    if (can('notes')) (await api.notes()).forEach((n) => { noteCount[n.member_id] = (noteCount[n.member_id] || 0) + 1; });
    const noteBadge = (m) => (noteCount[m.id] ? `<span class="note-badge" title="${noteCount[m.id]} anotação(ões) interna(s)">📝 ${noteCount[m.id]}</span>` : '');
    const oldNames = (id) => (histBy[id] || []).flatMap((h) => ['game_name', 'google_name'].map((f) => h.changes?.[f]?.[0])).filter(Boolean);
    const sorted = [...state.members].sort((a, b) => (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || byName(a, b));
    const pending = sorted.filter((m) => m.role === 'pending');
    const active = sorted.filter((m) => ACTIVE_ROLES.includes(m.role));
    const former = sorted.filter((m) => m.role === 'former');
    const amLeader = state.me.role === 'leader';
    // Quando e por que cada ex-membro saiu
    const mlog = isOfficer() && former.length ? await api.membershipLog() : [];
    const byIdAll = Object.fromEntries(state.members.map((m) => [m.id, m]));
    const leftInfo = (m) => {
      const h = mlog.find((x) => x.user_id === m.id && x.to_role === 'former');
      if (!h) return '<span class="muted small">Ex-membro</span>';
      return `<span class="muted small left-info">${h.from_role === 'pending' ? 'Recusado' : 'Removido'} em ${new Date(h.changed_at).toLocaleDateString('pt-BR')}`
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
    const row = (m, ctrl) => `<div class="member clickable" data-search="${esc(searchText(m))}" data-profile="${esc(m.id)}" title="Abrir o perfil de ${esc(displayName(m))}">${avatar(m, 'lg')}
      <div class="name"><a class="member-link" href="#/membro/${encodeURIComponent(m.id)}">${esc(displayName(m))}</a> ${noteBadge(m)} ${pilotLabel(m)} ${formerly(m)}
        <small>${m.managed ? 'conta sem login' : (m.game_name ? esc(m.google_name) : '')} ${phoneLink(m)}</small>
        ${m.char_class ? `<div class="member-build">${classTag(m.char_class)} <span>${esc(CLASS[m.char_class].label)}</span><span class="chip-stats">${statsLine(m)}</span></div>` : '<div class="member-build muted small">Classe e atributos não informados</div>'}
      </div>${histBtn(m)}${ctrl}</div>`;

    main.innerHTML = `
      <div class="page-head"><h1>Membros</h1><span class="muted">${active.length} ativos</span>
        ${can('csv') ? '<button class="btn small" id="btn-csv" title="Baixar planilha (CSV separado por ;)">⬇ Exportar CSV</button>' : ''}</div>
      ${can('stats') ? `<details class="stats-box" id="stats-box"${S.open ? ' open' : ''}>
        <summary>📊 Estatísticas do clã <span class="muted small">· composição, engajamento e evolução</span></summary>
        <div id="clan-stats"></div>
      </details>` : ''}
      ${isOfficer() ? `<input type="search" id="m-search" class="search" placeholder="Buscar por nome atual ou antigo…" value="${esc(M.q)}">` : ''}
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
      <div class="card">${active.map((m) => row(m, roleControl(m))).join('')}</div>
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

  async function openProfile() {
    const me = state.me;
    let phone = '';
    try { phone = await api.myPhone(); } catch (e) { console.error(e); }
    openDialog(`
      <form id="pf" class="stack">
        <h2>Meu perfil</h2>
        <div class="row pf-photo">
          <span id="pf-avatar">${avatar(me, 'xl')}</span>
          <div class="stack" style="gap:6px">
            <div><strong>${esc(me.google_name)}</strong><div class="muted small">${ROLE_LABEL[me.role]}</div></div>
            <div class="row" style="gap:6px">
              <label class="btn small" for="pf-file">📷 ${me.custom_avatar_url ? 'Trocar foto' : 'Enviar foto'}</label>
              <input id="pf-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
              ${!me.avatar_hidden && (me.custom_avatar_url || me.avatar_url) ? '<button type="button" class="btn small ghost danger" id="pf-remove">Remover foto</button>' : ''}
              ${(me.custom_avatar_url || me.avatar_hidden) && me.avatar_url ? '<button type="button" class="btn small ghost" id="pf-google">Usar foto da conta Google</button>' : ''}
            </div>
            <div class="muted small">Use uma foto do seu computador ou celular. Ela é recortada em quadrado.</div>
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="f-game">Nome do personagem</label>
            <input id="f-game" maxlength="40" value="${esc(me.game_name || '')}" placeholder="Seu nome no jogo">
          </div>
          <div class="field">
            <label for="f-phone">Telefone <span class="muted small">(opcional)</span></label>
            <input id="f-phone" type="tel" inputmode="tel" maxlength="30" autocomplete="tel" value="${esc(phone || '')}" placeholder="(11) 91234-5678">
          </div>
        </div>
        ${buildFields(me, false)}
        <p class="muted small" style="margin:0">Seu telefone só é visível para os oficiais e o líder.</p>
        <div class="row end">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">Salvar</button>
        </div>
      </form>`, (d) => {
      // Foto: salva na hora (independente do botão Salvar do formulário)
      const applyAvatar = async (blob, hidden, msg) => {
        d.querySelectorAll('.pf-photo .btn').forEach((b) => { b.disabled = true; b.classList.add('disabled'); });
        try {
          const url = await api.setAvatar(blob, hidden);
          Object.assign(state.me, { custom_avatar_url: url, avatar_hidden: !blob && hidden });
          const m = memberById(state.me.id);
          if (m) Object.assign(m, { custom_avatar_url: url, avatar_hidden: !blob && hidden });
          toast(msg);
          renderHeader(currentRouteKey());
          openProfile();
        } catch (err) {
          fail(err);
          d.querySelectorAll('.pf-photo .btn').forEach((b) => { b.disabled = false; b.classList.remove('disabled'); });
        }
      };
      $('#pf-file', d).addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) { toast('Escolha um arquivo de imagem (JPG, PNG ou WebP)', true); return; }
        if (file.size > 15 * 1024 * 1024) { toast('Imagem muito grande (máximo 15 MB)', true); return; }
        let blob;
        try { blob = await squareAvatar(file); } catch { toast('Não foi possível ler esta imagem. Tente uma foto JPG ou PNG.', true); return; }
        await applyAvatar(blob, false, 'Foto de perfil atualizada');
      });
      $('#pf-remove', d)?.addEventListener('click', async () => {
        if (!(await confirmDialog('Remover sua foto de perfil? No lugar dela vai aparecer a inicial do seu nome.', 'Remover foto'))) { openProfile(); return; }
        await applyAvatar(null, true, 'Foto removida');
      });
      $('#pf-google', d)?.addEventListener('click', () => applyAvatar(null, false, 'Voltou a foto da conta Google'));
      $('#pf', d).addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = $('button[type=submit]', d);
        submit.disabled = true;
        try {
          await api.saveProfile({ game_name: $('#f-game', d).value.trim() || null, ...readBuild(d) }, $('#f-phone', d).value.trim());
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
  async function loadBell() {
    if (!state.user || !isMember()) { state.bellUp = []; state.bellPast = []; return; }
    const [up, past] = await Promise.all([
      api.events(false).catch(() => []),
      can('attendance') ? api.events(true).catch(() => []) : [],
    ]);
    state.bellUp = up || []; state.bellPast = past || [];
  }
  let bellTimer = null;
  function refreshBellSoon() {
    clearTimeout(bellTimer);
    bellTimer = setTimeout(async () => {
      if (!state.user || !isMember()) return;
      try {
        await Promise.all([
          loadBell(), loadRecruits(), loadTickets(), isOfficer() ? loadPerms() : null,
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
      mine.push({ icon: '💬', text: `Resposta nova no ticket <b>${esc(t.title)}</b>`, href: `#/ticket/${t.id}` });
    });
    (state.recruits || []).filter((r) => isMyRecruit(r) && r.status === 'open' && recruitApps(r, 'applied').length).forEach((r) => {
      mine.push({ icon: '📣', text: `${plural(recruitApps(r, 'applied').length, 'candidato aguardando', 'candidatos aguardando')} você`, sub: `Recrutamento “${esc(r.title)}”`, href: `#/recrutamento/${r.id}` });
    });
    (state.pilots || []).filter((p) => p.account_id === me && p.status === 'pending').forEach((p) => {
      mine.push({ icon: '🧑‍✈️', text: `<b>${esc(nameOf(p.pilot_id))}</b> pediu para pilotar sua conta`, href: '#/perfil' });
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
      if (supportOn()) {
        const all = state.tickets || [];
        const nNew = all.filter(SUP_PICK.new).length;
        const nMine = all.filter(SUP_PICK.mine_pending).length;
        if (nNew) lead.push({ icon: '🎫', text: `${plural(nNew, 'ticket não iniciado', 'tickets não iniciados')}`, href: '#/atendimento', sup: 'new' });
        if (nMine) lead.push({ icon: '🎫', text: `${plural(nMine, 'ticket pendente', 'tickets pendentes')} com você`, sub: 'O autor respondeu', href: '#/atendimento', sup: 'mine_pending' });
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
    return { mine, lead };
  }

  let bellOpen = false;
  function renderBell() {
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
      if (a.dataset.sup) SUP.view = a.dataset.sup;
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
    const key = h === '/passados' ? 'past' : h === '/frequencia' ? 'freq' : h === '/news' ? 'news' : h === '/utils' ? 'utils'
      : h === '/config' ? 'config' : h === '/solicitacoes' ? 'requests'
      : RECRUIT_ON && h === '/recrutamentos' ? 'recruits' : rc ? 'recruits'
      : TICKETS_ON && h === '/tickets' ? 'tickets' : TICKETS_ON && h === '/atendimento' ? 'support' : tk ? 'ticket'
      : h === '/perfil' ? 'profile' : h === '/membros' ? (isOfficer() ? 'members' : 'profile') : mp ? 'members'
      : tm ? 'teams' : ev ? 'event' : 'upcoming';
    return { ev, tm, mp, rc, tk, key };
  }
  const currentRouteKey = () => parseRoute().key;

  async function route() {
    const { ev, tm, mp, rc, tk, key } = parseRoute();
    if (state.user && isOfficer()) await loadPerms();
    if (state.user && isMember()) await Promise.all([loadRecruits(), loadTickets(), loadBell()]);
    bellOpen = false;
    renderHeader(key);
    if (!state.user) return viewLogin();
    if (!isMember()) return state.me?.role === 'former' ? viewFormer() : viewPending();
    try {
      if (key === 'past') await viewEvents(true);
      else if (key === 'news') await viewNews();
      else if (key === 'utils') viewUtils();
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
    if (state.me && isMember() && !hasBuild(state.me) && !askedBuild) {
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

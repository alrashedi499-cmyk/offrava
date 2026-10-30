/* Offrava admin control center: one place to run the whole app.
   Sidebar sections: dashboard, marketplace, money (orders, returns, fees), people (users, chats, reports, reviews),
   growth (ads, advertisers, notify users), services, system (features, safe spots, activity log).
   Also shows the site banner and the "account suspended" bar to everyone. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => (c < 0 ? '−' : '') + '$' + (Math.abs(c||0)/100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const day = (d) => d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—';
  const stamp = (d) => d ? new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '—';
  const short = (id) => String(id || '').slice(0, 8);
  const table = (head, rows) => `<div class="admin-table"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${head.length}" class="muted">Nothing here.</td></tr>`}</tbody></table></div>`;
  const err = (area, e) => { area.innerHTML = `<div class="card adm-err"><b>Couldn't load this.</b><p class="muted">${esc(e?.message || e)}</p><p class="muted" style="font-size:13px">If this says a function is missing, run supabase/RUN-THIS-update.sql in Supabase.</p></div>`; };
  const tag = (t, cls='') => `<span class="tag ${cls}">${esc(t)}</span>`;
  const debounce = (fn, ms=300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  function sure(b, label='Tap again to confirm'){ if (b.dataset.sure) return true; b.dataset.sure = '1'; b.dataset.label = b.innerHTML; b.innerHTML = label; b.classList.add('adm-danger'); setTimeout(() => { if (b.isConnected && !b.disabled) { delete b.dataset.sure; b.innerHTML = b.dataset.label; b.classList.remove('adm-danger'); } }, 4000); return false; }
  // Ask for a short note inside the row (no pop-ups), then run cb(note)
  function ask(btn, placeholder, cb, okText='Confirm'){
    const cell = btn.closest('td') || btn.parentElement; const keep = cell.innerHTML;
    cell.innerHTML = `<form class="adm-ask"><input required maxlength="300" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"><div class="acct-links"><button class="btn btn-dark" type="submit">${okText}</button><button class="btn btn-ghost" type="button">Cancel</button></div><p class="form-msg"></p></form>`;
    const f = q('form', cell); f.querySelector('input').focus();
    f.querySelector('[type=button]').onclick = () => { cell.innerHTML = keep; rewire(); };
    f.onsubmit = async (e) => { e.preventDefault(); const b = f.querySelector('[type=submit]'); busy(b, true);
      try { await cb(f.querySelector('input').value.trim()); } catch (x) { busy(b, false); const m = f.querySelector('.form-msg'); m.textContent = x.message; m.className = 'form-msg err'; } };
  }
  let rewire = () => {};
  const rpc = async (fn, args) => { const { data, error } = await sb().rpc(fn, args); if (error) throw error; return data; };

  /* ---------------- Layout ---------------- */
  const NAV = [
    ['', [['overview', 'Dashboard', '◎']]],
    ['Marketplace', [['sellers', 'Sellers', '🏪'], ['listings', 'Listings', '📦'], ['requests', 'Requests', '📣'], ['offers', 'Offers & quotes', '🏷️'], ['makers', 'Games & software', '🎮']]],
    ['Money', [['orders', 'Orders & payouts', '🧾'], ['returns', 'Returns', '↩️'], ['settings', 'Fees & settings', '⚙️']]],
    ['People', [['users', 'Users', '👥'], ['chats', 'Chats', '💬'], ['reports', 'Reports', '🚩'], ['chatalerts', 'Chat alerts', '⚠️'], ['moderation', 'Content checks', '🛡️'], ['reviews', 'Reviews', '⭐']]],
    ['Growth', [['ads', 'Ads', '📺'], ['inq', 'Advertisers', '🤝'], ['broadcast', 'Notify users', '📢']]],
    ['Services', [['services', 'Services & pros', '🛠️']]],
    ['System', [['team', 'Team & security', '🔐'], ['ops', 'Night manager (AI)', '🌙'], ['features', 'Features on/off', '🎚️'], ['spots', 'Safe meetup spots', '📍'], ['log', 'Activity log', '📜']]]
  ];
  // What each team role can open (the database checks the same rules)
  const SEC_PERM = { overview: 'view', sellers: 'sellers', listings: 'listings', requests: 'view', offers: 'content', makers: 'products',
    orders: 'orders', returns: 'returns', settings: 'settings', users: 'users', chats: 'chats', reports: 'reports', chatalerts: 'chat_alerts',
    moderation: 'content', reviews: 'content', ads: 'settings', inq: 'settings', broadcast: 'settings', services: 'providers',
    team: 'team', ops: 'ops', features: 'settings', spots: 'settings', log: 'log' };
  const ROLE_PERMS = { moderator: ['view','content','reports','chat_alerts','chats','returns','orders','users','sellers','listings','products','providers'], support: ['view','chats','chat_alerts','orders'] };
  const role = () => A().profile?.is_admin ? (A().profile.admin_role || 'owner') : null;
  const can = (perm) => role() === 'owner' || (ROLE_PERMS[role()] || []).includes(perm);
  const canSec = (k) => can(SEC_PERM[k] || 'settings');
  const TITLES = Object.fromEntries(NAV.flatMap(([g, items]) => items.map(([k, t]) => [k, [g, t]])));
  const param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);

  function viewAdmin(){
    if (!A().user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">Sign in first.</p><a class="btn btn-dark" href="#/login">Sign in</a></div></div>`;
    if (!A().profile?.is_admin) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">This page is for Offrava admins only.</p><a class="btn btn-dark" href="#/">Go home</a></div></div>`;
    return `<div class="adm">
      <aside class="adm-side" aria-label="Admin sections">
        <div class="adm-brand"><b>Offrava</b> <span class="tag st-done">${role() === 'owner' ? 'Admin' : role() === 'moderator' ? 'Moderator' : 'Support'}</span></div>
        <nav>${NAV.map(([g, items]) => [g, items.filter(([k]) => canSec(k))]).filter(([, items]) => items.length).map(([g, items]) => `<div class="adm-group">${g ? `<div class="adm-gl">${g}</div>` : ''}${items.map(([k, t, i]) =>
          `<button type="button" class="adm-nav" data-sec="${k}"><span class="adm-i" aria-hidden="true">${i}</span><span class="adm-t">${t}</span><span class="adm-b" data-badge="${k}" hidden></span></button>`).join('')}</div>`).join('')}</nav>
      </aside>
      <main class="adm-main">
        <div class="adm-head"><div><div class="crumb" id="admCrumb">Admin</div><h1 id="admTitle">Dashboard</h1></div><button type="button" class="btn btn-ghost" id="admRefresh">↻ Refresh</button></div>
        <section id="adminArea" class="adm-area"></section>
      </main></div>`;
  }
  async function paintBadges(){
    try {
      const b = await rpc('admin_badges');
      Object.entries(b).forEach(([k, n]) => qa(`[data-badge="${k}"]`).forEach(el => { el.hidden = !n; el.textContent = n > 99 ? '99+' : n; }));
      return b;
    } catch (_) { return {}; }
  }
  async function wireAdmin(){
    const area = q('#adminArea'); if (!area) return;
    // 2-step sign-in check (when the owner turned it on)
    const { data: ts } = await sb().rpc('team_settings_view');
    if (ts?.mfa_required && !ts.mfa_ok) {
      q('#admCrumb').textContent = 'Admin'; q('#admTitle').textContent = 'Sign-in check';
      return mfaBox(area, () => wireAdmin(), true);
    }
    const sec = TITLES[param('s')] && canSec(param('s')) ? param('s') : 'overview';
    qa('.adm-nav').forEach(b => { b.classList.toggle('on', b.dataset.sec === sec); b.onclick = () => { location.hash = '#/admin?s=' + b.dataset.sec; }; });
    q('.adm-nav.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    const [g, t] = TITLES[sec]; q('#admCrumb').textContent = 'Admin' + (g ? ' / ' + g : ''); q('#admTitle').textContent = t;
    q('#admRefresh').onclick = () => { paintBadges(); open(sec, area); };
    paintBadges(); open(sec, area);
  }
  async function open(sec, area){
    area.innerHTML = '<p class="muted">Loading…</p>';
    const M = window.OffravaMarketAdmin || {}, AD = window.OffravaAds || {}, SV = window.OffravaServices || {};
    const map = {
      makers: window.OffravaMakers?.adminMakers,
      overview, sellers: M.aSellers, listings: M.aListings, requests: M.aRequests, offers,
      orders, returns: AD.adminReturns, settings,
      users, chats, reports: AD.adminReports, moderation, reviews, ops, team, chatalerts,
      ads: AD.adminAds, inq: AD.adminInquiries, broadcast,
      services: SV.adminServices, features: SV.adminFeatures, spots, log
    };
    try { await (map[sec] || overview)(area); } catch (e) { err(area, e); }
  }

  /* ---------------- Content checks (AI moderation queue) ---------------- */
  const KIND_LABEL = { listing: 'Listing', job: 'Job request', avatar: 'Profile photo', review: 'Review', question: 'Question', answer: 'Answer' };
  async function moderation(area){
    const st = param('m') || 'review';
    area.innerHTML = `<p class="muted" style="margin:0 0 12px">Every new listing, job request, profile photo, review and question is checked by AI. Unclear ones wait here — hidden until you decide. Blocked ones were removed and the owner told why.</p>
      <div class="seg" style="max-width:560px;margin-bottom:14px">${[['review', 'Needs review'], ['blocked', 'Blocked'], ['pending', 'Waiting'], ['ok', 'Approved'], ['evidence', 'Child safety (NCMEC)']].map(([k, t]) => `<button type="button" data-ms="${k}" class="${k === st ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="modList"><p class="muted">Loading…</p></div>`;
    qa('[data-ms]', area).forEach(b => b.onclick = () => { location.hash = '#/admin?s=moderation&m=' + b.dataset.ms; });
    if (st === 'evidence') return evidence(q('#modList', area));
    const rows = await rpc('admin_mod_list', { p_status: st, p_limit: 100 });
    const box = q('#modList', area);
    if (!rows?.length) { box.innerHTML = `<div class="card empty"><b>Nothing here</b><p class="muted">${st === 'review' ? 'No posts are waiting for you.' : 'No posts in this list.'}</p></div>`; return; }
    box.innerHTML = rows.map(r => { const cs = r.categories?.includes('child_safety'); return `<div class="card mod-row ${cs ? 'mod-urgent' : ''}">
      ${r.images?.length && cs ? `<div class="mod-imgs"><button type="button" class="btn btn-ghost" data-show="${r.id}">Photos hidden (${r.images.length}) — show only if needed</button></div>` : ''}
      ${r.images?.length && !cs ? `<div class="mod-imgs">${r.images.slice(0, 4).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
      <div class="mod-main"><div class="mod-top"><span class="tag">${esc(KIND_LABEL[r.kind] || r.kind)}</span>${(r.categories || []).map(c => `<span class="tag ${c === 'child_safety' ? 'st-bad' : 'st-wait'}">${esc(c.replace(/_/g, ' '))}</span>`).join('')}
          <small class="muted">${esc(r.owner_name)} · ${new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${r.confidence != null ? ` · AI ${Math.round(r.confidence * 100)}% sure` : ''}${r.decided_by && r.decided_by !== 'ai' && r.decided_by !== 'system' ? ' · decided by admin' : ''}</small></div>
        <b>${esc(r.title || '')}</b>${r.body ? `<p class="mod-body">${esc(r.body).slice(0, 600)}</p>` : ''}${r.reason ? `<p class="muted" style="margin:4px 0 0;font-size:13px">Reason: ${esc(r.reason)}</p>` : ''}
        ${cs ? `<p class="form-msg err" style="margin:6px 0 0"><b>Urgent:</b> don't delete it yourself. ${r.status === 'blocked' ? 'It was removed and a private copy saved for 1 year. Now report it — see <a href="#/admin?s=moderation&m=evidence">Child safety (NCMEC)</a>.' : 'If it looks like child sexual abuse material or a child at risk, press <b>Block &amp; save evidence</b> — this keeps a private copy for 1 year (required by law), removes it and bans the account. Then report it to NCMEC.'}</p>` : ''}
        ${r.kind === 'listing' ? `<a class="link-btn" href="#/item?id=${esc(r.ref)}" target="_blank">Open listing</a>` : ''}
        <div class="acct-links" style="margin-top:8px">${r.status !== 'ok' ? `<button class="btn btn-accent" type="button" data-md="ok" data-id="${r.id}">Approve</button>` : ''}${r.status !== 'blocked' ? `<button class="btn btn-ghost" type="button" data-md="blocked" data-id="${r.id}">Block</button>` : ''}${r.status !== 'blocked' && r.status !== 'ok' ? `<button class="btn btn-dark" type="button" data-pres="${r.id}">🚨 Block &amp; save evidence</button>` : ''}
          <input class="mod-note" data-note="${r.id}" maxlength="300" placeholder="Note / reason for the owner (optional)"></div><p class="form-msg" data-mm="${r.id}"></p></div></div>`; }).join('');
    qa('[data-show]', box).forEach(b => b.onclick = () => { const r = rows.find(x => String(x.id) === b.dataset.show);
      b.parentElement.innerHTML = r.images.slice(0, 4).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join(''); });
    qa('[data-pres]', box).forEach(b => b.onclick = async () => {
      const m = q(`[data-mm="${b.dataset.pres}"]`, box);
      if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Press again to confirm'; return; }
      b.disabled = true; m.textContent = 'Saving evidence…'; m.className = 'form-msg';
      const { data, error } = await sb().functions.invoke('moderate', { body: { preserve: Number(b.dataset.pres) } });
      if (error || data?.error) { m.textContent = data?.error || error.message; m.className = 'form-msg err'; b.disabled = false; return; }
      paintBadges(); location.hash = '#/admin?s=moderation&m=evidence';
    });
    qa('[data-md]', box).forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await rpc('admin_mod_decide', { p_id: Number(b.dataset.id), p_status: b.dataset.md, p_note: q(`[data-note="${b.dataset.id}"]`, box).value || null }); paintBadges(); moderation(area); }
      catch (e) { const m = q(`[data-mm="${b.dataset.id}"]`, box); m.textContent = e.message; m.className = 'form-msg err'; b.disabled = false; }
    });
  }

  // Child-safety evidence kept for 1 year + the NCMEC CyberTipline report log (18 U.S.C. 2258A)
  async function evidence(box){
    const rows = await rpc('admin_evidence_list');
    const steps = `<div class="card" style="margin-bottom:12px"><b>What to do (US law)</b><ol style="margin:8px 0 0;padding-left:20px;font-size:14px">
      <li>Don't download, forward or share the files except to report them.</li>
      <li>Report each item at the NCMEC CyberTipline: <a href="https://report.cybertip.org/" target="_blank" rel="noopener">report.cybertip.org</a> (electronic service providers: register once at <a href="https://esp.ncmec.org/registration" target="_blank" rel="noopener">esp.ncmec.org</a>).</li>
      <li>Enter the report number below. The copy is kept privately for 1 year, then can be deleted.</li>
      <li>If a child may be in danger right now, call 911 / the FBI (tips.fbi.gov).</li></ol></div>`;
    if (!rows?.length) { box.innerHTML = steps + '<div class="card empty"><b>Nothing saved</b><p class="muted">No child-safety evidence so far.</p></div>'; return; }
    box.innerHTML = steps + rows.map(e => `<div class="card mod-row ${e.ncmec_report_id ? '' : 'mod-urgent'}"><div class="mod-main">
      <div class="mod-top"><span class="tag">${esc(KIND_LABEL[e.kind] || e.kind)}</span>${e.ncmec_report_id ? `<span class="tag st-done">Reported · ${esc(e.ncmec_report_id)}</span>` : '<span class="tag st-bad">Not reported yet</span>'}
        <small class="muted">Saved ${new Date(e.created_at).toLocaleString('en-US')} · keep until ${new Date(e.preserve_until).toLocaleDateString('en-US')} · account ${esc(String(e.owner_id || '—').slice(0, 8))}</small></div>
      ${e.text_snapshot ? `<p class="mod-body">${esc(e.text_snapshot).slice(0, 600)}</p>` : ''}
      <div class="acct-links" style="margin-top:8px">${e.files?.length ? `<button type="button" class="btn btn-ghost" data-evf="${e.id}">Get files for the report (${e.files.length})</button>` : '<span class="muted" style="font-size:13px">No files (text only)</span>'}
        ${e.ncmec_report_id ? '' : `<input class="mod-note" data-evn="${e.id}" maxlength="60" placeholder="CyberTipline report number"><button type="button" class="btn btn-dark" data-evs="${e.id}">Save report number</button>`}</div>
      <div data-evl="${e.id}"></div><p class="form-msg" data-evm="${e.id}"></p></div></div>`).join('');
    qa('[data-evf]', box).forEach(b => b.onclick = async () => {
      b.disabled = true; const out = q(`[data-evl="${b.dataset.evf}"]`, box);
      const { data, error } = await sb().functions.invoke('moderate', { body: { evidence_files: Number(b.dataset.evf) } });
      b.disabled = false;
      if (error || data?.error) { out.innerHTML = `<p class="form-msg err">${esc(data?.error || error.message)}</p>`; return; }
      out.innerHTML = `<p class="muted" style="font-size:13px;margin:8px 0 4px">Private links, valid 10 minutes:</p>` + (data.links || []).map((l, i) => `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener">File ${i + 1}</a>`).join(' · ');
    });
    qa('[data-evs]', box).forEach(b => b.onclick = async () => {
      const m = q(`[data-evm="${b.dataset.evs}"]`, box); b.disabled = true;
      try { await rpc('admin_evidence_reported', { p_id: Number(b.dataset.evs), p_report: q(`[data-evn="${b.dataset.evs}"]`, box).value }); paintBadges(); evidence(box); }
      catch (e) { m.textContent = e.message; m.className = 'form-msg err'; b.disabled = false; }
    });
  }

  /* ---------------- 2-step sign-in (authenticator app) ---------------- */
  async function mfaBox(el, done, gate){
    const mfa = sb().auth.mfa;
    el.innerHTML = '<p class="muted">Loading…</p>';
    const { data: f, error } = await mfa.listFactors();
    if (error) { el.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`; return; }
    const ready = (f?.totp || []).find(x => x.status === 'verified');
    const form = (lead, extra = '') => `<div class="card mfa-card">${lead}${extra}
      <form id="mfaF" class="acct-links" style="margin-top:12px"><input id="mfaC" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required placeholder="6-digit code" class="mfa-in">
      <button class="btn btn-dark" type="submit">${ready ? 'Continue' : 'Turn on'}</button></form><p class="form-msg" id="mfaM"></p></div>`;
    let factorId = ready?.id;
    if (ready) {
      el.innerHTML = form(`<b>Enter your 2-step code</b><p class="muted" style="margin:6px 0 0">${gate ? 'Staff pages need a code from your authenticator app. ' : ''}Open Google Authenticator, Microsoft Authenticator or 1Password and type the 6-digit Offrava code.</p>`);
    } else {
      for (const x of (f?.all || []).filter(x => x.status !== 'verified')) await mfa.unenroll({ factorId: x.id });
      const { data: en, error: e2 } = await mfa.enroll({ factorType: 'totp', friendlyName: 'Offrava admin' });
      if (e2) { el.innerHTML = `<p class="form-msg err">${esc(e2.message)}</p>`; return; }
      factorId = en.id;
      el.innerHTML = form(`<b>Set up 2-step sign-in</b><p class="muted" style="margin:6px 0 10px">1. Install an authenticator app (Google Authenticator, Microsoft Authenticator or 1Password).<br>2. Scan this code with it.<br>3. Type the 6-digit code it shows.</p>`,
        `<div class="mfa-qr"><img src="${esc(en.totp.qr_code)}" alt="QR code for your authenticator app" width="180" height="180"><div class="muted" style="font-size:12px">Can't scan? Enter this key:<br><code>${esc(en.totp.secret)}</code></div></div>`);
    }
    q('#mfaF', el).onsubmit = async (e) => {
      e.preventDefault(); const b = e.currentTarget.querySelector('button'); b.disabled = true;
      const { error: e3 } = await mfa.challengeAndVerify({ factorId, code: q('#mfaC', el).value.trim() });
      if (e3) { b.disabled = false; const m = q('#mfaM', el); m.textContent = 'That code didn\'t work. Check your phone\'s time and try the newest code.'; m.className = 'form-msg err'; return; }
      done && done();
    };
  }

  /* ---------------- Team & security (owner) ---------------- */
  const ROLE_TXT = { owner: 'Owner — everything', moderator: 'Moderator — content, reports, chats, returns, users', support: 'Support — orders, chats, chat alerts' };
  async function team(area){
    const [list, ts, aal] = await Promise.all([rpc('admin_team_list'), rpc('team_settings_view'), sb().auth.mfa.getAuthenticatorAssuranceLevel()]);
    const me = A().user.id, myAal = aal?.data?.currentLevel;
    area.innerHTML = `<p class="muted adm-note">Everyone on the team signs in with their own Offrava account — never share yours. Every action is saved under their name in the activity log. Remove someone and their access ends at once.</p>
      <div class="card"><b>Add someone</b><p class="muted" style="margin:4px 0 10px;font-size:14px">They sign up on Offrava first with their own email. Then add that email here.</p>
        <form id="tmF" class="acct-links"><input id="tmE" type="email" required placeholder="their@email.com" class="mod-note" style="min-width:220px">
        <select id="tmR" class="tm-sel"><option value="moderator">Moderator</option><option value="support">Support</option><option value="owner">Owner</option></select>
        <button class="btn btn-dark" type="submit">Add</button></form><p class="form-msg" id="tmM"></p>
        <ul class="muted" style="font-size:13px;margin:10px 0 0;padding-left:18px">${Object.values(ROLE_TXT).map(t => `<li>${esc(t)}</li>`).join('')}<li>Only owners: fees & settings, team, child-safety evidence, Night manager, ads, notifying all users, refunds above the limit.</li></ul></div>
      <h2 class="hub-h">Team</h2>
      <div class="card list-card">${list.map(u => `<div class="tm-row"><div style="flex:1;min-width:0"><b>${esc(u.name || u.email)}</b>${u.user_id === me ? ' <span class="tag">you</span>' : ''}<div class="muted" style="font-size:13px">${esc(u.email || '')} · ${u.actions_30d} actions in 30 days${u.last_action ? ' · last ' + day(u.last_action) : ''}</div></div>
        <select data-tr="${esc(u.email)}" class="tm-sel">${['owner', 'moderator', 'support'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r[0].toUpperCase() + r.slice(1)}</option>`).join('')}</select>
        <button class="link-btn adm-red" type="button" data-trm="${esc(u.email)}">Remove</button></div>`).join('')}</div>
      <h2 class="hub-h">Security</h2>
      <div class="card"><div class="ops-grid"><label class="ops-sw"><input type="checkbox" id="tmMfa" ${ts.mfa_required ? 'checked' : ''}><span><b>Require 2-step sign-in</b> for everyone on the team (a code from an authenticator app)</span></label></div>
        <p class="muted" style="font-size:13px;margin:6px 0 0">You: ${myAal === 'aal2' ? '✓ signed in with 2-step' : 'not using 2-step yet'} — set it up for yourself first, then turn this on.</p>
        <div class="ops-grid" style="margin-top:10px"><label>Moderators can refund up to $<input type="number" id="tmLim" min="0" max="10000" value="${ts.mod_refund_limit_cents / 100}" style="width:90px"></label></div>
        <div class="acct-links" style="margin-top:12px"><button class="btn btn-dark" type="button" id="tmSave">Save</button><button class="btn btn-ghost" type="button" id="tmSetup">${myAal === 'aal2' ? 'Re-check my 2-step' : 'Set up 2-step for me'}</button></div>
        <p class="form-msg" id="tmSM"></p><div id="tmMfaBox"></div></div>
      <h2 class="hub-h">Languages</h2>
      <div class="card"><p class="muted" style="margin:0 0 10px;font-size:14px">The app translates itself the first time someone opens a page in a language. To have a language fully ready before you advertise it (e.g. Spanish or Arabic), translate the whole app now — it takes a minute or two.</p>
        <div class="acct-links"><select id="tmLang" class="tm-sel">${(window.OffravaI18n?.LANGS || []).filter(([k]) => k !== 'en').map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select>
        <button class="btn btn-dark" type="button" id="tmWarm">Translate the whole app</button></div><p class="form-msg" id="tmWM"></p></div>`;
    const say = (id, t, ok) => { const m = q(id, area); m.textContent = t; m.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
    q('#tmF', area).onsubmit = async (e) => { e.preventDefault();
      try { say('#tmM', await rpc('admin_team_set', { p_email: q('#tmE', area).value, p_role: q('#tmR', area).value }), true); setTimeout(() => team(area), 900); } catch (er) { say('#tmM', er.message); } };
    qa('[data-tr]', area).forEach(x => x.onchange = async () => { try { await rpc('admin_team_set', { p_email: x.dataset.tr, p_role: x.value }); team(area); } catch (er) { alertBox(area, er.message); } });
    qa('[data-trm]', area).forEach(x => x.onclick = async () => {
      if (x.dataset.sure !== '1') { x.dataset.sure = '1'; x.textContent = 'Sure? Remove'; return; }
      try { await rpc('admin_team_set', { p_email: x.dataset.trm, p_role: 'remove' }); team(area); } catch (er) { alertBox(area, er.message); } });
    q('#tmSave', area).onclick = async () => {
      if (q('#tmMfa', area).checked && !ts.mfa_required && myAal !== 'aal2') return say('#tmSM', 'Set up 2-step for yourself first, or you\'ll lock yourself out.');
      try { await rpc('admin_team_settings', { p_mfa_required: q('#tmMfa', area).checked, p_mod_refund_limit_cents: Math.round(Number(q('#tmLim', area).value) * 100) }); say('#tmSM', 'Saved ✓', true); } catch (er) { say('#tmSM', er.message); } };
    q('#tmSetup', area).onclick = () => mfaBox(q('#tmMfaBox', area), () => team(area));
    q('#tmWarm', area).onclick = async (e) => {
      const b = e.currentTarget, l = q('#tmLang', area).value; b.disabled = true;
      for (let i = 0; i < 20; i++) {
        say('#tmWM', 'Translating… (this page can stay open)', true);
        const { data, error } = await sb().functions.invoke('translate', { body: { ui_warm: { lang: l } } });
        if (error || data?.error) { say('#tmWM', data?.error || error.message); break; }
        if (!data.remaining) { say('#tmWM', `Done ✓ — all ${data.total} pieces of text are ready.`, true); break; }
        say('#tmWM', `${data.total - data.remaining} of ${data.total} done…`, true);
      }
      b.disabled = false;
    };
  }
  const alertBox = (area, t) => { const m = document.createElement('p'); m.className = 'form-msg err'; m.textContent = t; area.prepend(m); };

  /* ---------------- Chat alerts (automatic scam / safety flags on buyer↔seller chats) ---------------- */
  const FLAG_TXT = { pay_outside: 'Pay outside Offrava', contact_outside: 'Move chat outside', link: 'Outside link', deal_outside: 'Deal outside Offrava', code_scam: 'Asked for a code',
    overpay_scam: 'Overpayment / check scam', scam: 'Scam', threat: 'Threat', possible_minor: 'Possible minor', sexual: 'Sexual', adult_sexual: 'Sexual', harassment: 'Harassment',
    hate_extremism: 'Hate', discrimination: 'Discrimination', drugs: 'Drugs', weapons: 'Weapons', spam: 'Spam', personal_data: 'Asked for private data', other: 'Other' };
  const FLAG_BAD = ['threat', 'possible_minor', 'code_scam', 'overpay_scam', 'scam', 'sexual', 'adult_sexual', 'harassment', 'hate_extremism', 'discrimination', 'drugs', 'weapons', 'personal_data'];
  async function chatalerts(area){
    const st = param('m') || 'open';
    area.innerHTML = `<p class="muted adm-note">Messages are checked automatically — nobody reads them unless there's an alert. Open a chat only to handle the alert; it's logged. Both people already got a safety tip in the chat.</p>
      <div class="seg" style="max-width:360px;margin-bottom:14px">${[['open', 'Open'], ['all', 'All']].map(([k, t]) => `<button type="button" data-cs="${k}" class="${k === st ? 'on' : ''}">${t}</button>`).join('')}</div><div id="caList"><p class="muted">Loading…</p></div>`;
    qa('[data-cs]', area).forEach(b => b.onclick = () => { location.hash = '#/admin?s=chatalerts&m=' + b.dataset.cs; });
    const rows = await rpc('admin_chat_flags', { p_status: st, p_limit: 150 });
    const box = q('#caList', area);
    if (!rows?.length) { box.innerHTML = '<div class="card empty"><b>All clear</b><p class="muted">No chat alerts.</p></div>'; return; }
    box.innerHTML = rows.map(f => `<div class="card mod-row ${f.severity === 'high' ? 'mod-urgent' : ''}"><div class="mod-main">
      <div class="mod-top">${f.kinds.map(k => tag(FLAG_TXT[k] || k, FLAG_BAD.includes(k) ? 'st-bad' : 'st-wait')).join('')}${f.sender_muted_until && new Date(f.sender_muted_until) > new Date() ? tag('Messages paused', 'st-wait') : ''}
        <small class="muted">${esc(f.title || 'Chat')} · ${esc(f.buyer_name)} ↔ ${esc(f.seller_name || 'Seller')} · ${new Date(f.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>
      <p class="mod-body"><b>${esc(f.sender_name || '?')} (${esc(f.sender_side)}):</b> “${esc(f.excerpt)}”</p>
      <small class="muted">${f.sender_flags_30d} alert${f.sender_flags_30d == 1 ? '' : 's'} for this person in 30 days${f.status !== 'open' ? ` · ${esc(f.status)}${f.handled_by === 'ops' ? ' by Night manager' : ''}${f.note ? ': ' + esc(f.note) : ''}` : ''}</small>
      ${f.note && f.note.startsWith('AI:') ? `<small class="muted" style="display:block">${esc(f.note)}</small>` : ''}
      ${f.status === 'open' ? `<div class="acct-links" style="margin-top:8px"><button class="btn btn-ghost" type="button" data-cav="${f.id}" data-conv="${f.conversation_id}">Open chat</button>
        <button class="btn btn-ghost" type="button" data-ca="dismiss" data-id="${f.id}">Fine — dismiss</button><button class="btn btn-dark" type="button" data-ca="warn" data-id="${f.id}">Warn ${esc(f.sender_side)}</button>
        ${can('users') ? (f.sender_muted_until && new Date(f.sender_muted_until) > new Date() ? `<button class="btn btn-ghost" type="button" data-ca="unmute" data-id="${f.id}">Unpause messages</button>` : `<button class="btn btn-ghost" type="button" data-ca="mute" data-id="${f.id}">Pause messages 7 days</button>`) + `<button class="btn btn-ghost adm-red" type="button" data-ca="ban" data-id="${f.id}">Ban</button>` : ''}
        <input class="mod-note" data-can="${f.id}" maxlength="400" placeholder="Note / warning text (optional)"></div>` : ''}
      <div data-cab="${f.id}"></div><p class="form-msg" data-cam="${f.id}"></p></div></div>`).join('');
    qa('[data-cav]', box).forEach(b => b.onclick = async () => {
      const out = q(`[data-cab="${b.dataset.cav}"]`, box);
      try { const msgs = await rpc('admin_read_chat', { p_conv: b.dataset.conv, p_reason: 'Chat alert #' + b.dataset.cav });
        out.innerHTML = `<div class="ca-chat">${msgs.slice(-30).map(m => `<div class="ca-m ${m.who === 'Offrava' || m.who === 'Admin' ? 'sys' : ''}"><b>${esc(m.who)}</b> ${esc(m.body)}</div>`).join('')}</div>`; b.remove(); }
      catch (e) { out.innerHTML = `<p class="form-msg err">${esc(e.message)}</p>`; } });
    qa('[data-ca]', box).forEach(b => b.onclick = async () => {
      const id = b.dataset.id, m = q(`[data-cam="${id}"]`, box);
      if (b.dataset.ca === 'ban' && b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Sure? Ban'; return; }
      b.disabled = true;
      try { await rpc('admin_chat_flag', { p_id: Number(id), p_action: b.dataset.ca, p_note: q(`[data-can="${id}"]`, box).value || null }); paintBadges(); chatalerts(area); }
      catch (e) { m.textContent = e.message; m.className = 'form-msg err'; b.disabled = false; } });
  }

  /* ---------------- Night manager (AI operations assistant) ---------------- */
  const ACT_LABEL = { decide_content: 'Content decision', close_report: 'Closed report', hide_listing: 'Hid listing', decide_return: 'Return decision',
    hold_payment: 'Held payment', order_chat: 'Wrote in order chat', message_user: 'Messaged someone', alert_admin: 'Alerted you', task_update: 'Task update' };
  async function ops(area){
    area.innerHTML = '<p class="muted">Loading…</p>';
    const [{ data: c }, { data: tasks }, { data: runs }, { data: acts }] = await Promise.all([
      sb().from('ops_config').select('*').eq('id', 1).maybeSingle(),
      sb().from('ops_tasks').select('*').neq('status', 'done').order('id', { ascending: false }).limit(50),
      sb().from('ops_runs').select('*').order('id', { ascending: false }).limit(15),
      sb().from('ops_actions').select('*').not('action', 'like', 'look_up%').order('id', { ascending: false }).limit(60)
    ]);
    if (!c) { area.innerHTML = '<div class="card empty"><b>Run the latest database update first.</b></div>'; return; }
    const paused = c.paused_until && new Date(c.paused_until) > new Date();
    const state = !c.enabled ? ['Off', 'st-wait'] : paused ? ['Paused until ' + new Date(c.paused_until).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }), 'st-wait'] : ['On duty ' + (c.all_day ? 'all day' : `${c.night_start}:00 – ${c.night_end}:00`), 'st-done'];
    const hr = (n) => `<select data-k="${n}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${c[n] === h ? 'selected' : ''}>${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'}</option>`).join('')}</select>`;
    const sw = (k, t) => `<label class="ops-sw"><input type="checkbox" data-b="${k}" ${c[k] ? 'checked' : ''}><span>${t}</span></label>`;
    area.innerHTML = `
      <div class="card ops-head"><div><div class="mod-top"><b style="font-size:18px">🌙 Night manager</b><span class="tag ${state[1]}">${state[0]}</span></div>
        <p class="muted" style="margin:6px 0 0">An AI assistant that runs Offrava while you're away: decides clear content checks, handles reports and returns within your limits, nudges slow orders, does your tasks, and sends you a morning report. It can never touch child-safety cases, ban anyone, pay sellers, change fees, or go over your refund limit. Everything it does is logged below, and most of it can be undone.</p></div>
        <div class="acct-links"><button class="btn btn-accent" type="button" id="opsOn">${c.enabled ? 'Turn off' : 'Turn on'}</button>
          <button class="btn btn-ghost" type="button" id="opsNow" ${c.enabled ? '' : 'disabled'}>Run now</button>
          ${paused ? '<button class="btn btn-ghost" type="button" data-pause="0">Resume</button>' : '<button class="btn btn-ghost" type="button" data-pause="12">Pause 12 h</button>'}</div>
        <p class="form-msg" id="opsMsg"></p></div>

      <h2 class="hub-h">Give it a task</h2>
      <form class="card" id="opsTaskF"><div class="field"><label for="otT">Task</label><input id="otT" maxlength="140" required placeholder="e.g. Welcome every new seller and check their first listing"></div>
        <div class="field"><label for="otI">Details (optional)</label><textarea id="otI" rows="2" maxlength="3000" placeholder="Anything it should know or how you want it done"></textarea></div>
        <div class="acct-links"><select id="otR"><option value="once">Do it once</option><option value="daily">Every day</option><option value="every_run">Every check</option></select>
        <button class="btn btn-dark" type="submit">Add task</button></div><p class="form-msg" id="otM"></p></form>
      <div class="card list-card" id="opsTasks">${(tasks || []).length ? tasks.map(t => `<div class="ops-task"><div style="flex:1;min-width:0"><b>${esc(t.title)}</b> <span class="tag">${t.repeat === 'once' ? 'once' : t.repeat === 'daily' ? 'daily' : 'every check'}</span>${t.status !== 'active' ? ` <span class="tag st-wait">${esc(t.status)}</span>` : ''}
          ${t.instructions ? `<div class="muted" style="font-size:13px">${esc(t.instructions)}</div>` : ''}${t.last_result ? `<div style="font-size:13px;margin-top:4px">↳ ${esc(t.last_result)}</div>` : ''}</div>
          <button class="link-btn" type="button" data-tp="${t.id}" data-st="${t.status === 'active' ? 'paused' : 'active'}">${t.status === 'active' ? 'Pause' : 'Restart'}</button><button class="link-btn" type="button" data-tp="${t.id}" data-st="delete">Delete</button></div>`).join('')
        : '<p class="muted" style="padding:14px 16px;margin:0">No tasks. It still watches everything on its own.</p>'}</div>

      <h2 class="hub-h">Rules for it</h2>
      <div class="card" id="opsCfg">
        <div class="ops-grid"><label>Works ${hr('night_start')} to ${hr('night_end')}</label>${sw('all_day', 'Work all day, not only at night')}
          <label>Check every <input type="number" data-n="every_minutes" min="5" max="240" value="${c.every_minutes}" style="width:70px"> minutes</label>
          <label>Refund up to $<input type="number" data-n="refund_limit_cents" data-usd min="0" max="500" value="${c.refund_limit_cents / 100}" style="width:80px"> on its own</label>
          <label>Max <input type="number" data-n="max_messages_run" min="0" max="100" value="${c.max_messages_run}" style="width:70px"> messages per check</label></div>
        <div class="ops-grid" style="margin-top:10px">${sw('can_decide_content', 'Can approve / block posts')}${sw('can_close_reports', 'Can close reports')}${sw('can_decide_returns', 'Can decide returns (within the limit)')}${sw('can_message_users', 'Can message buyers & sellers')}</div>
        <div class="field" style="margin-top:12px"><label for="opsSO">Standing orders — how you want things run (it reads this every time)</label>
          <textarea id="opsSO" rows="4" maxlength="4000" placeholder="e.g. Be generous with refunds under $20. Never approve car seats. Remind sellers to reply within 2 hours.">${esc(c.standing_orders)}</textarea></div>
        <button class="btn btn-dark" type="button" id="opsSave">Save rules</button> <span class="muted" style="font-size:13px">Time zone: ${esc(c.tz)}</span><p class="form-msg" id="opsCM"></p></div>

      <h2 class="hub-h">What it did</h2>
      <div class="card list-card">${(runs || []).length ? runs.map(r => {
          const mine = (acts || []).filter(a => a.run_id === r.id);
          return `<div class="ops-run"><div class="mod-top"><b>${r.mode === 'report' ? '☀️ Morning report' : '🌙 Check'}</b><small class="muted">${new Date(r.started_at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}${r.stats?.actions != null ? ` · ${r.stats.actions} action${r.stats.actions === 1 ? '' : 's'}` : ''}</small>${r.error ? '<span class="tag st-bad">error</span>' : !r.finished_at ? '<span class="tag st-wait">working…</span>' : ''}</div>
            ${r.summary ? `<p style="margin:4px 0;white-space:pre-line;font-size:14px">${esc(r.summary)}</p>` : ''}${r.error ? `<p class="form-msg err" style="margin:4px 0">${esc(r.error)}</p>` : ''}
            ${mine.map(a => `<div class="ops-act ${a.undone_at ? 'undone' : ''}"><span>${esc(ACT_LABEL[a.action] || a.action)}</span><span class="muted">${esc(a.args?.decision || a.args?.title || a.args?.reason || a.args?.resolution || a.args?.text || a.args?.result || '').slice(0, 140)}</span>
              ${a.undo && !a.undone_at ? `<button class="link-btn" type="button" data-undo="${a.id}">Undo</button>` : a.undone_at ? '<small class="muted">undone</small>' : ''}</div>`).join('')}</div>`; }).join('')
        : '<p class="muted" style="padding:14px 16px;margin:0">Nothing yet. Turn it on — it starts at the next check.</p>'}</div>`;
    const cfg = async (p, msgEl = '#opsMsg') => {
      try { await rpc('admin_ops_config', { p }); ops(area); }
      catch (e) { const m = q(msgEl, area); m.textContent = e.message; m.className = 'form-msg err'; }
    };
    q('#opsOn', area).onclick = () => cfg({ enabled: !c.enabled });
    q('#opsNow', area).onclick = async (e) => { e.currentTarget.disabled = true; await rpc('admin_ops_config', { p: { run_now: true } }); const m = q('#opsMsg', area); m.textContent = 'It will start within a minute. Refresh to see what it did.'; m.className = 'form-msg ok'; };
    qa('[data-pause]', area).forEach(b => b.onclick = () => cfg({ pause_hours: Number(b.dataset.pause) }));
    q('#opsSave', area).onclick = () => {
      const p = { standing_orders: q('#opsSO', area).value };
      qa('[data-k]', area).forEach(x => p[x.dataset.k] = Number(x.value));
      qa('[data-n]', area).forEach(x => p[x.dataset.n] = x.hasAttribute('data-usd') ? Math.round(Number(x.value) * 100) : Number(x.value));
      qa('[data-b]', area).forEach(x => p[x.dataset.b] = x.checked);
      cfg(p, '#opsCM');
    };
    q('#opsTaskF', area).onsubmit = async (e) => {
      e.preventDefault();
      try { await rpc('admin_ops_task', { p_id: null, p_title: q('#otT', area).value, p_instructions: q('#otI', area).value, p_repeat: q('#otR', area).value, p_status: null }); ops(area); }
      catch (er) { const m = q('#otM', area); m.textContent = er.message; m.className = 'form-msg err'; }
    };
    qa('[data-tp]', area).forEach(b => b.onclick = async () => { await rpc('admin_ops_task', { p_id: Number(b.dataset.tp), p_title: null, p_instructions: null, p_repeat: null, p_status: b.dataset.st }); ops(area); });
    qa('[data-undo]', area).forEach(b => b.onclick = async () => { b.disabled = true; try { await rpc('admin_ops_undo', { p_action: Number(b.dataset.undo) }); ops(area); } catch (e) { b.textContent = e.message; } });
  }

  /* ---------------- Dashboard ---------------- */
  async function overview(area){
    area.innerHTML = `<div id="admAttn"></div>
      <h2 class="hub-h" style="margin-top:8px">Is "competing offers" working? <small class="muted" style="font-size:14px;font-weight:500">last 30 days</small></h2>
      <div class="metrics" id="metrics"></div><div class="stats4" id="stats"></div>
      <div class="adm-2col"><div><h2 class="hub-h">Money</h2><div class="stats4 adm-money" id="mstats"></div></div></div>
      <h2 class="hub-h">Latest admin activity</h2><div id="admRecent"></div>`;
    const b = await paintBadges();
    const items = [
      ['sellers', b.sellers, 'seller applications waiting', 'Review'], ['returns', b.returns, 'returns need your decision', 'Decide'],
      ['reports', b.reports, 'open reports', 'Check'], ['moderation', b.moderation, 'posts waiting for a content check', 'Review'], ['orders', b.orders, 'orders need attention (hold, stuck payout, refund pending)', 'Open'],
      ['services', b.services, 'pros waiting for license approval', 'Review'], ['makers', b.makers, 'games / software waiting for review', 'Review'], ['inq', b.inq, 'new advertisers asking', 'Reply']
    ].filter(x => x[1]);
    q('#admAttn').innerHTML = items.length
      ? `<div class="adm-attn">${items.map(([k, n, t, c]) => `<a class="adm-card" href="#/admin?s=${k}${k === 'orders' ? '&f=problems' : ''}"><span class="big">${n}</span><span>${t}</span><b>${c} →</b></a>`).join('')}</div>`
      : `<div class="adm-ok">✓ Nothing is waiting for you right now.</div>`;
    sb().rpc('admin_metrics', { p_days: 30 }).then(({ data: m }) => {
      const el = q('#metrics'); if (!el || !m) return;
      const pct = (v) => v == null ? '—' : v + '%';
      el.innerHTML = [
        ['Requests with 2+ offers', pct(m.fill_rate_2), 'Goal 70%', true], ['Requests with 1+ offer', pct(m.fill_rate_1), 'Goal 60%+'],
        ['Time to first offer', m.median_first_offer_min == null ? '—' : m.median_first_offer_min + ' min', 'Goal under 30 min'], ['Request → purchase', pct(m.request_to_purchase), 'Goal 25%'],
        ['Avg offers per request', m.avg_offers ?? '—', m.requests_closed + ' requests closed'], ['Auto-offers', pct(m.auto_offer_share), 'share of all offers'],
        ['Sales (GMV)', money(m.gmv_cents || 0), m.orders + ' orders'], ['Offrava revenue', money(m.revenue_cents || 0), 'refunds ' + pct(m.refund_rate)]
      ].map(([k, v, s, key]) => `<div class="stat ${key ? 'key' : ''}"><div class="muted">${k}</div><div class="big">${v}</div><small class="muted">${s}</small></div>`).join('');
    });
    sb().rpc('admin_stats').then(({ data: st }) => { const el = q('#stats'); if (!el || !st) return;
      el.innerHTML = [['Users', st.users], ['Sellers waiting', st.sellers_pending], ['Approved sellers', st.sellers_approved], ['Fully verified', st.sellers_verified], ['Active listings', st.listings_active], ['Open requests', st.requests_open], ['All requests', st.requests_total], ['Offers sent', st.offers_total]]
        .map(([k, v]) => `<div class="stat"><div class="muted">${k}</div><div class="big">${v ?? '—'}</div></div>`).join(''); });
    sb().rpc('admin_order_stats').then(({ data: o }) => { const el = q('#mstats'); if (!el || !o) return;
      el.innerHTML = [['Paid orders', o.orders_paid], ['Money in progress', money(o.gmv_cents)], ['Fees earned', money(o.fees_cents)], ['Open returns', o.returns_open]]
        .map(([k, v]) => `<div class="stat"><div class="muted">${k}</div><div class="big">${v ?? '—'}</div></div>`).join(''); });
    const { data: lg } = await sb().from('admin_log').select('*').order('created_at', { ascending: false }).limit(6);
    q('#admRecent').innerHTML = logRows(lg || [], {});
  }

  /* ---------------- Orders & payouts ---------------- */
  const ORDER_FILTERS = [['problems', 'Needs attention'], ['all', 'All'], ['paid', 'Paid'], ['shipped', 'Sent'], ['completed', 'Completed'], ['refunded', 'Refunded'], ['on_hold', 'On hold'], ['cancelled', 'Cancelled']];
  async function orders(area){
    let f = param('f') || 'all', s = param('q') || '', rows = [];
    area.innerHTML = `<p class="muted adm-note">Money stays with Offrava until the order is complete. <b>Hold</b> stops the seller's payout while you check. <b>Complete</b> pays the seller now. <b>Refund</b> gives the buyer everything back (if the seller was paid, the payout is taken back first).</p>
      <div class="adm-bar"><div class="chips">${ORDER_FILTERS.map(([k, t]) => `<button type="button" class="chip ${k === f ? 'on' : ''}" data-of="${k}">${t}</button>`).join('')}</div>
      <div class="adm-tools"><input type="search" id="oq" placeholder="Search item, order #, buyer email, seller" value="${esc(s)}" aria-label="Search orders"><button type="button" class="btn btn-ghost" id="ocsv">⬇ CSV</button></div></div>
      <div id="ot"></div>`;
    const load = async () => {
      q('#ot').innerHTML = '<p class="muted">Loading…</p>';
      rows = await rpc('admin_orders', { p_status: f, p_search: s || null, p_limit: 300 });
      const sum = rows.reduce((a, o) => (a.t += o.total_cents, a.k += (o.status === 'completed' ? o.fee_cents + o.buyer_fee_cents : 0), a), { t: 0, k: 0 });
      q('#ot').innerHTML = `<div class="muted" style="font-size:14px;margin:0 0 8px">${rows.length} orders · ${money(sum.t)} total · ${money(sum.k)} Offrava kept on completed</div>` +
        table(['Order', 'Buyer', 'Seller', 'Money', 'State', 'Actions'], rows.map(o => `<tr>
          <td><a href="#/order?id=${o.id}"><b>${esc(o.title)}</b></a><div class="muted" style="font-size:13px">#${short(o.id)} · ${day(o.created_at)} · ${o.job_id ? 'service' : esc(o.fulfillment)}</div>${o.admin_note ? `<div class="adm-mini">📝 ${esc(o.admin_note)}</div>` : ''}</td>
          <td style="font-size:13px">${esc(o.buyer_name || '—')}<br><span class="muted">${esc(o.buyer_email || '')}</span></td>
          <td style="font-size:13px">${esc(o.seller_name || '—')}</td>
          <td style="font-size:13px;white-space:nowrap"><b>${money(o.total_cents)}</b><br><span class="muted">Offrava ${money(o.fee_cents + o.buyer_fee_cents)}</span><br><span class="muted">Seller ${money(o.payout_cents)}</span></td>
          <td>${tag(o.status, { paid: 'st-go', shipped: 'st-go', completed: 'st-done', refunded: 'st-off', cancelled: 'st-off' }[o.status] || '')}
            ${o.on_hold ? tag('on hold', 'st-wait') : ''}${o.paid_out ? tag('seller paid', 'st-done') : ''}${o.payout_stuck ? tag('payout stuck', 'st-wait') : ''}${o.refund_due ? tag('refund sending', 'st-wait') : ''}${o.return_status ? tag('return: ' + o.return_status, o.return_status === 'escalated' ? 'st-wait' : '') : ''}</td>
          <td><div class="acct-links adm-acts">
            ${o.conversation_id ? `<a class="btn btn-ghost" href="#/admin?s=chats&c=${o.conversation_id}">Chat</a>` : ''}
            ${['paid', 'shipped', 'completed'].includes(o.status) && !o.paid_out ? (o.on_hold ? `<button class="btn btn-ghost" type="button" data-oa="release" data-id="${o.id}">Release</button>` : `<button class="btn btn-ghost" type="button" data-oa="hold" data-id="${o.id}">Hold</button>`) : ''}
            ${['paid', 'shipped'].includes(o.status) ? `<button class="btn btn-ghost" type="button" data-oa="complete" data-id="${o.id}">Complete</button>` : ''}
            ${['paid', 'shipped', 'completed'].includes(o.status) ? `<button class="btn btn-ghost adm-red" type="button" data-oa="refund" data-id="${o.id}">Refund</button>` : ''}
          </div></td></tr>`).join(''));
      rewire = wire; wire();
    };
    const after = async () => { await sb().functions.invoke('orders', { body: { action: 'sync' } }).catch(() => {}); paintBadges(); load(); };
    const wire = () => qa('[data-oa]', area).forEach(b => b.onclick = () => {
      const id = b.dataset.id, a = b.dataset.oa;
      if (a === 'hold') return ask(b, 'Why hold? (e.g. buyer says item is fake)', async (n) => { await rpc('admin_hold_order', { p_order: id, p_hold: true, p_note: n }); after(); }, 'Hold payout');
      if (a === 'release') return ask(b, 'Note (optional)', async (n) => { await rpc('admin_hold_order', { p_order: id, p_hold: false, p_note: n || null }); after(); }, 'Release');
      if (a === 'complete') return ask(b, 'Why complete now?', async (n) => { await rpc('admin_complete_order', { p_order: id, p_note: n }); after(); }, 'Pay seller');
      if (a === 'refund') return ask(b, 'Why refund? Buyer and seller will see this', async (n) => { await rpc('admin_refund_order', { p_order: id, p_note: n }); after(); }, 'Refund in full');
    });
    qa('[data-of]', area).forEach(c => c.onclick = () => { f = c.dataset.of; qa('[data-of]', area).forEach(x => x.classList.toggle('on', x === c)); load(); });
    q('#oq').oninput = debounce((e) => { s = e.target.value.trim(); load(); });
    q('#ocsv').onclick = () => {
      const cols = ['id', 'created_at', 'title', 'status', 'fulfillment', 'total_cents', 'buyer_fee_cents', 'fee_cents', 'payout_cents', 'buyer_email', 'seller_name', 'on_hold', 'paid_out', 'return_status'];
      const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `offrava-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    };
    await load();
  }

  /* ---------------- Fees & settings ---------------- */
  const SETTINGS = [
    ['Seller fees', 'What Offrava keeps from each sale.', [
      ['commission_bps', 'Normal rate (people)', 'pct'], ['business_bps', 'Shops & competing-offer wins', 'pct'], ['service_bps', 'Service jobs (pros)', 'pct'], ['min_fee_cents', 'Smallest fee', 'usd']]],
    ['Buyer protection fee', 'Paid by the buyer on every order ("Offrava Protection").', [
      ['buyer_fee_fixed_cents', 'Fixed part', 'usd'], ['buyer_fee_bps', 'Plus percent of item + delivery', 'pct']]],
    ['Founding sellers', 'Early sellers pay 0% for a while.', [
      ['founding_days', 'Free for (days)', 'int'], ['founding_cap_cents', 'Only on the first … of sales', 'usd']]],
    ['Offrava Pro (photo studio)', '', [
      ['pro_monthly_cents', 'Monthly price', 'usd'], ['pro_per_sale_bps', 'Or extra per sale', 'pct']]],
    ['Orders & returns', '', [
      ['buyer_cancel_minutes', 'Buyer can cancel alone within (minutes)', 'int'], ['auto_complete_pickup_days', 'Pay seller after pickup (days)', 'int'],
      ['auto_complete_ship_days', 'Pay seller after shipping (days)', 'int'], ['seller_reply_days', 'Seller must answer a return within (days)', 'int'],
      ['damaged_return_days', 'Damaged / not as described window (days)', 'int'],
      ['ship_cancel_days', 'Not shipped by day … → cancel & refund', 'int'], ['pickup_cancel_days', 'Not picked up by day … → cancel & refund', 'int'],
      ['service_proof_required', 'Pros must add a photo or video of the finished job before it can be marked done', 'bool'],
      ['moderation_enabled', 'Check every new listing, job, photo, review and question with AI before it goes public', 'bool'],
      ['chat_ai_enabled', 'AI also reads buyer–seller messages for scams, outside deals, harassment and threats (keyword checks always run)', 'bool'],
      ['translate_enabled', 'Translate the app and chats into each person\'s language (AI)', 'bool'],
      ['min_age', 'Minimum age to use Offrava (18 by US law for contracts; 18–21)', 'int']]],
    ['Customer no-show (service pros & delivery)', 'If the pro arrives, waits and can\'t reach the customer, they can close the booking. The pro gets this fee for their time and travel; the rest is refunded.', [
      ['noshow_wait_minutes', 'Pro must wait at least (minutes)', 'int'], ['noshow_fee_bps', 'No-show fee (% of the job price)', 'pct'], ['noshow_min_cents', 'At least', 'usd']]],
    ['Games & software (Makers)', '', [
      ['maker_new_bps', 'Fee in a maker\'s first days', 'pct'], ['maker_new_days', 'Those first days', 'int'], ['maker_bps', 'Fee after that', 'pct'],
      ['digital_buyer_fee_cents', 'Buyer fee per digital order', 'usd'], ['digital_hold_days', 'Pay the maker after (days)', 'int'], ['digital_refund_days', 'Refund if not opened within (days)', 'int']]],
    ['Sales tax', 'Offrava collects sales tax as the marketplace (not each seller). Stripe Tax works out the rate from the buyer\'s address and only charges it where you added a registration in Stripe › Tax › Registrations — to open a new state or country, add it there. Ask a tax adviser before turning this on for real.', [
      ['tax_enabled', 'Collect sales tax at checkout', 'bool'], ['tax_code_goods', 'Tax code — items', 'code'], ['tax_code_services', 'Tax code — service jobs', 'code'],
      ['tax_code_digital', 'Tax code — games & software', 'code'], ['tax_code_fee', 'Tax code — Offrava Protection fee', 'code']]],
    ['Limits', '', [['max_open_requests', 'Open offer requests per buyer', 'int']]],
    ['Support', '', [['support_email', 'Support email shown to users', 'text']]]
  ];
  const toUi = (v, t) => t === 'pct' ? +(v / 100).toFixed(2) : t === 'usd' ? +(v / 100).toFixed(2) : v;
  const toDb = (v, t) => t === 'pct' || t === 'usd' ? Math.round(parseFloat(v) * 100) : t === 'int' ? Math.round(Number(v)) : v;
  async function settings(area){
    const { data: st, error } = await sb().from('platform_settings').select('*').eq('id', 1).single();
    if (error) throw error;
    const field = ([k, label, t]) => t === 'bool' ? `<div class="field adm-bool"><label class="check"><input type="checkbox" id="set_${k}" name="${k}" data-t="bool" ${st[k] ? 'checked' : ''}> <b>${label}</b></label></div>`
      : t === 'code' ? `<div class="field"><label for="set_${k}">${label}</label><input id="set_${k}" name="${k}" data-t="code" value="${esc(st[k] || '')}" pattern="txcd_[0-9]{8}" spellcheck="false"></div>`
      : `<div class="field"><label for="set_${k}">${label}</label><div class="adm-in">${t === 'usd' ? '<span>$</span>' : ''}<input id="set_${k}" name="${k}" data-t="${t}" ${t === 'text' ? 'type="email"' : 'inputmode="decimal"'} value="${esc(toUi(st[k], t))}">${t === 'pct' ? '<span>%</span>' : ''}</div></div>`;
    area.innerHTML = `<form id="setForm" class="adm-set">
      <div class="card adm-example"><b>Example: a $100 item, picked up</b><div id="setEx" class="muted"></div></div>
      ${SETTINGS.map(([g, sub, fs]) => `<fieldset class="card"><legend>${g}</legend>${sub ? `<p class="muted" style="margin:0 0 10px;font-size:14px">${sub}</p>` : ''}<div class="adm-grid">${fs.map(field).join('')}</div></fieldset>`).join('')}
      <fieldset class="card"><legend>Site banner</legend><p class="muted" style="margin:0 0 10px;font-size:14px">A message on top of every page (sale, holiday hours, problem notice). Leave empty to hide it.</p>
        <div class="field"><label for="set_banner_text">Message</label><input id="set_banner_text" name="banner_text" data-t="text" maxlength="200" value="${esc(st.banner_text || '')}" placeholder="e.g. Grand opening in St. Louis — 0% seller fees this month"></div>
        <div class="adm-grid"><div class="field"><label for="set_banner_link">Link (optional)</label><input id="set_banner_link" name="banner_link" data-t="text" value="${esc(st.banner_link || '')}" placeholder="#/sell or https://…"></div>
        <div class="field"><label for="set_banner_kind">Style</label><select id="set_banner_kind" name="banner_kind" data-t="text">${['info', 'promo', 'warning'].map(k => `<option ${k === st.banner_kind ? 'selected' : ''}>${k}</option>`).join('')}</select></div></div></fieldset>
      <div class="adm-save"><button class="btn btn-accent" type="submit">Save changes</button><span class="form-msg" id="setMsg"></span></div></form>`;
    const f = q('#setForm');
    // Sales tax collected (by month and state) — Stripe › Tax › Reports is the official filing source
    (async () => {
      const fs = [...f.querySelectorAll('fieldset')].find(x => x.querySelector('legend')?.textContent === 'Sales tax'); if (!fs) return;
      const { data } = await sb().rpc('admin_tax_summary', { p_months: 6 });
      const box = document.createElement('div'); box.className = 'adm-tax';
      box.innerHTML = data?.length ? `<table class="pol-table"><thead><tr><th>Month</th><th>Where</th><th>Orders</th><th>Taxable sales</th><th>Tax collected</th><th>Refunded tax</th></tr></thead><tbody>
          ${data.map(r => `<tr><td>${esc(r.month)}</td><td>${esc(r.region)}</td><td>${r.orders}</td><td>${money(r.taxable_cents)}</td><td><b>${money(r.tax_cents)}</b></td><td>${r.refunded_tax_cents ? '−' + money(r.refunded_tax_cents) : '—'}</td></tr>`).join('')}</tbody></table>
          <p class="muted" style="font-size:13px;margin:6px 0 0">For filing, use Stripe › Tax › Reports (it has every city and county rate).</p>`
        : '<p class="muted" style="font-size:14px;margin:10px 0 0">No sales tax collected yet.</p>';
      fs.appendChild(box);
    })();
    const val = (k) => { const el = f.elements[k]; return toDb(el.value, el.dataset.t); };
    const ex = () => {
      const item = 10000, bf = val('buyer_fee_fixed_cents') + Math.round(item * val('buyer_fee_bps') / 10000);
      const fee = (bps) => Math.max(val('min_fee_cents'), Math.round(item * bps / 10000));
      q('#setEx').innerHTML = `Buyer pays <b>${money(item + bf)}</b> · Person selling gets <b>${money(item - fee(val('commission_bps')))}</b> · Shop / offer win gets <b>${money(item - fee(val('business_bps')))}</b> · Offrava keeps <b>${money(bf + fee(val('commission_bps')))}</b> (founding sellers: ${money(bf)})`;
    };
    f.oninput = ex; ex();
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'), m = q('#setMsg'); const patch = {};
      for (const el of f.querySelectorAll('[name]')) {
        const t = el.dataset.t, v = t === 'bool' ? el.checked : t === 'code' ? el.value.trim() : toDb(el.value.trim(), t);
        if (!['text', 'bool', 'code'].includes(t) && !Number.isFinite(v)) { m.textContent = el.closest('.field').querySelector('label').textContent + ': enter a number'; m.className = 'form-msg err'; el.focus(); return; }
        if ((st[el.name] ?? (t === 'text' ? '' : null)) !== v) patch[el.name] = v;
      }
      if (!Object.keys(patch).length) { m.textContent = 'No changes.'; m.className = 'form-msg'; return; }
      busy(b, true);
      try { await rpc('admin_update_settings', { p: patch }); Object.assign(st, patch); m.textContent = `Saved ${Object.keys(patch).length} change(s). New orders use them right away.`; m.className = 'form-msg ok'; siteBanner(true); }
      catch (x) { m.textContent = x.message; m.className = 'form-msg err'; }
      busy(b, false);
    };
  }

  /* ---------------- Users ---------------- */
  async function users(area){
    let f = 'all', s = '';
    area.innerHTML = `<div class="adm-bar"><div class="chips">${[['all', 'All'], ['buyers', 'Buyers'], ['sellers', 'Sellers'], ['banned', 'Banned'], ['admins', 'Admins']].map(([k, t]) => `<button type="button" class="chip ${k === f ? 'on' : ''}" data-uf="${k}">${t}</button>`).join('')}</div>
      <div class="adm-tools"><input type="search" id="uq" placeholder="Search name, email, phone, store" aria-label="Search users"></div></div><div id="ut"></div>
      <p class="muted adm-note">A banned person can still sign in and read, but can't buy, sell, post requests, send offers or message. Their listings are paused and seller account suspended. Unban gives everything back.</p>`;
    const load = async () => {
      const rows = await rpc('admin_users', { p_search: s || null, p_filter: f, p_limit: 300 });
      q('#ut').innerHTML = table(['Person', 'Role', 'Activity', 'Joined', 'Status', ''], rows.map(u => `<tr>
        <td><b>${esc(u.full_name || u.seller_name || '—')}</b><div class="muted" style="font-size:13px">${esc(u.email || u.phone || '')}${u.zip ? ' · ' + esc(u.zip) : ''}</div></td>
        <td>${u.is_admin ? tag('Admin', 'st-done') : ''}${u.seller_status ? tag('Seller: ' + u.seller_status) : tag('Buyer')}</td>
        <td style="font-size:13px">${u.buys} buys · ${u.sales} sales<br><span class="${u.reports_against ? 'adm-redtxt' : 'muted'}">${u.reports_against} reports</span> · <span class="muted">${u.returns_opened} returns</span></td>
        <td style="font-size:13px">${day(u.created_at)}</td>
        <td>${u.banned_at ? `${tag('Banned', 'st-wait')}<div class="adm-mini">${esc(u.ban_reason || '')}</div>` : tag('Active', 'st-go')}</td>
        <td><div class="acct-links adm-acts"><a class="btn btn-ghost" href="#/admin?s=orders&q=${encodeURIComponent(u.email || u.full_name || '')}">Orders</a>
          ${u.is_admin ? '' : u.banned_at ? `<button class="btn btn-ghost" type="button" data-unban="${u.id}">Unban</button>` : `<button class="btn btn-ghost adm-red" type="button" data-ban="${u.id}">Ban</button>`}</div></td></tr>`).join(''));
      rewire = wire; wire();
    };
    const wire = () => {
      qa('[data-ban]', area).forEach(b => b.onclick = () => ask(b, 'Reason (kept in the log)', async (r) => { await rpc('admin_ban_user', { p_user: b.dataset.ban, p_reason: r }); paintBadges(); load(); }, 'Ban'));
      qa('[data-unban]', area).forEach(b => b.onclick = async () => { if (!sure(b)) return; busy(b, true); try { await rpc('admin_unban_user', { p_user: b.dataset.unban }); load(); } catch (x) { b.textContent = x.message; } });
    };
    qa('[data-uf]', area).forEach(c => c.onclick = () => { f = c.dataset.uf; qa('[data-uf]', area).forEach(x => x.classList.toggle('on', x === c)); load(); });
    q('#uq').oninput = debounce((e) => { s = e.target.value.trim(); load(); });
    await load();
  }

  /* ---------------- Chats ---------------- */
  async function chats(area){
    const pre = param('c');
    area.innerHTML = `<p class="muted adm-note">Chats are private. Open one only to handle a report or a dispute — you'll be asked why, and every look is saved in the activity log.</p>
      <div class="adm-bar"><div class="adm-tools" style="flex:1"><input type="search" id="cq" placeholder="Search item, buyer, seller, order #" aria-label="Search chats" value="${esc(pre || '')}"></div></div>
      <div class="adm-chat"><div id="cl"></div><div id="cv" class="card adm-chatview"><p class="muted">Pick a chat to review.</p></div></div>`;
    const load = async (s) => {
      const rows = await rpc('admin_conversations', { p_search: s || null, p_limit: 150 });
      q('#cl').innerHTML = rows.length ? rows.map(c => `<button type="button" class="adm-conv" data-cv="${c.id}"><b>${esc(c.title || 'Chat')}</b>
        <span class="muted">${esc(c.buyer_name)} ↔ ${esc(c.seller_name || 'Seller')} · ${c.messages} msgs · ${day(c.last_message_at)}</span>
        <span>${c.disputed ? tag('Dispute', 'st-wait') : ''}${c.reported ? tag('Reported', 'st-wait') : ''}</span></button>`).join('') : '<p class="muted">No chats found.</p>';
      qa('[data-cv]', area).forEach(b => b.onclick = () => openChat(b.dataset.cv));
      if (pre && rows.length === 1) openChat(rows[0].id);
    };
    const openChat = (id) => {
      qa('[data-cv]', area).forEach(b => b.classList.toggle('on', b.dataset.cv === id));
      const v = q('#cv');
      v.innerHTML = `<form class="adm-ask" id="why"><label for="whyIn"><b>Why are you opening this chat?</b></label><input id="whyIn" required maxlength="200" placeholder="e.g. Return dispute on order #1a2b3c4d"><div class="acct-links"><button class="btn btn-dark" type="submit">Open chat</button></div><p class="form-msg"></p></form>`;
      q('#why').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const msgs = await rpc('admin_read_chat', { p_conv: id, p_reason: q('#whyIn').value.trim() });
          const draw = (list) => { v.innerHTML = `<div class="chat-log adm-log">${list.map(m => `<div class="bubble ${m.kind === 'system' ? 'sys' : m.who === 'Seller' ? 'me' : 'them'}"><b style="font-size:12px">${esc(m.who)}</b><br>${esc(m.body)}<small>${stamp(m.created_at)}</small></div>`).join('') || '<p class="muted">No messages.</p>'}</div>
            <form class="adm-post" id="post"><label class="sr" for="postIn">Message both as Offrava support</label><input id="postIn" required maxlength="1500" placeholder="Message both as Offrava support"><button class="btn btn-accent" type="submit">Send</button></form><p class="form-msg" id="postMsg"></p>`;
            const lg = q('.adm-log', v); lg.scrollTop = lg.scrollHeight;
            q('#post').onsubmit = async (ev) => { ev.preventDefault(); const b = q('#post [type=submit]'); busy(b, true);
              try { await rpc('admin_post_message', { p_conv: id, p_body: q('#postIn').value.trim() }); draw(await rpc('admin_read_chat', { p_conv: id, p_reason: 'after posting support message' })); }
              catch (x) { busy(b, false); q('#postMsg').textContent = x.message; q('#postMsg').className = 'form-msg err'; } };
          };
          draw(msgs);
        } catch (x) { const m = q('#why .form-msg'); m.textContent = x.message; m.className = 'form-msg err'; }
      };
      q('#whyIn').focus();
    };
    q('#cq').oninput = debounce((e) => load(e.target.value.trim()));
    await load(pre);
  }

  /* ---------------- Reviews ---------------- */
  async function reviews(area){
    const low = param('low') === '1';
    let qy = sb().from('reviews').select('*').order('created_at', { ascending: false }).limit(250);
    if (low) qy = qy.lte('rating', 2);
    const { data, error } = await qy; if (error) throw error;
    area.innerHTML = `<div class="adm-bar"><div class="chips"><a class="chip ${low ? '' : 'on'}" href="#/admin?s=reviews">All</a><a class="chip ${low ? 'on' : ''}" href="#/admin?s=reviews&low=1">1–2 stars</a></div></div>
      <p class="muted adm-note">Remove a review only if it breaks the rules (insults, personal info, spam, not about the sale). Bad but honest reviews stay.</p>` +
      table(['Review', 'From', 'Item', 'Shown', ''], (data || []).map(r => `<tr>
        <td><span class="adm-stars" aria-label="${r.rating} stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span><div style="font-size:14px;max-width:360px">${esc(r.body) || '<span class="muted">No comment</span>'}</div>${r.reply ? `<div class="adm-mini">Reply: ${esc(r.reply)}</div>` : ''}</td>
        <td style="font-size:13px">${esc(r.author_name)}<br><span class="muted">${r.direction === 'buyer_to_seller' ? 'buyer → seller' : 'seller → buyer'}</span></td>
        <td style="font-size:13px"><a href="#/order?id=${r.order_id}">${esc(r.item_title)}</a><br><span class="muted">${day(r.created_at)}</span></td>
        <td style="font-size:13px">${new Date(r.visible_at) <= new Date() ? 'Public' : 'Hidden until ' + day(r.visible_at)}</td>
        <td><button class="btn btn-ghost adm-red" type="button" data-rv="${r.id}">Remove</button></td></tr>`).join(''));
    rewire = () => qa('[data-rv]', area).forEach(b => b.onclick = () => ask(b, 'Which rule did it break?', async (n) => { await rpc('admin_remove_review', { p_review: Number(b.dataset.rv), p_reason: n }); reviews(area); }, 'Remove'));
    rewire();
  }

  /* ---------------- Offers & quotes ---------------- */
  async function offers(area){
    const kind = param('k') === 'quotes' ? 'quotes' : 'offers';
    const head = `<div class="adm-bar"><div class="chips"><a class="chip ${kind === 'offers' ? 'on' : ''}" href="#/admin?s=offers">Item offers</a><a class="chip ${kind === 'quotes' ? 'on' : ''}" href="#/admin?s=offers&k=quotes">Service quotes</a></div></div>
      <p class="muted adm-note">Remove an offer that is fake, bait (price the seller won't honor), or for a different item. The seller is told it was removed.</p>`;
    if (kind === 'offers') {
      const { data, error } = await sb().from('offers').select('*, offer_requests(query,zip), sellers(display_name), listings(title)').order('created_at', { ascending: false }).limit(250);
      if (error) throw error;
      area.innerHTML = head + table(['Request', 'Offer', 'Seller', 'Status', ''], (data || []).map(o => `<tr>
        <td><b>${esc(o.offer_requests?.query || '—')}</b><div class="muted" style="font-size:13px">ZIP ${esc(o.offer_requests?.zip || '')} · ${day(o.created_at)}</div></td>
        <td style="font-size:14px">${money(o.price_cents)}${o.delivery_cents ? ` + ${money(o.delivery_cents)} delivery` : ''}<div class="muted" style="font-size:13px">${esc(o.listings?.title || '')}</div>${o.is_auto ? tag('⚡ auto') : ''}</td>
        <td style="font-size:13px">${esc(o.sellers?.display_name || '—')}</td><td>${tag(o.status)}</td>
        <td>${['sealed', 'visible'].includes(o.status) ? `<button class="btn btn-ghost adm-red" type="button" data-ro="${o.id}">Remove</button>` : ''}</td></tr>`).join(''));
      rewire = () => qa('[data-ro]', area).forEach(b => b.onclick = () => ask(b, 'Reason (sent to the seller)', async (n) => { await rpc('admin_remove_offer', { p_offer: b.dataset.ro, p_reason: n }); offers(area); }, 'Remove'));
    } else {
      const { data, error } = await sb().from('service_quotes').select('*, service_jobs(title,category,zip), sellers(display_name)').order('created_at', { ascending: false }).limit(250);
      if (error) throw error;
      area.innerHTML = head + table(['Job', 'Quote', 'Pro', 'Status', ''], (data || []).map(o => `<tr>
        <td><b>${esc(o.service_jobs?.title || '—')}</b><div class="muted" style="font-size:13px">${esc(o.service_jobs?.category || '')} · ZIP ${esc(o.service_jobs?.zip || '')} · ${day(o.created_at)}</div></td>
        <td style="font-size:14px">${money(o.price_cents)}<div class="muted" style="font-size:13px;max-width:280px">${esc(o.message)}</div></td>
        <td style="font-size:13px">${esc(o.sellers?.display_name || '—')}</td><td>${tag(o.status)}</td>
        <td>${o.status === 'sealed' ? `<button class="btn btn-ghost adm-red" type="button" data-rq="${o.id}">Remove</button>` : ''}</td></tr>`).join(''));
      rewire = () => qa('[data-rq]', area).forEach(b => b.onclick = () => ask(b, 'Reason (sent to the pro)', async (n) => { await rpc('admin_remove_quote', { p_quote: b.dataset.rq, p_reason: n }); offers(area); }, 'Remove'));
    }
    rewire();
  }

  /* ---------------- Notify users (broadcast) ---------------- */
  async function broadcast(area){
    area.innerHTML = `<div class="adm-2col"><form class="card" id="bcForm">
        <div class="adm-grid"><div class="field"><label for="bcAud">Send to</label><select id="bcAud" name="aud"><option value="all">Everyone</option><option value="buyers">Buyers (not sellers)</option><option value="sellers">Approved sellers</option><option value="providers">Service pros</option><option value="admins">Admins only (test)</option></select></div>
        <div class="field"><label for="bcZip">Only ZIP starting with (optional)</label><input id="bcZip" name="zip" inputmode="numeric" maxlength="5" placeholder="e.g. 631"></div></div>
        <div class="field"><label for="bcTitle">Title</label><input id="bcTitle" name="title" required maxlength="80" placeholder="e.g. Tire week: get 5+ offers in 1 hour"></div>
        <div class="field"><label for="bcBody">Message</label><textarea id="bcBody" name="body" maxlength="300" rows="3" placeholder="Short and useful. People get it in the bell and as a phone notification."></textarea></div>
        <div class="field"><label for="bcLink">Opens</label><select id="bcLink" name="link"><option value="#/">Home</option><option value="#/request">Get offers</option><option value="#/browse">Browse</option><option value="#/services">Services</option><option value="#/sell">Selling</option><option value="#/pro">Offrava Pro</option><option value="custom">Other link…</option></select><input name="custom" placeholder="#/… or https://…" hidden style="margin-top:6px"></div>
        <p class="adm-reach" id="bcReach">…</p>
        <div class="acct-links"><button class="btn btn-accent" type="submit">Send notification</button></div><p class="form-msg" id="bcMsg"></p></form>
      <div><div class="muted" style="font-size:13px;margin-bottom:6px">Preview</div><div class="adm-preview"><div class="adm-pv-i">O</div><div><b id="pvT">Title</b><div id="pvB" class="muted"></div></div></div>
        <h2 class="hub-h">Sent before</h2><div id="bcHist"></div></div></div>
      <p class="muted adm-note">Use it rarely (launches, big updates, safety notices). Too many messages make people turn notifications off.</p>`;
    const f = q('#bcForm');
    const reach = debounce(async () => { try { const n = await rpc('admin_broadcast_count', { p_audience: f.aud.value, p_zip: f.zip.value || null }); q('#bcReach').innerHTML = `Will reach <b>${n}</b> ${n === 1 ? 'person' : 'people'}.`; } catch (x) { q('#bcReach').textContent = x.message; } }, 250);
    f.oninput = () => { q('#pvT').textContent = f.title.value || 'Title'; q('#pvB').textContent = f.body.value; f.custom.hidden = f.link.value !== 'custom'; reach(); };
    f.oninput();
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'), m = q('#bcMsg');
      if (!sure(b, 'Tap again to send now')) return; busy(b, true);
      try {
        const n = await rpc('admin_broadcast', { p_title: f.title.value.trim(), p_body: f.body.value.trim(), p_link: f.link.value === 'custom' ? f.custom.value.trim() : f.link.value, p_audience: f.aud.value, p_zip: f.zip.value || null });
        m.textContent = `Sent to ${n} people. Phone notifications go out within a minute.`; m.className = 'form-msg ok'; f.reset(); f.oninput(); hist();
      } catch (x) { m.textContent = x.message; m.className = 'form-msg err'; }
      delete b.dataset.sure; b.classList.remove('adm-danger'); busy(b, false); b.innerHTML = 'Send notification';
    };
    const hist = async () => {
      const { data } = await sb().from('admin_log').select('*').eq('action', 'broadcast').order('created_at', { ascending: false }).limit(10);
      q('#bcHist').innerHTML = (data || []).map(l => `<div class="adm-histrow"><b>${esc(l.details.title)}</b><span class="muted">${stamp(l.created_at)} · ${esc(l.target)} · ${l.details.sent_to} people</span></div>`).join('') || '<p class="muted">Nothing sent yet.</p>';
    };
    hist();
  }

  /* ---------------- Safe meetup spots ---------------- */
  async function spots(area){
    const { data, error } = await sb().from('meetup_spots').select('*').order('id'); if (error) throw error;
    area.innerHTML = `<p class="muted adm-note">Shown to buyers and sellers on pickup orders. Police "safe exchange zones" are best. Call to confirm hours before adding.</p>
      <form class="card" id="spForm" style="margin-bottom:16px"><input type="hidden" name="id"><div class="adm-grid">
        <div class="field"><label for="spN">Name</label><input id="spN" name="name" required maxlength="80" placeholder="e.g. St. Louis County Police – Safe Exchange"></div>
        <div class="field"><label for="spK">Type</label><select id="spK" name="kind"><option value="police">Police station</option><option value="partner">Partner shop</option><option value="public">Public place</option></select></div></div>
        <div class="field"><label for="spA">Address</label><input id="spA" name="address" required maxlength="160"></div>
        <div class="field"><label for="spT">Notes (hours, where to park)</label><input id="spT" name="notes" maxlength="300"></div>
        <div class="acct-links"><button class="btn btn-accent" type="submit" id="spSave">Add spot</button><button class="btn btn-ghost" type="button" id="spCancel" hidden>Cancel edit</button></div><p class="form-msg" id="spMsg"></p></form>` +
      table(['Spot', 'Type', 'Shown', ''], (data || []).map(s => `<tr><td><b>${esc(s.name)}</b><div class="muted" style="font-size:13px">${esc(s.address)}</div>${s.notes ? `<div class="adm-mini">${esc(s.notes)}</div>` : ''}</td><td>${esc(s.kind)}</td>
        <td><label class="switch"><input type="checkbox" data-spa="${s.id}" ${s.active ? 'checked' : ''} aria-label="Show ${esc(s.name)}"><span></span></label></td>
        <td><div class="acct-links adm-acts"><button class="btn btn-ghost" type="button" data-spe="${s.id}">Edit</button><button class="btn btn-ghost adm-red" type="button" data-spd="${s.id}">Delete</button></div></td></tr>`).join(''));
    const f = q('#spForm'), m = q('#spMsg');
    qa('[data-spa]', area).forEach(c => c.onchange = async () => { await sb().from('meetup_spots').update({ active: c.checked }).eq('id', c.dataset.spa); });
    qa('[data-spe]', area).forEach(b => b.onclick = () => { const s = data.find(x => x.id == b.dataset.spe); ['id', 'name', 'kind', 'address', 'notes'].forEach(k => f.elements[k].value = s[k] ?? ''); q('#spSave').textContent = 'Save spot'; q('#spCancel').hidden = false; f.scrollIntoView({ behavior: 'smooth' }); });
    q('#spCancel').onclick = () => spots(area);
    qa('[data-spd]', area).forEach(b => b.onclick = async () => { if (!sure(b)) return; busy(b, true); await sb().from('meetup_spots').delete().eq('id', b.dataset.spd); spots(area); });
    f.onsubmit = async (e) => {
      e.preventDefault(); const row = { name: f.name.value.trim(), kind: f.kind.value, address: f.address.value.trim(), notes: f.notes.value.trim() };
      const r = f.id.value ? await sb().from('meetup_spots').update(row).eq('id', f.id.value) : await sb().from('meetup_spots').insert(row);
      if (r.error) { m.textContent = r.error.message; m.className = 'form-msg err'; } else spots(area);
    };
  }

  /* ---------------- Activity log ---------------- */
  const ACTION_NAMES = {
    'order.refund': 'Refunded order', 'order.hold': 'Held payout', 'order.release_hold': 'Released payout', 'order.complete': 'Completed order',
    'user.ban': 'Banned user', 'user.unban': 'Unbanned user', 'chat.view': 'Opened chat', 'chat.post': 'Support message', 'broadcast': 'Sent notification',
    'offer.remove': 'Removed offer', 'quote.remove': 'Removed quote', 'review.remove': 'Removed review'
  };
  const actionName = (a) => ACTION_NAMES[a] || a.replace(/_/g, ' ').replace('.', ' · ');
  function detailText(d){
    if (!d) return '';
    if (d.reason || d.note || d.title) return esc(d.reason || d.note || d.title);
    if (d.new) return 'added ' + esc(d.new.title || d.new.name || d.new.key || d.new.slug || '');
    if (d.deleted) return 'deleted ' + esc(d.deleted.title || d.deleted.name || '');
    return Object.entries(d).slice(0, 4).map(([k, v]) => `${esc(k)}: ${esc(JSON.stringify(v?.from))} → <b>${esc(JSON.stringify(v?.to))}</b>`).join('<br>');
  }
  const logRows = (rows, names) => table(['When', 'Admin', 'What', 'Details'], rows.map(l => `<tr><td style="font-size:13px;white-space:nowrap">${stamp(l.created_at)}</td><td style="font-size:13px">${esc(names[l.admin_id] || short(l.admin_id))}</td>
    <td><b style="font-size:14px">${esc(actionName(l.action))}</b><div class="muted" style="font-size:12px">${esc(short(l.target))}</div></td><td style="font-size:13px;max-width:420px;word-break:break-word">${detailText(l.details)}</td></tr>`).join(''));
  async function log(area){
    const { data, error } = await sb().from('admin_log').select('*').order('created_at', { ascending: false }).limit(300); if (error) throw error;
    const ids = [...new Set((data || []).map(l => l.admin_id).filter(Boolean))];
    const names = {}; if (ids.length) { const { data: p } = await sb().from('profiles').select('id,full_name,email').in('id', ids); (p || []).forEach(x => names[x.id] = x.full_name || x.email); }
    area.innerHTML = `<p class="muted adm-note">Every change an admin makes — fees, refunds, bans, ads, features, chat views — is saved here and can't be edited.</p><div class="adm-bar"><div class="adm-tools" style="flex:1"><input type="search" id="lq" placeholder="Filter (e.g. refund, ban, ads)" aria-label="Filter log"></div></div><div id="lt"></div>`;
    const draw = (t) => q('#lt').innerHTML = logRows((data || []).filter(l => !t || (l.action + ' ' + actionName(l.action) + ' ' + JSON.stringify(l.details)).toLowerCase().includes(t)), names);
    draw(''); q('#lq').oninput = (e) => draw(e.target.value.toLowerCase());
  }

  /* ---------------- Site banner + suspended notice (everyone) ---------------- */
  let bannerAt = 0;
  async function siteBanner(force){
    if (!sb()) return;
    let el = q('#siteBanner');
    if (!el) { el = document.createElement('div'); el.id = 'siteBanner'; const top = q('.topbar'); top ? top.after(el) : document.body.prepend(el); }
    const banned = A().profile?.banned_at;
    if (!force && Date.now() - bannerAt < 300000 && el.dataset.done && !banned) return;
    bannerAt = Date.now(); el.dataset.done = 1;
    const { data: st } = await sb().from('platform_settings').select('banner_text,banner_link,banner_kind,support_email').eq('id', 1).maybeSingle();
    const parts = [];
    if (banned) parts.push(`<div class="site-banner warning" role="alert">Your account is suspended, so you can't buy, sell or message right now. ${st?.support_email ? `Questions? <a href="mailto:${esc(st.support_email)}">${esc(st.support_email)}</a>` : ''}</div>`);
    let hidden = ''; try { hidden = sessionStorage.getItem('ofr_banner_x') || ''; } catch (_) {}
    if (st?.banner_text && hidden !== st.banner_text) {
      const safe = st.banner_link && /^(#\/|https:\/\/)/.test(st.banner_link) ? st.banner_link : '';
      parts.push(`<div class="site-banner ${esc(st.banner_kind)}">${safe ? `<a href="${esc(safe)}" ${safe.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(st.banner_text)} →</a>` : esc(st.banner_text)}<button type="button" aria-label="Hide message" data-bx>×</button></div>`);
    }
    el.innerHTML = parts.join('');
    const x = q('[data-bx]', el); if (x) x.onclick = () => { try { sessionStorage.setItem('ofr_banner_x', st.banner_text); } catch (_) {} x.parentElement.remove(); };
  }
  window.addEventListener('offrava:me', () => siteBanner(false));
  window.addEventListener('load', () => setTimeout(() => siteBanner(false), 400));

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/admin'] = [viewAdmin, wireAdmin];
  window.OffravaAdmin = { paintBadges };
})();

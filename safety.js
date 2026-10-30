/* Offrava safety: adults-only check (18+), blocking people, and the "Blocked people" page (#/blocked).
   The database enforces all of it — this file is only the screens. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const errMsg = (e) => String(e?.message || e || 'Something went wrong.');

  /* ---------------- Adults only ---------------- */
  let minAge = null, asking = false;
  async function getMinAge(){
    if (minAge != null) return minAge;
    const { data } = await sb().from('platform_settings').select('min_age').eq('id', 1).maybeSingle();
    minAge = data?.min_age ?? 18; return minAge;
  }
  async function checkAge(){
    const p = A().profile;
    if (!A().user || !p || p.birthdate || p.is_admin || asking || p.deleted_at) return;
    if (/^#\/(terms|privacy|policies|contact|help)/.test(location.hash)) return;   // can still read the rules
    if ((await getMinAge()) <= 0) return;
    asking = true; showAgeSheet();
  }
  function showAgeSheet(){
    const max = new Date(); const iso = max.toISOString().slice(0, 10);
    const back = document.createElement('div'); back.className = 'ps-back age-back';
    back.innerHTML = `<div class="ps-card" role="dialog" aria-modal="true" aria-labelledby="ageH">
      <h2 id="ageH" style="margin:0 0 6px">Confirm your age</h2>
      <p class="muted" style="margin:0 0 14px">Offrava is for adults ${minAge} and over. Enter your date of birth once — it stays private and is never shown to anyone.</p>
      <form id="ageF"><div class="field"><label for="ageD">Date of birth</label><input id="ageD" type="date" required max="${iso}" min="1900-01-01" autocomplete="bday"></div>
      <button class="btn btn-dark btn-lg" type="submit" style="width:100%">Continue</button><p class="form-msg" id="ageM"></p></form>
      <p class="muted" style="font-size:12px;margin:12px 0 0">Read our <a href="#/terms">Terms</a> and <a href="#/privacy">Privacy Policy</a>.</p></div>`;
    document.body.appendChild(back);
    const f = q('#ageF', back);
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); b.disabled = true;
      const v = q('#ageD', back).value;
      const { data, error } = await sb().rpc('profile_set_birthdate', { p_date: v });
      if (error) { b.disabled = false; const m = q('#ageM', back); m.textContent = errMsg(error); m.className = 'form-msg err'; return; }
      if (data?.ok) { A().profile.birthdate = v; back.remove(); asking = false; return; }
      q('.ps-card', back).innerHTML = `<h2 style="margin:0 0 6px">Sorry, Offrava is for adults only</h2>
        <p class="muted">You need to be ${data?.min_age || minAge} or older to use Offrava. We've signed you out.</p>
        <p class="muted" style="font-size:13px">Made a mistake? Email <a href="mailto:support@offrava.com">support@offrava.com</a>.</p>
        <button class="btn btn-dark" type="button" id="ageOk">OK</button>`;
      await sb().auth.signOut();
      q('#ageOk', back).onclick = () => { back.remove(); asking = false; location.hash = '#/'; location.reload(); };
    };
  }
  window.addEventListener('offrava:me', () => { checkAge().catch(() => {}); });
  window.addEventListener('hashchange', () => { checkAge().catch(() => {}); });

  /* ---------------- Block / unblock ---------------- */
  let blocked = null;
  async function loadBlocked(){
    if (!A().user) return new Set();
    if (blocked) return blocked;
    const { data } = await sb().from('user_blocks').select('blocked_id');
    blocked = new Set((data || []).map(r => r.blocked_id)); return blocked;
  }
  // Puts a Block button into `el` for the person `userId`
  async function blockButton(el, userId, name){
    if (!el || !A().user || !userId || userId === A().user.id) return;
    const set = await loadBlocked();
    const paint = () => {
      const on = set.has(userId);
      el.innerHTML = `<button type="button" class="link-btn blk-btn">${on ? 'Unblock' : 'Block'}</button>`;
      el.querySelector('button').onclick = () => on ? toggle(false) : confirmBlock();
    };
    const confirmBlock = () => {
      el.innerHTML = `<span class="blk-ask">Block ${esc(name || 'this person')}? They won't be able to message you, make offers or ask questions, and you won't see their items. They aren't told.
        <button type="button" class="btn btn-dark" data-y>Block</button> <button type="button" class="link-btn" data-n>Cancel</button></span>`;
      el.querySelector('[data-y]').onclick = () => toggle(true);
      el.querySelector('[data-n]').onclick = paint;
    };
    const toggle = async (on) => {
      const { error } = await sb().rpc('user_block', { p_user: userId, p_on: on });
      if (error) { el.innerHTML = `<span class="form-msg err">${esc(errMsg(error))}</span>`; return; }
      on ? set.add(userId) : set.delete(userId);
      if (on) { el.innerHTML = `<span class="form-msg ok">Blocked. You can unblock anytime in <a href="#/blocked">Blocked people</a>.</span>`; }
      else paint();
    };
    paint();
  }

  /* ---------------- #/blocked ---------------- */
  function viewBlocked(){
    if (!A().user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">Sign in to manage blocked people.</p><a class="btn btn-dark" href="#/login">Sign in</a></div></div>`;
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb"><a href="#/me">My Offrava</a> / Blocked people</div><h1>Blocked people</h1>
      <p class="muted">People you block can't message you, send you offers or ask on your items, and their items are hidden from you. They aren't told. To block someone, use <b>Block</b> on their store page or in a chat.</p></div>
      <div class="card list-card" id="blkList"><p class="muted" style="padding:16px">Loading…</p></div></div>`;
  }
  async function wireBlocked(){
    const box = q('#blkList'); if (!box) return;
    const { data, error } = await sb().rpc('my_blocked_users');
    if (error) { box.innerHTML = `<p class="form-msg err" style="padding:16px">${esc(errMsg(error))}</p>`; return; }
    if (!data?.length) { box.innerHTML = '<p class="muted" style="padding:16px;margin:0">You haven\'t blocked anyone.</p>'; return; }
    box.innerHTML = data.map(u => `<div class="blk-row">${window.OffravaAvatar ? OffravaAvatar.html(u.avatar_url, u.name || '?') : ''}<div style="flex:1;min-width:0"><b>${esc(u.name || 'Offrava member')}</b>
      <div class="muted" style="font-size:13px">Blocked ${new Date(u.blocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div></div>
      <button type="button" class="btn btn-ghost" data-ub="${u.user_id}">Unblock</button></div>`).join('');
    box.querySelectorAll('[data-ub]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb().rpc('user_block', { p_user: b.dataset.ub, p_on: false });
      if (error) { b.disabled = false; b.textContent = errMsg(error); return; }
      blocked?.delete(b.dataset.ub); b.closest('.blk-row').remove();
      if (!box.querySelector('.blk-row')) box.innerHTML = '<p class="muted" style="padding:16px;margin:0">You haven\'t blocked anyone.</p>';
    });
  }
  window.addEventListener('offrava:me', () => { blocked = null; });

  /* ---------- Glitch-proof sending ----------
     A form keeps the same id ("client_ref") until it succeeds, so a retry after a dropped connection
     can't create a second listing / request / message — the database refuses the copy and we use the first. */
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  window.OffravaOnce = {
    ref(el){ if (!el) return uuid(); if (!el.dataset.clientRef) el.dataset.clientRef = uuid(); return el.dataset.clientRef; },
    done(el){ if (el) delete el.dataset.clientRef; },
    isCopy(error){ return error && (error.code === '23505') && /client_ref/.test(error.message || error.details || ''); },
    // insert → if it was a retry of something that already went through, return that row instead
    async insert(table, row, el, select = 'id'){
      const ref = this.ref(el);
      let res = await sb().from(table).insert({ ...row, client_ref: ref }).select(select).single();
      if (res.error && this.isCopy(res.error)) res = await sb().from(table).select(select).eq('client_ref', ref).maybeSingle();
      if (!res.error) this.done(el);
      return res;
    }
  };
  // Offline / back online
  const net = () => {
    let bar = document.getElementById('netBar');
    if (navigator.onLine) { if (bar) { bar.textContent = 'Back online ✓'; bar.classList.add('ok'); setTimeout(() => bar.remove(), 1800); } return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'netBar'; bar.className = 'net-bar'; bar.setAttribute('role', 'status'); document.body.appendChild(bar); }
    bar.classList.remove('ok'); bar.textContent = 'You\'re offline. Nothing is lost — payments and messages wait until you\'re back.';
  };
  window.addEventListener('offline', net); window.addEventListener('online', net);
  if (!navigator.onLine) document.addEventListener('DOMContentLoaded', net);

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/blocked'] = [viewBlocked, wireBlocked];
  window.OffravaSafety = { blockButton, checkAge };
})();

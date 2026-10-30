/* Offrava languages.
   1) Everyone picks their language (#/language, the 🌐 button). Signed-in choice is saved to the account.
   2) The app's own words are translated by a professional AI translator once per language and shared (cached) — only words
      from ui-en.json (the real app text), never people's listings or names.
   3) Chat: each message is translated for the other person; "Show original" is always one tap away. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LANGS = [['en','English'],['es','Español'],['ar','العربية'],['zh','中文'],['vi','Tiếng Việt'],['bs','Bosanski'],['fr','Français'],['ko','한국어'],
    ['tl','Tagalog'],['ru','Русский'],['hi','हिन्दी'],['pt','Português'],['de','Deutsch'],['ur','اردو'],['fa','فارسی'],['so','Soomaali'],['sw','Kiswahili'],
    ['ja','日本語'],['tr','Türkçe'],['it','Italiano'],['pl','Polski'],['uk','Українська'],['am','አማርኛ'],['ne','नेपाली'],['my','မြန်မာ']];
  const NAME = Object.fromEntries(LANGS);
  const RTL = new Set(['ar','ur','fa']);
  const store = { get(k){ try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch (_) {} } };

  let lang = store.get('ofr_lang') || 'en';
  if (!NAME[lang]) lang = 'en';
  let dict = new Map(), wl = null, missing = new Set(), timer = null, observer = null, loading = null;
  const orig = new WeakMap(), lastSet = new WeakMap();

  function setDir(){ document.documentElement.lang = lang; document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr'; document.documentElement.classList.toggle('is-rtl', RTL.has(lang)); }
  setDir();

  /* ---------- the app's words ---------- */
  async function loadDict(){
    if (lang === 'en') return;
    try { const c = JSON.parse(store.get('ofr_ui_' + lang) || 'null'); if (c?.map) dict = new Map(Object.entries(c.map)); } catch (_) {}
    try { wl = new Set((await (await fetch('ui-en.json?v=' + (window.OFFRAVA_VERSION || '40'))).json()).strings); } catch (_) { wl = new Set(); }
    if (sb()) {
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await sb().from('ui_strings').select('src,out').eq('lang', lang).range(from, from + 999);
        if (error || !data) break;
        data.forEach(r => dict.set(r.src, r.out));
        if (data.length < 1000) break;
      }
      save();
    }
  }
  const save = () => store.set('ofr_ui_' + lang, JSON.stringify({ at: Date.now(), map: Object.fromEntries(dict) }));
  const NUM = /\$?\d[\d,.:/]*%?(?:\s?(?:mi|AM|PM|am|pm))?/g;
  function tr(text){
    const key = text.replace(/\s+/g, ' ').trim();
    if (!key || !/[A-Za-z]{2}/.test(key)) return null;
    if (dict.has(key)) return dict.get(key);
    const vals = key.match(NUM) || [];
    const tkey = vals.length ? key.replace(NUM, '#') : null;
    if (tkey && dict.has(tkey)) { let i = 0; return dict.get(tkey).replace(/#/g, () => vals[i++] ?? '#'); }
    if (wl && (wl.has(key) || (tkey && wl.has(tkey)))) missing.add(wl.has(key) ? key : tkey);
    return null;
  }
  const SKIP = 'script,style,textarea,code,pre,[data-nt],.chat-log,.notranslate,[contenteditable="true"],.b-txt';
  function pass(root){
    if (lang === 'en' || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (!n.nodeValue.trim() || n.parentElement?.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; for (let n; (n = w.nextNode());) nodes.push(n);
    for (const n of nodes) {
      if (lastSet.get(n) !== n.nodeValue) orig.set(n, n.nodeValue);   // the app changed it: start from its new English
      const src = orig.get(n); const out = tr(src);
      if (out != null) { const lead = src.match(/^\s*/)[0], tail = src.match(/\s*$/)[0]; const v = lead + out + tail; if (n.nodeValue !== v) n.nodeValue = v; lastSet.set(n, v); }
    }
    root.querySelectorAll?.('[placeholder],[title],[aria-label]').forEach(el => {
      if (el.closest(SKIP)) return;
      for (const at of ['placeholder', 'title', 'aria-label']) {
        if (!el.hasAttribute(at)) continue;
        const k = 'i18n' + at.replace(/-./, (m) => m[1].toUpperCase());
        const cur = el.getAttribute(at);
        if (el.dataset[k + 'Out'] !== cur) el.dataset[k] = cur;
        const out = tr(el.dataset[k]);
        if (out != null && cur !== out) { el.setAttribute(at, out); el.dataset[k + 'Out'] = out; }
      }
    });
    if (missing.size && !timer) timer = setTimeout(fetchMissing, 350);
  }
  async function fetchMissing(){
    timer = null;
    const strings = [...missing].slice(0, 120); strings.forEach(s => missing.delete(s));
    if (!strings.length || !sb()) return;
    document.documentElement.classList.add('i18n-busy');
    try {
      const { data } = await sb().functions.invoke('translate', { body: { ui: { lang, strings } } });
      Object.entries(data?.map || {}).forEach(([k, v]) => dict.set(k, v));
      save(); run();
    } catch (_) {} finally { document.documentElement.classList.remove('i18n-busy'); if (missing.size) timer = setTimeout(fetchMissing, 600); }
  }
  function run(){
    if (lang === 'en') return;
    observer?.disconnect();
    pass(document.body);
    if (!document.title.startsWith('Offrava')) { /* keep custom titles */ }
    observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }
  let raf = 0;
  function start(){
    if (lang === 'en') return;
    loading = loadDict().then(run);
    observer = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run(); }); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  }

  /* ---------- choose a language ---------- */
  async function choose(l){
    if (!NAME[l]) return;
    store.set('ofr_lang', l);
    if (A().user && sb()) { try { await sb().rpc('profile_set_lang', { p_lang: l }); } catch (_) {} }
    location.reload();
  }
  // Signed in: the account's language wins (same on phone and computer)
  window.addEventListener('offrava:me', () => {
    const p = A().profile; if (!p || !p.lang) return;
    if (p.lang === lang) return;
    if (p.lang === 'en' && lang !== 'en') { p.lang = lang; sb()?.rpc('profile_set_lang', { p_lang: lang }); return; }   // chose a language before signing in
    store.set('ofr_lang', p.lang); location.reload();                                                                    // the account's language wins
  });
  function viewLang(){
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb"><a href="#/me">My Offrava</a> / Language</div><h1>Language</h1>
      <p class="muted">Use Offrava in your language. Chats are translated automatically for the other person, and you can always see the original.</p></div>
      <div class="lang-grid">${LANGS.map(([k, n]) => `<button type="button" class="lang-btn ${k === lang ? 'on' : ''}" data-l="${k}" lang="${k}" data-nt>${esc(n)}${k === lang ? ' ✓' : ''}</button>`).join('')}</div>
      <p class="muted" style="font-size:13px;margin-top:16px">Translations are made by AI and checked for quality. If something reads oddly, tell us from Help.</p></div>`;
  }
  function wireLang(){ document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => choose(b.dataset.l)); }

  // 🌐 in the top bar
  function globe(){
    const icons = document.querySelector('.top-icons'); if (!icons || document.getElementById('langLink')) return;
    icons.insertAdjacentHTML('afterbegin', `<a href="#/language" class="inbox-btn lang-link" id="langLink" aria-label="Language" data-nt><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>${lang !== 'en' ? `<span class="lang-code">${lang.toUpperCase()}</span>` : ''}</a>`);
  }
  // First visit with a phone/computer set to another language: offer it once
  function offer(){
    if (lang !== 'en' || store.get('ofr_lang_offer')) return;
    const nav = (navigator.languages || [navigator.language || 'en']).map(x => String(x).slice(0, 2).toLowerCase()).find(x => NAME[x] && x !== 'en');
    if (!nav) return;
    const bar = document.createElement('div'); bar.className = 'lang-offer'; bar.setAttribute('data-nt', '');
    bar.innerHTML = `<span lang="${nav}">${esc(NAME[nav])}?</span><button type="button" class="btn btn-dark" data-y>${esc(NAME[nav])}</button><button type="button" class="link-btn" data-n>English</button>`;
    document.body.appendChild(bar);
    bar.querySelector('[data-y]').onclick = () => { store.set('ofr_lang_offer', '1'); choose(nav); };
    bar.querySelector('[data-n]').onclick = () => { store.set('ofr_lang_offer', '1'); bar.remove(); };
  }

  /* ---------- chat translation ---------- */
  const waiting = new Map();   // message id -> bubble
  let ctimer = null, polls = 0;
  const asked = new Set();
  function chat(div, m){
    const me = A().user?.id;
    if (!me || m.sender_id === me) return;
    div.dataset.mid = m.id; waiting.set(m.id, div);
    if (!ctimer) ctimer = setTimeout(fetchChat, 60);
  }
  async function fetchChat(){
    ctimer = null;
    const ids = [...waiting.keys()]; if (!ids.length || !sb()) return;
    const mine = A().profile?.lang || lang;
    const { data } = await sb().from('message_translations').select('message_id,body,src_lang,status').eq('lang', mine).in('message_id', ids);
    const got = new Map((data || []).map(r => [r.message_id, r]));
    let pending = false;
    for (const id of ids) {
      const r = got.get(id), div = waiting.get(id);
      if (!r || r.status === 'same' || r.status === 'failed') { waiting.delete(id); continue; }
      if (r.status === 'pending') {
        pending = true;
        if (!asked.has(id)) { asked.add(id); sb().functions.invoke('translate', { body: { message_id: id } }).catch(() => {}); }
        div.classList.add('tr-wait'); continue;
      }
      waiting.delete(id); show(div, r);
    }
    if (pending && polls++ < 12) ctimer = setTimeout(fetchChat, 1500); else polls = 0;
  }
  const t = (s) => (lang === 'en' ? null : tr(s)) ?? s;
  function show(div, r){
    const box = div.querySelector('.b-txt'); if (!box) return;
    const original = box.innerHTML;
    const translated = esc(r.body).replace(/\n/g, '<br>');
    div.classList.remove('tr-wait');
    box.innerHTML = translated;
    const note = document.createElement('button'); note.type = 'button'; note.className = 'tr-note';
    const from = NAME[r.src_lang] ? ` · ${NAME[r.src_lang]}` : '';
    const label = (o) => o ? t('Original') + ' · ' + t('Show translation') : t('Translated') + from + ' · ' + t('Show original');
    note.textContent = label(false);
    let showing = false;
    note.onclick = () => { showing = !showing; box.innerHTML = showing ? original : translated; note.textContent = label(showing); };
    box.after(note);
  }
  // After sending: start the translation for the other person right away
  function sent(id){ if (id && sb()) sb().functions.invoke('translate', { body: { message_id: id } }).catch(() => {}); }

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/language'] = [viewLang, wireLang];
  window.OffravaI18n = { lang: () => lang, LANGS, chat, sent, choose, refresh: run };
  const boot = () => { globe(); offer(); start(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

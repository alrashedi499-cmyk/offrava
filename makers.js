/* Offrava Makers: games, software, assets and subscriptions sold by the people who made them.
   #/makers (fair shelves) · #/app?id= (product) · #/library (what I bought) · #/maker (developer dashboard)
   plus the admin review tab. Shelves can't be bought: "Fresh makers" rotates every hour so new developers get seen. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + ((c||0)/100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const day = (d) => d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
  const go = (h) => { location.hash = h; };
  const param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
  const flagOn = () => !window.OffravaFlags || window.OffravaFlags.on('makers');
  const yt = (u) => (String(u||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/) || [])[1];
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;
  const rpc = async (fn, args) => { const { data, error } = await sb().rpc(fn, args); if (error) throw error; return data; };

  const KINDS = { game: ['Games', '🎮'], software: ['Software & apps', '💻'], asset: ['3D & art assets', '🧊'], plugin: ['Plugins & mods', '🧩'], template: ['Templates', '📐'], subscription: ['Subscriptions', '🔁'] };
  const PLATFORMS = { windows: 'Windows', mac: 'Mac', linux: 'Linux', web: 'Web', android: 'Android', ios: 'iPhone', roblox: 'Roblox', unity: 'Unity', unreal: 'Unreal', blender: 'Blender', godot: 'Godot', other: 'Other' };
  const DELIVERY = { file: 'Download', key: 'License key', link: 'Private link' };

  const cover = (p, cls='') => `<div class="mk-cover ${cls}">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : `<span aria-hidden="true">${(KINDS[p.kind] || ['', '🎮'])[1]}</span>`}</div>`;
  const card = (p) => `<a class="mk-card" href="#/app?id=${p.id}">${cover(p)}
    <div class="mk-body"><div class="mk-top"><b class="mk-title">${esc(p.title)}</b><span class="mk-price">${money(p.price_cents)}</span></div>
      <div class="muted mk-by">by ${esc(p.maker)}${p.new_maker ? ' <span class="mk-new">New maker</span>' : ''}</div>
      ${p.tagline ? `<div class="mk-tag">${esc(p.tagline)}</div>` : ''}
      <div class="mk-meta">${(p.platforms || []).slice(0, 3).map(x => `<span>${esc(PLATFORMS[x] || x)}</span>`).join('')}${p.reviews ? `<span class="mk-rate">★ ${p.rating} (${p.reviews})</span>` : ''}</div></div></a>`;

  /* ---------------- Hub ---------------- */
  function viewHub(){
    if (!flagOn()) return gate('Games & software isn\'t open yet.', '#/', 'Go home');
    const k = param('kind') || '', s = param('q') || '';
    return `<div class="mk-hero"><div class="wrap">
        <div class="crumb" style="color:#B9BBB0">Offrava Makers</div>
        <h1>Games &amp; software,<br>straight from the people who made them.</h1>
        <p>No paid rankings. New developers get a fair turn on the shelf. Makers keep 90% or more.</p>
        <form class="mk-search" id="mkSearch" role="search"><label class="sr" for="mkq">Search games and software</label><input id="mkq" type="search" placeholder="Search games, apps, 3D models, plugins…" value="${esc(s)}"><button class="btn btn-accent" type="submit">Search</button></form>
      </div></div>
      <div class="wrap">
        <div class="chips mk-kinds"><a href="#/makers" class="${!k ? 'on' : ''}">All</a>${Object.entries(KINDS).map(([key, [t, e]]) => `<a href="#/makers?kind=${key}" class="${k === key ? 'on' : ''}">${e} ${t}</a>`).join('')}</div>
        <div class="mk-filter"><label for="mkPlat">Platform</label><select id="mkPlat"><option value="">Any platform</option>${Object.entries(PLATFORMS).map(([v, t]) => `<option value="${v}" ${param('platform') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div id="mkShelves"><p class="muted">Loading…</p></div>
        <div class="mk-ctas">
          <a class="mk-cta dark" href="#/maker"><b>Are you a developer?</b><span>Sell your game, app or assets here. 5% fee for your first 90 days, then 10%. Most stores take 30%.</span><u>Start selling →</u></a>
          <a class="mk-cta" href="#/service-request?cat=game_dev" data-flag="services"><b>Need something built?</b><span>Describe it once. Developers send sealed, competing quotes — you pick the best.</span><u>Get quotes →</u></a>
        </div>
      </div>`;
  }
  async function wireHub(){
    const box = q('#mkShelves'); if (!box) return;
    const kind = param('kind') || null, s = param('q') || '', plat = param('platform') || null;
    const nav = (extra) => { const p = new URLSearchParams(location.hash.split('?')[1] || ''); Object.entries(extra).forEach(([a, b]) => b ? p.set(a, b) : p.delete(a)); go('#/makers' + (p.toString() ? '?' + p : '')); };
    q('#mkSearch').onsubmit = (e) => { e.preventDefault(); nav({ q: q('#mkq').value.trim() }); };
    q('#mkPlat').onchange = (e) => nav({ platform: e.target.value });
    const shelf = (name, limit) => rpc('maker_shelf', { p_shelf: name, p_kind: kind, p_platform: plat, p_search: s || null, p_limit: limit }).catch(() => []);
    if (s) {
      const all = await shelf('all', 60);
      box.innerHTML = `<div class="sec-row"><h2>Results for “${esc(s)}”</h2><a href="#/makers">Clear</a></div>` + (all.length ? `<div class="mk-grid">${all.map(card).join('')}</div>` : `<div class="card mk-empty">Nothing yet. <a href="#/service-request?cat=game_dev"><b>Ask developers to build it</b></a> and get competing quotes.</div>`);
      return;
    }
    const [fresh, trending, top, cheap, all] = await Promise.all([shelf('fresh', 8), shelf('trending', 8), shelf('top', 8), shelf('cheap', 8), shelf('new', 24)]);
    const row = (title, sub, list) => list.length ? `<section class="mk-shelf"><div class="sec-row"><h2>${title}</h2><small class="muted">${sub}</small></div><div class="mk-row">${list.map(card).join('')}</div></section>` : '';
    box.innerHTML = (fresh.length + all.length === 0)
      ? `<div class="card mk-empty"><b>The shelves are opening soon.</b><p class="muted">Developers are adding their first games and apps. Are you one? <a href="#/maker"><b>Be one of the first</b></a> — first makers get the most attention.</p></div>`
      : row('🌱 Fresh makers', 'New developers — the order changes every hour so everyone gets seen', fresh) +
        row('🔥 Trending', 'Most bought in the last 2 weeks', trending.filter(p => p.sales_count > 0)) +
        row('⭐ Top rated', 'Rated by real buyers', top.filter(p => p.reviews >= 3)) +
        row('💸 Under $5', '', cheap) +
        (all.length ? `<section class="mk-shelf"><div class="sec-row"><h2>Everything new</h2></div><div class="mk-grid">${all.map(card).join('')}</div></section>` : '');
  }

  /* ---------------- Product page ---------------- */
  function viewApp(){ return `<div class="wrap" id="mkApp"><p class="muted" style="padding:40px 0">Loading…</p></div>`; }
  async function wireApp(){
    const el = q('#mkApp'); if (!el) return;
    const id = param('id');
    let d; try { d = await rpc('maker_product', { p_id: id }); } catch (e) { d = null; }
    if (!d) { el.innerHTML = gate('This product isn\'t available.', '#/makers', 'Browse games & software'); return; }
    const p = d.product, m = d.maker, me = A().user?.id;
    const shots = [p.cover_url, ...(p.screenshots || [])].filter(Boolean);
    const vid = yt(p.trailer_url);
    const soldOut = p.delivery === 'key' && d.keys_left === 0;
    const mine = me && me === p.seller_id;
    el.innerHTML = `<div class="page-head"><div class="crumb"><a href="#/makers">Games &amp; software</a> / ${esc((KINDS[p.kind] || [''])[0])}</div></div>
      ${p.status !== 'active' ? `<div class="mk-note">${mine ? `Only you can see this — status: <b>${esc(p.status)}</b>.` : `Status: ${esc(p.status)}`}${p.review_note ? ' ' + esc(p.review_note) : ''}</div>` : ''}
      <div class="mk-detail">
        <div class="mk-media">
          <div class="mk-stage" id="mkStage">${vid ? `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1" title="${esc(p.title)} trailer" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>` : shots[0] ? `<img src="${esc(shots[0])}" alt="${esc(p.title)}">` : cover(p, 'big')}</div>
          ${shots.length + (vid ? 1 : 0) > 1 ? `<div class="mk-thumbs">${vid ? `<button type="button" data-shot="video" aria-label="Play trailer">▶</button>` : ''}${shots.map((u, i) => `<button type="button" data-shot="${i}" aria-label="Screenshot ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}
          <h2 class="hub-h">About</h2><div class="mk-desc">${esc(p.description || p.tagline || 'No description yet.')}</div>
          <h2 class="hub-h">Reviews ${d.rating ? `<small class="muted">★ ${d.rating} · ${d.reviews.length}</small>` : ''}</h2>
          ${d.reviews.length ? d.reviews.map(r => `<div class="mk-review"><span class="mk-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span> <b>${esc(r.author)}</b><p>${esc(r.body)}</p>${r.reply ? `<p class="muted"><b>Maker:</b> ${esc(r.reply)}</p>` : ''}</div>`).join('') : '<p class="muted">No reviews yet. Only people who bought it can review.</p>'}
        </div>
        <aside class="card mk-buy">
          <div class="mk-kind">${(KINDS[p.kind] || ['', ''])[1]} ${esc((KINDS[p.kind] || [''])[0])}</div>
          <h1>${esc(p.title)}</h1>${p.tagline ? `<p class="muted" style="margin-top:0">${esc(p.tagline)}</p>` : ''}
          <div class="mk-bigprice">${money(p.price_cents)}</div>
          ${d.owned ? `<a class="btn btn-dark btn-lg mk-wide" href="#/library">✓ In your library</a>`
            : mine ? `<a class="btn btn-ghost btn-lg mk-wide" href="#/maker?edit=${p.id}">Edit your product</a>`
            : soldOut ? `<button class="btn btn-ghost btn-lg mk-wide" disabled>Sold out — maker is adding keys</button>`
            : `<a class="btn btn-accent btn-lg mk-wide" href="${A().user ? '#/checkout?product=' + p.id : '#/login'}" ${p.status !== 'active' ? 'aria-disabled="true" style="pointer-events:none;opacity:.5"' : ''}>Buy now</a>`}
          <ul class="mk-facts">
            <li><span>Delivery</span><b>${DELIVERY[p.delivery]} · instant</b></li>
            <li><span>Platforms</span><b>${(p.platforms || []).map(x => esc(PLATFORMS[x] || x)).join(', ') || '—'}</b></li>
            <li><span>Version</span><b>${esc(p.version)}</b></li>
            <li><span>Released</span><b>${day(p.approved_at || p.created_at)}</b></li>
            ${p.sales_count ? `<li><span>Sold</span><b>${p.sales_count}</b></li>` : ''}
          </ul>
          <div class="note" style="font-size:14px"><b>Fair refunds.</b> Not opened yet? Refund within 14 days. Doesn't run or not as described? Report it — the maker fixes it or you get your money back.</div>
          <a class="mk-maker" href="#/store?id=${m.id}">${OffravaAvatar.html(m.avatar, m.name || 'M')}<div><b>${esc(m.name)}</b>${m.id_verified ? ' <span class="badge-verified">Verified</span>' : ''}<div class="muted" style="font-size:13px">${m.products} product${m.products === 1 ? '' : 's'} · on Offrava since ${new Date(m.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div></div></a>
          ${p.tags?.length ? `<div class="mk-tags">${p.tags.map(t => `<a href="#/makers?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}</div>` : ''}
          ${!mine && A().user ? `<button type="button" class="link-btn" id="mkRep">Report this product</button><div id="mkRepBox"></div>` : ''}
        </aside>
      </div>`;
    qa('[data-shot]', el).forEach(b => b.onclick = () => {
      q('#mkStage').innerHTML = b.dataset.shot === 'video'
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${vid}?rel=0&autoplay=1" title="Trailer" allow="autoplay; encrypted-media" allowfullscreen></iframe>`
        : `<img src="${esc(shots[+b.dataset.shot])}" alt="${esc(p.title)}">`;
    });
    const rep = q('#mkRep'); if (rep && window.OffravaFeatures?.reportForm) rep.onclick = () => OffravaFeatures.reportForm(q('#mkRepBox'), { seller_id: p.seller_id });
  }

  /* ---------------- Library ---------------- */
  function viewLibrary(){
    if (!A().user) return gate('Sign in to see your library.');
    return `<div class="wrap"><div class="page-head"><div class="crumb">My Offrava / Library</div><h1>My library</h1><p class="muted">Games and software you bought. Download them again any time.</p></div>
      <div id="libList" style="padding-bottom:48px"><p class="muted">Loading…</p></div></div>`;
  }
  async function wireLibrary(){
    const box = q('#libList'); if (!box) return;
    let list; try { list = await rpc('my_library'); } catch (e) { box.innerHTML = `<p class="form-msg err">${esc(e.message)}</p>`; return; }
    if (!list.length) { box.innerHTML = `<div class="card mk-empty">Nothing here yet. <a href="#/makers"><b>Find games &amp; software</b></a> made by independent developers.</div>`; return; }
    const fresh = param('new');
    box.innerHTML = list.map(x => `<div class="card mk-lib ${x.order_id === fresh ? 'mk-flash' : ''}" data-o="${x.order_id}">
        ${cover(x, 'sm')}
        <div class="mk-lib-main"><b>${esc(x.title)}</b><div class="muted" style="font-size:14px">by ${esc(x.maker)} · v${esc(x.version)} · bought ${day(x.bought_at)}</div>
          <div class="acct-links" style="margin-top:10px">
            <button class="btn btn-accent" type="button" data-open>${x.delivery === 'key' ? (x.has_key ? 'Show my key' : 'Key coming soon') : x.delivery === 'link' ? 'Open my link' : 'Download'}</button>
            ${x.conversation_id ? `<a class="btn btn-ghost" href="#/messages?c=${x.conversation_id}">Message maker</a>` : ''}
            <a class="btn btn-ghost" href="#/order?id=${x.order_id}">${x.status === 'completed' ? 'Review / help' : 'Order & help'}</a>
            ${x.refundable ? `<button class="btn btn-ghost" type="button" data-refund>Refund</button>` : ''}
          </div>
          <div class="mk-reveal" hidden></div></div></div>`).join('');
    qa('.mk-lib', box).forEach(c => {
      const id = c.dataset.o, out = q('.mk-reveal', c);
      const open = q('[data-open]', c); if (open) open.onclick = async () => {
        if (open.textContent === 'Key coming soon') { out.hidden = false; out.innerHTML = '<p class="muted">The maker has been asked to add your key. You\'ll get a notification.</p>'; return; }
        busy(open, true);
        try {
          const d = await rpc('digital_open', { p_order: id });
          let html = '';
          if (d.key) html += `<div class="mk-key"><code>${esc(d.key)}</code><button class="btn btn-ghost" type="button" data-copy="${esc(d.key)}">Copy</button></div>`;
          if (d.link) html += `<p><a class="btn btn-dark" href="${esc(d.link)}" target="_blank" rel="noopener">Open link ↗</a></p>`;
          if (d.file_path) {
            const { data: s, error } = await sb().storage.from('digital-files').createSignedUrl(d.file_path, 300, { download: d.file_name || true });
            if (error) throw error;
            html += `<p><a class="btn btn-dark" href="${esc(s.signedUrl)}" download>⬇ ${esc(d.file_name || 'Download file')}${d.file_size ? ` · ${(d.file_size / 1048576).toFixed(1)} MB` : ''}</a> <small class="muted">Link works for 5 minutes. Come back any time for a new one.</small></p>`;
          }
          if (d.instructions) html += `<div class="mk-instr"><b>From the maker:</b><br>${esc(d.instructions)}</div>`;
          out.innerHTML = html || '<p class="muted">Nothing to deliver yet — message the maker.</p>'; out.hidden = false;
          q('[data-refund]', c)?.remove();
          qa('[data-copy]', out).forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy); b.textContent = 'Copied ✓'; });
        } catch (e) { out.hidden = false; out.innerHTML = `<p class="form-msg err">${esc(e.message)}</p>`; }
        busy(open, false);
      };
      const rf = q('[data-refund]', c); if (rf) rf.onclick = async () => {
        if (!rf.dataset.sure) { rf.dataset.sure = 1; rf.textContent = 'Tap again: refund & remove'; return; }
        busy(rf, true);
        try { await rpc('digital_refund', { p_order: id, p_reason: 'Refund before opening' }); await sb().functions.invoke('orders', { body: { action: 'sync' } }).catch(() => {}); wireLibrary(); }
        catch (e) { busy(rf, false); out.hidden = false; out.innerHTML = `<p class="form-msg err">${esc(e.message)}</p>`; }
      };
    });
    if (fresh) q(`[data-o="${fresh}"] [data-open]`)?.focus();
  }

  /* ---------------- Developer dashboard ---------------- */
  function viewMaker(){
    if (!A().user) return gate('Sign in to sell your games and software.');
    if (!flagOn()) return gate('Selling games & software isn\'t open yet.', '#/', 'Go home');
    const s = A().seller;
    if (!s) return gate('<b>Sell your games, apps and assets on Offrava.</b><br>First, set up a seller account — it\'s how you get paid (Stripe handles the bank details). Then add your first product.', '#/seller-apply', 'Set up seller account');
    if (s.status !== 'approved') return gate(`Your seller account is <b>${esc(s.status)}</b>. Once it's approved you can add games and software.`, '#/account', 'See my account');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Selling / Games &amp; software</div><h1>${param('new') || param('edit') ? (param('edit') ? 'Edit product' : 'New product') : 'My games & software'}</h1></div>
      <div id="mkDash" style="padding-bottom:48px"><p class="muted">Loading…</p></div></div>`;
  }
  async function wireMaker(){
    const box = q('#mkDash'); if (!box) return;
    if (param('new') || param('edit')) return productForm(box, param('edit'));
    const [st, { data: list }] = await Promise.all([rpc('maker_stats').catch(() => ({})), sb().from('digital_products').select('*').eq('seller_id', A().user.id).neq('status', 'removed').order('created_at', { ascending: false })]);
    const tagCls = { active: 'st-done', pending: 'st-wait', rejected: 'st-off', paused: 'st-off', draft: 'st-off' };
    box.innerHTML = `<div class="stats4">${[['Products', st.products ?? 0], ['Sales', st.sales ?? 0], ['Paid to you', money(st.earned_cents)], ['On the way', money(st.pending_cents)]].map(([k, v]) => `<div class="stat"><div class="muted">${k}</div><div class="big">${v}</div></div>`).join('')}</div>
      ${st.new_maker ? `<div class="mk-note good">🌱 <b>New maker:</b> you pay only 5% for your first 90 days, and your products appear on the “Fresh makers” shelf.</div>` : ''}
      ${(st.keys_low || []).map(k => `<div class="mk-note">🔑 <b>${esc(k.title)}</b> has ${k.left} key${k.left === 1 ? '' : 's'} left. <a href="#" data-keys="${k.id}"><b>Add keys</b></a></div>`).join('')}
      <div class="acct-links" style="margin:6px 0 16px"><a class="btn btn-accent" href="#/maker?new=1">+ New product</a><a class="btn btn-ghost" href="#/orders?tab=sell">Sales</a><a class="btn btn-ghost" href="#/pro-jobs" data-flag="services">Developer jobs (quotes)</a></div>
      ${(list || []).length ? `<div class="admin-table"><table><thead><tr><th>Product</th><th>Price</th><th>Sold</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => `<tr>
        <td><div style="display:flex;gap:12px;align-items:center">${cover(p, 'xs')}<div><a href="#/app?id=${p.id}"><b>${esc(p.title)}</b></a><div class="muted" style="font-size:13px">${esc((KINDS[p.kind] || [''])[0])} · ${DELIVERY[p.delivery]}</div></div></div></td>
        <td>${money(p.price_cents)}</td><td>${p.sales_count}</td>
        <td><span class="tag ${tagCls[p.status] || ''}">${p.status === 'pending' ? 'in review' : esc(p.status)}</span>${p.review_note ? `<div class="adm-mini">${esc(p.review_note)}</div>` : ''}</td>
        <td><div class="acct-links adm-acts"><a class="btn btn-ghost" href="#/maker?edit=${p.id}">Edit</a>${p.delivery === 'key' ? `<button class="btn btn-ghost" type="button" data-keys="${p.id}">Keys</button>` : ''}
          ${p.status === 'active' ? `<button class="btn btn-ghost" type="button" data-ps="${p.id}" data-v="paused">Pause</button>` : p.status === 'paused' && p.approved_at ? `<button class="btn btn-ghost" type="button" data-ps="${p.id}" data-v="active">Resume</button>` : ''}
          ${!p.sales_count ? `<button class="btn btn-ghost adm-red" type="button" data-pdel="${p.id}">Delete</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div><div id="keysBox"></div>`
      : `<div class="card mk-empty"><b>Add your first product.</b><p class="muted">A game, an app, a pack of 3D models, a plugin… Our team checks it quickly, then it goes live on the Fresh makers shelf.</p><a class="btn btn-accent" href="#/maker?new=1">+ New product</a></div><div id="keysBox"></div>`}`;
    qa('[data-ps]', box).forEach(b => b.onclick = async () => { busy(b, true); await sb().from('digital_products').update({ status: b.dataset.v }).eq('id', b.dataset.ps); wireMaker(); });
    qa('[data-pdel]', box).forEach(b => b.onclick = async () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again'; return; } busy(b, true); await sb().from('digital_products').delete().eq('id', b.dataset.pdel); wireMaker(); });
    qa('[data-keys]', box).forEach(b => b.onclick = (e) => { e.preventDefault(); keysPanel(b.dataset.keys); });
  }
  async function keysPanel(pid){
    const box = q('#keysBox'); if (!box) return;
    const { data: keys } = await sb().from('digital_keys').select('id,key,order_id').eq('product_id', pid).order('id');
    const left = (keys || []).filter(k => !k.order_id).length, used = (keys || []).length - left;
    box.innerHTML = `<form class="card" id="keyF" style="margin-top:16px"><h3 style="margin-top:0">License keys</h3><p class="muted" style="margin-top:0">${left} ready · ${used} given to buyers. Each buyer gets one key, never reused.</p>
      <div class="field"><label for="keyIn">Add keys — one per line</label><textarea id="keyIn" rows="5" placeholder="ABCD-1234-EFGH&#10;IJKL-5678-MNOP"></textarea></div>
      <div class="acct-links"><button class="btn btn-accent" type="submit">Add keys</button><button class="btn btn-ghost" type="button" id="keyX">Close</button></div><p class="form-msg" id="keyM"></p></form>`;
    box.scrollIntoView({ behavior: 'smooth' });
    q('#keyX').onclick = () => box.innerHTML = '';
    q('#keyF').onsubmit = async (e) => {
      e.preventDefault(); const m = q('#keyM'); const b = q('#keyF [type=submit]');
      const have = new Set((keys || []).map(k => k.key));
      const rows = [...new Set(q('#keyIn').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))].filter(k => !have.has(k)).map(key => ({ product_id: pid, key }));
      if (!rows.length) { m.textContent = 'No new keys to add.'; m.className = 'form-msg err'; return; }
      busy(b, true); const { error } = await sb().from('digital_keys').insert(rows); busy(b, false);
      if (error) { m.textContent = error.message; m.className = 'form-msg err'; } else { m.textContent = `Added ${rows.length} key(s).`; m.className = 'form-msg ok'; keysPanel(pid); }
    };
  }

  async function productForm(box, editId){
    const uid = A().user.id;
    let p = { kind: 'game', price_cents: 999, platforms: ['windows'], tags: [], screenshots: [], delivery: 'file', version: '1.0' }, del = {};
    if (editId) {
      const { data } = await sb().from('digital_products').select('*').eq('id', editId).maybeSingle();
      if (!data) { box.innerHTML = '<p class="form-msg err">Product not found.</p>'; return; }
      p = data; const { data: dd } = await sb().from('digital_delivery').select('*').eq('product_id', editId).maybeSingle(); del = dd || {};
    }
    let shots = [...(p.screenshots || [])], coverUrl = p.cover_url || null;
    box.innerHTML = `<form class="mk-form" id="pf" novalidate>
      <div class="card"><h3>What is it?</h3>
        <div class="mk-kindpick">${Object.entries(KINDS).map(([k, [t, e]]) => `<label class="choice"><input type="radio" name="kind" value="${k}" ${p.kind === k ? 'checked' : ''}><span>${e} ${t}</span></label>`).join('')}</div>
        <div class="field"><label for="pfT">Name</label><input id="pfT" name="title" required minlength="3" maxlength="80" value="${esc(p.title || '')}" placeholder="e.g. Rocket Caves"></div>
        <div class="field"><label for="pfTag">One line that sells it</label><input id="pfTag" name="tagline" maxlength="140" value="${esc(p.tagline || '')}" placeholder="e.g. Build a rocket with friends and explore 30 cave levels"></div>
        <div class="field"><label for="pfD">Description</label><textarea id="pfD" name="description" rows="7" maxlength="5000" placeholder="What it is, what's included, system requirements, how to install.">${esc(p.description || '')}</textarea></div>
        <div class="row2"><div class="field"><label for="pfP">Price ($)</label><input id="pfP" name="price" inputmode="decimal" value="${(p.price_cents / 100).toFixed(2)}"><small class="muted" id="pfFee"></small></div>
          <div class="field"><label for="pfV">Version</label><input id="pfV" name="version" maxlength="20" value="${esc(p.version)}"></div></div>
        <div class="field"><label>Works on</label><div class="mk-plats">${Object.entries(PLATFORMS).map(([v, t]) => `<label><input type="checkbox" name="plat" value="${v}" ${(p.platforms || []).includes(v) ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></div>
        <div class="field"><label for="pfTags">Tags (comma separated)</label><input id="pfTags" name="tags" value="${esc((p.tags || []).join(', '))}" placeholder="co-op, horror, low-poly"></div>
      </div>
      <div class="card"><h3>Pictures &amp; trailer</h3>
        <div class="field"><label for="pfC">Cover (wide picture, 1280×720 is perfect)</label><div class="mk-up"><div id="pfCov">${coverUrl ? `<img src="${esc(coverUrl)}" alt="">` : ''}</div><input id="pfC" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></div></div>
        <div class="field"><label for="pfS">Screenshots (up to 6)</label><div class="mk-shots" id="pfShots"></div><input id="pfS" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></div>
        <div class="field"><label for="pfY">YouTube trailer (optional)</label><input id="pfY" name="trailer" value="${esc(p.trailer_url || '')}" placeholder="https://youtube.com/watch?v=…"></div>
      </div>
      <div class="card"><h3>How buyers get it</h3>
        <div class="choices" id="pfDel">${Object.entries({ file: ['Download a file', 'Upload a .zip, installer or asset pack (up to 50 MB here; bigger? use a private link)'], key: ['License key', 'You add keys; each buyer gets one'], link: ['Private link', 'Big game hosted elsewhere, or a sign-up link for your service'] }).map(([k, [t, s]]) => `<label class="choice"><input type="radio" name="delivery" value="${k}" ${p.delivery === k ? 'checked' : ''}><span><b>${t}</b><br><small class="muted">${s}</small></span></label>`).join('')}</div>
        <div data-dv="file"><div class="field"><label for="pfF">File</label>${del.file_name ? `<p class="muted" style="margin:0 0 6px">Current: <b>${esc(del.file_name)}</b>. Choose a new file only to replace it.</p>` : ''}<input id="pfF" type="file"><div class="mk-prog" id="pfProg" hidden><span></span></div></div></div>
        <div data-dv="key"><div class="field"><label for="pfK">Keys — one per line ${editId ? '(adds to your existing keys)' : ''}</label><textarea id="pfK" rows="4" placeholder="ABCD-1234-EFGH"></textarea></div></div>
        <div data-dv="link"><div class="field"><label for="pfL">Private link (shown only to buyers)</label><input id="pfL" value="${esc(del.secret_link || '')}" placeholder="https://…"></div></div>
        <div class="field"><label for="pfI">Instructions after purchase (optional)</label><textarea id="pfI" rows="2" maxlength="2000" placeholder="How to install / activate">${esc(del.instructions || '')}</textarea></div>
      </div>
      <div class="card"><label class="mk-own"><input type="checkbox" id="pfOwn" ${p.made_by_me ? 'checked' : ''}><span>I made this (or own all rights to sell it). It has no viruses, stolen code, or content I'm not allowed to sell. Reselling other people's games, accounts, keys or subscriptions is not allowed.</span></label>
        <div class="acct-links" style="margin-top:16px"><button class="btn btn-accent btn-lg" type="submit" data-st="pending">${editId && p.status === 'active' ? 'Save (quick re-check)' : 'Send for review'}</button><button class="btn btn-ghost" type="submit" data-st="draft">Save draft</button><a class="btn btn-ghost" href="#/maker">Cancel</a></div>
        <p class="form-msg" id="pfMsg" role="status" aria-live="polite"></p></div>
    </form>`;
    const f = q('#pf'), msg = (t, ok) => { const m = q('#pfMsg'); m.textContent = t; m.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
    const dv = () => { const v = f.delivery.value; qa('[data-dv]', f).forEach(x => x.hidden = x.dataset.dv !== v); };
    f.addEventListener('change', (e) => { if (e.target.name === 'delivery') dv(); }); dv();
    const fee = () => { const c = Math.round(parseFloat(f.price.value || 0) * 100); q('#pfFee').textContent = c >= 99 ? `You get about ${money(c - Math.max(50, Math.round(c * 0.05)))} as a new maker (5%), ${money(c - Math.max(50, Math.round(c * 0.10)))} after 90 days (10%).` : 'At least $0.99'; };
    f.price.oninput = fee; fee();
    const drawShots = () => { q('#pfShots').innerHTML = shots.map((u, i) => `<div><img src="${esc(u)}" alt=""><button type="button" data-rm="${i}" aria-label="Remove screenshot">×</button></div>`).join(''); qa('[data-rm]', f).forEach(b => b.onclick = () => { shots.splice(+b.dataset.rm, 1); drawShots(); }); };
    drawShots();
    const upMedia = async (file) => {
      if (file.size > 10 * 1048576) throw new Error('Pictures must be under 10 MB.');
      const path = `${uid}/${crypto.randomUUID()}/${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await sb().storage.from('digital-media').upload(path, file, { contentType: file.type });
      if (error) throw error; return sb().storage.from('digital-media').getPublicUrl(path).data.publicUrl;
    };
    q('#pfC').onchange = async (e) => { const fl = e.target.files[0]; if (!fl) return; try { msg('Uploading cover…', true); coverUrl = await upMedia(fl); q('#pfCov').innerHTML = `<img src="${esc(coverUrl)}" alt="">`; msg(''); } catch (x) { msg(x.message); } };
    q('#pfS').onchange = async (e) => { try { for (const fl of [...e.target.files].slice(0, 6 - shots.length)) { msg('Uploading screenshots…', true); shots.push(await upMedia(fl)); drawShots(); } msg(''); } catch (x) { msg(x.message); } e.target.value = ''; };

    qa('[type=submit]', f).forEach(b => b.onclick = () => f.dataset.st = b.dataset.st);
    f.onsubmit = async (e) => {
      e.preventDefault(); const st = f.dataset.st || 'pending'; const b = f.querySelector(`[data-st="${st}"]`);
      const price = Math.round(parseFloat(String(f.price.value).replace(/[^\d.]/g, '')) * 100);
      const plats = qa('[name=plat]:checked', f).map(x => x.value);
      if (f.title.value.trim().length < 3) return msg('Give it a name (3+ letters).');
      if (!(price >= 99 && price <= 100000)) return msg('Price must be between $0.99 and $1,000.');
      if (st === 'pending') {
        if (!plats.length) return msg('Pick at least one platform.');
        if (!coverUrl) return msg('Add a cover picture — it\'s what people see first.');
        if (!q('#pfOwn').checked) return msg('Please confirm you made it or own the rights.');
        const d = f.delivery.value;
        if (d === 'file' && !del.file_path && !q('#pfF').files[0]) return msg('Choose the file buyers will download.');
        if (d === 'link' && !/^https:\/\//.test(q('#pfL').value.trim())) return msg('Add the private https:// link.');
        if (d === 'key' && !editId && !q('#pfK').value.trim()) return msg('Add at least one key.');
      }
      if (q('#pfY').value.trim() && !yt(q('#pfY').value)) return msg('The trailer must be a YouTube link.');
      busy(b, true);
      try {
        const row = { seller_id: uid, kind: f.kind.value, title: f.title.value.trim(), tagline: f.tagline.value.trim(), description: f.description.value.trim(),
          price_cents: price, platforms: plats, tags: f.tags.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10),
          cover_url: coverUrl, screenshots: shots, trailer_url: q('#pfY').value.trim() || null, version: f.version.value.trim() || '1.0',
          delivery: f.delivery.value, made_by_me: true,   // drafts too: the box is checked again before review
          status: editId && ['active', 'paused'].includes(p.status) && st === 'pending' ? p.status : st };   // small edits (price, tags) stay live; big ones go back to review automatically
        const r = editId ? await sb().from('digital_products').update(row).eq('id', editId).select().single() : await sb().from('digital_products').insert(row).select().single();
        if (r.error) throw r.error;
        const pid = r.data.id;
        const delRow = { product_id: pid, instructions: q('#pfI').value.trim(), secret_link: f.delivery.value === 'link' ? (q('#pfL').value.trim() || null) : null,
          file_path: del.file_path || null, file_name: del.file_name || null, file_size: del.file_size || null };
        const fl = q('#pfF').files[0];
        if (f.delivery.value === 'file' && fl) {
          if (fl.size > 50 * 1048576) throw new Error('This file is over 50 MB. Upload it somewhere private (Google Drive, itch.io, your site) and choose "Private link".');
          q('#pfProg').hidden = false; msg('Uploading your file… keep this page open.', true);
          const path = `${uid}/${crypto.randomUUID()}/${fl.name.replace(/[^\w.-]/g, '_')}`;
          const up = await sb().storage.from('digital-files').upload(path, fl, { contentType: fl.type || 'application/octet-stream' });
          if (up.error) throw up.error;
          if (del.file_path) sb().storage.from('digital-files').remove([del.file_path]);
          Object.assign(delRow, { file_path: path, file_name: fl.name, file_size: fl.size });
        }
        const dr = await sb().from('digital_delivery').upsert(delRow); if (dr.error) throw dr.error;
        if (f.delivery.value === 'key') {
          const keys = [...new Set(q('#pfK').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))].map(key => ({ product_id: pid, key }));
          if (keys.length) { const kr = await sb().from('digital_keys').upsert(keys, { onConflict: 'product_id,key', ignoreDuplicates: true }); if (kr.error) throw kr.error; }
        }
        go('#/maker');
      } catch (x) { busy(b, false); q('#pfProg').hidden = true; msg(x.message); }
    };
  }

  /* ---------------- Home strip ---------------- */
  async function strips(){
    const els = qa('[data-makers-strip]:not([data-done])'); if (!els.length || !sb() || !flagOn()) return;
    els.forEach(e => e.dataset.done = 1);
    const list = await rpc('maker_shelf', { p_shelf: 'fresh', p_limit: 8 }).catch(() => []);
    els.forEach(e => e.innerHTML = list.length
      ? `<div class="sec-row"><h2>🎮 From indie makers</h2><a href="#/makers">See all</a></div><div class="mk-row">${list.map(card).join('')}</div>`
      : `<a class="mk-strip-cta" href="#/makers"><b>🎮 Games &amp; software from indie makers</b><span>Developers: sell here for 5% →</span></a>`);
  }
  new MutationObserver(() => strips()).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

  /* ---------------- Admin: review products ---------------- */
  async function adminMakers(area){
    const { data, error } = await sb().from('digital_products').select('*, sellers(display_name)').neq('status', 'draft').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    const order = { pending: 0, active: 1, paused: 2, rejected: 3, removed: 4 };
    const list = (data || []).sort((a, b) => order[a.status] - order[b.status]);
    const ids = list.filter(p => p.delivery === 'file').map(p => p.id);
    const files = {}; if (ids.length) { const { data: dd } = await sb().from('digital_delivery').select('product_id,file_name,file_size,secret_link'); (dd || []).forEach(d => files[d.product_id] = d); }
    area.innerHTML = `<p class="muted adm-note">Check before approving: it's really theirs (search the title online), the pictures match, the price is honest, nothing adult or hateful, and no resold keys/accounts. Files aren't virus-scanned automatically — for anything strange, download it on a safe computer first (you can, as admin).</p>` +
      `<div class="admin-table"><table><thead><tr><th>Product</th><th>Maker</th><th>Price</th><th>Delivery</th><th>Status</th><th></th></tr></thead><tbody>${list.map(p => `<tr>
        <td><div style="display:flex;gap:12px;align-items:center">${cover(p, 'xs')}<div><a href="#/app?id=${p.id}"><b>${esc(p.title)}</b></a><div class="muted" style="font-size:13px">${esc((KINDS[p.kind] || [''])[0])} · ${day(p.created_at)} · ${(p.platforms || []).map(x => esc(PLATFORMS[x] || x)).join(', ')}</div></div></div></td>
        <td style="font-size:13px"><a href="#/store?id=${p.seller_id}">${esc(p.sellers?.display_name || '—')}</a></td><td>${money(p.price_cents)}</td>
        <td style="font-size:13px">${DELIVERY[p.delivery]}${files[p.id]?.file_name ? `<br><span class="muted">${esc(files[p.id].file_name)}${files[p.id].file_size ? ' · ' + (files[p.id].file_size / 1048576).toFixed(1) + ' MB' : ''}</span>` : ''}${files[p.id]?.secret_link ? `<br><span class="muted">${esc(files[p.id].secret_link.slice(0, 40))}</span>` : ''}</td>
        <td><span class="tag ${p.status === 'pending' ? 'st-wait' : p.status === 'active' ? 'st-done' : 'st-off'}">${esc(p.status)}</span>${p.review_note ? `<div class="adm-mini">${esc(p.review_note)}</div>` : ''}</td>
        <td><div class="acct-links adm-acts" data-row="${p.id}">
          ${p.status !== 'active' && p.status !== 'removed' ? `<button class="btn btn-dark" type="button" data-rv="active">Approve</button>` : ''}
          ${p.status === 'pending' ? `<button class="btn btn-ghost" type="button" data-rv="rejected">Reject</button>` : ''}
          ${p.status === 'active' ? `<button class="btn btn-ghost adm-red" type="button" data-rv="removed">Take down</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No products yet.</td></tr>'}</tbody></table></div>`;
    qa('[data-rv]', area).forEach(b => b.onclick = async () => {
      const cell = b.closest('[data-row]'), id = cell.dataset.row, st = b.dataset.rv;
      const run = async (note) => { await rpc('admin_review_product', { p_product: id, p_status: st, p_note: note || null }); window.OffravaAdmin?.paintBadges(); adminMakers(area); };
      if (st === 'active') { busy(b, true); try { await run(null); } catch (x) { b.textContent = x.message; } return; }
      cell.innerHTML = `<form class="adm-ask"><input required maxlength="300" placeholder="Tell the maker why (they will see it)" aria-label="Reason"><div class="acct-links"><button class="btn btn-dark" type="submit">${st === 'rejected' ? 'Reject' : 'Take down'}</button><button class="btn btn-ghost" type="button">Cancel</button></div><p class="form-msg"></p></form>`;
      const f = q('form', cell); f.querySelector('input').focus();
      f.querySelector('[type=button]').onclick = () => adminMakers(area);
      f.onsubmit = async (e) => { e.preventDefault(); try { await run(f.querySelector('input').value.trim()); } catch (x) { const m = f.querySelector('.form-msg'); m.textContent = x.message; m.className = 'form-msg err'; } };
    });
  }

  window.OffravaMakers = { adminMakers };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  Object.assign(R, {
    '#/makers':  [viewHub, wireHub],
    '#/app':     [viewApp, wireApp],
    '#/library': [viewLibrary, wireLibrary],
    '#/maker':   [viewMaker, wireMaker]
  });
})();

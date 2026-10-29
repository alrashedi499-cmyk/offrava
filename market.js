/* Offrava marketplace: real listings, offer requests, sealed offers, and the admin panel. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + (c/100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const toCents = (v) => Math.round(parseFloat(String(v).replace(/[^\d.]/g,'')) * 100);
  const msg = (id, t, ok) => { const el = q(id); if (el){ el.textContent = t; el.className = 'form-msg ' + (ok ? 'ok' : 'err'); } };
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.textContent; b.textContent = on ? 'Please wait…' : b.dataset.label; };
  const CATS = ['Tires & wheels','Auto parts','Furniture','Appliances','Electronics','Phones','Tools','Home & DIY','Kids & toys','Clothing','Collectibles','Other'];
  const COND = { new:'New', open_box:'Open box', like_new:'Like new', excellent:'Excellent', good:'Good', fair:'Fair', refurbished:'Refurbished' };
  const COND_SCORE = { new:1, open_box:.95, like_new:.9, excellent:.85, refurbished:.85, good:.65, fair:.4 };
  const RET = { no_returns:'No returns', '14_days':'14-day returns', '30_days':'30-day returns' };
  const IMG = '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;
  const left = (iso) => { const s = Math.max(0, (new Date(iso) - Date.now())/1000|0); const h = s/3600|0, m = (s%3600)/60|0; return h ? `${h}h ${m}m left` : (m ? `${m}m left` : 'closing'); };
  const timers = []; const clearTimers = () => { while (timers.length) clearInterval(timers.pop()); };

  /* ======================= Browse (real listings) ======================= */
  function viewBrowse(){
    const p = new URLSearchParams(location.hash.split('?')[1]||'');
    const sel = (v, cur) => v === cur ? 'selected' : '';
    return `<div class="wrap"><div class="page-head"><div class="crumb">Home / Browse</div><h1>${p.get('cat') ? esc(p.get('cat')) : 'Browse'}</h1>
      <p class="muted">Buy now from local sellers — or ask them to compete with offers.</p></div>
      <form class="filters" id="fForm">
        <label class="sr" for="fq">Search</label><input id="fq" type="search" placeholder="Search listings" value="${esc(p.get('q')||'')}">
        <label class="sr" for="fc">Category</label><select id="fc"><option value="">All categories</option>${CATS.map(c=>`<option ${sel(c,p.get('cat'))}>${esc(c)}</option>`).join('')}</select>
        <button class="btn btn-dark" type="submit">Search</button>
      </form>
      <details class="more-filters" ${p.get('cond')||p.get('min')||p.get('max')||p.get('del')||p.get('sort')?'open':''}><summary>Filters &amp; sort</summary>
        <div class="filters" style="margin-top:10px">
          <label class="sr" for="fco">Condition</label><select id="fco"><option value="">Any condition</option><option value="new" ${sel('new',p.get('cond'))}>New</option><option value="used" ${sel('used',p.get('cond'))}>Used</option><option value="refurbished" ${sel('refurbished',p.get('cond'))}>Refurbished</option></select>
          <label class="sr" for="fmin">Min price</label><input id="fmin" inputmode="decimal" placeholder="Min $" value="${esc(p.get('min')||'')}" style="max-width:110px">
          <label class="sr" for="fmax">Max price</label><input id="fmax" inputmode="decimal" placeholder="Max $" value="${esc(p.get('max')||'')}" style="max-width:110px">
          <label class="sr" for="fdel">Delivery</label><select id="fdel"><option value="">Pickup or shipping</option><option value="ship" ${sel('ship',p.get('del'))}>Ships to me</option><option value="free" ${sel('free',p.get('del'))}>Free shipping</option><option value="pickup" ${sel('pickup',p.get('del'))}>Local pickup</option></select>
          <label class="sr" for="fsort">Sort</label><select id="fsort"><option value="new">Newest first</option><option value="low" ${sel('low',p.get('sort'))}>Price: low to high</option><option value="high" ${sel('high',p.get('sort'))}>Price: high to low</option></select>
        </div></details>
      <div id="saveSearch"></div>
      <section style="padding-top:16px;padding-bottom:48px"><div class="products" id="grid"><div class="muted">Loading…</div></div></section></div>`;
  }
  async function wireBrowse(){
    if (!sb()) { q('#grid').innerHTML = '<p class="muted">Can\'t reach the marketplace right now. Check your connection and refresh.</p>'; return; }
    const F = window.OffravaFeatures;
    if (F) await F.loadFavs();
    const f = q('#fForm');
    async function load(){
      let query = sb().from('listings').select('id,title,category,condition,price_cents,photos,zip,pickup,shipping,shipping_cents,return_policy,seller_id,sellers(display_name,rating,review_count,id_verified,payouts_enabled)')
        .eq('status','active').limit(60);
      const t = q('#fq').value.trim(), c = q('#fc').value, cond = q('#fco').value, mn = q('#fmin').value, mx = q('#fmax').value, del = q('#fdel').value, sort = q('#fsort').value;
      if (t) t.split(/\s+/).filter(w => w.length > 1).forEach(w => { query = query.ilike('title', `%${w}%`); });
      if (c) query = query.eq('category', c);
      if (cond === 'new') query = query.in('condition', ['new','open_box']);
      if (cond === 'used') query = query.in('condition', ['like_new','excellent','good','fair']);
      if (cond === 'refurbished') query = query.eq('condition', 'refurbished');
      if (mn) query = query.gte('price_cents', toCents(mn));
      if (mx) query = query.lte('price_cents', toCents(mx));
      if (del === 'ship') query = query.eq('shipping', true);
      if (del === 'free') query = query.eq('shipping', true).eq('shipping_cents', 0);
      if (del === 'pickup') query = query.eq('pickup', true);
      query = sort === 'low' ? query.order('price_cents', { ascending: true }) : sort === 'high' ? query.order('price_cents', { ascending: false }) : query.order('created_at', { ascending: false });
      const ss = q('#saveSearch');
      ss.innerHTML = t ? `<button class="btn btn-ghost" type="button" id="btnSaveS">🔔 Save this search — alert me when a new “${esc(t)}” is listed</button>` : '';
      const bs = q('#btnSaveS'); if (bs) bs.onclick = () => F?.saveSearch(t, c, bs);
      const { data, error } = await query;
      const g = q('#grid');
      if (error) return g.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
      if (!data.length) return g.innerHTML = `<div class="card" style="grid-column:1/-1"><b>No listings yet${t?` for “${esc(t)}”`:''}.</b><p class="muted" style="margin:6px 0 14px">Ask local sellers to send you offers instead.</p><a class="btn btn-accent" href="#/request${t?`?item=${encodeURIComponent(t)}`:''}">Get offers</a></div>`;
      const me = A().user?.id;
      g.innerHTML = data.map(l => `
        <article class="product">
          <a class="thumb" href="#/item?id=${l.id}">${l.photos?.[0] ? `<img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy">` : IMG}${F ? F.heart(l.id) : ''}</a>
          <div class="body">
            <span class="tag">${esc(COND[l.condition]||l.condition)}</span>
            <a class="t" href="#/item?id=${l.id}">${esc(l.title)}</a>
            <div class="meta">${esc(l.sellers?.display_name||'Seller')}${l.sellers?.rating?` · ★${Number(l.sellers.rating).toFixed(1)}`:''}${l.sellers?.id_verified&&l.sellers?.payouts_enabled?' · <b>Verified</b>':''}</div>
            <div class="meta">${l.pickup?'Pickup':''}${l.pickup&&l.shipping?' / ':''}${l.shipping?(l.shipping_cents?`Ships ${money(l.shipping_cents)}`:'Free shipping'):''}</div>
            <div class="price">${money(l.price_cents)}</div>
          </div>
          <div class="actions wrap2">
            ${l.seller_id === me ? '<span class="muted" style="font-size:13px">Your listing</span>' : `<a class="btn btn-dark full" href="#/checkout?listing=${l.id}">Buy now</a>
            <button class="btn btn-ghost" type="button" data-ask="${l.id}">Ask seller</button>
            <a class="btn btn-ghost" href="#/request?item=${encodeURIComponent(l.title)}&cat=${encodeURIComponent(l.category)}">Get offers</a>`}
          </div>
        </article>`).join('');
      g.querySelectorAll('[data-ask]').forEach(b => b.onclick = () => window.OffravaOrders?.askSeller(b.dataset.ask, b));
    }
    f.onsubmit = (e) => { e.preventDefault(); load(); };
    ['#fc','#fco','#fdel','#fsort'].forEach(id => q(id).onchange = load);
    ['#fmin','#fmax'].forEach(id => q(id).onchange = load);
    load();
  }

  /* ======================= Request offers (buyer) ======================= */
  // Structured requests: tires and car parts are described exactly, so offers compare like for like
  const specLine = (sp) => !sp || !sp.kind ? '' : sp.kind === 'tire'
    ? `🛞 ${esc(sp.qty || 4)}× ${esc(sp.size || '')}${sp.install ? ' · installed' : ''}`
    : `🔧 ${esc([sp.year, sp.make, sp.model].filter(Boolean).join(' '))} · ${esc(sp.part || '')}${sp.side ? ' (' + esc(sp.side) + ')' : ''}${sp.vin ? ' · VIN ' + esc(sp.vin) : ''}`;
  function viewRequest(){
    if (!A().user) return gate('Sign in to ask sellers for offers. It takes a minute.');
    const p = new URLSearchParams(location.hash.split('?')[1]||'');
    const cat = p.get('cat') || '';
    return `<div class="wrap"><div class="page-head"><div class="crumb">Home / Get offers</div><h1>What are you looking for?</h1>
      <p class="muted">Sellers who already have it will send you sealed offers.</p></div>
      <div class="flow">
        <form class="card" id="reqForm">
          <div class="quick-cats" role="radiogroup" aria-label="Type of request">
            <label><input type="radio" name="qk" value="Tires & wheels" ${cat==='Tires & wheels'?'checked':''}><span>🛞<b>Tires</b></span></label>
            <label><input type="radio" name="qk" value="Auto parts" ${cat==='Auto parts'?'checked':''}><span>🔧<b>Car part</b></span></label>
            <label><input type="radio" name="qk" value="" ${cat!=='Tires & wheels'&&cat!=='Auto parts'?'checked':''}><span>📦<b>Anything else</b></span></label>
          </div>
          <div id="tireBox" class="spec-box" hidden>
            <div class="row2"><div class="field"><label for="tsize">Tire size <small class="muted">(on the tire's side, e.g. 225/65R17)</small></label><input id="tsize" maxlength="20" placeholder="225/65R17" autocapitalize="characters"></div>
              <div class="field"><label for="tqty">How many</label><select id="tqty"><option>4</option><option>2</option><option>1</option><option>3</option><option>5</option></select></div></div>
            <label class="check"><input type="checkbox" id="tinst"> Include installation</label>
          </div>
          <div id="partBox" class="spec-box" hidden>
            <div class="row2"><div class="field"><label for="pyear">Year</label><input id="pyear" inputmode="numeric" maxlength="4" placeholder="2017"></div>
              <div class="field"><label for="pmake">Make</label><input id="pmake" maxlength="30" placeholder="Nissan"></div></div>
            <div class="row2"><div class="field"><label for="pmodel">Model</label><input id="pmodel" maxlength="40" placeholder="Maxima SR"></div>
              <div class="field"><label for="ppart">Part</label><input id="ppart" maxlength="60" placeholder="Headlight"></div></div>
            <div class="row2"><div class="field"><label for="pside">Side (optional)</label><select id="pside"><option value="">—</option><option>Left (driver)</option><option>Right (passenger)</option><option>Front</option><option>Rear</option><option>Pair</option></select></div>
              <div class="field"><label for="pvin">VIN (optional, best fit)</label><input id="pvin" maxlength="17" autocapitalize="characters" placeholder="17 characters"></div></div>
          </div>
          <div class="field" id="itemField"><label for="item">Item</label><input id="item" maxlength="140" value="${esc(p.get('item')||'')}" placeholder="e.g. Samsung 65&quot; QLED TV, model Q80C"></div>
          <div class="row2">
            <div class="field"><label for="cat">Category</label><select id="cat" required>${CATS.map(c=>`<option ${cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
            <div class="field"><label for="cond">Condition</label><select id="cond"><option value="any">Any</option><option value="new">New</option><option value="like_new">Like new or better</option><option value="good">Good or better</option></select></div>
          </div>
          <p class="reach" id="reach" aria-live="polite"></p>
          <div class="row2">
            <div class="field"><label for="zip">Delivery ZIP</label><input id="zip" required inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${esc(A().profile?.zip||'')}"></div>
            <div class="field"><label for="max">Max budget (optional)</label><input id="max" inputmode="decimal" placeholder="$"></div>
          </div>
          <div class="field"><label for="ful">How do you want it?</label><select id="ful"><option value="any">Pickup or delivery</option><option value="pickup">Pickup only</option><option value="shipping">Shipping only</option></select></div>
          <div class="field"><label>Collect offers for</label><div class="choices">
            ${[['1','1 hour'],['4','4 hours'],['24','24 hours']].map(([v,t])=>`<label class="choice"><input type="radio" name="win" value="${v}" ${v==='4'?'checked':''}><span>${t}</span></label>`).join('')}
          </div></div>
          <div class="form-foot"><span class="muted" style="font-size:14px">Offers stay sealed until time's up, so sellers send their real best price.</span>
            <button class="btn btn-accent btn-lg" type="submit" id="btnReq">Send to sellers</button></div>
          <p id="reqMsg" class="form-msg" role="status" aria-live="polite"></p>
        </form>
        <aside class="card summary"><h3>How it works</h3>
          <div class="sum-line"><span>Who gets it</span><b>Matching local sellers</b></div>
          <div class="sum-line"><span>Offers</span><b>Sealed until time's up</b></div>
          <div class="sum-line"><span>Each seller</span><b>1 offer + 1 lower price</b></div>
          <div class="sum-line"><span>You see</span><b>Best 5 first</b></div>
          <div class="note">Ranked by total price, condition, seller record, speed and returns. Nobody can pay to rank higher.</div>
        </aside>
      </div></div>`;
  }
  function wireRequest(){
    if (A().user) sb().from('user_settings').select('default_window').eq('user_id', A().user.id).maybeSingle().then(({ data }) => {   // the buyer's default from Settings
      const v = { '1h': '1', '4h': '4', '24h': '24' }[data?.default_window]; const r = v && document.querySelector(`input[name="win"][value="${v}"]`); if (r) r.checked = true;
    });
    const f = q('#reqForm'); if (!f) return;
    const kind = () => q('#cat').value === 'Tires & wheels' ? 'tire' : q('#cat').value === 'Auto parts' ? 'part' : '';
    const show = () => {
      const k = kind();
      q('#tireBox').hidden = k !== 'tire'; q('#partBox').hidden = k !== 'part';
      q('#itemField').querySelector('label').textContent = k ? 'Anything else to add? (optional)' : 'Item';
      q('#item').required = !k;
      f.querySelectorAll('[name=qk]').forEach(r => r.checked = r.value === (k ? q('#cat').value : ''));
      reach();
    };
    f.querySelectorAll('[name=qk]').forEach(r => r.onchange = () => { if (r.value) q('#cat').value = r.value; else if (kind()) q('#cat').value = 'Electronics'; show(); });
    q('#cat').onchange = show;
    const specs = () => {
      const k = kind();
      if (k === 'tire') return { kind: 'tire', size: q('#tsize').value.trim().toUpperCase().replace(/\s+/g, ''), qty: Number(q('#tqty').value), install: q('#tinst').checked };
      if (k === 'part') return { kind: 'part', year: q('#pyear').value.trim(), make: q('#pmake').value.trim(), model: q('#pmodel').value.trim(), part: q('#ppart').value.trim(), side: q('#pside').value, vin: q('#pvin').value.trim().toUpperCase() };
      return {};
    };
    const title = (sp) => {
      const extra = q('#item').value.trim();
      if (sp.kind === 'tire') return `${sp.qty}× ${sp.size} tires${sp.install ? ' installed' : ''}${extra ? ' — ' + extra : ''}`;
      if (sp.kind === 'part') return `${[sp.year, sp.make, sp.model].filter(Boolean).join(' ')} ${sp.part}${sp.side ? ' ' + sp.side : ''}${extra ? ' — ' + extra : ''}`.trim();
      return extra;
    };
    // Live: how many local sellers could answer
    let t = null;
    function reach(){
      clearTimeout(t); t = setTimeout(async () => {
        const sp = specs(); const words = sp.kind === 'tire' ? sp.size : title(sp);
        const { data } = await sb().rpc('request_reach', { p_category: q('#cat').value, p_query: words || '' });
        const el = q('#reach'); if (!el) return;
        el.innerHTML = data ? `⚡ <b>${data}</b> local seller${data === 1 ? '' : 's'} already list${data === 1 ? 's' : ''} ${words ? 'this' : 'in ' + esc(q('#cat').value)}` : (words ? 'No exact match listed yet — we\'ll alert every seller in this category.' : '');
      }, 400);
    }
    ['#item','#tsize','#pmake','#pmodel','#ppart','#pyear'].forEach(id => q(id).addEventListener('input', reach));
    show();
    f.onsubmit = async (e) => {
      e.preventDefault(); const sp = specs();
      if (sp.kind === 'tire' && !/^\d{3}\/\d{2}Z?R\d{2}(\.\d)?$/i.test(sp.size)) return msg('#reqMsg', 'Enter the tire size like 225/65R17 (it\'s printed on the side of the tire).');
      if (sp.kind === 'part' && (!sp.make || !sp.model || !sp.part)) return msg('#reqMsg', 'Add the make, model and part.');
      const query = title(sp); if (!query) return msg('#reqMsg', 'Tell sellers what you want.');
      const b = q('#btnReq'); busy(b, true);
      const hours = Number(f.win.value); const max = q('#max').value.trim();
      const { data, error } = await sb().from('offer_requests').insert({
        buyer_id: A().user.id, query: query.slice(0, 140), category: q('#cat').value, condition: q('#cond').value, specs: sp,
        zip: q('#zip').value.trim(), max_budget_cents: max ? toCents(max) : null, fulfillment: q('#ful').value,
        closes_at: new Date(Date.now() + hours*3600e3).toISOString()
      }).select('id').single();
      busy(b, false);
      if (error) return msg('#reqMsg', error.message);
      location.hash = '#/requests?new=' + data.id;
    };
  }

  /* ======================= My requests + ranked offers (buyer) ======================= */
  function viewRequests(){
    if (!A().user) return gate('Sign in to see your requests.');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Home / My requests</div><h1>My requests</h1></div>
      <section style="padding-top:12px"><div id="reqList" style="display:grid;gap:16px"><div class="muted">Loading…</div></div></section></div>`;
  }
  function rank(offers){
    const totals = offers.map(o => o.price_cents + o.delivery_cents); const mn = Math.min(...totals), mx = Math.max(...totals);
    return offers.map(o => {
      const price = mx === mn ? 1 : 1 - ((o.price_cents + o.delivery_cents) - mn) / (mx - mn);
      const cond = COND_SCORE[o.listings?.condition] ?? .6;
      const seller = o.sellers?.rating == null ? .8 : Math.max(0, (o.sellers.rating - 3.5) / 1.5);
      const speed = /today|same/i.test(o.eta_text||'') ? 1 : /tomorrow|1 day/i.test(o.eta_text||'') ? .8 : o.eta_text ? .5 : .5;
      const prot = o.listings?.return_policy === '30_days' ? 1 : o.listings?.return_policy === '14_days' ? .6 : 0;
      return { ...o, score: Math.round(100 * (.45*price + .20*cond + .15*seller + .10*speed + .10*prot)) };
    }).sort((a,b) => b.score - a.score);
  }
  async function wireRequests(){
    clearTimers();
    const box = q('#reqList'); if (!box) return;
    const { data: reqs, error } = await sb().from('offer_requests').select('*').eq('buyer_id', A().user.id).order('created_at',{ascending:false}).limit(30);
    if (error) return box.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    if (!reqs.length) return box.innerHTML = `<div class="card"><b>No requests yet.</b><p class="muted" style="margin:6px 0 14px">Tell sellers what you want and let them compete.</p><a class="btn btn-accent" href="#/request">Get offers</a></div>`;
    box.innerHTML = reqs.map(r => `<div class="card" id="r-${r.id}"><div class="offers-top" style="margin:0 0 8px">
        <div><span class="tag">${esc(r.category||'Any')}</span><h2 style="margin:8px 0 2px;font-size:24px">${esc(r.query)}</h2>
        <div class="muted" style="font-size:14px">${specLine(r.specs) ? specLine(r.specs) + ' · ' : ''}ZIP ${esc(r.zip)}${r.max_budget_cents?` · up to ${money(r.max_budget_cents)}`:''}</div></div>
        ${r.status === 'cancelled' ? '<span class="tag st-off">Cancelled</span>' : r.status === 'accepted' ? '<span class="tag st-done">Purchased ✓</span>' : `<div class="countdown" data-close="${r.closes_at}"><div><div class="big" data-left>${new Date(r.closes_at) > new Date() ? left(r.closes_at) : 'Offers open'}</div><div style="font-size:13px;opacity:.75" data-count>…</div></div></div>`}
      </div><div data-offers></div></div>`).join('');
    for (const r of reqs) {
      const card = q('#r-' + r.id);
      if (r.status === 'cancelled') { card.querySelector('[data-offers]').innerHTML = `<p class="muted" style="margin:0">You cancelled this request.</p>`; continue; }
      if (r.status === 'accepted') {
        const { data: ord } = await sb().from('orders').select('id').eq('request_id', r.id).eq('buyer_id', A().user.id).neq('status', 'pending_payment').order('created_at', { ascending: false }).limit(1);
        card.querySelector('[data-offers]').innerHTML = `<p style="margin:0 0 10px">You bought one of the offers.</p>${ord?.[0] ? `<a class="btn btn-dark" href="#/order?id=${ord[0].id}">View order</a>` : ''}`;
        continue;
      }
      if (new Date(r.closes_at) > new Date()) {
        card.querySelector('[data-offers]').innerHTML = `<button class="link-btn" type="button" data-cancel-req="${r.id}">Cancel this request</button>`;
        card.querySelector('[data-cancel-req]').onclick = async (e) => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again to cancel — sellers stop offering'; return; } const { error: ce } = await sb().rpc('request_cancel', { p_request: r.id }); if (ce) b.textContent = ce.message; else wireRequests(); };
        const { data: n } = await sb().rpc('offer_count', { p_request: r.id });
        card.querySelector('[data-count]').textContent = `${n||0} sealed offer${n===1?'':'s'} so far`;
        timers.push(setInterval(() => { const L = card.querySelector('[data-left]'); if (!L) return; if (new Date(r.closes_at) <= new Date()) { clearTimers(); wireRequests(); } else L.textContent = left(r.closes_at); }, 30000));
      } else {
        const { data: offers } = await sb().from('offers')
          .select('id,price_cents,delivery_cents,eta_text,improved,status,listings(title,condition,return_policy,photos,pickup,shipping),sellers(display_name,rating,sales_count,id_verified,payouts_enabled,seller_type)')
          .eq('request_id', r.id);
        const list = rank(offers || []);
        card.querySelector('[data-count]').textContent = `${list.length} offer${list.length===1?'':'s'}`;
        const area = card.querySelector('[data-offers]');
        if (!list.length) { area.innerHTML = `<p class="muted">No offers this time. Try a wider category or a longer window.</p><a class="btn btn-ghost" href="#/request?item=${encodeURIComponent(r.query)}&cat=${encodeURIComponent(r.category||'')}">Ask again</a>`; continue; }
        const shown = (all) => (all ? list : list.slice(0,5)).map((o,i) => `
          <article class="offer ${i===0?'top':''}">
            <div class="rank">${i+1}</div>
            <div><h3>${esc(o.sellers?.display_name||'Seller')} ${o.sellers?.id_verified&&o.sellers?.payouts_enabled?'<span class="badge-verified">Verified</span>':''}</h3>
              <div class="facts"><span>${esc(o.listings?.title||'')}</span><span>${esc(COND[o.listings?.condition]||'')}</span><span>${esc(o.eta_text||'')}</span><span>${esc(RET[o.listings?.return_policy]||'')}</span></div></div>
            <div class="total"><div class="price">${money(o.price_cents + o.delivery_cents)}</div>
              <small>${o.delivery_cents?`${money(o.price_cents)} + ${money(o.delivery_cents)} delivery`:'No delivery fee'} · + Offrava Protection</small>
              <div class="score">Match score ${o.score}/100</div></div>
            <button class="btn ${i===0?'btn-accent':'btn-ghost'}" type="button" data-accept="${o.id}">Accept offer</button>
          </article>`).join('');
        area.innerHTML = `<div class="offer-list" data-ol>${shown(false)}</div>${list.length>5?`<button class="btn btn-ghost" type="button" data-all style="margin-top:12px">See all ${list.length} offers</button>`:''}`;
        const wireAcc = () => area.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => { location.hash = '#/checkout?offer=' + b.dataset.accept; });
        wireAcc();
        const all = area.querySelector('[data-all]'); if (all) all.onclick = () => { area.querySelector('[data-ol]').innerHTML = shown(true); all.remove(); wireAcc(); };
      }
    }
  }

  /* ======================= Seller dashboard ======================= */
  function viewSell(){
    const a = A();
    if (!a.user) return gate('Sign in to sell on Offrava.');
    if (!a.seller) return gate('Apply to become a seller first. Founding sellers pay 0% for 90 days on their first $1,000.', '#/seller-apply', 'Apply to sell');
    if (a.seller.status !== 'approved') return gate(`Your seller application is <b>${esc(a.seller.status)}</b>. You can finish verification while you wait.`, '#/account', 'Open my account');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Seller dashboard</div><h1>${esc(a.seller.display_name)}</h1>
      <p class="muted">${a.seller.founding?'Founding seller · 0% for 90 days on your first $1,000':''}${a.seller.payouts_enabled?'':' · <a href="#/account"><b>Finish payout setup</b></a> to get paid'} · <a href="#/orders?tab=sell"><b>Sales &amp; orders</b></a></p></div>
      <div class="stats4 sell-stats" id="sellStats"></div>
      <div class="acct-links" style="margin:4px 0 8px"><a class="btn btn-accent" href="#/sell?tab=new">+ List an item</a><a class="btn btn-ghost" href="#/orders?tab=sell">Sales</a><a class="btn btn-ghost" href="#/research">What is it worth?</a><a class="btn btn-ghost" href="#/pro" data-flag="pro">${a.seller.pro_plan ? '★ Pro' : '★ Get Pro photos'}</a><a class="btn btn-ghost" href="#/pro-jobs" data-flag="services">🧰 Service jobs</a><a class="btn btn-ghost" href="#/store?id=${a.user.id}">My store</a></div>
      <div class="seg" role="tablist" style="max-width:520px">
        <button type="button" data-tab="req">Requests for you</button><button type="button" data-tab="lst">My listings</button><button type="button" data-tab="new">Add listing</button>
      </div>
      <section style="padding-top:8px" id="sellArea"></section></div>`;
  }
  async function wireSell(){
    const area = q('#sellArea'); if (!area) return;
    const tabs = document.querySelectorAll('.seg [data-tab]');
    const show = (t) => { tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === t)); ({ req: sellRequests, lst: sellListings, new: sellNew })[t](area); };
    tabs.forEach(b => b.onclick = () => show(b.dataset.tab));
    show(new URLSearchParams(location.hash.split('?')[1]||'').get('tab') || 'req');
    // Overview numbers
    const me = A().user.id;
    const [act, ship, inact] = await Promise.all([
      sb().from('listings').select('id', { count:'exact', head:true }).eq('seller_id', me).eq('status','active'),
      sb().from('orders').select('id', { count:'exact', head:true }).eq('seller_id', me).eq('status','paid'),
      sb().from('listings').select('id', { count:'exact', head:true }).eq('seller_id', me).in('status',['paused','sold'])
    ]);
    const st = q('#sellStats'); if (st) st.innerHTML = [['Active', act.count||0, "#/sell?tab=lst"], ['To ship', ship.count||0, '#/orders?tab=sell'], ['Inactive', inact.count||0, "#/sell?tab=lst"]]
      .map(([k,v,h]) => `<a class="stat" href="${h}"><div class="muted">${k}</div><div class="big">${v}</div></a>`).join('');
  }
  async function myListings(){
    const { data } = await sb().from('listings').select('*').eq('seller_id', A().user.id).order('created_at',{ascending:false});
    return data || [];
  }
  // Put the listing that best fits the request first (same words / same tire size)
  function bestFirst(list, r){
    const compact = (t) => String(t||'').toLowerCase().replace(/[^a-z0-9]/g, '');
    const words = String(r.query||'').toLowerCase().split(/[^a-z0-9/.-]+/).filter(w => w.length > 1);
    const score = (l) => (r.specs?.kind === 'tire' && r.specs.size && compact(l.title).includes(compact(r.specs.size)) ? 100 : 0)
      + (l.category === r.category ? 5 : 0) + words.filter(w => l.title.toLowerCase().includes(w)).length;
    return [...list].sort((a, b) => score(b) - score(a));
  }
  async function sellRequests(area){
    area.innerHTML = '<div class="muted">Loading…</div>';
    let [{ data: reqs, error }, listings] = await Promise.all([sb().rpc('open_requests_for_seller'), myListings()]);
    reqs = reqs || [];
    if (error) return area.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    const active = listings.filter(l => l.status === 'active');
    if (!reqs.length) return area.innerHTML = `<div class="card"><b>No open requests in your categories right now.</b><p class="muted" style="margin:6px 0 0">New buyer requests show up here. Add more listings so you can answer them.</p></div>`;
    if (!active.length) area.insertAdjacentHTML('afterbegin', '');
    area.innerHTML = (!active.length ? `<div class="note" style="margin-bottom:12px">Add an active listing first — offers must come from items you have listed.</div>` : '') + reqs.map(r => `
      <div class="alert ${r.my_offer_id?'':'new'}" id="q-${r.id}">
        <div><div style="font-weight:600;font-size:17px">${r.my_offer_id?'':'<span class="pulse" aria-hidden="true"></span>'}${esc(r.query)}</div>
          ${specLine(r.specs) ? `<div style="font-size:14px;margin:2px 0">${specLine(r.specs)}</div>` : ''}
          <div class="muted" style="font-size:14px">${esc(r.category||'')} · ${esc(r.condition==='any'?'Any condition':(COND[r.condition]||r.condition)+' or better')} · ZIP ${esc(r.zip)} · ${left(r.closes_at)}${r.max_budget_cents?` · budget ${money(r.max_budget_cents)}`:''}</div>
          ${r.my_offer_id?`<div style="font-size:14px;margin-top:4px">Your sealed offer: <b>${money(r.my_offer_cents)}</b>${r.my_offer_auto?' <span class="tag st-go">⚡ auto</span>':''}${r.my_offer_improved?' (improved)':''}</div>`:''}
        </div>
        <form class="inline-form" data-req="${r.id}" data-offer="${r.my_offer_id||''}">
          ${r.my_offer_id ? (r.my_offer_improved ? '<span class="tag">Final offer sent</span>' : `
            <label class="sr" for="p-${r.id}">Lower price</label><input id="p-${r.id}" name="price" inputmode="decimal" placeholder="Lower price $" required>
            <button class="btn btn-dark" type="submit">Improve once</button>`) : `
            <label class="sr" for="l-${r.id}">Your listing</label><select id="l-${r.id}" name="listing" required ${active.length?'':'disabled'}>${bestFirst(active, r).map(l=>`<option value="${l.id}" data-price="${l.price_cents}">${esc(l.title)} — ${money(l.price_cents)}</option>`).join('')}</select>
            <label class="sr" for="p-${r.id}">Price</label><input id="p-${r.id}" name="price" inputmode="decimal" placeholder="Price $" required>
            <label class="sr" for="d-${r.id}">Delivery fee</label><input id="d-${r.id}" name="delivery" inputmode="decimal" placeholder="Delivery $0">
            <label class="sr" for="e-${r.id}">When</label><select id="e-${r.id}" name="eta"><option>Pickup today</option><option>Pickup tomorrow</option><option>Delivery in 1-2 days</option><option>Ships in 1-3 days</option></select>
            <button class="btn btn-dark" type="submit" ${active.length?'':'disabled'}>Send sealed offer</button>`}
        </form>
        <p class="form-msg" data-msg role="status" aria-live="polite" style="grid-column:1/-1;margin:0"></p>
      </div>`).join('');
    area.querySelectorAll('form[data-req]').forEach(f => {
      const sel = f.listing, price = f.price;
      if (sel && price) { const setP = () => price.value = (sel.selectedOptions[0].dataset.price/100).toString(); setP(); sel.onchange = setP; }
      f.onsubmit = async (e) => {
        e.preventDefault(); const b = f.querySelector('button'); const m = f.parentElement.querySelector('[data-msg]'); busy(b, true);
        let res;
        if (f.dataset.offer) res = await sb().from('offers').update({ price_cents: toCents(f.price.value) }).eq('id', f.dataset.offer);
        else res = await sb().from('offers').insert({ request_id: f.dataset.req, seller_id: A().user.id, listing_id: f.listing.value, price_cents: toCents(f.price.value), delivery_cents: f.delivery.value ? toCents(f.delivery.value) : 0, eta_text: f.eta.value });
        busy(b, false);
        if (res.error) { m.textContent = res.error.message; m.className = 'form-msg err'; return; }
        sellRequests(area);
      };
    });
  }
  // Save (or switch off) a listing's auto-offer rule
  async function saveRule(listingId, on, offer, floor){
    if (!on) { await sb().from('listing_offer_rules').update({ enabled: false }).eq('listing_id', listingId); return null; }
    const oc = toCents(offer), fc = toCents(floor);
    if (!(oc > 0) || !(fc > 0)) return 'Set the auto-offer price and the lowest price.';
    if (fc > oc) return 'The lowest price can\'t be above the offer price.';
    const { error } = await sb().from('listing_offer_rules').upsert({ listing_id: listingId, seller_id: A().user.id, enabled: true, offer_cents: oc, floor_cents: fc, updated_at: new Date().toISOString() });
    return error ? error.message : null;
  }
  async function sellListings(area){
    area.innerHTML = '<div class="muted">Loading…</div>';
    const [all, { data: rl }] = await Promise.all([myListings(), sb().from('listing_offer_rules').select('*').eq('seller_id', A().user.id)]);
    const ls = all.filter(l => l.status !== 'removed');
    const rules = Object.fromEntries((rl || []).map(r => [r.listing_id, r]));
    if (!ls.length) return area.innerHTML = `<div class="card"><b>No listings yet.</b><p class="muted" style="margin:6px 0 0">Add your first item — it shows up for buyers and lets you answer requests.</p></div>`;
    area.innerHTML = `<div class="admin-table"><table><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Status</th><th></th></tr></thead><tbody>
      ${ls.map(l=>`<tr id="row-${l.id}"><td><a href="#/item?id=${l.id}"><b>${esc(l.title)}</b></a><div class="muted" style="font-size:13px">${esc(l.category)} · ${esc(COND[l.condition])}</div>${rules[l.id]?.enabled ? `<div style="font-size:12px;margin-top:3px"><span class="tag st-go">⚡ Auto-offer ${money(rules[l.id].offer_cents)} · lowest ${money(rules[l.id].floor_cents)}</span></div>` : ''}</td><td>${money(l.price_cents)}</td><td>${l.quantity}</td><td><span class="tag">${esc(l.status)}</span></td>
      <td><div class="acct-links"><button class="btn btn-ghost" type="button" data-edit="${l.id}">Edit</button>${l.status==='active'?`<button class="btn btn-ghost" type="button" data-st="paused" data-id="${l.id}">Pause</button>`:l.status==='paused'?`<button class="btn btn-ghost" type="button" data-st="active" data-id="${l.id}">Activate</button>`:''}<button class="btn btn-ghost" type="button" data-del="${l.id}">Delete</button></div></td></tr>`).join('')}
      </tbody></table></div>`;
    area.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { busy(b,true); await sb().from('listings').update({ status: b.dataset.st }).eq('id', b.dataset.id); sellListings(area); });
    area.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again to delete'; return; } busy(b,true); await sb().from('listings').update({ status: 'removed' }).eq('id', b.dataset.del); sellListings(area); });
    area.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const l = ls.find(x => x.id === b.dataset.edit), row = q('#row-' + l.id);
      row.innerHTML = `<td colspan="5"><form class="edit-form" data-id="${l.id}">
        <div class="field"><label>Title</label><input name="title" maxlength="120" value="${esc(l.title)}" required></div>
        <div class="row2"><div class="field"><label>Price $</label><input name="price" inputmode="decimal" value="${(l.price_cents/100).toFixed(2)}" required></div>
          <div class="field"><label>Quantity</label><input name="qty" type="number" min="0" value="${l.quantity}"></div></div>
        <div class="row2"><div class="field"><label>Shipping price $ (0 = free)</label><input name="ship" inputmode="decimal" value="${(l.shipping_cents/100).toFixed(2)}"></div>
          <div class="field"><label>Returns</label><select name="ret">${Object.entries(RET).map(([k,v])=>`<option value="${k}" ${k===l.return_policy?'selected':''}>${v}</option>`).join('')}</select></div></div>
        <div class="choices" style="margin-bottom:12px"><label class="choice"><input type="checkbox" name="pk" ${l.pickup?'checked':''}><span>Local pickup</span></label><label class="choice"><input type="checkbox" name="sh" ${l.shipping?'checked':''}><span>I ship it</span></label></div>
        <div class="auto-box"><label class="check"><input type="checkbox" name="ao" ${rules[l.id]?.enabled?'checked':''}> ⚡ <b>Auto-offer</b> on matching buyer requests — even while you sleep</label>
          <div class="row2"><div class="field"><label>Offer price $</label><input name="aop" inputmode="decimal" value="${rules[l.id] ? (rules[l.id].offer_cents/100).toFixed(2) : (l.price_cents/100).toFixed(2)}"></div>
            <div class="field"><label>Lowest you'd take $ (used if the buyer's budget is lower)</label><input name="aof" inputmode="decimal" value="${rules[l.id] ? (rules[l.id].floor_cents/100).toFixed(2) : (l.price_cents*0.9/100).toFixed(2)}"></div></div></div>
        <p class="muted" style="font-size:13px;margin:0 0 10px">Lowering the price alerts everyone who saved this item.</p>
        <div class="acct-links"><button class="btn btn-accent" type="submit">Save</button><button class="btn btn-ghost" type="button" data-cancel>Cancel</button></div><p class="form-msg" data-m></p></form></td>`;
      const f = row.querySelector('form');
      f.querySelector('[data-cancel]').onclick = () => sellListings(area);
      f.onsubmit = async (e) => {
        e.preventDefault(); const sb2 = f.querySelector('[type=submit]'); busy(sb2, true);
        const qty = Number(f.qty.value) || 0;
        const { error } = await sb().from('listings').update({ title: f.title.value.trim(), price_cents: toCents(f.price.value), quantity: qty,
          shipping_cents: f.ship.value ? toCents(f.ship.value) : 0, return_policy: f.ret.value, pickup: f.pk.checked, shipping: f.sh.checked,
          status: qty === 0 ? 'sold' : (l.status === 'sold' ? 'active' : l.status) }).eq('id', l.id);
        if (error) { busy(sb2, false); const m = f.querySelector('[data-m]'); m.textContent = error.message; m.className = 'form-msg err'; return; }
        const rerr = await saveRule(l.id, f.ao.checked, f.aop.value, f.aof.value);
        if (rerr) { busy(sb2, false); const m = f.querySelector('[data-m]'); m.textContent = rerr; m.className = 'form-msg err'; return; }
        sellListings(area);
      };
    });
  }
  // Phone photos can be huge: resize to max 2000px JPEG before upload
  async function shrink(file){
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  }
  function sellNew(area){
    const s = A().seller;
    const p = new URLSearchParams(location.hash.split('?')[1]||'');
    let photos = [];   // File objects, in order
    area.innerHTML = `<form class="card" id="newL" style="max-width:720px">
      <div class="field"><label>Photos (up to 8 — real photos of this item)</label>
        <div class="ph-grid" id="phGrid"></div>
        <label class="btn btn-ghost ph-add" for="lph">📷 Add photos</label><input id="lph" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>
        <small class="muted">Tap ✨ on a photo to remove the background and make it look professional.</small>
        <div class="ai-row" id="aiRow" data-flag="ai_listing" hidden><button type="button" class="btn btn-dark" id="btnAI">🪄 Fill in the listing from my photos</button><small class="muted" id="aiMsg">AI reads your photos and drafts the title, category, condition and description. You check it before publishing.</small></div></div>
      <div class="field"><label for="lt">Title</label><input id="lt" required maxlength="120" placeholder="Brand, model, size — e.g. Samsung 65&quot; QLED Q80C" value="${esc(p.get('title')||'')}"></div>
      <div class="row2">
        <div class="field"><label for="lc">Category</label><select id="lc">${CATS.map(c=>`<option ${s.categories?.[0]===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="lco">Condition</label><select id="lco">${Object.entries(COND).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label for="lp">Price</label><input id="lp" required inputmode="decimal" placeholder="$"><small class="muted"><a href="#/research" id="lpr">What is it worth?</a></small></div>
        <div class="field"><label for="lq">Quantity</label><input id="lq" type="number" min="1" value="1"></div>
      </div>
      <div class="field"><label for="ld">Description</label><textarea id="ld" rows="3" maxlength="2000" placeholder="What it is, its condition, what's included."></textarea></div>
      <div class="field"><label for="lsc">Shipping price (leave empty for free shipping)</label><input id="lsc" inputmode="decimal" placeholder="$0"></div>
      <div class="field"><label for="lr">Returns</label><select id="lr">${Object.entries(RET).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="choices" style="margin-bottom:20px">
        <label class="choice"><input type="checkbox" id="lpk" ${s.offers_pickup?'checked':''}><span>Local pickup</span></label>
        <label class="choice"><input type="checkbox" id="lsh" ${s.offers_shipping?'checked':''}><span>I ship it</span></label>
      </div>
      <div class="auto-box" data-flag="auto_offers"><label class="check"><input type="checkbox" id="lao" checked> ⚡ <b>Auto-offer</b> on matching buyer requests (recommended — you win buyers even while you sleep)</label>
        <div class="row2"><div class="field"><label for="laop">Offer price (empty = listing price)</label><input id="laop" inputmode="decimal" placeholder="$"></div>
          <div class="field"><label for="laof">Lowest you'd take (empty = 90%)</label><input id="laof" inputmode="decimal" placeholder="$"></div></div></div>
      <p class="muted" style="font-size:13px">Damaged or not-as-described items can always be returned, whatever return policy you pick.</p>
      <button class="btn btn-accent btn-lg" type="submit" id="btnL">Publish listing</button>
      <p id="lMsg" class="form-msg" role="status" aria-live="polite"></p></form>`;
    const grid = q('#phGrid');
    const urls = new Map();
    const url = (f) => { if (!urls.has(f)) urls.set(f, URL.createObjectURL(f)); return urls.get(f); };
    function paint(){
      grid.innerHTML = photos.map((f, i) => `<div class="ph"><img src="${url(f)}" alt="Photo ${i+1}">${i===0?'<span class="ph-main">Main</span>':''}
        <button type="button" class="ph-btn edit" data-ed="${i}" aria-label="Edit photo">✨</button><button type="button" class="ph-btn rm" data-rm="${i}" aria-label="Remove photo">✕</button></div>`).join('');
      q('#aiRow').hidden = !photos.length;
      grid.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { photos.splice(Number(b.dataset.rm), 1); paint(); });
      grid.querySelectorAll('[data-ed]').forEach(b => b.onclick = async () => {
        const i = Number(b.dataset.ed); if (!window.OffravaStudio) return;
        const out = await window.OffravaStudio.open(photos[i]); if (out) { photos[i] = out; paint(); }
      });
    }
    q('#lph').onchange = async (e) => {
      const add = [...e.target.files].slice(0, 8 - photos.length); e.target.value = '';
      for (const f of add) { if (f.size > 15*1024*1024) { msg('#lMsg', `${f.name} is too large.`); continue; } photos.push(f); }
      paint();
      // First photo: offer the studio right away (that's the one buyers see)
      if (add.length && photos.length === add.length && window.OffravaStudio) { const out = await window.OffravaStudio.open(photos[0]); if (out) { photos[0] = out; paint(); } }
    };
    // AI draft from photos
    const toData = async (f) => { const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(f)); const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); };
    q('#btnAI').onclick = async () => {
      const b = q('#btnAI'), m = q('#aiMsg'); busy(b, true); m.textContent = 'Reading your photos…'; m.className = 'muted';
      try {
        const images = await Promise.all(photos.slice(0, 4).map(toData));
        const { data, error } = await sb().functions.invoke('ai-listing', { body: { images } });
        let err = error?.message; if (error) { try { const j = await error.context.json(); err = j.error || err; } catch(_){} }
        if (err || data?.error) throw new Error(data?.error || err);
        const d = data.draft, low = (k) => (d.confidence?.[k] ?? 1) < 0.6;
        if (d.not_allowed) { m.textContent = 'This item looks like something Offrava doesn\'t allow. Check the Help page before listing.'; m.className = 'form-msg err'; busy(b, false); return; }
        const set = (id, v, k) => { const el = q(id); if (!el || v == null || v === '') return; el.value = v; el.classList.toggle('ai-check', !!k && low(k)); el.classList.add('ai-filled'); };
        set('#lt', d.title, 'title'); set('#lc', d.category, 'category'); set('#lco', d.condition, 'condition');
        set('#ld', [d.description, (d.details || []).length ? '• ' + d.details.join('\n• ') : ''].filter(Boolean).join('\n\n'));
        const pr = data.price, sug = pr?.sold_avg || pr?.active_avg;
        if (sug && !q('#lp').value) { q('#lp').value = (sug / 100).toFixed(0); q('#lp').classList.add('ai-filled'); }
        m.innerHTML = `Draft ready — <b>check every field</b>${document.querySelector('.ai-check') ? ' (yellow ones especially)' : ''}.${sug ? ` Price is based on ${pr.sold_count ? pr.sold_count + ' real sale' + (pr.sold_count === 1 ? '' : 's') : 'similar listings'} on Offrava.` : ''}`;
        m.className = 'form-msg ok';
      } catch (e) { m.textContent = e.message || 'The AI helper is not available right now.'; m.className = 'form-msg err'; }
      busy(b, false);
    };
    q('#lt').addEventListener('change', () => { q('#lpr').href = '#/research?q=' + encodeURIComponent(q('#lt').value); });
    // Resell something you bought here: copy its details
    const rs = p.get('resell');
    if (rs) (async () => {
      const { data: o } = await sb().from('orders').select('title,condition,item_cents,listing_id,photo,listings(category,return_policy)').eq('id', rs).maybeSingle();
      if (!o) return;
      q('#lt').value = o.title; q('#lco').value = o.condition === 'new' ? 'like_new' : (o.condition || 'good');
      if (o.listings?.category) q('#lc').value = o.listings.category;
      q('#lp').placeholder = `You paid ${money(o.item_cents)}`; q('#lpr').href = '#/research?q=' + encodeURIComponent(o.title);
      msg('#lMsg', 'We copied the details from your purchase. Add your own photos of the item as it is now.', true);
    })();
    q('#newL').onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnL'); busy(b, true);
      const urlsOut = [];
      for (let f of photos) {
        if (f.size > 4*1024*1024) f = await shrink(f);
        const path = `${A().user.id}/${Date.now()}-${(f.name||'photo.jpg').replace(/[^\w.-]/g,'_')}`;
        const up = await sb().storage.from('listing-photos').upload(path, f, { contentType: f.type });
        if (up.error) { busy(b,false); return msg('#lMsg', 'Photo upload failed: ' + up.error.message); }
        urlsOut.push(sb().storage.from('listing-photos').getPublicUrl(path).data.publicUrl);
      }
      const price = toCents(q('#lp').value);
      const { data: made, error } = await sb().from('listings').insert({
        seller_id: A().user.id, title: q('#lt').value.trim(), category: q('#lc').value, condition: q('#lco').value,
        price_cents: price, quantity: Number(q('#lq').value)||1, photos: urlsOut, zip: s.zip, description: q('#ld').value.trim(),
        pickup: q('#lpk').checked, shipping: q('#lsh').checked, return_policy: q('#lr').value,
        shipping_cents: q('#lsc').value.trim() ? toCents(q('#lsc').value) : 0
      }).select('id').single();
      if (!error && q('#lao').checked && window.OffravaFlags?.on('auto_offers') !== false) {
        const op = q('#laop').value.trim() || (price / 100).toFixed(2), fl = q('#laof').value.trim() || (price * 0.9 / 100).toFixed(2);
        const rerr = await saveRule(made.id, true, op, fl);
        if (rerr) { busy(b, false); return msg('#lMsg', 'Listed, but the auto-offer wasn\'t saved: ' + rerr); }
      }
      busy(b, false);
      if (error) return msg('#lMsg', error.message);
      msg('#lMsg', 'Published. It now shows up in Browse.', true); q('#newL').reset(); photos = []; paint();
    };
  }

  /* ======================= Admin panel ======================= */
  function viewAdmin(){
    if (!A().user) return gate('Sign in first.');
    if (!A().profile?.is_admin) return gate('This page is for Offrava admins only.', '#/', 'Go home');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Admin</div><h1>Admin panel</h1></div>
      <h2 class="hub-h" style="margin-top:0">Is "competing offers" working? <small class="muted" style="font-size:14px;font-weight:500">last 30 days</small></h2>
      <div class="metrics" id="metrics"></div>
      <div class="stats4" id="stats"></div>
      <div class="seg admin-tabs" role="tablist">
        <button type="button" class="on" data-at="sellers">Sellers</button><button type="button" data-at="listings">Listings</button><button type="button" data-at="requests">Requests</button><button type="button" data-at="users">Users</button><button type="button" data-at="returns">Returns</button><button type="button" data-at="reports">Reports</button><button type="button" data-at="services">Services</button><button type="button" data-at="ads">Ads</button><button type="button" data-at="inq">Advertisers</button><button type="button" data-at="features">Features</button>
      </div>
      <section style="padding-top:8px;padding-bottom:48px" id="adminArea"></section></div>`;
  }
  async function wireAdmin(){
    const area = q('#adminArea'); if (!area) return;
    sb().rpc('admin_metrics', { p_days: 30 }).then(({ data: m }) => {
      const el = q('#metrics'); if (!el || !m) return;
      const pct = (v) => v == null ? '—' : v + '%';
      el.innerHTML = [
        ['Requests with 2+ offers', pct(m.fill_rate_2), 'Goal 70%', true], ['Requests with 1+ offer', pct(m.fill_rate_1), 'Goal 60%+'],
        ['Time to first offer', m.median_first_offer_min == null ? '—' : m.median_first_offer_min + ' min', 'Goal under 30 min'], ['Request → purchase', pct(m.request_to_purchase), 'Goal 25%'],
        ['Avg offers per request', m.avg_offers ?? '—', m.requests_closed + ' requests closed'], ['Auto-offers', pct(m.auto_offer_share), 'share of all offers'],
        ['Sales (GMV)', money(m.gmv_cents || 0), m.orders + ' orders'], ['Offrava revenue', money(m.revenue_cents || 0), 'refunds ' + pct(m.refund_rate)]
      ].map(([k, v, sub, key]) => `<div class="stat ${key ? 'key' : ''}"><div class="muted">${k}</div><div class="big">${v}</div><small class="muted">${sub}</small></div>`).join('');
    });
    const { data: st, error } = await sb().rpc('admin_stats');
    if (!error) q('#stats').innerHTML = [['Users',st.users],['Sellers waiting',st.sellers_pending],['Approved sellers',st.sellers_approved],['Fully verified',st.sellers_verified],['Active listings',st.listings_active],['Open requests',st.requests_open],['All requests',st.requests_total],['Offers sent',st.offers_total]]
      .map(([k,v])=>`<div class="stat"><div class="muted">${k}</div><div class="big">${v}</div></div>`).join('');
    const tabs = document.querySelectorAll('[data-at]');
    const show = (t) => { tabs.forEach(b => b.classList.toggle('on', b.dataset.at === t)); ({ sellers: aSellers, listings: aListings, requests: aRequests, users: aUsers, ...(window.OffravaAds ? { returns: OffravaAds.adminReturns, reports: OffravaAds.adminReports, ads: OffravaAds.adminAds, inq: OffravaAds.adminInquiries } : {}), ...(window.OffravaServices ? { services: OffravaServices.adminServices, features: OffravaServices.adminFeatures } : {}) })[t](area); };
    tabs.forEach(b => b.onclick = () => show(b.dataset.at)); show('sellers');
  }
  const table = (head, rows) => `<div class="admin-table"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
  const when = (d) => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  async function aSellers(area){
    const { data } = await sb().from('sellers').select('*').order('created_at',{ascending:false});
    const order = { pending:0, approved:1, suspended:2, rejected:3 };
    (data||[]).sort((a,b)=> order[a.status]-order[b.status]);
    area.innerHTML = table(['Seller','Type','Categories','Verification','Status','Actions'], (data||[]).map(s=>`<tr>
      <td><b>${esc(s.display_name)}</b>${s.business_name?`<div class="muted" style="font-size:13px">${esc(s.business_name)}</div>`:''}<div class="muted" style="font-size:13px">ZIP ${esc(s.zip||'—')} · applied ${when(s.created_at)}</div></td>
      <td>${esc(s.seller_type)}</td><td style="font-size:13px">${esc((s.categories||[]).join(', '))}</td>
      <td style="font-size:13px">${s.payouts_enabled?'✓ Payouts':'✗ Payouts'}<br>${s.id_verified?'✓ Photo ID':'✗ Photo ID'}</td>
      <td><span class="tag">${esc(s.status)}</span></td>
      <td><div class="acct-links">${s.status!=='approved'?`<button class="btn btn-dark" type="button" data-s="${s.user_id}" data-v="approved">Approve</button>`:''}${s.status==='pending'?`<button class="btn btn-ghost" type="button" data-s="${s.user_id}" data-v="rejected">Reject</button>`:''}${s.status==='approved'?`<button class="btn btn-ghost" type="button" data-s="${s.user_id}" data-v="suspended">Suspend</button>`:''}</div></td></tr>`).join(''));
    area.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => { if (b.dataset.v !== 'approved' && !confirmInline(b)) return; busy(b,true); const { error } = await sb().rpc('admin_set_seller_status', { p_user: b.dataset.s, p_status: b.dataset.v }); if (error) alertRow(b, error.message); else aSellers(area); });
  }
  function confirmInline(b){ if (b.dataset.sure) return true; b.dataset.sure = '1'; b.textContent = 'Tap again to confirm'; return false; }
  function alertRow(b, t){ b.textContent = t; }
  async function aListings(area){
    const { data } = await sb().from('listings').select('id,title,category,price_cents,status,created_at,sellers(display_name)').order('created_at',{ascending:false}).limit(200);
    area.innerHTML = table(['Item','Seller','Price','Status','Actions'], (data||[]).map(l=>`<tr><td><b>${esc(l.title)}</b><div class="muted" style="font-size:13px">${esc(l.category)} · ${when(l.created_at)}</div></td><td>${esc(l.sellers?.display_name||'—')}</td><td>${money(l.price_cents)}</td><td><span class="tag">${esc(l.status)}</span></td>
      <td>${l.status!=='removed'?`<button class="btn btn-ghost" type="button" data-l="${l.id}" data-v="removed">Remove</button>`:`<button class="btn btn-ghost" type="button" data-l="${l.id}" data-v="active">Restore</button>`}</td></tr>`).join(''));
    area.querySelectorAll('[data-l]').forEach(b => b.onclick = async () => { if (b.dataset.v === 'removed' && !confirmInline(b)) return; busy(b,true); const { error } = await sb().rpc('admin_set_listing_status', { p_listing: b.dataset.l, p_status: b.dataset.v }); if (error) alertRow(b, error.message); else aListings(area); });
  }
  async function aRequests(area){
    const { data } = await sb().from('offer_requests').select('id,query,category,zip,closes_at,status,created_at').order('created_at',{ascending:false}).limit(200);
    const counts = {};
    const { data: offs } = await sb().from('offers').select('request_id');
    (offs||[]).forEach(o => counts[o.request_id] = (counts[o.request_id]||0) + 1);
    area.innerHTML = table(['Request','Category','ZIP','Offers','Window'], (data||[]).map(r=>`<tr><td><b>${esc(r.query)}</b><div class="muted" style="font-size:13px">${when(r.created_at)}</div></td><td>${esc(r.category||'—')}</td><td>${esc(r.zip)}</td><td>${counts[r.id]||0}</td><td>${new Date(r.closes_at)>new Date()?left(r.closes_at):'Closed'}</td></tr>`).join(''));
  }
  async function aUsers(area){
    const { data } = await sb().from('profiles').select('id,full_name,email,phone,zip,is_buyer,is_seller,is_admin,created_at').order('created_at',{ascending:false}).limit(500);
    area.innerHTML = `<div class="filters"><label class="sr" for="us">Search users</label><input id="us" type="search" placeholder="Search name or email"></div>` + `<div id="ut"></div>`;
    const render = (t) => q('#ut').innerHTML = table(['Name','Contact','ZIP','Roles','Joined'], (data||[]).filter(u => !t || `${u.full_name} ${u.email}`.toLowerCase().includes(t)).map(u=>`<tr><td><b>${esc(u.full_name||'—')}</b></td><td style="font-size:13px">${esc(u.email||u.phone||'')}</td><td>${esc(u.zip||'—')}</td><td style="font-size:13px">${[u.is_buyer&&'Buyer',u.is_seller&&'Seller',u.is_admin&&'Admin'].filter(Boolean).join(', ')}</td><td>${when(u.created_at)}</td></tr>`).join(''));
    render(''); q('#us').oninput = (e) => render(e.target.value.toLowerCase());
  }

  window.OffravaMarketAdmin = { aSellers, aListings, aRequests };   // used by the admin control center (admin.js)

  /* ======================= Register routes ======================= */
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  const wrap = (v, w) => [v, () => { clearTimers(); w && w(); }];
  Object.assign(R, {
    '#/browse':   wrap(viewBrowse, wireBrowse),
    '#/request':  wrap(viewRequest, wireRequest),
    '#/requests': wrap(viewRequests, wireRequests),
    '#/sell':     wrap(viewSell, wireSell),
    '#/admin':    wrap(viewAdmin, wireAdmin)
  });
})();

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
  const CATS = ['Electronics','Furniture','Auto parts','Tools','Home & DIY','Kids & toys','Clothing','Collectibles','Appliances','Other'];
  const COND = { new:'New', open_box:'Open box', like_new:'Like new', excellent:'Excellent', good:'Good', fair:'Fair', refurbished:'Refurbished' };
  const COND_SCORE = { new:1, open_box:.95, like_new:.9, excellent:.85, refurbished:.85, good:.65, fair:.4 };
  const RET = { no_returns:'No returns', '14_days':'14-day returns', '30_days':'30-day returns' };
  const IMG = '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;
  const left = (iso) => { const s = Math.max(0, (new Date(iso) - Date.now())/1000|0); const h = s/3600|0, m = (s%3600)/60|0; return h ? `${h}h ${m}m left` : (m ? `${m}m left` : 'closing'); };
  const timers = []; const clearTimers = () => { while (timers.length) clearInterval(timers.pop()); };

  /* ======================= Browse (real listings) ======================= */
  function viewBrowse(){
    return `<div class="wrap"><div class="page-head"><div class="crumb">Home / Browse</div><h1>Browse</h1>
      <p class="muted">Buy now from local sellers — or ask them to compete with offers.</p></div>
      <form class="filters" id="fForm">
        <label class="sr" for="fq">Search</label><input id="fq" type="search" placeholder="Search listings">
        <label class="sr" for="fc">Category</label><select id="fc"><option value="">All categories</option>${CATS.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
        <button class="btn btn-dark" type="submit">Search</button>
      </form>
      <section style="padding-top:16px"><div class="products" id="grid"><div class="muted">Loading…</div></div></section></div>`;
  }
  async function wireBrowse(){
    if (!sb()) { q('#grid').innerHTML = '<p class="muted">Can\'t reach the marketplace right now. Check your connection and refresh.</p>'; return; }
    const f = q('#fForm'); const pre = decodeURIComponent((location.hash.split('q=')[1]||'').split('&')[0]);
    if (pre) q('#fq').value = pre;
    async function load(){
      let query = sb().from('listings').select('id,title,category,condition,price_cents,photos,zip,pickup,shipping,return_policy,sellers(display_name,rating,id_verified,payouts_enabled)')
        .eq('status','active').order('created_at',{ascending:false}).limit(48);
      const t = q('#fq').value.trim(), c = q('#fc').value;
      if (t) query = query.ilike('title', `%${t}%`);
      if (c) query = query.eq('category', c);
      const { data, error } = await query;
      const g = q('#grid');
      if (error) return g.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
      if (!data.length) return g.innerHTML = `<div class="card" style="grid-column:1/-1"><b>No listings yet${t?` for “${esc(t)}”`:''}.</b><p class="muted" style="margin:6px 0 14px">Ask local sellers to send you offers instead.</p><a class="btn btn-accent" href="#/request${t?`?item=${encodeURIComponent(t)}`:''}">Get offers</a></div>`;
      g.innerHTML = data.map(l => `
        <article class="product">
          <div class="thumb">${l.photos?.[0] ? `<img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : IMG}</div>
          <div class="body">
            <span class="tag">${esc(COND[l.condition]||l.condition)}</span>
            <div class="t">${esc(l.title)}</div>
            <div class="meta">${esc(l.sellers?.display_name||'Seller')}${l.sellers?.id_verified&&l.sellers?.payouts_enabled?' · <b>Verified</b>':''} · ${l.pickup?'Pickup':''}${l.pickup&&l.shipping?' / ':''}${l.shipping?'Ships':''}</div>
            <div class="price">${money(l.price_cents)}</div>
          </div>
          <div class="actions">
            <button class="btn btn-dark" type="button" data-buy="${l.id}">Buy now</button>
            <a class="btn btn-ghost" href="#/request?item=${encodeURIComponent(l.title)}&cat=${encodeURIComponent(l.category)}">Get offers</a>
          </div>
        </article>`).join('');
      g.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { b.textContent = 'Checkout coming soon'; b.disabled = true; });
    }
    f.onsubmit = (e) => { e.preventDefault(); load(); };
    load();
  }

  /* ======================= Request offers (buyer) ======================= */
  function viewRequest(){
    if (!A().user) return gate('Sign in to ask sellers for offers. It takes a minute.');
    const p = new URLSearchParams(location.hash.split('?')[1]||'');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Home / Get offers</div><h1>What are you looking for?</h1>
      <p class="muted">Sellers who already have it will send you sealed offers.</p></div>
      <div class="flow">
        <form class="card" id="reqForm">
          <div class="field"><label for="item">Item</label><input id="item" required maxlength="140" value="${esc(p.get('item')||'')}" placeholder="e.g. Samsung 65&quot; QLED TV, model Q80C"></div>
          <div class="row2">
            <div class="field"><label for="cat">Category</label><select id="cat" required>${CATS.map(c=>`<option ${p.get('cat')===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
            <div class="field"><label for="cond">Condition</label><select id="cond"><option value="any">Any</option><option value="new">New</option><option value="like_new">Like new or better</option><option value="good">Good or better</option></select></div>
          </div>
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
    const f = q('#reqForm'); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnReq'); busy(b, true);
      const hours = Number(f.win.value); const max = q('#max').value.trim();
      const { data, error } = await sb().from('offer_requests').insert({
        buyer_id: A().user.id, query: q('#item').value.trim(), category: q('#cat').value, condition: q('#cond').value,
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
        <div class="muted" style="font-size:14px">ZIP ${esc(r.zip)}${r.max_budget_cents?` · up to ${money(r.max_budget_cents)}`:''}</div></div>
        <div class="countdown" data-close="${r.closes_at}"><div><div class="big" data-left>${new Date(r.closes_at) > new Date() ? left(r.closes_at) : 'Offers open'}</div><div style="font-size:13px;opacity:.75" data-count>…</div></div></div>
      </div><div data-offers></div></div>`).join('');
    for (const r of reqs) {
      const card = q('#r-' + r.id);
      if (new Date(r.closes_at) > new Date()) {
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
              <small>${o.delivery_cents?`${money(o.price_cents)} + ${money(o.delivery_cents)} delivery`:'No delivery fee'} · tax at checkout</small>
              <div class="score">Match score ${o.score}/100</div></div>
            <button class="btn ${i===0?'btn-accent':'btn-ghost'}" type="button" data-accept="${o.id}">Accept offer</button>
          </article>`).join('');
        area.innerHTML = `<div class="offer-list" data-ol>${shown(false)}</div>${list.length>5?`<button class="btn btn-ghost" type="button" data-all style="margin-top:12px">See all ${list.length} offers</button>`:''}`;
        const wireAcc = () => area.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => { b.textContent = 'Checkout coming next'; b.disabled = true; });
        wireAcc();
        const all = area.querySelector('[data-all]'); if (all) all.onclick = () => { area.querySelector('[data-ol]').innerHTML = shown(true); all.remove(); wireAcc(); };
      }
    }
  }

  /* ======================= Seller dashboard ======================= */
  function viewSell(){
    const a = A();
    if (!a.user) return gate('Sign in to sell on Offrava.');
    if (!a.seller) return gate('Apply to become a seller first. Founding sellers pay 0% commission for 90 days.', '#/seller-apply', 'Apply to sell');
    if (a.seller.status !== 'approved') return gate(`Your seller application is <b>${esc(a.seller.status)}</b>. You can finish verification while you wait.`, '#/account', 'Open my account');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Seller dashboard</div><h1>${esc(a.seller.display_name)}</h1>
      <p class="muted">${a.seller.founding?'Founding seller · 0% commission for 90 days':''}${a.seller.payouts_enabled?'':' · <a href="#/account"><b>Finish payout setup</b></a> to get paid'}</p></div>
      <div class="seg" role="tablist" style="max-width:520px">
        <button type="button" class="on" data-tab="req">Requests for you</button><button type="button" data-tab="lst">My listings</button><button type="button" data-tab="new">Add listing</button>
      </div>
      <section style="padding-top:8px" id="sellArea"></section></div>`;
  }
  async function wireSell(){
    const area = q('#sellArea'); if (!area) return;
    const tabs = document.querySelectorAll('.seg [data-tab]');
    const show = (t) => { tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === t)); ({ req: sellRequests, lst: sellListings, new: sellNew })[t](area); };
    tabs.forEach(b => b.onclick = () => show(b.dataset.tab));
    show('req');
  }
  async function myListings(){
    const { data } = await sb().from('listings').select('*').eq('seller_id', A().user.id).order('created_at',{ascending:false});
    return data || [];
  }
  async function sellRequests(area){
    area.innerHTML = '<div class="muted">Loading…</div>';
    const [{ data: reqs, error }, listings] = await Promise.all([sb().rpc('open_requests_for_seller'), myListings()]);
    if (error) return area.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    const active = listings.filter(l => l.status === 'active');
    if (!reqs.length) return area.innerHTML = `<div class="card"><b>No open requests in your categories right now.</b><p class="muted" style="margin:6px 0 0">New buyer requests show up here. Add more listings so you can answer them.</p></div>`;
    if (!active.length) area.insertAdjacentHTML('afterbegin', '');
    area.innerHTML = (!active.length ? `<div class="note" style="margin-bottom:12px">Add an active listing first — offers must come from items you have listed.</div>` : '') + reqs.map(r => `
      <div class="alert ${r.my_offer_id?'':'new'}" id="q-${r.id}">
        <div><div style="font-weight:600;font-size:17px">${r.my_offer_id?'':'<span class="pulse" aria-hidden="true"></span>'}${esc(r.query)}</div>
          <div class="muted" style="font-size:14px">${esc(r.category||'')} · ${esc(r.condition==='any'?'Any condition':(COND[r.condition]||r.condition)+' or better')} · ZIP ${esc(r.zip)} · ${left(r.closes_at)}${r.max_budget_cents?` · budget ${money(r.max_budget_cents)}`:''}</div>
          ${r.my_offer_id?`<div style="font-size:14px;margin-top:4px">Your sealed offer: <b>${money(r.my_offer_cents)}</b>${r.my_offer_improved?' (improved)':''}</div>`:''}
        </div>
        <form class="inline-form" data-req="${r.id}" data-offer="${r.my_offer_id||''}">
          ${r.my_offer_id ? (r.my_offer_improved ? '<span class="tag">Final offer sent</span>' : `
            <label class="sr" for="p-${r.id}">Lower price</label><input id="p-${r.id}" name="price" inputmode="decimal" placeholder="Lower price $" required>
            <button class="btn btn-dark" type="submit">Improve once</button>`) : `
            <label class="sr" for="l-${r.id}">Your listing</label><select id="l-${r.id}" name="listing" required ${active.length?'':'disabled'}>${active.map(l=>`<option value="${l.id}" data-price="${l.price_cents}">${esc(l.title)} — ${money(l.price_cents)}</option>`).join('')}</select>
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
  async function sellListings(area){
    area.innerHTML = '<div class="muted">Loading…</div>';
    const ls = await myListings();
    if (!ls.length) return area.innerHTML = `<div class="card"><b>No listings yet.</b><p class="muted" style="margin:6px 0 0">Add your first item — it shows up for buyers and lets you answer requests.</p></div>`;
    area.innerHTML = `<div class="admin-table"><table><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Status</th><th></th></tr></thead><tbody>
      ${ls.map(l=>`<tr><td><b>${esc(l.title)}</b><div class="muted" style="font-size:13px">${esc(l.category)} · ${esc(COND[l.condition])}</div></td><td>${money(l.price_cents)}</td><td>${l.quantity}</td><td><span class="tag">${esc(l.status)}</span></td>
      <td>${l.status==='active'?`<button class="btn btn-ghost" type="button" data-st="paused" data-id="${l.id}">Pause</button>`:l.status==='paused'?`<button class="btn btn-ghost" type="button" data-st="active" data-id="${l.id}">Activate</button>`:''}</td></tr>`).join('')}
      </tbody></table></div>`;
    area.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { busy(b,true); await sb().from('listings').update({ status: b.dataset.st }).eq('id', b.dataset.id); sellListings(area); });
  }
  function sellNew(area){
    const s = A().seller;
    area.innerHTML = `<form class="card" id="newL" style="max-width:720px">
      <div class="field"><label for="lt">Title</label><input id="lt" required maxlength="120" placeholder="Brand, model, size — e.g. Samsung 65&quot; QLED Q80C"></div>
      <div class="row2">
        <div class="field"><label for="lc">Category</label><select id="lc">${CATS.map(c=>`<option ${s.categories?.[0]===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="lco">Condition</label><select id="lco">${Object.entries(COND).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label for="lp">Price</label><input id="lp" required inputmode="decimal" placeholder="$"></div>
        <div class="field"><label for="lq">Quantity</label><input id="lq" type="number" min="1" value="1"></div>
      </div>
      <div class="field"><label for="lph">Photos (up to 5, real photos of this item)</label><input id="lph" type="file" accept="image/jpeg,image/png,image/webp" multiple></div>
      <div class="field"><label for="lr">Returns</label><select id="lr">${Object.entries(RET).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="choices" style="margin-bottom:20px">
        <label class="choice"><input type="checkbox" id="lpk" ${s.offers_pickup?'checked':''}><span>Local pickup</span></label>
        <label class="choice"><input type="checkbox" id="lsh" ${s.offers_shipping?'checked':''}><span>I ship it</span></label>
      </div>
      <p class="muted" style="font-size:13px">Damaged or not-as-described items can always be returned, whatever return policy you pick.</p>
      <button class="btn btn-accent btn-lg" type="submit" id="btnL">Publish listing</button>
      <p id="lMsg" class="form-msg" role="status" aria-live="polite"></p></form>`;
    q('#newL').onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnL'); busy(b, true);
      const files = [...q('#lph').files].slice(0,5); const photos = [];
      for (const f of files) {
        if (f.size > 5*1024*1024) { busy(b,false); return msg('#lMsg', `${f.name} is over 5 MB.`); }
        const path = `${A().user.id}/${Date.now()}-${f.name.replace(/[^\w.-]/g,'_')}`;
        const up = await sb().storage.from('listing-photos').upload(path, f, { contentType: f.type });
        if (up.error) { busy(b,false); return msg('#lMsg', 'Photo upload failed: ' + up.error.message); }
        photos.push(sb().storage.from('listing-photos').getPublicUrl(path).data.publicUrl);
      }
      const { error } = await sb().from('listings').insert({
        seller_id: A().user.id, title: q('#lt').value.trim(), category: q('#lc').value, condition: q('#lco').value,
        price_cents: toCents(q('#lp').value), quantity: Number(q('#lq').value)||1, photos, zip: s.zip,
        pickup: q('#lpk').checked, shipping: q('#lsh').checked, return_policy: q('#lr').value
      });
      busy(b, false);
      if (error) return msg('#lMsg', error.message);
      msg('#lMsg', 'Published. It now shows up in Browse.', true); q('#newL').reset();
    };
  }

  /* ======================= Admin panel ======================= */
  function viewAdmin(){
    if (!A().user) return gate('Sign in first.');
    if (!A().profile?.is_admin) return gate('This page is for Offrava admins only.', '#/', 'Go home');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Admin</div><h1>Admin panel</h1></div>
      <div class="stats4" id="stats"></div>
      <div class="seg" role="tablist" style="max-width:640px">
        <button type="button" class="on" data-at="sellers">Sellers</button><button type="button" data-at="listings">Listings</button><button type="button" data-at="requests">Requests</button><button type="button" data-at="users">Users</button>
      </div>
      <section style="padding-top:8px;padding-bottom:48px" id="adminArea"></section></div>`;
  }
  async function wireAdmin(){
    const area = q('#adminArea'); if (!area) return;
    const { data: st, error } = await sb().rpc('admin_stats');
    if (!error) q('#stats').innerHTML = [['Users',st.users],['Sellers waiting',st.sellers_pending],['Approved sellers',st.sellers_approved],['Fully verified',st.sellers_verified],['Active listings',st.listings_active],['Open requests',st.requests_open],['All requests',st.requests_total],['Offers sent',st.offers_total]]
      .map(([k,v])=>`<div class="stat"><div class="muted">${k}</div><div class="big">${v}</div></div>`).join('');
    const tabs = document.querySelectorAll('[data-at]');
    const show = (t) => { tabs.forEach(b => b.classList.toggle('on', b.dataset.at === t)); ({ sellers: aSellers, listings: aListings, requests: aRequests, users: aUsers })[t](area); };
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

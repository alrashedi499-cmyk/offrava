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
    ['People', [['users', 'Users', '👥'], ['chats', 'Chats', '💬'], ['reports', 'Reports', '🚩'], ['reviews', 'Reviews', '⭐']]],
    ['Growth', [['ads', 'Ads', '📺'], ['inq', 'Advertisers', '🤝'], ['broadcast', 'Notify users', '📢']]],
    ['Services', [['services', 'Services & pros', '🛠️']]],
    ['System', [['features', 'Features on/off', '🎚️'], ['spots', 'Safe meetup spots', '📍'], ['log', 'Activity log', '📜']]]
  ];
  const TITLES = Object.fromEntries(NAV.flatMap(([g, items]) => items.map(([k, t]) => [k, [g, t]])));
  const param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);

  function viewAdmin(){
    if (!A().user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">Sign in first.</p><a class="btn btn-dark" href="#/login">Sign in</a></div></div>`;
    if (!A().profile?.is_admin) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">This page is for Offrava admins only.</p><a class="btn btn-dark" href="#/">Go home</a></div></div>`;
    return `<div class="adm">
      <aside class="adm-side" aria-label="Admin sections">
        <div class="adm-brand"><b>Offrava</b> <span class="tag st-done">Admin</span></div>
        <nav>${NAV.map(([g, items]) => `<div class="adm-group">${g ? `<div class="adm-gl">${g}</div>` : ''}${items.map(([k, t, i]) =>
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
  function wireAdmin(){
    const area = q('#adminArea'); if (!area) return;
    const sec = TITLES[param('s')] ? param('s') : 'overview';
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
      users, chats, reports: AD.adminReports, reviews,
      ads: AD.adminAds, inq: AD.adminInquiries, broadcast,
      services: SV.adminServices, features: SV.adminFeatures, spots, log
    };
    try { await (map[sec] || overview)(area); } catch (e) { err(area, e); }
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
      ['reports', b.reports, 'open reports', 'Check'], ['orders', b.orders, 'orders need attention (hold, stuck payout, refund pending)', 'Open'],
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
      ['ship_cancel_days', 'Not shipped by day … → cancel & refund', 'int'], ['pickup_cancel_days', 'Not picked up by day … → cancel & refund', 'int']]],
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

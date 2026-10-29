/* Offrava app features: personal home, My Offrava hub, notifications (bell + phone push), search with saved
   searches, watchlist, recently viewed, cart, item page, seller store, two-way reviews, reports, price research, help. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const C = window.OFFRAVA_CONFIG || {};
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + ((c||0)/100).toLocaleString('en-US', { minimumFractionDigits: (c||0) % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const go = (h) => { location.hash = h; };
  const ago = (d) => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return 'now'; if (s < 3600) return (s/60|0) + 'm'; if (s < 86400) return (s/3600|0) + 'h'; if (s < 604800) return (s/86400|0) + 'd'; return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
  const since = (d) => d ? new Date(d).toLocaleDateString('en-US', { month:'short', year:'numeric' }) : '';
  const stars = (r, n) => r == null ? '<span class="muted">No reviews yet</span>' : `<span class="stars" aria-label="${r} out of 5">${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))}</span> <b>${Number(r).toFixed(1)}</b>${n != null ? ` <span class="muted">(${n})</span>` : ''}`;
  const COND = { new:'New', open_box:'Open box', like_new:'Like new', excellent:'Excellent', good:'Good', fair:'Fair', refurbished:'Refurbished' };
  const RET = { no_returns:'No returns', '14_days':'14-day returns', '30_days':'30-day returns' };
  const CATS = ['Tires & wheels','Auto parts','Furniture','Appliances','Electronics','Phones','Tools','Home & DIY','Kids & toys','Clothing','Collectibles','Other'];
  const IMG = '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
  const I = (d, s=22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    heart: '<path d="M12 20s-7-4.4-9-9a4.6 4.6 0 018-4.2A4.6 4.6 0 0121 11c-2 4.6-9 9-9 9z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    heartOn: '<path d="M12 20s-7-4.4-9-9a4.6 4.6 0 018-4.2A4.6 4.6 0 0121 11c-2 4.6-9 9-9 9z" fill="#E5484D"/>',
    bell: '<path d="M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20a2 2 0 004 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    chat: '<path d="M4 5h16v11H8l-4 4z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    search: '<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    clock: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    repeat: '<path d="M4 12a8 8 0 0114-5l2 2M20 12a8 8 0 01-14 5l-2-2M20 4v5h-5M4 20v-5h5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    bag: '<path d="M5 8h14l-1 12H6zM9 8a3 3 0 016 0" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    user: '<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    gear: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    help: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 4M12 17h.01" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
    offers: '<path d="M4 7h16M4 12h10M4 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    chev: '<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
  };
  const NKIND = { order:'bag', shipped:'box', message:'chat', request:'offers', offers_ready:'offers', return:'repeat', payout:'money', price_drop:'tag', review:'user', seller:'shield', admin:'shield', saved_search:'search' };
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;

  let cleanups = [];
  const cleanup = () => { while (cleanups.length) { try { cleanups.pop()(); } catch(_){} } };
  window.addEventListener('hashchange', cleanup);

  /* ---------------- Watchlist (hearts) ---------------- */
  let favs = new Set(), favsLoaded = false;
  async function loadFavs(){
    if (!A().user || !sb()) { favs = new Set(); return; }
    const { data } = await sb().from('favorites').select('listing_id');
    favs = new Set((data || []).map(f => f.listing_id)); favsLoaded = true;
    qa('[data-fav]').forEach(paintHeart);
  }
  function paintHeart(b){ const on = favs.has(b.dataset.fav); b.innerHTML = I(on ? ICONS.heartOn : ICONS.heart, 20); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remove from watchlist' : 'Add to watchlist'); }
  async function toggleFav(b){
    if (!A().user) return go('#/login');
    const id = b.dataset.fav, on = favs.has(id);
    on ? favs.delete(id) : favs.add(id); qa(`[data-fav="${id}"]`).forEach(paintHeart);
    const r = on ? await sb().from('favorites').delete().eq('listing_id', id).eq('user_id', A().user.id)
                 : await sb().from('favorites').insert({ user_id: A().user.id, listing_id: id });
    if (r.error) { on ? favs.add(id) : favs.delete(id); qa(`[data-fav="${id}"]`).forEach(paintHeart); }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-fav]'); if (b) { e.preventDefault(); e.stopPropagation(); toggleFav(b); } });
  const heart = (id) => `<button type="button" class="heart" data-fav="${id}" aria-label="Add to watchlist">${I(favs.has(id) ? ICONS.heartOn : ICONS.heart, 20)}</button>`;

  // Small product tile for carousels
  const tile = (l, extra='') => `<a class="tile" href="#/item?id=${l.id}">
      <div class="thumb">${l.photos?.[0] ? `<img src="${esc(l.photos[0])}" alt="" loading="lazy">` : IMG}${heart(l.id)}</div>
      <div class="t">${esc(l.title)}</div><div class="p">${money(l.price_cents)}</div>
      <div class="s">${l.shipping ? (l.shipping_cents ? '+' + money(l.shipping_cents) + ' shipping' : 'Free shipping') : 'Local pickup'}</div>${extra}</a>`;
  const LCOLS = 'id,title,price_cents,photos,shipping,shipping_cents,pickup,condition,status,category';

  /* ---------------- Badges: bell, cart, My Offrava ---------------- */
  let counts = { notif: 0, msg: 0, cart: 0 };
  async function paintBadges(){
    const set = (sel, n) => qa(sel).forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
    if (!A().user || !sb()) { counts = { notif:0, msg:0, cart:0 }; set('#bellBadge,#cartBadge,#tabBadge,[data-count]', 0); qa('.signed-in').forEach(e => e.hidden = true); return; }
    qa('.signed-in').forEach(e => e.hidden = false);
    const me = A().user.id;
    const [n, c, cart] = await Promise.all([
      sb().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      sb().from('conversations').select('buyer_id,last_message_at,buyer_read_at,seller_read_at').order('last_message_at', { ascending: false }).limit(60),
      sb().from('cart_items').select('listing_id', { count: 'exact', head: true }).eq('saved_for_later', false)
    ]);
    counts.notif = n.count || 0; counts.cart = cart.count || 0;
    counts.msg = (c.data || []).filter(x => new Date(x.last_message_at) > new Date(x.buyer_id === me ? x.buyer_read_at : x.seller_read_at)).length;
    set('#bellBadge', counts.notif); set('#cartBadge', counts.cart); set('#tabBadge', counts.notif + counts.msg);
    set('[data-count="notif"]', counts.notif); set('[data-count="msg"]', counts.msg);
  }

  // Live: new notification arrives -> badge + small banner
  let liveCh = null, liveUser = null;
  function watchLive(){
    const u = A().user?.id || null;
    if (u === liveUser || !sb()) return;
    if (liveCh) { sb().removeChannel(liveCh); liveCh = null; }
    liveUser = u; loadFavs(); paintBadges();
    if (!u) return;
    liveCh = sb().channel('notif-' + u)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${u}` }, (p) => { toast(p.new); paintBadges(); if (location.hash.startsWith('#/notifications')) renderNotifs(); })
      .subscribe();
  }
  function toast(n){
    const t = document.createElement('a'); t.className = 'toast'; t.href = n.link || '#/notifications';
    t.innerHTML = `<span class="ico">${I(ICONS[NKIND[n.kind]] || ICONS.bell, 20)}</span><span><b>${esc(n.title)}</b><small>${esc(n.body)}</small></span>`;
    t.onclick = () => sb().rpc('notifications_mark_read', { p_ids: [n.id] }).then(paintBadges);
    document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    window.OffravaSound && OffravaSound.play(OffravaSound.forNotification(n));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 6000);
  }
  setInterval(watchLive, 1500);
  window.addEventListener('hashchange', () => setTimeout(paintBadges, 300));
  setInterval(() => { if (document.visibilityState === 'visible') paintBadges(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') paintBadges(); });

  /* ---------------- Phone / browser push ---------------- */
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function pushState(){
    if (!C.VAPID_PUBLIC_KEY) return 'unavailable';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isiOS && !standalone ? 'ios-install' : 'unsupported';
    return Notification.permission;   // default | granted | denied
  }
  const b64 = (s) => { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  async function enablePush(){
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return perm;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(C.VAPID_PUBLIC_KEY) });
    const j = sub.toJSON();
    const { error } = await sb().from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: A().user.id, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) });
    if (error) throw error;
    await sb().from('user_settings').update({ notify_push: true }).eq('user_id', A().user.id);
    return 'granted';
  }
  async function pushIsOn(){
    try { if (pushState() !== 'granted') return false; const reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()); } catch(_) { return false; }
  }
  function pushCard(){
    const st = pushState();
    if (st === 'ios-install') return `<div class="card push-card">${I(ICONS.bell)}<div><b>Get alerts on your iPhone</b><p class="muted">Tap the Share button in Safari, choose <b>Add to Home Screen</b>, open Offrava from your home screen, then turn on notifications here.</p></div></div>`;
    if (st === 'unsupported' || st === 'unavailable') return '';
    if (st === 'denied') return `<div class="card push-card">${I(ICONS.bell)}<div><b>Notifications are blocked</b><p class="muted">Allow notifications for this site in your phone or browser settings to get alerts.</p></div></div>`;
    return `<div class="card push-card" id="pushCard" hidden>${I(ICONS.bell)}<div><b>Turn on notifications</b><p class="muted">Know right away when sellers compete for you, when your item ships, and when someone messages you.</p><button class="btn btn-accent" type="button" id="btnPush">Turn on</button><p class="form-msg" id="pushMsg"></p></div></div>`;
  }
  async function wirePushCard(){
    const c = q('#pushCard'); if (!c) return;
    if (await pushIsOn()) return; c.hidden = false;
    q('#btnPush').onclick = async () => {
      const b = q('#btnPush'); busy(b, true);
      try { const r = await enablePush(); if (r === 'granted') { c.innerHTML = `${I(ICONS.bell)}<div><b>Notifications are on ✓</b><p class="muted" style="margin:0">You'll get alerts on this device.</p></div>`; } else { busy(b, false); q('#pushMsg').textContent = 'Permission was not given.'; } }
      catch (e) { busy(b, false); q('#pushMsg').textContent = e.message; q('#pushMsg').className = 'form-msg err'; }
    };
  }

  /* ---------------- Notifications page ---------------- */
  function viewNotifs(){
    if (!A().user) return gate('Sign in to see your notifications.');
    return `<div class="wrap narrow"><div class="page-head row-head"><div><div class="crumb"><a href="#/me">My Offrava</a> / Notifications</div><h1>Notifications</h1></div>
      <button class="btn btn-ghost" type="button" id="btnReadAll">Mark all read</button></div>
      ${pushCard()}<div class="card list-card" id="nList"><div class="muted">Loading…</div></div></div>`;
  }
  async function renderNotifs(){
    const box = q('#nList'); if (!box) return;
    const { data, error } = await sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return box.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    if (!data.length) return box.innerHTML = `<div class="empty">${I(ICONS.bell, 36)}<b>You're all caught up</b><p class="muted">Order updates, offers and messages show up here.</p></div>`;
    box.innerHTML = data.map(n => `<a class="nrow ${n.read_at ? '' : 'unread'}" href="${esc(n.link)}" data-nid="${n.id}">
      <span class="ico">${I(ICONS[NKIND[n.kind]] || ICONS.bell, 20)}</span>
      <span class="txt"><b>${esc(n.title)}</b><small>${esc(n.body)}</small></span><span class="when">${ago(n.created_at)}</span></a>`).join('');
    qa('[data-nid]', box).forEach(a => a.onclick = () => { sb().rpc('notifications_mark_read', { p_ids: [Number(a.dataset.nid)] }).then(paintBadges); });
  }
  function wireNotifs(){
    if (!q('#nList')) return;
    renderNotifs(); wirePushCard();
    q('#btnReadAll').onclick = async () => { await sb().rpc('notifications_mark_read', { p_ids: null }); renderNotifs(); paintBadges(); };
  }

  /* ---------------- My Offrava hub ---------------- */
  function viewMe(){
    if (!A().user) return gate('Sign in to see My Offrava.');
    const p = A().profile || {}, s = A().seller;
    const row = (href, icon, title, sub) => `<a class="hub-row" href="${href}"><span class="ico">${I(ICONS[icon])}</span><span><b>${title}</b><small>${sub}</small></span>${I(ICONS.chev, 18)}</a>`;
    return `<div class="wrap narrow">
      <div class="me-head">${OffravaAvatar.editable()}
        <div><b>${esc(p.full_name || 'Your account')}</b><small class="muted">Member since ${since(p.created_at || A().user.created_at)}${p.buyer_rating ? ` · ${stars(p.buyer_rating, p.buyer_reviews)}` : ''}</small></div></div>
      <div class="hub-tiles">
        <a href="#/orders"><span class="ico">${I(ICONS.bag)}</span>Orders</a>
        <a href="#/notifications"><span class="ico">${I(ICONS.bell)}<span class="badge" data-count="notif" hidden></span></span>Notifications</a>
        <a href="#/messages"><span class="ico">${I(ICONS.chat)}<span class="badge" data-count="msg" hidden></span></span>Messages</a>
      </div>
      <h2 class="hub-h">Shopping</h2><div class="card list-card">
        ${row('#/watchlist','heart','Watchlist','Items you saved')}
        ${row('#/search?tab=saved','search','Saved searches','Get alerts for new matches')}
        ${row('#/requests','offers','My offer requests','Sellers competing for you')}
        ${row('#/buy-again','repeat','Buy again','Shop your past purchases')}
        ${row('#/orders','bag','Purchases','Your order history')}
        ${row('#/recent','clock','Recently viewed','Items you looked at')}
        ${row('#/cart','bag','Cart','Items ready to buy')}
        <span data-flag="services">${row('#/jobs','gear','My service jobs','Quotes from local pros')}</span>
        <span data-flag="makers">${row('#/library','box','My library','Games and software you bought')}</span>
      </div>
      <h2 class="hub-h">Selling</h2><div class="card list-card">
        ${s && s.status === 'approved' ? row('#/sell?tab=new','plus','List an item','Takes a minute') + row('#/sell','chart','Selling overview','Listings, requests and offers') + row('#/orders?tab=sell','box','Sales','Orders to ship and payouts') + row('#/research','tag','What is it worth?','Real sold prices on Offrava') + `<span data-flag="services">${row('#/pro-jobs','gear','Pro jobs','Offer services and quote on local jobs')}</span>` + `<span data-flag="makers">${row('#/maker','plus','Sell games & software','Your digital products, keys and sales')}</span>`
          : s ? row('#/account','shield','Seller application: ' + esc(s.status),'Finish verification to start selling')
          : row('#/seller-apply','plus','Start selling','Founding sellers pay 0% for 90 days on their first $1,000')}
      </div>
      <h2 class="hub-h">Account</h2><div class="card list-card">
        ${row('#/account','user','Profile & verification', esc(A().user.email || A().user.phone || ''))}
        ${row('#/addresses','box','My addresses','Saved shipping addresses and your default')}
        ${row('#/settings','gear','Settings','Notifications, language, defaults')}
        ${row('#/activity','clock','Activity history','Everything you did on Offrava')}
        ${row('#/help','help','Help','Buyer protection, returns, fees')}
        ${p.is_admin ? row('#/admin','shield','Admin panel','Sellers, listings, reports') : ''}
      </div>
      <div style="margin:20px 0 48px">${pushCard()}</div></div>`;
  }
  function wireMe(){ paintBadges(); wirePushCard(); OffravaAvatar.wireEditable(); }

  /* ---------------- Personal home (signed in) ---------------- */
  function viewHomeMe(){
    if (!A().user) return null;   // signed out: the marketing home page
    return `<div class="wrap">
      <div class="chips">${['<a href="#/watchlist">♥ Watchlist</a>', '<a href="#/request">⚡ Get offers</a>', '<a href="#/services" data-flag="services">🧰 Services</a>', '<a href="#/makers" data-flag="makers">🎮 Games & software</a>', ...CATS.map(c => `<a href="#/browse?cat=${encodeURIComponent(c)}">${esc(c)}</a>`)].join('')}</div>
      <div class="ad-slot" data-place="home_top" hidden></div>
      <section class="home-sec" data-flag="services"><div data-svc-strip></div></section>
      <section class="home-sec" data-flag="makers"><div data-makers-strip></div></section>
      <section class="home-sec" id="hRecent"></section>
      <section class="home-sec" id="hWatch"></section>
      <section class="home-sec" id="hReqs"></section>
      <section class="home-sec" id="hResell"></section>
      <div class="promo"><div><b>Don't search. Let sellers compete.</b><p>Tell us what you want — local sellers send private offers, you pick the best.</p></div><a class="btn btn-accent" href="#/request">Get offers</a></div>
      <div class="ad-slot" data-place="home_middle" hidden style="margin-top:22px"></div>
      <section class="home-sec" id="hNew"></section></div>`;
  }
  const sec = (title, link, body) => `<div class="sec-row"><h2>${title}</h2>${link ? `<a href="${link}">See all</a>` : ''}</div>${body}`;
  async function wireHomeMe(){
    if (!q('#hNew')) return;
    if (!favsLoaded) await loadFavs();
    const me = A().user.id;
    const [rv, wl, reqs, bought, fresh] = await Promise.all([
      sb().from('recently_viewed').select(`viewed_at, listings(${LCOLS})`).order('viewed_at', { ascending: false }).limit(12),
      sb().from('favorites').select(`created_at, listings(${LCOLS})`).order('created_at', { ascending: false }).limit(12),
      sb().from('offer_requests').select('id,query,closes_at,status').eq('buyer_id', me).order('created_at', { ascending: false }).limit(4),
      sb().from('orders').select('id,title,photo,item_cents,completed_at').eq('buyer_id', me).eq('status', 'completed').order('completed_at', { ascending: false }).limit(6),
      sb().from('listings').select(LCOLS).eq('status', 'active').neq('seller_id', me).order('created_at', { ascending: false }).limit(16)
    ]);
    const live = (rows) => (rows || []).map(r => r.listings).filter(l => l && l.status === 'active');
    const R = live(rv.data), W = live(wl.data);
    if (R.length) q('#hRecent').innerHTML = sec('Your recently viewed items', '#/recent', `<div class="hscroll">${R.map(l => tile(l)).join('')}</div>`);
    if (W.length) q('#hWatch').innerHTML = sec('Your watchlist', '#/watchlist', `<div class="hscroll">${W.map(l => tile(l)).join('')}</div>`);
    const open = (reqs.data || []).filter(r => r.status === 'open' || new Date(r.closes_at) > Date.now() - 3 * 864e5);
    if (open.length) q('#hReqs').innerHTML = sec('Your offer requests', '#/requests', `<div class="hscroll wide">${open.map(r => `<a class="tile req" href="#/requests"><span class="ico">${I(ICONS.offers)}</span><div class="t">${esc(r.query)}</div><div class="s">${new Date(r.closes_at) > new Date() ? 'Collecting offers…' : 'Offers ready — see them'}</div></a>`).join('')}</div>`);
    if (bought.data?.length) q('#hResell').innerHTML = sec('Ready to resell?', '#/buy-again', `<div class="card list-card">${bought.data.slice(0,3).map(o => `
      <div class="resell"><div class="thumb mini">${o.photo ? `<img src="${esc(o.photo)}" alt="">` : IMG}</div><div style="min-width:0"><b class="ellipsis">${esc(o.title)}</b><small class="muted">You paid ${money(o.item_cents)}</small></div>
      <a class="btn btn-dark" href="${A().seller?.status === 'approved' ? '#/sell?tab=new&resell=' + o.id : '#/seller-apply'}">Resell</a></div>`).join('')}
      <p class="muted" style="font-size:13px;margin:10px 4px 2px">Sell something else in a few steps. <a href="#/sell?tab=new"><b>Create a listing</b></a></p></div>`);
    q('#hNew').innerHTML = fresh.data?.length ? sec('New near you', '#/browse', `<div class="hscroll">${fresh.data.map(l => tile(l)).join('')}</div>`) : '';
  }

  /* ---------------- Search page (recent + saved searches) ---------------- */
  const RKEY = 'offrava_recent_searches';
  const recentGet = () => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch(_) { return []; } };
  const recentAdd = (t) => { t = t.trim(); if (!t) return; try { localStorage.setItem(RKEY, JSON.stringify([t, ...recentGet().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 15))); } catch(_){} };
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/browse')) { const t = params().get('q'); if (t) recentAdd(t); } });
  function viewSearch(){
    const tab = params().get('tab') || 'recent';
    return `<div class="wrap narrow"><form class="search big" id="sForm" role="search">${I(ICONS.search, 20)}<label for="sq" class="sr">Search</label><input id="sq" type="search" placeholder="Search for anything" autocomplete="off" enterkeyhint="search"></form>
      <div class="tabs-line"><button type="button" data-st="recent" class="${tab==='recent'?'on':''}">Recent</button><button type="button" data-st="saved" class="${tab==='saved'?'on':''}">Saved</button></div>
      <div id="sBody"></div>
      <div class="note" style="margin:24px 0 48px">Can't find it? <a href="#/request"><b>Ask local sellers to compete</b></a> — they send you private offers.</div></div>`;
  }
  function wireSearch(){
    const f = q('#sForm'); if (!f) return;
    const inp = q('#sq'); if (matchMedia('(pointer:fine)').matches) inp.focus();
    f.onsubmit = (e) => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; recentAdd(t); go('#/browse?q=' + encodeURIComponent(t)); };
    qa('[data-st]').forEach(b => b.onclick = () => { qa('[data-st]').forEach(x => x.classList.toggle('on', x === b)); render(b.dataset.st); });
    async function render(tab){
      const box = q('#sBody');
      if (tab === 'recent') {
        const r = recentGet();
        box.innerHTML = r.length ? `<div class="list-plain">${r.map(t => `<a href="#/browse?q=${encodeURIComponent(t)}">${I(ICONS.clock, 18)}<span>${esc(t)}</span></a>`).join('')}</div><button type="button" class="link-btn" id="clrRecent">Clear all</button>` : '<p class="muted">Your recent searches show up here.</p>';
        const c = q('#clrRecent'); if (c) c.onclick = () => { try { localStorage.removeItem(RKEY); } catch(_){} render('recent'); };
        return;
      }
      if (!A().user) { box.innerHTML = '<p class="muted"><a href="#/login"><b>Sign in</b></a> to save searches and get alerts when new matches are listed.</p>'; return; }
      const { data } = await sb().from('saved_searches').select('*').order('created_at', { ascending: false });
      box.innerHTML = data?.length ? `<div class="list-plain">${data.map(s => `<div class="ss-row"><a href="#/browse?q=${encodeURIComponent(s.query)}${s.category ? '&cat=' + encodeURIComponent(s.category) : ''}">${I(ICONS.search, 18)}<span>${esc(s.query)}${s.category ? ` <small class="muted">in ${esc(s.category)}</small>` : ''}</span></a>
          <label class="switch" title="Alert me"><input type="checkbox" data-ssa="${s.id}" ${s.alert ? 'checked' : ''}><span></span></label><button type="button" class="link-btn" data-ssd="${s.id}" aria-label="Delete">✕</button></div>`).join('')}</div>`
        : '<p class="muted">No saved searches yet. Search for something, then tap <b>Save this search</b> to get an alert when a match is listed.</p>';
      qa('[data-ssa]').forEach(c => c.onchange = () => sb().from('saved_searches').update({ alert: c.checked }).eq('id', c.dataset.ssa));
      qa('[data-ssd]').forEach(b => b.onclick = async () => { await sb().from('saved_searches').delete().eq('id', b.dataset.ssd); render('saved'); });
    }
    render(params().get('tab') || 'recent');
  }
  async function saveSearch(query, category, btn){
    if (!A().user) return go('#/login');
    busy(btn, true);
    const { error } = await sb().from('saved_searches').upsert({ user_id: A().user.id, query: query.trim(), category: category || null, alert: true }, { onConflict: 'user_id,query,category' });
    btn.disabled = true; btn.innerHTML = error ? esc(error.message) : '✓ Saved — we\'ll alert you';
  }

  /* ---------------- Lists: watchlist, recently viewed, buy again ---------------- */
  function listView(title, crumb){ return () => A().user ? `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/me">My Offrava</a> / ${crumb}</div><h1>${title}</h1></div><section style="padding-top:8px;padding-bottom:48px"><div class="products" id="lGrid"><div class="muted">Loading…</div></div></section></div>` : gate('Sign in first.'); }
  const card = (l, sub='') => `<article class="product"><a class="thumb" href="#/item?id=${l.id}">${l.photos?.[0] ? `<img src="${esc(l.photos[0])}" alt="${esc(l.title)}" loading="lazy">` : IMG}${heart(l.id)}</a>
      <div class="body"><span class="tag">${esc(COND[l.condition] || '')}</span><a class="t" href="#/item?id=${l.id}">${esc(l.title)}</a><div class="meta">${l.status !== 'active' ? '<b>No longer available</b>' : (l.shipping ? (l.shipping_cents ? '+' + money(l.shipping_cents) + ' shipping' : 'Free shipping') : 'Local pickup')}${sub}</div><div class="price">${money(l.price_cents)}</div></div></article>`;
  async function fillGrid(rows, empty){
    const g = q('#lGrid'); if (!g) return;
    g.innerHTML = rows.length ? rows.join('') : `<div class="card empty" style="grid-column:1/-1">${empty}</div>`;
  }
  async function wireWatch(){
    if (!q('#lGrid')) return; await loadFavs();
    const { data } = await sb().from('favorites').select(`created_at, listings(${LCOLS})`).order('created_at', { ascending: false });
    fillGrid((data || []).filter(r => r.listings).map(r => card(r.listings)), `${I(ICONS.heart, 36)}<b>Nothing saved yet</b><p class="muted">Tap the ♡ on any item to watch it. We'll tell you if the price drops.</p><a class="btn btn-dark" href="#/browse">Browse</a>`);
  }
  async function wireRecent(){
    if (!q('#lGrid')) return; await loadFavs();
    const { data } = await sb().from('recently_viewed').select(`viewed_at, listings(${LCOLS})`).order('viewed_at', { ascending: false }).limit(60);
    fillGrid((data || []).filter(r => r.listings).map(r => card(r.listings, ` · viewed ${ago(r.viewed_at)} ago`)), `<b>No recently viewed items</b><p class="muted">Items you open show up here on all your devices.</p>`);
  }
  async function wireBuyAgain(){
    const g = q('#lGrid'); if (!g) return;
    const { data } = await sb().from('orders').select('id,title,photo,item_cents,completed_at,listing_id,seller_id,sellers(display_name)').eq('buyer_id', A().user.id).eq('status', 'completed').order('completed_at', { ascending: false });
    fillGrid((data || []).map(o => `<article class="product"><div class="thumb">${o.photo ? `<img src="${esc(o.photo)}" alt="" loading="lazy">` : IMG}</div>
      <div class="body"><div class="t">${esc(o.title)}</div><div class="meta">Bought ${new Date(o.completed_at).toLocaleDateString('en-US')} from ${esc(o.sellers?.display_name || 'seller')}</div><div class="price">${money(o.item_cents)}</div></div>
      <div class="actions wrap2"><a class="btn btn-dark full" href="#/browse?q=${encodeURIComponent(o.title)}">Find it again</a><a class="btn btn-ghost" href="#/request?item=${encodeURIComponent(o.title)}">Get offers</a>
      <a class="btn btn-ghost" href="${A().seller?.status === 'approved' ? '#/sell?tab=new&resell=' + o.id : '#/seller-apply'}">Resell</a></div></article>`),
      `<b>No past purchases yet</b><p class="muted">Things you buy show up here so you can buy them again or resell them.</p>`);
  }

  /* ---------------- Item page ---------------- */
  function viewItem(){ return `<div class="wrap" id="itemWrap"><div class="muted" style="padding:40px 0">Loading…</div></div>`; }
  async function wireItem(){
    const box = q('#itemWrap'); if (!box) return;
    const id = params().get('id');
    if (!favsLoaded) await loadFavs();
    const { data: l, error } = await sb().from('listings').select('*, sellers(user_id,display_name,rating,review_count,sales_count,id_verified,payouts_enabled,created_at,seller_type,city,avatar_url)').eq('id', id).maybeSingle();
    if (error || !l) { box.innerHTML = `<div class="card empty" style="margin:40px 0"><b>This item isn't available.</b><p class="muted">It may have sold or been removed.</p><a class="btn btn-dark" href="#/browse">Browse</a></div>`; return; }
    const me = A().user?.id, mine = l.seller_id === me, s = l.sellers || {};
    if (me && !mine) sb().from('recently_viewed').upsert({ user_id: me, listing_id: id, viewed_at: new Date().toISOString() });
    const photos = l.photos?.length ? l.photos : [];
    box.innerHTML = `<div class="crumb" style="padding-top:20px"><a href="#/browse">Browse</a> / <a href="#/browse?cat=${encodeURIComponent(l.category)}">${esc(l.category)}</a></div>
      <div class="item">
        <div class="gallery"><div class="main">${photos[0] ? `<img id="gMain" src="${esc(photos[0])}" alt="${esc(l.title)}">` : IMG}${heart(l.id)}</div>
          ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button type="button" data-g="${esc(p)}" class="${i ? '' : 'on'}"><img src="${esc(p)}" alt="Photo ${i+1}"></button>`).join('')}</div>` : ''}</div>
        <div class="buybox">
          <h1>${esc(l.title)}</h1>
          <div class="price-big">${money(l.price_cents)}</div>
          <div class="facts"><span class="tag">${esc(COND[l.condition] || l.condition)}</span>${l.quantity > 1 ? `<span class="tag">${l.quantity} available</span>` : ''}<span class="tag" id="watchers" hidden></span></div>
          <div class="sum-line"><span>Delivery</span><b style="text-align:right">${l.shipping ? (l.shipping_cents ? money(l.shipping_cents) + ' shipping' : 'Free shipping') : ''}${l.shipping && l.pickup ? '<br>' : ''}${l.pickup ? `Free local pickup${l.zip ? ' · ' + esc(l.zip) : ''}` : ''}</b></div>
          <div class="sum-line"><span>Returns</span><b>${esc(RET[l.return_policy] || '')}</b></div>
          ${l.status !== 'active' ? `<div class="note"><b>This item is ${esc(l.status)}.</b></div>` : mine ? `<div class="note">This is your listing. <a href="#/sell?tab=lst"><b>Edit it</b></a></div>` : `
          <div class="buy-btns">
            <a class="btn btn-accent btn-lg" href="#/checkout?listing=${l.id}">Buy it now</a>
            <button class="btn btn-dark btn-lg" type="button" id="btnCart">Add to cart</button>
            <a class="btn btn-ghost btn-lg" href="#/request?item=${encodeURIComponent(l.title)}&cat=${encodeURIComponent(l.category)}">Get competing offers</a>
          </div>
          <div class="acct-links" style="margin-top:10px"><button class="btn btn-ghost" type="button" id="btnAsk">${I(ICONS.chat, 18)} Ask seller</button><button class="btn btn-ghost" type="button" data-fav="${l.id}"></button></div>`}
          ${l.description ? `<div class="item-desc"><b>About this item</b><p>${esc(l.description).replace(/\n/g, '<br>')}</p></div>` : ''}
          <div class="protect">${I(ICONS.shield)}<div><b>Offrava Buyer Protection</b><small>Get the item you ordered or your money back. We hold the payment until you have it.</small></div></div>
          <a class="seller-card" href="#/store?id=${l.seller_id}">${OffravaAvatar.html(s.avatar_url, s.display_name || 'S')}<div><b>${esc(s.display_name || 'Seller')}</b>${s.id_verified && s.payouts_enabled ? ' <span class="badge-verified">Verified</span>' : ''}
            <small>${stars(s.rating, s.review_count)} · ${s.sales_count || 0} sold · since ${since(s.created_at)}</small></div>${I(ICONS.chev, 18)}</a>
          ${!mine ? `<button type="button" class="link-btn" id="btnReport">${I(ICONS.flag, 16)} Report this item</button><div id="repBox"></div>` : ''}
        </div>
      </div>
      <section class="home-sec" id="moreFrom"></section>`;
    qa('[data-fav]', box).forEach(paintHeart);
    qa('[data-g]', box).forEach(b => b.onclick = () => { q('#gMain').src = b.dataset.g; qa('[data-g]', box).forEach(x => x.classList.toggle('on', x === b)); });
    const ask = q('#btnAsk'); if (ask) ask.onclick = () => window.OffravaOrders?.askSeller(l.id, ask);
    const cartB = q('#btnCart'); if (cartB) cartB.onclick = async () => {
      if (!A().user) return go('#/login');
      busy(cartB, true);
      const { error } = await sb().from('cart_items').upsert({ user_id: me, listing_id: l.id, saved_for_later: false, added_at: new Date().toISOString() });
      busy(cartB, false);
      if (error) { cartB.textContent = error.message; return; }
      cartB.innerHTML = '✓ In your cart · View'; cartB.onclick = () => go('#/cart'); paintBadges();
    };
    const rep = q('#btnReport'); if (rep) rep.onclick = () => reportForm(q('#repBox'), { listing_id: l.id, seller_id: l.seller_id });
    if (mine) { const { data: n } = await sb().rpc('favorite_count', { p_listing: l.id }); if (n) { const w = q('#watchers'); w.textContent = `${n} watching`; w.hidden = false; } }
    const { data: more } = await sb().from('listings').select(LCOLS).eq('seller_id', l.seller_id).eq('status', 'active').neq('id', l.id).limit(12);
    if (more?.length && q('#moreFrom')) q('#moreFrom').innerHTML = sec('More from this seller', '#/store?id=' + l.seller_id, `<div class="hscroll">${more.map(x => tile(x)).join('')}</div>`);
  }

  function reportForm(box, target){
    if (!A().user) return go('#/login');
    box.innerHTML = `<form class="card" id="repF" style="margin-top:12px;padding:20px"><b>What's wrong?</b>
      <div class="choices" style="margin:12px 0">${[['scam','Scam or asks to pay outside'],['counterfeit','Fake / counterfeit'],['prohibited','Not allowed on Offrava'],['wrong_info','Wrong information'],['offensive','Offensive'],['other','Other']].map(([v,t],i) => `<label class="choice"><input type="radio" name="why" value="${v}" ${i?'':'checked'}><span>${t}</span></label>`).join('')}</div>
      <div class="field"><label for="repD">Details (optional)</label><textarea id="repD" rows="2" maxlength="1000"></textarea></div>
      <button class="btn btn-dark" type="submit">Send report</button><p class="form-msg" id="repM"></p></form>`;
    const f = q('#repF'); f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); busy(b, true);
      const { error } = await sb().from('reports').insert({ reporter_id: A().user.id, ...target, reason: f.why.value, details: q('#repD').value.trim() });
      if (error) { busy(b, false); q('#repM').textContent = error.message; q('#repM').className = 'form-msg err'; return; }
      box.innerHTML = '<p class="form-msg ok">Thanks — our team will review it. Reports are private.</p>';
    };
  }

  /* ---------------- Seller store ---------------- */
  function viewStore(){ return `<div class="wrap" id="storeWrap"><div class="muted" style="padding:40px 0">Loading…</div></div>`; }
  async function wireStore(){
    const box = q('#storeWrap'); if (!box) return;
    const id = params().get('id'); if (!favsLoaded) await loadFavs();
    const [{ data: s }, { data: ls }, { data: rv }, { data: sv }, { data: dp }] = await Promise.all([
      sb().from('sellers').select('user_id,display_name,business_name,seller_type,city,rating,review_count,sales_count,id_verified,payouts_enabled,created_at,offers_pickup,offers_shipping,avatar_url').eq('user_id', id).maybeSingle(),
      sb().from('listings').select(LCOLS).eq('seller_id', id).eq('status', 'active').order('created_at', { ascending: false }).limit(60),
      sb().from('reviews').select('*').eq('target_id', id).eq('direction', 'buyer_to_seller').order('created_at', { ascending: false }).limit(100),
      sb().from('provider_services').select('category,license_number,insured,about,service_categories(name,emoji,description,requires_license,enabled)').eq('seller_id', id).eq('status', 'approved'),
      sb().from('digital_products').select('id,title,tagline,kind,price_cents,cover_url,platforms,sales_count').eq('seller_id', id).eq('status', 'active').order('approved_at', { ascending: false }).limit(60)
    ]);
    if (!s) { box.innerHTML = '<div class="card empty" style="margin:40px 0"><b>Store not found.</b></div>'; return; }
    const services = (sv || []).filter(x => x.service_categories?.enabled);
    const digital = dp || [];
    const reviews = rv || [];
    const tabs = [['items', 'Items', ls?.length || 0], ['services', 'Services', services.length], ['digital', 'Games & software', digital.length], ['reviews', 'Reviews', reviews.length]]
      .filter(([k, , n]) => n || k === 'reviews' || (k === 'items' && !services.length && !digital.length));
    const want = params().get('tab');
    const tab = tabs.find(t => t[0] === want) ? want : tabs[0][0];
    const kinds = [ls?.length && 'Items', services.length && 'Services', digital.length && 'Games & software'].filter(Boolean).join(' · ');
    box.innerHTML = `<div class="store-head">${OffravaAvatar.html(s.avatar_url, s.display_name, 'big')}<div class="store-id">
        <h1>${esc(s.display_name)} ${s.id_verified && s.payouts_enabled ? '<span class="badge-verified">Verified</span>' : ''}</h1>
        ${s.business_name && s.business_name !== s.display_name ? `<div class="muted" style="font-size:14px">${esc(s.business_name)}</div>` : ''}
        <div class="muted">${stars(s.rating, s.review_count)} · ${s.sales_count || 0} sold · ${esc(s.city || 'St. Louis')} · on Offrava since ${since(s.created_at)}</div>
        <div class="store-tags">${s.seller_type === 'business' ? '<span class="tag">Shop</span>' : ''}${kinds ? `<span class="tag">${kinds}</span>` : ''}${s.offers_pickup ? '<span class="tag">Local pickup</span>' : ''}${s.offers_shipping ? '<span class="tag">Ships</span>' : ''}</div></div>
        <div class="store-acts"><button type="button" class="btn btn-ghost" id="storeShare">${I(ICONS.share, 16)} Share store</button>
        ${A().user && A().user.id !== id ? `<button type="button" class="link-btn" id="storeRep">${I(ICONS.flag, 16)} Report</button>` : ''}</div></div>
      <div id="storeRepBox"></div>
      <div class="tabs-line" role="tablist">${tabs.map(([k, t, n]) => `<button type="button" role="tab" data-tt="${k}" class="${tab === k ? 'on' : ''}">${t} (${n})</button>`).join('')}</div>
      <div id="storeBody" style="padding-bottom:48px"></div>`;
    const svcCard = (x) => { const c = x.service_categories || {}; const licensed = c.requires_license && x.license_number;
      return `<div class="card store-svc"><div class="store-svc-top"><span class="store-svc-e" aria-hidden="true">${c.emoji || '🛠️'}</span><div><b>${esc(c.name || x.category)}</b><div class="muted" style="font-size:13px">${esc(c.description || '')}</div></div></div>
        ${x.about ? `<p style="margin:10px 0 0;font-size:14px">${esc(x.about)}</p>` : ''}
        <div class="store-tags" style="margin-top:10px">${licensed ? '<span class="tag st-done">Licensed ✓</span>' : ''}${x.insured ? '<span class="tag st-go">Insured</span>' : ''}</div>
        <a class="btn btn-dark" style="margin-top:12px" href="#/service-request?cat=${encodeURIComponent(x.category)}">Get quotes</a></div>`; };
    const digCard = (p) => `<a class="card store-dig" href="#/app?id=${p.id}"><div class="store-dig-cover">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="" loading="lazy">` : '🎮'}</div>
        <div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p.title)}</b><b>${money(p.price_cents)}</b></div>
        ${p.tagline ? `<div class="muted" style="font-size:13px">${esc(p.tagline)}</div>` : ''}<div class="muted" style="font-size:12px;margin-top:4px">${(p.platforms || []).slice(0, 3).join(' · ')}${p.sales_count ? ` · ${p.sales_count} sold` : ''}</div></div></a>`;
    const breakdown = () => {
      if (!reviews.length) return '';
      const n = reviews.length, avg = reviews.reduce((a, r) => a + r.rating, 0) / n;
      return `<div class="card rv-sum"><div class="rv-big"><div class="big">${avg.toFixed(1)}</div>${stars(avg)}<div class="muted" style="font-size:13px">${n} review${n === 1 ? '' : 's'}</div></div>
        <div class="rv-bars">${[5, 4, 3, 2, 1].map(k => { const c = reviews.filter(r => r.rating === k).length; return `<div class="rv-bar"><span>${k}★</span><i><b style="width:${(100 * c / n).toFixed(0)}%"></b></i><span class="muted">${c}</span></div>`; }).join('')}</div></div>`;
    };
    const show = (t) => {
      qa('[data-tt]').forEach(b => b.classList.toggle('on', b.dataset.tt === t));
      const body = q('#storeBody');
      if (t === 'items') body.innerHTML = ls?.length ? `<div class="products">${ls.map(l => card(l)).join('')}</div>` : '<p class="muted">No items listed right now.</p>';
      else if (t === 'services') body.innerHTML = `<div class="store-grid">${services.map(svcCard).join('')}</div><p class="muted" style="font-size:13px">"Get quotes" asks nearby pros (including this one) to send sealed quotes, so you can compare.</p>`;
      else if (t === 'digital') body.innerHTML = `<div class="store-grid">${digital.map(digCard).join('')}</div>`;
      else body.innerHTML = reviews.length ? breakdown() + `<div class="card list-card">${reviews.map(reviewHtml).join('')}</div>` : '<p class="muted">No reviews yet. Reviews come only from people who bought here.</p>';
    };
    qa('[data-tt]').forEach(b => b.onclick = () => show(b.dataset.tt)); show(tab);
    const r = q('#storeRep'); if (r) r.onclick = () => reportForm(q('#storeRepBox'), { seller_id: id });
    q('#storeShare').onclick = async (e) => {
      const url = location.href.split('#')[0] + '#/store?id=' + id;
      try { if (navigator.share) await navigator.share({ title: s.display_name + ' on Offrava', url }); else { await navigator.clipboard.writeText(url); e.currentTarget.textContent = 'Link copied ✓'; } } catch (_) {}
    };
  }
  const reviewHtml = (r) => `<div class="review"><div class="rv-top">${stars(r.rating)} <b>${esc(r.author_name)}</b> <span class="muted">· ${new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>
      <div class="muted" style="font-size:13px">${esc(r.item_title)}</div>${r.body ? `<p>${esc(r.body)}</p>` : ''}${r.reply ? `<div class="rv-reply"><b>Reply:</b> ${esc(r.reply)}</div>` : ''}</div>`;

  /* ---------------- Reviews on an order (both sides) ---------------- */
  async function reviewCard(el, o){
    if (!el) return;
    if (o.status !== 'completed') { el.innerHTML = ''; return; }
    const me = A().user.id, iAmBuyer = o.buyer_id === me;
    const otherName = iAmBuyer ? (o.sellers?.display_name || 'the seller') : o.buyer_name;
    const { data } = await sb().from('reviews').select('*').eq('order_id', o.id);
    const mine = (data || []).find(r => r.author_id === me), theirs = (data || []).find(r => r.author_id !== me);
    let html = `<div class="card"><span class="tag">Reviews</span>`;
    if (!mine) {
      html += `<h3 style="margin:10px 0 4px">Rate ${esc(otherName)}</h3><p class="muted" style="margin:0 0 12px;font-size:14px">${iAmBuyer ? 'How was the item, the communication and the delivery?' : 'Was the buyer smooth to deal with — payment, pickup, communication?'}</p>
        <form id="rvF"><div class="star-pick" role="radiogroup" aria-label="Rating">${[5,4,3,2,1].map(n => `<label><input type="radio" name="st" value="${n}" ${n===5?'checked':''}><span>★</span></label>`).join('')}</div>
        <div class="field"><label for="rvT" class="sr">Comment</label><textarea id="rvT" rows="3" maxlength="1000" placeholder="Write a short comment (optional)"></textarea></div>
        <button class="btn btn-accent" type="submit">Post review</button><p class="form-msg" data-msg></p>
        <p class="muted" style="font-size:12px;margin:8px 0 0">Fair reviews: yours stays hidden until ${esc(otherName)} reviews you too, or after 14 days.</p></form>`;
    } else {
      html += `<h3 style="margin:10px 0 6px">Your review</h3>${reviewHtml(mine)}${!theirs ? `<p class="muted" style="font-size:13px;margin:6px 0 0">Hidden until ${esc(otherName)} reviews you, or ${new Date(mine.visible_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}.</p>` : ''}`;
    }
    if (theirs) {
      html += `<h3 style="margin:16px 0 6px">Review from ${esc(otherName)}</h3>${reviewHtml(theirs)}`;
      if (!theirs.reply) html += `<form id="rpF" class="inline-form" style="margin-top:8px"><label class="sr" for="rpT">Reply</label><input id="rpT" maxlength="1000" placeholder="Reply once, publicly" style="flex:1;width:auto"><button class="btn btn-ghost" type="submit">Reply</button></form>`;
    }
    el.innerHTML = html + '</div>';
    const f = q('#rvF', el); if (f) f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); busy(b, true);
      const { error } = await sb().rpc('review_create', { p_order: o.id, p_rating: Number(f.st.value), p_body: q('#rvT', el).value });
      if (error) { busy(b, false); const m = f.querySelector('[data-msg]'); m.textContent = error.message; m.className = 'form-msg err'; return; }
      reviewCard(el, o);
    };
    const rp = q('#rpF', el); if (rp) rp.onsubmit = async (e) => {
      e.preventDefault(); const { error } = await sb().rpc('review_reply', { p_review: theirs.id, p_reply: q('#rpT', el).value });
      if (!error) reviewCard(el, o);
    };
  }
  async function buyerBadge(el, buyerId){
    if (!el) return;
    const { data } = await sb().rpc('buyer_reputation', { p_user: buyerId });
    if (!data) return;
    el.innerHTML = ` · ${data.rating ? stars(data.rating, data.reviews) : 'New buyer'} · ${data.purchases} purchase${data.purchases === 1 ? '' : 's'} · since ${esc(data.member_since)}`;
  }

  /* ---------------- Cart ---------------- */
  function viewCart(){
    if (!A().user) return gate('Sign in to see your cart.');
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/me">My Offrava</a> / Cart</div><h1>Shopping cart</h1></div>
      <div class="flow"><div id="cartList" style="display:grid;gap:12px;align-content:start"><div class="muted">Loading…</div></div><aside class="card summary" id="cartSum"></aside></div></div>`;
  }
  async function wireCart(){
    const box = q('#cartList'); if (!box) return;
    const { data } = await sb().from('cart_items').select(`saved_for_later, added_at, listings(${LCOLS},quantity,return_policy,seller_id,sellers(display_name,rating,review_count))`).order('added_at', { ascending: false });
    const rows = (data || []).filter(r => r.listings);
    const inCart = rows.filter(r => !r.saved_for_later), later = rows.filter(r => r.saved_for_later);
    const item = (r) => { const l = r.listings, ok = l.status === 'active' && l.quantity > 0; return `<div class="card cart-item">
        <a class="thumb mini" href="#/item?id=${l.id}">${l.photos?.[0] ? `<img src="${esc(l.photos[0])}" alt="">` : IMG}</a>
        <div style="min-width:0"><small class="muted">${esc(l.sellers?.display_name || 'Seller')} · ${stars(l.sellers?.rating, l.sellers?.review_count)}</small>
          <a href="#/item?id=${l.id}"><b>${esc(l.title)}</b></a>
          <div class="muted" style="font-size:13px">${esc(COND[l.condition] || '')} · ${l.shipping ? (l.shipping_cents ? '+' + money(l.shipping_cents) + ' shipping' : 'Free shipping') : 'Local pickup'} · ${esc(RET[l.return_policy] || '')}</div>
          <div class="price">${money(l.price_cents)}</div>
          ${ok ? '' : '<b class="form-msg err" style="margin:0">Item not available</b>'}
          <div class="cart-acts">${ok && !r.saved_for_later ? `<a href="#/checkout?listing=${l.id}">Buy it now</a>` : ''}
            <button type="button" class="link-btn" data-later="${l.id}" data-v="${!r.saved_for_later}">${r.saved_for_later ? 'Move to cart' : 'Save for later'}</button>
            <button type="button" class="link-btn" data-rm="${l.id}">Remove</button></div></div></div>`; };
    box.innerHTML = (inCart.length ? inCart.map(item).join('') : `<div class="card empty">${I(ICONS.bag, 36)}<b>Your cart is empty</b><p class="muted">Add items you want to buy.</p><a class="btn btn-dark" href="#/browse">Start shopping</a></div>`)
      + (later.length ? `<h2 class="hub-h">Saved for later (${later.length})</h2>` + later.map(item).join('') : '');
    const live = inCart.filter(r => r.listings.status === 'active');
    const sub = live.reduce((a, r) => a + r.listings.price_cents, 0), ship = live.reduce((a, r) => a + (r.listings.shipping ? r.listings.shipping_cents : 0), 0);
    q('#cartSum').innerHTML = `<h3>Summary</h3><div class="sum-line"><span>Items (${live.length})</span><b>${money(sub)}</b></div><div class="sum-line"><span>Shipping</span><b>${ship ? money(ship) : 'Free'}</b></div>
      <div class="sum-line" style="font-size:18px"><span>Subtotal</span><b>${money(sub + ship)}</b></div>
      ${live[0] ? `<a class="btn btn-accent btn-lg" style="width:100%;margin-top:12px" href="#/checkout?listing=${live[0].listings.id}">Checkout first item</a><p class="muted" style="font-size:13px">For now, each item is paid separately (each seller ships on their own). Pick-up items can be chosen at checkout.</p>` : ''}
      <div class="protect" style="margin-top:12px">${I(ICONS.shield)}<div><b>Buyer Protection</b><small>Your money is held until you get the item.</small></div></div>`;
    qa('[data-later]', box).forEach(b => b.onclick = async () => { await sb().from('cart_items').update({ saved_for_later: b.dataset.v === 'true' }).eq('user_id', A().user.id).eq('listing_id', b.dataset.later); wireCart(); paintBadges(); });
    qa('[data-rm]', box).forEach(b => b.onclick = async () => { await sb().from('cart_items').delete().eq('user_id', A().user.id).eq('listing_id', b.dataset.rm); wireCart(); paintBadges(); });
  }
  // Bought it -> take it out of the cart
  window.addEventListener('hashchange', () => { const m = location.hash.match(/^#\/order\?id=/); if (m && A().user) setTimeout(async () => {
    const { data: o } = await sb().from('orders').select('listing_id,status').eq('id', params().get('id')).maybeSingle();
    if (o && o.status !== 'pending_payment') { await sb().from('cart_items').delete().eq('user_id', A().user.id).eq('listing_id', o.listing_id); paintBadges(); }
  }, 1500); });

  /* ---------------- Price research ---------------- */
  function viewResearch(){
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb"><a href="#/sell">Selling</a> / Research</div><h1>What is it worth?</h1><p class="muted">Real prices from items sold on Offrava, plus what's listed right now.</p></div>
      <form class="search big" id="rsF">${I(ICONS.search, 20)}<label class="sr" for="rsQ">Item</label><input id="rsQ" type="search" placeholder="e.g. iPhone 14 128GB" value="${esc(params().get('q') || '')}"></form>
      <div id="rsOut" style="margin:20px 0 48px"></div></div>`;
  }
  function wireResearch(){
    const f = q('#rsF'); if (!f) return;
    const run = async () => {
      const t = q('#rsQ').value.trim(); const out = q('#rsOut'); if (t.length < 2) return;
      out.innerHTML = '<div class="muted">Looking…</div>';
      const { data: d, error } = await sb().rpc('price_research', { p_query: t });
      if (error) return out.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
      out.innerHTML = `<div class="stats4">
          <div class="stat"><div class="muted">Sold</div><div class="big">${d.sold_count}</div></div>
          <div class="stat"><div class="muted">Avg sold price</div><div class="big">${d.sold_avg ? money(d.sold_avg) : '—'}</div></div>
          <div class="stat"><div class="muted">Sold range</div><div class="big" style="font-size:22px">${d.sold_min ? money(d.sold_min) + '–' + money(d.sold_max) : '—'}</div></div>
          <div class="stat"><div class="muted">Listed now</div><div class="big">${d.active_count}</div><small class="muted">${d.active_avg ? 'avg ' + money(d.active_avg) : ''}</small></div></div>
        ${d.recent?.length ? `<h2 class="hub-h">Recently sold</h2><div class="card list-card">${d.recent.map(r => `<div class="sum-line"><span>${esc(r.title)} <small class="muted">· ${esc(COND[r.condition] || '')} · ${new Date(r.completed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></span><b>${money(r.item_cents)}</b></div>`).join('')}</div>` : '<p class="muted">No sales of this on Offrava yet — you could be first. Tip: price a little under similar listings to sell fast.</p>'}
        <a class="btn btn-accent" style="margin-top:16px" href="#/sell?tab=new&title=${encodeURIComponent(t)}">List yours</a>`;
    };
    f.onsubmit = (e) => { e.preventDefault(); run(); }; if (q('#rsQ').value) run();
  }

  /* ---------------- Help ---------------- */
  function viewHelp(){
    const h = (id, t, b) => `<section class="card help" id="${id}"><h2>${t}</h2>${b}</section>`;
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb">Help</div><h1>Help center</h1><p class="muted">How Offrava keeps buying and selling fair and safe.</p></div>
      <div style="display:grid;gap:16px;padding-bottom:48px">
      ${h('protection','Buyer Protection','<p>Pay only inside Offrava. We hold your payment until you have the item. If it doesn\'t arrive, arrives damaged, or isn\'t as described, you get a <b>full refund</b> — even if the seller says "no returns". Never pay a seller outside the app; we can\'t protect those payments.</p>')}
      ${h('returns','Returns','<ul><li><b>Damaged / not as described / didn\'t arrive:</b> open a return within 30 days. The seller pays return shipping.</li><li><b>Changed your mind:</b> allowed if the seller offers 14- or 30-day returns. You pay return shipping.</li><li>The seller has 3 days to respond. If they don\'t, Offrava steps in automatically — and for items that never arrived you\'re refunded right away. We decide disputes within 2 business days.</li><li><b>Not sent at all?</b> Orders that aren\'t shipped within 4 days (or picked up within 7) are cancelled and refunded automatically.</li></ul>')}
      ${h('offers','How competing offers work','<p>Tell us what you want and for how long (1, 4 or 24 hours). Matching local sellers send <b>sealed</b> offers — nobody sees the others. Each seller can lower their price once. When time\'s up you see the best five, ranked by total price, condition, seller record, speed and returns. Nobody can pay to rank higher.</p>')}
      ${h('fees','Fees','<div id="helpFees"><p class="muted">Loading current fees…</p></div>')}
      ${h('pickup','Local pickup','<ul><li>Meet in a busy public place — the app suggests police safe exchange zones near you.</li><li>When you meet, check the item first. Then give the seller your <b>6-digit pickup code</b> from the order page. That code is how the seller gets paid, so only share it once you\'re happy.</li><li>No-show or not as described? Don\'t share the code; report a problem on the order.</li></ul>')}
      ${h('digital','Games &amp; software','<ul><li>Everything is sold by the developer who made it, and delivered instantly to your <a href="#/library">Library</a> as a download, a license key, or a private link.</li><li>Not opened yet? Refund with one tap within 14 days. Doesn\'t run or isn\'t as described? Report a problem — the maker fixes it or you get your money back.</li><li>Developers: sell from <a href="#/maker">My games &amp; software</a>.</li></ul>')}
      ${h('services','Hiring a pro','<ul><li>Describe the job once; nearby pros send sealed quotes. Compare price, rating and availability, then hire.</li><li>You pay through Offrava and the pro is paid only when the job is done — give them your completion code when you\'re happy.</li><li>Licensed trades (plumbing, electrical, HVAC) are checked by Offrava before pros can quote.</li></ul>')}
      ${h('reviews','Reviews','<p>After each order, buyer and seller rate each other with stars and a comment. Reviews stay hidden until both have written one, or 14 days pass, so nobody can retaliate. You can reply once to a review about you.</p>')}
      ${h('safety','Staying safe','<ul><li>Keep chats and payments in Offrava — phone numbers and emails are hidden automatically.</li><li>Meet in busy public places for pickup. Many St. Louis police stations have safe exchange zones.</li><li>Report anything suspicious with the 🚩 Report link.</li></ul>')}
      ${h('prohibited','Not allowed on Offrava','<p>Weapons and ammunition, drugs and drug paraphernalia, alcohol and tobacco, prescription medicine, live animals, recalled products, counterfeit or stolen goods, adult content, hazardous materials, gift cards and cash equivalents, and anything illegal in Missouri.</p>')}
      ${h('contact','Still need help?','<p>Problem with an order? Open it in <a href="#/orders">Orders</a> and tap <b>Report a problem</b> — your payment stays protected while we sort it out. For anything else, <a href="#/contact"><b>contact us</b></a>.</p><p class="muted" style="font-size:14px"><a href="#/terms">Terms of Service</a> · <a href="#/privacy">Privacy Policy</a></p>')}
      </div></div>`;
  }

  async function helpFees(){
    const el = q('#helpFees'); if (!el || !sb()) return;
    const { data: t } = await sb().from('platform_settings').select('*').eq('id', 1).maybeSingle(); if (!t || !q('#helpFees')) return;
    const p = (b) => (b / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%', d = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
    el.innerHTML = `<p><b>Buyers</b> pay the item price plus <b>Offrava Protection</b>: ${d(t.buyer_fee_fixed_cents)} + ${p(t.buyer_fee_bps)} of the item and delivery (${d(t.digital_buyer_fee_cents ?? 50)} on games &amp; software). It's shown before you pay and covers holding your money until delivery and refunds when something goes wrong.</p>
      <p><b>Sellers</b> pay nothing to list. When you sell: <b>${p(t.commission_bps)}</b> for people, <b>${p(t.business_bps)}</b> for shops and any sale won through competing offers, <b>${p(t.service_bps)}</b> on service jobs (minimum ${d(t.min_fee_cents)}). <b>Founding sellers pay 0%</b> for their first ${t.founding_days} days on up to ${d(t.founding_cap_cents)} of sales.</p>
      <p><b>Makers</b> (games &amp; software): <b>${p(t.maker_new_bps ?? 500)}</b> for your first ${t.maker_new_days ?? 90} days, then <b>${p(t.maker_bps ?? 1000)}</b>.</p>
      <p>You get paid when the buyer confirms, or automatically ${t.auto_complete_pickup_days} days after pickup / ${t.auto_complete_ship_days} days after shipping if no problem is reported. No paid placement — sponsored banners are always labeled and never change search results or offer rankings.</p>`;
  }

  /* ---------------- Register ---------------- */
  window.OffravaFeatures = { reviewCard, buyerBadge, saveSearch, paintBadges, heart, loadFavs, reportForm };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  const wrap = (v, w) => [v, () => { cleanup(); w && w(); }];
  Object.assign(R, {
    '#/':              wrap(viewHomeMe, wireHomeMe),
    '#/me':            wrap(viewMe, wireMe),
    '#/notifications': wrap(viewNotifs, wireNotifs),
    '#/search':        wrap(viewSearch, wireSearch),
    '#/watchlist':     wrap(listView('Watchlist', 'Watchlist'), wireWatch),
    '#/recent':        wrap(listView('Recently viewed', 'Recently viewed'), wireRecent),
    '#/buy-again':     wrap(listView('Buy again', 'Buy again'), wireBuyAgain),
    '#/item':          wrap(viewItem, wireItem),
    '#/store':         wrap(viewStore, wireStore),
    '#/cart':          wrap(viewCart, wireCart),
    '#/research':      wrap(viewResearch, wireResearch),
    '#/help':          wrap(viewHelp, () => { helpFees(); const id = params().get('s'); const el = id && document.getElementById(id); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50); })
  });
})();

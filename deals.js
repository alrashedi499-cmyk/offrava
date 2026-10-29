/* Offrava deals: "Make an offer" on items (like eBay Best Offer), questions & answers on items, and photos in reviews.
   #/deals — offers you sent and offers you received (accept / counter / decline). */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const cents = (v) => Math.round(parseFloat(String(v).replace(/[^0-9.]/g, '')) * 100);
  const param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
  const go = (h) => { location.hash = h; };
  const left = (t) => { const ms = new Date(t) - Date.now(); if (ms <= 0) return 'expired'; const h = Math.floor(ms / 36e5); return h >= 1 ? `${h}h left` : `${Math.max(1, Math.round(ms / 6e4))}m left`; };
  const live = (o) => ['pending', 'countered', 'accepted'].includes(o.status) && new Date(o.expires_at) > new Date();
  const errMsg = (e) => String(e?.message || e || 'Something went wrong.').replace(/^.*?ERROR:\s*/, '');
  const STATUS = { pending: ['Waiting for seller', 'st-wait'], countered: ['Counteroffer', 'st-wait'], accepted: ['Accepted — pay now', 'st-done'],
    declined: ['Declined', ''], expired: ['Expired', ''], withdrawn: ['Withdrawn', ''], purchased: ['Bought', 'st-done'] };
  const SELLER_STATUS = { pending: 'Needs your answer', countered: 'Waiting for buyer', accepted: 'Accepted — waiting for payment', purchased: 'Sold' };
  const chip = (o, seller) => { const s = live(o) || !['pending','countered','accepted'].includes(o.status) ? o.status : 'expired'; let [t, c] = STATUS[s] || [s, '']; if (seller && SELLER_STATUS[s]) t = SELLER_STATUS[s]; return `<span class="tag ${c}">${t}</span>`; };

  /* ================= On the item page ================= */
  async function itemOffer(el, l){
    if (!el) return;
    const me = A().user?.id;
    if (!l.offers_ok || l.status !== 'active' || l.seller_id === me) { el.innerHTML = ''; return; }
    let mine = null;
    if (me) { const { data } = await sb().from('listing_offers').select('*').eq('listing_id', l.id).eq('buyer_id', me).order('created_at', { ascending: false }).limit(1); mine = data?.[0] || null; }
    const open = mine && live(mine);
    if (open && mine.status === 'accepted') {
      el.innerHTML = `<div class="deal-card ok"><b>🎉 Your offer of ${money(mine.agreed_cents)} was accepted</b><small>Pay within ${left(mine.expires_at)} — then the deal ends.</small>
        <a class="btn btn-accent full" href="#/checkout?listing=${l.id}">Pay ${money(mine.agreed_cents)} now</a></div>`;
      return;
    }
    if (open && mine.status === 'countered') {
      el.innerHTML = `<div class="deal-card"><b>The seller countered: ${money(mine.counter_cents)}</b><small>You offered ${money(mine.amount_cents)} · ${left(mine.expires_at)}</small>
        ${mine.counter_note ? `<p class="deal-note">“${esc(mine.counter_note)}”</p>` : ''}
        <div class="acct-links"><button class="btn btn-accent" type="button" data-ob="accept">Accept ${money(mine.counter_cents)}</button><button class="btn btn-ghost" type="button" data-ob="decline">Decline</button></div><p class="form-msg" data-m style="margin:0"></p></div>`;
    } else if (open && mine.status === 'pending') {
      el.innerHTML = `<div class="deal-card"><b>You offered ${money(mine.amount_cents)}</b><small>Waiting for the seller · ${left(mine.expires_at)}</small>
        <button class="link-btn" type="button" data-ob="withdraw" style="align-self:flex-start">Withdraw offer</button><p class="form-msg" data-m style="margin:0"></p></div>`;
    } else {
      const last = mine && ['declined', 'expired'].includes(mine.status) || (mine && !live(mine) && mine.status !== 'purchased') ? `<small class="muted">Your last offer (${money(mine.amount_cents)}) was ${mine.status === 'declined' ? 'declined' : 'not answered in time'}.</small>` : '';
      el.innerHTML = `<button class="btn btn-ghost btn-lg full" type="button" id="mkOffer">💬 Make an offer</button>${last}<div id="offerForm"></div>`;
      q('#mkOffer', el).onclick = () => {
        if (!me) return go('#/login');
        const sug = [0.9, 0.85, 0.8].map(k => Math.round(l.price_cents * k / 100) * 100).filter(c => c < l.price_cents && c >= 100);
        q('#offerForm', el).innerHTML = `<form class="deal-card" id="ofF"><b>Your offer</b><small>Listed at ${money(l.price_cents)}. The seller has 48 hours to accept, counter or decline. If they accept, you'll have 48 hours to pay.</small>
          <div class="deal-sug">${sug.map(c => `<button type="button" class="chip-btn" data-sug="${c}">${money(c)}</button>`).join('')}</div>
          <div class="field"><label for="ofA">Amount</label><div class="adm-in"><span>$</span><input id="ofA" inputmode="decimal" required placeholder="${(sug[0] || l.price_cents) / 100}"></div></div>
          <div class="field"><label for="ofM">Message to the seller (optional)</label><input id="ofM" maxlength="300" placeholder="e.g. Can pick up today"></div>
          <button class="btn btn-dark full" type="submit">Send offer</button><p class="form-msg" data-m></p>
          <p class="muted" style="font-size:12px;margin:6px 0 0">An offer is a promise to buy if the seller accepts.</p></form>`;
        const f = q('#ofF', el);
        qa('[data-sug]', f).forEach(b => b.onclick = () => { q('#ofA', f).value = (Number(b.dataset.sug) / 100).toFixed(2); });
        f.onsubmit = async (e) => {
          e.preventDefault(); const b = f.querySelector('[type=submit]'), m = f.querySelector('[data-m]'); b.disabled = true;
          const { data, error } = await sb().rpc('listing_offer_make', { p_listing: l.id, p_amount: cents(q('#ofA', f).value), p_message: q('#ofM', f).value });
          b.disabled = false;
          if (error) { m.textContent = errMsg(error); m.className = 'form-msg err'; return; }
          window.OffravaSound?.play(data.status === 'accepted' ? 'done' : 'message');
          itemOffer(el, l);
        };
        q('#ofA', f).focus();
      };
      return;
    }
    qa('[data-ob]', el).forEach(b => b.onclick = async () => {
      b.disabled = true;
      const { error } = await sb().rpc('listing_offer_buyer', { p_offer: mine.id, p_action: b.dataset.ob });
      if (error) { const m = q('[data-m]', el); m.textContent = errMsg(error); m.className = 'form-msg err'; b.disabled = false; return; }
      itemOffer(el, l);
    });
  }

  /* ================= Questions & answers ================= */
  async function itemQA(el, l){
    if (!el) return;
    const me = A().user?.id, seller = l.seller_id === me;
    const { data } = await sb().from('listing_questions').select('*').eq('listing_id', l.id).eq('hidden', false).order('created_at', { ascending: false }).limit(50);
    const list = data || [];
    const answered = list.filter(x => x.answer), waiting = list.filter(x => !x.answer);
    el.innerHTML = `<div class="sec-head"><h2>Questions & answers</h2></div><div class="card qa-card">
      ${!seller && l.status === 'active' ? `<form class="qa-ask" id="qaF"><label class="sr" for="qaT">Ask the seller</label><input id="qaT" maxlength="500" placeholder="Ask about size, condition, fit…"><button class="btn btn-dark" type="submit">Ask</button></form><p class="form-msg" id="qaM"></p>` : ''}
      ${seller && waiting.length ? `<p class="muted" style="margin:0 0 8px"><b>${waiting.length}</b> question${waiting.length > 1 ? 's' : ''} waiting for your answer. Answers are public, so everyone sees them.</p>` : ''}
      ${[...(seller ? waiting : waiting.filter(x => x.asker_id === me)), ...answered].map(x => `<div class="qa-item">
        <div class="qa-q"><b>Q</b><span>${esc(x.question)}<small>${esc(x.asker_name)} · ${new Date(x.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></span></div>
        ${x.answer ? `<div class="qa-a"><b>A</b><span>${esc(x.answer)}<small>Seller</small></span></div>`
          : seller ? `<form class="qa-ans" data-qa="${x.id}"><input maxlength="1000" placeholder="Write your answer" required><button class="btn btn-accent" type="submit">Answer</button><button class="link-btn" type="button" data-hide="${x.id}">Hide</button></form>`
          : '<div class="qa-a muted"><span>Waiting for the seller to answer — only you see this until then.</span></div>'}</div>`).join('')
        || '<p class="muted" style="margin:6px 0 0">No questions yet.</p>'}</div>`;
    const f = q('#qaF', el); if (f) f.onsubmit = async (e) => {
      e.preventDefault(); if (!me) return go('#/login');
      const t = q('#qaT', el).value.trim(); if (!t) return;
      const { error } = await sb().rpc('listing_question_ask', { p_listing: l.id, p_question: t });
      if (error) { q('#qaM', el).textContent = errMsg(error); q('#qaM', el).className = 'form-msg err'; return; }
      itemQA(el, l);
    };
    qa('[data-qa]', el).forEach(f2 => f2.onsubmit = async (e) => {
      e.preventDefault(); const { error } = await sb().rpc('listing_question_answer', { p_question: Number(f2.dataset.qa), p_answer: f2.querySelector('input').value });
      if (!error) itemQA(el, l); else alert(errMsg(error));
    });
    qa('[data-hide]', el).forEach(b => b.onclick = async () => { await sb().rpc('listing_question_hide', { p_question: Number(b.dataset.hide) }); itemQA(el, l); });
    if (param('qa')) el.scrollIntoView({ behavior: 'smooth' });
  }

  /* ================= #/deals: offers sent & received ================= */
  function viewDeals(){
    if (!A().user) return `<div class="wrap narrow"><div class="card empty" style="margin:40px 0"><b>Sign in to see your offers.</b><a class="btn btn-dark" href="#/login">Sign in</a></div></div>`;
    const tab = param('tab') || (A().seller?.status === 'approved' ? 'received' : 'sent');
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb">My Offrava / Offers</div><h1>Offers on items</h1>
      <p class="muted">Price offers on listed items. Each step has 48 hours.</p></div>
      ${A().seller ? `<div class="seg" style="max-width:420px"><button type="button" data-dt="received" class="${tab === 'received' ? 'on' : ''}">Received</button><button type="button" data-dt="sent" class="${tab === 'sent' ? 'on' : ''}">Sent</button></div>` : ''}
      <div id="dealList" style="padding:16px 0 48px"><p class="muted">Loading…</p></div></div>`;
  }
  async function wireDeals(){
    const box = q('#dealList'); if (!box) return;
    qa('[data-dt]').forEach(b => b.onclick = () => go('#/deals?tab=' + b.dataset.dt));
    const tab = param('tab') || (A().seller?.status === 'approved' ? 'received' : 'sent');
    const me = A().user.id, col = tab === 'received' ? 'seller_id' : 'buyer_id';
    const { data, error } = await sb().from('listing_offers').select('*, listings(id,title,photos,price_cents,status,quantity)').eq(col, me).order('created_at', { ascending: false }).limit(100);
    if (!q('#dealList')) return;
    if (error) { box.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`; return; }
    if (!data.length) { box.innerHTML = `<div class="card empty"><b>${tab === 'received' ? 'No offers yet' : 'You haven\'t made any offers'}</b><p class="muted">${tab === 'received' ? 'Buyers can send offers on your items. You can switch it off or set auto-accept and auto-decline amounts on each listing.' : 'Tap “Make an offer” on any item to suggest your price.'}</p><a class="btn btn-dark" href="${tab === 'received' ? '#/sell?tab=lst' : '#/browse'}">${tab === 'received' ? 'My listings' : 'Browse'}</a></div>`; return; }
    box.innerHTML = data.map(o => {
      const l = o.listings || {}, img = l.photos?.[0];
      const act = tab === 'received' && o.status === 'pending' && live(o)
        ? `<div class="acct-links" style="margin-top:10px"><button class="btn btn-accent" type="button" data-r="accept" data-id="${o.id}">Accept ${money(o.amount_cents)}</button>
           <button class="btn btn-ghost" type="button" data-r="counter" data-id="${o.id}">Counter</button><button class="btn btn-ghost" type="button" data-r="decline" data-id="${o.id}">Decline</button></div><div data-cbox="${o.id}"></div>` : '';
      const line = o.status === 'countered' ? `Offer ${money(o.amount_cents)} → counter <b>${money(o.counter_cents)}</b>` : o.agreed_cents ? `Deal at <b>${money(o.agreed_cents)}</b>` : `Offer <b>${money(o.amount_cents)}</b>`;
      return `<div class="card deal-row"><a class="thumb mini" href="#/item?id=${l.id}">${img ? `<img src="${esc(img)}" alt="">` : ''}</a>
        <div style="min-width:0;flex:1"><a href="#/item?id=${l.id}"><b>${esc(l.title || 'Item')}</b></a>
          <div class="muted" style="font-size:14px">${line} · listed ${money(l.price_cents || 0)}</div>
          <div style="margin-top:6px">${chip(o, tab === 'received')} ${live(o) ? `<small class="muted">${left(o.expires_at)}</small>` : ''}</div>
          ${o.message ? `<p class="deal-note">“${esc(o.message)}”</p>` : ''}
          ${tab === 'sent' && live(o) && o.status !== 'pending' ? `<a class="btn btn-accent" style="margin-top:8px" href="#/item?id=${l.id}">${o.status === 'accepted' ? 'Pay now' : 'Answer the counteroffer'}</a>` : ''}
          ${act}<p class="form-msg" data-m="${o.id}"></p></div></div>`;
    }).join('');
    qa('[data-r]', box).forEach(b => b.onclick = async () => {
      const id = b.dataset.id, o = data.find(x => x.id === id), m = q(`[data-m="${id}"]`, box);
      if (b.dataset.r === 'counter') {
        const cb = q(`[data-cbox="${id}"]`, box);
        cb.innerHTML = `<form class="inline-form" style="margin-top:8px"><div class="adm-in" style="max-width:150px"><span>$</span><input inputmode="decimal" required placeholder="${((o.amount_cents + o.listings.price_cents) / 200).toFixed(0)}"></div>
          <input maxlength="300" placeholder="Note (optional)" style="flex:1"><button class="btn btn-dark" type="submit">Send counter</button></form>`;
        const f = cb.querySelector('form'); f.onsubmit = async (e) => {
          e.preventDefault(); const [a, n] = f.querySelectorAll('input');
          const { error } = await sb().rpc('listing_offer_respond', { p_offer: id, p_action: 'counter', p_counter: cents(a.value), p_note: n.value });
          if (error) { m.textContent = errMsg(error); m.className = 'form-msg err'; return; } wireDeals();
        };
        return;
      }
      b.disabled = true;
      const { error } = await sb().rpc('listing_offer_respond', { p_offer: id, p_action: b.dataset.r });
      if (error) { m.textContent = errMsg(error); m.className = 'form-msg err'; b.disabled = false; return; }
      if (b.dataset.r === 'accept') window.OffravaSound?.play('sale');
      wireDeals();
    });
  }

  /* ================= Review photos ================= */
  async function shrink(file, max = 1280){
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  }
  async function uploadReviewPhotos(reviewId, files, existing = []){
    const uid = A().user.id, urls = [...existing];
    for (const f of [...files].slice(0, 4 - urls.length)) {
      const blob = await shrink(f), path = `${uid}/${reviewId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const up = await sb().storage.from('review-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      urls.push(sb().storage.from('review-photos').getPublicUrl(path).data.publicUrl);
    }
    const { error } = await sb().rpc('review_set_photos', { p_review: reviewId, p_photos: urls });
    if (error) throw error;
    return urls;
  }
  const photosHtml = (r) => r.photos?.length ? `<div class="rv-photos">${r.photos.map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="Review photo" loading="lazy"></a>`).join('')}</div>` : '';

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/deals'] = [viewDeals, wireDeals];
  window.OffravaDeals = { itemOffer, itemQA, uploadReviewPhotos, photosHtml };
})();

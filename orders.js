/* Offrava: checkout (Apple Pay / Google Pay / card, saved addresses), orders, returns, and buyer–seller messages. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const C = window.OFFRAVA_CONFIG || {};
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + ((c||0)/100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const go = (h) => { location.hash = h; };
  const when = (d) => d ? new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
  const day = (d) => d ? new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';
  const COND = { new:'New', open_box:'Open box', like_new:'Like new', excellent:'Excellent', good:'Good', fair:'Fair', refurbished:'Refurbished' };
  const RET = { no_returns:'No returns (damaged / not as described still covered)', '14_days':'14-day returns', '30_days':'30-day returns' };
  const IMG = '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;
  const STATUS = {
    pending_payment: ['Not paid yet', ''], paid: ['Paid · waiting for seller', 'st-wait'], shipped: ['On its way', 'st-go'],
    completed: ['Complete', 'st-done'], cancelled: ['Cancelled', 'st-off'], refunded: ['Refunded', 'st-off']
  };
  const RSTATUS = { requested:'Return requested', approved:'Return approved', item_sent:'Item sent back', escalated:'Offrava is reviewing', refunded:'Refunded', closed:'Return closed' };
  const REASON = { not_as_described:'Not as described', damaged:'Arrived damaged', not_received:'Didn\'t arrive', changed_mind:'Changed my mind' };
  // Carrier tracking page for a tracking number
  const trackUrl = (carrier, num) => {
    const n = encodeURIComponent(String(num || '').replace(/\s+/g, '')); if (!n) return null;
    const c = String(carrier || '').toLowerCase();
    if (c.includes('ups')) return 'https://www.ups.com/track?tracknum=' + n;
    if (c.includes('usps') || c.includes('postal')) return 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' + n;
    if (c.includes('fedex')) return 'https://www.fedex.com/fedextrack/?trknbr=' + n;
    if (c.includes('dhl')) return 'https://www.dhl.com/us-en/home/tracking.html?tracking-id=' + n;
    return null;
  };
  const chip = (s) => { const [t, c] = STATUS[s] || [s, '']; return `<span class="tag ${c}">${esc(t)}</span>`; };

  // Cleanup (live chat channel, timers) when leaving a page
  let cleanups = [];
  const cleanup = () => { while (cleanups.length) { try { cleanups.pop()(); } catch(_){} } };
  window.addEventListener('hashchange', cleanup);

  async function call(action, body = {}){
    const { data, error } = await sb().functions.invoke('orders', { body: { action, ...body } });
    if (error) {
      let m = error.message;
      try { const j = await error.context.json(); if (j?.error) m = j.error; } catch(_){}
      throw new Error(m);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  const sync = (body) => call('sync', body).catch((e) => console.warn('sync', e.message));
  const rpcErr = (e) => e?.message || String(e);

  /* ============================== Checkout ==============================
     1) Payment method: Apple Pay · Google Pay · Card   2) Delivery + pick / add / confirm the address   3) Review & pay */
  const WALLET_ICON = {
    apple: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9s-1.8-.9-3-.9C6.9 7.3 5.4 8.2 4.6 9.7c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 2.9 2.4 1.2 0 1.6-.8 3-.8s1.8.8 3 .7c1.3 0 2.1-1.2 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.4-1-2.4-4zM14.1 5.5c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3z"/></svg>',
    google: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.2 22 12 22z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.2 2 4.8 4.2 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z"/></svg>',
    card: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M2.5 9.5h19" stroke="currentColor" stroke-width="1.6"/><path d="M6 15h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  function viewCheckout(){
    if (!A().user) return gate('Sign in to buy. It takes a minute.');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Checkout</div><h1>Checkout</h1></div>
      <div class="flow">
        <div class="co-steps" id="coForm">
          <section class="card co-step" id="st1"><h3><span class="co-n">1</span> How do you want to pay?</h3><div class="co-methods" id="coMethods"><div class="muted">Checking what works on this device…</div></div></section>
          <section class="card co-step" id="st2"><h3><span class="co-n">2</span> <span id="st2t">How do you want it?</span></h3><div class="choices" id="coFul"></div><div id="coShip"></div></section>
          <section class="card co-step is-locked" id="st3"><h3><span class="co-n">3</span> Review &amp; pay</h3>
            <div id="coReview"></div>
            <div id="coPay"></div>
            <div id="coWallet"></div>
            <button class="btn btn-accent btn-lg" type="button" id="coBtn" style="width:100%;margin-top:16px;display:none" disabled>Pay</button>
            <p id="coMsg" class="form-msg" role="status" aria-live="polite"></p>
            <p class="muted" style="font-size:13px;margin:8px 0 0">Payments are handled by Stripe. Offrava never sees your card number.</p>
          </section>
        </div>
        <aside class="card summary" id="coSum"><div class="muted">Loading…</div></aside>
      </div></div>`;
  }
  async function wireCheckout(){
    if (!q('#coForm')) return;
    const p = params(); const listingId = p.get('listing'), offerId = p.get('offer'), quoteId = p.get('quote'), productId = p.get('product');
    const msg = (t, ok) => { const m = q('#coMsg'); m.textContent = t; m.className = 'form-msg ' + (ok ? 'ok' : 'err'); if (t && !ok) m.scrollIntoView({ block: 'nearest' }); };
    if (!listingId && !offerId && !quoteId && !productId) return msg('Nothing to buy here. Go back and pick an item.');
    if (!window.Stripe || !C.STRIPE_PUBLISHABLE_KEY) return msg('Payments are not available right now. Refresh the page.');
    const AD = window.OffravaAddresses;

    // What delivery choices does this item have?
    let canPickup = true, canShip = false, shipCents = 0, seller = 'Seller';
    if (quoteId) { canPickup = false; canShip = false; seller = 'your pro'; }
    else if (productId) { canPickup = false; canShip = false; const { data: d } = await sb().from('digital_products').select('sellers(display_name)').eq('id', productId).maybeSingle(); seller = d?.sellers?.display_name || 'the maker'; }
    else if (offerId) {
      const { data: o } = await sb().from('offers').select('delivery_cents,listings(pickup,shipping),sellers(display_name)').eq('id', offerId).maybeSingle();
      if (o) { canPickup = !!o.listings?.pickup; canShip = !!(o.listings?.shipping || o.delivery_cents > 0); shipCents = o.delivery_cents; seller = o.sellers?.display_name || seller; }
    } else {
      const { data: l } = await sb().from('listings').select('pickup,shipping,shipping_cents,sellers(display_name)').eq('id', listingId).maybeSingle();
      if (l) { canPickup = l.pickup; canShip = l.shipping; shipCents = l.shipping_cents; seller = l.sellers?.display_name || seller; }
    }
    let ful = productId ? 'digital' : quoteId ? 'service' : canShip ? 'shipping' : 'pickup';
    if (quoteId) { q('#st2t').textContent = 'Booking'; q('#coFul').innerHTML = '<p class="muted" style="margin:0">You pay now. The pro is paid only when the job is done — you give them your completion code, or confirm in the app.</p>'; }
    else if (productId) { q('#st2t').textContent = 'Instant download'; q('#coFul').innerHTML = '<p class="muted" style="margin:0">It goes to your Library the moment you pay. Not opened yet? Refund on request within 14 days. Doesn\'t work or not as described? Report it and get your money back.</p>'; }
    else q('#coFul').innerHTML = [
      canShip && `<label class="choice"><input type="radio" name="ful" value="shipping" ${ful==='shipping'?'checked':''}><span>Ship to me${shipCents?` · ${money(shipCents)}`:' · Free'}</span></label>`,
      canPickup && `<label class="choice"><input type="radio" name="ful" value="pickup" ${ful==='pickup'?'checked':''}><span>Local pickup · Free</span></label>`
    ].filter(Boolean).join('');

    const stripe = Stripe(C.STRIPE_PUBLISHABLE_KEY);
    const appearance = { theme: 'stripe', variables: { colorPrimary: '#121212', colorText: '#121212', fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '12px', spacingUnit: '4px' } };
    let elements = null, secret = null, order = null, method = null, avail = { apple: false, google: false };
    let addrs = [], picked = null, confirmed = false, adding = false, mounted = null, loading = false;

    // Sales tax line: worked out by Stripe Tax for where the sale happens
    function taxLine(o){
      if (o.tax_pending) return `<div class="sum-line muted"><span>Sales tax</span><span>After you confirm the address</span></div>`;
      if (!o.tax_cents) return '';
      const l = (o.tax_lines || [])[0] || {}, label = esc(l.label || 'Sales tax') + (l.region ? ` (${esc(l.region)})` : '');
      return o.tax_added_cents ? `<div class="sum-line"><span title="Collected by Offrava and paid to the state">${label} ⓘ</span><b>${money(o.tax_added_cents)}</b></div>`
        : `<div class="sum-line muted"><span>Includes ${label}</span><span>${money(o.tax_cents)}</span></div>`;
    }
    function summary(){
      const o = order;
      q('#coSum').innerHTML = `<h3>Your order</h3>
        <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px">
          <div class="thumb mini">${o.photo ? `<img src="${esc(o.photo)}" alt="">` : IMG}</div>
          <div><b>${esc(o.title)}</b><div class="muted" style="font-size:13px">${esc(COND[o.condition]||'')}${o.condition ? ' · ' : ''}sold by ${esc(seller)}</div></div></div>
        <div class="sum-line"><span>${o.fulfillment==='service'?'Job price':o.fulfillment==='digital'?'Price':'Item'}</span><b>${money(o.item_cents)}</b></div>
        ${o.fulfillment==='service' || o.fulfillment==='digital' ? '' : `<div class="sum-line"><span>${o.fulfillment==='shipping'?'Shipping':'Pickup'}</span><b>${o.delivery_cents?money(o.delivery_cents):'Free'}</b></div>`}
        ${o.buyer_fee_cents ? `<div class="sum-line"><span title="Holds your money until you have the item, and refunds you if something goes wrong">Offrava Protection ⓘ</span><b>${money(o.buyer_fee_cents)}</b></div>` : ''}
        ${taxLine(o)}
        <div class="sum-line" style="font-size:18px"><span>Total</span><b>${money(o.total_cents)}</b></div>
        ${o.fulfillment==='digital' ? `<div class="note"><b>Made by an independent maker.</b> 90%+ of the price goes to them. The maker is paid only after a week, so problems get fixed or refunded.</div>` : `<div class="note"><b>Your money is protected.</b> We hold the payment until you get the item. Damaged or not as described? You get a full refund.<br><span style="display:block;margin-top:6px">Returns: ${esc(RET[o.return_policy]||'')}</span></div>`}`;
    }

    /* ---- Step 1: payment method ---- */
    function drawMethods(){
      const opts = [['apple', 'Apple Pay', 'Pay with Face ID or Touch ID'], ['google', 'Google Pay', 'Pay with a card saved in Google'], ['card', 'Credit or debit card', 'Visa, Mastercard, Amex, Discover']];
      q('#coMethods').innerHTML = opts.map(([k, t, s]) => {
        const ok = k === 'card' || avail[k];
        return `<label class="co-method ${ok ? '' : 'is-off'}"><input type="radio" name="pm" value="${k}" ${method === k ? 'checked' : ''} ${ok ? '' : 'disabled'}>
          <span class="co-mi">${WALLET_ICON[k]}</span><span class="co-mt"><b>${t}</b><small>${ok ? s : `Not set up on this ${k === 'apple' ? 'device (needs Safari + Apple Wallet)' : 'browser (needs Chrome + Google Pay)'}`}</small></span><span class="co-radio" aria-hidden="true"></span></label>`;
      }).join('');
    }
    q('#coMethods').addEventListener('change', (e) => { if (e.target.name === 'pm') { method = e.target.value; step3(); } });

    /* ---- Step 2: delivery + address ---- */
    function drawShip(){
      const box = q('#coShip');
      if (ful !== 'shipping') { box.innerHTML = ''; confirmed = true; step3(); return; }
      if (adding || !addrs.length) {
        box.innerHTML = `<div class="co-sub">${addrs.length ? 'New address' : 'Where should we ship it?'}</div><div id="coNewAddr"></div>`;
        AD.form(q('#coNewAddr'), { submitText: 'Use this address', onCancel: addrs.length ? () => { adding = false; drawShip(); } : null,
          onDone: async (a, saved) => { adding = false; if (saved) addrs = await AD.list(); else { a.id = 'temp'; a._temp = true; addrs = [a, ...addrs.filter(x => x.id !== 'temp')]; } picked = a.id; confirmed = true; load(); } });
        confirmed = false; step3(); return;
      }
      if (!picked || !addrs.find(a => a.id === picked)) picked = (addrs.find(a => a.is_default) || addrs[0]).id;
      const cur = addrs.find(a => a.id === picked);
      if (confirmed) {
        box.innerHTML = `<div class="co-sub">Ship to</div><div class="co-addr-ok"><div>${AD.block(cur)}</div><button type="button" class="btn btn-ghost" id="coChange">Change</button></div>`;
        q('#coChange').onclick = () => { confirmed = false; drawShip(); };
      } else {
        box.innerHTML = `<div class="co-sub">Ship to</div><div class="co-addrs">${addrs.map(a => `<label class="co-addr"><input type="radio" name="addr" value="${a.id}" ${a.id === picked ? 'checked' : ''}>
            <span><span class="co-at">${esc(a.label || 'Address')}${a.is_default ? ' <span class="tag st-done">Default</span>' : ''}${a._temp ? ' <span class="tag">Not saved</span>' : ''}</span>${AD.block(a)}</span></label>`).join('')}</div>
          <div class="acct-links" style="margin-top:12px"><button type="button" class="btn btn-dark" id="coUse">Deliver to this address</button><button type="button" class="btn btn-ghost" id="coAdd">+ Add a new address</button><a class="btn btn-ghost" href="#/addresses">Manage</a></div>`;
        qa('[name=addr]').forEach(r => r.onchange = () => { picked = r.value; });
        q('#coUse').onclick = async () => { confirmed = true; await load(); q('#st3').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
        q('#coAdd').onclick = () => { adding = true; drawShip(); };
      }
      step3();
    }
    q('#coFul').addEventListener('change', (e) => { if (e.target.name === 'ful') { ful = e.target.value; confirmed = false; load(); } });
    const shipTo = () => { if (ful !== 'shipping') return null; const a = addrs.find(x => x.id === picked); return a ? AD.toShipping(a) : null; };

    /* ---- Step 3: review & pay ---- */
    function step3(){
      const ready = !!(method && confirmed && order && !loading && !order.tax_pending);
      q('#st3').classList.toggle('is-locked', !ready);
      q('#st1').classList.toggle('is-done', !!method);
      q('#st2').classList.toggle('is-done', confirmed);
      const s = shipTo();
      q('#coReview').innerHTML = ready ? `<ul class="co-review">
          <li><span>Pay with</span><b>${{ apple: 'Apple Pay', google: 'Google Pay', card: 'Card' }[method]}</b></li>
          <li><span>${ful === 'shipping' ? 'Ship to' : ful === 'pickup' ? 'Delivery' : ful === 'digital' ? 'Delivery' : 'Booking'}</span><b>${ful === 'shipping' ? esc(s.name) + ', ' + esc(AD.oneLine({ ...s.address })) : ful === 'pickup' ? 'Local pickup — agree on a safe spot in chat' : ful === 'digital' ? 'Instant, to your Library' : 'Paid now, pro paid when done'}</b></li>
          ${order.tax_cents ? `<li><span>${order.tax_added_cents ? 'Sales tax' : 'Tax included'}</span><b>${money(order.tax_cents)}</b></li>` : ''}
          <li><span>Total</span><b>${money(order.total_cents)}</b></li></ul>`
        : `<p class="muted" style="margin:0">${!method ? 'Choose how to pay first.' : !confirmed ? 'Confirm where it goes.' : 'Updating your total…'}</p>`;
      q('#coPay').style.display = ready && method === 'card' ? '' : 'none';
      q('#coWallet').style.display = ready && method !== 'card' ? '' : 'none';
      q('#coBtn').style.display = ready && method === 'card' ? '' : 'none';
      if (ready && mounted !== method) mountPay();   // wallet buttons are only drawn once visible
    }
    function mountPay(){
      if (!elements || !method) return;
      mounted = method;
      ['payment', 'expressCheckout'].forEach(t => { const el = elements.getElement && elements.getElement(t); if (el) el.destroy(); });
      q('#coPay').innerHTML = ''; q('#coWallet').innerHTML = '';
      const btn = q('#coBtn');
      if (method === 'card') {
        const pe = elements.create('payment', { layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' }, paymentMethodOrder: ['card'] });
        pe.mount('#coPay'); btn.disabled = false; btn.textContent = `Pay ${money(order.total_cents)}`;
      } else {
        const ece = elements.create('expressCheckout', {
          paymentMethods: { applePay: method === 'apple' ? 'always' : 'never', googlePay: method === 'google' ? 'always' : 'never', link: 'never', paypal: 'never', amazonPay: 'never', klarna: 'never' },
          buttonType: { applePay: 'buy', googlePay: 'buy' }, buttonHeight: 52
        });
        ece.mount('#coWallet');
        ece.on('click', (ev) => { if (!confirmed) { msg('Confirm the address first.'); return; } msg(''); ev.resolve({}); });
        ece.on('confirm', () => pay());
      }
    }
    async function pay(){
      const b = q('#coBtn'); msg('');
      if (!confirmed) return msg('Confirm the address first.');
      const s = shipTo();
      if (method === 'card') busy(b, true);
      const confirmParams = { return_url: location.href.split('#')[0] + (productId ? '#/library?new=' : '#/order?id=') + order.id };
      if (s) confirmParams.shipping = s;
      const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams });
      if (error) { busy(b, false); return msg(error.message || 'Payment didn\'t go through. Try again or pick another way to pay.'); }
      msg('Payment received. Opening your order…', true);
      if (s && picked && picked !== 'temp') sb().from('addresses').update({ last_used_at: new Date().toISOString() }).eq('id', picked).then(() => {});
      await sync({ order_id: order.id, ship_to: s });
      go('#/thanks?order=' + order.id);
    }
    q('#coBtn').onclick = pay;

    async function load(){
      msg(''); loading = true; step3();
      let res;
      try { res = await call('checkout', { listing_id: listingId, offer_id: offerId, quote_id: quoteId, product_id: productId, fulfillment: ful, ship_to: confirmed ? shipTo() : null }); }
      catch (e) {
        loading = false;
        if (order && ful === 'shipping' && confirmed) { confirmed = false; drawShip(); return msg(e.message); }   // e.g. address not found for sales tax
        q('#coSum').innerHTML = '<div class="muted">—</div>'; return msg(e.message);
      }
      loading = false;
      if (res.paid) return go(productId ? '#/library' : '#/order?id=' + res.order_id);
      order = res.order; summary();
      if (secret !== res.client_secret || !elements) {
        secret = res.client_secret;
        elements = stripe.elements({ clientSecret: secret, appearance });
        mounted = null;
      } else { await elements.fetchUpdates(); if (method === 'card') q('#coBtn').textContent = `Pay ${money(order.total_cents)}`; }
      drawShip();
    }

    // Which wallets work here? (Apple Pay: Safari with a card in Wallet. Google Pay: Chrome with a saved card.)
    [addrs] = await Promise.all([AD ? AD.list() : [], (async () => {
      try {
        const pr = stripe.paymentRequest({ country: 'US', currency: 'usd', total: { label: 'Offrava', amount: 100 } });
        const r = await pr.canMakePayment();
        avail = { apple: !!r?.applePay, google: !!r?.googlePay };
      } catch (_) {}
    })()]);
    method = avail.apple ? 'apple' : avail.google ? 'google' : null;   // suggest the wallet, but the buyer chooses
    drawMethods();
    await load();
  }

  /* ============================== Thank-you (after paying) ============================== */
  function viewThanks(){
    if (!A().user) return gate('Sign in to see your order.');
    return `<div class="wrap narrow"><div class="thanks" id="tyBox"><div class="ty-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
      <h1>Thank you!</h1><p class="muted">Confirming your payment…</p></div></div>`;
  }
  async function wireThanks(){
    const box = q('#tyBox'); if (!box) return;
    const id = params().get('order');
    let o = null;
    for (let i = 0; i < 6 && !(o && o.status !== 'pending_payment'); i++) {   // the payment may take a moment to confirm
      const { data } = await sb().from('orders').select('*, sellers(display_name)').eq('id', id).maybeSingle();
      o = data; if (o && o.status === 'pending_payment') { await sync({ order_id: id }); await new Promise(r => setTimeout(r, 1500)); }
    }
    if (!q('#tyBox')) return;
    if (!o) { box.innerHTML = `<h1>Order not found</h1><a class="btn btn-dark" href="#/orders">My orders</a>`; return; }
    const name = (A().profile?.full_name || '').split(' ')[0];
    const who = o.sellers?.display_name || 'the seller';
    const dig = o.fulfillment === 'digital', svc = o.fulfillment === 'service';
    const steps = dig ? [['📥', 'It\'s in your Library now', 'Download it or see your key any time.'], ['⭐', 'Tell others what you think', `Rate it after you've tried it.`]]
      : svc ? [['💬', `${esc(who)} will message you`, 'Agree on the exact time and address in the chat.'], ['🔐', 'Your money is held safely', 'Give the pro your completion code only when the job is done right.'], ['⭐', 'Rate the pro', 'Help your neighbors pick great pros.']]
      : o.fulfillment === 'shipping' ? [['📦', `${esc(who)} ships within 3 days`, 'You\'ll get a notification with the tracking number.'], ['🔐', 'Your money is held safely', 'The seller is paid only after it arrives and you\'re happy.'], ['✅', 'Tap "I got it" when it arrives', 'Something wrong? Open a return from the order.']]
      : [['💬', `Plan the pickup with ${esc(who)}`, 'Meet at a safe public spot — the order page suggests some nearby.'], ['🔍', 'Check the item first', 'Then show your 6-digit pickup code. That\'s what pays the seller.'], ['⭐', 'Rate each other', 'It keeps Offrava friendly and safe.']];
    box.innerHTML = `<div class="ty-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
      <h1>Thank you${name ? ', ' + esc(name) : ''}!</h1>
      <p class="ty-sub">${o.status === 'pending_payment' ? 'Your payment is being confirmed — we\'ll notify you in a moment.' : dig ? 'Your purchase is ready.' : svc ? 'You\'re booked.' : 'Your order is confirmed.'}</p>
      <div class="ty-card">
        <div class="ty-item"><div class="thumb mini">${o.photo ? `<img src="${esc(o.photo)}" alt="">` : IMG}</div>
          <div><b>${esc(o.title)}</b><div class="muted" style="font-size:13px">Order #${esc(String(o.id).slice(0, 8).toUpperCase())} · from ${esc(who)}</div></div>
          <div class="ty-total">${money(o.total_cents)}</div></div>
        ${o.ship_to?.address ? `<div class="ty-ship">Ships to <b>${esc(o.ship_to.name || '')}</b>, ${esc(o.ship_to.address.line1 || '')}, ${esc(o.ship_to.address.city || '')} ${esc(o.ship_to.address.state || '')}</div>` : ''}
        <ol class="ty-steps">${steps.map(([e, t, d]) => `<li><span class="ty-e" aria-hidden="true">${e}</span><span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ol>
      </div>
      <div class="ty-actions">${dig ? `<a class="btn btn-accent btn-lg" href="#/library?new=${o.id}">Open my Library</a>` : `<a class="btn btn-accent btn-lg" href="#/order?id=${o.id}">View my order</a>`}
        ${o.conversation_id ? `<a class="btn btn-ghost btn-lg" href="#/messages?c=${o.conversation_id}">Message ${svc ? 'the pro' : dig ? 'the maker' : 'the seller'}</a>` : ''}
        <a class="btn btn-ghost btn-lg" href="#/">Keep shopping</a></div>
      <p class="muted ty-foot"><a href="#/receipt?order=${o.id}"><b>View receipt</b></a> · A copy is on its way to your email. Protected by Offrava — we hold your payment until you're happy.</p>`;
    confetti(box);
    window.OffravaSound && OffravaSound.play('thanks');
  }
  function confetti(host){
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const wrap = document.createElement('div'); wrap.className = 'ty-confetti'; wrap.setAttribute('aria-hidden', 'true');
    const colors = ['#C6F432', '#121212', '#2B59FF', '#FFB020', '#FF5C8A', '#3DD68C'];
    wrap.innerHTML = Array.from({ length: 70 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${(Math.random() * .6).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s;transform:rotate(${Math.random() * 360}deg);width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px"></i>`).join('');
    host.prepend(wrap); setTimeout(() => wrap.remove(), 4500);
  }

  /* ============================== Orders list ============================== */
  function viewOrders(){
    if (!A().user) return gate('Sign in to see your orders.');
    const tab = params().get('tab') || 'buy';
    return `<div class="wrap"><div class="page-head"><div class="crumb">Account / Orders</div><h1>Orders</h1></div>
      ${A().seller ? `<div class="seg" style="max-width:420px"><button type="button" data-ot="buy" class="${tab==='buy'?'on':''}">Purchases</button><button type="button" data-ot="sell" class="${tab==='sell'?'on':''}">Sales</button></div>` : ''}
      ${A().seller && tab==='sell' ? '<p style="margin:10px 0 0"><a href="#/statement"><b>📄 Monthly sales statement</b></a> <span class="muted">— fees, payouts, CSV for taxes</span></p>' : ''}
      <section style="padding-top:8px;padding-bottom:48px"><div id="olist" style="display:grid;gap:12px"><div class="muted">Loading…</div></div></section></div>`;
  }
  async function wireOrders(){
    const box = q('#olist'); if (!box) return;
    document.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => go('#/orders?tab=' + b.dataset.ot));
    const tab = A().seller ? (params().get('tab') || 'buy') : 'buy';
    sync({}).then(() => { if (q('#olist')) render(); });   // also pays sellers whose waiting time passed
    async function render(){
      const col = tab === 'sell' ? 'seller_id' : 'buyer_id';
      const { data, error } = await sb().from('orders').select('id,title,photo,total_cents,fee_cents,payout_cents,status,fulfillment,created_at,paid_at,buyer_name,order_returns(status)')
        .eq(col, A().user.id).neq('status', 'pending_payment').order('created_at', { ascending: false }).limit(100);
      if (error) return box.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
      if (!data.length) return box.innerHTML = `<div class="card"><b>${tab==='sell'?'No sales yet.':'No orders yet.'}</b><p class="muted" style="margin:6px 0 14px">${tab==='sell'?'When someone buys from you, it shows up here.':'Buy now or let sellers compete for you.'}</p>${tab==='sell'?'<a class="btn btn-dark" href="#/sell">Seller dashboard</a>':'<a class="btn btn-accent" href="#/browse">Browse</a>'}</div>`;
      box.innerHTML = data.map(o => {
        const r = Array.isArray(o.order_returns) ? o.order_returns[0] : o.order_returns;
        const todo = tab === 'sell' && (o.status === 'paid' || (r && ['requested', 'item_sent'].includes(r.status))) ? '<span class="tag st-wait">Action needed</span>' : '';
        return `<a class="order-row card" href="#/order?id=${o.id}">
          <div class="thumb mini">${o.photo ? `<img src="${esc(o.photo)}" alt="" loading="lazy">` : IMG}</div>
          <div><b>${esc(o.title)}</b><div class="muted" style="font-size:13px">${day(o.paid_at||o.created_at)} · ${o.fulfillment==='shipping'?'Shipping':o.fulfillment==='service'?'Service job':o.fulfillment==='digital'?'Digital':'Pickup'}${tab==='sell'?` · ${o.fulfillment==='service'?'customer':'buyer'} ${esc(o.buyer_name)}`:''}</div>
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${chip(o.status)}${r?`<span class="tag st-wait">${esc(RSTATUS[r.status]||r.status)}</span>`:''}${todo}</div></div>
          <div class="price">${money(tab==='sell' ? (o.payout_cents ?? o.total_cents - o.fee_cents) : o.total_cents)}</div></a>`;
      }).join('');
    }
    render();
  }

  /* ============================== One order ============================== */
  function viewOrder(){
    if (!A().user) return gate('Sign in to see this order.');
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/orders">Orders</a> / Order</div><h1 id="oTitle">Order</h1></div>
      <div class="flow order-flow"><div style="display:grid;gap:16px;align-content:start"><div class="card" id="oMain"><div class="muted">Loading…</div></div><div id="oReturn"></div><div id="oReview"></div></div>
      <aside class="card chat" id="oChat"><div class="muted">Loading messages…</div></aside></div></div>`;
  }
  async function wireOrder(){
    const main = q('#oMain'); if (!main) return;
    const id = params().get('id');
    let chatReady = false;
    async function load(first){
      const { data: o, error } = await sb().from('orders').select('*, order_returns(*), sellers(display_name)').eq('id', id).maybeSingle();
      if (!q('#oMain')) return;
      if (error || !o) { main.innerHTML = `<p class="form-msg err">${esc(error?.message || 'Order not found.')}</p>`; return; }
      if (o.status === 'pending_payment' && first) {   // came back from a bank check — confirm the payment
        await sync({ order_id: id }); return load(false);
      }
      render(o);
      if (o.conversation_id && !chatReady) { chatReady = true; mountChat(q('#oChat'), o.conversation_id, o.buyer_id === A().user.id ? 'buyer' : 'seller', o); }
      else if (!o.conversation_id) q('#oChat').innerHTML = '<p class="muted" style="margin:0">Messages open once the order is paid.</p>';
    }
    async function act(btn, fn){
      busy(btn, true);
      const { error } = await fn();
      if (error) { busy(btn, false); const m = btn.closest('form, .card')?.querySelector('[data-msg]'); if (m) { m.textContent = rpcErr(error); m.className = 'form-msg err'; } return; }
      await sync({ order_id: id });
      load(false);
    }
    function render(o){
      const me = A().user.id, buyer = o.buyer_id === me, seller = o.seller_id === me;
      const r = Array.isArray(o.order_returns) ? o.order_returns[0] : o.order_returns;
      q('#oTitle').textContent = o.title;
      const svc = o.fulfillment === 'service';
      const dig = o.fulfillment === 'digital';
      const steps = [[svc ? 'Booked' : 'Paid', o.paid_at], [o.fulfillment === 'shipping' ? 'Shipped' : svc ? 'Job done' : dig ? 'Delivered' : 'Picked up', o.shipped_at], [dig ? 'Maker paid' : 'Complete', o.completed_at]];
      const ended = ['cancelled','refunded'].includes(o.status);
      const addr = o.ship_to?.address ? `${esc(o.ship_to.name||'')}<br>${esc(o.ship_to.address.line1||'')}${o.ship_to.address.line2?', '+esc(o.ship_to.address.line2):''}<br>${esc(o.ship_to.address.city||'')}, ${esc(o.ship_to.address.state||'')} ${esc(o.ship_to.address.postal_code||'')}` : '';

      let actions = '';
      if (o.status === 'pending_payment' && buyer) actions = `<a class="btn btn-accent" href="#/checkout?${o.product_id ? 'product=' + o.product_id : o.quote_id ? 'quote=' + o.quote_id : o.offer_id ? 'offer=' + o.offer_id : 'listing=' + o.listing_id}">Finish payment</a>`;
      if (o.status === 'paid' && seller && o.fulfillment === 'shipping') actions = `
        <form id="fShip" class="ship-form"><b>Ship it within 3 days</b> <small class="muted">Not shipped within 4 days? The order is cancelled and the buyer refunded.</small>
          <div class="row2"><div class="field"><label for="carrier">Carrier</label><select id="carrier"><option>USPS</option><option>UPS</option><option>FedEx</option><option>Other</option></select></div>
          <div class="field"><label for="trk">Tracking number</label><input id="trk" required placeholder="e.g. 9400 1000 0000 0000 0000 00"></div></div>
          <button class="btn btn-accent" type="submit">Mark as shipped</button></form>`;
      const pickupOpen = (o.fulfillment === 'pickup' || svc) && ['paid','shipped'].includes(o.status) && !(r && ['requested','approved','item_sent','escalated'].includes(r.status));
      if (o.status === 'paid' && seller && svc) actions = `<form id="fCode" class="handoff"><b>When the job is done</b>
          <p class="muted" style="margin:4px 0 10px;font-size:14px">Ask the customer for their 6-digit completion code — type it here and you're paid right away.</p>
          <div class="inline-form"><label class="sr" for="hcode">Customer's completion code</label><input id="hcode" inputmode="numeric" maxlength="7" placeholder="123456" autocomplete="one-time-code" style="width:140px;font-size:20px;letter-spacing:4px" required><button class="btn btn-accent" type="submit">Confirm job done</button></div></form>
          <button class="link-btn" type="button" id="bPicked" style="margin-top:6px">Customer not there? Mark job done (you're paid in 3 days if no problem)</button>`;
      if (o.status === 'paid' && seller && o.fulfillment === 'pickup') actions = `<form id="fCode" class="handoff"><b>At the meetup</b>
          <p class="muted" style="margin:4px 0 10px;font-size:14px">Let the buyer check the item. They'll show you a 6-digit pickup code — type it here and you're paid right away.</p>
          <div class="inline-form"><label class="sr" for="hcode">Buyer's pickup code</label><input id="hcode" inputmode="numeric" maxlength="7" placeholder="123456" autocomplete="one-time-code" style="width:140px;font-size:20px;letter-spacing:4px" required><button class="btn btn-accent" type="submit">Confirm handoff</button></div></form>
          <button class="link-btn" type="button" id="bPicked" style="margin-top:6px">No code? Mark as picked up (you're paid in 3 days if no problem)</button>`;
      const codeCard = !(pickupOpen && buyer) ? '' : svc ? `<div class="handoff"><b>Your completion code</b>
          <p class="muted" style="margin:4px 0 10px;font-size:14px">Give this code to the pro only when the job is done right — it releases your payment to them. Not happy? Don't share it, and report a problem.</p>
          <div id="codeBox"><button class="btn btn-dark" type="button" id="bCode">Show my code</button></div></div>` : `<div class="handoff"><b>Your pickup code</b>
          <p class="muted" style="margin:4px 0 10px;font-size:14px">Check the item first. Only then show this code to the seller — it releases your payment to them. If something's wrong, don't share it.</p>
          <div id="codeBox"><button class="btn btn-dark" type="button" id="bCode">Show my code</button></div></div>`;
      if (o.status === 'paid') actions += `<div style="margin-top:12px"><button class="btn btn-ghost" type="button" id="bCancel">${buyer ? (svc ? 'Cancel booking (full refund)' : 'Cancel order') : (svc ? 'Can\'t do it — cancel & refund' : 'Cancel & refund buyer')}</button></div>`;
      if (o.status === 'paid' && buyer && !r && !svc) actions += `<div style="margin-top:8px"><button class="link-btn" type="button" id="bProblem">${o.fulfillment === 'shipping' ? 'Seller not shipping or not answering?' : 'Seller not answering or didn\'t show up?'} Ask Offrava for help</button><div id="probBox"></div></div>`;
      if (o.status === 'shipped' && buyer && !(r && ['requested','approved','item_sent','escalated'].includes(r.status))) actions = `
        <p style="margin:0 0 10px">${svc ? 'Job done right? Confirm so the pro gets paid.' : 'Got it and all good? Confirm so the seller gets paid.'} ${o.auto_complete_at ? `If you do nothing, it completes on <b>${day(o.auto_complete_at)}</b>.` : ''}</p>
        <div class="acct-links"><button class="btn btn-accent" type="button" id="bGot">${svc ? 'Job done — all good' : 'I got it — all good'}</button>${!r ? `<button class="btn btn-ghost" type="button" id="bRet">${svc ? 'Report a problem' : 'Problem? Open a return'}</button>` : ''}</div>`;
      if (o.status === 'shipped' && seller && !r) actions = `<p class="muted" style="margin:0">Waiting for the buyer to confirm. You get paid when they do, or automatically on <b>${day(o.auto_complete_at)}</b> if no problem is reported.</p>`;
      if (o.status === 'completed' && buyer && !r) actions = `<button class="btn btn-ghost" type="button" id="bRet">${svc ? 'Report a problem' : 'Open a return'}</button>`;
      if (o.status === 'completed' && seller) actions = `<p class="muted" style="margin:0">${o.transfer_id ? 'Paid out to your bank account via Stripe.' : 'Payout is being sent.'}</p>`;

      main.innerHTML = `
        <div class="order-head">
          <div class="thumb">${o.photo ? `<img src="${esc(o.photo)}" alt="">` : IMG}</div>
          <div><div style="display:flex;gap:6px;flex-wrap:wrap">${chip(o.status)}</div>
            <div class="muted" style="font-size:14px;margin-top:6px">${buyer ? `${svc ? 'Pro' : 'Sold by'} <a href="#/store?id=${o.seller_id}"><b>${esc(o.sellers?.display_name||'seller')}</b></a>` : `${svc ? 'Customer' : 'Buyer'}: <b>${esc(o.buyer_name)}</b> <span id="buyerRep"></span>`} · ${o.fulfillment==='shipping'?'Shipping':svc?'Service job':o.fulfillment==='digital'?`Digital · <a href="#/library"><b>Open in Library</b></a>`:'Local pickup'}${o.paid_at ? ` · <a href="#/receipt?order=${o.id}"><b>${buyer ? 'Receipt' : 'Sale record'}</b></a>` : ''}</div></div>
        </div>
        ${ended ? `<div class="note" style="margin-top:0">${o.status==='cancelled' ? 'Cancelled' : 'Refunded'}${o.cancel_reason ? ' — ' + esc(o.cancel_reason) : ''}. ${o.charge_id ? (o.refund_id ? 'The refund was sent to the buyer\'s card (5–10 days to show).' : 'The refund is being sent.') : ''}</div>`
          : `<ol class="ostep">${steps.map(([t, d]) => `<li class="${d?'done':''}"><span></span><b>${t}</b><small>${d?when(d):''}</small></li>`).join('')}</ol>`}
        <div class="sum-line"><span>Item</span><b>${money(o.item_cents)}</b></div>
        ${svc || o.fulfillment==='digital' ? '' : `<div class="sum-line"><span>${o.fulfillment==='shipping'?'Shipping':'Pickup'}</span><b>${o.delivery_cents?money(o.delivery_cents):'Free'}</b></div>`}
        ${o.buyer_fee_cents && buyer ? `<div class="sum-line"><span>Offrava Protection</span><b>${money(o.buyer_fee_cents)}</b></div>` : ''}
        ${buyer && o.tax_cents ? `<div class="sum-line"><span>${o.tax_added_cents ? 'Sales tax' : 'Tax included'}</span><b>${money(o.tax_cents)}</b></div>` : ''}
        <div class="sum-line"><span>${buyer ? 'Total paid' : 'Buyer paid for the item'}</span><b>${money(buyer ? o.total_cents : o.total_cents - (o.buyer_fee_cents || 0) - (o.tax_cents || 0))}</b></div>
        ${seller ? `<div class="sum-line"><span>Offrava fee</span><b>${o.fee_cents ? '−' + money(o.fee_cents) : '$0 (founding seller)'}</b></div><div class="sum-line"><span>You get</span><b>${money(o.payout_cents ?? o.total_cents - o.fee_cents)}</b></div>` : ''}
        ${addr ? `<div class="sum-line"><span>Ship to</span><b style="text-align:right">${addr}</b></div>` : ''}
        ${o.tracking && o.carrier !== 'pickup' ? `<div class="sum-line"><span>Tracking</span><b>${trackUrl(o.carrier, o.tracking) ? `<a href="${esc(trackUrl(o.carrier, o.tracking))}" target="_blank" rel="noopener"><u>${esc(o.carrier)} · ${esc(o.tracking)} ↗</u></a>` : `${esc(o.carrier)} · ${esc(o.tracking)}`}</b></div>` : ''}
        <div class="sum-line"><span>Returns</span><b style="text-align:right">${esc(RET[o.return_policy]||'')}</b></div>
        ${actions || codeCard ? `<div class="order-actions">${codeCard}${actions}</div>` : ''}
        <div id="oSpots"></div>
        <p class="form-msg" data-msg role="status" aria-live="polite"></p>`;

      // Wire actions
      const fShip = q('#fShip'); if (fShip) fShip.onsubmit = (e) => { e.preventDefault(); act(fShip.querySelector('button'), () => sb().rpc('order_mark_shipped', { p_order: id, p_carrier: q('#carrier').value, p_tracking: q('#trk').value })); };
      const fc = q('#fCode'); if (fc) fc.onsubmit = (e) => { e.preventDefault(); act(fc.querySelector('button'), () => sb().rpc('order_confirm_handoff', { p_order: id, p_code: q('#hcode').value })); };
      const bco = q('#bCode'); if (bco) bco.onclick = async () => { busy(bco, true); const { data, error } = await sb().rpc('order_handoff_code', { p_order: id }); if (error) { busy(bco, false); bco.textContent = error.message; return; } q('#codeBox').innerHTML = `<div class="pickup-code" aria-label="Pickup code ${data.split('').join(' ')}">${data.slice(0,3)} ${data.slice(3)}</div>`; };
      if (pickupOpen) spots(q('#oSpots'));
      const bp = q('#bPicked'); if (bp) bp.onclick = () => act(bp, () => sb().rpc('order_mark_shipped', { p_order: id, p_carrier: null, p_tracking: null }));
      const bc = q('#bCancel'); if (bc) bc.onclick = () => { if (!bc.dataset.sure) { bc.dataset.sure = 1; bc.textContent = 'Tap again to confirm cancel'; return; } act(bc, () => sb().rpc('order_cancel', { p_order: id, p_reason: '' })); };
      const bg = q('#bGot'); if (bg) bg.onclick = () => act(bg, () => sb().rpc('order_confirm_received', { p_order: id }));
      const br = q('#bRet'); if (br) br.onclick = () => returnForm(o);
      const bp2 = q('#bProblem'); if (bp2) bp2.onclick = () => {
        q('#probBox').innerHTML = `<form class="card" id="fProb" style="margin-top:10px;padding:18px"><label for="probIn"><b>What's going on?</b></label>
          <textarea id="probIn" rows="3" maxlength="1000" required placeholder="e.g. Paid 3 days ago, no reply and nothing shipped" style="width:100%;margin:8px 0;font:inherit;border:1px solid var(--line);border-radius:12px;padding:10px 12px"></textarea>
          <p class="muted" style="font-size:13px;margin:0 0 10px">Your payment stays on hold. Offrava looks at the order and the chat and decides within 2 business days. Orders that aren't sent in time are cancelled and refunded automatically.</p>
          <button class="btn btn-dark" type="submit">Send to Offrava</button><p class="form-msg" data-msg></p></form>`;
        const f = q('#fProb'); f.onsubmit = (e) => { e.preventDefault(); act(f.querySelector('button'), () => sb().rpc('order_report_problem', { p_order: id, p_details: q('#probIn').value })); };
      };
      renderReturn(o, r, buyer, seller);
      const F = window.OffravaFeatures;
      if (F) { F.reviewCard(q('#oReview'), o); if (seller) F.buyerBadge(q('#buyerRep'), o.buyer_id); }
    }

    // Safe places to meet (police exchange zones, partner stores)
    async function spots(el){
      if (!el) return;
      const { data } = await sb().from('meetup_spots').select('name,address,kind,notes').limit(8);
      if (!data?.length) return;
      el.innerHTML = `<div class="spots"><b>🛡️ Meet somewhere safe</b>${data.map(m => `<div class="spot"><span class="tag ${m.kind === 'police' ? 'st-go' : ''}">${m.kind === 'police' ? 'Police zone' : m.kind === 'partner' ? 'Offrava spot' : 'Public'}</span>
        <div><b>${esc(m.name)}</b><small>${esc(m.address)}${m.notes ? ' · ' + esc(m.notes) : ''}</small></div>
        <a class="link-btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.address)}" target="_blank" rel="noopener">Map</a></div>`).join('')}
        <small class="muted">Meet in daylight, in public. Never pay or accept payment outside Offrava.</small></div>`;
    }
    function returnForm(o){
      const box = q('#oReturn');
      const svc = o.fulfillment === 'service';
      const labels = svc ? { not_as_described: 'Job not done as agreed', damaged: 'Damage to my property' } : o.fulfillment === 'digital' ? { not_as_described: 'Not as described', damaged: 'Doesn\'t work (won\'t run, bad key, broken file)' } : REASON;
      const notGot = (o.fulfillment === 'shipping' && o.shipped_at && Date.now() - new Date(o.shipped_at) < 30 * 864e5) || (o.fulfillment === 'pickup' && o.status === 'shipped');
      const opts = Object.entries(labels).filter(([k]) => !(k === 'not_received' && !notGot) && !(k === 'changed_mind' && o.return_policy === 'no_returns'));
      box.innerHTML = `<form class="card" id="fRet"><h3 style="margin:0 0 12px">${svc ? 'Report a problem' : 'Open a return'}</h3>
        <div class="field"><label>What happened?</label><div class="choices">${opts.map(([k, t], i) => `<label class="choice"><input type="radio" name="why" value="${k}" ${i===0?'checked':''}><span>${t}</span></label>`).join('')}</div></div>
        <div class="field"><label for="retd">Details for the seller</label><textarea id="retd" rows="3" maxlength="1000" placeholder="What's wrong? Photos can be shared in the messages."></textarea></div>
        ${o.fulfillment === 'digital' ? '<p class="muted" style="font-size:13px">The maker gets a chance to fix it (new key, new file). If they can\'t, you get a full refund — nothing to send back.</p>' : '<p class="muted" style="font-size:13px">Damaged, not as described or didn\'t arrive: you get a full refund and the seller pays return shipping. Changed your mind: allowed if the seller accepts returns; you pay return shipping.</p>'}
        <div class="acct-links"><button class="btn btn-dark" type="submit">Send return request</button><button class="btn btn-ghost" type="button" id="retX">Never mind</button></div>
        <p class="form-msg" data-msg role="status" aria-live="polite"></p></form>`;
      q('#retX').onclick = () => box.innerHTML = '';
      const f = q('#fRet'); f.onsubmit = (e) => { e.preventDefault(); act(f.querySelector('button'), () => sb().rpc('return_open', { p_order: id, p_reason: f.why.value, p_details: q('#retd').value })); };
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderReturn(o, r, buyer, seller){
      const box = q('#oReturn');
      if (!r) { if (!q('#fRet')) box.innerHTML = ''; return; }
      const open = ['requested','approved','item_sent'].includes(r.status);
      const late = new Date(r.respond_by) < new Date();
      let acts = '';
      if (seller && r.status === 'requested') acts = `<button class="btn btn-accent" type="button" data-ra="approve">${r.reason === 'not_received' || o.fulfillment === 'service' || o.fulfillment === 'digital' ? 'Refund the customer' : 'Approve return'}</button>${r.reason !== 'not_received' && o.fulfillment !== 'service' && o.fulfillment !== 'digital' ? '<button class="btn btn-ghost" type="button" data-ra="refund">Refund now, keep the item</button>' : ''}`;
      if (seller && ['approved','item_sent'].includes(r.status)) acts = `<button class="btn btn-accent" type="button" data-ra="received">I got it back — refund</button>`;
      if (seller && open) acts += `<button class="btn btn-ghost" type="button" data-esc>Ask Offrava to step in</button>`;
      if (buyer && r.status === 'approved') acts = `<form id="fSent" class="inline-form" style="width:100%"><label class="sr" for="rtrk">Return tracking</label><input id="rtrk" placeholder="Return tracking (if shipped)"><button class="btn btn-accent" type="submit">I sent it back</button></form>`;
      if (buyer && open && late) acts += `<button class="btn btn-ghost" type="button" data-esc>Ask Offrava to step in</button>`;
      box.innerHTML = `<div class="card"><span class="tag st-wait">${esc(RSTATUS[r.status]||r.status)}</span>
        <h3 style="margin:10px 0 4px">${esc(REASON[r.reason]||r.reason)}</h3>
        ${r.details ? `<p style="margin:0 0 8px">“${esc(r.details)}”</p>` : ''}
        <p class="muted" style="font-size:14px;margin:0">${open ? `${seller ? 'Please respond' : 'Seller responds'} by <b>${day(r.respond_by)}</b>. The payment stays on hold until this is settled.` : esc(r.resolution || '')}</p>
        ${r.return_tracking ? `<p style="font-size:14px;margin:8px 0 0">Return tracking: <b>${esc(r.return_tracking)}</b></p>` : ''}
        ${acts ? `<div class="acct-links" style="margin-top:14px">${acts}</div>` : ''}
        <p class="form-msg" data-msg role="status" aria-live="polite"></p></div>`;
      box.querySelectorAll('[data-ra]').forEach(b => b.onclick = () => act(b, () => sb().rpc('return_respond', { p_order: id, p_action: b.dataset.ra })));
      box.querySelectorAll('[data-esc]').forEach(b => b.onclick = () => act(b, () => sb().rpc('return_escalate', { p_order: id, p_note: '' })));
      const fs = q('#fSent'); if (fs) fs.onsubmit = (e) => { e.preventDefault(); act(fs.querySelector('button'), () => sb().rpc('return_mark_sent', { p_order: id, p_tracking: q('#rtrk').value })); };
    }
    load(true);
    // Keep the page fresh while it is open (the other side may act)
    const t = setInterval(() => { if (document.visibilityState === 'visible' && !document.activeElement?.matches('input,textarea,select')) load(false); }, 30000);
    cleanups.push(() => clearInterval(t));
  }

  /* ============================== Messages ============================== */
  // A live chat thread inside any element
  function mountChat(el, convId, role, ctx){
    el.innerHTML = `<div class="chat-head"><b>Messages</b><span class="muted" style="font-size:13px">${role === 'buyer' ? (ctx?.fulfillment === 'service' ? 'with the pro' : ctx?.fulfillment === 'digital' ? 'with the maker' : 'with the seller') : (ctx?.fulfillment === 'service' ? 'with the customer' : 'with the buyer')}</span></div>
      <div class="chat-log" id="chatLog" aria-live="polite"></div>
      <form class="chat-form" id="chatForm"><label class="sr" for="chatIn">Message</label>
        <textarea id="chatIn" rows="1" maxlength="2000" placeholder="Write a message…" required></textarea>
        <button class="btn btn-dark" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12l16-8-6 16-2-7z" fill="currentColor"/></svg></button></form>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Keep payments and contact inside Offrava — phone numbers and emails are hidden to protect you.</p>`;
    const log = q('#chatLog', el); const seen = new Set();
    const me = A().user.id;
    const add = (m) => {
      if (seen.has(m.id)) return; seen.add(m.id);
      const mine = m.sender_id === me;
      const div = document.createElement('div');
      div.className = 'bubble ' + (m.kind === 'system' ? 'sys' : mine ? 'me' : 'them');
      div.innerHTML = `${esc(m.body).replace(/\n/g,'<br>')}<small>${m.kind === 'system' ? 'Offrava · ' : ''}${when(m.created_at)}</small>`;
      log.appendChild(div); log.scrollTop = log.scrollHeight;
    };
    async function fetchNew(){
      const last = Math.max(0, ...seen);
      const { data } = await sb().from('messages').select('*').eq('conversation_id', convId).gt('id', last).order('id').limit(200);
      (data || []).forEach(add);
      if (data?.length) sb().rpc('mark_conversation_read', { p_conv: convId });
      if (!seen.size) log.innerHTML = '<p class="muted" style="margin:auto;text-align:center">No messages yet. Say hi 👋</p>';
      else log.querySelector('p.muted')?.remove();
    }
    fetchNew();
    const ch = sb().channel('conv-' + convId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` }, (p) => { log.querySelector('p.muted')?.remove(); add(p.new); sb().rpc('mark_conversation_read', { p_conv: convId }); })
      .subscribe();
    const poll = setInterval(() => { if (document.visibilityState === 'visible') fetchNew(); }, 15000);
    cleanups.push(() => { clearInterval(poll); sb().removeChannel(ch); });
    const f = q('#chatForm', el), inp = q('#chatIn', el);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); f.requestSubmit(); } });
    inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 140) + 'px'; });
    f.onsubmit = async (e) => {
      e.preventDefault(); const body = inp.value.trim(); if (!body) return;
      const b = f.querySelector('button'); b.disabled = true;
      const { data, error } = await sb().from('messages').insert({ conversation_id: convId, sender_id: me, body }).select().single();
      b.disabled = false;
      if (error) { inp.setCustomValidity(''); alertMsg(el, error.message); return; }
      inp.value = ''; inp.style.height = 'auto'; log.querySelector('p.muted')?.remove(); add(data);
    };
  }
  function alertMsg(el, t){ let m = el.querySelector('.chat-err'); if (!m) { m = document.createElement('p'); m.className = 'form-msg err chat-err'; el.appendChild(m); } m.textContent = t; }

  function viewInbox(){
    if (!A().user) return gate('Sign in to see your messages.');
    return `<div class="wrap"><div class="page-head"><div class="crumb">Messages</div><h1>Messages</h1></div>
      <div class="inbox"><div class="card inbox-list" id="convList"><div class="muted">Loading…</div></div>
      <div class="card chat" id="convChat"><p class="muted" style="margin:auto">Pick a conversation.</p></div></div></div>`;
  }
  async function wireInbox(){
    const list = q('#convList'); if (!list) return;
    let open = params().get('c');
    const { data, error } = await sb().from('conversations').select('*, listings(title,photos,status), sellers(display_name)').order('last_message_at', { ascending: false }).limit(100);
    if (error) return list.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    if (!data.length) { list.innerHTML = `<p class="muted" style="margin:0">No messages yet. Use “Ask seller” on any item to start one.</p>`; return; }
    const me = A().user.id;
    if (!open && innerWidth > 680) open = data[0].id;   // desktop: open the latest chat
    list.innerHTML = data.map(c => {
      const buyer = c.buyer_id === me; const unread = new Date(c.last_message_at) > new Date(buyer ? c.buyer_read_at : c.seller_read_at);
      const photo = c.listings?.photos?.[0];
      return `<a class="conv ${c.id === open ? 'on' : ''}" href="#/messages?c=${c.id}">
        <div class="thumb mini">${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : IMG}</div>
        <div style="min-width:0"><b class="ellipsis">${esc(c.title || c.listings?.title || 'Item')}</b><div class="muted ellipsis" style="font-size:13px">${buyer ? esc(c.sellers?.display_name || 'Seller') : esc(c.buyer_name)} · ${day(c.last_message_at)}</div></div>
        ${unread ? '<span class="dot" aria-label="unread"></span>' : ''}</a>`;
    }).join('');
    const c = data.find(x => x.id === open);
    if (c) {
      const { data: ord } = await sb().from('orders').select('id,status').eq('conversation_id', c.id).neq('status','pending_payment').order('created_at',{ascending:false}).limit(1);
      mountChat(q('#convChat'), c.id, c.buyer_id === me ? 'buyer' : 'seller');
      q('#convChat .chat-head').insertAdjacentHTML('afterbegin', '<a href="#/messages" class="back-link" aria-label="All messages">←</a>');
      if (ord?.[0]) q('#convChat .chat-head').insertAdjacentHTML('beforeend', `<a class="btn btn-ghost" style="min-height:34px;padding:0 12px" href="#/order?id=${ord[0].id}">View order</a>`);
      document.querySelector('.inbox').classList.add('has-open');
    }
  }

  // Start a conversation from a listing ("Ask seller")
  async function askSeller(listingId, btn){
    if (!A().user) return go('#/login');
    busy(btn, true);
    const { data, error } = await sb().rpc('start_conversation', { p_listing: listingId });
    busy(btn, false);
    if (error) { btn.textContent = rpcErr(error); return; }
    go('#/messages?c=' + data);
  }

  window.OffravaOrders = { askSeller };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  const wrap = (v, w) => [v, () => { cleanup(); w && w(); }];
  Object.assign(R, {
    '#/thanks':   wrap(viewThanks, wireThanks),
    '#/checkout': wrap(viewCheckout, wireCheckout),
    '#/orders':   wrap(viewOrders, wireOrders),
    '#/order':    wrap(viewOrder, wireOrder),
    '#/messages': wrap(viewInbox, wireInbox)
  });
})();

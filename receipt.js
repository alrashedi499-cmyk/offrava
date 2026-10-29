/* Offrava receipts (#/receipt?order=ID)
   Buyer: a proper receipt — what you paid, to whom, where it ships, refunds. Seller: a sale record — price, Offrava fee, payout.
   Printable / Save as PDF. Plus #/statement: a seller's monthly sales statement with CSV download (for taxes and bookkeeping). */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
  const money = (c) => (c < 0 ? '−' : '') + '$' + (Math.abs(c || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const num = (id) => String(id).slice(0, 8).toUpperCase();
  const KIND = { pickup: 'Local pickup', shipping: 'Shipping', service: 'Service job', digital: 'Digital download' };
  const STATUS = { paid: 'Paid', shipped: 'Shipped', completed: 'Completed', refunded: 'Refunded', cancelled: 'Cancelled', pending_payment: 'Payment pending' };

  const logo = `<div class="rc-logo"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#111"/><path d="M7 12.5l3.2 3.2L17.5 8" stroke="#c6f432" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Offrava</b></div>`;
  const row = (k, v, cls = '') => `<div class="rc-row ${cls}"><span>${k}</span><span>${v}</span></div>`;

  function viewReceipt(){ return `<div class="wrap narrow rc-wrap" id="rcBox"><p class="muted" style="padding:40px 0">Loading…</p></div>`; }
  async function wireReceipt(){
    const box = q('#rcBox'); if (!box) return;
    if (!A().user) { box.innerHTML = '<div class="card empty" style="margin:40px 0"><b>Sign in to see this receipt.</b><a class="btn btn-dark" href="#/login">Sign in</a></div>'; return; }
    const id = param('order');
    const { data: o, error } = await sb().from('orders').select('*, sellers(display_name,business_name,zip)').eq('id', id).maybeSingle();
    if (!q('#rcBox')) return;
    if (error || !o) { box.innerHTML = `<div class="card empty" style="margin:40px 0"><b>Receipt not found.</b><a class="btn btn-dark" href="#/orders">My orders</a></div>`; return; }
    if (!o.paid_at) { box.innerHTML = `<div class="card empty" style="margin:40px 0"><b>No receipt yet</b><p class="muted">A receipt is made once the payment goes through.</p><a class="btn btn-dark" href="#/order?id=${o.id}">Back to the order</a></div>`; return; }
    const me = A().user.id, isSeller = o.seller_id === me && o.buyer_id !== me;
    const seller = o.sellers?.business_name || o.sellers?.display_name || 'Seller';
    const refunded = o.status === 'refunded' || (o.status === 'cancelled' && o.charge_id);
    const sub = (o.total_cents || 0) - (o.buyer_fee_cents || 0) - (o.tax_added_cents || 0);
    const tl = (o.tax_lines || [])[0] || {}, taxName = esc(tl.label || 'Sales tax') + (tl.region ? ` (${esc(tl.region)}${tl.rate ? ' · ' + (+tl.rate).toLocaleString('en-US', { maximumFractionDigits: 3 }) + '%' : ''})` : '');
    const ship = o.ship_to?.address;
    const addr = ship ? `${esc(o.ship_to.name || '')}<br>${esc(ship.line1 || '')}${ship.line2 ? ', ' + esc(ship.line2) : ''}<br>${esc(ship.city || '')}, ${esc(ship.state || '')} ${esc(ship.postal_code || '')}` : '';

    const head = `<div class="rc-top">${logo}<div class="rc-meta"><b>${isSeller ? 'Sale record' : 'Receipt'}</b><span>#${num(o.id)}</span></div></div>
      <div class="rc-grid">
        <div><small>${isSeller ? 'Sold to' : 'Sold by'}</small><b>${esc(isSeller ? o.buyer_name : seller)}</b>${isSeller ? '' : `<span>via Offrava, St. Louis, MO</span>`}</div>
        <div><small>Paid</small><b>${dt(o.paid_at)}</b><span>${esc(STATUS[o.status] || o.status)}${o.completed_at ? ' · ' + dt(o.completed_at).split(',').slice(0, 2).join(',') : ''}</span></div>
        <div><small>Delivery</small><b>${KIND[o.fulfillment] || o.fulfillment}</b>${o.tracking ? `<span>${esc(o.carrier || '')} ${esc(o.tracking)}</span>` : ''}</div>
        ${addr ? `<div><small>Ship to</small><span>${addr}</span></div>` : ''}
      </div>
      <div class="rc-item"><div><b>${esc(o.title)}</b>${o.condition ? `<span class="muted"> · ${esc(String(o.condition).replace('_', ' '))}</span>` : ''}<div class="muted" style="font-size:13px">Qty 1</div></div><b>${money(o.item_cents)}</b></div>`;

    const lines = isSeller
      ? row('Item price', money(o.item_cents)) + row(o.fulfillment === 'shipping' ? 'Shipping paid by buyer' : 'Delivery', money(o.delivery_cents || 0))
        + row('Sale total', money(sub), 'rc-strong') + row('Offrava fee', money(-(o.fee_cents || 0)))
        + row(refunded ? 'Your payout' : 'Your payout', refunded ? money(0) : money(o.payout_cents ?? sub - (o.fee_cents || 0)), 'rc-total')
        + `<p class="muted rc-note">${refunded ? 'This sale was refunded, so no payout and no fee.' : o.transfer_id ? 'Paid out to your bank account through Stripe.' : 'Paid out after the buyer confirms, or automatically if no problem is reported.'} The buyer's Offrava Protection fee (${money(o.buyer_fee_cents || 0)})${o.tax_cents ? ` and sales tax (${money(o.tax_cents)}, collected and paid to the state by Offrava)` : ''} don't affect your payout.</p>`
      : row('Item', money(o.item_cents)) + row(o.fulfillment === 'shipping' ? 'Shipping' : 'Delivery', o.delivery_cents ? money(o.delivery_cents) : 'Free')
        + row('Offrava Protection', money(o.buyer_fee_cents || 0))
        + (o.tax_added_cents ? row(taxName, money(o.tax_added_cents)) : '')
        + row('Total paid', money(o.total_cents), 'rc-total')
        + (o.tax_cents && !o.tax_added_cents ? row('Includes ' + taxName, money(o.tax_cents), 'muted') : '')
        + (refunded ? row(`Refunded ${o.refunded_at ? dt(o.refunded_at).split(',').slice(0, 2).join(',') : ''}`, money(-o.total_cents), 'rc-refund') + row('Net', money(0), 'rc-strong') : '')
        + `<p class="muted rc-note">Paid by card or wallet through Stripe. ${o.tax_cents ? 'Sales tax is collected and paid to the state by Offrava as the marketplace. ' : ''}${refunded ? 'Refunds take 5–10 business days to show on your statement.' : 'Covered by <a href="#/policies?p=buyer-protection">Offrava Buyer Protection</a>.'}</p>`;

    box.innerHTML = `<div class="crumb rc-noprint" style="padding-top:20px"><a href="#/order?id=${o.id}">← Back to the order</a></div>
      <article class="card rc">${head}<div class="rc-lines">${lines}</div>
        <div class="rc-foot">Order ID ${esc(o.id)}<br>Questions? <a href="#/contact">Contact Offrava</a> · <a href="#/policies">Policies</a></div></article>
      <div class="rc-actions rc-noprint"><button class="btn btn-dark" type="button" id="rcPrint">Print or save as PDF</button>${isSeller ? '<a class="btn btn-ghost" href="#/statement">Monthly statement</a>' : ''}</div>`;
    q('#rcPrint').onclick = () => window.print();
  }

  // ---------- Seller monthly statement ----------
  function viewStatement(){ return `<div class="wrap narrow rc-wrap" id="stBox"><p class="muted" style="padding:40px 0">Loading…</p></div>`; }
  async function wireStatement(){
    const box = q('#stBox'); if (!box) return;
    if (!A().user) { box.innerHTML = '<div class="card empty" style="margin:40px 0"><b>Sign in to see your statement.</b><a class="btn btn-dark" href="#/login">Sign in</a></div>'; return; }
    const now = new Date(), m = param('m') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, mo] = m.split('-').map(Number), from = new Date(y, mo - 1, 1), to = new Date(y, mo, 1);
    const { data } = await sb().from('orders').select('id,title,buyer_name,paid_at,status,fulfillment,item_cents,delivery_cents,total_cents,buyer_fee_cents,tax_added_cents,fee_cents,payout_cents,charge_id')
      .eq('seller_id', A().user.id).not('paid_at', 'is', null).gte('paid_at', from.toISOString()).lt('paid_at', to.toISOString()).order('paid_at');
    if (!q('#stBox')) return;
    const rows = (data || []).map(o => { const ref = o.status === 'refunded' || (o.status === 'cancelled' && o.charge_id);
      const sale = o.total_cents - (o.buyer_fee_cents || 0) - (o.tax_added_cents || 0); return { ...o, ref, sale: ref ? 0 : sale, fee: ref ? 0 : (o.fee_cents || 0), net: ref ? 0 : (o.payout_cents ?? sale - (o.fee_cents || 0)) }; });
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
    const label = (k) => new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    box.innerHTML = `<div class="crumb rc-noprint" style="padding-top:20px"><a href="#/orders?tab=sell">← Sales</a></div>
      <article class="card rc"><div class="rc-top">${logo}<div class="rc-meta"><b>Sales statement</b><span>${label(m)}</span></div></div>
        <label class="rc-noprint rc-month">Month <select id="stM">${months.map(k => `<option value="${k}" ${k === m ? 'selected' : ''}>${label(k)}</option>`).join('')}</select></label>
        <div class="rc-sum"><div><small>Sales</small><b>${money(sum('sale'))}</b></div><div><small>Offrava fees</small><b>${money(-sum('fee'))}</b></div><div><small>Your payouts</small><b>${money(sum('net'))}</b></div><div><small>Orders</small><b>${rows.length}</b></div></div>
        ${rows.length ? `<div class="rc-tablewrap"><table class="pol-table"><thead><tr><th>Date</th><th>Order</th><th>Item</th><th>Sale</th><th>Fee</th><th>Payout</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td>${new Date(r.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td><a href="#/receipt?order=${r.id}">#${num(r.id)}</a></td><td>${esc(r.title)}${r.ref ? ' <small class="muted">(refunded)</small>' : ''}</td><td>${money(r.sale)}</td><td>${money(-r.fee)}</td><td><b>${money(r.net)}</b></td></tr>`).join('')}
          </tbody></table></div>` : '<p class="muted">No sales this month.</p>'}
        <p class="muted rc-note">Sales tax isn't part of your sales — Offrava collects and pays it as the marketplace. Payouts are sent by Stripe. Stripe may send you a Form 1099-K when US tax rules require it. Keep this statement for your records.</p></article>
      <div class="rc-actions rc-noprint"><button class="btn btn-dark" type="button" id="stPrint">Print or save as PDF</button><button class="btn btn-ghost" type="button" id="stCsv" ${rows.length ? '' : 'disabled'}>Download CSV</button></div>`;
    q('#stM').onchange = (e) => { location.hash = '#/statement?m=' + e.target.value; };
    q('#stPrint').onclick = () => window.print();
    q('#stCsv').onclick = () => {
      const c = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`, d = (x) => (x / 100).toFixed(2);
      const csv = [['Date', 'Order', 'Item', 'Buyer', 'Delivery', 'Status', 'Sale', 'Offrava fee', 'Payout'].join(','),
        ...rows.map(r => [r.paid_at.slice(0, 10), num(r.id), r.title, r.buyer_name, r.fulfillment, r.ref ? 'refunded' : r.status, d(r.sale), d(r.fee), d(r.net)].map(c).join(','))].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `offrava-sales-${m}.csv`; a.click();
    };
  }

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/receipt'] = [viewReceipt, wireReceipt];
  R['#/statement'] = [viewStatement, wireStatement];
})();

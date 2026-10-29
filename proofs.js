/* Offrava proof photos & videos on an order.
   Seller: packed item / label (shipping), the handoff (pickup). Pro: the finished job (required before "done").
   Buyer: what arrived. Private — only the buyer, the seller and Offrava can open them. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LABEL = { shipped: 'Packed & shipped', handoff: 'At the handoff', done: 'Finished work', delivered: 'Delivered', received: 'What arrived' };
  const MAX_VIDEO = 50 * 1024 * 1024;

  async function shrink(file, max = 1600){
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  }

  // Which proof this person can add right now (null = none)
  function stageFor(o, seller){
    if (seller) {
      if (o.fulfillment === 'service' && ['paid', 'shipped'].includes(o.status)) return 'done';
      if (o.fulfillment === 'shipping' && ['paid', 'shipped'].includes(o.status)) return 'shipped';
      if (o.fulfillment === 'pickup' && ['paid', 'shipped'].includes(o.status)) return 'handoff';
      return null;
    }
    return ['shipped', 'completed'].includes(o.status) && o.fulfillment !== 'digital' ? 'received' : null;
  }
  const hint = (st, o) => ({
    done: 'Required before the job can be marked done: a photo or short video of the finished work. It protects you if the customer has a question later.',
    shipped: 'Optional: a photo of the item packed with its label. It helps if the buyer says it arrived damaged or wrong.',
    handoff: 'Optional: a photo of the item at the meetup.',
    received: o.fulfillment === 'service' ? 'Something not right with the work? Add photos — they help if you report a problem.' : 'Add photos of what arrived — they help if you need a return.'
  })[st] || '';

  async function mount(el, o){
    if (!el || !o || ['pending_payment'].includes(o.status) || o.fulfillment === 'digital') { if (el) el.innerHTML = ''; return; }
    const me = A().user?.id, seller = o.seller_id === me, stage = stageFor(o, seller);
    const { data } = await sb().from('order_proofs').select('*').eq('order_id', o.id).order('created_at');
    const list = data || [];
    if (!list.length && !stage) { el.innerHTML = ''; return; }
    let urls = {};
    if (list.length) {
      const { data: signed } = await sb().storage.from('order-proofs').createSignedUrls(list.map(p => p.path), 3600);
      (signed || []).forEach(s => { if (s.signedUrl) urls[s.path] = s.signedUrl; });
    }
    const needDone = seller && stage === 'done' && !list.some(p => p.stage === 'done' && p.role === 'seller');
    el.innerHTML = `<div class="card proofs ${needDone ? 'need' : ''}"><div class="proofs-head"><b>📷 Proof photos & videos</b><small class="muted">Private — only you, the ${seller ? (o.fulfillment === 'service' ? 'customer' : 'buyer') : (o.fulfillment === 'service' ? 'pro' : 'seller')} and Offrava see these</small></div>
      ${list.length ? `<div class="proof-grid">${list.map(p => { const u = urls[p.path]; return `<figure class="proof">
          ${p.kind === 'video' ? `<video src="${esc(u || '')}" controls playsinline preload="metadata"></video>` : `<a href="${esc(u || '#')}" target="_blank" rel="noopener"><img src="${esc(u || '')}" alt="${esc(LABEL[p.stage])}" loading="lazy"></a>`}
          <figcaption><b>${esc(LABEL[p.stage] || p.stage)}</b> · ${p.role === 'seller' ? (o.fulfillment === 'service' ? 'Pro' : 'Seller') : 'Buyer'} · ${new Date(p.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${p.note ? `<br>${esc(p.note)}` : ''}</figcaption></figure>`; }).join('')}</div>` : ''}
      ${stage ? `<p class="muted proofs-hint">${needDone ? '<b>Step 1:</b> ' : ''}${hint(stage, o)}</p>
        <div class="proofs-add"><label class="btn ${needDone ? 'btn-accent' : 'btn-ghost'}">📷 Add photo or video<input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" capture="environment" multiple hidden data-pf></label>
        <input class="proofs-note" maxlength="300" placeholder="Note (optional)" data-pn></div><p class="form-msg" data-pm></p>` : ''}</div>`;
    const inp = q('[data-pf]', el); if (!inp) return;
    inp.onchange = async () => {
      const m = q('[data-pm]', el), files = [...inp.files].slice(0, 6); if (!files.length) return;
      m.className = 'form-msg'; m.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`;
      try {
        for (const f of files) {
          const video = f.type.startsWith('video/');
          if (video && f.size > MAX_VIDEO) throw new Error('Videos must be under 50 MB — record a shorter clip (about 30 seconds).');
          const blob = video ? f : await shrink(f);
          const ext = video ? (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') : 'jpg';
          const path = `${o.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const up = await sb().storage.from('order-proofs').upload(path, blob, { contentType: video ? (f.type || 'video/mp4') : 'image/jpeg' });
          if (up.error) throw up.error;
          const { error } = await sb().rpc('order_add_proof', { p_order: o.id, p_stage: stage, p_kind: video ? 'video' : 'photo', p_path: path, p_note: q('[data-pn]', el)?.value || null });
          if (error) throw error;
        }
        window.OffravaSound?.play('shipped');
        mount(el, o);
      } catch (e) { m.className = 'form-msg err'; m.textContent = e.message || String(e); }
    };
  }

  window.OffravaProofs = { mount };
})();

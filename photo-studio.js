/* Offrava photo studio: remove the background on the phone (no upload needed), put the item on white
   or on a studio background, and add the shop's logo or name (Pro). Also the Offrava Pro page.
   Background removal runs in the browser with the open U²-Net-p model (Apache-2.0) via ONNX Runtime Web. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const C = window.OFFRAVA_CONFIG || {};
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + ((c||0)/100).toFixed(2);
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';
  const MODEL = 'models/u2netp.onnx';
  const SIZE = 1200;   // finished photo: 1200 x 1200

  const BGS = [
    { id:'white',  name:'White',     free:true, a:'#ffffff', b:'#ffffff' },
    { id:'studio', name:'Studio',    a:'#ffffff', b:'#e7e6e1', radial:true },
    { id:'gray',   name:'Soft gray', a:'#f3f3f1', b:'#d9d9d4' },
    { id:'cream',  name:'Cream',     a:'#faf4ea', b:'#eadcc6' },
    { id:'sky',    name:'Sky',       a:'#eef5ff', b:'#c9dcff' },
    { id:'mint',   name:'Mint',      a:'#eefaf3', b:'#c6ecd6' },
    { id:'blush',  name:'Blush',     a:'#fff1f3', b:'#f6cdd5' },
    { id:'sunset', name:'Sunset',    a:'#ffe0b8', b:'#ff9f8f' },
    { id:'lime',   name:'Offrava',   a:'#e4fb8f', b:'#b7e21f' },
    { id:'dark',   name:'Dark',      a:'#3a3a3a', b:'#0f0f0f', radial:true }
  ];

  /* ---------- Model ---------- */
  let ortReady = null, session = null;
  function loadOrt(){
    if (window.ort) return Promise.resolve();
    return ortReady ??= new Promise((res, rej) => { const s = document.createElement('script'); s.src = ORT + 'ort.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the photo tool. Check your connection.')); document.head.appendChild(s); });
  }
  async function getSession(){
    if (session) return session;
    await loadOrt();
    ort.env.wasm.wasmPaths = ORT;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    try { session = await ort.InferenceSession.create(MODEL, { executionProviders: ['wasm'] }); }
    catch (e) {   // app live updates don't carry the big model file: load it from the website instead
      if (!window.OFFRAVA_SITE) throw e;
      session = await ort.InferenceSession.create(window.OFFRAVA_SITE + MODEL, { executionProviders: ['wasm'] });
    }
    return session;
  }

  async function fileToCanvas(file, max = 1600){
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }

  // Returns a canvas with the background made transparent, cropped tight around the item
  async function cutout(src){
    const s = await getSession();
    const N = 320, tmp = document.createElement('canvas'); tmp.width = tmp.height = N;
    const t = tmp.getContext('2d'); t.imageSmoothingQuality = 'high'; t.drawImage(src, 0, 0, N, N);
    const px = t.getImageData(0, 0, N, N).data;
    let mx = 0; for (let i = 0; i < px.length; i += 4) mx = Math.max(mx, px[i], px[i+1], px[i+2]);
    mx = mx || 255;
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    const input = new Float32Array(3 * N * N);
    for (let i = 0, p = 0; i < N * N; i++, p += 4) for (let ch = 0; ch < 3; ch++) input[ch * N * N + i] = (px[p + ch] / mx - mean[ch]) / std[ch];
    const feeds = { [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, N, N]) };
    const out = await s.run(feeds);
    const m = out[s.outputNames[0]].data;
    let lo = Infinity, hi = -Infinity; for (const v of m) { if (v < lo) lo = v; if (v > hi) hi = v; }
    const mask = document.createElement('canvas'); mask.width = mask.height = N;
    const mctx = mask.getContext('2d'), md = mctx.createImageData(N, N);
    for (let i = 0; i < N * N; i++) { let a = (m[i] - lo) / (hi - lo || 1); a = Math.min(1, Math.max(0, (a - 0.12) / 0.76)); md.data[i*4+3] = Math.round(a * 255); }
    mctx.putImageData(md, 0, 0);
    const cut = document.createElement('canvas'); cut.width = src.width; cut.height = src.height;
    const c = cut.getContext('2d'); c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'destination-in'; c.imageSmoothingQuality = 'high'; c.drawImage(mask, 0, 0, src.width, src.height);
    // tight crop
    const a = c.getImageData(0, 0, cut.width, cut.height).data;
    let x0 = cut.width, y0 = cut.height, x1 = 0, y1 = 0;
    for (let y = 0; y < cut.height; y += 2) for (let x = 0; x < cut.width; x += 2) if (a[(y * cut.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) throw new Error('Couldn\'t find the item in this photo. Try a photo where the item fills more of the frame.');
    const crop = document.createElement('canvas'); crop.width = x1 - x0 + 2; crop.height = y1 - y0 + 2;
    crop.getContext('2d').drawImage(cut, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return crop;
  }

  function paintBg(ctx, bg){
    if (bg.custom) { ctx.fillStyle = bg.custom; ctx.fillRect(0, 0, SIZE, SIZE); return; }
    const g = bg.radial ? ctx.createRadialGradient(SIZE/2, SIZE*0.42, SIZE*0.1, SIZE/2, SIZE/2, SIZE*0.75) : ctx.createLinearGradient(0, 0, 0, SIZE);
    g.addColorStop(0, bg.a); g.addColorStop(1, bg.b); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
  }
  function drawBrand(ctx, st){
    const pad = SIZE * 0.04;
    const pos = st.brandPos || 'br';
    if (st.logo) {
      const w = SIZE * 0.2, h = w * st.logo.height / st.logo.width;
      const x = pos.includes('r') ? SIZE - w - pad : pad, y = pos.includes('b') ? SIZE - h - pad : pad;
      ctx.globalAlpha = 0.92; ctx.drawImage(st.logo, x, y, w, h); ctx.globalAlpha = 1;
    } else if (st.brandName) {
      ctx.font = `600 ${Math.round(SIZE * 0.032)}px Inter, system-ui, sans-serif`;
      const tw = ctx.measureText(st.brandName).width, ph = SIZE * 0.06, pw = tw + SIZE * 0.05;
      const x = pos.includes('r') ? SIZE - pw - pad : pad, y = pos.includes('b') ? SIZE - ph - pad : pad;
      const dark = st.bg.id === 'dark';
      ctx.fillStyle = dark ? 'rgba(255,255,255,.88)' : 'rgba(18,18,18,.82)';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, pw, ph, ph/2) : ctx.rect(x, y, pw, ph); ctx.fill();
      ctx.fillStyle = dark ? '#121212' : '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(st.brandName, x + SIZE * 0.025, y + ph / 2 + 1);
    }
  }
  function render(canvas, st){
    const ctx = canvas.getContext('2d'); canvas.width = canvas.height = SIZE;
    if (st.mode === 'original') {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, SIZE, SIZE);
      const k = Math.min(SIZE / st.src.width, SIZE / st.src.height);
      ctx.drawImage(st.src, (SIZE - st.src.width * k) / 2, (SIZE - st.src.height * k) / 2, st.src.width * k, st.src.height * k);
    } else {
      paintBg(ctx, st.mode === 'white' ? BGS[0] : st.bg);
      const fit = st.scale * SIZE, k = Math.min(fit / st.cut.width, fit / st.cut.height);
      const w = st.cut.width * k, h = st.cut.height * k, x = (SIZE - w) / 2, y = (SIZE - h) / 2 + SIZE * 0.02;
      if (st.shadow) {
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.filter = 'blur(18px)';
        ctx.beginPath(); ctx.ellipse(SIZE/2, y + h + SIZE*0.008, w * 0.42, SIZE * 0.022, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.drawImage(st.cut, x, y, w, h);
    }
    if (st.brand && st.pro) drawBrand(ctx, st);
  }

  /* ---------- Studio window ---------- */
  // open(file) -> Promise<File|null> (null = cancelled, keep the original)
  async function open(file){
    const s = A().seller || {};
    const pro = A().user ? !!(await sb().rpc('is_pro', { p_user: A().user.id })).data : false;
    let logo = null;
    if (s.brand_logo_url) logo = await new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = s.brand_logo_url; });
    const st = { mode:'white', bg: BGS[1], scale: 0.82, shadow: true, brand: !!(logo || s.brand_name), brandName: s.brand_name || s.display_name || '', logo, brandPos:'br', pro, src: null, cut: null };
    const ov = document.createElement('div'); ov.className = 'studio-ov';
    ov.innerHTML = `<div class="studio" role="dialog" aria-modal="true" aria-label="Photo studio">
      <div class="studio-top"><b>Photo studio</b>${pro ? '<span class="tag st-done">Pro</span>' : ''}<button type="button" class="link-btn" data-x aria-label="Close">✕</button></div>
      <div class="studio-stage"><canvas id="stCanvas" width="${SIZE}" height="${SIZE}"></canvas><div class="studio-busy" id="stBusy"><span class="spin"></span><span id="stBusyT">Preparing…</span></div></div>
      <div class="studio-ctrl">
        <div class="seg" style="margin:0 0 12px"><button type="button" data-m="original">Original</button><button type="button" data-m="white" class="on">White background</button><button type="button" data-m="bg">Backgrounds ${pro ? '' : '★'}</button></div>
        <div id="stBgs" class="bg-grid" hidden>${BGS.map(b => `<button type="button" data-bg="${b.id}" title="${b.name}" style="background:${b.radial ? `radial-gradient(${b.a},${b.b})` : `linear-gradient(${b.a},${b.b})`}"><span>${b.name}</span></button>`).join('')}<label class="bg-custom" title="Any color"><input type="color" id="stColor" value="#f4efe6"><span>Color</span></label></div>
        <div class="row2 st-row" id="stFit">
          <label class="st-lab">Size<input type="range" id="stScale" min="55" max="96" value="82"></label>
          <label class="check"><input type="checkbox" id="stShadow" checked> Soft shadow</label>
        </div>
        <div class="st-brand">
          <label class="check"><input type="checkbox" id="stBrand" ${st.brand ? 'checked' : ''}> Add my logo / shop name ${pro ? '' : '★'}</label>
          <div id="stBrandOpts" ${st.brand ? '' : 'hidden'}>
            <div class="row2"><div class="field" style="margin:8px 0"><label for="stName">Shop name</label><input id="stName" maxlength="40" value="${esc(st.brandName)}"></div>
              <div class="field" style="margin:8px 0"><label for="stLogo">Logo (PNG)</label><input id="stLogo" type="file" accept="image/png,image/jpeg,image/webp"></div></div>
            <div class="choices" id="stPos">${[['tl','↖'],['tr','↗'],['bl','↙'],['br','↘']].map(([v,t]) => `<label class="choice"><input type="radio" name="pos" value="${v}" ${v==='br'?'checked':''}><span>${t}</span></label>`).join('')}</div>
          </div>
        </div>
        <div id="stPro" class="note" hidden>★ Studio backgrounds and your logo are part of <b>Offrava Pro</b> — ${money(999)}/month or +1% only when you sell. White background is free for everyone. <a href="#/pro" data-x><b>See Pro</b></a></div>
        <p class="form-msg" id="stMsg"></p>
        <div class="studio-btns"><button type="button" class="btn btn-ghost" data-x>Cancel</button><button type="button" class="btn btn-accent" id="stUse" disabled>Use this photo</button></div>
      </div></div>`;
    document.body.appendChild(ov); document.body.classList.add('no-scroll');
    const canvas = q('#stCanvas', ov), busyEl = q('#stBusy', ov), msg = (t) => { const m = q('#stMsg', ov); m.textContent = t || ''; m.className = 'form-msg' + (t ? ' err' : ''); };
    const busy = (t) => { busyEl.hidden = !t; if (t) q('#stBusyT', ov).textContent = t; };
    const proGate = () => { q('#stPro', ov).hidden = st.pro || !((st.mode === 'bg') || st.brand); };
    const redraw = () => { if (!st.src) return; if (st.mode !== 'original' && !st.cut) return; render(canvas, { ...st, bg: st.mode === 'bg' && st.pro ? st.bg : BGS[0], brand: st.brand && st.pro }); proGate(); q('#stFit', ov).hidden = st.mode === 'original'; };

    return new Promise(async (resolve) => {
      const close = (val) => { ov.remove(); document.body.classList.remove('no-scroll'); resolve(val); };
      qa('[data-x]', ov).forEach(b => b.addEventListener('click', () => close(null)));
      try {
        busy('Loading photo…'); st.src = await fileToCanvas(file);
        render(canvas, { ...st, mode: 'original' });
        busy('Removing background… (first time takes a few seconds)');
        st.cut = await cutout(st.src);
        busy(''); q('#stUse', ov).disabled = false; redraw();
      } catch (e) { busy(''); msg(e.message || 'Background removal failed on this device. You can still use the original.'); st.mode = 'original'; qa('[data-m]', ov).forEach(b => b.classList.toggle('on', b.dataset.m === 'original')); q('#stUse', ov).disabled = false; redraw(); }

      qa('[data-m]', ov).forEach(b => b.onclick = () => {
        if (b.dataset.m !== 'original' && !st.cut) return;
        st.mode = b.dataset.m; qa('[data-m]', ov).forEach(x => x.classList.toggle('on', x === b));
        q('#stBgs', ov).hidden = st.mode !== 'bg'; redraw();
      });
      qa('[data-bg]', ov).forEach(b => b.onclick = () => { st.bg = BGS.find(x => x.id === b.dataset.bg); qa('[data-bg]', ov).forEach(x => x.classList.toggle('on', x === b)); redraw(); });
      q('#stColor', ov).oninput = (e) => { st.bg = { id:'custom', custom: e.target.value }; redraw(); };
      q('#stScale', ov).oninput = (e) => { st.scale = e.target.value / 100; redraw(); };
      q('#stShadow', ov).onchange = (e) => { st.shadow = e.target.checked; redraw(); };
      q('#stBrand', ov).onchange = (e) => { st.brand = e.target.checked; q('#stBrandOpts', ov).hidden = !st.brand; redraw(); };
      q('#stName', ov).oninput = (e) => { st.brandName = e.target.value; st.logo = null; redraw(); };
      q('#stLogo', ov).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const c = await fileToCanvas(f, 600); st.logo = c; st.newLogo = f; redraw(); };
      qa('#stPos input', ov).forEach(r => r.onchange = () => { st.brandPos = r.value; redraw(); });

      q('#stUse', ov).onclick = async () => {
        if (!st.pro && (st.mode === 'bg' || st.brand)) { st.mode = st.mode === 'bg' ? 'white' : st.mode; st.brand = false; }
        if (st.mode === 'original' && !(st.brand && st.pro)) return close(null);   // keep the original photo as is
        render(canvas, { ...st, bg: st.mode === 'bg' ? st.bg : BGS[0], brand: st.brand && st.pro });
        // Remember the shop name / logo for next time (Pro)
        if (st.pro && st.brand && A().seller) {
          const upd = { brand_name: st.brandName.trim().slice(0, 40) || null };
          if (st.newLogo) {
            const path = `${A().user.id}/brand-logo-${Date.now()}.png`;
            const up = await sb().storage.from('listing-photos').upload(path, st.newLogo, { contentType: st.newLogo.type });
            if (!up.error) upd.brand_logo_url = sb().storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
          }
          sb().from('sellers').update(upd).eq('user_id', A().user.id).then(() => Object.assign(A().seller, upd));
        }
        canvas.toBlob((blob) => close(new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '-studio.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9);
      };
    });
  }

  /* ---------- Offrava Pro page ---------- */
  async function call(action, body = {}){
    const { data, error } = await sb().functions.invoke('orders', { body: { action, ...body } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error; } catch(_){} throw new Error(m); }
    if (data?.error) throw new Error(data.error); return data;
  }
  function viewPro(){
    const gate = (t, h, b) => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${t}</p><a class="btn btn-dark" href="${h}">${b}</a></div></div>`;
    if (!A().user) return gate('Sign in first.', '#/login', 'Sign in');
    if (A().seller?.status !== 'approved') return gate('Offrava Pro is for approved sellers.', A().seller ? '#/account' : '#/seller-apply', A().seller ? 'My account' : 'Apply to sell');
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb"><a href="#/sell">Selling</a> / Pro</div><h1>Offrava Pro</h1>
      <p class="muted">Photos that sell. Remove the background for free — Pro adds studio backgrounds and your logo or shop name on every photo.</p></div>
      <div class="pro-compare">
        <div class="card"><span class="tag">Free</span><ul><li>Remove background</li><li>Clean white background + shadow</li><li>Auto size & center</li></ul></div>
        <div class="card pro-card"><span class="tag st-done">Pro</span><ul><li>Everything in Free</li><li>10 studio backgrounds + any color</li><li>Your logo or shop name on photos</li><li>Your brand saved for every listing</li></ul></div>
      </div>
      <div id="proState" class="card" style="margin:16px 0 48px"><div class="muted">Checking your plan…</div></div></div>`;
  }
  async function wirePro(){
    const box = q('#proState'); if (!box) return;
    const sid = params().get('session_id');
    let st = {};
    try { st = await call('pro_sync', sid ? { session_id: sid } : {}); } catch (e) { st = { error: e.message }; }
    const { data: rows } = await sb().rpc('my_seller'); const s = rows?.[0] || null;
    const { data: ps } = await sb().from('platform_settings').select('pro_monthly_cents,pro_per_sale_bps').eq('id', 1).single();
    const price = money(ps?.pro_monthly_cents ?? 999), pct = ((ps?.pro_per_sale_bps ?? 100) / 100) + '%';
    if (A().seller) Object.assign(A().seller, s);
    const until = s?.pro_until ? new Date(s.pro_until).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
    if (s?.pro_plan === 'monthly' && new Date(s.pro_until) > new Date()) {
      box.innerHTML = `<h3 style="margin-top:0">You're on Pro — monthly ✓</h3><p class="muted">${st.renews === false ? `Ends on <b>${until}</b>. It won't renew.` : `Renews on <b>${until}</b> for ${price}.`}</p>
        ${st.renews === false ? '' : '<button class="btn btn-ghost" type="button" id="proCancel">Cancel renewal</button>'}<p class="form-msg" id="proMsg"></p>`;
      const c = q('#proCancel'); if (c) c.onclick = async () => { c.disabled = true; try { await call('pro_cancel'); wirePro(); } catch (e) { q('#proMsg').textContent = e.message; c.disabled = false; } };
      return;
    }
    if (s?.pro_plan === 'per_sale') {
      box.innerHTML = `<h3 style="margin-top:0">You're on Pro — pay per sale ✓</h3><p class="muted">No monthly fee. +${pct} is added to the fee only when an item sells.</p>
        <div class="acct-links"><button class="btn btn-dark" type="button" id="proMonthly">Switch to ${price}/month</button><button class="btn btn-ghost" type="button" id="proOff">Turn off Pro</button></div><div id="proCheckout" style="margin-top:16px"></div><p class="form-msg" id="proMsg"></p>`;
      q('#proOff').onclick = async () => { await sb().rpc('pro_choose_per_sale', { p_on: false }); wirePro(); };
      q('#proMonthly').onclick = () => startCheckout();
      return;
    }
    box.innerHTML = `<h3 style="margin-top:0">Choose how to pay for Pro</h3>
      <div class="pro-plans">
        <button type="button" class="plan" id="pMonthly"><b>${price} / month</b><small>Best if you list a lot. Cancel anytime.</small></button>
        <button type="button" class="plan" id="pSale"><b>+${pct} per sale</b><small>No monthly fee. Pay only when something sells.</small></button>
      </div><div id="proCheckout" style="margin-top:16px"></div><p class="form-msg" id="proMsg">${st.error ? esc(st.error) : ''}</p>`;
    q('#pSale').onclick = async () => { const { error } = await sb().rpc('pro_choose_per_sale', { p_on: true }); if (error) { q('#proMsg').textContent = error.message; return; } wirePro(); };
    q('#pMonthly').onclick = () => {
      // Apple rule: in the iPhone app, the Pro plan (a digital service) is bought on the website
      if (document.documentElement.classList.contains('is-ios')) { window.open((window.OFFRAVA_SITE || '') + '#/pro', '_blank'); return; }
      startCheckout();
    };
    async function startCheckout(){
      const holder = q('#proCheckout'); holder.innerHTML = '<div class="muted">Loading secure checkout…</div>';
      try {
        const stripe = Stripe(C.STRIPE_PUBLISHABLE_KEY);
        const co = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => (await call('pro_subscribe')).client_secret });
        holder.innerHTML = ''; co.mount(holder);
        const stop = () => { try { co.destroy(); } catch(_){} window.removeEventListener('hashchange', stop); };
        window.addEventListener('hashchange', stop);
      } catch (e) { holder.innerHTML = ''; q('#proMsg').textContent = e.message; q('#proMsg').className = 'form-msg err'; }
    }
  }

  window.OffravaStudio = { open };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/pro'] = [viewPro, wirePro];
})();

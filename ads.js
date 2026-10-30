/* Offrava ad screen: sponsored banners and movie trailers on the home page (clearly labeled, never affects rankings),
   the "Advertise with us" page, and admin tools: ads, advertiser requests, reports and return decisions. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + ((c||0)/100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const day = (d) => new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const yt = (u) => (String(u||'').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/) || [])[1];

  /* ---------------- Ad screen ---------------- */
  let cache = { at: 0, ads: [] };
  async function liveAds(){
    if (Date.now() - cache.at < 120000) return cache.ads;
    if (!sb()) return [];
    const { data } = await sb().from('ads').select('id,advertiser,title,subtitle,image_url,video_url,link_url,cta,placement,weight').limit(30);
    cache = { at: Date.now(), ads: data || [] };
    return cache.ads;
  }
  // Weighted shuffle: higher weight shows first more often
  const order = (ads) => ads.map(a => ({ a, k: Math.random() ** (1 / (a.weight || 1)) })).sort((x, y) => y.k - x.k).map(x => x.a);
  const seen = (id) => { try { const s = JSON.parse(sessionStorage.getItem('ofr_ad_seen') || '[]'); if (s.includes(id)) return true; s.push(id); sessionStorage.setItem('ofr_ad_seen', JSON.stringify(s)); } catch(_) {} return false; };

  function media(ad){
    const id = yt(ad.video_url);
    if (id) return `<iframe class="ad-media" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&modestbranding=1&rel=0" title="${esc(ad.title)}" allow="autoplay; encrypted-media; picture-in-picture" loading="lazy" tabindex="-1"></iframe>`;
    if (ad.video_url) return `<video class="ad-media" src="${esc(ad.video_url)}" ${ad.image_url ? `poster="${esc(ad.image_url)}"` : ''} muted autoplay loop playsinline preload="metadata"></video><button type="button" class="ad-sound" aria-label="Turn sound on">🔇</button>`;
    return `<img class="ad-media" src="${esc(ad.image_url)}" alt="" loading="lazy">`;
  }
  async function fill(slot){
    slot.dataset.done = '1';
    const ads = order((await liveAds()).filter(a => a.placement === (slot.dataset.place || 'home_top')));
    if (!ads.length) { slot.hidden = true; return; }
    slot.hidden = false;
    slot.innerHTML = `<div class="ad-screen" aria-roledescription="carousel" aria-label="Sponsored">
      <div class="ad-track">${ads.map((a, i) => `<div class="ad-slide" data-ad="${a.id}" aria-label="Ad ${i+1} of ${ads.length}">
        ${media(a)}<div class="ad-shade"></div>
        <div class="ad-text"><small>${esc(a.advertiser)}</small><b>${esc(a.title)}</b>${a.subtitle ? `<span>${esc(a.subtitle)}</span>` : ''}
          ${a.link_url ? `<button type="button" class="btn btn-accent ad-cta" data-go="${esc(a.link_url)}">${esc(a.cta || 'Learn more')}</button>` : ''}</div></div>`).join('')}</div>
      <span class="ad-label" title="Ads never change search results or offer rankings on Offrava">Sponsored</span>
      ${ads.length > 1 ? `<div class="ad-dots">${ads.map((_, i) => `<button type="button" aria-label="Show ad ${i+1}" class="${i?'':'on'}"></button>`).join('')}</div>` : ''}
    </div><a class="ad-about" href="#/advertise">Advertise on Offrava</a>`;
    const track = q('.ad-track', slot), dots = qa('.ad-dots button', slot), slides = qa('.ad-slide', slot);
    let idx = 0, hold = false;
    const goTo = (i) => { idx = (i + slides.length) % slides.length; track.scrollTo({ left: idx * track.clientWidth, behavior: 'smooth' }); };
    dots.forEach((d, i) => d.onclick = () => goTo(i));
    track.addEventListener('scroll', () => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== idx) { idx = i; dots.forEach((d, k) => d.classList.toggle('on', k === i)); } }, { passive: true });
    ['pointerdown','mouseenter','focusin'].forEach(ev => slot.addEventListener(ev, () => hold = true));
    ['mouseleave','focusout'].forEach(ev => slot.addEventListener(ev, () => hold = false));
    if (slides.length > 1) {
      const t = setInterval(() => { if (!document.body.contains(slot)) return clearInterval(t); if (!hold && document.visibilityState === 'visible') goTo(idx + 1); }, 7000);
    }
    // Count a view when at least half of an ad is on screen
    const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { const id = Number(e.target.dataset.ad); io.unobserve(e.target); if (!seen(id)) sb().rpc('ad_event', { p_ad: id, p_kind: 'view' }); } }), { threshold: 0.5 });
    slides.forEach(s => io.observe(s));
    qa('.ad-cta', slot).forEach(b => b.onclick = () => {
      const id = Number(b.closest('.ad-slide').dataset.ad); sb().rpc('ad_event', { p_ad: id, p_kind: 'click' });
      const u = b.dataset.go;
      if (u.startsWith('#/')) location.hash = u; else if (/^https:\/\//i.test(u)) window.open(u, '_blank', 'noopener');   // only our pages or https links
    });
    qa('.ad-sound', slot).forEach(b => b.onclick = (e) => { e.stopPropagation(); const v = b.previousElementSibling; v.muted = !v.muted; b.textContent = v.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Turn sound off'); });
  }
  const scan = () => qa('.ad-slot:not([data-done])').forEach(fill);
  new MutationObserver(scan).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => setTimeout(scan, 50));
  setTimeout(scan, 800);

  /* ---------------- Advertise with us ---------------- */
  function viewAdvertise(){
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb">Advertise</div><h1>Advertise on Offrava</h1>
      <p class="muted">Put your brand, store opening or new movie on the Offrava home screen in St. Louis.</p></div>
      <div class="pro-compare" style="margin-bottom:16px">
        <div class="card"><span class="tag">Where</span><ul><li>Big screen at the top of the home page</li><li>Second spot between sections</li><li>Pictures or video trailers</li></ul></div>
        <div class="card"><span class="tag">Fair to shoppers</span><ul><li>Always labeled <b>Sponsored</b></li><li>Never changes search results or offer rankings</li><li>You see views and clicks</li></ul></div>
      </div>
      <form class="card" id="advF" style="margin-bottom:48px"><h3 style="margin-top:0">Tell us about your campaign</h3>
        <div class="row2"><div class="field"><label for="aN">Your name</label><input id="aN" required maxlength="80"></div><div class="field"><label for="aC">Company</label><input id="aC" required maxlength="120"></div></div>
        <div class="row2"><div class="field"><label for="aE">Email</label><input id="aE" type="email" required maxlength="160"></div><div class="field"><label for="aP">Phone (optional)</label><input id="aP" type="tel" maxlength="30"></div></div>
        <div class="field"><label for="aB">Monthly budget</label><select id="aB"><option>Under $250</option><option>$250 – $1,000</option><option>$1,000 – $5,000</option><option>$5,000+</option></select></div>
        <div class="field"><label for="aM">What do you want to promote?</label><textarea id="aM" rows="3" maxlength="1500"></textarea></div>
        <button class="btn btn-accent btn-lg" type="submit">Send</button><p class="form-msg" id="advMsg"></p></form></div>`;
  }
  function wireAdvertise(){
    const f = q('#advF'); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); busy(b, true);
      const { error } = await sb().from('ad_inquiries').insert({ name: q('#aN').value.trim(), company: q('#aC').value.trim(), email: q('#aE').value.trim(), phone: q('#aP').value.trim() || null, budget: q('#aB').value, message: q('#aM').value.trim() });
      if (error) { busy(b, false); q('#advMsg').textContent = error.message; q('#advMsg').className = 'form-msg err'; return; }
      f.innerHTML = '<h3 style="margin:0">Thanks! 🎉</h3><p class="muted" style="margin:6px 0 0">We\'ll contact you within 1 business day.</p>';
    };
  }

  /* ---------------- Admin: ads ---------------- */
  const table = (head, rows) => `<div class="admin-table"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
  async function adminAds(area){
    const { data } = await sb().from('ads').select('*').neq('status', 'removed').order('created_at', { ascending: false });
    const rev = (data || []).reduce((s, a) => s + a.price_cents, 0);
    const today = new Date().toISOString().slice(0, 10), later = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    area.innerHTML = `<div class="acct-links" style="margin-bottom:12px"><button class="btn btn-accent" type="button" id="adNew">+ New ad</button><span class="tag" style="align-self:center">Ad income so far: ${money(rev)}</span></div>
      <form class="card" id="adForm" hidden style="margin-bottom:16px">
        <div class="row2"><div class="field"><label>Advertiser</label><input name="advertiser" required maxlength="80" placeholder="e.g. AMC Theatres"></div><div class="field"><label>Button text</label><input name="cta" maxlength="24" value="Learn more"></div></div>
        <div class="field"><label>Headline</label><input name="title" required maxlength="80"></div>
        <div class="field"><label>Short line (optional)</label><input name="subtitle" maxlength="160"></div>
        <div class="row2"><div class="field"><label>Picture (wide, about 1600×600)</label><input name="img" type="file" accept="image/jpeg,image/png,image/webp"></div>
          <div class="field"><label>Video: upload mp4 or paste a YouTube link</label><input name="vid" type="file" accept="video/mp4,video/webm"><input name="vurl" placeholder="https://youtube.com/watch?v=…" style="margin-top:6px"></div></div>
        <div class="field"><label>Button goes to</label><input name="link" placeholder="https://their-site.com  or  #/store?id=…"></div>
        <div class="row2"><div class="field"><label>Spot</label><select name="placement"><option value="home_top">Top of home (big screen)</option><option value="home_middle">Middle of home</option></select></div>
          <div class="field"><label>Shows more often (1–10)</label><input name="weight" type="number" min="1" max="10" value="1"></div></div>
        <div class="row2"><div class="field"><label>Starts</label><input name="starts" type="date" value="${today}"></div><div class="field"><label>Ends</label><input name="ends" type="date" value="${later}"></div></div>
        <div class="field"><label>Advertiser paid ($)</label><input name="paid" inputmode="decimal" placeholder="0"></div>
        <div class="acct-links"><button class="btn btn-accent" type="submit">Publish ad</button><button class="btn btn-ghost" type="button" id="adCancel">Cancel</button></div><p class="form-msg" id="adMsg"></p></form>
      ${table(['Ad','Spot','Dates','Views','Clicks','Paid','Status',''], (data||[]).map(a => `<tr>
        <td><div style="display:flex;gap:10px;align-items:center"><div class="thumb mini" style="width:72px;height:40px">${a.image_url ? `<img src="${esc(a.image_url)}" alt="">` : '🎬'}</div><div><b>${esc(a.title)}</b><div class="muted" style="font-size:13px">${esc(a.advertiser)}</div></div></div></td>
        <td style="font-size:13px">${a.placement === 'home_top' ? 'Top' : 'Middle'}</td><td style="font-size:13px">${day(a.starts_at)} – ${day(a.ends_at)}</td>
        <td>${a.views}</td><td>${a.clicks}${a.views ? ` <small class="muted">(${(100 * a.clicks / a.views).toFixed(1)}%)</small>` : ''}</td><td>${money(a.price_cents)}</td>
        <td><span class="tag">${new Date(a.ends_at) < new Date() ? 'ended' : esc(a.status)}</span></td>
        <td><div class="acct-links"><button class="btn btn-ghost" type="button" data-ade="${a.id}">Edit</button>${a.status === 'active' ? `<button class="btn btn-ghost" type="button" data-ads="${a.id}" data-v="paused">Pause</button>` : `<button class="btn btn-ghost" type="button" data-ads="${a.id}" data-v="active">Activate</button>`}<button class="btn btn-ghost" type="button" data-ads="${a.id}" data-v="removed">Remove</button></div></td></tr>`).join(''))}`;
    const f = q('#adForm');
    let editing = null;   // the ad being edited (null = new ad)
    const dateIn = (d) => new Date(d).toISOString().slice(0, 10);
    q('#adNew').onclick = () => { editing = null; f.reset(); f.querySelector('[type=submit]').textContent = 'Publish ad'; q('#adMsg').textContent = ''; f.hidden = false; f.scrollIntoView({ behavior: 'smooth' }); };
    q('#adCancel').onclick = () => { f.hidden = true; editing = null; };
    qa('[data-ade]', area).forEach(b => b.onclick = () => {
      const a = (data || []).find(x => String(x.id) === b.dataset.ade); if (!a) return; editing = a;
      f.advertiser.value = a.advertiser; f.cta.value = a.cta; f.title.value = a.title; f.subtitle.value = a.subtitle || '';
      f.vurl.value = a.video_url && !/\/storage\//.test(a.video_url) ? a.video_url : ''; f.link.value = a.link_url || ''; f.placement.value = a.placement; f.weight.value = a.weight;
      f.starts.value = dateIn(a.starts_at); f.ends.value = dateIn(a.ends_at); f.paid.value = a.price_cents ? (a.price_cents / 100).toFixed(2) : '';
      f.querySelector('[type=submit]').textContent = 'Save changes'; q('#adMsg').textContent = 'Leave picture/video empty to keep the current one.'; q('#adMsg').className = 'form-msg';
      f.hidden = false; f.scrollIntoView({ behavior: 'smooth' });
    });
    qa('[data-ads]', area).forEach(b => b.onclick = async () => { if (b.dataset.v === 'removed' && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again'; return; } busy(b, true); await sb().from('ads').update({ status: b.dataset.v }).eq('id', b.dataset.ads); cache.at = 0; adminAds(area); });
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'); const m = q('#adMsg'); busy(b, true);
      const up = async (file) => {
        const path = `${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const r = await sb().storage.from('ads').upload(path, file, { contentType: file.type });
        if (r.error) throw r.error; return sb().storage.from('ads').getPublicUrl(path).data.publicUrl;
      };
      try {
        const keepVid = editing && editing.video_url && /\/storage\//.test(editing.video_url) ? editing.video_url : null;
        const image_url = f.img.files[0] ? await up(f.img.files[0]) : (editing?.image_url || null);
        const video_url = f.vid.files[0] ? await up(f.vid.files[0]) : (f.vurl.value.trim() || keepVid);
        if (!image_url && !video_url) throw new Error('Add a picture or a video.');
        const row = {
          advertiser: f.advertiser.value.trim(), title: f.title.value.trim(), subtitle: f.subtitle.value.trim(), cta: f.cta.value.trim() || 'Learn more',
          image_url, video_url, link_url: f.link.value.trim() || null, placement: f.placement.value, weight: Number(f.weight.value) || 1,
          starts_at: new Date(f.starts.value + 'T00:00:00').toISOString(), ends_at: new Date(f.ends.value + 'T23:59:59').toISOString(),
          price_cents: f.paid.value ? Math.round(parseFloat(f.paid.value.replace(/[^\d.]/g, '')) * 100) : 0
        };
        if (new Date(row.ends_at) <= new Date(row.starts_at)) throw new Error('End date must be after the start date.');
        const { error } = editing ? await sb().from('ads').update(row).eq('id', editing.id) : await sb().from('ads').insert(row);
        if (error) throw error;
        cache.at = 0; adminAds(area);
      } catch (err) { busy(b, false); m.textContent = err.message; m.className = 'form-msg err'; }
    };
  }
  async function adminInquiries(area){
    const { data } = await sb().from('ad_inquiries').select('*').order('created_at', { ascending: false }).limit(200);
    area.innerHTML = table(['Company','Contact','Budget','Message','Status'], (data||[]).map(i => `<tr><td><b>${esc(i.company)}</b><div class="muted" style="font-size:13px">${day(i.created_at)}</div></td>
      <td style="font-size:13px">${esc(i.name)}<br><a href="mailto:${esc(i.email)}">${esc(i.email)}</a>${i.phone ? '<br>' + esc(i.phone) : ''}</td><td style="font-size:13px">${esc(i.budget || '')}</td><td style="font-size:13px;max-width:280px">${esc(i.message)}</td>
      <td><select data-inq="${i.id}">${['new','contacted','won','lost'].map(s => `<option ${s === i.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join(''));
    qa('[data-inq]', area).forEach(s => s.onchange = () => sb().from('ad_inquiries').update({ status: s.value }).eq('id', s.dataset.inq));
  }
  async function adminReports(area){
    const { data } = await sb().from('reports').select('*, listings(title), sellers(display_name)').order('created_at', { ascending: false }).limit(200);
    area.innerHTML = table(['Reported','Reason','Details','Status',''], (data||[]).map(r => `<tr><td>${r.listing_id ? `<a href="#/item?id=${r.listing_id}"><b>${esc(r.listings?.title || 'Listing')}</b></a>` : ''}${r.seller_id ? `<div><a href="#/store?id=${r.seller_id}">${esc(r.sellers?.display_name || 'Seller')}</a></div>` : ''}<div class="muted" style="font-size:13px">${day(r.created_at)}</div></td>
      <td>${esc(r.reason)}</td><td style="font-size:13px;max-width:280px">${esc(r.details)}</td><td><span class="tag">${esc(r.status)}</span>${r.resolution ? `<div class="muted" style="font-size:12px">${esc(r.resolution)}</div>` : ''}</td>
      <td>${r.status === 'open' ? `<form class="inline-form" data-rep="${r.id}"><input placeholder="What you did" required><button class="btn btn-ghost" type="submit">Close</button></form>` : ''}</td></tr>`).join(''));
    qa('[data-rep]', area).forEach(f => f.onsubmit = async (e) => { e.preventDefault(); await sb().rpc('admin_close_report', { p_report: Number(f.dataset.rep), p_resolution: f.querySelector('input').value }); adminReports(area); });
  }
  async function adminReturns(area){
    const { data } = await sb().from('order_returns').select('*, orders(id,title,total_cents,buyer_name,seller_id,sellers(display_name))').in('status', ['escalated','requested','approved','item_sent']).order('updated_at', { ascending: false });
    const list = (data || []).sort((a, b) => (b.status === 'escalated') - (a.status === 'escalated'));
    area.innerHTML = `<p class="muted" style="margin-top:0">Read the order chat before deciding. Refund = full money back to the buyer. Close = the seller gets paid.</p>` +
      table(['Order','Reason','Status','Decide'], list.map(r => `<tr><td><a href="#/order?id=${r.order_id}"><b>${esc(r.orders?.title)}</b></a><div class="muted" style="font-size:13px">${money(r.orders?.total_cents)} · buyer ${esc(r.orders?.buyer_name)} · seller ${esc(r.orders?.sellers?.display_name || '')}</div></td>
        <td style="font-size:13px">${esc(r.reason.replace(/_/g, ' '))}${r.details ? `<div class="muted">“${esc(r.details)}”</div>` : ''}</td>
        <td><span class="tag ${r.status === 'escalated' ? 'st-wait' : ''}">${esc(r.status)}</span><div class="muted" style="font-size:12px">reply by ${day(r.respond_by)}</div></td>
        <td><form class="inline-form" data-ret="${r.order_id}"><input placeholder="Reason for decision" required><button class="btn btn-dark" type="submit" value="refund">Refund buyer</button><button class="btn btn-ghost" type="submit" value="close">Close · pay seller</button></form></td></tr>`).join(''));
    qa('[data-ret]', area).forEach(f => f.onsubmit = async (e) => {
      e.preventDefault(); const dec = e.submitter?.value || 'close'; busy(e.submitter, true);
      const { error } = await sb().rpc('admin_resolve_return', { p_order: f.dataset.ret, p_decision: dec, p_note: f.querySelector('input').value });
      if (error) { busy(e.submitter, false); e.submitter.textContent = error.message; return; }
      await sb().functions.invoke('orders', { body: { action: 'sync' } });   // send the refund / payout now
      adminReturns(area);
    });
  }

  window.OffravaAds = { adminAds, adminInquiries, adminReports, adminReturns };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/advertise'] = [viewAdvertise, wireAdvertise];
})();

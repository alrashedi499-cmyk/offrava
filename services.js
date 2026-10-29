/* Offrava Services: customers get sealed quotes from local pros (moving, assembly, installs, repairs),
   pros quote and get booked, the admin switches services and app features on/off. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + ((c||0)/100).toLocaleString('en-US', { minimumFractionDigits: (c||0) % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const toCents = (v) => Math.round(parseFloat(String(v).replace(/[^\d.]/g,'')) * 100);
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  const left = (iso) => { const s = Math.max(0, (new Date(iso) - Date.now())/1000|0); const d = s/86400|0, h = (s%86400)/3600|0, m = (s%3600)/60|0; return d ? `${d}d ${h}h left` : h ? `${h}h ${m}m left` : m ? `${m}m left` : 'closing'; };
  const day = (d) => d ? new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : '';
  const msg = (el, t, ok) => { if (!el) return; el.textContent = t; el.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;
  const GROUPS = { moving: 'Moving & delivery', install: 'Install & assembly', home: 'Home services', auto: 'Car services', tech: 'Tech & developers (done online)', other: 'Other' };
  const WHEN = { asap: 'As soon as possible', week: 'This week', date: 'On a date', flexible: 'I\'m flexible' };
  const timers = []; const clear = () => { while (timers.length) clearInterval(timers.pop()); };
  window.addEventListener('hashchange', clear);

  /* ---------------- Feature switches ---------------- */
  let flags = {};
  const on = (k) => flags[k] !== false;
  async function loadFlags(){
    if (!sb()) return;
    const { data } = await sb().from('feature_flags').select('key,enabled');
    flags = Object.fromEntries((data || []).map(f => [f.key, f.enabled]));
    Object.keys(flags).forEach(k => document.body.classList.toggle('flag-off-' + k, !flags[k]));
  }
  setTimeout(loadFlags, 300);
  window.OffravaFlags = { on, reload: loadFlags };

  /* ---------------- Categories ---------------- */
  let cats = null;
  async function getCats(all){
    if (!cats) { const { data } = await sb().from('service_categories').select('*').order('sort'); cats = data || []; }
    return all ? cats : cats.filter(c => c.enabled);
  }

  // Small strip of services on the home pages
  async function fillStrips(){
    const els = qa('[data-svc-strip]:not([data-done])'); if (!els.length || !sb()) return;
    els.forEach(e => e.dataset.done = 1);
    const list = (await getCats()).slice(0, 8);
    if (!list.length || !on('services')) { els.forEach(e => e.closest('[data-flag]')?.setAttribute('hidden', '')); return; }
    els.forEach(el => el.innerHTML = `<div class="sec-row"><h2>Hire a local pro</h2><a href="#/services">All services</a></div>
      <div class="svc-strip">${list.map(c => `<a href="#/service-request?cat=${c.slug}"><span>${c.emoji}</span>${esc(c.name)}</a>`).join('')}</div>`);
  }
  new MutationObserver(fillStrips).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

  /* ---------------- Services hub ---------------- */
  function viewServices(){
    return `<div class="wrap"><div class="svc-hero"><div><span class="eyebrow">Offrava Services</span><h1>Get quotes from local pros.<br>Pick the best one.</h1>
      <p class="lead">Describe the job, add photos, and nearby pros send sealed quotes. You pay through Offrava — the pro is paid only when the job is done.</p>
      <div class="hero-cta"><a class="btn btn-accent btn-lg" href="#/service-request">Describe your job</a><a class="btn btn-ghost btn-lg" href="#/jobs">My jobs</a></div></div>
      <ul class="svc-points"><li>🔒 Payment held until the job is done</li><li>🪪 ID-verified pros, licensed where required</li><li>⭐ Two-way reviews</li><li>⚖️ No pro can pay to rank higher</li></ul></div>
      <div id="svcGrid"><div class="muted">Loading…</div></div>
      <div class="note" style="margin:24px 0 48px">Are you a pro? <a href="#/pro-jobs"><b>Get local jobs on Offrava</b></a> — no lead fees, you pay only when you're hired.</div></div>`;
  }
  async function wireServices(){
    const g = q('#svcGrid'); if (!g) return;
    if (!on('services')) { g.innerHTML = '<div class="card empty"><b>Services are coming soon.</b></div>'; return; }
    const list = await getCats();
    const byGrp = {}; list.forEach(c => (byGrp[c.grp] ||= []).push(c));
    g.innerHTML = Object.keys(GROUPS).filter(k => byGrp[k]).map(k => `<h2 class="hub-h">${GROUPS[k]}</h2><div class="svc-grid">${byGrp[k].map(c => `
      <a class="svc-card" href="#/service-request?cat=${c.slug}"><span class="e">${c.emoji}</span><b>${esc(c.name)}</b><small>${esc(c.description)}</small>${c.requires_license ? '<span class="tag st-go">Licensed pros</span>' : ''}</a>`).join('')}</div>`).join('')
      || '<div class="card empty"><b>No services are open yet.</b></div>';
  }

  /* ---------------- Post a job ---------------- */
  function viewRequest(){
    if (!A().user) return gate('Sign in to get quotes from local pros.');
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/services">Services</a> / New job</div><h1>Describe your job</h1>
      <p class="muted">The more detail and photos, the more accurate the quotes.</p></div>
      <div class="flow"><form class="card" id="jobF">
        <div class="field"><label for="jc">Service</label><select id="jc" required><option>Loading…</option></select></div>
        <div class="field"><label for="jt">What do you need done?</label><input id="jt" required maxlength="140" placeholder="e.g. Move a 1-bedroom apartment"></div>
        <div id="moveBox" class="spec-box" hidden>
          <div class="row2"><div class="field"><label for="mfrom">From ZIP</label><input id="mfrom" inputmode="numeric" maxlength="5"></div><div class="field"><label for="mto">To ZIP</label><input id="mto" inputmode="numeric" maxlength="5"></div></div>
          <div class="row2"><div class="field"><label for="msize">Size</label><select id="msize"><option>A few items</option><option>Studio</option><option>1 bedroom</option><option>2 bedrooms</option><option>3+ bedrooms</option></select></div>
            <div class="field"><label for="mstairs">Stairs</label><select id="mstairs"><option>No stairs / elevator</option><option>1 flight</option><option>2+ flights</option></select></div></div>
          <label class="check"><input type="checkbox" id="mtruck" checked> The pro brings a truck</label>
        </div>
        <div class="field"><label for="jd">Details</label><textarea id="jd" rows="4" maxlength="2000" placeholder="Sizes, brands, access, parking, anything a pro needs to price it."></textarea></div>
        <div class="field"><label for="jph">Photos (up to 6)</label><input id="jph" type="file" accept="image/jpeg,image/png,image/webp" multiple></div>
        <div class="row2"><div class="field"><label for="jw">When</label><select id="jw">${Object.entries(WHEN).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="field" id="jdateF" hidden><label for="jdate">Date</label><input id="jdate" type="date"></div></div>
        <div class="row2"><div class="field"><label for="jz">Job ZIP</label><input id="jz" required inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${esc(A().profile?.zip || '')}"></div>
          <div class="field"><label for="jb">Budget (optional)</label><input id="jb" inputmode="decimal" placeholder="$"></div></div>
        <div class="field"><label>Collect quotes for</label><div class="choices">${[['4','4 hours'],['24','24 hours'],['48','2 days']].map(([v, t]) => `<label class="choice"><input type="radio" name="win" value="${v}" ${v==='24'?'checked':''}><span>${t}</span></label>`).join('')}</div></div>
        <p class="muted" style="font-size:13px">Pros see your ZIP, not your address or name. You share the address in the chat after you hire.</p>
        <button class="btn btn-accent btn-lg" type="submit">Get quotes</button><p class="form-msg" id="jMsg" role="status"></p></form>
        <aside class="card summary"><h3>How it works</h3>
          <div class="sum-line"><span>1</span><b>Local pros see your job</b></div><div class="sum-line"><span>2</span><b>They send sealed quotes</b></div>
          <div class="sum-line"><span>3</span><b>You compare and hire</b></div><div class="sum-line"><span>4</span><b>Pay now, released when done</b></div>
          <div class="note">Each pro quotes once and can lower once. Rankings: price, reviews, verification, availability — never paid.</div></aside></div></div>`;
  }
  async function wireRequest(){
    const f = q('#jobF'); if (!f) return;
    const list = await getCats();
    const want = params().get('cat');
    q('#jc').innerHTML = Object.keys(GROUPS).map(g => { const cs = list.filter(c => c.grp === g); return cs.length ? `<optgroup label="${GROUPS[g]}">${cs.map(c => `<option value="${c.slug}" ${c.slug===want?'selected':''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</optgroup>` : ''; }).join('');
    const sync = () => { const s = q('#jc').value; q('#moveBox').hidden = !['moving','delivery','junk'].includes(s); q('#jdateF').hidden = q('#jw').value !== 'date'; };
    q('#jc').onchange = sync; q('#jw').onchange = sync; sync();
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'); const m = q('#jMsg'); busy(b, true);
      const files = [...q('#jph').files].slice(0, 6); const photos = [];
      for (const file of files) {
        if (file.size > 5*1024*1024) { busy(b, false); return msg(m, `${file.name} is over 5 MB.`); }
        const path = `${A().user.id}/job-${Date.now()}-${file.name.replace(/[^\w.-]/g,'_')}`;
        const up = await sb().storage.from('listing-photos').upload(path, file, { contentType: file.type });
        if (up.error) { busy(b, false); return msg(m, 'Photo upload failed: ' + up.error.message); }
        photos.push(sb().storage.from('listing-photos').getPublicUrl(path).data.publicUrl);
      }
      const isMove = !q('#moveBox').hidden;
      const specs = isMove ? { from_zip: q('#mfrom').value.trim(), to_zip: q('#mto').value.trim(), size: q('#msize').value, stairs: q('#mstairs').value, truck: q('#mtruck').checked } : {};
      const { data, error } = await sb().from('service_jobs').insert({
        buyer_id: A().user.id, category: q('#jc').value, title: q('#jt').value.trim(), details: q('#jd').value.trim(), photos, specs,
        zip: q('#jz').value.trim(), when_pref: q('#jw').value, preferred_date: q('#jw').value === 'date' ? (q('#jdate').value || null) : null,
        budget_cents: q('#jb').value.trim() ? toCents(q('#jb').value) : null, closes_at: new Date(Date.now() + Number(f.win.value) * 3600e3).toISOString()
      }).select('id').single();
      busy(b, false);
      if (error) return msg(m, error.message);
      location.hash = '#/jobs?new=' + data.id;
    };
  }
  const specText = (sp) => !sp || !Object.keys(sp).length ? '' : [sp.from_zip && sp.to_zip ? `${sp.from_zip} → ${sp.to_zip}` : '', sp.size, sp.stairs, sp.truck ? 'needs truck' : ''].filter(Boolean).map(esc).join(' · ');

  /* ---------------- Customer: my jobs + quotes ---------------- */
  function viewJobs(){
    if (!A().user) return gate('Sign in to see your jobs.');
    return `<div class="wrap"><div class="page-head row-head"><div><div class="crumb"><a href="#/services">Services</a> / My jobs</div><h1>My jobs</h1></div><a class="btn btn-accent" href="#/service-request">New job</a></div>
      <section style="padding-top:8px;padding-bottom:48px"><div id="jobList" style="display:grid;gap:16px"><div class="muted">Loading…</div></div></section></div>`;
  }
  const rankQuotes = (qs) => {
    const ps = qs.map(x => x.price_cents), mn = Math.min(...ps), mx = Math.max(...ps);
    return qs.map(x => {
      const price = mx === mn ? 1 : 1 - (x.price_cents - mn) / (mx - mn);
      const rep = x.rating == null ? 0.6 : Math.max(0, (x.rating - 3.5) / 1.5);
      const trust = (x.id_verified && x.payouts_enabled ? 0.5 : 0) + (x.licensed ? 0.3 : 0) + (x.insured ? 0.2 : 0);
      const soon = x.available_date ? Math.max(0, 1 - (new Date(x.available_date) - Date.now()) / (14 * 864e5)) : 0.5;
      return { ...x, score: Math.round(100 * (0.5 * price + 0.2 * rep + 0.15 * trust + 0.15 * soon)) };
    }).sort((a, b) => b.score - a.score);
  };
  async function wireJobs(){
    const box = q('#jobList'); if (!box) return;
    const { data: jobs, error } = await sb().from('service_jobs').select('*, service_categories(name,emoji)').eq('buyer_id', A().user.id).order('created_at', { ascending: false }).limit(30);
    if (error) return box.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    if (!jobs.length) return box.innerHTML = `<div class="card empty"><b>No jobs yet.</b><p class="muted">Describe a job and local pros send quotes.</p><a class="btn btn-accent" href="#/service-request">Describe your job</a></div>`;
    box.innerHTML = jobs.map(j => `<div class="card" id="j-${j.id}"><div class="offers-top" style="margin:0 0 8px">
      <div><span class="tag">${j.service_categories?.emoji || ''} ${esc(j.service_categories?.name || j.category)}</span><h2 style="margin:8px 0 2px;font-size:22px">${esc(j.title)}</h2>
        <div class="muted" style="font-size:14px">${specText(j.specs) ? specText(j.specs) + ' · ' : ''}ZIP ${esc(j.zip)} · ${esc(WHEN[j.when_pref])}${j.preferred_date ? ' ' + day(j.preferred_date) : ''}${j.budget_cents ? ' · budget ' + money(j.budget_cents) : ''}</div></div>
      <div class="countdown"><div><div class="big" data-left>${j.status === 'hired' ? 'Booked' : new Date(j.closes_at) > new Date() ? left(j.closes_at) : 'Quotes in'}</div><div style="font-size:13px;opacity:.75" data-count></div></div></div></div><div data-quotes></div></div>`).join('');
    for (const j of jobs) {
      const card = q('#j-' + j.id), area = q('[data-quotes]', card);
      if (j.status === 'hired') {
        const { data: o } = await sb().from('orders').select('id,status').eq('job_id', j.id).neq('status', 'pending_payment').order('created_at', { ascending: false }).limit(1);
        area.innerHTML = o?.[0] ? `<a class="btn btn-dark" href="#/order?id=${o[0].id}">Open booking & chat</a>` : ''; continue;
      }
      if (new Date(j.closes_at) > new Date()) {
        const { data: n } = await sb().rpc('quote_count', { p_job: j.id });
        q('[data-count]', card).textContent = `${n || 0} sealed quote${n === 1 ? '' : 's'} so far`;
        timers.push(setInterval(() => { const L = q('[data-left]', card); if (L) L.textContent = left(j.closes_at); }, 30000));
        continue;
      }
      const { data: qs } = await sb().rpc('job_quotes', { p_job: j.id });
      const list = rankQuotes(qs || []);
      q('[data-count]', card).textContent = `${list.length} quote${list.length === 1 ? '' : 's'}`;
      if (!list.length) { area.innerHTML = `<p class="muted">No quotes this time. Add photos and details, or allow a longer window.</p><a class="btn btn-ghost" href="#/service-request?cat=${j.category}">Post again</a>`; continue; }
      area.innerHTML = `<div class="offer-list">${list.map((x, i) => `<article class="offer ${i ? '' : 'top'}"><div class="rank">${i + 1}</div>
        <div><h3>${esc(x.display_name)} ${x.id_verified && x.payouts_enabled ? '<span class="badge-verified">Verified</span>' : ''}</h3>
          <div class="facts">${x.rating ? `<span>★ ${Number(x.rating).toFixed(1)} (${x.review_count})</span>` : '<span>New pro</span>'}<span>${x.sales_count} jobs/sales</span>${x.licensed ? '<span>🪪 Licensed</span>' : ''}${x.insured ? '<span>🛡️ Insured</span>' : ''}${x.available_date ? `<span>📅 ${day(x.available_date)}</span>` : ''}</div>
          ${x.message ? `<p style="margin:6px 0 0;font-size:14px">“${esc(x.message)}”</p>` : ''}<a class="link-btn" href="#/store?id=${x.provider_id}">See reviews</a></div>
        <div class="total"><div class="price">${money(x.price_cents)}</div><small>fixed price · held until done</small><div class="score">Match ${x.score}/100</div></div>
        <a class="btn ${i ? 'btn-ghost' : 'btn-accent'}" href="#/checkout?quote=${x.id}">Hire</a></article>`).join('')}</div>`;
    }
  }

  /* ---------------- Pro: jobs for you + my services ---------------- */
  function viewProJobs(){
    const a = A();
    if (!a.user) return gate('Sign in to get local jobs.');
    if (!a.seller) return gate('Pros join through a seller account first (ID check + payouts). It takes a few minutes.', '#/seller-apply', 'Become a pro');
    if (a.seller.status !== 'approved') return gate(`Your account is <b>${esc(a.seller.status)}</b>. Finish verification while you wait.`, '#/account', 'My account');
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/sell">Selling</a> / Pro jobs</div><h1>Jobs for you</h1>
      <p class="muted">No lead fees. You pay only when you're hired${a.seller.founding ? ' — founding pros pay 0% for 90 days on their first $1,000' : ''}.</p></div>
      <div class="seg" style="max-width:420px"><button type="button" class="on" data-pt="jobs">Open jobs</button><button type="button" data-pt="svc">My services</button></div>
      <section style="padding-top:8px;padding-bottom:48px" id="proArea"></section></div>`;
  }
  async function wireProJobs(){
    const area = q('#proArea'); if (!area) return;
    const tabs = qa('[data-pt]');
    const show = (t) => { tabs.forEach(b => b.classList.toggle('on', b.dataset.pt === t)); (t === 'jobs' ? jobsTab : svcTab)(area); };
    tabs.forEach(b => b.onclick = () => show(b.dataset.pt));
    const { data: mine } = await sb().from('provider_services').select('category').eq('seller_id', A().user.id);
    show(mine?.length ? 'jobs' : 'svc');
  }
  async function jobsTab(area){
    area.innerHTML = '<div class="muted">Loading…</div>';
    const [{ data: jobs, error }, list] = await Promise.all([sb().rpc('open_jobs_for_provider'), getCats(true)]);
    if (error) return area.innerHTML = `<p class="form-msg err">${esc(error.message)}</p>`;
    const name = (s) => { const c = list.find(x => x.slug === s); return c ? `${c.emoji} ${c.name}` : s; };
    if (!jobs?.length) return area.innerHTML = `<div class="card empty"><b>No open jobs in your services right now.</b><p class="muted">You get a notification the moment one is posted. Add more services to see more jobs.</p></div>`;
    area.innerHTML = jobs.map(j => `<div class="alert ${j.my_quote_id ? '' : 'new'}"><div>
        <span class="tag">${esc(name(j.category))}</span><div style="font-weight:600;font-size:17px;margin-top:6px">${esc(j.title)}</div>
        <div class="muted" style="font-size:14px">${specText(j.specs) ? specText(j.specs) + ' · ' : ''}ZIP ${esc(j.zip)} · ${esc(WHEN[j.when_pref])}${j.preferred_date ? ' ' + day(j.preferred_date) : ''} · ${left(j.closes_at)}${j.budget_cents ? ' · budget ' + money(j.budget_cents) : ''}</div>
        ${j.details ? `<p style="margin:6px 0 0;font-size:14px">${esc(j.details)}</p>` : ''}
        ${j.photos?.length ? `<div class="job-photos">${j.photos.map(p => `<a href="${esc(p)}" target="_blank" rel="noopener"><img src="${esc(p)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
        ${j.my_quote_id ? `<div style="font-size:14px;margin-top:6px">Your sealed quote: <b>${money(j.my_quote_cents)}</b>${j.my_quote_improved ? ' (final)' : ''}</div>` : ''}</div>
      <form class="inline-form quote-form" data-job="${j.id}" data-quote="${j.my_quote_id || ''}">
        ${j.my_quote_id ? (j.my_quote_improved ? '<span class="tag">Final quote sent</span>' : `<input name="price" inputmode="decimal" placeholder="Lower price $" required><button class="btn btn-dark" type="submit">Lower once</button>`)
          : `<input name="price" inputmode="decimal" placeholder="Total price $" required><input name="date" type="date" title="Earliest date you can do it"><input name="note" maxlength="600" placeholder="What's included (crew, truck, hours…)"><button class="btn btn-dark" type="submit">Send sealed quote</button>`}
      </form><p class="form-msg" data-m style="grid-column:1/-1;margin:0"></p></div>`).join('');
    qa('form[data-job]', area).forEach(f => f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('button'); const m = f.parentElement.querySelector('[data-m]'); busy(b, true);
      const r = f.dataset.quote ? await sb().from('service_quotes').update({ price_cents: toCents(f.price.value) }).eq('id', f.dataset.quote)
        : await sb().from('service_quotes').insert({ job_id: f.dataset.job, provider_id: A().user.id, price_cents: toCents(f.price.value), available_date: f.date.value || null, message: f.note.value.trim() });
      busy(b, false);
      if (r.error) return msg(m, r.error.message);
      jobsTab(area);
    });
  }
  async function svcTab(area){
    area.innerHTML = '<div class="muted">Loading…</div>';
    const [list, { data: mine }] = await Promise.all([getCats(), sb().from('provider_services').select('*').eq('seller_id', A().user.id)]);
    const by = Object.fromEntries((mine || []).map(m => [m.category, m]));
    area.innerHTML = `<p class="muted" style="margin-top:0">Pick the services you offer. Licensed services are checked by our team before you get jobs.</p>
      <div class="svc-pick">${list.map(c => { const m = by[c.slug]; return `<div class="card svc-row"><div><b>${c.emoji} ${esc(c.name)}</b>${c.requires_license ? ' <span class="tag st-go">License required</span>' : ''}
        <div class="muted" style="font-size:13px">${esc(c.description)}</div>${m ? `<div style="margin-top:6px"><span class="tag ${m.status === 'approved' ? 'st-done' : m.status === 'pending' ? 'st-wait' : 'st-off'}">${m.status === 'approved' ? 'Active — you get these jobs' : m.status === 'pending' ? 'Being checked' : 'Not approved'}</span></div>` : ''}</div>
        <form class="inline-form" data-svc="${c.slug}">${c.requires_license ? `<input name="lic" maxlength="60" placeholder="License #" value="${esc(m?.license_number || '')}" ${m ? '' : 'required'}>` : ''}
          <label class="check" style="margin:0"><input type="checkbox" name="ins" ${m?.insured ? 'checked' : ''}> Insured</label>
          ${m ? `<button class="btn btn-ghost" type="submit">Save</button><button class="btn btn-ghost" type="button" data-rm="${c.slug}">Stop</button>` : `<button class="btn btn-dark" type="submit">Offer this</button>`}</form></div>`; }).join('')}</div>`;
    qa('form[data-svc]', area).forEach(f => f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'); busy(b, true);
      const { error } = await sb().from('provider_services').upsert({ seller_id: A().user.id, category: f.dataset.svc, license_number: f.lic ? f.lic.value.trim() || null : null, insured: f.ins.checked });
      busy(b, false); if (error) { b.textContent = error.message; return; } svcTab(area);
    });
    qa('[data-rm]', area).forEach(b => b.onclick = async () => { await sb().from('provider_services').delete().eq('seller_id', A().user.id).eq('category', b.dataset.rm); svcTab(area); });
  }

  /* ---------------- Admin: services + feature switches ---------------- */
  const table = (head, rows) => `<div class="admin-table"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
  async function adminServices(area){
    cats = null;
    const [{ data: st }, list, { data: apps }, { data: jobs }] = await Promise.all([
      sb().rpc('admin_service_stats'), getCats(true),
      sb().from('provider_services').select('*, sellers(display_name,id_verified,payouts_enabled)').order('created_at', { ascending: false }),
      sb().from('service_jobs').select('id,title,category,zip,status,closes_at,created_at').order('created_at', { ascending: false }).limit(50)
    ]);
    area.innerHTML = `<div class="metrics">${[['Open jobs', st?.jobs_open], ['All jobs', st?.jobs_total], ['Booked', st?.jobs_hired], ['Quotes', st?.quotes_total], ['Active pros', st?.pros_approved], ['Pros to check', st?.pros_pending]].map(([k, v]) => `<div class="stat"><div class="muted">${k}</div><div class="big">${v ?? '—'}</div></div>`).join('')}</div>
      <h2 class="hub-h">Services customers can request</h2>
      ${table(['Service', 'Group', 'License check', 'Open to customers'], list.map(c => `<tr><td><b>${c.emoji} ${esc(c.name)}</b><div class="muted" style="font-size:13px">${esc(c.description)}</div></td><td>${GROUPS[c.grp]}</td>
        <td><label class="switch"><input type="checkbox" data-lic="${c.slug}" ${c.requires_license ? 'checked' : ''}><span></span></label></td>
        <td><label class="switch"><input type="checkbox" data-en="${c.slug}" ${c.enabled ? 'checked' : ''}><span></span></label></td></tr>`).join(''))}
      <h2 class="hub-h">Pro applications</h2>
      ${table(['Pro', 'Service', 'License #', 'Insured', 'Status', ''], (apps || []).sort((a, b) => (a.status !== 'pending') - (b.status !== 'pending')).map(p => `<tr><td><a href="#/store?id=${p.seller_id}"><b>${esc(p.sellers?.display_name || '')}</b></a><div class="muted" style="font-size:12px">${p.sellers?.id_verified ? '✓ ID' : '✗ ID'} · ${p.sellers?.payouts_enabled ? '✓ payouts' : '✗ payouts'}</div></td>
        <td>${esc(p.category)}</td><td>${esc(p.license_number || '—')}</td><td>${p.insured ? 'Yes' : 'No'}</td><td><span class="tag">${esc(p.status)}</span></td>
        <td><div class="acct-links">${p.status !== 'approved' ? `<button class="btn btn-dark" type="button" data-ps="${p.seller_id}|${p.category}|approved">Approve</button>` : ''}${p.status !== 'rejected' ? `<button class="btn btn-ghost" type="button" data-ps="${p.seller_id}|${p.category}|rejected">Reject</button>` : ''}</div></td></tr>`).join(''))}
      <p class="muted" style="font-size:13px">Verify licenses with the issuing city or county before approving (St. Louis City, St. Louis County and others license trades separately).</p>
      <h2 class="hub-h">Recent jobs</h2>
      ${table(['Job', 'Service', 'ZIP', 'Status'], (jobs || []).map(j => `<tr><td><b>${esc(j.title)}</b><div class="muted" style="font-size:12px">${new Date(j.created_at).toLocaleDateString('en-US')}</div></td><td>${esc(j.category)}</td><td>${esc(j.zip)}</td><td><span class="tag">${esc(j.status === 'open' && new Date(j.closes_at) <= new Date() ? 'closed' : j.status)}</span></td></tr>`).join(''))}`;
    qa('[data-en]', area).forEach(c => c.onchange = async () => { await sb().from('service_categories').update({ enabled: c.checked }).eq('slug', c.dataset.en); cats = null; });
    qa('[data-lic]', area).forEach(c => c.onchange = async () => { await sb().from('service_categories').update({ requires_license: c.checked }).eq('slug', c.dataset.lic); cats = null; });
    qa('[data-ps]', area).forEach(b => b.onclick = async () => { const [s, c, v] = b.dataset.ps.split('|'); busy(b, true); await sb().rpc('admin_set_provider_status', { p_seller: s, p_category: c, p_status: v }); adminServices(area); });
  }
  async function adminFeatures(area){
    const { data } = await sb().from('feature_flags').select('*').order('sort');
    area.innerHTML = `<p class="muted" style="margin-top:0">Switch parts of Offrava on or off for everyone. Changes show the next time a page loads.</p>
      <div class="card list-card">${(data || []).map(f => `<div class="flag-row"><div><b>${esc(f.label)}</b><small class="muted">${esc(f.description)}</small></div>
        <label class="switch"><input type="checkbox" data-flag-key="${f.key}" ${f.enabled ? 'checked' : ''}><span></span></label></div>`).join('')}</div>`;
    qa('[data-flag-key]', area).forEach(c => c.onchange = async () => { const { error } = await sb().from('feature_flags').update({ enabled: c.checked }).eq('key', c.dataset.flagKey); if (error) { c.checked = !c.checked; return; } loadFlags(); });
  }

  window.OffravaServices = { adminServices, adminFeatures };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  const wrap = (v, w) => [v, () => { clear(); w && w(); }];
  Object.assign(R, {
    '#/services':        wrap(viewServices, wireServices),
    '#/service-request': wrap(viewRequest, wireRequest),
    '#/jobs':            wrap(viewJobs, wireJobs),
    '#/pro-jobs':        wrap(viewProJobs, wireProJobs)
  });
})();

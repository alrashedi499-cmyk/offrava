/* Offrava live trips (service pros & delivery): the pro shares their location during the trip, the customer follows on a map.
   Pro: Start trip → (delivery) Arrived at pickup → Loaded → Delivered with a photo at the door
                   → (other jobs) Arrived → finish with photo + completion code.
   No-show: after arriving the pro waits, tries to reach the customer, and can close the booking for a fee.
   In the Offrava app (Capacitor) location keeps flowing in the background; on the website the screen must stay on. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  const errMsg = (e) => String(e?.message || e || 'Something went wrong.');
  const STEPS = { delivery: [['on_the_way', 'On the way'], ['arrived_pickup', 'At pickup'], ['loaded', 'Loaded'], ['delivered', 'Delivered']],
                  visit: [['on_the_way', 'On the way'], ['arrived', 'Arrived']] };

  /* ---------------- Location (app: background; web: while the screen is on) ---------------- */
  let live = null;   // { orderId, stop, last }
  async function startWatch(orderId){
    if (live?.orderId === orderId) return live;
    if (live) live.stop();
    const send = async (p) => { live && (live.last = p); try { await sb().rpc('trip_ping', { p_order: orderId, p_lat: p.lat, p_lng: p.lng, p_accuracy: p.acc ?? null, p_heading: p.heading ?? null, p_speed: p.speed ?? null }); } catch (_) {} paintPill(); };
    const BG = window.Capacitor?.Plugins?.BackgroundGeolocation;
    let stop;
    if (BG) {
      const id = await BG.addWatcher({ backgroundTitle: 'Offrava trip in progress', backgroundMessage: 'Sharing your location with the customer until the trip ends.',
        requestPermissions: true, stale: false, distanceFilter: 15 },
        (loc, err) => { if (!err && loc) send({ lat: loc.latitude, lng: loc.longitude, acc: loc.accuracy, heading: loc.bearing, speed: loc.speed }); });
      stop = () => BG.removeWatcher({ id });
    } else {
      if (!navigator.geolocation) throw new Error('This device can\'t share its location.');
      const id = navigator.geolocation.watchPosition(
        (p) => send({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, heading: p.coords.heading, speed: p.coords.speed }),
        (e) => { if (e.code === 1) alert('Location is blocked. Allow location for Offrava so the customer can follow the trip.'); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
      let lock = null; try { lock = await navigator.wakeLock?.request('screen'); } catch (_) {}
      const relock = async () => { if (document.visibilityState === 'visible' && live && !lock) { try { lock = await navigator.wakeLock?.request('screen'); } catch (_) {} } };
      document.addEventListener('visibilitychange', relock);
      stop = () => { navigator.geolocation.clearWatch(id); try { lock?.release(); } catch (_) {} document.removeEventListener('visibilitychange', relock); };
    }
    live = { orderId, stop, last: null };
    try { localStorage.setItem('ofr_trip', orderId); } catch (_) {}
    paintPill();
    return live;
  }
  function stopWatch(){ if (live) live.stop(); live = null; try { localStorage.removeItem('ofr_trip'); } catch (_) {} paintPill(); }
  const here = () => new Promise((res) => {
    if (live?.last) return res(live.last);
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 15000 });
  });
  // A small "trip running" pill on every page, so the pro can always get back to it
  function paintPill(){
    let el = document.getElementById('tripPill');
    if (!live) { el?.remove(); return; }
    if (!el) { el = document.createElement('a'); el.id = 'tripPill'; el.className = 'trip-pill'; document.body.appendChild(el); }
    el.href = '#/order?id=' + live.orderId;
    el.innerHTML = `<span class="trip-dot"></span> Trip live · sharing location${live.last ? '' : ' (waiting for GPS…)'}`;
  }

  /* ---------------- Map (Leaflet + OpenStreetMap) ---------------- */
  let leafletP = null;
  function leaflet(){
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = () => res(window.L); s.onerror = rej; document.head.appendChild(s);
    });
    return leafletP;
  }
  const milesBetween = (a, b) => { const R = 3958.8, r = (d) => d * Math.PI / 180; const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const ago = (t) => { const s = Math.max(0, Math.round((Date.now() - new Date(t)) / 1000)); return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`; };
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  /* ---------------- The trip card on a service booking ---------------- */
  let timer = null;
  async function mount(el, o){
    clearInterval(timer);
    if (!el || o.fulfillment !== 'service') return;
    const me = A().user?.id, pro = o.seller_id === me;
    if (!['paid', 'shipped'].includes(o.status)) {
      if (pro && live?.orderId === o.id) stopWatch();
      el.innerHTML = ''; return;
    }
    const [{ data: t }, { data: ja }] = await Promise.all([
      sb().from('delivery_trips').select('*').eq('order_id', o.id).maybeSingle(),
      sb().from('order_job_addresses').select('*').eq('order_id', o.id).maybeSingle()]);
    if (!q('#oTrip')) return;
    if (pro) return proCard(el, o, t, ja);
    return customerCard(el, o, t);
  }

  /* ----- Pro ----- */
  async function proCard(el, o, t, ja){
    const active = t && !['delivered', 'ended'].includes(t.status);
    if (active && o.status === 'paid') { try { await startWatch(o.id); } catch (_) {} }
    if (!t) {
      el.innerHTML = `<div class="card trip"><b>🚚 Trip</b><p class="muted" style="margin:4px 0 12px">When you leave for the job, start the trip. The customer follows you on a map — your location is shared only until the trip ends.</p>
        ${ja ? `<button class="btn btn-accent" type="button" id="tStart">Start trip</button>` : '<p class="form-msg">Waiting for the customer to add the address.</p>'}<p class="form-msg" data-m></p></div>`;
      const b = q('#tStart', el); if (b) b.onclick = async () => {
        b.disabled = true; const m = q('[data-m]', el);
        try { await startWatch(o.id); const { error } = await sb().rpc('trip_start', { p_order: o.id }); if (error) throw error; mount(el, o); }
        catch (e) { stopWatch(); m.textContent = errMsg(e); m.className = 'form-msg err'; b.disabled = false; }
      };
      return;
    }
    if (!active) { if (live?.orderId === o.id) stopWatch(); el.innerHTML = t.status === 'delivered' ? `<div class="card trip"><b>✅ Delivered</b> <span class="muted">${new Date(t.delivered_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span></div>` : ''; return; }
    const steps = STEPS[t.kind], idx = steps.findIndex(s => s[0] === t.status);
    const phone = ja?.address?.phone;
    const waiting = !!t.waiting_since && ['arrived', 'arrived_pickup'].includes(t.status);
    el.innerHTML = `<div class="card trip"><div class="trip-head"><b>🚚 Trip live</b><span class="trip-gps">${live?.last ? `GPS ±${Math.round(live.last.acc || 0)} m` : 'Getting GPS…'}</span></div>
      <ol class="trip-steps">${steps.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'on' : ''}">${s[1]}</li>`).join('')}</ol>
      ${waiting ? `<div class="trip-wait" id="tWait"><b>Waiting for the customer</b><span id="tClock">…</span>
          <div class="acct-links">${phone ? `<a class="btn btn-dark" id="tCall" href="tel:${esc(phone.replace(/[^\d+]/g, ''))}">📞 Call customer</a>` : ''}<button class="btn btn-ghost" type="button" id="tMsg">💬 Message</button></div>
          <button class="btn btn-ghost" type="button" id="tNoShow" disabled>Customer no-show</button><small class="muted" id="tNsInfo"></small></div>` : ''}
      <div class="acct-links trip-actions">
        ${t.kind === 'delivery' && t.status === 'on_the_way' ? '<button class="btn btn-dark" type="button" data-step="arrived_pickup">📍 Arrived at pickup</button><button class="btn btn-ghost" type="button" data-step="loaded">📦 Loaded — go to drop-off</button>' : ''}
        ${t.kind === 'delivery' && t.status === 'arrived_pickup' ? '<button class="btn btn-accent" type="button" data-step="loaded">📦 Loaded — go to drop-off</button>' : ''}
        ${t.kind === 'delivery' && ['loaded', 'on_the_way', 'arrived_pickup'].includes(t.status) ? `<label class="btn ${t.status === 'loaded' ? 'btn-accent' : 'btn-ghost'}">📷 Delivered — take photo<input type="file" accept="image/*" capture="environment" multiple hidden id="tDone"></label>` : ''}
        ${t.kind === 'visit' && t.status === 'on_the_way' ? '<button class="btn btn-accent" type="button" data-step="arrived">📍 I\'ve arrived</button>' : ''}
      </div>
      ${ja ? `<a class="link-btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(window.OffravaAddresses.oneLine(t.status === 'loaded' && ja.to_address ? ja.to_address : ja.address))}">🧭 Directions to ${t.status === 'loaded' && ja.to_address ? 'drop-off' : t.kind === 'delivery' ? 'pickup' : 'the job'}</a>` : ''}
      <p class="muted" style="font-size:12px;margin:8px 0 0">${window.Capacitor ? 'Location keeps sharing in the background until the trip ends.' : 'Keep this screen on during the trip (the Offrava app shares location in the background).'}</p>
      <p class="form-msg" data-m></p></div>`;
    const m = q('[data-m]', el), fail = (e) => { m.textContent = errMsg(e); m.className = 'form-msg err'; };
    el.querySelectorAll('[data-step]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      if (live?.last) await sb().rpc('trip_ping', { p_order: o.id, p_lat: live.last.lat, p_lng: live.last.lng, p_accuracy: live.last.acc ?? null });
      const { error } = await sb().rpc('trip_step', { p_order: o.id, p_step: b.dataset.step });
      if (error) { b.disabled = false; return fail(error); }
      mount(el, o);
    });
    const done = q('#tDone', el); if (done) done.onchange = async () => {
      const files = [...done.files].slice(0, 6); if (!files.length) return;
      m.className = 'form-msg'; m.textContent = 'Uploading photo…';
      try {
        for (const f of files) {
          const path = `${o.id}/delivered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
          const blob = await shrink(f);
          const up = await sb().storage.from('order-proofs').upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
          const { error } = await sb().rpc('order_add_proof', { p_order: o.id, p_stage: 'delivered', p_kind: 'photo', p_path: path, p_note: null }); if (error) throw error;
        }
        m.textContent = 'Confirming the drop-off…';
        const p = await here();
        const { error } = await sb().rpc('trip_delivered', { p_order: o.id, p_lat: p?.lat ?? null, p_lng: p?.lng ?? null });
        if (error) throw error;
        stopWatch(); window.OffravaSound?.play('done');
        location.reload();
      } catch (e) { fail(e); }
    };
    if (waiting) {
      const call = q('#tCall', el); if (call) call.addEventListener('click', () => sb().rpc('trip_contact', { p_order: o.id, p_method: 'call' }));
      q('#tMsg', el).onclick = async () => { await sb().rpc('trip_contact', { p_order: o.id, p_method: 'message' }); const c = document.querySelector('#oChat textarea, #oChat input'); c?.scrollIntoView({ behavior: 'smooth' }); c?.focus(); };
      const tick = async () => {
        const { data: s } = await sb().rpc('trip_noshow_status', { p_order: o.id });
        if (!s?.waiting || !q('#tWait')) return;
        const left = new Date(s.ready_at) - Date.now();
        q('#tClock').textContent = left > 0 ? `${mmss(left)} until you can close it as a no-show` : 'You waited long enough.';
        q('#tNoShow').disabled = !s.ready;
        q('#tNsInfo').textContent = !s.tried ? 'Call or message the customer first.' : s.customer_replied_at ? 'The customer replied — the clock restarted.' : `You'd get ${money(s.fee_cents)} (minus the Offrava fee) for your time and travel.`;
      };
      tick(); timer = setInterval(tick, 5000);
      q('#tNoShow').onclick = async () => {
        if (!confirm('Close this booking as a customer no-show? The customer is refunded the rest and can dispute it.')) return;
        const { error } = await sb().rpc('trip_no_show', { p_order: o.id });
        if (error) return fail(error);
        stopWatch(); location.reload();
      };
    } else {
      timer = setInterval(() => { const g = q('.trip-gps', el); if (g) g.textContent = live?.last ? `GPS ±${Math.round(live.last.acc || 0)} m` : 'Getting GPS…'; }, 4000);
    }
  }
  async function shrink(file, max = 1600){
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  }

  /* ----- Customer ----- */
  async function customerCard(el, o, t){
    if (!t || ['ended'].includes(t.status)) { el.innerHTML = o.status === 'paid' ? `<div class="card trip muted-card"><b>🚚 Live tracking</b><p class="muted" style="margin:4px 0 0">When your pro leaves for the job, you'll see them here on a map.</p></div>` : ''; return; }
    if (t.status === 'delivered') { el.innerHTML = `<div class="card trip"><b>✅ Delivered</b> <span class="muted">${new Date(t.delivered_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} — see the photo below.</span></div>`; return; }
    const steps = STEPS[t.kind], idx = steps.findIndex(s => s[0] === t.status);
    el.innerHTML = `<div class="card trip"><div class="trip-head"><b>🚚 Live tracking</b><span class="trip-eta" id="tEta"></span></div>
      <ol class="trip-steps">${steps.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'on' : ''}">${s[1]}</li>`).join('')}</ol>
      <div id="tWaitC"></div><div class="trip-map" id="tMap"></div><small class="muted" id="tUpd"></small></div>`;
    const { data: places } = await sb().rpc('trip_places', { p_order: o.id });
    let map = null, pro = null, dest = null;
    try {
      const L = await leaflet();
      if (!q('#tMap')) return;
      map = L.map('tMap', { zoomControl: true, attributionControl: true }).setView([38.627, -90.199], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    } catch (_) { q('#tMap').innerHTML = '<p class="muted" style="padding:16px">Map couldn\'t load — the status above still updates.</p>'; }
    const icon = (txt, cls) => window.L.divIcon({ className: '', html: `<div class="map-pin ${cls}">${txt}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    async function refresh(){
      const { data: tt } = await sb().from('delivery_trips').select('*').eq('order_id', o.id).maybeSingle();
      if (!q('#tMap')) { clearInterval(timer); return; }
      if (!tt || tt.status !== t.status) { clearInterval(timer); return mount(el, o); }
      const target = tt.status === 'loaded' ? places?.dropoff : places?.pickup || places?.dropoff;
      if (map && target) {
        if (!dest) dest = window.L.marker([target.lat, target.lng], { icon: icon('🏠', 'dest') }).addTo(map).bindTooltip(tt.status === 'loaded' ? 'Drop-off area' : 'Your area');
        else dest.setLatLng([target.lat, target.lng]);
      }
      if (tt.lat != null) {
        const pos = { lat: tt.lat, lng: tt.lng };
        if (map) { if (!pro) { pro = window.L.marker([pos.lat, pos.lng], { icon: icon('🚚', 'pro') }).addTo(map); map.setView([pos.lat, pos.lng], 13); } else pro.setLatLng([pos.lat, pos.lng]);
          if (target) map.fitBounds([[pos.lat, pos.lng], [target.lat, target.lng]], { padding: [40, 40], maxZoom: 15 }); }
        if (target) { const mi = milesBetween(pos, { lat: target.lat, lng: target.lng }); const min = Math.max(1, Math.round(mi / 22 * 60)); q('#tEta').textContent = mi < 0.3 ? 'Arriving now' : `about ${min} min away`; }
        q('#tUpd').textContent = `Updated ${ago(tt.located_at)}`;
      } else { q('#tUpd').textContent = tt.waiting_since ? '' : 'Waiting for the pro\'s location…'; q('#tEta').textContent = ''; }
      const w = q('#tWaitC');
      if (tt.waiting_since) {
        const { data: s } = await sb().rpc('trip_noshow_status', { p_order: o.id });
        if (s?.waiting && w) { const left = new Date(s.ready_at) - Date.now();
          w.innerHTML = `<div class="trip-wait cust"><b>📍 Your pro is here and waiting</b><span>${left > 0 ? `Please come out — ${mmss(left)} left before a ${money(s.fee_cents)} no-show fee can apply.` : `Your pro may close this as a no-show (${money(s.fee_cents)} fee). Reply in the chat now if you're on your way.`}</span></div>`; }
      } else if (w) w.innerHTML = '';
    }
    refresh(); timer = setInterval(refresh, 6000);
  }

  // Resume sharing if the pro reloads the page during a trip
  document.addEventListener('DOMContentLoaded', async () => {
    let id = null; try { id = localStorage.getItem('ofr_trip'); } catch (_) {}
    if (!id) return;
    setTimeout(async () => {
      if (!sb() || !A().user) return;
      const { data: t } = await sb().from('delivery_trips').select('status,pro_id').eq('order_id', id).maybeSingle();
      if (t && t.pro_id === A().user.id && !['delivered', 'ended'].includes(t.status)) { try { await startWatch(id); } catch (_) {} } else stopWatch();
    }, 1500);
  });
  window.addEventListener('hashchange', () => clearInterval(timer));
  window.OffravaTrips = { mount, stopWatch };
})();

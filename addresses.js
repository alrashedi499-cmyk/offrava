/* Offrava: saved shipping addresses (#/addresses) + the pieces checkout uses to pick, add and confirm an address. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const qa = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const busy = (b, on) => { if (!b) return; b.disabled = on; b.dataset.label ??= b.innerHTML; b.innerHTML = on ? 'Please wait…' : b.dataset.label; };
  const gate = (text, href='#/login', btn='Sign in') => `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">${text}</p><a class="btn btn-dark" href="${href}">${btn}</a></div></div>`;

  const STATES = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico' };

  const oneLine = (a) => [a.line1, a.line2, `${a.city}, ${a.state} ${a.postal_code}`].filter(Boolean).join(', ');
  const block = (a) => `<b>${esc(a.name)}</b><br>${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>${esc(a.city)}, ${esc(a.state)} ${esc(a.postal_code)}${a.phone ? `<br><span class="muted">${esc(a.phone)}</span>` : ''}`;
  // What Stripe and the order need
  const toShipping = (a) => ({ name: a.name, phone: a.phone || undefined, address: { line1: a.line1, line2: a.line2 || undefined, city: a.city, state: a.state, postal_code: a.postal_code, country: 'US' } });

  async function list(){
    if (!sb() || !A().user) return [];
    const { data } = await sb().from('addresses').select('*').eq('user_id', A().user.id).order('is_default', { ascending: false }).order('last_used_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    return data || [];
  }

  // Address form. opts: { address, showSave, onDone(address, saved), onCancel }
  function form(box, opts = {}){
    const a = opts.address || { name: A().profile?.full_name || '', state: 'MO', postal_code: A().profile?.zip || '', label: 'Home' };
    const id = 'af' + Math.random().toString(36).slice(2, 7);
    box.innerHTML = `<form class="addr-form" id="${id}" novalidate>
      <div class="row2"><div class="field"><label for="${id}n">Full name</label><input id="${id}n" name="name" autocomplete="shipping name" required maxlength="80" value="${esc(a.name)}"></div>
        <div class="field"><label for="${id}p">Phone <span class="muted">(for the delivery driver)</span></label><input id="${id}p" name="phone" type="tel" autocomplete="shipping tel" maxlength="30" value="${esc(a.phone || '')}"></div></div>
      <div class="field"><label for="${id}l1">Street address</label><input id="${id}l1" name="line1" autocomplete="shipping address-line1" required maxlength="120" value="${esc(a.line1 || '')}" placeholder="123 Main St"></div>
      <div class="field"><label for="${id}l2">Apt, suite, unit <span class="muted">(optional)</span></label><input id="${id}l2" name="line2" autocomplete="shipping address-line2" maxlength="120" value="${esc(a.line2 || '')}"></div>
      <div class="addr-3"><div class="field"><label for="${id}c">City</label><input id="${id}c" name="city" autocomplete="shipping address-level2" required maxlength="60" value="${esc(a.city || '')}"></div>
        <div class="field"><label for="${id}s">State</label><select id="${id}s" name="state" autocomplete="shipping address-level1">${Object.entries(STATES).map(([k, v]) => `<option value="${k}" ${k === a.state ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="${id}z">ZIP</label><input id="${id}z" name="postal_code" autocomplete="shipping postal-code" inputmode="numeric" required maxlength="10" value="${esc(a.postal_code || '')}"></div></div>
      <div class="field"><label>Name this address</label><div class="choices addr-labels">${['Home', 'Work', 'Other'].map(l => `<label class="choice"><input type="radio" name="label" value="${l}" ${(a.label || 'Home') === l ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      ${opts.showSave !== false ? `<label class="addr-check"><input type="checkbox" name="save" checked><span>Save to my addresses</span></label>` : ''}
      <label class="addr-check"><input type="checkbox" name="def" ${a.is_default ? 'checked disabled' : ''}><span>${a.is_default ? 'This is your default address' : 'Make this my default address'}</span></label>
      <div class="acct-links" style="margin-top:14px"><button class="btn btn-dark" type="submit">${opts.submitText || 'Save address'}</button>${opts.onCancel ? '<button class="btn btn-ghost" type="button" data-x>Cancel</button>' : ''}</div>
      <p class="form-msg" role="status" aria-live="polite"></p></form>`;
    const f = q('#' + id), m = q('.form-msg', f);
    const err = (t, el) => { m.textContent = t; m.className = 'form-msg err'; el?.focus(); };
    if (opts.onCancel) q('[data-x]', f).onclick = opts.onCancel;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = { name: f.name.value.trim(), phone: f.phone.value.trim() || null, line1: f.line1.value.trim(), line2: f.line2.value.trim() || null,
                  city: f.city.value.trim(), state: f.state.value, postal_code: f.postal_code.value.trim(), label: f.label.value, country: 'US' };
      if (v.name.length < 2) return err('Enter the full name.', f.name);
      if (v.line1.length < 3) return err('Enter the street address.', f.line1);
      if (v.city.length < 2) return err('Enter the city.', f.city);
      if (!/^\d{5}(-\d{4})?$/.test(v.postal_code)) return err('ZIP must be 5 digits.', f.postal_code);
      const save = opts.showSave === false || !f.save || f.save.checked;
      if (f.def.checked && !f.def.disabled) v.is_default = true;
      if (!save) return opts.onDone && opts.onDone({ ...v, id: null }, false);
      const b = f.querySelector('[type=submit]'); busy(b, true);
      const r = a.id ? await sb().from('addresses').update(v).eq('id', a.id).select().single()
                     : await sb().from('addresses').insert({ ...v, user_id: A().user.id }).select().single();
      busy(b, false);
      if (r.error) return err(r.error.message.includes('10 addresses') ? r.error.message : 'Couldn\'t save: ' + r.error.message);
      opts.onDone && opts.onDone(r.data, true);
    };
    setTimeout(() => (a.line1 ? f.line1 : f.name).focus(), 0);
    return f;
  }

  /* ---------------- My addresses page ---------------- */
  function view(){
    if (!A().user) return gate('Sign in to manage your addresses.');
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/me">My Offrava</a> / Addresses</div><h1>My addresses</h1><p class="muted">Pick one at checkout in a tap. Your default is chosen automatically.</p></div>
      <div class="addr-page" style="padding-bottom:48px"><div id="adList"><p class="muted">Loading…</p></div><div id="adForm"></div></div></div>`;
  }
  async function wire(){
    const box = q('#adList'); if (!box) return;
    const rows = await list();
    box.innerHTML = `<div class="addr-grid">${rows.map(a => `<div class="addr-card ${a.is_default ? 'is-def' : ''}">
        <div class="addr-top"><span class="tag">${esc(a.label)}</span>${a.is_default ? '<span class="tag st-done">Default</span>' : ''}</div>
        <div class="addr-body">${block(a)}</div>
        <div class="acct-links"><button class="btn btn-ghost" type="button" data-ed="${a.id}">Edit</button>${a.is_default ? '' : `<button class="btn btn-ghost" type="button" data-def="${a.id}">Make default</button>`}<button class="btn btn-ghost adm-red" type="button" data-del="${a.id}">Delete</button></div></div>`).join('')}
      ${rows.length < 10 ? `<button type="button" class="addr-card addr-new" id="adNew"><span aria-hidden="true">＋</span>Add a new address</button>` : ''}</div>`;
    const fb = q('#adForm');
    const open = (a) => { fb.innerHTML = '<div class="card" style="margin-top:16px;max-width:720px"><h3 style="margin-top:0">' + (a ? 'Edit address' : 'New address') + '</h3><div></div></div>';
      form(q('.card div', fb), { address: a, showSave: false, onDone: () => { fb.innerHTML = ''; wire(); }, onCancel: () => fb.innerHTML = '' }); fb.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const nb = q('#adNew'); if (nb) nb.onclick = () => open(null);
    qa('[data-ed]', box).forEach(b => b.onclick = () => open(rows.find(r => r.id === b.dataset.ed)));
    qa('[data-def]', box).forEach(b => b.onclick = async () => { busy(b, true); await sb().from('addresses').update({ is_default: true }).eq('id', b.dataset.def); wire(); });
    qa('[data-del]', box).forEach(b => b.onclick = async () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Tap again'; return; } busy(b, true); await sb().from('addresses').delete().eq('id', b.dataset.del); wire(); });
    if (!rows.length) open(null);
  }

  window.OffravaAddresses = { list, form, oneLine, block, toShipping, STATES };
  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/addresses'] = [view, wire];
})();

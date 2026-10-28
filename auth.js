/* Offrava accounts: sign in with email or phone, choose buyer/seller, seller application. */
(function(){
  const cfg = window.OFFRAVA_CONFIG || {};
  const ready = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  // lock: run auth steps directly instead of using a browser-wide lock, so one stuck tab can never freeze the others
  const sb = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, lock: async (_name, _timeout, fn) => await fn() }
  }) : null;
  const A = window.OffravaAuth = { sb, ready, user: null, profile: null, seller: null };
  const cameFromRecovery = /type=recovery/.test(location.hash);   // reset-password email link
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const q = (s) => document.querySelector(s);

  const CATEGORIES = ['Electronics','Furniture','Auto parts','Tools','Home & DIY','Kids & toys','Clothing','Collectibles','Appliances','Other'];

  function notReady(){
    return `<div class="card" style="max-width:560px;margin:40px auto"><h2 style="margin-top:0">Accounts are almost ready</h2>
      <p class="muted">The database isn't connected yet. Add the Supabase URL and anon key in <b>config.js</b>, then refresh.</p></div>`;
  }
  function msg(id, text, ok){ const el = q(id); if (el){ el.textContent = text; el.className = 'form-msg ' + (ok ? 'ok' : 'err'); } }
  function busy(btn, on){ if (!btn) return; btn.disabled = on; btn.dataset.label ??= btn.textContent; btn.textContent = on ? 'Please wait…' : btn.dataset.label; }

  async function loadMe(){
    if (!sb) return;
    const { data:{ user } } = await sb.auth.getUser();
    A.user = user || null; A.profile = null; A.seller = null;
    if (user){
      const p = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      A.profile = p.data;
      const s = await sb.from('sellers').select('*').eq('user_id', user.id).maybeSingle();
      A.seller = s.data;
    }
    paintHeader();
  }

  function paintHeader(){
    const slot = q('#accountSlot'); if (!slot) return;
    slot.innerHTML = A.user
      ? `${A.profile?.is_admin ? '<a href="#/admin" class="nav-link">Admin</a>' : ''}<a href="#/account" class="nav-link">${esc(A.profile?.full_name?.split(' ')[0] || 'Account')}</a>`
      : `<a href="#/login" class="nav-link">Sign in</a>`;
    const tab = q('#tabAccount');
    if (tab) tab.setAttribute('href', A.user ? '#/account' : '#/login');
  }

  /* ---------- Views ---------- */
  function viewLogin(){
    if (!ready) return notReady();
    return `<div class="wrap"><div class="auth">
      <div class="card auth-card">
        <h1>Sign in or create an account</h1>
        <p class="muted">Use your email or phone number. New here? We'll create your account.</p>
        <div class="seg" role="tablist">
          <button type="button" role="tab" class="on" id="tabEmail" aria-selected="true">Email</button>
          <button type="button" role="tab" id="tabPhone" aria-selected="false">Phone</button>
        </div>

        <form id="emailForm">
          <div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" required placeholder="you@example.com"></div>
          <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"></div>
          <div class="auth-actions">
            <button class="btn btn-dark btn-lg" type="submit" id="btnSignIn">Sign in</button>
            <button class="btn btn-ghost btn-lg" type="button" id="btnSignUp">Create account</button>
          </div>
          <button class="linkbtn" type="button" id="btnForgot">Forgot password?</button>
        </form>

        <form id="phoneForm" hidden>
          <div class="field"><label for="ph">Mobile number</label><input id="ph" type="tel" autocomplete="tel" placeholder="(314) 555-0123" required></div>
          <div class="field" id="codeField" hidden><label for="code">6-digit code</label><input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></div>
          <div class="auth-actions"><button class="btn btn-dark btn-lg" type="submit" id="btnPhone">Text me a code</button></div>
          <p class="muted" style="font-size:13px">Message and data rates may apply. US numbers only for now.</p>
        </form>

        <p id="authMsg" class="form-msg" role="status" aria-live="polite"></p>
      </div>
    </div></div>`;
  }

  function wireLogin(){
    if (!ready) return;
    const tE = q('#tabEmail'), tP = q('#tabPhone'), fE = q('#emailForm'), fP = q('#phoneForm');
    const sw = (email) => { fE.hidden = !email; fP.hidden = email; tE.classList.toggle('on', email); tP.classList.toggle('on', !email); tE.setAttribute('aria-selected', email); tP.setAttribute('aria-selected', !email); msg('#authMsg',''); };
    tE.onclick = () => sw(true); tP.onclick = () => sw(false);

    fE.onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnSignIn'); busy(b, true);
      const { error } = await sb.auth.signInWithPassword({ email: q('#em').value.trim(), password: q('#pw').value });
      busy(b, false);
      if (error) return msg('#authMsg', error.message === 'Invalid login credentials' ? 'Wrong email or password. New here? Tap "Create account".' : error.message);
      await afterLogin();
    };
    q('#btnSignUp').onclick = async () => {
      const email = q('#em').value.trim(), password = q('#pw').value;
      if (!email || password.length < 8) return msg('#authMsg', 'Enter your email and a password of at least 8 characters.');
      const b = q('#btnSignUp'); busy(b, true);
      const { data, error } = await sb.auth.signUp({ email, password, options:{ emailRedirectTo: location.origin + location.pathname + '#/onboarding' } });
      busy(b, false);
      if (error) return msg('#authMsg', error.message);
      if (data.session) return afterLogin();
      msg('#authMsg', 'Check your email and tap the link to confirm your account.', true);
    };
    q('#btnForgot').onclick = async () => {
      const email = q('#em').value.trim();
      if (!email) return msg('#authMsg', 'Type your email first.');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      msg('#authMsg', error ? error.message : 'We sent you a link to reset your password.', !error);
    };

    let sent = false;
    fP.onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnPhone');
      let phone = q('#ph').value.replace(/[^\d+]/g, '');
      if (!phone.startsWith('+')) phone = '+1' + phone.replace(/^1/, '');
      busy(b, true);
      if (!sent){
        const { error } = await sb.auth.signInWithOtp({ phone });
        busy(b, false);
        if (error) return msg('#authMsg', /provider|sms/i.test(error.message) ? 'Phone sign-in isn\'t switched on yet. Please use email for now.' : error.message);
        sent = true; q('#codeField').hidden = false; b.textContent = 'Verify code'; b.dataset.label = 'Verify code';
        msg('#authMsg', 'We texted you a 6-digit code.', true); q('#code').focus();
      } else {
        const { error } = await sb.auth.verifyOtp({ phone, token: q('#code').value.trim(), type: 'sms' });
        busy(b, false);
        if (error) return msg('#authMsg', 'That code didn\'t work. Check it and try again.');
        await afterLogin();
      }
    };
  }

  async function afterLogin(){
    await loadMe();
    await logActivity('signed_in');
    location.hash = A.profile?.onboarded ? '#/account' : '#/onboarding';
  }

  function viewOnboarding(){
    if (!ready) return notReady();
    if (!A.user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto">Please <a href="#/login"><b>sign in</b></a> first.</div></div>`;
    const p = A.profile || {};
    return `<div class="wrap"><div class="auth">
      <form class="card auth-card" id="onbForm">
        <h1>Welcome to Offrava</h1>
        <p class="muted">Tell us a little about you. You can change this anytime.</p>
        <div class="field"><label for="fn">Full name</label><input id="fn" required autocomplete="name" value="${esc(p.full_name)}"></div>
        <div class="field"><label for="zp">ZIP code</label><input id="zp" required inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${esc(p.zip)}" placeholder="63105"></div>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 20px">
          <legend style="font-weight:600;font-size:14px;margin-bottom:8px">I want to</legend>
          <div class="role-grid">
            <label class="role"><input type="radio" name="role" value="buyer" ${!p.is_seller?'checked':''}><span><b>Buy</b><small>Shop and request competing offers</small></span></label>
            <label class="role"><input type="radio" name="role" value="seller" ${p.is_seller&&!p.is_buyer?'checked':''}><span><b>Sell</b><small>List items and answer buyer requests</small></span></label>
            <label class="role"><input type="radio" name="role" value="both" ${p.is_seller&&p.is_buyer?'checked':''}><span><b>Both</b><small>Buy and sell with one account</small></span></label>
          </div>
        </fieldset>
        <button class="btn btn-accent btn-lg" type="submit" id="btnOnb" style="width:100%">Continue</button>
        <p id="onbMsg" class="form-msg" role="status" aria-live="polite"></p>
      </form>
    </div></div>`;
  }

  function wireOnboarding(){
    const f = q('#onbForm'); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnOnb'); busy(b, true);
      const role = f.role.value;
      const { error } = await sb.from('profiles').update({
        full_name: q('#fn').value.trim(), zip: q('#zp').value.trim(),
        is_buyer: role !== 'seller', is_seller: role !== 'buyer', onboarded: true
      }).eq('id', A.user.id);
      busy(b, false);
      if (error) return msg('#onbMsg', error.message);
      await loadMe();
      await logActivity('profile_updated');
      location.hash = role === 'buyer' ? '#/account' : '#/seller-apply';
    };
  }

  function viewSellerApply(){
    if (!ready) return notReady();
    if (!A.user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto">Please <a href="#/login"><b>sign in</b></a> first.</div></div>`;
    if (A.seller) return sellerStatus();
    return `<div class="wrap"><div class="auth">
      <form class="card auth-card wide" id="sellForm">
        <span class="tag">Founding seller · 0% commission for 90 days</span>
        <h1>Apply to sell on Offrava</h1>
        <p class="muted">Free to list. Free to send offers. You only pay a commission when you sell.</p>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 20px">
          <legend style="font-weight:600;font-size:14px;margin-bottom:8px">Seller type</legend>
          <div class="choices">
            <label class="choice"><input type="radio" name="stype" value="individual" checked><span>Individual</span></label>
            <label class="choice"><input type="radio" name="stype" value="business"><span>Registered business</span></label>
          </div>
        </fieldset>
        <div class="row2">
          <div class="field"><label for="dn">Name buyers will see</label><input id="dn" required maxlength="60" value="${esc(A.profile?.full_name)}"></div>
          <div class="field" id="bnField" hidden><label for="bn">Legal business name</label><input id="bn" maxlength="120"></div>
        </div>
        <div class="field"><label for="szp">Pickup ZIP</label><input id="szp" required inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${esc(A.profile?.zip)}"></div>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 20px">
          <legend style="font-weight:600;font-size:14px;margin-bottom:8px">What do you sell?</legend>
          <div class="choices">${CATEGORIES.map(c=>`<label class="choice"><input type="checkbox" name="cats" value="${esc(c)}"><span>${esc(c)}</span></label>`).join('')}</div>
        </fieldset>
        <fieldset class="field" style="border:0;padding:0;margin:0 0 20px">
          <legend style="font-weight:600;font-size:14px;margin-bottom:8px">How can buyers get items?</legend>
          <div class="choices">
            <label class="choice"><input type="checkbox" id="opPick" checked><span>Local pickup</span></label>
            <label class="choice"><input type="checkbox" id="opShip"><span>I ship (USPS / UPS / FedEx)</span></label>
          </div>
        </fieldset>
        <label class="check"><input type="checkbox" id="terms" required> I agree to the Seller Terms and won't list stolen, counterfeit or prohibited items.</label>
        <div class="note">Next step after approval: identity and payout setup through our payment partner (Stripe). We never store your ID or bank numbers.</div>
        <button class="btn btn-accent btn-lg" type="submit" id="btnSell" style="width:100%;margin-top:20px">Submit application</button>
        <p id="sellMsg" class="form-msg" role="status" aria-live="polite"></p>
      </form>
    </div></div>`;
  }

  function wireSellerApply(){
    const f = q('#sellForm'); if (!f) return;
    f.querySelectorAll('input[name="stype"]').forEach(r => r.onchange = () => { q('#bnField').hidden = f.stype.value !== 'business'; q('#bn').required = f.stype.value === 'business'; });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const cats = [...f.querySelectorAll('input[name="cats"]:checked')].map(i => i.value);
      if (!cats.length) return msg('#sellMsg', 'Pick at least one category.');
      if (!q('#opPick').checked && !q('#opShip').checked) return msg('#sellMsg', 'Choose pickup, shipping, or both.');
      const b = q('#btnSell'); busy(b, true);
      const { error } = await sb.from('sellers').insert({
        user_id: A.user.id, seller_type: f.stype.value, display_name: q('#dn').value.trim(),
        business_name: f.stype.value === 'business' ? q('#bn').value.trim() : null,
        zip: q('#szp').value.trim(), categories: cats,
        offers_pickup: q('#opPick').checked, offers_shipping: q('#opShip').checked
      });
      if (!error) await sb.from('profiles').update({ is_seller: true }).eq('id', A.user.id);
      busy(b, false);
      if (error) return msg('#sellMsg', error.message);
      await loadMe(); location.hash = '#/account';
    };
  }

  function sellerStatus(){
    const s = A.seller;
    const map = { pending:['Under review','We review new sellers within 1–2 business days. You can verify now to speed things up.'], approved:['Approved','You can list items and answer buyer requests.'], rejected:['Not approved','Contact support if you think this is a mistake.'], suspended:['Suspended','Contact support.'] };
    const [t, d] = map[s.status] || map.pending;
    const canVerify = s.status === 'pending' || s.status === 'approved';
    const step = (done, title, desc, action, btn) => `
      <div class="vstep ${done ? 'done' : ''}">
        <span class="vmark" aria-hidden="true">${done ? '✓' : ''}</span>
        <div style="flex:1"><b>${title}</b><div class="muted" style="font-size:14px">${desc}</div></div>
        ${done ? '<span class="tag">Done</span>' : (canVerify ? `<button class="btn btn-dark" type="button" data-verify="${action}">${btn}</button>` : '')}
      </div>`;
    return `<div class="card"><span class="tag">Seller account</span>
      <h2 style="margin:10px 0 4px">${esc(s.display_name)} — ${t}${s.id_verified && s.payouts_enabled ? ' <span class="badge-verified">Verified seller</span>' : ''}</h2>
      <p class="muted" style="margin:0 0 16px">${d}</p>
      <div class="vsteps">
        ${step(s.payouts_enabled, 'Payouts and tax info', s.details_submitted && !s.payouts_enabled ? 'Stripe is reviewing your details, or needs a little more info.' : (s.seller_type === 'business' ? 'Business details, EIN and bank account — entered securely with Stripe.' : 'Legal name, SSN and bank account — entered securely with Stripe.'), 'onboard', s.details_submitted ? 'Finish setup' : 'Set up payouts')}
        ${step(s.id_verified, 'Photo ID check', 'A photo of your driver\'s license or ID, plus a selfie. Earns the Verified seller badge.', 'identity', 'Verify identity')}
      </div>
      <p class="muted" style="font-size:13px;margin:12px 0 0">Offrava never sees or stores your SSN, EIN, ID photos or bank numbers — Stripe handles them. You can't receive payouts until setup is complete.</p>
      <div id="stripePanel" class="embed-panel" hidden></div>
      <p id="verMsg" class="form-msg" role="status" aria-live="polite"></p>
      ${s.status==='approved' ? '<a class="btn btn-accent" href="#/sell" style="margin-top:8px">Open seller dashboard</a>' : ''}</div>`;
  }

  /* Stripe forms stay INSIDE our page: payouts setup is embedded, ID check opens as a window over the page. */
  const PK = () => (window.OFFRAVA_CONFIG || {}).STRIPE_PUBLISHABLE_KEY || '';
  const waitFor = (test, ms = 8000) => new Promise((res) => { const t0 = Date.now(); const i = setInterval(() => { if (test() || Date.now() - t0 > ms) { clearInterval(i); res(test()); } }, 100); });
  const apiError = async (error, data) => (data && data.error) || (error && error.context && (await error.context.json().catch(() => ({}))).error) || 'Something went wrong. Please try again.';

  async function startVerify(action, btn){
    busy(btn, true);
    if (action === 'onboard' && PK() && await waitFor(() => window.StripeConnect && window.StripeConnect.init)) {
      return openEmbeddedOnboarding(btn);
    }
    const { data, error } = await sb.functions.invoke('seller-verify', { body: { action } });
    if (error || !(data?.client_secret || data?.url)) { busy(btn, false); return msg('#verMsg', await apiError(error, data)); }
    if (action === 'identity' && data.client_secret && PK() && await waitFor(() => window.Stripe)) {
      const stripe = window.Stripe(PK());
      const result = await stripe.verifyIdentity(data.client_secret);   // opens on top of our page
      busy(btn, false);
      if (result.error) return msg('#verMsg', result.error.message || 'The ID check was closed before it finished.');
      msg('#verMsg', 'Thanks! Checking your ID check result…', true);
      A._checkedAt = 0; await refreshVerify(); window.offravaRoute && window.offravaRoute();
      return;
    }
    location.href = data.url;   // fallback if Stripe's in-page tools can't load
  }

  async function openEmbeddedOnboarding(btn){
    const panel = q('#stripePanel');
    panel.hidden = false;
    panel.innerHTML = '<div class="muted" style="padding:12px 0">Loading secure form…</div>';
    try {
      const instance = window.StripeConnect.init({
        publishableKey: PK(),
        fetchClientSecret: async () => {
          const { data, error } = await sb.functions.invoke('seller-verify', { body: { action: 'account_session' } });
          if (error || !data?.client_secret) throw new Error(await apiError(error, data));
          return data.client_secret;
        },
        appearance: { variables: { colorPrimary: '#121212', fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '12px', colorBackground: '#FFFFFF' } }
      });
      const onboarding = instance.create('account-onboarding');
      onboarding.setOnExit(async () => {
        panel.innerHTML = '<div class="muted" style="padding:12px 0">Saving…</div>';
        A._checkedAt = 0; await refreshVerify(); window.offravaRoute && window.offravaRoute();
      });
      panel.innerHTML = '<div class="embed-head"><b>Payouts and tax info</b><span class="muted" style="font-size:13px">Secured by Stripe — Offrava never sees your SSN or bank numbers.</span></div>';
      panel.appendChild(onboarding);
      busy(btn, false); btn.hidden = true;
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      busy(btn, false); panel.hidden = true;
      msg('#verMsg', e.message || 'Could not load the payouts form.');
    }
  }

  async function refreshVerify(){
    if (!A.seller || !(A.seller.stripe_account_id || A.seller.identity_session_id)) return;
    await sb.functions.invoke('seller-verify', { body: { action: 'refresh' } });
    await loadMe();
  }

  function viewAccount(){
    if (!ready) return notReady();
    if (!A.user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto">Please <a href="#/login"><b>sign in</b></a> first.</div></div>`;
    const p = A.profile || {};
    return `<div class="wrap"><div class="page-head"><div class="crumb">Account</div><h1>Hi, ${esc(p.full_name || 'there')}</h1>
      <p class="muted">${esc(A.user.email || A.user.phone || '')} · ZIP ${esc(p.zip || '—')}</p></div>
      <section style="padding-top:12px;display:grid;gap:16px">
        <div class="card"><span class="tag">Buyer</span><h2 style="margin:10px 0 4px">${p.is_buyer ? 'Active' : 'Off'}</h2>
          <p class="muted" style="margin:0 0 16px">Request offers and buy from local sellers.</p><a class="btn btn-accent" href="#/request">Get offers</a></div>
        ${p.is_admin ? `<div class="card"><span class="tag">Admin</span><h2 style="margin:10px 0 4px">Admin panel</h2><p class="muted" style="margin:0 0 16px">Approve sellers, review listings and watch the marketplace.</p><a class="btn btn-dark" href="#/admin">Open admin panel</a></div>` : ''}
        ${A.seller ? sellerStatus() : `<div class="card"><span class="tag">Seller</span><h2 style="margin:10px 0 4px">Start selling</h2><p class="muted" style="margin:0 0 16px">Founding sellers pay 0% commission for 90 days.</p><a class="btn btn-dark" href="#/seller-apply">Apply to sell</a></div>`}
        <div class="acct-links">
          <a class="btn btn-ghost" href="#/onboarding">Edit profile</a>
          <a class="btn btn-ghost" href="#/settings">Settings</a>
          <a class="btn btn-ghost" href="#/new-password">Change password</a>
          <a class="btn btn-ghost" href="#/activity">Activity history</a>
          <button class="btn btn-ghost" type="button" id="btnOut">Sign out</button>
        </div>
      </section></div>`;
  }

  /* ---------- Activity log helper ---------- */
  async function logActivity(action, details){
    if (!sb || !A.user) return;
    await sb.from('activity_log').insert({ user_id: A.user.id, action, entity_type: action.split('_')[0], details: details || {} });
  }
  A.log = logActivity;

  /* ---------- Settings ---------- */
  function viewSettings(){
    if (!ready) return notReady();
    if (!A.user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto">Please <a href="#/login"><b>sign in</b></a> first.</div></div>`;
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/account">Account</a> / Settings</div><h1>Settings</h1>
      <p class="muted">Saved to your account, so they follow you on every device.</p></div>
      <form class="card settings" id="setForm" style="margin-bottom:48px">
        <h3>Notifications</h3>
        <label class="check"><input type="checkbox" name="notify_push"> App notifications</label>
        <label class="check"><input type="checkbox" name="notify_email"> Email</label>
        <label class="check"><input type="checkbox" name="notify_sms"> Text messages (only for important updates)</label>
        <div class="field" style="margin-top:12px"><label for="digest">When my request gets offers</label>
          <select id="digest" name="offers_digest">
            <option value="when_closed">Tell me once, when offers open</option>
            <option value="each_offer">Tell me about each offer</option>
            <option value="daily">Daily summary</option>
          </select></div>
        <h3>Requests</h3>
        <div class="row2">
          <div class="field"><label for="radius">Search radius (miles)</label><input id="radius" name="search_radius_mi" type="number" min="1" max="500"></div>
          <div class="field"><label for="win">Default offer window</label>
            <select id="win" name="default_window"><option value="1h">1 hour</option><option value="4h">4 hours</option><option value="24h">24 hours</option></select></div>
        </div>
        <div class="field"><label for="ful">I usually want</label>
          <select id="ful" name="default_fulfillment"><option value="any">Pickup or delivery</option><option value="pickup">Pickup only</option><option value="shipping">Shipping only</option></select></div>
        <h3>App</h3>
        <div class="row2">
          <div class="field"><label for="lang">Language</label>
            <select id="lang" name="language"><option value="en">English</option><option value="ar">العربية</option><option value="es">Español</option></select></div>
          <div class="field"><label for="theme">Appearance</label>
            <select id="theme" name="theme"><option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
        </div>
        <button class="btn btn-accent btn-lg" type="submit" id="btnSet">Save settings</button>
        <p id="setMsg" class="form-msg" role="status" aria-live="polite"></p>
      </form></div>`;
  }

  async function wireSettings(){
    const f = q('#setForm'); if (!f) return;
    let { data } = await sb.from('user_settings').select('*').eq('user_id', A.user.id).maybeSingle();
    data = data || {};
    [...f.elements].forEach(el => { if (!el.name || !(el.name in data)) return; if (el.type === 'checkbox') el.checked = !!data[el.name]; else el.value = data[el.name]; });
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = q('#btnSet'); busy(b, true);
      const row = { user_id: A.user.id, updated_at: new Date().toISOString() };
      [...f.elements].forEach(el => { if (!el.name) return; row[el.name] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value); });
      const { error } = await sb.from('user_settings').upsert(row);
      busy(b, false);
      if (error) return msg('#setMsg', error.message);
      await logActivity('settings_updated');
      msg('#setMsg', 'Saved.', true);
    };
  }

  /* ---------- Activity history ---------- */
  const ACT = {
    account_created:'Created your account', signed_in:'Signed in', signed_out:'Signed out', profile_updated:'Updated your profile',
    settings_updated:'Changed your settings', seller_applied:'Applied to sell', seller_approved:'Seller account approved',
    seller_rejected:'Seller application not approved', seller_suspended:'Seller account suspended',
    request_created:'Requested offers', offer_sent:'Sent an offer', offer_accepted:'Your offer was accepted',
    listing_created:'Listed an item', viewed_offers:'Viewed offers', purchase:'Made a purchase',
    payouts_enabled:'Payouts set up with Stripe', identity_verified:'Identity verified'
  };

  function viewActivity(){
    if (!ready) return notReady();
    if (!A.user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto">Please <a href="#/login"><b>sign in</b></a> first.</div></div>`;
    return `<div class="wrap"><div class="page-head"><div class="crumb"><a href="#/account">Account</a> / Activity</div><h1>Your activity</h1>
      <p class="muted">Everything you've done on Offrava. Only you can see this.</p></div>
      <section style="padding-top:12px"><div class="card"><ul class="timeline" id="actList"><li class="muted">Loading…</li></ul>
      <button class="btn btn-ghost" type="button" id="btnMore" hidden style="margin-top:16px">Show more</button></div></section></div>`;
  }

  async function wireActivity(){
    const list = q('#actList'); if (!list) return;
    let page = 0; const size = 25;
    const fmt = (d) => new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    async function load(){
      const { data, error } = await sb.from('activity_log').select('*').eq('user_id', A.user.id)
        .order('created_at', { ascending:false }).range(page*size, page*size + size - 1);
      if (error) { list.innerHTML = `<li class="form-msg err">${esc(error.message)}</li>`; return; }
      if (page === 0) list.innerHTML = '';
      if (!data.length && page === 0) list.innerHTML = '<li class="muted">Nothing here yet.</li>';
      list.insertAdjacentHTML('beforeend', data.map(r => `<li><span class="t-dot" aria-hidden="true"></span><div><b>${esc(ACT[r.action] || r.action.replace(/_/g,' '))}</b><div class="muted" style="font-size:13px">${fmt(r.created_at)}</div></div></li>`).join(''));
      q('#btnMore').hidden = data.length < size;
    }
    q('#btnMore').onclick = () => { page++; load(); };
    load();
  }

  function wireAccount(){
    document.querySelectorAll('[data-verify]').forEach(btn => btn.onclick = () => startVerify(btn.dataset.verify, btn));
    // Re-check with Stripe whenever a step is started but not finished (e.g. right after returning from Stripe)
    const s = A.seller;
    const pending = s && ((s.stripe_account_id && !s.payouts_enabled) || (s.identity_session_id && !s.id_verified));
    if (pending && (!A._checkedAt || Date.now() - A._checkedAt > 30000)) {   // at most once every 30 s
      A._checkedAt = Date.now();
      msg('#verMsg', 'Checking your verification status…', true);
      refreshVerify().then(() => {
        const formOpen = q('#stripePanel') && !q('#stripePanel').hidden;   // never wipe a form the seller is filling in
        if (!formOpen && location.hash.startsWith('#/account')) { history.replaceState(null, '', '#/account'); window.offravaRoute && window.offravaRoute(); }
      });
    }
    const b = q('#btnOut'); if (b) b.onclick = async () => { await logActivity('signed_out'); await sb.auth.signOut(); await loadMe(); location.hash = '#/'; };
  }

  /* ---------- Set a new password (after "Forgot password" link, or from Account) ---------- */
  function viewNewPassword(){
    if (!ready) return notReady();
    if (!A.user) return `<div class="wrap"><div class="card auth-card" style="margin:40px auto"><p style="margin-top:0">Open the reset link from your email to set a new password.</p><a class="btn btn-dark" href="#/login">Back to sign in</a></div></div>`;
    return `<div class="wrap"><div class="auth"><form class="card auth-card" id="npForm">
      <h1>Set a new password</h1>
      <p class="muted">For ${esc(A.user.email || '')}</p>
      <div class="field"><label for="np1">New password</label><input id="np1" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="field"><label for="np2">Type it again</label><input id="np2" type="password" autocomplete="new-password" minlength="8" required></div>
      <button class="btn btn-accent btn-lg" type="submit" id="btnNp" style="width:100%">Save password</button>
      <p id="npMsg" class="form-msg" role="status" aria-live="polite"></p>
    </form></div></div>`;
  }
  function wireNewPassword(){
    const f = q('#npForm'); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (q('#np1').value !== q('#np2').value) return msg('#npMsg', 'The two passwords don\'t match.');
      const b = q('#btnNp'); busy(b, true);
      const { error } = await sb.auth.updateUser({ password: q('#np1').value });
      busy(b, false);
      if (error) return msg('#npMsg', error.message);
      msg('#npMsg', 'Password saved. Taking you to your account…', true);
      setTimeout(() => { location.hash = A.profile?.onboarded ? '#/account' : '#/onboarding'; }, 1200);
    };
  }

  window.OFFRAVA_VIEWS = {
    '#/new-password': [viewNewPassword, wireNewPassword],
    '#/login': [viewLogin, wireLogin],
    '#/onboarding': [viewOnboarding, wireOnboarding],
    '#/seller-apply': [viewSellerApply, wireSellerApply],
    '#/account': [viewAccount, wireAccount],
    '#/settings': [viewSettings, wireSettings],
    '#/activity': [viewActivity, wireActivity]
  };

  A.init = async () => {
    // Never call Supabase inside this callback directly: it holds the auth lock and would freeze other requests.
    // Defer the work with setTimeout so the lock is released first.
    if (sb) sb.auth.onAuthStateChange((evt) => {
      if (evt === 'PASSWORD_RECOVERY') { setTimeout(async () => { await loadMe(); location.hash = '#/new-password'; }, 0); return; }
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') {
        setTimeout(async () => {
          const before = A.user?.id;
          await loadMe();
          if (before !== A.user?.id) window.offravaRoute && window.offravaRoute();   // only redraw when the person actually changed
        }, 0);
      }
    });
    await loadMe();
    if (cameFromRecovery && A.user) { location.hash = '#/new-password'; return; }
    window.offravaRoute && window.offravaRoute();   // re-draw once we know who is signed in
  };
})();

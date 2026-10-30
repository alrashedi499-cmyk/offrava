/* Offrava inside the iPhone / Android app (Capacitor). Does nothing on the website.
   • Back button (Android), status bar, haptics on alerts, external links open in the phone's browser.
   • Apple rule: games & software (digital) are bought on the website — in the iPhone app the Buy button opens Safari.
   • Live trips use the native background-location plugin (see tracking.js). */
(function(){
  const Cap = window.Capacitor;
  if (!Cap?.isNativePlatform?.()) return;
  const P = Cap.Plugins || {}, platform = Cap.getPlatform();
  const SITE = 'https://alrashedi499-cmyk.github.io/offrava/';
  window.OFFRAVA_SITE = SITE;                       // email links (sign-up, password reset) go to the website
  document.documentElement.classList.add('is-native', 'is-' + platform);

  try { P.StatusBar?.setStyle({ style: 'LIGHT' }); if (platform === 'android') P.StatusBar?.setBackgroundColor({ color: '#F6F5F0' }); } catch (_) {}

  // Android back button: go back inside the app, or close it from the home screen
  P.App?.addListener('backButton', () => {
    const h = location.hash || '#/';
    if (h === '#/' || h === '#') P.App.exitApp(); else history.back();
  });

  // Links to other websites open in the phone's browser
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]'); if (!a) return;
    const href = a.getAttribute('href') || '';
    if (/^(https?:|mailto:|tel:|sms:)/i.test(href) && !href.startsWith(location.origin)) { e.preventDefault(); window.open(href, '_blank'); }
  }, true);

  // iPhone: digital purchases (games & software, the Pro plan) happen on the website — handled by the checkout and Pro pages themselves

  // A small buzz with alert sounds
  const buzz = (name) => { try {
    if (['sale', 'done', 'thanks', 'payout'].includes(name)) P.Haptics?.notification({ type: 'SUCCESS' });
    else if (['alert', 'refund'].includes(name)) P.Haptics?.notification({ type: 'WARNING' });
    else P.Haptics?.impact({ style: 'LIGHT' });
  } catch (_) {} };
  const hook = () => { const S = window.OffravaSound; if (!S || S._native) return; const play = S.play; S.play = (n, ...r) => { buzz(n); return play.call(S, n, ...r); }; S._native = true; };
  document.addEventListener('DOMContentLoaded', hook); setTimeout(hook, 1500);

  // Back in the app after a while (e.g. paid in Safari): refresh what's on screen
  P.App?.addListener('resume', () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });

  /* ---------- Live updates: new screens without an App Store / Google Play update ----------
     Every push to GitHub makes live/live.json + a zip of the screens (live-update workflow). When the app opens or comes
     back, it checks live.json; a newer bundle is downloaded quietly, checked (SHA-256), and switched in the next time the
     app goes to the background — so nobody loses what they're typing. A bundle that fails to start rolls back by itself. */
  const U = P.CapacitorUpdater;
  if (U) {
    U.notifyAppReady().catch(() => {});                    // this bundle started fine — keep it
    const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
      for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
    let ready = null, checking = false, lastCheck = 0;
    // Offrava's live-update public key (the private half is only in GitHub Secrets)
    const LIVE_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEaHQQvYZhh4PcpJj8nRPuoxTvMdye5jzrQhKN5m7g3uihjYxYhRPI/2f+jvNv77gW1Au03Or1iqz1gXw+UI2vpQ==';
    async function signedByOffrava(m){
      try {
        const raw = Uint8Array.from(atob(LIVE_KEY), c => c.charCodeAt(0));
        const key = await crypto.subtle.importKey('spki', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        const sig = Uint8Array.from(atob(m.sig || ''), c => c.charCodeAt(0));
        const msg = new TextEncoder().encode(`${m.version}|${m.url}|${m.checksum}|${m.min_native || ''}`);
        return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, msg);
      } catch (_) { return false; }
    }
    async function checkLive(){
      if (checking || Date.now() - lastCheck < 10 * 60e3) return;
      checking = true; lastCheck = Date.now();
      try {
        const r = await fetch(SITE + 'live/live.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const m = await r.json();
        const cur = await U.current();                      // { bundle: { version }, native: '1.0.0' }
        if (!m?.version || m.version === cur?.bundle?.version || m.version === ready?.version) return;
        // Safety: only our own folder, only newer versions, and only bundles signed with Offrava's key
        if (!/^live\/offrava-[\w-]+\.zip$/.test(m.url || '') || !/^[0-9a-f]{64}$/.test(m.checksum || '')) return;
        const curV = cur?.bundle?.version || 'builtin';
        if (curV !== 'builtin' && /^\d{12}-/.test(curV) && m.version <= curV) return;          // never go back to an older bundle
        if (!(await signedByOffrava(m))) { console.warn('live update: bad signature'); return; }
        if (m.min_native && newer(m.min_native, cur?.native || '0')) return;   // needs a newer app from the store
        const list = (await U.list().catch(() => ({ bundles: [] })))?.bundles || [];
        ready = list.find(b => b.version === m.version && b.status === 'success')
             || await U.download({ url: SITE + m.url, version: m.version, checksum: m.checksum });
        await U.next({ id: ready.id }).catch(() => {});    // used at the next start if not switched sooner
        for (const b of list) if (b.id !== ready.id && b.id !== cur?.bundle?.id && b.status !== 'downloading') U.delete({ id: b.id }).catch(() => {});
      } catch (e) { console.warn('live update', e); } finally { checking = false; }
    }
    P.App?.addListener('appStateChange', ({ isActive }) => {
      if (isActive) return checkLive();
      // switch while the app is in the background — but never during a live trip or while someone is typing
      const typing = [...document.querySelectorAll('textarea, input:not([type=hidden]):not([type=search])')].some(el => el.value && el.value.length > 3);
      if (ready && !window.OffravaTrips?.isLive?.() && !typing) { const b = ready; ready = null; U.set({ id: b.id }).catch(() => {}); }
    });
    setTimeout(checkLive, 4000);
  }
})();

/* Offrava sounds: a short, distinct sound for each kind of event, made live with Web Audio (no audio files to download).
   new sale/order · offers ready · new offer request · shipped · delivered/complete · message · payout · refund/return · review · alert · thank-you.
   Each device can turn sounds off in Settings (saved on that device). */
(function(){
  const KEY = 'ofr_sounds';
  let ctx = null;
  const enabled = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (_) { return true; } };
  const setEnabled = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (_) {} };
  function ac(){
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // Browsers only allow sound after the person has tapped something once
  const unlock = () => { ac(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

  // One soft note: frequency (Hz), start (s), length (s), waveform, volume
  function note(c, f, at, len, type = 'sine', vol = 0.18, slideTo){
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + len + 0.05);
  }
  function noise(c, at, len, vol = 0.06){
    const b = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(), t = c.currentTime + at;
    f.type = 'bandpass'; f.frequency.value = 1800; s.buffer = b; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  const SOUNDS = {
    sale:     (c) => { note(c, 1318, 0, .12, 'triangle', .2); note(c, 1760, .09, .18, 'triangle', .2); note(c, 2637, .2, .35, 'sine', .12); noise(c, .02, .12, .05); },   // cha-ching
    offers:   (c) => { note(c, 784, 0, .14); note(c, 988, .12, .14); note(c, 1175, .24, .14); note(c, 1568, .36, .3, 'sine', .14); },                                        // rising 4 notes
    request:  (c) => { note(c, 880, 0, .12, 'triangle'); note(c, 1175, .14, .22, 'triangle'); },                                                                                 // ding-ding
    shipped:  (c) => { note(c, 300, 0, .28, 'sine', .14, 900); note(c, 1046, .26, .18, 'triangle', .16); },                                                                      // whoosh + pop
    done:     (c) => { [523, 659, 784, 1046].forEach((f, i) => note(c, f, i * .09, .5 - i * .05, 'sine', .15)); },                                                              // success chord
    message:  (c) => { note(c, 1046, 0, .09, 'sine', .14); note(c, 1397, .08, .14, 'sine', .12); },                                                                              // blip
    payout:   (c) => { [2093, 2637, 3136, 2637, 3520].forEach((f, i) => note(c, f, i * .055, .14, 'triangle', .1)); },                                                          // coins
    refund:   (c) => { note(c, 880, 0, .16, 'sine', .14); note(c, 659, .14, .26, 'sine', .14); },                                                                            // gentle down
    review:   (c) => { [1568, 2093, 2637].forEach((f, i) => note(c, f, i * .07, .3, 'sine', .09)); },                                                                       // sparkle
    alert:    (c) => { note(c, 740, 0, .16, 'square', .07); note(c, 740, .22, .16, 'square', .07); },                                                                       // attention
    thanks:   (c) => { [523, 659, 784, 1046, 1318].forEach((f, i) => note(c, f, i * .08, .7, 'sine', .12)); note(c, 2093, .45, .6, 'triangle', .06); }                   // celebration
  };
  // Which sound for a notification
  function forNotification(n){
    const t = String(n.title || '').toLowerCase(), k = n.kind;
    if (k === 'order' && /new order|new sale|hired|sold/.test(t)) return 'sale';
    if (k === 'order' && /complete|released/.test(t)) return 'done';
    if (k === 'order' && /cancel|refund/.test(t)) return 'refund';
    if (k === 'offers_ready') return 'offers';
    if (k === 'request' || /new job|new request/.test(t)) return 'request';
    if (k === 'shipped') return /done|picked up/.test(t) ? 'done' : 'shipped';
    if (k === 'payout') return /refund/.test(t) ? 'refund' : 'payout';
    if (k === 'return') return /refund sent/.test(t) ? 'refund' : 'alert';
    if (k === 'message') return 'message';
    if (k === 'review') return 'review';
    if (k === 'price_drop') return 'offers';
    if (k === 'admin' || k === 'seller') return 'alert';
    return 'message';
  }
  function play(name){
    if (!enabled()) return;
    const c = ac(); const fn = SOUNDS[name]; if (!c || !fn) return;
    try { fn(c); } catch (_) {}
    if (navigator.vibrate && navigator.userActivation?.hasBeenActive && ['sale', 'offers', 'done', 'thanks'].includes(name)) { try { navigator.vibrate(name === 'sale' ? [40, 60, 40] : 30); } catch (_) {} }
  }
  window.OffravaSound = { play, forNotification, enabled, setEnabled, names: Object.keys(SOUNDS) };
})();

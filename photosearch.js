/* Offrava search by photo: a camera button in every search bar. Take or pick a photo → the AI says what it is →
   we search Offrava for it. If nobody sells one yet, one tap asks local sellers to compete for it (Get offers). */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CAM = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  async function toData(f){
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(f));
    const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8);
  }

  function sheet(html){
    let m = document.getElementById('psSheet');
    if (!m) { m = document.createElement('div'); m.id = 'psSheet'; m.className = 'ps-back'; document.body.appendChild(m);
      m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-ps-close]')) m.remove(); }); }
    m.innerHTML = `<div class="ps-card" role="dialog" aria-label="Search by photo"><button type="button" class="ps-x" data-ps-close aria-label="Close">✕</button>${html}</div>`;
    return m;
  }
  const go = (h) => { document.getElementById('psSheet')?.remove(); location.hash = h; };

  function open(){
    if (!A().user) { sheet(`<h3>${CAM} Search with a photo</h3><p class="muted">Snap a photo of anything — a tire, a part, a lamp — and we'll find it on Offrava.</p><a class="btn btn-dark full" href="#/login" data-ps-close>Sign in to use photo search</a>`); return; }
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      const prev = URL.createObjectURL(f);
      sheet(`<img class="ps-img" src="${prev}" alt=""><div class="ps-scan"></div><p class="ps-status"><span class="spin"></span> Looking at your photo…</p>`);
      try {
        const image = await toData(f);
        const { data, error } = await sb().functions.invoke('ai-listing', { body: { mode: 'search', image } });
        let err = error?.message; if (error) { try { const j = await error.context.json(); err = j.error || err; } catch(_){} }
        if (err || data?.error) throw new Error(data?.error || err);
        const r = data.found;
        if (!document.getElementById('psSheet')) return;
        if (r.not_allowed) { sheet(`<img class="ps-img" src="${prev}" alt=""><p class="form-msg err">This looks like something that can't be sold on Offrava.</p><a href="#/policies?p=prohibited" data-ps-close>See what's not allowed</a>`); return; }
        const cat = r.category && r.category !== 'Other' ? '&cat=' + encodeURIComponent(r.category) : '';
        const wide = '#/browse?q=' + encodeURIComponent(r.broad || r.query) + cat;
        // How many are for sale right now?
        let n = null;
        try { let qq = sb().from('listings').select('id', { count: 'exact', head: true }).eq('status', 'active');
          r.query.split(/\s+/).filter(w => w.length > 1).forEach(w => { qq = qq.ilike('title', `%${w}%`); });
          n = (await qq).count; } catch(_){}
        const m = sheet(`<img class="ps-img" src="${prev}" alt=""><p class="muted ps-k">Looks like</p><h3 class="ps-name">${esc(r.name)}</h3>
          ${r.category ? `<span class="pill">${esc(r.category)}</span>` : ''}
          <label class="ps-edit"><span class="sr">Search words</span><input id="psQ" value="${esc(r.query)}"></label>
          <div class="ps-actions"><button type="button" class="btn btn-dark full" id="psGo">${n ? `See ${n} for sale` : 'Search Offrava'}</button>
            ${r.broad && r.broad.toLowerCase() !== r.query.toLowerCase() ? `<button type="button" class="btn btn-ghost full" data-h="${esc(wide)}">Show all “${esc(r.broad)}”</button>` : ''}
            <button type="button" class="btn btn-accent full" data-h="#/request?item=${encodeURIComponent(r.name)}">⚡ Get offers from local sellers</button></div>
          ${n === 0 ? '<p class="muted ps-tip">No exact match yet — ask sellers to compete and you\'ll get private offers.</p>' : ''}
          <button type="button" class="link-btn" id="psAgain">Try another photo</button>`);
        m.querySelector('#psGo').onclick = () => { const v = m.querySelector('#psQ').value.trim() || r.query; go('#/browse?q=' + encodeURIComponent(v) + cat); };
        m.querySelectorAll('[data-h]').forEach(b => b.onclick = () => go(b.dataset.h));
        m.querySelector('#psAgain').onclick = open;
      } catch (e) {
        sheet(`<img class="ps-img" src="${prev}" alt=""><p class="form-msg err">${esc(e.message || 'Something went wrong.')}</p><button type="button" class="btn btn-dark full" id="psAgain">Try another photo</button>`);
        document.getElementById('psAgain').onclick = open;
      }
    };
    input.click();
  }

  // Put the camera button in every search bar (header + Search page)
  function addButtons(){
    document.querySelectorAll('form.search').forEach(f => {
      if (f.querySelector('.ps-btn') || f.id === 'fForm') return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ps-btn'; b.innerHTML = CAM;
      b.setAttribute('aria-label', 'Search with a photo'); b.title = 'Search with a photo'; b.onclick = open;
      f.appendChild(b);
    });
  }
  new MutationObserver(addButtons).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', addButtons); addButtons();

  window.OffravaPhotoSearch = { open };
})();

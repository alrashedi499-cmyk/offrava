/* Offrava profile photos: pick a photo, it's cropped to a square and shrunk on the phone (fast upload, small file),
   saved to the public "avatars" storage, and shown on My Offrava, the account page, the store page and next to listings. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Avatar: photo if there is one, otherwise the first letter
  function html(url, name, cls = ''){
    const letter = esc(String(name || '?').trim()[0]?.toUpperCase() || '?');
    return url ? `<div class="avatar has-photo ${cls}"><img src="${esc(url)}" alt="" loading="lazy"></div>` : `<div class="avatar ${cls}">${letter}</div>`;
  }

  // Square crop + resize to 512px JPEG
  function squareJpeg(file){
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.naturalWidth, img.naturalHeight), size = Math.min(512, s);
        const c = document.createElement('canvas'); c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url);
        c.toBlob((b) => b ? resolve(b) : reject(new Error('Could not read this photo.')), 'image/jpeg', 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file isn\'t a photo we can use. Try a JPG or PNG.')); };
      img.src = url;
    });
  }

  // Opens the photo picker; onDone(newUrl | null) after saving
  function pick(onDone, onError){
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      try {
        const blob = await squareJpeg(f);
        const uid = A().user.id, path = `${uid}/avatar-${Date.now()}.jpg`;
        const up = await sb().storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (up.error) throw up.error;
        const url = sb().storage.from('avatars').getPublicUrl(path).data.publicUrl;
        const old = A().profile?.avatar_url;
        const r = await sb().from('profiles').update({ avatar_url: url }).eq('id', uid);
        if (r.error) throw r.error;
        if (old) { const oldPath = old.split('/avatars/')[1]; if (oldPath) sb().storage.from('avatars').remove([oldPath]); }
        if (A().profile) A().profile.avatar_url = url;
        if (A().seller) A().seller.avatar_url = url;
        onDone && onDone(url);
      } catch (e) { onError ? onError(e.message || String(e)) : alert(e.message || e); }
    };
    input.click();
  }
  async function remove(onDone){
    const old = A().profile?.avatar_url; if (!old) return;
    await sb().from('profiles').update({ avatar_url: null }).eq('id', A().user.id);
    const oldPath = old.split('/avatars/')[1]; if (oldPath) sb().storage.from('avatars').remove([oldPath]);
    if (A().profile) A().profile.avatar_url = null;
    onDone && onDone(null);
  }

  // A tappable avatar with a camera badge (for your own profile)
  function editable(cls = ''){
    const p = A().profile || {};
    return `<button type="button" class="avatar-edit ${cls}" data-avatar-edit aria-label="Change profile photo">${html(p.avatar_url, p.full_name || A().user?.email, cls)}<span class="avatar-cam" aria-hidden="true">📷</span></button>`;
  }
  function wireEditable(root = document, after){
    root.querySelectorAll('[data-avatar-edit]').forEach(b => b.onclick = () => {
      pick((url) => { const p = A().profile || {}; b.innerHTML = html(url, p.full_name) + '<span class="avatar-cam" aria-hidden="true">📷</span>'; after && after(url); },
           (msg) => { const m = document.createElement('p'); m.className = 'form-msg err'; m.textContent = msg; b.after(m); setTimeout(() => m.remove(), 5000); });
    });
  }

  window.OffravaAvatar = { html, pick, remove, editable, wireEditable };
})();

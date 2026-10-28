/* Offrava design prototype — sample data only, no backend. */

const ICON = {
  check: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="7" cy="17" r="1.8" fill="currentColor"/><circle cx="17" cy="17" r="1.8" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/></svg>',
  img: '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>'
};

const CATS = [
  ['Electronics','<path d="M4 5h16v11H4zM9 20h6M12 16v4"/>'],
  ['Furniture','<path d="M4 11h16v6H4zM6 11V7h12v4M6 17v3M18 17v3"/>'],
  ['Auto parts','<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>'],
  ['Tools','<path d="M14 6l4 4-9 9H5v-4zM13 7l4 4"/>'],
  ['Home &amp; DIY','<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6"/>'],
  ['Kids &amp; toys','<circle cx="12" cy="9" r="4"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>']
];

const PRODUCTS = [
  { t:'Samsung 65" QLED 4K TV (Q80C)', c:'Used · Like new', loc:'Clayton, MO', p:629 },
  { t:'West Elm Harmony 3-seat sofa', c:'Used · Good', loc:'Kirkwood, MO', p:840 },
  { t:'iPhone 15 Pro 256GB, unlocked', c:'Used · Excellent', loc:'Ships nationwide', p:715 },
  { t:'DeWalt 20V drill + impact kit', c:'New', loc:'Maplewood, MO', p:179 }
];

const SAMPLE_OFFERS = [
  { seller:'Gateway Electronics', type:'Local shop', rating:4.9, sales:212, cond:'Used · Like new', price:589, ship:0, eta:'Pickup today', warranty:'90-day warranty', returns:'30-day returns', auto:false },
  { seller:'Maria K.', type:'Verified individual', rating:4.8, sales:37, cond:'Used · Like new', price:560, ship:45, eta:'Delivery in 2 days', warranty:'—', returns:'14-day returns', auto:false },
  { seller:'TechResale STL', type:'Business', rating:4.7, sales:540, cond:'Refurbished', price:615, ship:0, eta:'Pickup tomorrow', warranty:'1-year warranty', returns:'30-day returns', auto:true },
  { seller:'Daniel R.', type:'New seller · verified', rating:null, sales:0, cond:'Used · Good', price:520, ship:60, eta:'Delivery in 3 days', warranty:'—', returns:'No returns', auto:false },
  { seller:'BestBuy Outlet Partner', type:'Business', rating:4.6, sales:1290, cond:'Open box', price:649, ship:0, eta:'Ships tomorrow', warranty:'1-year warranty', returns:'30-day returns', auto:true },
  { seller:'Chris P.', type:'Verified individual', rating:4.4, sales:12, cond:'Used · Fair', price:499, ship:70, eta:'Delivery in 4 days', warranty:'—', returns:'No returns', auto:false },
  { seller:'Arch City Deals', type:'Local shop', rating:4.5, sales:88, cond:'Used · Good', price:575, ship:0, eta:'Pickup today', warranty:'30-day warranty', returns:'14-day returns', auto:false }
];

const state = { req: null, timer: null, step: 1 };

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (n) => '$' + n.toLocaleString('en-US');
function go(h){ location.hash = h; }

/* ---------- Scoring: 45% price, 20% condition, 15% seller, 10% speed, 10% warranty/returns ---------- */
function score(o, all){
  const totals = all.map(x => x.price + x.ship);
  const min = Math.min(...totals), max = Math.max(...totals);
  const priceS = max === min ? 1 : 1 - ((o.price + o.ship) - min) / (max - min);
  const condS = { 'New':1, 'Open box':.95, 'Used · Like new':.9, 'Refurbished':.85, 'Used · Excellent':.85, 'Used · Good':.65, 'Used · Fair':.4 }[o.cond] ?? .6;
  const sellerS = o.rating == null ? .8 : (o.rating - 3.5) / 1.5;          // new sellers start at a fair prior
  const speedS = /today/i.test(o.eta) ? 1 : /tomorrow/i.test(o.eta) ? .8 : /2 days/.test(o.eta) ? .6 : .35;
  const protS = (o.warranty !== '—' ? .5 : 0) + (/30-day/.test(o.returns) ? .5 : /14-day/.test(o.returns) ? .3 : 0);
  return Math.round(100 * (.45*priceS + .20*condS + .15*sellerS + .10*speedS + .10*protS));
}

/* ---------- Views ---------- */
function viewHome(){
  return `
  <section class="hero"><div class="wrap hero-grid">
    <div>
      <span class="eyebrow"><span class="dot"></span>Now piloting in St. Louis</span>
      <h1>Stop searching.<br>Let sellers <em>compete</em> for you.</h1>
      <p class="lead">Tell us what you want. Sellers who already have it send you their best private offer. Compare the top five and pick the one you like — or just buy now like anywhere else.</p>
      <div class="hero-cta">
        <a href="#/request" class="btn btn-accent btn-lg">Get competing offers</a>
        <a href="#/browse" class="btn btn-ghost btn-lg">Browse and buy now</a>
      </div>
      <div class="hero-points">
        <span>${ICON.check} No paid ads, ever</span>
        <span>${ICON.check} Payment held until delivery</span>
        <span>${ICON.check} Verified sellers</span>
      </div>
    </div>
    <div class="race" aria-label="Example of sellers competing for one request">
      <div class="race-head"><span class="race-title">Live request</span><span class="timer" id="heroTimer">03:42:10 left</span></div>
      <div class="req-chip"><b>Samsung 65" QLED TV</b>Used · like new · Pickup or delivery to 63105</div>
      <div id="heroOffers"></div>
    </div>
  </div></section>

  <section id="how"><div class="wrap">
    <div class="sec-head"><h2>One request.<br>Every seller who has it.</h2><a href="#/request" class="btn btn-dark">Try it now</a></div>
    <div class="steps">
      ${[
        ['Ask once','Describe the item, or snap a photo. AI fills in the model and specs.'],
        ['Sellers are notified','Only sellers with a matching item already listed get your request.'],
        ['Sealed offers','Sellers can\'t see each other\'s prices, so you get their real best price.'],
        ['You choose','See the top five ranked by total price and service. Pay safely in-app.']
      ].map((s,i)=>`<div class="step"><div class="n">${i+1}</div><h3>${s[0]}</h3><p>${s[1]}</p></div>`).join('')}
    </div>
  </div></section>

  <section><div class="wrap">
    <div class="sec-head"><h2>Shop every category</h2><a href="#/browse" class="nav-link">View all →</a></div>
    <div class="cats">
      ${CATS.map(c=>`<a href="#/browse" class="cat"><svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round">${c[1]}</svg>${c[0]}</a>`).join('')}
    </div>
  </div></section>

  <section><div class="wrap">
    <div class="sec-head"><h2>Buy now, near you</h2><span class="muted">Sample listings</span></div>
    ${productGrid()}
  </div></section>

  <section><div class="wrap split">
    <div class="panel">
      <span class="tag">For buyers</span>
      <h3>The best price comes to you.</h3>
      <p class="muted">No more opening forty tabs. One request, real offers, a clear comparison.</p>
      <ul>
        <li>${ICON.check} Total price shown up front, shipping and tax included</li>
        <li>${ICON.check} Money held until you confirm delivery</li>
        <li>${ICON.check} Damaged or not as described? You're covered</li>
      </ul>
      <a href="#/request" class="btn btn-dark">Get offers</a>
    </div>
    <div class="panel dark">
      <span class="tag">For sellers</span>
      <h3>Win on price and service, not ad spend.</h3>
      <p class="muted">Free to list. Free to send offers. You only pay a commission when you sell.</p>
      <ul>
        <li>${ICON.check} Buyers who want your item come straight to you</li>
        <li>${ICON.check} Auto-offers answer requests while you're busy</li>
        <li>${ICON.check} Founding sellers: 0% commission for 90 days</li>
      </ul>
      <a href="#/sell" class="btn btn-accent">Start selling</a>
    </div>
  </div></section>`;
}

function productGrid(){
  return `<div class="products">${PRODUCTS.map(p=>`
    <article class="product">
      <div class="thumb">${ICON.img}</div>
      <div class="body">
        <span class="tag">${esc(p.c)}</span>
        <div class="t">${esc(p.t)}</div>
        <div class="meta">${ICON.pin} ${esc(p.loc)}</div>
        <div class="price">${money(p.p)}</div>
      </div>
      <div class="actions">
        <button class="btn btn-dark" type="button">Buy now</button>
        <a class="btn btn-ghost" href="#/request?item=${encodeURIComponent(p.t)}">Get offers</a>
      </div>
    </article>`).join('')}</div>`;
}

function viewBrowse(){
  return `<div class="wrap"><div class="page-head"><div class="crumb">Home / Browse</div><h1>Browse</h1><p class="muted">Buy instantly, or ask sellers to compete on any item.</p></div>
  <section style="padding-top:12px">${productGrid()}</section></div>`;
}

function viewRequest(){
  const pre = decodeURIComponent((location.hash.split('item=')[1] || ''));
  return `<div class="wrap">
  <div class="page-head"><div class="crumb">Home / Get offers</div><h1>What are you looking for?</h1><p class="muted">Sellers who already have it will send you private offers.</p></div>
  <div class="flow">
    <form class="card" id="reqForm">
      <div class="stepper" aria-hidden="true"><span class="on"></span><span class="on"></span><span></span></div>
      <div class="field">
        <label for="item">Item</label>
        <input id="item" required value="${esc(pre || 'Samsung 65" QLED 4K TV')}" placeholder="e.g. Samsung 65&quot; QLED TV, model Q80C">
      </div>
      <div class="field">
        <label>Condition</label>
        <div class="choices">
          ${['Any','New','Like new','Good or better'].map((c,i)=>`<label class="choice"><input type="radio" name="cond" value="${c}" ${i===2?'checked':''}><span>${c}</span></label>`).join('')}
        </div>
      </div>
      <div class="row2">
        <div class="field"><label for="zip">Delivery ZIP</label><input id="zip" inputmode="numeric" value="63105"></div>
        <div class="field"><label for="max">Max budget (optional)</label><input id="max" inputmode="numeric" placeholder="$"></div>
      </div>
      <div class="field">
        <label>How do you want it?</label>
        <div class="choices">
          ${['Pickup or delivery','Pickup only','Shipping only'].map((c,i)=>`<label class="choice"><input type="radio" name="get" value="${c}" ${i===0?'checked':''}><span>${c}</span></label>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Collect offers for</label>
        <div class="choices">
          ${['1 hour','4 hours','24 hours'].map((c,i)=>`<label class="choice"><input type="radio" name="win" value="${c}" ${i===1?'checked':''}><span>${c}</span></label>`).join('')}
        </div>
      </div>
      <div class="form-foot">
        <span class="muted" style="font-size:14px">A refundable $2 hold keeps requests real. It's applied to your purchase.</span>
        <button class="btn btn-accent btn-lg" type="submit">Send to sellers</button>
      </div>
    </form>
    <aside class="card summary">
      <h3>How your request works</h3>
      <div class="sum-line"><span>Sellers notified</span><b>Top 10 matches</b></div>
      <div class="sum-line"><span>Offers</span><b>Sealed until time's up</b></div>
      <div class="sum-line"><span>Each seller</span><b>1 offer + 1 improvement</b></div>
      <div class="sum-line"><span>You see</span><b>Best 5 first</b></div>
      <div class="note">Ranking: 45% total price · 20% condition · 15% seller record · 10% speed · 10% warranty &amp; returns. Nobody can pay to rank higher.</div>
    </aside>
  </div></div>`;
}

function viewOffers(){
  const r = state.req || { item:'Samsung 65" QLED 4K TV', cond:'Like new', zip:'63105', win:'4 hours' };
  return `<div class="wrap">
  <div class="page-head"><div class="crumb">My requests / Request #1042</div><h1>${esc(r.item)}</h1>
    <p class="muted">${esc(r.cond)} · ZIP ${esc(r.zip)} · offers sealed for ${esc(r.win)}</p></div>
  <section style="padding-top:12px">
    <div class="offers-top">
      <div class="countdown" role="status" aria-live="polite">
        <div><div class="big" id="cd">00:00:08</div><div style="font-size:13px;opacity:.75" id="cdLabel">until offers open (demo: 8 sec)</div></div>
        <div class="progress"><i id="bar" style="width:0%"></i></div>
      </div>
      <div class="choices" id="sortBox">
        <label class="choice"><input type="radio" name="sort" value="best" checked><span>Best overall</span></label>
        <label class="choice"><input type="radio" name="sort" value="price"><span>Lowest total</span></label>
        <label class="choice"><input type="radio" name="sort" value="fast"><span>Fastest</span></label>
      </div>
    </div>
    <div id="offersArea"><div class="card empty"><b id="sentTo">Sent to 10 matching sellers.</b><br>Offers stay sealed until the timer ends — so every seller sends their real best price.</div></div>
  </section></div>`;
}

function renderOffers(sort='best', showAll=false){
  let list = SAMPLE_OFFERS.map(o => ({...o, s: score(o, SAMPLE_OFFERS)}));
  if (sort==='best') list.sort((a,b)=>b.s-a.s);
  if (sort==='price') list.sort((a,b)=>(a.price+a.ship)-(b.price+b.ship));
  if (sort==='fast') list.sort((a,b)=>score({...b,price:0,ship:0},SAMPLE_OFFERS)-score({...a,price:0,ship:0},SAMPLE_OFFERS));
  const best = list[0], cheapest = [...list].sort((a,b)=>(a.price+a.ship)-(b.price+b.ship))[0];
  const shown = showAll ? list : list.slice(0,5);
  $('#offersArea').innerHTML = `
    <div class="ai-sum"><span class="badge">Summary</span><div>
      <b>${SAMPLE_OFFERS.length} offers came in.</b> ${esc(best.seller)} ranks first: ${money(best.price+best.ship)} total, ${esc(best.eta.toLowerCase())}, ${esc(best.warranty.toLowerCase())}.
      ${cheapest.seller!==best.seller ? `The cheapest is ${esc(cheapest.seller)} at ${money(cheapest.price+cheapest.ship)}, but it's ${esc(cheapest.cond.toLowerCase())} with ${esc(cheapest.returns.toLowerCase())}.` : ''}
    </div></div>
    <div class="offer-list">
      ${shown.map((o,i)=>`
      <article class="offer ${i===0?'top':''}" style="animation-delay:${i*80}ms">
        <div class="rank">${i+1}</div>
        <div>
          <h3>${esc(o.seller)} <span class="tag">${esc(o.type)}</span></h3>
          <div class="facts">
            <span>${ICON.star} ${o.rating ? o.rating+' · '+o.sales+' sales' : 'New seller'}</span>
            <span>${esc(o.cond)}</span>
            <span>${ICON.truck} ${esc(o.eta)}</span>
            <span>${ICON.shield} ${esc(o.warranty === '—' ? o.returns : o.warranty+' · '+o.returns)}</span>
          </div>
        </div>
        <div class="total">
          <div class="price">${money(o.price+o.ship)}</div>
          <small>${o.ship? money(o.price)+' + '+money(o.ship)+' delivery':'No delivery fee'} · tax at checkout</small>
          <div class="score">Match score ${o.s}/100</div>
        </div>
        <button class="btn ${i===0?'btn-accent':'btn-ghost'}" type="button" onclick="this.textContent='Accepted ✓'; this.disabled=true">Accept offer</button>
      </article>`).join('')}
    </div>
    ${!showAll && list.length>5 ? `<div style="text-align:center;margin-top:16px"><button class="btn btn-ghost" type="button" id="showAll">See all ${list.length} offers</button></div>`:''}`;
  const sa = $('#showAll'); if (sa) sa.onclick = () => renderOffers(sort, true);
}

function viewSell(){
  return `<div class="wrap">
  <div class="page-head"><div class="crumb">Seller dashboard</div><h1>Good afternoon, Gateway Electronics</h1><p class="muted">Founding seller · 0% commission until Jan 26, 2027</p></div>
  <section style="padding-top:12px">
    <div class="seller-grid">
      <div class="stat"><div class="muted">New requests matching your items</div><div class="big">3</div></div>
      <div class="stat"><div class="muted">Offers won this week</div><div class="big">[ — ]</div></div>
      <div class="stat"><div class="muted">Auto-offers active</div><div class="big">12 listings</div></div>
    </div>
    <h2 style="font-size:26px;margin:28px 0 14px">Requests for you</h2>
    ${[
      ['Samsung 65" QLED 4K TV','Like new · ZIP 63105 · 3h 41m left','Your listing: Samsung Q80C 65" — $629', true],
      ['PlayStation 5 Slim','Good or better · ZIP 63130 · 52m left','Your listing: PS5 Slim Disc — $389', false],
      ['Sonos Arc soundbar','Any condition · Ships · 21h left','Your listing: Sonos Arc (Black) — $540', false]
    ].map(a=>`
      <div class="alert ${a[3]?'new':''}">
        <div>
          <div style="font-weight:600;font-size:17px">${a[3]?'<span class="pulse" aria-hidden="true"></span>':''}${esc(a[0])}</div>
          <div class="muted" style="font-size:14px">${esc(a[1])}</div>
          <div style="font-size:14px;margin-top:4px">${esc(a[2])}</div>
        </div>
        <div class="inline-form">
          <label class="sr" for="o${a[0].length}">Your offer</label>
          <input id="o${a[0].length}" inputmode="numeric" placeholder="Your price">
          <button class="btn btn-dark" type="button" onclick="this.textContent='Offer sent ✓'">Send offer</button>
        </div>
      </div>`).join('')}
    <div class="card" style="margin-top:20px">
      <h3 style="margin:0 0 6px">Auto-offers</h3>
      <p class="muted" style="margin:0 0 16px">Set your lowest price once. We answer matching requests for you — the buyer never sees your floor.</p>
      <label class="toggle"><input type="checkbox" checked> Auto-offer on all listings, never below 88% of list price</label>
    </div>
  </section></div>`;
}

function viewRequests(){
  return `<div class="wrap"><div class="page-head"><div class="crumb">Home / My requests</div><h1>My requests</h1></div>
  <section style="padding-top:12px"><div class="alert new"><div><div style="font-weight:600">Samsung 65" QLED 4K TV</div><div class="muted" style="font-size:14px">7 offers · best ${money(589)}</div></div><a class="btn btn-dark" href="#/offers">View offers</a></div></section></div>`;
}

/* ---------- Router ---------- */
function route(){
  clearInterval(state.timer);
  const h = location.hash.split('?')[0] || '#/';
  const views = { '#/':viewHome, '#/browse':viewBrowse, '#/request':viewRequest, '#/offers':viewOffers, '#/sell':viewSell, '#/requests':viewRequests, '#/how':viewHome };
  $('#app').innerHTML = (views[h] || viewHome)();
  window.scrollTo(0, h==='#/how' ? (document.getElementById('how')?.offsetTop||0)-80 : 0);

  if (h==='#/' || h==='#/how') heroRace();
  if (h==='#/request') {
    $('#reqForm').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      state.req = { item: f.item.value, cond: f.cond.value, zip: f.zip.value, win: f.win.value };
      go('#/offers');
    };
  }
  if (h==='#/offers') countdown();
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === h));
}

/* ---------- Installable app ---------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installEvt = e;
  const b = $('#installBtn'); b.hidden = false;
  b.onclick = async () => { b.hidden = true; installEvt.prompt(); installEvt = null; };
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

function heroRace(){
  const area = $('#heroOffers'); if (!area) return;
  const seq = [['Arch City Deals','Pickup today',575],['Maria K.','2-day delivery',605],['Gateway Electronics','Pickup today · 90-day warranty',589]];
  let i = 0;
  state.timer = setInterval(() => {
    if (!document.body.contains(area)) return clearInterval(state.timer);
    if (i >= seq.length) { i = 0; area.innerHTML = ''; return; }
    const [w,d,p] = seq[i++];
    const row = document.createElement('div');
    row.className = 'offer-row' + (i===3 ? ' best' : '');
    row.innerHTML = `<div class="who">${w}<small>${d}</small></div><div class="price">${money(p)}</div>`;
    area.appendChild(row);
  }, 1400);
}

function countdown(){
  let left = 8, total = 8;
  const tick = () => {
    const cd = $('#cd'), bar = $('#bar'); if (!cd) return clearInterval(state.timer);
    cd.textContent = '00:00:0' + left;
    bar.style.width = ((total-left)/total*100) + '%';
    if (left === 0) {
      clearInterval(state.timer);
      cd.textContent = 'Offers are in';
      $('#cdLabel').textContent = '7 sellers responded';
      renderOffers('best');
      document.querySelectorAll('#sortBox input').forEach(r => r.onchange = () => renderOffers(r.value));
    }
    left--;
  };
  tick(); state.timer = setInterval(tick, 1000);
}

window.addEventListener('hashchange', route);
route();

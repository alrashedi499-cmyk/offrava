/* Offrava Policy Center (#/policies): every rule for buyers, sellers, pros and makers in one place, like eBay's policy pages.
   Numbers (fees, deadlines) are read live from Admin › Fees & settings, so the policies always match what the app does.
   Plain-English drafts — have them reviewed by a lawyer before launching with real money. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const param = (k) => new URLSearchParams(location.hash.split('?')[1] || '').get(k);
  const UPDATED = 'October 29, 2026';

  let S = null;
  async function settings(){
    if (S) return S;
    const { data } = sb() ? await sb().from('platform_settings').select('*').eq('id', 1).maybeSingle() : { data: null };
    S = Object.assign({ commission_bps: 800, business_bps: 600, service_bps: 800, maker_bps: 1000, maker_new_bps: 500, maker_new_days: 90, min_fee_cents: 50,
      buyer_fee_fixed_cents: 99, buyer_fee_bps: 250, digital_buyer_fee_cents: 50, founding_days: 90, founding_cap_cents: 100000, buyer_cancel_minutes: 60,
      auto_complete_pickup_days: 3, auto_complete_ship_days: 7, seller_reply_days: 3, damaged_return_days: 30, ship_cancel_days: 4, pickup_cancel_days: 7,
      digital_hold_days: 7, digital_refund_days: 14, max_open_requests: 5, pro_monthly_cents: 999, pro_per_sale_bps: 100, support_email: 'support@offrava.com' }, data || {});
    return S;
  }
  const pct = (b) => (b / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });

  // ---------- The policies ----------
  const GROUPS = [
    ['buyers', 'For buyers', '🛍️'], ['sellers', 'For sellers', '🏪'], ['pros', 'Service pros & makers', '🛠️'], ['everyone', 'For everyone', '🤝']
  ];
  const P = (s) => [
    // ===== Buyers =====
    { id: 'buyer-protection', g: 'buyers', t: 'Offrava Buyer Protection', d: 'Get what you ordered, or your money back.', body: `
      <p>Every purchase paid inside Offrava is protected. We hold your payment and only release it to the seller after you have the item (or the job is done) and nothing is wrong.</p>
      <h3>You're covered when</h3>
      <ul><li>The item <b>never arrived</b>, or a pickup seller marked it "picked up" without your pickup code.</li>
        <li>It arrived <b>damaged</b>, broken, or doesn't work.</li>
        <li>It's <b>not as described</b>: wrong item, wrong size or model, missing parts, worse condition than listed, or counterfeit.</li>
        <li>The seller <b>didn't ship</b> within ${s.ship_cancel_days} days or the pickup didn't happen within ${s.pickup_cancel_days} days — the order is cancelled and refunded automatically.</li>
        <li>A service pro didn't do the job as agreed, or a digital product doesn't work and the maker can't fix it.</li></ul>
      <h3>Not covered</h3>
      <ul><li>Payments made <b>outside Offrava</b> (cash, Zelle, Venmo, Cash App, gift cards…). We can't see or protect them.</li>
        <li>Changing your mind, unless the seller offers 14- or 30-day returns.</li>
        <li>Damage caused after delivery, or claims opened after the ${s.damaged_return_days}-day window.</li>
        <li>Items you confirmed with "I got it" or your pickup code and then report as not received.</li></ul>
      <h3>How to get your money back</h3>
      <ol><li>Open the order and tap <b>Open a return</b> or <b>Report a problem</b>.</li><li>The seller has ${s.seller_reply_days} days to respond. If they don't, Offrava steps in automatically.</li>
        <li>Refunds go back to your original payment method, usually within 5–10 business days. You get the <b>full price, delivery and Offrava Protection fee</b> back when the seller is at fault.</li></ol>` },
    { id: 'returns', g: 'buyers', t: 'Returns & refunds', d: 'Who pays, how long it takes, and what happens if someone goes quiet.', body: `
      <table class="pol-table"><thead><tr><th>Reason</th><th>Window</th><th>Return shipping</th><th>Refund</th></tr></thead><tbody>
        <tr><td>Didn't arrive</td><td>30 days after shipping</td><td>—</td><td>Full</td></tr>
        <tr><td>Damaged / doesn't work</td><td>${s.damaged_return_days} days</td><td>Seller pays</td><td>Full</td></tr>
        <tr><td>Not as described</td><td>${s.damaged_return_days} days</td><td>Seller pays</td><td>Full</td></tr>
        <tr><td>Changed my mind</td><td>Seller's policy (14 or 30 days)</td><td>Buyer pays</td><td>Item price</td></tr></tbody></table>
      <ul><li>The seller has <b>${s.seller_reply_days} days</b> to approve, refund, or ask Offrava to decide. If they say nothing, items that never arrived are refunded automatically and other cases go to Offrava.</li>
        <li>After a return is approved, send the item back within <b>14 days</b> with tracking. If you don't, the return closes and the seller is paid.</li>
        <li>Once you've sent it back, the seller has <b>10 days</b> to confirm they got it, or Offrava steps in.</li>
        <li>Sellers may not charge restocking fees. Items must come back in the condition you received them.</li>
        <li>Pickup items: agree on a drop-off in the chat. Service jobs and digital products are never sent back — they're refunded or fixed.</li></ul>` },
    { id: 'cancellations', g: 'buyers', t: 'Cancellations', d: 'When you, the seller, or Offrava can cancel.', body: `
      <ul><li><b>Buyer:</b> cancel for free within <b>${s.buyer_cancel_minutes} minutes</b> of paying, as long as the item hasn't been sent. After that, ask the seller in the chat.</li>
        <li><b>Seller:</b> can cancel any time before sending, with a full refund to the buyer. Frequent seller cancellations hurt the seller's standing.</li>
        <li><b>Automatic:</b> orders not shipped within <b>${s.ship_cancel_days} days</b> or not picked up within <b>${s.pickup_cancel_days} days</b> are cancelled and refunded.</li>
        <li><b>Service bookings:</b> the customer can cancel any time before the job is marked done, for a full refund. Please give the pro as much notice as you can.</li>
        <li><b>Offer requests:</b> you can cancel an open request any time; sealed offers are withdrawn.</li>
        <li><b>Unpaid orders:</b> orders started but not paid are cancelled automatically.</li></ul>` },
    { id: 'payments', g: 'buyers', t: 'Payments & fees for buyers', d: 'How paying works and what it costs.', body: `
      <ul><li>Pay only inside Offrava with a card, Apple Pay or Google Pay. Payments are processed by Stripe; Offrava never sees your card number.</li>
        <li><b>Offrava Protection fee:</b> ${usd(s.buyer_fee_fixed_cents)} + ${pct(s.buyer_fee_bps)} of the item and delivery price (${usd(s.digital_buyer_fee_cents)} on games & software). It's always shown before you pay and is the same for every seller and offer, so it never changes rankings.</li>
        <li><b>Sales tax:</b> where the law requires it, Offrava collects sales tax as the marketplace and pays it to the state. It's worked out from where you receive the item (your shipping address, or the pickup location) and shown before you pay. Sellers never add their own tax.</li>
        <li>Your payment is held until delivery. The seller gets paid when you confirm, or automatically ${s.auto_complete_ship_days} days after shipping / ${s.auto_complete_pickup_days} days after pickup if you report no problem.</li>
        <li><b>Card disputes (chargebacks):</b> please open a return first — it's faster and keeps your protection. Filing a chargeback while a return is open may close the return, and false chargebacks can lead to account limits.</li></ul>` },
    { id: 'pickup-safety', g: 'buyers', t: 'Local pickup safety', d: 'Meet safely and pay safely.', body: `
      <ul><li>Meet in a busy public place in daylight. The order page suggests nearby police "safe exchange zones".</li>
        <li><b>Check the item before you hand over anything.</b> Your 6-digit pickup code is what pays the seller — share it only when you're happy.</li>
        <li>Never pay cash or send money outside the app, even if the seller asks. Report anyone who asks.</li>
        <li>Bring someone with you for large items, and don't invite strangers into your home for small ones.</li>
        <li>If the seller doesn't show up, don't share the code — use <b>Report a problem</b> on the order.</li></ul>` },
    { id: 'buyer-conduct', g: 'buyers', t: 'Buyer responsibilities', d: 'What we expect from buyers.', body: `
      <ul><li>Pay for what you commit to: an accepted "Make an offer" must be paid within 48 hours.</li>
        <li>Use returns honestly. Repeated false "not received" or "not as described" claims lead to limits or suspension.</li>
        <li>Don't ask sellers to trade outside Offrava or to change prices after you've paid.</li>
        <li>Leave honest reviews about the transaction. Threatening a bad review to get money or extras isn't allowed.</li></ul>` },

    // ===== Sellers =====
    { id: 'seller-standards', g: 'sellers', t: 'Seller performance standards', d: 'What great selling looks like on Offrava.', body: `
      <p>We look at every seller's record so buyers can trust the marketplace. You're expected to:</p>
      <ul><li><b>Ship on time:</b> within 3 days with tracking, or arrange pickup within ${s.pickup_cancel_days} days.</li>
        <li><b>Rarely cancel:</b> cancel only when you truly can't fill an order.</li>
        <li><b>Answer quickly:</b> reply to messages within 1 business day and to returns within ${s.seller_reply_days} days.</li>
        <li><b>Describe items accurately</b> so returns for "not as described" stay rare.</li>
        <li><b>Keep a good rating</b> — buyers see your stars, sales and reviews on every listing and your store.</li></ul>
      <p>When standards slip, Offrava may warn you, hold payouts while we look into problems, pause listings, or suspend the account. Founding and new sellers get help first.</p>` },
    { id: 'listing-rules', g: 'sellers', t: 'Listing rules', d: 'How to list items the right way.', body: `
      <ul><li>Only list items you have in hand and are ready to sell. One item type per listing; use quantity for identical items.</li>
        <li>Use your own real photos. Stock photos are allowed only for new, sealed items, together with at least one real photo.</li>
        <li>Pick the honest condition:</li></ul>
      <table class="pol-table"><tbody><tr><td><b>New</b></td><td>Unused, unopened, original packaging</td></tr><tr><td><b>Open box</b></td><td>Unused, packaging opened</td></tr>
        <tr><td><b>Like new</b></td><td>Used briefly, no visible wear</td></tr><tr><td><b>Excellent</b></td><td>Light signs of use, works perfectly</td></tr>
        <tr><td><b>Good</b></td><td>Visible wear, works perfectly</td></tr><tr><td><b>Fair</b></td><td>Heavy wear or minor issues — describe them</td></tr>
        <tr><td><b>Refurbished</b></td><td>Restored to working order by a seller or manufacturer</td></tr></tbody></table>
      <ul><li><b>Tires:</b> state the exact size and DOT date. Used tires need at least 4/32" of tread and no sidewall repairs.</li>
        <li><b>Car parts:</b> list the exact fitment (year, make, model) and any part numbers.</li>
        <li>No phone numbers, emails, links or "contact me" text in listings or photos. No misleading keywords or brand names you aren't selling.</li>
        <li>The price you list is the price you must honor.</li></ul>` },
    { id: 'prohibited', g: 'sellers', t: 'Prohibited & restricted items', d: 'What can never be sold, and what needs extra care.', body: `
      <h3>Never allowed</h3>
      <ul><li>Firearms, ammunition, parts that make guns, explosives, fireworks, and weapons such as switchblades or brass knuckles.</li>
        <li>Drugs, drug paraphernalia, marijuana and THC products, prescription medicine and medical devices that need a prescription.</li>
        <li>Alcohol, tobacco, vapes and e-cigarettes.</li><li>Live animals, and products from endangered species.</li>
        <li>Counterfeits, replicas, stolen goods, and items you don't have the right to sell.</li><li>Recalled products, and car seats or helmets that were in a crash.</li>
        <li>Hazardous materials: gasoline, propane tanks (filled), pesticides, used car batteries by mail.</li>
        <li>Adult content and services, human remains, personal documents and IDs.</li>
        <li>Gift cards, prepaid cards, cash equivalents, cryptocurrency, accounts and logins.</li>
        <li>Anything illegal in Missouri or under US law.</li></ul>
      <h3>Allowed with care</h3>
      <ul><li><b>Used tires:</b> must meet the tread rule above. <b>Airbags:</b> not allowed.</li><li><b>Catalytic converters:</b> shops only, with proof of the vehicle they came from.</li>
        <li><b>Car keys and fobs:</b> new and unprogrammed only.</li><li><b>Knives:</b> kitchen and tools only, buyers 18+.</li></ul>
      <p>Listings that break these rules are removed. Repeat or serious violations lead to suspension.</p>` },
    { id: 'fees', g: 'sellers', t: 'Fees', d: 'Exactly what Offrava charges — nothing to list.', body: `
      <table class="pol-table"><thead><tr><th>Who</th><th>Fee when you sell</th></tr></thead><tbody>
        <tr><td>People selling their things</td><td><b>${pct(s.commission_bps)}</b> of the item price</td></tr>
        <tr><td>Shops, and any sale won through competing offers</td><td><b>${pct(s.business_bps)}</b></td></tr>
        <tr><td>Service pros</td><td><b>${pct(s.service_bps)}</b> of the job price</td></tr>
        <tr><td>Makers (games & software)</td><td><b>${pct(s.maker_new_bps)}</b> for the first ${s.maker_new_days} days, then <b>${pct(s.maker_bps)}</b>. No minimum fee.</td></tr>
        <tr><td>Founding sellers</td><td><b>0%</b> for ${s.founding_days} days on your first ${usd(s.founding_cap_cents)} of sales</td></tr>
        <tr><td>Offrava Pro (photo studio)</td><td>${usd(s.pro_monthly_cents)}/month, or +${pct(s.pro_per_sale_bps)} per sale</td></tr></tbody></table>
      <ul><li>The smallest fee on a physical sale is ${usd(s.min_fee_cents)}. Fees are charged only on completed sales and returned to you if the sale is fully refunded.</li>
        <li>No listing fees, no fees to receive offers, no paid placement. Ads are optional, labeled, and never change rankings.</li>
        <li>We'll tell you at least 30 days before any fee goes up.</li></ul>` },
    { id: 'payouts', g: 'sellers', t: 'Getting paid', d: 'When money reaches your bank, and when it can be held.', body: `
      <ul><li>Payouts are sent through Stripe to your bank after the buyer confirms, after your pickup/completion code is entered, or automatically ${s.auto_complete_ship_days} days after shipping (${s.auto_complete_pickup_days} after pickup, ${s.digital_hold_days} for digital) if no problem is reported.</li>
        <li>Stripe then usually takes 2 business days to reach your bank.</li>
        <li>Payouts wait while a return or problem report is open, and may be held while Offrava reviews a report or unusual activity.</li>
        <li>If an order is refunded after you were paid, that payout is taken back from your Stripe balance.</li>
        <li><b>Sales tax:</b> Offrava is the marketplace facilitator — we collect and pay sales tax on your Offrava sales, so you don't have to. Tax is never taken from your payout. Don't add tax to your prices.</li>
        <li>Identity checks and bank details are handled by Stripe. Stripe may send you a Form 1099-K when US tax law requires it; you're responsible for your own taxes.</li></ul>` },
    { id: 'shipping', g: 'sellers', t: 'Shipping & handling', d: 'Handling time, tracking, and lost packages.', body: `
      <ul><li>Ship within <b>3 days</b> of payment and add the carrier and tracking number. Orders not shipped within ${s.ship_cancel_days} days are cancelled and refunded.</li>
        <li>Use a service with tracking. Pack items so they arrive safely — the seller is responsible until delivery.</li>
        <li>For items over $750 we strongly recommend signature confirmation.</li>
        <li>Ship to the address shown on the order only. Never change it because a buyer asks in chat.</li>
        <li>Charge the delivery price you listed; don't add fees after the sale.</li></ul>` },
    { id: 'competing-offers', g: 'sellers', t: 'Competing offers rules', d: 'Sealed offers, fair play.', body: `
      <ul><li>Offers are <b>sealed</b>: no one sees anyone else's price. You may lower your price <b>once</b>.</li>
        <li>An offer is binding: if the buyer picks it, you must sell at that price and match the delivery choice the buyer asked for.</li>
        <li>Only offer items you have in stock and that fit the request exactly (size, model, fitment).</li>
        <li>Auto-offers you set up count as your offers — keep your stock and floor price up to date.</li>
        <li>Rankings use total price, condition, seller record, speed and return policy. Nobody can pay to rank higher.</li>
        <li>Fake or bait offers (prices you won't honor) are removed and can lead to suspension.</li></ul>` },

    // ===== Pros & makers =====
    { id: 'services', g: 'pros', t: 'Service pros policy', d: 'Rules for pros who quote on jobs.', body: `
      <ul><li>Pros are independent businesses, not Offrava employees. You must follow local laws and carry the licenses your trade needs.</li>
        <li><b>Licensed trades</b> (plumbing, electrical, heating & cooling) must add a valid license number, which Offrava checks before you can quote.</li>
        <li>Quotes are sealed and should cover the whole job. If the job turns out bigger than described, agree on the change in the chat <b>before</b> doing extra work.</li>
        <li>You're paid when the customer gives you their completion code, or ${s.auto_complete_pickup_days} days after you mark the job done if they report no problem.</li>
        <li>Do the work yourself or with your own team. No taking payment outside Offrava for jobs found here.</li>
        <li>No lead fees — you pay ${pct(s.service_bps)} only when you're hired and paid.</li></ul>` },
    { id: 'makers', g: 'pros', t: 'Games & software (Makers) policy', d: 'Rules for selling digital products.', body: `
      <ul><li>Sell only games, software, assets and subscriptions you made or fully own the rights to.</li>
        <li><b>Not allowed:</b> reselling other people's games, keys or accounts; in-game currency for games you don't run; malware; cracked or pirated software; adult content.</li>
        <li>Every product is reviewed before it goes live, and again after big changes.</li>
        <li>Deliver what you describe. License keys must work and never be reused.</li>
        <li>Buyers can get a refund within ${s.digital_refund_days} days if they never opened the product, or any time it doesn't work and you can't fix it. Your payout is released ${s.digital_hold_days} days after each sale.</li></ul>` },

    // ===== Everyone =====
    { id: 'community', g: 'everyone', t: 'Community guidelines', d: 'Be honest, be respectful.', body: `
      <ul><li>Treat everyone with respect. No harassment, threats, hate speech, or discrimination based on race, religion, national origin, sex, gender identity, sexual orientation, age or disability.</li>
        <li>No spam, scams, fake accounts, or pretending to be someone else. One account per person or business.</li>
        <li>Keep messages about the transaction.</li></ul>` },
    { id: 'off-platform', g: 'everyone', t: 'Staying on Offrava', d: 'Why deals and payments stay in the app.', body: `
      <ul><li>Don't ask for or share phone numbers, emails or social handles to finish a deal elsewhere — the app hides them automatically.</li>
        <li>Don't offer or accept payment outside Offrava for anything found here.</li>
        <li>Deals done outside the app aren't protected, and avoiding fees this way can lead to suspension.</li></ul>` },
    { id: 'ip', g: 'everyone', t: 'Counterfeits & intellectual property', d: 'Protecting brands and creators.', body: `
      <ul><li>Counterfeits and unauthorized copies are never allowed.</li><li>Use brand names only to describe the genuine item you're selling.</li>
        <li>Rights owners can report listings to <a href="mailto:${esc(s.support_email)}">${esc(s.support_email)}</a> with proof of ownership. We remove infringing listings quickly and act on repeat infringers.</li></ul>` },
    { id: 'reviews', g: 'everyone', t: 'Reviews & feedback', d: 'Honest reviews from real transactions.', body: `
      <ul><li>Only people who completed an order can review it. Buyers and sellers review each other.</li>
        <li>Reviews stay hidden until both sides have written one, or 14 days pass, so nobody can retaliate. You can reply once.</li>
        <li>We remove reviews that contain personal information, insults, threats, spam, or nothing about the transaction — not reviews just because they're negative.</li>
        <li>Asking for a good review in exchange for money or extras, or threatening a bad one, isn't allowed.</li></ul>` },
    { id: 'disputes', g: 'everyone', t: 'Disputes & appeals', d: 'How Offrava decides when people disagree.', body: `
      <ol><li>Talk it through in the order chat — most problems are solved there.</li><li>If not, open a return or report a problem. Deadlines apply to both sides.</li>
        <li>Offrava reviews the order, photos, tracking and chat, and decides within <b>2 business days</b>. We may ask either side for more information.</li>
        <li>Decisions can be a full or partial refund, closing the case and paying the seller, or other fair outcomes.</li>
        <li>You can appeal once, within 14 days, by emailing <a href="mailto:${esc(s.support_email)}">${esc(s.support_email)}</a> with new information.</li></ol>` },
    { id: 'enforcement', g: 'everyone', t: 'Account limits & suspensions', d: 'What happens when rules are broken.', body: `
      <ul><li>Depending on how serious it is, we may: remove a listing or review, warn you, hold payouts, limit selling or buying, or suspend the account.</li>
        <li>Fraud, threats, counterfeits, and dangerous items can lead to an immediate ban.</li>
        <li>A suspended account can sign in and read, but can't buy, sell or message. Open orders are still protected.</li>
        <li>Think we got it wrong? Email <a href="mailto:${esc(s.support_email)}">${esc(s.support_email)}</a>.</li></ul>` },
    { id: 'ads', g: 'everyone', t: 'Advertising policy', d: 'Rules for sponsored banners.', body: `
      <ul><li>Ads appear only in clearly labeled "Sponsored" spaces and never change search results, offer rankings or shelves.</li>
        <li>Ads must be truthful and legal, and can't promote prohibited items, adult content, gambling, or political campaigns.</li>
        <li>Offrava reviews every ad before it runs and may decline any ad.</li></ul>` }
  ];

  // ---------- Pages ----------
  function view(){ return `<div class="wrap pol-wrap" id="polBox"><p class="muted" style="padding:40px 0">Loading…</p></div>`; }
  async function wire(){
    const box = q('#polBox'); if (!box) return;
    const s = await settings(); const list = P(s);
    const id = param('p'); const one = list.find(x => x.id === id);
    if (!q('#polBox')) return;
    if (one) {
      const g = GROUPS.find(x => x[0] === one.g);
      const siblings = list.filter(x => x.g === one.g);
      box.innerHTML = `<div class="page-head"><div class="crumb"><a href="#/policies">Policies</a> / ${esc(g[1])}</div><h1>${esc(one.t)}</h1><p class="muted">${esc(one.d)} · Updated ${UPDATED}</p></div>
        <div class="pol-layout"><article class="card legal-body pol-body">${one.body}</article>
        <aside class="pol-side"><b>${g[2]} ${esc(g[1])}</b>${siblings.map(x => `<a href="#/policies?p=${x.id}" class="${x.id === one.id ? 'on' : ''}">${esc(x.t)}</a>`).join('')}
          <a href="#/policies" class="pol-all">← All policies</a></aside></div>`;
      window.scrollTo(0, 0); return;
    }
    box.innerHTML = `<div class="page-head"><div class="crumb">Help / Policies</div><h1>Policies</h1><p class="muted">The rules that keep Offrava fair and safe for buyers, sellers, pros and makers. Also see the <a href="#/terms"><u>Terms of Service</u></a> and <a href="#/privacy"><u>Privacy Policy</u></a>.</p></div>
      ${GROUPS.map(([gid, gt, ge]) => `<section class="pol-group"><h2>${ge} ${gt}</h2><div class="pol-grid">${list.filter(x => x.g === gid).map(x => `<a class="card pol-card" href="#/policies?p=${x.id}"><b>${esc(x.t)}</b><span>${esc(x.d)}</span></a>`).join('')}</div></section>`).join('')}
      <p class="muted" style="font-size:13px;padding-bottom:40px">Updated ${UPDATED}. Fees and deadlines on these pages always show the current numbers.</p>`;
  }

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  R['#/policies'] = [view, wire];
})();

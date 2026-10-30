/* Offrava: Terms of Service (#/terms), Privacy Policy (#/privacy) and Contact (#/contact).
   Plain-English drafts for the St. Louis launch. Have a Missouri lawyer review them before going live with real money. */
(function(){
  const A = () => window.OffravaAuth || {};
  const sb = () => A().sb;
  const q = (s, r=document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const UPDATED = 'October 29, 2026';
  let settings = null;
  async function st(){
    if (settings) return settings;
    const { data } = sb() ? await sb().from('platform_settings').select('*').eq('id', 1).maybeSingle() : { data: null };
    settings = data || {}; return settings;
  }
  const pct = (bps) => bps == null ? '—' : (bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  const usd = (c) => c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const page = (crumb, title, body) => `<div class="wrap narrow legal"><div class="page-head"><div class="crumb">${crumb}</div><h1>${title}</h1><p class="muted">Last updated ${UPDATED}</p></div><div class="card legal-body">${body}</div></div>`;

  function viewTerms(){
    return page('Legal', 'Terms of Service', `<div id="lgT"><p class="muted">Loading…</p></div>`);
  }
  async function wireTerms(){
    const s = await st(); const el = q('#lgT'); if (!el) return;
    const mail = esc(s.support_email || 'support@offrava.com');
    el.innerHTML = `
      <p>These terms are an agreement between you and Offrava ("we", "us"). By creating an account or using Offrava, you agree to them. If you don't agree, please don't use Offrava.</p>
      <h2>1. What Offrava is</h2>
      <p>Offrava is a marketplace. Sellers, makers and service pros ("sellers") list items, digital products and services; buyers buy them or ask sellers to compete with sealed offers. Offrava is not the seller of items listed by others. We run the platform, hold payments, and help when something goes wrong.</p>
      <h2>2. Your account</h2>
      <ul><li>You must be at least 18 and able to sign a contract in the US. You confirm your date of birth once; we keep it private. Accounts of people under 18 are closed.</li><li>You can block other members. We remove content that exploits children, close the account, keep a copy as the law requires and report it to NCMEC and law enforcement.</li><li>Give true information and keep your password private. You're responsible for what happens in your account.</li><li>One person, one account. Sellers must pass identity and payout checks with our payment partner, Stripe.</li></ul>
      <h2>3. Buying</h2>
      <ul><li>Pay only inside Offrava. Payments made outside Offrava aren't protected.</li>
        <li>We hold your payment until you get the item (or the job is done). A buyer protection fee of ${usd(s.buyer_fee_fixed_cents)} plus ${pct(s.buyer_fee_bps)} of the item and delivery price is shown before you pay (${usd(s.digital_buyer_fee_cents)} on digital products).</li>
        <li>If an item doesn't arrive, arrives damaged, or isn't as described, you can get a full refund through a return, even when the seller doesn't accept change-of-mind returns.</li>
        <li>Competing offers are sealed and binding: when you buy an offer, the seller must honor that price.</li></ul>
      <h2>4. Selling</h2>
      <ul><li>Only list things you own and have the right to sell. Describe them honestly, with real photos.</li>
        <li>Ship or hand over within the time promised (3 days for shipping unless stated), and answer returns within ${esc(s.seller_reply_days ?? 3)} days.</li>
        <li>Fees are charged only when you sell: ${pct(s.commission_bps)} for individuals, ${pct(s.business_bps)} for shops and for sales won through competing offers, ${pct(s.service_bps)} for service jobs, and ${pct(s.maker_bps)} for digital products (${pct(s.maker_new_bps)} for a maker's first ${esc(s.maker_new_days ?? 90)} days). Founding sellers pay 0% for their first ${esc(s.founding_days ?? 90)} days on up to ${usd(s.founding_cap_cents)} of sales. The smallest fee is ${usd(s.min_fee_cents)}. We'll tell you before fees change.</li>
        <li>You get paid after the buyer confirms, or automatically ${esc(s.auto_complete_pickup_days ?? 3)} days after pickup or ${esc(s.auto_complete_ship_days ?? 7)} days after shipping if no problem is reported (${esc(s.digital_hold_days ?? 7)} days for digital products). If a sale is refunded after you were paid, the payout is taken back.</li>
        <li>Never ask buyers to pay outside Offrava or share contact details to avoid fees.</li></ul>
      <h2>5. Digital products and services</h2>
      <ul><li>Makers may sell only games, software and assets they made or fully own. Reselling other people's games, keys, accounts or subscriptions is not allowed.</li>
        <li>Digital purchases can be refunded within ${esc(s.digital_refund_days ?? 14)} days if never opened, or any time a product doesn't work or isn't as described and the maker can't fix it.</li>
        <li>Service pros are independent businesses, not Offrava employees. Licensed trades require a valid license, which we may check.</li></ul>
      <h2>6. Not allowed</h2>
      <p>Weapons and ammunition, drugs, alcohol and tobacco, prescription medicine, live animals, recalled, counterfeit or stolen goods, adult content, hazardous materials, gift cards and cash equivalents, and anything illegal in Missouri or under US law. Also not allowed: fake reviews, harassment, scams, and pretending to be someone else.</p>
      <h2>7. Fair rankings and ads</h2>
      <p>Nobody can pay to rank higher in search, offers or shelves. Sponsored ads appear only in clearly labeled ad spaces.</p>
      <h2>8. Reviews and content</h2>
      <p>You keep ownership of the photos and text you post, and you let Offrava show them to run and promote the marketplace. We may remove content or reviews that break these terms.</p>
      <h2>9. Problems, suspensions and refunds</h2>
      <p>We may hold payouts while we look into a report, refund buyers, remove listings, or suspend accounts that break these terms or put others at risk. If you disagree with a decision, email <a href="mailto:${mail}">${mail}</a>.</p>
      <h2>10. Limits of our responsibility</h2>
      <p>Offrava is provided "as is". We aren't responsible for what users list, say or do, beyond the protections described here. To the fullest extent the law allows, our total liability for any claim is limited to the fees you paid us in the 12 months before it.</p>
      <h2>11. Ending your account</h2>
      <p>You can delete your account any time in Settings, once your open orders are finished. Some order records are kept as the law requires.</p>
      <h2>12. Changes and law</h2>
      <p>We may update these terms and will tell you about important changes in the app. Missouri law applies.</p>
      <h2>Contact</h2>
      <p><a href="mailto:${mail}">${mail}</a> · <a href="#/contact">Contact page</a></p>`;
  }

  function viewPrivacy(){
    return page('Legal', 'Privacy Policy', `<div id="lgP"><p class="muted">Loading…</p></div>`);
  }
  async function wirePrivacy(){
    const s = await st(); const el = q('#lgP'); if (!el) return;
    const mail = esc(s.support_email || 'support@offrava.com');
    el.innerHTML = `
      <p>This policy explains what we collect, why, and the choices you have. We don't sell your personal information.</p>
      <h2>What we collect</h2>
      <ul><li><b>Account:</b> name, email or phone, ZIP code, and your settings.</li>
        <li><b>Activity:</b> listings, requests, offers, orders, messages, reviews, reports and items you view or save.</li>
        <li><b>Shipping addresses</b> you save or use at checkout. A seller sees the address only for an order they need to ship.</li>
        <li><b>Payments and identity:</b> handled by Stripe. Card numbers, bank details, Social Security numbers and ID photos go directly to Stripe — Offrava never stores them.</li>
        <li><b>Device:</b> basic technical data, and push notification tokens if you turn alerts on.</li></ul>
      <h2>Why we use it</h2>
      <ul><li>To run the marketplace: match requests with sellers, process orders, hold and send payments, and deliver what you bought.</li>
        <li>To keep people safe: prevent fraud, hide phone numbers and emails in chats, and handle reports and disputes.</li>
        <li>To send the notifications and emails you chose in Settings.</li></ul>
      <h2>Who we share it with</h2>
      <ul><li>The other person in your order (for example, a first name and a delivery address).</li>
        <li>Service providers that run Offrava for us: Stripe (payments), Supabase (database and hosting), and email and AI providers when those features are used.</li>
        <li>Authorities when the law requires it, or to protect someone's safety.</li></ul>
      <h2>Admins and messages</h2>
      <p>Offrava staff open a conversation only to handle a report or a dispute, and every look is recorded.</p>
      <h2>Your choices</h2>
      <ul><li>Edit your profile, addresses and notification settings any time.</li>
        <li>Delete your account in <a href="#/settings">Settings</a>. Personal details are erased right away; order records are kept without your name for taxes, refunds and fraud prevention.</li>
        <li>To get a copy of your data, email <a href="mailto:${mail}">${mail}</a>.</li></ul>
      <h2>Messages</h2><p>Your messages are private between you and the other person. To protect you from scams, they're checked automatically for things like requests to pay outside Offrava or to share a verification code. A small team may read a chat only to handle a safety alert, a report or a dispute; each time is recorded.</p><h2>Children</h2><p>Offrava is for adults 18 and over and isn't directed to children. We don't knowingly collect information from anyone under 18; if someone enters a birth date under 18, we don't keep it and the account can't be used. Your date of birth is used only to check your age and is never shown to others.</p><h2>Safety reports</h2><p>If content appears to exploit a child, US law requires us to report it to NCMEC and keep a secured copy for one year. Only a few authorized staff can access it.</p>
      <h2>Contact</h2><p><a href="mailto:${mail}">${mail}</a></p>`;
  }

  function viewContact(){
    return `<div class="wrap narrow"><div class="page-head"><div class="crumb"><a href="#/help">Help</a> / Contact</div><h1>Contact us</h1><p class="muted">Most answers are in the <a href="#/help"><b>Help center</b></a>. Problem with an order? Open the order and use <b>Report a problem</b> — it's the fastest way, and your payment stays protected.</p></div>
      <div class="card" id="lgC" style="margin-bottom:48px"><p class="muted">Loading…</p></div></div>`;
  }
  async function wireContact(){
    const s = await st(); const el = q('#lgC'); if (!el) return;
    const mail = esc(s.support_email || 'support@offrava.com');
    el.innerHTML = `<div class="contact-grid">
        <a class="contact-tile" href="#/orders"><b>📦 An order</b><span>Open the order → Report a problem</span></a>
        <a class="contact-tile" href="#/help?s=returns"><b>↩️ Returns</b><span>How returns and refunds work</span></a>
        <a class="contact-tile" href="#/help?s=safety"><b>🛡️ Safety</b><span>Report a user or listing with 🚩</span></a>
        <a class="contact-tile" href="mailto:${mail}"><b>✉️ Email us</b><span>${mail} · we reply within 1 business day</span></a>
      </div>`;
  }

  const R = window.OFFRAVA_VIEWS = window.OFFRAVA_VIEWS || {};
  Object.assign(R, { '#/terms': [viewTerms, wireTerms], '#/privacy': [viewPrivacy, wirePrivacy], '#/contact': [viewContact, wireContact] });
  window.OffravaLegal = { settings: st };
})();

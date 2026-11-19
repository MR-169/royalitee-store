const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tk = (n) => '৳' + Number(n).toLocaleString('en-IN');
const ls = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const DEL = { inside: 60, outside: 120 };
const FB = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#151D28"/></svg>');
const img = (p, i = 0) => esc((p.images && p.images[i]) || FB);

let P = [];
let cart = ls.get('rc', []);
let wish = ls.get('rw', []);
let user = ls.get('ru', null);
let token = ls.get('rt', null);
let zone = (user && user.zone) || 'inside';
let drTab = 'c';
let pdQty = 1;
let directBuyItem = null; // { id, qty } when using Buy Now from product details


function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.style.display = 'block';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.style.display = 'none'), 2600);
}

const save = () => {
  ls.set('rc', cart);
  ls.set('rw', wish);
  setBadge('#nC', cart.length); // number of different products
  setBadge('#nW', wish.length);
};

function modal(h) {
  $('#box').innerHTML = '<button class="x" onclick="closeM()">×</button>' + h;
  $('#ov').classList.add('on');
}
const closeM = () => { $('#ov').classList.remove('on'); directBuyItem = null; };
const closeD = () => { $('#dr').classList.remove('on'); $('#dov').classList.remove('on'); };
$('#ov').addEventListener('click', (e) => { if (e.target.id === 'ov') closeM(); });

function statusClass(st) {
  const s = String(st || 'Pending').toLowerCase();
  if (s === 'delivered') return 'st-delivered';
  if (s === 'shipped') return 'st-shipped';
  if (s === 'cancelled' || s === 'cancel') return 'st-cancelled';
  return 'st-pending';
}

function fill(sel, key, label) {
  $(sel).innerHTML = `<option value="">${label}</option>` + [...new Set(P.map((p) => p[key]))].map((v) => `<option>${esc(v)}</option>`).join('');
}

async function syncUser() {
  if (!token) return;
  try {
    const d = await api('/auth/me');
    if (d.user) {
      user = d.user;
      ls.set('ru', user);
      if (user.zone) zone = user.zone;
    }
  } catch {}
}

async function load() {
  try { P = await api('/products'); const ids = new Set(P.map((p) => p.id)); cart = cart.filter((i) => ids.has(i.id)); wish = wish.filter((id) => ids.has(id)); } catch (e) { toast(e.message); }
  fill('#fb', 'brand', 'All Brands');
  fill('#fc', 'category', 'All Categories');
  $('#fl').innerHTML = P.slice(0, 2).map((p) => `<div class="c" onclick="detail('${p.id}')" style="cursor:pointer"><img src="${img(p)}" alt=""><div class="sm">${esc(p.brand)}</div><div>${esc(p.name)}</div></div>`).join('');
  render();
  save();
}

function render() {
  const q = $('#q').value.toLowerCase(), b = $('#fb').value, c = $('#fc').value;
  const [lo, hi] = ($('#fp').value || '0-1000000000').split('-').map(Number);
  const L = P.filter((p) => (!q || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q)) && (!b || p.brand === b) && (!c || p.category === c) && p.price >= lo && p.price <= hi);
  $('#grid').innerHTML = L.map((p) => `
    <div class="card">
      <img src="${img(p)}" alt="${esc(p.name)}" onclick="detail('${p.id}')">
      <button class="heart" onclick="tw('${p.id}')">${wish.includes(p.id) ? '♥' : '♡'}</button>
      <div class="b">
        <div class="sm">${esc(p.brand)}</div>
        <div style="cursor:pointer" onclick="detail('${p.id}')">${esc(p.name)}</div>
        ${priceHtml(p)}
        <span class="tag ${p.inStock ? 'in' : 'out'}">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
        <button class="btn" ${p.inStock ? '' : 'disabled'} onclick="add('${p.id}', 1)">Add to Cart</button>
      </div>
    </div>`).join('') || '<p style="padding:0 5vw">No products found.</p>';
}
['#q', '#fb', '#fc', '#fp'].forEach((s) => $(s).addEventListener('input', render));

function add(id, amount = 1) {
  const p = P.find((x) => x.id === id);
  if (!p || !p.inStock) return;
  const i = cart.find((x) => x.id === id);
  const q = (i ? i.qty : 0) + amount;
  if (q > p.stock) return toast('Only ' + p.stock + ' in stock');
  if (i) i.qty = q; else cart.push({ id, qty: amount });
  save();
  toast(`Added ${amount} × ${p.name} to cart`);
}

function tw(id) {
  wish = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id];
  save();
  render();
  if ($('#dr').classList.contains('on') && drTab === 'w') drawer('w');
}

function qty(id, d) {
  const i = cart.find((x) => x.id === id), p = P.find((x) => x.id === id);
  if (!i || !p) return;
  i.qty += d;
  if (i.qty > p.stock) { i.qty = p.stock; toast('Max stock reached'); }
  if (i.qty <= 0) cart = cart.filter((x) => x !== i);
  save();
  drawer('c');
}

function rm(id) {
  cart = cart.filter((x) => x.id !== id);
  save();
  drawer('c');
}

function totals(customList = null) {
  const src = customList || cart;
  const L = src.map((i) => ({ ...i, p: P.find((p) => p.id === i.id) })).filter((i) => i.p);
  const sub = L.reduce((a, i) => a + i.p.price * i.qty, 0);
  return { L, sub, del: L.length ? DEL[zone] : 0, total: sub + (L.length ? DEL[zone] : 0) };
}

function drawer(t) {
  drTab = t;
  const d = $('#dr');
  d.classList.add('on');
  $('#dov').classList.add('on');
  const tabs = `<div style="display:flex;gap:10px;margin-bottom:14px"><button class="btn ${t === 'c' ? '' : 'o'}" onclick="drawer('c')">Cart</button><button class="btn ${t === 'w' ? '' : 'o'}" onclick="drawer('w')">Wishlist</button><button class="x" onclick="closeD()">×</button></div>`;
  if (t === 'w') {
    d.innerHTML = tabs + (wish.map((id) => P.find((p) => p.id === id)).filter(Boolean).map((p) => `<div class="row"><img src="${img(p)}" alt=""><div>${esc(p.name)}<div class="price">${tk(p.price)}</div></div><button class="btn o sm-btn" onclick="add('${p.id}', 1)">Add</button><button class="ib" onclick="tw('${p.id}')">✕</button></div>`).join('') || '<p style="color:var(--mute)">Wishlist is empty.</p>');
    return;
  }
  const T = totals();
  d.innerHTML = tabs + (T.L.map((i) => `<div class="row"><img src="${img(i.p)}" alt=""><div>${esc(i.p.name)}<div class="price">${tk(i.p.price)}</div></div><div class="q"><button onclick="qty('${i.id}',-1)">−</button> ${i.qty} <button onclick="qty('${i.id}',1)">+</button></div><button class="ib" onclick="rm('${i.id}')">✕</button></div>`).join('') || '<p style="color:var(--mute)">Cart is empty.</p>')
    + (T.L.length ? `<div class="f" style="margin-top:16px"><select onchange="zone=this.value;drawer('c')"><option value="inside" ${zone === 'inside' ? 'selected' : ''}>Inside Dhaka (${tk(60)})</option><option value="outside" ${zone === 'outside' ? 'selected' : ''}>Outside Dhaka (${tk(120)})</option></select><p style="line-height:1.7">Subtotal: ${tk(T.sub)}<br>Delivery: ${tk(T.del)}<br><b class="price">Grand Total: ${tk(T.total)}</b></p><button class="btn" onclick="checkout()">Proceed to Checkout</button></div>` : '');
}

function stepPdQty(delta, maxStock) {
  pdQty = Math.max(1, Math.min(maxStock || 1, pdQty + delta));
  const el = $('#pd-qv');
  if (el) el.textContent = pdQty;
}

function buyNow(id) {
  const p = P.find((x) => x.id === id);
  if (!p || !p.inStock) return;
  const q = Math.max(1, Math.min(p.stock, pdQty));
  directBuyItem = [{ id, qty: q }];
  checkout(directBuyItem);
}


function authM(reg) {
  modal(`
    <h2>${reg ? 'Create Account' : 'Welcome Back'}</h2>
    <p class="sm" style="margin-top:4px">${reg ? 'Save your delivery info for faster checkout' : 'Sign in to access your profile & orders'}</p>
    <div class="f" style="margin-top:16px">
      ${reg ? `
        <input id="an" placeholder="Full name">
        <input id="ap" placeholder="Phone (01XXXXXXXXX)">
        <input id="aa" placeholder="Default delivery address (optional)">
        <select id="az">
          <option value="inside">Inside Dhaka (৳60 delivery)</option>
          <option value="outside">Outside Dhaka (৳120 delivery)</option>
        </select>
      ` : ''}
      <input id="ae" type="email" placeholder="Email">
      <input id="aw" type="password" placeholder="Password (6+ chars)">
      <button class="btn" onclick="doAuth(${reg})">${reg ? 'Register' : 'Login'}</button>
      <a href="#" class="sm" style="text-align:center;margin-top:4px" onclick="authM(${!reg});return false">${reg ? 'Already have an account? Login' : 'New to royalitee? Create an account'}</a>
    </div>
  `);
}

async function doAuth(reg) {
  try {
    const body = { email: $('#ae').value, password: $('#aw').value };
    if (reg) {
      body.name = $('#an').value;
      body.phone = $('#ap').value;
      body.address = $('#aa').value;
      body.zone = $('#az').value;
    }
    const d = await api('/auth/' + (reg ? 'register' : 'login'), { method: 'POST', body });
    token = d.token;
    user = d.user;
    if (user.zone) zone = user.zone;
    ls.set('rt', token);
    ls.set('ru', user);
    closeM();
    toast('Welcome, ' + user.name);
    refreshNotif();
  } catch (e) { toast(e.message); }
}

async function profile(tab = 'view') {
  if (!token) return authM(false);
  await syncUser();
  const initials = (user.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Member';

  modal(`
    <div class="prof-head">
      <div class="avatar">${esc(initials)}</div>
      <div>
        <h2 style="margin-bottom:2px">${esc(user.name)}</h2>
        <div class="sm">${esc(user.email)} · ${esc(user.role || 'Customer')} · Since ${esc(memberSince)}</div>
      </div>
    </div>
    <div class="prof-tabs">
      <button class="btn sm-btn ${tab === 'view' ? '' : 'o'}" onclick="profile('view')">Overview</button>
      <button class="btn sm-btn ${tab === 'edit' ? '' : 'o'}" onclick="profile('edit')">Edit Profile</button>
      <button class="btn sm-btn o" onclick="orders()">My Orders</button>
      <button class="btn sm-btn danger" style="margin-left:auto" onclick="logoutUser()">Logout</button>
    </div>
    ${tab === 'edit' ? `
      <div class="f">
        <div class="grid-2">
          <label class="flbl">Full Name<input id="p-name" value="${esc(user.name)}"></label>
          <label class="flbl">Email<input id="p-email" type="email" value="${esc(user.email)}"></label>
        </div>
        <div class="grid-2">
          <label class="flbl">Phone Number<input id="p-phone" placeholder="01XXXXXXXXX" value="${esc(user.phone || '')}"></label>
          <label class="flbl">Default Delivery Zone
            <select id="p-zone">
              <option value="inside" ${(user.zone || 'inside') === 'inside' ? 'selected' : ''}>Inside Dhaka (৳60)</option>
              <option value="outside" ${user.zone === 'outside' ? 'selected' : ''}>Outside Dhaka (৳120)</option>
            </select>
          </label>
        </div>
        <label class="flbl">Saved Delivery Address<textarea id="p-addr" rows="2" placeholder="House, Road, Area, District">${esc(user.address || '')}</textarea></label>
        <div style="border-top:1px solid var(--bd);padding-top:12px;margin-top:4px">
          <div class="sm" style="margin-bottom:8px">Change Password (leave blank to keep current)</div>
          <div class="grid-2">
            <input id="p-cur" type="password" placeholder="Current password">
            <input id="p-new" type="password" placeholder="New password (6+ chars)">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="btn" onclick="saveProfile()">Save Changes</button>
          <button class="btn o" onclick="profile('view')">Cancel</button>
        </div>
      </div>
    ` : `
      <div class="info-grid">
        <div class="info-item"><div class="k">Full Name</div><div class="v">${esc(user.name)}</div></div>
        <div class="info-item"><div class="k">Email Address</div><div class="v">${esc(user.email)}</div></div>
        <div class="info-item"><div class="k">Phone Number</div><div class="v">${esc(user.phone || 'Not added yet')}</div></div>
        <div class="info-item"><div class="k">Default Delivery Zone</div><div class="v">${user.zone === 'outside' ? 'Outside Dhaka (৳120)' : 'Inside Dhaka (৳60)'}</div></div>
        <div class="info-item" style="grid-column:1/-1"><div class="k">Saved Delivery Address</div><div class="v">${esc(user.address || 'No default address saved. Click "Edit Profile" to add one.')}</div></div>
      </div>
      <p style="font-size:13px;color:var(--mute)">Your saved profile details can be auto-filled during checkout with your permission.</p>
    `}
  `);
}

async function saveProfile() {
  try {
    const body = {
      name: $('#p-name').value,
      email: $('#p-email').value,
      phone: $('#p-phone').value,
      zone: $('#p-zone').value,
      address: $('#p-addr').value,
    };
    const np = $('#p-new').value;
    if (np) {
      body.currentPassword = $('#p-cur').value;
      body.newPassword = np;
    }
    const d = await api('/auth/profile', { method: 'PUT', body });
    token = d.token;
    user = d.user;
    if (user.zone) zone = user.zone;
    ls.set('rt', token);
    ls.set('ru', user);
    toast('Profile updated successfully');
    refreshNotif();
    profile('view');
  } catch (e) { toast(e.message); }
}

function logoutUser() {
  token = user = null;
  ls.set('rt', null);
  ls.set('ru', null);
  closeM();
  toast('Logged out');
  refreshNotif();
}

function applySavedCheckoutInfo(useSaved) {
  if (useSaved && user) {
    $('#cn').value = user.name || '';
    $('#cp').value = user.phone || '';
    $('#ca').value = user.address || '';
    if (user.zone) {
      zone = user.zone;
      $('#cz').value = zone;
      $('#tt').textContent = tk(totals(directBuyItem).total);
    }
    toast('Saved profile details filled');
  } else {
    $('#cn').value = '';
    $('#cp').value = '';
    $('#ca').value = '';
    toast('Cleared — enter custom delivery details');
  }
  const pb = $('#perm-banner');
  if (pb) pb.style.display = 'none';
}

async function checkout(customItems = null) {
  if (!token) {
    toast('Please login to checkout');
    return authM(false);
  }
  await syncUser();
  closeD();
  directBuyItem = customItems || null;
  if (user && user.zone && !customItems) zone = user.zone;
  const T = totals(directBuyItem);
  if (!T.L.length) return;

  const hasSavedInfo = Boolean(user && (user.name || user.phone || user.address));
  const summaryItems = T.L.map((i) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>${esc(i.p.name)} × ${i.qty}</span><span>${tk(i.p.price * i.qty)}</span></div>`).join('');

  modal(`
    <h2>Checkout</h2>
    <div style="background:var(--bg-soft);border:1px solid var(--bd);border-radius:8px;padding:10px 14px;margin:12px 0">
      <div class="sm" style="margin-bottom:6px">Order Summary</div>
      ${summaryItems}
    </div>
    ${hasSavedInfo ? `
      <div class="perm-box" id="perm-banner">
        <div style="font-size:13px;line-height:1.5">
          <b style="color:var(--gold)">Use saved profile details?</b><br>
          <span style="color:var(--mute)">${esc(user.name || '')}${user.phone ? ' · ' + esc(user.phone) : ''}${user.address ? ' · ' + esc(user.address) : ''}</span>
        </div>
        <div class="perm-acts">
          <button type="button" class="btn sm-btn" onclick="applySavedCheckoutInfo(true)">Yes, Auto-Fill</button>
          <button type="button" class="btn sm-btn o" onclick="applySavedCheckoutInfo(false)">No, Enter Manually</button>
        </div>
      </div>
    ` : ''}
    <div class="f" style="margin:12px 0">
      <input id="cn" placeholder="Full name" value="">
      <input id="cp" placeholder="Phone (01XXXXXXXXX)" value="">
      <input id="ca" placeholder="Delivery address" value="">
      <select id="cz" onchange="zone=this.value;$('#tt').textContent=tk(totals(directBuyItem).total)">
        <option value="inside" ${zone === 'inside' ? 'selected' : ''}>Inside Dhaka (${tk(60)})</option>
        <option value="outside" ${zone === 'outside' ? 'selected' : ''}>Outside Dhaka (${tk(120)})</option>
      </select>
    </div>
    <div class="pay">
      <label><input type="radio" name="pm" checked> Cash on Delivery</label>
      <label class="dis"><input type="radio" name="pm" disabled> bKash (coming soon)</label>
      <label class="dis"><input type="radio" name="pm" disabled> Nagad (coming soon)</label>
      <label class="dis"><input type="radio" name="pm" disabled> Card (coming soon)</label>
    </div>
    <p style="margin:14px 0">Grand Total: <b class="price" id="tt">${tk(T.total)}</b></p>
    <button class="btn" onclick="place()">Place Order</button>
  `);
}

async function place() {
  try {
    const activeList = directBuyItem || cart;
    const T = totals(activeList);
    const o = await api('/orders', {
      method: 'POST',
      loader: 'Placing your order…',
      body: {
        name: $('#cn').value,
        phone: $('#cp').value,
        address: $('#ca').value,
        zone,
        paymentMethod: 'cod',
        items: T.L.map((i) => ({ productId: i.id, qty: i.qty })),
      },
    });
    if (directBuyItem) {
      directBuyItem = null;
    } else {
      cart = [];
      save();
      closeD();
    }
    await load();
    modal(`
      <h2>Order Placed ✓</h2>
      <p style="margin-top:10px;color:var(--mute)">Order ID: <span class="ord-id">#${esc(String(o.id).slice(0, 6))}</span></p>
      <p style="margin-top:8px">Grand Total: <b class="price">${tk(o.total)}</b> · Cash on Delivery</p>
      <div style="margin-top:16px;display:flex;gap:10px">
        <button class="btn" onclick="orders()">View My Orders</button>
        <button class="btn o" onclick="closeM()">Continue Shopping</button>
      </div>
    `);
  } catch (e) { toast(e.message); }
}


// ===== v3: loader, notifications, reviews, old-price display =====
const ICON_USER = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
const ICON_GIFT = '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="4"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
let ldN = 0, notif = { offers: [], prompts: [] }, rv = { o: '', p: '', n: 0 }, lastOrders = [];

function loading(on, msg) {
  const el = $('#ld');
  if (on) { ldN++; $('#ldm').textContent = msg || 'Loading…'; el.classList.add('on'); }
  else { ldN = Math.max(0, ldN - 1); if (!ldN) el.classList.remove('on'); }
}
function setBadge(sel, n) { const e = $(sel); e.textContent = n; e.style.display = n ? '' : 'none'; }
function priceHtml(p, big) {
  const off = p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return `<div class="prow"><span class="price${big ? ' big' : ''}">${tk(p.price)}</span>${off ? `<s class="old">${tk(p.oldPrice)}</s><span class="off">-${off}%</span>` : ''}</div>`;
}

// Loader shows if a request takes >350ms (instantly when opt.loader message is given)
async function api(path, opt = {}) {
  const { loader, silent, ...o } = opt;
  let shown = false;
  const timer = silent ? null : setTimeout(() => { shown = true; loading(true, loader); }, loader ? 0 : 350);
  try {
    const r = await fetch('/api' + path, {
      ...o,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: o.body ? JSON.stringify(o.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401 && token && !path.includes('/auth/profile')) {
      token = user = null; ls.set('rt', null); ls.set('ru', null); refreshNotif();
    }
    if (!r.ok) throw new Error(d.message || 'Request failed');
    return d;
  } finally { clearTimeout(timer); if (shown) loading(false); }
}

async function refreshNotif() {
  $('#bN').style.display = token ? 'inline-flex' : 'none';
  $('#bU').innerHTML = token && user ? `<span class="av-mini">${esc((user.name || 'U').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>` : ICON_USER;
  if (!token) return;
  try {
    notif = await api('/notifications', { silent: true });
    const seen = ls.get('rseen', []);
    setBadge('#nN', notif.offers.filter((o) => !seen.includes(o.id)).length + notif.prompts.length);
  } catch {}
}
async function openNotifs() {
  await refreshNotif();
  ls.set('rseen', [...new Set([...ls.get('rseen', []), ...notif.offers.map((o) => o.id)])]);
  setBadge('#nN', notif.prompts.length);
  const prompts = notif.prompts.map((r) => `<div class="nt"><img src="${esc(r.image || FB)}" alt=""><div style="flex:1"><b>Delivered: ${esc(r.name)}</b><div style="color:var(--mute);margin-top:3px">How was your experience? Share a quick review.</div><button class="btn sm-btn" style="margin-top:8px" onclick="reviewForm('${r.orderId}','${r.productId}')">Write a review</button></div></div>`).join('');
  const offers = notif.offers.map((o) => `<div class="nt"><div class="nt-i">${ICON_GIFT}</div><div><b>${esc(o.title)}</b><div style="color:var(--mute);margin-top:3px">${esc(o.message)}</div><div class="sm" style="margin-top:4px">${new Date(o.createdAt).toLocaleDateString('en-GB')}</div></div></div>`).join('');
  modal(`<h2 style="margin-bottom:14px">Notifications</h2>${prompts}${offers}${prompts || offers ? '' : '<p style="color:var(--mute)">No notifications yet.</p>'}`);
}

function reviewForm(orderId, productId) {
  const pr = notif.prompts.find((x) => x.orderId === orderId && x.productId === productId);
  const it = pr || lastOrders.filter((o) => o.id === orderId).flatMap((o) => o.items).find((i) => i.productId === productId) || {};
  rv = { o: orderId, p: productId, n: 0 };
  modal(`<h2>Rate your purchase</h2><p class="sm" style="margin:4px 0 14px">${esc(it.name || '')}</p><div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" onclick="setStars(${n})">★</button>`).join('')}</div><div class="f" style="margin-top:14px"><textarea id="rv-t" rows="4" maxlength="1000" placeholder="Describe your experience with this product..."></textarea><button class="btn" onclick="submitReview()">Submit Review</button></div>`);
}
function setStars(n) { rv.n = n; document.querySelectorAll('#stars button').forEach((b, i) => b.classList.toggle('on', i < n)); }
async function submitReview() {
  if (!rv.n) return toast('Please select a star rating');
  try {
    await api('/reviews', { method: 'POST', loader: 'Submitting review…', body: { orderId: rv.o, productId: rv.p, rating: rv.n, text: $('#rv-t').value } });
    toast('Thank you! Your review will appear after approval');
    refreshNotif(); orders();
  } catch (e) { toast(e.message); }
}

async function detail(id) {
  const p = P.find((x) => x.id === id);
  if (!p) return;
  pdQty = 1;
  modal(`
    <div class="pd">
      <div>
        <img class="m" id="mi" src="${img(p)}" alt="">
        <div class="th">${(p.images || []).map((u, i) => `<img src="${img(p, i)}" alt="" onclick="$('#mi').src=this.src">`).join('')}</div>
      </div>
      <div>
        <div class="sm">${esc(p.brand)} · ${esc(p.category)}</div>
        <h2 style="margin:4px 0 8px">${esc(p.name)}</h2>
        ${priceHtml(p, true)}
        <p style="color:var(--mute);margin:10px 0;line-height:1.6">${esc(p.description)}</p>
        <span class="tag ${p.inStock ? 'in' : 'out'}">${p.inStock ? p.stock + ' in stock' : 'Out of Stock'}</span>
        ${Object.keys(p.specs || {}).length ? `<table style="margin:14px 0">${Object.entries(p.specs).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : '<div style="height:14px"></div>'}
        ${p.inStock ? `
          <div class="pd-qty"><span class="sm">Quantity</span><div class="qbox">
            <button type="button" onclick="stepPdQty(-1, ${p.stock})">−</button><span id="pd-qv">1</span><button type="button" onclick="stepPdQty(1, ${p.stock})">+</button>
          </div></div>
          <div class="pd-acts"><button class="btn o" onclick="add('${p.id}', pdQty)">Add to Cart</button><button class="btn" onclick="buyNow('${p.id}')">Buy Now</button></div>
        ` : '<button class="btn" disabled>Out of Stock</button>'}
      </div>
    </div>
    <h3 id="rv-h" style="margin:22px 0 8px">Customer Reviews</h3>
    <div id="rv-box" data-pid="${p.id}"><p style="color:var(--mute)">Loading reviews…</p></div>
  `);
  try {
    const L = await api('/reviews/product/' + id, { silent: true });
    const box = $('#rv-box');
    if (!box || box.dataset.pid !== id) return;
    const avg = L.length ? (L.reduce((a, r) => a + r.rating, 0) / L.length).toFixed(1) : '';
    $('#rv-h').textContent = L.length ? `★ ${avg} · ${L.length} Verified Review${L.length > 1 ? 's' : ''}` : 'Customer Reviews';
    box.innerHTML = L.map((r) => `<div class="rvc"><div class="rv-top"><b>${esc(r.name)}</b><span class="rv-st">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span><span class="sm">${new Date(r.createdAt).toLocaleDateString('en-GB')}</span></div><div style="color:var(--mute);line-height:1.6">${esc(r.text)}</div></div>`).join('') || '<p style="color:var(--mute)">No reviews yet.</p>';
  } catch {}
}

async function orders() {
  if (!token) { toast('Please login first'); return authM(false); }
  try {
    const L = await api('/orders/my-orders');
    lastOrders = L;
    modal(`
      <div style="display:flex;justify-content:space-between;align-items:center;padding-right:28px"><h2>My Orders</h2><span class="sm">${L.length} ${L.length === 1 ? 'Order' : 'Orders'}</span></div>
      ${L.map((o) => {
        const dt = new Date(o.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        return `<div class="ord-card">
          <div class="ord-top"><div style="display:flex;align-items:center;gap:10px"><span class="ord-id">#${esc(String(o.id).slice(0, 6))}</span><span class="sm">${esc(dt)}</span></div><span class="st ${statusClass(o.status)}">${esc(o.status)}</span></div>
          <div class="ord-items">${o.items.map((i) => `<div class="ord-item"><span>${esc(i.name)} <span style="color:var(--mute)">× ${i.qty}</span></span><span style="display:flex;align-items:center;gap:10px">${tk(i.price * i.qty)}${o.status === 'Delivered' ? (i.reviewed ? '<span class="tag in">Reviewed ✓</span>' : `<button class="btn sm-btn o" onclick="reviewForm('${o.id}','${i.productId}')">★ Review</button>`) : ''}</span></div>`).join('')}</div>
          <div class="ord-foot"><span>${o.zone === 'outside' ? 'Outside Dhaka' : 'Inside Dhaka'} · Cash on Delivery</span><span>Total: <b class="price" style="font-size:15px">${tk(o.total)}</b></span></div>
        </div>`;
      }).join('') || '<p style="margin-top:14px;color:var(--mute)">You have not placed any orders yet.</p>'}
    `);
  } catch (e) { toast(e.message); }
}

$('#bN').onclick = openNotifs;
$('#bW').onclick = () => drawer('w');
$('#bC').onclick = () => drawer('c');
$('#bU').onclick = () => profile('view');
$('#bO').onclick = orders;

(async () => {
  await syncUser();
  await load();
  refreshNotif();
})();

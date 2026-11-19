const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tk = (n) => '৳' + Number(n || 0).toLocaleString('en-IN');

let T = localStorage.getItem('at');
let adminUser = (() => { try { return JSON.parse(localStorage.getItem('au')); } catch { return null; } })();
let productsCache = [];
let ordersCache = [];

const DEFAULT_BRANDS = ['Apple', 'Sony', 'Samsung', 'Royalitee Edition'];
const DEFAULT_CATEGORIES = ['Audio', 'Smart Watch', 'Accessories'];


function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.style.display = 'block';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.style.display = 'none'), 2600);
}

function modal(h) {
  $('#box').innerHTML = '<button class="x" onclick="closeM()">×</button>' + h;
  $('#ov').classList.add('on');
}
const closeM = () => $('#ov').classList.remove('on');
$('#ov').addEventListener('click', (e) => { if (e.target.id === 'ov') closeM(); });

function statusClass(st) {
  const s = String(st || 'Pending').toLowerCase();
  if (s === 'delivered') return 'st-delivered';
  if (s === 'shipped') return 'st-shipped';
  if (s === 'cancelled' || s === 'cancel') return 'st-cancelled';
  return 'st-pending';
}

function loginView() {
  $('#app').innerHTML = `
    <div style="max-width:380px;margin:10vh auto;background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:28px">
      <h1 class="logo" style="margin-bottom:6px">royalitee · admin</h1>
      <p class="sm" style="margin-bottom:18px">Sign in to manage store</p>
      <div class="f">
        <input id="e" placeholder="Admin email">
        <input id="p" type="password" placeholder="Password">
        <button class="btn" onclick="login()">Login</button>
      </div>
    </div>
  `;
}

async function login() {
  try {
    const d = await api('/auth/login', { method: 'POST', body: { email: $('#e').value, password: $('#p').value } });
    if (d.user.role !== 'admin') throw new Error('Not an admin account');
    T = d.token;
    adminUser = d.user;
    localStorage.setItem('at', T);
    localStorage.setItem('au', JSON.stringify(adminUser));
    panel();
  } catch (e) { toast(e.message); }
}

async function syncAdminProfile() {
  if (!T) return;
  try {
    const d = await api('/auth/me');
    if (d.user) {
      adminUser = d.user;
      localStorage.setItem('au', JSON.stringify(adminUser));
    }
  } catch {}
}

function getAllBrands() {
  const fromProducts = productsCache.map((p) => p.brand).filter(Boolean);
  const custom = (() => { try { return JSON.parse(localStorage.getItem('custom_brands')) || []; } catch { return []; } })();
  return [...new Set([...DEFAULT_BRANDS, ...fromProducts, ...custom])];
}

function getAllCategories() {
  const fromProducts = productsCache.map((p) => p.category).filter(Boolean);
  const custom = (() => { try { return JSON.parse(localStorage.getItem('custom_categories')) || []; } catch { return []; } })();
  return [...new Set([...DEFAULT_CATEGORIES, ...fromProducts, ...custom])];
}


function toggleNewField(type) {
  const sel = $('#' + type + '-sel');
  const inp = $('#' + type + '-new');
  if (!sel || !inp) return;
  if (sel.value === '__new__') {
    inp.style.display = 'block';
    inp.focus();
  } else {
    inp.style.display = 'none';
    inp.value = '';
  }
}


async function openAdminProfile(tab = 'view') {
  await syncAdminProfile();
  const u = adminUser || { name: 'Admin', email: 'admin@royalitee.com', role: 'admin' };
  const initials = (u.name || 'A').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  modal(`
    <div class="prof-head">
      <div class="avatar">${esc(initials)}</div>
      <div>
        <h2 style="margin-bottom:2px">${esc(u.name)}</h2>
        <div class="sm">${esc(u.email)} · Administrator</div>
      </div>
    </div>
    <div class="prof-tabs">
      <button class="btn sm-btn ${tab === 'view' ? '' : 'o'}" onclick="openAdminProfile('view')">Profile Overview</button>
      <button class="btn sm-btn ${tab === 'edit' ? '' : 'o'}" onclick="openAdminProfile('edit')">Edit Profile & Password</button>
    </div>
    ${tab === 'edit' ? `
      <div class="f">
        <div class="grid-2">
          <label class="flbl">Admin Name<input id="ap-name" value="${esc(u.name || '')}"></label>
          <label class="flbl">Admin Email<input id="ap-email" type="email" value="${esc(u.email || '')}"></label>
        </div>
        <div class="grid-2">
          <label class="flbl">Contact Phone<input id="ap-phone" placeholder="01XXXXXXXXX" value="${esc(u.phone || '')}"></label>
          <label class="flbl">Office / Base Address<input id="ap-addr" placeholder="Dhaka, Bangladesh" value="${esc(u.address || '')}"></label>
        </div>
        <div style="border-top:1px solid var(--bd);padding-top:12px;margin-top:4px">
          <div class="sm" style="margin-bottom:8px">Update Admin Password (optional)</div>
          <div class="grid-2">
            <input id="ap-cur" type="password" placeholder="Current password">
            <input id="ap-new" type="password" placeholder="New password (6+ chars)">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="btn" onclick="saveAdminProfile()">Save Profile</button>
          <button class="btn o" onclick="openAdminProfile('view')">Cancel</button>
        </div>
      </div>
    ` : `
      <div class="info-grid">
        <div class="info-item"><div class="k">Name</div><div class="v">${esc(u.name || 'Admin')}</div></div>
        <div class="info-item"><div class="k">Email</div><div class="v">${esc(u.email || '')}</div></div>
        <div class="info-item"><div class="k">Phone</div><div class="v">${esc(u.phone || 'Not set')}</div></div>
        <div class="info-item"><div class="k">Role</div><div class="v" style="color:var(--gold);text-transform:uppercase">${esc(u.role || 'admin')}</div></div>
        <div class="info-item" style="grid-column:1/-1"><div class="k">Address</div><div class="v">${esc(u.address || 'Not set')}</div></div>
      </div>
    `}
  `);
}

async function saveAdminProfile() {
  try {
    const body = {
      name: $('#ap-name').value,
      email: $('#ap-email').value,
      phone: $('#ap-phone').value,
      address: $('#ap-addr').value,
    };
    const np = $('#ap-new').value;
    if (np) {
      body.currentPassword = $('#ap-cur').value;
      body.newPassword = np;
    }
    const d = await api('/auth/profile', { method: 'PUT', body });
    T = d.token;
    adminUser = d.user;
    localStorage.setItem('at', T);
    localStorage.setItem('au', JSON.stringify(adminUser));
    toast('Admin profile updated');
    openAdminProfile('view');
    panel();
  } catch (e) { toast(e.message); }
}


async function upd(id) {
  try {
    await api('/products/' + id, { method: 'PUT', body: { price: Number($('#pr-' + id).value), stock: Number($('#st-' + id).value) } });
    toast('Inventory saved');
    panel();
  } catch (e) { toast(e.message); }
}

async function del(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await api('/products/' + id, { method: 'DELETE' });
    toast('Product deleted');
    panel();
  } catch (e) { toast(e.message); }
}

async function ost(id, v) {
  try {
    await api('/admin/orders/' + id, { method: 'PUT', body: { status: v } });
    toast('Order status updated to ' + v);
    panel();
  } catch (e) { toast(e.message); }
}

// ===== v3 admin: loader, product add/edit (buy price, old price, spec rows), reviews, offers, profit =====
let ldN = 0, editId = null;
function loading(on, msg) {
  const el = $('#ld');
  if (on) { ldN++; $('#ldm').textContent = msg || 'Loading…'; el.classList.add('on'); }
  else { ldN = Math.max(0, ldN - 1); if (!ldN) el.classList.remove('on'); }
}
async function api(p, o = {}) {
  const { loader, ...rest } = o;
  let shown = false;
  const timer = setTimeout(() => { shown = true; loading(true, loader); }, loader ? 0 : 350);
  try {
    const r = await fetch('/api' + p, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(T ? { Authorization: 'Bearer ' + T } : {}) },
      body: rest.body ? JSON.stringify(rest.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || 'Failed');
    return d;
  } finally { clearTimeout(timer); if (shown) loading(false); }
}

const specRow = (k = '', v = '') => `<div class="sp-row"><input class="sp-k" placeholder="e.g. Battery Life" value="${esc(k)}"><input class="sp-v" placeholder="e.g. 30 hours" value="${esc(v)}"><button type="button" class="btn danger sm-btn" onclick="this.parentElement.remove()">×</button></div>`;
const addSpecRow = () => $('#sp-rows').insertAdjacentHTML('beforeend', specRow());

function openProductModal(id) {
  const p = id ? productsCache.find((x) => x.id === id) : null;
  editId = p ? p.id : null;
  const specs = Object.entries((p && p.specs) || {});
  while (specs.length < 3) specs.push(['', '']);
  const opts = (arr, cur) => arr.map((v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const val = (x) => (p && p[x] ? p[x] : '');
  modal(`
    <h2>${p ? 'Edit Product' : 'Add New Product'}</h2>
    <p class="sm" style="margin:4px 0 16px">Select existing Brand/Category or create a new one</p>
    <div class="f">
      <label class="flbl">Product Name<input id="n" value="${esc(p && p.name)}"></label>
      <div class="grid-2">
        <div><label class="flbl">Brand<select id="b-sel" onchange="toggleNewField('b')">${opts(getAllBrands(), p && p.brand)}<option value="__new__">+ Add New Brand...</option></select></label>
          <input id="b-new" placeholder="Enter new brand name" style="display:none;margin-top:8px"></div>
        <div><label class="flbl">Category<select id="c-sel" onchange="toggleNewField('c')">${opts(getAllCategories(), p && p.category)}<option value="__new__">+ Add New Category...</option></select></label>
          <input id="c-new" placeholder="Enter new category name" style="display:none;margin-top:8px"></div>
      </div>
      <div class="grid-2">
        <label class="flbl">Selling Price (৳)<input id="pr" type="number" min="1" value="${val('price')}"></label>
        <label class="flbl">Old Price (৳, optional – shown struck-through)<input id="op" type="number" min="0" value="${val('oldPrice')}"></label>
      </div>
      <div class="grid-2">
        <label class="flbl">Buy Price (৳) · admin only<input id="bp" type="number" min="0" value="${val('buyPrice')}"></label>
        <label class="flbl">Stock<input id="s" type="number" min="0" value="${p ? p.stock : ''}"></label>
      </div>
      <label class="flbl">Description<textarea id="d" rows="3">${esc(p && p.description)}</textarea></label>
      <label class="flbl">Image URLs (comma separated)<input id="im" value="${esc(((p && p.images) || []).join(', '))}"></label>
      <div><div class="sm" style="margin-bottom:8px">Specifications</div><div id="sp-rows">${specs.map(([k, v]) => specRow(k, v)).join('')}</div>
        <button type="button" class="btn o sm-btn" onclick="addSpecRow()">+ Add Spec</button></div>
      <div style="display:flex;gap:10px;margin-top:6px"><button class="btn" onclick="saveProduct()">${p ? 'Update Product' : 'Save Product'}</button><button class="btn o" onclick="closeM()">Cancel</button></div>
    </div>`);
}

async function saveProduct() {
  try {
    const name = $('#n').value.trim();
    const bSel = $('#b-sel').value, cSel = $('#c-sel').value;
    const brand = (bSel === '__new__' ? $('#b-new').value : bSel).trim();
    const category = (cSel === '__new__' ? $('#c-new').value : cSel).trim();
    if (!name || !brand || !category) return toast('Product name, brand, and category are required');
    const keep = (key, val) => { try { const a = JSON.parse(localStorage.getItem(key)) || []; if (!a.includes(val)) localStorage.setItem(key, JSON.stringify([...a, val])); } catch {} };
    if (bSel === '__new__') keep('custom_brands', brand);
    if (cSel === '__new__') keep('custom_categories', category);
    const specs = {};
    document.querySelectorAll('.sp-row').forEach((r) => {
      const k = r.querySelector('.sp-k').value.trim(), v = r.querySelector('.sp-v').value.trim();
      if (k && v) specs[k] = v;
    });
    const body = {
      name, brand, category, specs,
      price: Number($('#pr').value), oldPrice: Number($('#op').value) || 0, buyPrice: Number($('#bp').value) || 0,
      stock: Number($('#s').value), description: $('#d').value,
      images: $('#im').value.split(',').map((x) => x.trim()).filter(Boolean),
    };
    await api(editId ? '/products/' + editId : '/products', { method: editId ? 'PUT' : 'POST', body, loader: 'Saving product…' });
    closeM(); toast(editId ? 'Product updated' : 'Product added'); panel();
  } catch (e) { toast(e.message); }
}

async function rvAct(id, act) {
  try {
    if (act === 'del') { if (!confirm('Delete this review?')) return; await api('/admin/reviews/' + id, { method: 'DELETE' }); toast('Review deleted'); }
    else { await api('/admin/reviews/' + id, { method: 'PUT', body: { status: 'approved' } }); toast('Review accepted – now visible to customers'); }
    panel();
  } catch (e) { toast(e.message); }
}
async function addOffer() {
  try { await api('/admin/offers', { method: 'POST', body: { title: $('#of-t').value, message: $('#of-m').value }, loader: 'Publishing offer…' }); toast('Offer published'); panel(); } catch (e) { toast(e.message); }
}
async function delOffer(id) {
  if (!confirm('Delete this offer?')) return;
  try { await api('/admin/offers/' + id, { method: 'DELETE' }); panel(); } catch (e) { toast(e.message); }
}

async function panel() {
  try {
    await syncAdminProfile();
    const [P, O, R, F] = await Promise.all([api('/products/admin/all'), api('/admin/orders'), api('/admin/reviews'), api('/admin/offers')]);
    productsCache = P; ordersCache = O;
    const pm = Object.fromEntries(P.map((p) => [p.id, p]));
    let sales = 0, profit = 0;
    for (const o of O.filter((x) => x.status !== 'Cancelled')) {
      for (const i of o.items || []) {
        const cost = i.buyPrice != null ? i.buyPrice : (pm[i.productId] && pm[i.productId].buyPrice) || 0;
        sales += i.price * i.qty; profit += (i.price - cost) * i.qty;
      }
    }
    const cnt = (s) => O.filter((o) => o.status === s).length;
    const low = P.filter((p) => p.stock <= 5).length;
    const pend = R.filter((r) => r.status === 'pending');
    const RS = [...pend, ...R.filter((r) => r.status !== 'pending')];
    const stat = (l, v, s, c = '') => `<div class="stat-card"><div class="s-lbl">${l}</div><div class="s-val" style="${c}">${v}</div><div class="s-sub">${s}</div></div>`;

    $('#app').innerHTML = `
      <div class="adm-bar">
        <div><h1 class="logo">royalitee · admin</h1><div class="sm" style="margin-top:4px">Store Operations & Dashboard</div></div>
        <div class="adm-acts">
          <button class="icon-btn-gold" onclick="openProductModal()" title="Add New Product"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Product</button>
          <button class="btn o sm-btn" onclick="openAdminProfile('view')">👤 ${esc((adminUser && adminUser.name) || 'Admin Profile')}</button>
          <button class="btn danger sm-btn" onclick="localStorage.removeItem('at');localStorage.removeItem('au');location.reload()">Logout</button>
        </div>
      </div>
      <div class="stats-grid">
        ${stat('Total Sales', tk(sales), 'Product sales, delivery charge excluded')}
        ${stat('Total Profit', tk(profit), 'Sale price − buy cost', 'color:' + (profit >= 0 ? 'var(--ok)' : 'var(--bad)'))}
        ${stat('Total Orders', O.length, `${cnt('Pending')} Pending · ${cnt('Delivered')} Delivered · ${cnt('Cancelled')} Cancelled`)}
        ${stat('Catalog Products', P.length, `${getAllBrands().length} Brands · ${getAllCategories().length} Categories`)}
        ${stat('Low / Out of Stock', low, 'Items with ≤ 5 units left', 'color:' + (low ? 'var(--warn)' : 'var(--ok)'))}
        ${stat('Pending Reviews', pend.length, 'Waiting for your approval', 'color:' + (pend.length ? 'var(--warn)' : 'var(--ok)'))}
      </div>

      <div class="panel-card">
        <div class="panel-head"><h2>Orders Management</h2><span class="sm">${O.length} total orders</span></div>
        <table><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Update</th></tr>
        ${O.map((o) => `<tr>
          <td><span class="ord-id">#${esc(String(o.id).slice(0, 6))}</span><br><span class="sm" style="display:inline-block;margin-top:4px">${new Date(o.createdAt).toLocaleString()}</span></td>
          <td><b>${esc(o.customer.name)}</b><br><span style="color:var(--mute)">${esc(o.customer.phone)}</span><br><span style="font-size:12px;color:var(--mute)">${esc(o.customer.address)}</span></td>
          <td>${o.items.map((i) => esc(i.name) + ' ×' + i.qty).join('<br>')}</td>
          <td class="price">${tk(o.total)}</td>
          <td><span class="st ${statusClass(o.status)}">${esc(o.status)}</span></td>
          <td><select onchange="ost('${o.id}',this.value)">${['Pending', 'Shipped', 'Delivered', 'Cancelled'].map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        </tr>`).join('') || '<tr><td colspan="6" style="color:var(--mute)">No orders yet.</td></tr>'}</table>
      </div>

      <div class="panel-card">
        <div class="panel-head"><h2>Customer Reviews</h2><span class="sm">${pend.length} pending · ${R.length} total</span></div>
        <table><tr><th>Product</th><th>Rating</th><th>Review</th><th>Status</th><th>Action</th></tr>
        ${RS.map((r) => `<tr>
          <td><b>${esc(r.productName)}</b><br><span class="sm">by ${esc(r.userName)} · ${new Date(r.createdAt).toLocaleDateString('en-GB')}</span></td>
          <td style="color:var(--gold);white-space:nowrap">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
          <td style="max-width:340px;line-height:1.5">${esc(r.text)}</td>
          <td><span class="st ${r.status === 'approved' ? 'st-delivered' : 'st-pending'}">${r.status === 'approved' ? 'Approved' : 'Pending'}</span></td>
          <td style="white-space:nowrap">${r.status !== 'approved' ? `<button class="btn o sm-btn" title="Accept" onclick="rvAct('${r.id}','ok')">✓</button> ` : ''}<button class="btn danger sm-btn" title="Delete" onclick="rvAct('${r.id}','del')">×</button></td>
        </tr>`).join('') || '<tr><td colspan="5" style="color:var(--mute)">No reviews yet.</td></tr>'}</table>
      </div>

      <div class="panel-card">
        <div class="panel-head"><h2>Offers & Notifications</h2><span class="sm">Shown to logged-in customers (bell icon)</span></div>
        <div class="grid-2" style="margin-bottom:10px"><input id="of-t" placeholder="Offer title, e.g. Weekend Sale"><input id="of-m" placeholder="Message, e.g. 10% off on all earbuds"></div>
        <button class="btn sm-btn" onclick="addOffer()">Publish Offer</button>
        <table style="margin-top:14px">${F.map((f) => `<tr><td><b>${esc(f.title)}</b><br><span style="color:var(--mute)">${esc(f.message)}</span></td><td style="width:90px"><button class="btn danger sm-btn" onclick="delOffer('${f.id}')">Delete</button></td></tr>`).join('') || '<tr><td style="color:var(--mute)">No offers published.</td></tr>'}</table>
      </div>

      <div class="panel-card">
        <div class="panel-head"><h2>Inventory Management</h2><button class="btn o sm-btn" onclick="openProductModal()">+ Add Product</button></div>
        <table><tr><th>Product</th><th>Category</th><th>Buy (৳)</th><th>Price (৳)</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
        ${P.map((p) => `<tr>
          <td><b>${esc(p.name)}</b><br><span class="sm">${esc(p.brand)}</span></td>
          <td><span class="sm">${esc(p.category)}</span></td>
          <td style="color:var(--mute)">${p.buyPrice ? tk(p.buyPrice) : '<span style="color:var(--warn)">not set</span>'}</td>
          <td><input id="pr-${p.id}" type="number" value="${p.price}" style="width:100px"></td>
          <td><input id="st-${p.id}" type="number" value="${p.stock}" style="width:80px"></td>
          <td><span class="tag ${p.inStock ? 'in' : 'out'}">${p.inStock ? 'In Stock' : 'Out of Stock'}</span></td>
          <td style="white-space:nowrap"><button class="btn o sm-btn" onclick="upd('${p.id}')">Save</button> <button class="btn o sm-btn" onclick="openProductModal('${p.id}')">Edit</button> <button class="btn danger sm-btn" onclick="del('${p.id}')">Delete</button></td>
        </tr>`).join('')}</table>
      </div>`;
  } catch (e) {
    localStorage.removeItem('at'); T = null; loginView(); toast(e.message);
  }
}

if (T) panel(); else loginView();

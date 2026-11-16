import { CATEGORIES, PRODUCTS, SLOT_LABELS, byId } from './catalog.js';
import { renderProduct } from './garments.js';
import { Mirror } from './mirror.js';

const PAGE_SIZE = 12;
const SLOTS = ['top', 'eyewear', 'hat'];
const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const state = {
  // Which product sits in each mirror slot, and whether that layer is shown.
  chosen: { top: 'harbour-stripe-long', eyewear: 'tortoise-square', hat: null },
  shown: { top: true, eyewear: false, hat: false },
  focus: 'harbour-stripe-long', // piece described in the side panel
  category: 'all',
  query: '',
  sort: 'featured',
  limit: PAGE_SIZE,
};

/* ----------------------------------------------------------------- mirror */

const stage = $('stage');
const statusEl = $('mirror-status');

const mirror = new Mirror($('mirror-canvas'), ({ mode, message, tone }) => {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
  stage.dataset.mode = mode;
  $('stage-idle').hidden = mode === 'live';
  $('stage-live').hidden = mode !== 'live';
  $('camera-on').disabled = mode === 'starting';
});

function syncMirror() {
  const layers = {};
  for (const slot of SLOTS) {
    layers[slot] = state.shown[slot] && state.chosen[slot] ? byId(state.chosen[slot]) : null;
  }
  mirror.setLayers(layers);
}

$('camera-on').addEventListener('click', () => mirror.start());
$('camera-off').addEventListener('click', () => {
  mirror.stop();
  $('camera-on').focus();
});

$('capture').addEventListener('click', async () => {
  const blob = await mirror.capture();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `level-look-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const btn = $('capture');
  const label = btn.lastChild;
  label.textContent = ' Saved to your device';
  setTimeout(() => { label.textContent = ' Capture still'; }, 1800);
});

const fitInputs = { width: $('fit-width'), length: $('fit-length'), lift: $('fit-lift') };
function syncFit() {
  mirror.setFit({
    width: Number(fitInputs.width.value),
    length: Number(fitInputs.length.value),
    lift: Number(fitInputs.lift.value),
  });
}
for (const input of Object.values(fitInputs)) input.addEventListener('input', syncFit);
$('fit-reset').addEventListener('click', () => {
  fitInputs.width.value = 1;
  fitInputs.length.value = 1;
  fitInputs.lift.value = 0;
  syncFit();
});

/* ------------------------------------------------------- layers and piece */

function renderLayers() {
  const list = $('layer-list');
  list.replaceChildren();
  for (const slot of SLOTS) {
    const product = state.chosen[slot] ? byId(state.chosen[slot]) : null;
    const label = document.createElement('label');
    label.className = 'layer';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = Boolean(product) && state.shown[slot];
    box.disabled = !product;
    box.addEventListener('change', () => {
      state.shown[slot] = box.checked;
      if (box.checked) state.focus = state.chosen[slot];
      update();
    });
    const text = document.createElement('span');
    const kind = document.createElement('small');
    kind.textContent = SLOT_LABELS[slot];
    text.append(kind, product ? product.name : `No ${SLOT_LABELS[slot].toLowerCase()} chosen`);
    label.append(box, text);
    list.append(label);
  }
}

function renderPiece() {
  const product = byId(state.focus);
  if (!product) return;
  const worn = state.chosen[product.slot] === product.id && state.shown[product.slot];
  $('piece-slot').textContent = worn ? 'In the mirror' : 'Chosen, not shown';
  $('piece-name').textContent = product.name;
  $('piece-blurb').textContent = product.blurb;
  $('piece-material').textContent = product.material;
  $('piece-line').textContent = product.line;
  $('piece-price').textContent = money.format(product.price);
  renderProduct($('piece-canvas'), product);

  const top = state.shown.top && state.chosen.top ? byId(state.chosen.top) : null;
  const first = top || SLOTS.map((s) => (state.shown[s] && state.chosen[s] ? byId(state.chosen[s]) : null)).find(Boolean);
  $('stage-name').textContent = first ? first.name : 'Nothing selected yet';
}

function wornProducts() {
  return SLOTS.filter((s) => state.shown[s] && state.chosen[s]).map((s) => byId(state.chosen[s]));
}

/* ------------------------------------------------------------- collection */

function matches() {
  const q = state.query.trim().toLowerCase();
  let list = PRODUCTS.filter((p) => {
    if (!q) return true;
    const cat = CATEGORIES.find((c) => c.id === p.category).label;
    return `${p.name} ${p.line} ${p.material} ${cat}`.toLowerCase().includes(q);
  });
  const counts = { all: list.length };
  for (const c of CATEGORIES) counts[c.id] = list.filter((p) => p.category === c.id).length;
  if (state.category !== 'all') list = list.filter((p) => p.category === state.category);
  if (state.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (state.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
  if (state.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
  return { list, counts };
}

function renderChips(counts) {
  const chips = $('chips');
  chips.replaceChildren();
  for (const c of [{ id: 'all', label: 'All pieces' }, ...CATEGORIES]) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.setAttribute('aria-pressed', String(state.category === c.id));
    const n = document.createElement('span');
    n.className = 'chip-count';
    n.textContent = counts[c.id];
    btn.append(c.label, n);
    btn.addEventListener('click', () => {
      state.category = c.id;
      state.limit = PAGE_SIZE;
      renderCollection();
    });
    chips.append(btn);
  }
}

function card(product) {
  const worn = state.chosen[product.slot] === product.id && state.shown[product.slot];
  const li = document.createElement('li');
  li.className = 'card';
  if (worn) li.classList.add('is-worn');

  const figure = document.createElement('div');
  figure.className = 'card-figure';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  figure.append(canvas);

  const line = document.createElement('p');
  line.className = 'card-line';
  line.textContent = product.line;
  const name = document.createElement('h3');
  name.textContent = product.name;
  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = product.material;

  const foot = document.createElement('div');
  foot.className = 'card-foot';
  const price = document.createElement('span');
  price.className = 'card-price';
  price.textContent = money.format(product.price);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = worn ? 'btn btn-worn' : 'btn btn-soft';
  btn.textContent = worn ? 'In your mirror ✓' : 'Try in mirror';
  btn.setAttribute('aria-pressed', String(worn));
  btn.setAttribute('aria-label', worn ? `${product.name}, in your mirror. Remove` : `Try ${product.name} in the mirror`);
  btn.dataset.id = product.id;
  btn.addEventListener('click', () => {
    if (worn) {
      state.shown[product.slot] = false;
    } else {
      state.chosen[product.slot] = product.id;
      state.shown[product.slot] = true;
      state.focus = product.id;
    }
    update();
    // Rendering rebuilds the grid; keep keyboard focus on the same card.
    document.querySelector(`.card button[data-id="${product.id}"]`)?.focus();
  });
  foot.append(price, btn);

  li.append(figure, line, name, meta, foot);
  return { li, canvas };
}

function renderCollection() {
  const { list, counts } = matches();
  renderChips(counts);

  const visible = list.slice(0, state.limit);
  const grid = $('grid');
  grid.replaceChildren();
  const drawings = [];
  for (const product of visible) {
    const { li, canvas } = card(product);
    grid.append(li);
    drawings.push([canvas, product]);
  }
  for (const [canvas, product] of drawings) renderProduct(canvas, product);

  $('result-count').textContent =
    `${list.length} ${list.length === 1 ? 'piece' : 'pieces'} · ${visible.length} shown`;
  $('empty').hidden = list.length > 0;
  const more = $('show-more');
  const rest = list.length - visible.length;
  more.hidden = rest <= 0;
  more.textContent = `Show ${Math.min(rest, PAGE_SIZE)} more`;

  const worn = wornProducts();
  $('now-list').textContent = worn.length ? worn.map((p) => p.name).join(' · ') : 'Nothing yet';
}

$('search').addEventListener('input', (e) => {
  state.query = e.target.value;
  // A search looks across the whole collection, not just the open category.
  if (state.query.trim()) state.category = 'all';
  state.limit = PAGE_SIZE;
  renderCollection();
});
$('sort').addEventListener('change', (e) => {
  state.sort = e.target.value;
  renderCollection();
});
$('show-more').addEventListener('click', () => {
  state.limit += PAGE_SIZE;
  renderCollection();
});
$('clear-search').addEventListener('click', () => {
  state.query = '';
  state.category = 'all';
  $('search').value = '';
  renderCollection();
  $('search').focus();
});

/* ------------------------------------------------------------------- boot */

function update() {
  syncMirror();
  renderLayers();
  renderPiece();
  renderCollection();
}

update();
syncFit();

// Thumbnails are canvases sized from CSS, so redraw when the layout changes.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    renderPiece();
    renderCollection();
  }, 150);
});
document.fonts?.ready.then(() => renderPiece());

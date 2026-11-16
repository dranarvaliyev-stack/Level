// Sample catalogue. Replace or extend these entries with real products.
//
// category : groups the piece in the collection filters
// slot     : which mirror layer it occupies — "top", "eyewear" or "hat"
// kind     : the cut the renderer draws (see js/garments.js)
// color    : main fabric / frame colour
// accent   : second colour for patterns, lenses, bands
// pattern  : "stripe" | "pinstripe" | "plaid" | "cable" (tops only, optional)

export const CATEGORIES = [
  { id: 'tees', label: 'T-shirts' },
  { id: 'shirts', label: 'Shirts' },
  { id: 'sweaters', label: 'Sweaters' },
  { id: 'jackets', label: 'Jackets' },
  { id: 'eyewear', label: 'Eyewear' },
  { id: 'hats', label: 'Hats' },
];

export const PRODUCTS = [
  // T-shirts
  { id: 'harbour-stripe-long', name: 'Harbour stripe long-sleeve', line: 'Level Core', category: 'tees', slot: 'top', kind: 'long', color: '#f1ece0', accent: '#22344f', pattern: 'stripe', price: 48, material: 'Midweight cotton jersey', blurb: 'Navy stripes on an ecru ground, a ribbed crew neck, and sleeves that finish at the wrist.' },
  { id: 'chalk-tee', name: 'Chalk heavyweight tee', line: 'Level Core', category: 'tees', slot: 'top', kind: 'tee', color: '#ece6d8', accent: '#d8d0bd', price: 32, material: 'Heavyweight combed cotton', blurb: 'A dense, dry-handle tee with a close crew neck and a straight hem.' },
  { id: 'ink-tee', name: 'Ink heavyweight tee', line: 'Level Core', category: 'tees', slot: 'top', kind: 'tee', color: '#1e2730', accent: '#2c3844', price: 32, material: 'Heavyweight combed cotton', blurb: 'The same dense jersey in a deep blue-black that holds its shape.' },
  { id: 'clay-tee', name: 'Clay boxy tee', line: 'Level Core', category: 'tees', slot: 'top', kind: 'tee', color: '#b6603d', accent: '#9c4f31', price: 36, material: 'Garment-dyed cotton', blurb: 'A wider body and a shorter sleeve in a sun-baked terracotta.' },
  { id: 'sage-long', name: 'Sage long-sleeve tee', line: 'Level Core', category: 'tees', slot: 'top', kind: 'long', color: '#8a9a7b', accent: '#74846a', price: 42, material: 'Cotton-modal jersey', blurb: 'A soft long-sleeve layer with ribbed cuffs in a quiet grey-green.' },

  // Shirts
  { id: 'white-oxford', name: 'White Oxford shirt', line: 'Level Shirting', category: 'shirts', slot: 'top', kind: 'shirt', color: '#f4f1ea', accent: '#d9d4c8', price: 68, material: 'Cotton Oxford cloth', blurb: 'A soft collar, a full placket, and a hem cut to wear in or out.' },
  { id: 'sky-poplin', name: 'Sky poplin shirt', line: 'Level Shirting', category: 'shirts', slot: 'top', kind: 'shirt', color: '#a9c3db', accent: '#8fb0cc', price: 64, material: 'Crisp cotton poplin', blurb: 'A light blue shirt with a clean front and a neat point collar.' },
  { id: 'bengal-stripe', name: 'Bengal stripe shirt', line: 'Level Shirting', category: 'shirts', slot: 'top', kind: 'shirt', color: '#f2efe8', accent: '#3d5f8f', pattern: 'pinstripe', price: 72, material: 'Cotton poplin', blurb: 'Fine blue stripes that run true from collar to hem.' },
  { id: 'ember-flannel', name: 'Ember plaid flannel', line: 'Level Field', category: 'shirts', slot: 'top', kind: 'shirt', color: '#a5352a', accent: '#1d1a1a', pattern: 'plaid', price: 78, material: 'Brushed cotton flannel', blurb: 'A red and black check, brushed on both sides for warmth.' },
  { id: 'forest-flannel', name: 'Forest check flannel', line: 'Level Field', category: 'shirts', slot: 'top', kind: 'shirt', color: '#3d5a40', accent: '#e3d7b5', pattern: 'plaid', price: 78, material: 'Brushed cotton flannel', blurb: 'Deep green with a cream overcheck and a roomy cut for layering.' },

  // Sweaters
  { id: 'oat-cable', name: 'Oat cable crew', line: 'Level Knit', category: 'sweaters', slot: 'top', kind: 'sweater', color: '#ddd0b3', accent: '#c9bb9b', pattern: 'cable', price: 96, material: 'Lambswool blend', blurb: 'A cable-front crew with deep ribbing at the hem and cuffs.' },
  { id: 'navy-merino', name: 'Navy merino crew', line: 'Level Knit', category: 'sweaters', slot: 'top', kind: 'sweater', color: '#1f2d4a', accent: '#17233a', price: 88, material: 'Fine merino wool', blurb: 'A smooth, fine-gauge crew that sits close without clinging.' },
  { id: 'breton-knit', name: 'Breton stripe knit', line: 'Level Knit', category: 'sweaters', slot: 'top', kind: 'sweater', color: '#20304a', accent: '#efe9da', pattern: 'stripe', price: 92, material: 'Cotton knit', blurb: 'Cream stripes on navy, knitted rather than printed.' },
  { id: 'rust-quarter-zip', name: 'Rust quarter-zip', line: 'Level Knit', category: 'sweaters', slot: 'top', kind: 'quarterzip', color: '#a4502e', accent: '#8a4226', price: 98, material: 'Ribbed cotton-wool', blurb: 'A stand collar and a short zip in a warm rust.' },
  { id: 'graphite-quarter-zip', name: 'Graphite quarter-zip', line: 'Level Knit', category: 'sweaters', slot: 'top', kind: 'quarterzip', color: '#3b3f45', accent: '#2d3035', price: 98, material: 'Ribbed cotton-wool', blurb: 'The same quarter-zip in a dark, flat grey.' },

  // Jackets
  { id: 'olive-field', name: 'Olive field jacket', line: 'Level Field', category: 'jackets', slot: 'top', kind: 'jacket', color: '#5c6143', accent: '#4a4f36', pockets: true, price: 148, material: 'Waxed cotton canvas', blurb: 'Two chest pockets, a full zip, and room for a knit underneath.' },
  { id: 'tan-chore', name: 'Tan chore coat', line: 'Level Field', category: 'jackets', slot: 'top', kind: 'jacket', color: '#b99263', accent: '#a17d52', pockets: true, price: 132, material: 'Cotton duck', blurb: 'A straight workwear cut in a sandy canvas that softens with wear.' },
  { id: 'black-fleece', name: 'Black fleece zip', line: 'Level Field', category: 'jackets', slot: 'top', kind: 'jacket', color: '#1c1d20', accent: '#101113', price: 84, material: 'Recycled polyester fleece', blurb: 'A plain full-zip fleece with a stand collar.' },
  { id: 'slate-bomber', name: 'Slate bomber', line: 'Level Field', category: 'jackets', slot: 'top', kind: 'jacket', color: '#566270', accent: '#434d59', rib: true, price: 138, material: 'Nylon twill', blurb: 'Ribbed hem and cuffs on a short, clean bomber shape.' },

  // Eyewear
  { id: 'tortoise-square', name: 'Tortoise square sunglasses', line: 'Level Optics', category: 'eyewear', slot: 'eyewear', kind: 'square', color: '#5a3520', accent: '#2a3a36', price: 74, material: 'Acetate frame', blurb: 'A classic square frame in warm tortoise with green-grey lenses.' },
  { id: 'black-round', name: 'Black round sunglasses', line: 'Level Optics', category: 'eyewear', slot: 'eyewear', kind: 'round', color: '#15161a', accent: '#1f2226', price: 68, material: 'Acetate frame', blurb: 'Small round lenses in a slim black frame.' },
  { id: 'gold-aviator', name: 'Gold aviators', line: 'Level Optics', category: 'eyewear', slot: 'eyewear', kind: 'aviator', color: '#b8943f', accent: '#4a3b2a', price: 82, material: 'Metal frame', blurb: 'A fine gold wire frame with brown teardrop lenses.' },
  { id: 'amber-clear', name: 'Clear frame, amber lens', line: 'Level Optics', category: 'eyewear', slot: 'eyewear', kind: 'square', color: '#d9d2c2', accent: '#b0702a', price: 74, material: 'Bio-acetate frame', blurb: 'A translucent frame with a warm amber tint.' },

  // Hats
  { id: 'graphite-beanie', name: 'Graphite beanie', line: 'Level Headwear', category: 'hats', slot: 'hat', kind: 'beanie', color: '#3a3d42', accent: '#2c2f33', price: 28, material: 'Ribbed wool blend', blurb: 'A cuffed rib-knit beanie that sits just above the brow.' },
  { id: 'mustard-beanie', name: 'Mustard beanie', line: 'Level Headwear', category: 'hats', slot: 'hat', kind: 'beanie', color: '#c9972c', accent: '#ae8122', price: 28, material: 'Ribbed wool blend', blurb: 'The same cuffed beanie in a bright ochre.' },
  { id: 'navy-cap', name: 'Navy six-panel cap', line: 'Level Headwear', category: 'hats', slot: 'hat', kind: 'cap', color: '#1f2d4a', accent: '#17223a', price: 34, material: 'Cotton twill', blurb: 'A low-profile cap with a curved brim.' },
  { id: 'stone-bucket', name: 'Stone bucket hat', line: 'Level Headwear', category: 'hats', slot: 'hat', kind: 'bucket', color: '#cfc6b2', accent: '#b9af9a', price: 38, material: 'Washed cotton canvas', blurb: 'A soft, short-brimmed bucket in a pale stone.' },
];

export const SLOT_LABELS = { top: 'Top', eyewear: 'Eyewear', hat: 'Hat' };

export function byId(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

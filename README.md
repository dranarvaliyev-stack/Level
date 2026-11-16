# Level

A live fitting room for the browser. Pick a piece from the collection and it is drawn onto you in a camera mirror, following your shoulders, arms, hips and head as you move.

It is a static site: plain HTML, CSS and JavaScript, with no build step and no server needed.

## Run it

Open `index.html` in Chrome or Edge. The page and the camera both work straight from the file, with no server.

To publish, host the folder on any static host with HTTPS (GitHub Pages, Netlify, Cloudflare Pages). Browsers only allow camera access on `https://`, `localhost`, or a local file.

## How it works

| File | Role |
| --- | --- |
| `index.html`, `css/styles.css` | Page structure and styling |
| `js/catalog.js` | The product list. Edit this to change the collection |
| `js/garments.js` | Draws every piece on a canvas from a set of body points |
| `js/mirror.js` | Camera, body tracking, and the live overlay |
| `js/app.js` | Search, filters, layer toggles and the rest of the UI |

The four scripts are plain (non-module) files loaded in that order and share one `window.Level` namespace, which is what lets the page run from a local file.

Each piece is drawn procedurally from a pose (shoulders, elbows, wrists, hips, eyes, ears). The mirror passes in tracked landmarks; the catalogue thumbnails and the idle mannequin pass in fixed poses. That means a new product needs only a catalogue entry, not artwork.

Body tracking uses [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). The library and model are downloaded from `cdn.jsdelivr.net` and `storage.googleapis.com` on first use, then run in the browser. Camera frames are drawn to a canvas on the page and are never uploaded. If the tracker cannot load, the mirror still opens and centres the piece so it can be placed with the fit sliders.

## Adding a product

Add an entry to `PRODUCTS` in `js/catalog.js`:

```js
{ id: 'plum-tee', name: 'Plum tee', line: 'Level Core', category: 'tees', slot: 'top',
  kind: 'tee', color: '#5b2a4a', accent: '#4a213c', price: 32,
  material: 'Combed cotton', blurb: 'A short description.' }
```

- `slot` is `top`, `eyewear` or `hat`. One piece per slot can be worn at a time.
- `kind` picks the cut: `tee`, `long`, `shirt`, `sweater`, `quarterzip`, `jacket`; `square`, `round`, `aviator`; `beanie`, `cap`, `bucket`.
- `pattern` (tops only) is `stripe`, `pinstripe`, `plaid` or `cable`, drawn in `accent`.

## Limits

The catalogue is sample data with placeholder names and prices. The overlay is an illustration of each cut scaled to the tracked body, not a measured or physically simulated fit.

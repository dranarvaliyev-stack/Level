// Procedural garment renderer.
//
// Every piece is drawn from a "pose": a set of points in canvas pixels
// (shoulders, elbows, wrists, hips, eyes, ears). The live mirror feeds it
// tracked body landmarks; the catalogue thumbnails and the idle mannequin
// feed it fixed poses. One renderer, three uses.

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a, fallback = { x: 0, y: 1 }) => {
  const l = len(a);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l } : fallback;
};
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const perp = (a) => ({ x: -a.y, y: a.x });
const dist = (a, b) => len(sub(a, b));

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const target = amt > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amt));
  const ch = (v) => Math.round(v + (target - v) * k);
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* ------------------------------------------------------------------ poses */

// Normalised (0–1) reference poses.
export const POSES = {
  // Standing figure used by the idle mannequin and the no-tracking fallback.
  stand: {
    ls: [0.37, 0.3], rs: [0.63, 0.3],
    le: [0.3, 0.49], re: [0.7, 0.49],
    lw: [0.27, 0.67], rw: [0.73, 0.67],
    lh: [0.42, 0.66], rh: [0.58, 0.66],
    eyeL: [0.468, 0.132], eyeR: [0.532, 0.132],
    earL: [0.432, 0.142], earR: [0.568, 0.142],
  },
  // Flat-lay with sleeves spread, for top thumbnails.
  flat: {
    ls: [0.35, 0.25], rs: [0.65, 0.25],
    le: [0.2, 0.44], re: [0.8, 0.44],
    lw: [0.1, 0.66], rw: [0.9, 0.66],
    lh: [0.41, 0.69], rh: [0.59, 0.69],
  },
  eyewear: {
    eyeL: [0.33, 0.5], eyeR: [0.67, 0.5],
    earL: [0.12, 0.52], earR: [0.88, 0.52],
  },
  hat: {
    eyeL: [0.41, 0.74], eyeR: [0.59, 0.74],
    earL: [0.27, 0.76], earR: [0.73, 0.76],
  },
};

/** Scale a normalised pose into a pixel rectangle. */
export function posePx(pose, x, y, w, h) {
  const out = {};
  for (const [k, v] of Object.entries(pose)) out[k] = { x: x + v[0] * w, y: y + v[1] * h };
  return out;
}

/* ----------------------------------------------------------------- shapes */

/** A tapered band following a polyline; returns a Path2D. */
function ribbon(points, halfWidths, roundStart = false) {
  const left = [];
  const right = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const n = perp(norm(sub(next, prev)));
    left.push(add(points[i], mul(n, halfWidths[i])));
    right.push(sub(points[i], mul(n, halfWidths[i])));
  }
  const outline = [...left, ...right.reverse()];
  const path = new Path2D();
  path.moveTo(outline[0].x, outline[0].y);
  for (let i = 1; i < outline.length; i++) path.lineTo(outline[i].x, outline[i].y);
  path.closePath();
  // Joint circles must wind the same way as the outline, or the non-zero
  // fill rule cuts them out as holes where they overlap it.
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    area += p.x * q.y - q.x * p.y;
  }
  const anticlockwise = area < 0;
  const joint = (i) => {
    path.moveTo(points[i].x + halfWidths[i], points[i].y);
    path.arc(points[i].x, points[i].y, halfWidths[i], 0, Math.PI * 2, anticlockwise);
  };
  const edge = new Path2D(path); // stroked outline, without the joint circles
  if (roundStart) joint(0);
  for (let i = 1; i < points.length - 1; i++) joint(i); // soften the elbow
  path.edge = edge;
  return path;
}

/** Draw inside a local frame whose +y runs along `down`. */
function inFrame(ctx, origin, down, draw) {
  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(Math.atan2(down.y, down.x) - Math.PI / 2);
  draw();
  ctx.restore();
}

function paintPattern(ctx, product, R, ext) {
  const { pattern, accent } = product;
  if (!pattern) return;
  if (pattern === 'stripe') {
    ctx.fillStyle = accent;
    const period = R * 0.17;
    for (let y = -ext; y < ext; y += period) ctx.fillRect(-ext, y, ext * 2, period * 0.42);
  } else if (pattern === 'pinstripe') {
    ctx.fillStyle = rgba(accent, 0.85);
    const period = R * 0.075;
    for (let x = -ext; x < ext; x += period) ctx.fillRect(x, -ext, Math.max(1, R * 0.014), ext * 2);
  } else if (pattern === 'plaid') {
    const period = R * 0.26;
    ctx.fillStyle = rgba(accent, 0.5);
    for (let y = -ext; y < ext; y += period) ctx.fillRect(-ext, y, ext * 2, period * 0.36);
    for (let x = -ext; x < ext; x += period) ctx.fillRect(x, -ext, period * 0.36, ext * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    const thin = Math.max(1, R * 0.012);
    for (let y = -ext + period * 0.68; y < ext; y += period) ctx.fillRect(-ext, y, ext * 2, thin);
    for (let x = -ext + period * 0.68; x < ext; x += period) ctx.fillRect(x, -ext, thin, ext * 2);
  } else if (pattern === 'cable') {
    ctx.strokeStyle = 'rgba(60, 45, 20, 0.16)';
    ctx.lineWidth = Math.max(1, R * 0.012);
    const period = R * 0.2;
    for (let x = -ext; x < ext; x += period) {
      for (const off of [0, R * 0.045]) {
        ctx.beginPath();
        for (let y = -ext; y < ext; y += R * 0.06) {
          const wob = Math.sin(y / (R * 0.09)) * R * 0.018;
          if (y === -ext) ctx.moveTo(x + off + wob, y);
          else ctx.lineTo(x + off + wob, y);
        }
        ctx.stroke();
      }
    }
  }
}

/** Fill a part with base colour, pattern and soft side shading. */
function paintPart(ctx, path, product, origin, down, R, halfWidth) {
  ctx.save();
  ctx.fillStyle = product.color;
  ctx.fill(path);
  ctx.clip(path);
  const ext = R * 4;
  inFrame(ctx, origin, down, () => {
    paintPattern(ctx, product, R, ext);
    const g = ctx.createLinearGradient(-halfWidth, 0, halfWidth, 0);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.26)');
    g.addColorStop(0.28, 'rgba(0, 0, 0, 0.02)');
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.07)');
    g.addColorStop(0.72, 'rgba(0, 0, 0, 0.02)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(-ext, -ext, ext * 2, ext * 2);
  });
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = Math.max(1, R * 0.008);
  ctx.lineJoin = 'round';
  ctx.stroke(path.edge || path);
  ctx.restore();
}

const KINDS = {
  // neck: how far the front neckline drops below the shoulder line.
  tee: { sleeve: 'short', neck: 0, hem: 1.1, bulk: 1 },
  long: { sleeve: 'long', neck: 0, hem: 1.1, bulk: 1, cuffs: true },
  shirt: { sleeve: 'long', neck: 0.07, hem: 1.16, bulk: 1.02, collar: true, placket: true, cuffs: true },
  sweater: { sleeve: 'long', neck: -0.01, hem: 1.08, bulk: 1.05, rib: true, cuffs: true },
  quarterzip: { sleeve: 'long', neck: 0.04, hem: 1.08, bulk: 1.05, rib: true, cuffs: true, zip: 0.36, stand: true },
  jacket: { sleeve: 'long', neck: 0.06, hem: 1.12, bulk: 1.1, zip: 1, stand: true },
};

/* ------------------------------------------------------------------- tops */

/**
 * Draw a top (tee, shirt, sweater, jacket) on a pose.
 * fit: { width, length, lift } — multipliers around 1, lift in shoulder-widths.
 */
export function drawTop(ctx, pose, product, fit = {}) {
  const width = fit.width ?? 1;
  const length = fit.length ?? 1;
  const lift = fit.lift ?? 0;
  const cfg = KINDS[product.kind] || KINDS.tee;

  let { ls, rs, le, re, lw, rw, lh, rh } = pose;
  if (!ls || !rs) return;
  if (ls.x > rs.x) {
    [ls, rs] = [rs, ls];
    [le, re] = [re, le];
    [lw, rw] = [rw, lw];
    [lh, rh] = [rh, lh];
  }

  const S = dist(ls, rs);
  if (S < 6) return;
  const M0 = mid(ls, rs);
  const H0 = mid(lh, rh);
  const d = norm(sub(H0, M0));
  const a = norm(sub(rs, ls), { x: 1, y: 0 });
  const ah = norm(add(a, norm(sub(rh, lh), a)), a);
  const T = dist(M0, H0);
  // Reference size that stays steady when the body turns side-on.
  const R = Math.max(S, T * 0.6);
  const o = mul(d, -lift * R);
  const bulk = cfg.bulk * width;

  const M = add(M0, o);
  const sL = add(ls, o);
  const sR = add(rs, o);
  const soL = add(sL, add(mul(a, -0.13 * R * bulk), mul(d, -0.09 * R)));
  const soR = add(sR, add(mul(a, 0.13 * R * bulk), mul(d, -0.09 * R)));
  const neckL = add(M, add(mul(a, -0.19 * R), mul(d, -0.17 * R)));
  const neckR = add(M, add(mul(a, 0.19 * R), mul(d, -0.17 * R)));
  const apL = add(sL, add(mul(a, -0.09 * R * bulk), mul(d, 0.34 * R)));
  const apR = add(sR, add(mul(a, 0.09 * R * bulk), mul(d, 0.34 * R)));
  const hc = add(add(M0, mul(sub(H0, M0), cfg.hem * length)), o);
  const hw = Math.max(0.56 * R, dist(lh, rh) * 0.78) * bulk;
  const hemL = add(hc, mul(ah, -hw));
  const hemR = add(hc, mul(ah, hw));
  const nb = add(M, mul(d, cfg.neck * R));
  // A cubic with both handles dropped by k bottoms out 0.75k below its ends,
  // which gives a rounder scoop than a single-handle curve.
  const drop = mul(d, ((cfg.neck + 0.17) / 0.75) * R);
  const neckC1 = add(neckR, drop);
  const neckC2 = add(neckL, drop);

  // Sleeves first, so the body overlaps the shoulder seam.
  const sleeveScale = R * cfg.bulk * (0.6 + 0.4 * width);
  for (const [s, e, w] of [[sL, le, lw], [sR, re, rw]]) {
    if (!e) continue;
    // Start a little below the joint so the sleeve head rounds into the
    // shoulder line instead of standing proud of it.
    const s0 = add(s, mul(d, 0.09 * R));
    let pts;
    let hws;
    if (cfg.sleeve === 'short' || !w) {
      pts = [s0, lerp(s0, e, 0.62)];
      hws = [0.215 * sleeveScale, 0.18 * sleeveScale];
    } else {
      pts = [s0, e, w];
      hws = [0.215 * sleeveScale, 0.15 * sleeveScale, 0.11 * sleeveScale];
    }
    const path = ribbon(pts, hws, true);
    const end = pts[pts.length - 1];
    paintPart(ctx, path, product, s0, norm(sub(end, s0)), R, hws[0]);
    if (pts.length === 3 && (cfg.cuffs || product.rib)) {
      const c0 = lerp(e, w, 0.86);
      const cuff = ribbon([c0, w], [hws[2] * 1.14, hws[2] * 1.06]);
      ctx.save();
      ctx.fillStyle = shade(product.color, -0.16);
      ctx.fill(cuff);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = Math.max(1, R * 0.007);
      ctx.stroke(cuff);
      ctx.restore();
    }
  }

  // Body.
  const body = new Path2D();
  body.moveTo(neckL.x, neckL.y);
  body.lineTo(soL.x, soL.y);
  body.lineTo(apL.x, apL.y);
  const wL = add(mid(apL, hemL), mul(a, 0.025 * R));
  const wR = add(mid(apR, hemR), mul(a, -0.025 * R));
  body.quadraticCurveTo(wL.x, wL.y, hemL.x, hemL.y);
  const hemCtrl = add(hc, mul(d, 0.05 * R));
  body.quadraticCurveTo(hemCtrl.x, hemCtrl.y, hemR.x, hemR.y);
  body.quadraticCurveTo(wR.x, wR.y, apR.x, apR.y);
  body.lineTo(soR.x, soR.y);
  body.lineTo(neckR.x, neckR.y);
  body.bezierCurveTo(neckC1.x, neckC1.y, neckC2.x, neckC2.y, neckL.x, neckL.y);
  body.closePath();
  paintPart(ctx, body, product, M, d, R, hw);

  // Details, clipped to the body.
  ctx.save();
  ctx.clip(body);

  if (cfg.rib || product.rib) {
    const band = new Path2D();
    const up = mul(d, -0.085 * R);
    const down = mul(d, 0.3 * R);
    const p1 = add(add(hemL, mul(ah, -R)), up);
    const p2 = add(add(hemR, mul(ah, R)), up);
    const p3 = add(add(hemR, mul(ah, R)), down);
    const p4 = add(add(hemL, mul(ah, -R)), down);
    band.moveTo(p1.x, p1.y);
    band.lineTo(p2.x, p2.y);
    band.lineTo(p3.x, p3.y);
    band.lineTo(p4.x, p4.y);
    band.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fill(band);
  }

  if (product.pockets) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = Math.max(1, R * 0.008);
    for (const side of [-1, 1]) {
      const c = add(M, add(mul(a, side * 0.25 * R), mul(d, 0.32 * R)));
      inFrame(ctx, c, d, () => {
        const pw = R * 0.24;
        const ph = R * 0.22;
        ctx.strokeRect(-pw / 2, 0, pw, ph);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(-pw / 2, 0, pw, ph * 0.3);
        ctx.strokeRect(-pw / 2, 0, pw, ph * 0.3);
      });
    }
  }

  if (cfg.placket) {
    const off = mul(perp(norm(sub(hc, nb))), 0.04 * R);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = Math.max(1, R * 0.007);
    for (const k of [-1, 1]) {
      const p = add(nb, mul(off, k));
      const q = add(add(hc, mul(d, 0.1 * R)), mul(off, k));
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }
    ctx.fillStyle = shade(product.color, -0.38);
    for (let i = 0; i < 6; i++) {
      const b = lerp(nb, hc, 0.1 + i * 0.165);
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(1.2, R * 0.016), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (cfg.zip) {
    const end = lerp(nb, add(hc, mul(d, 0.1 * R)), cfg.zip);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = Math.max(1.5, R * 0.022);
    ctx.beginPath();
    ctx.moveTo(nb.x, nb.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = Math.max(0.75, R * 0.006);
    ctx.setLineDash([R * 0.02, R * 0.02]);
    ctx.beginPath();
    ctx.moveTo(nb.x, nb.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (cfg.zip < 1) {
      ctx.fillStyle = 'rgba(210, 210, 205, 0.95)';
      inFrame(ctx, end, d, () => ctx.fillRect(-R * 0.014, 0, R * 0.028, R * 0.07));
    }
  }
  ctx.restore();

  // Neckline finish.
  const neckline = new Path2D();
  neckline.moveTo(neckR.x, neckR.y);
  neckline.bezierCurveTo(neckC1.x, neckC1.y, neckC2.x, neckC2.y, neckL.x, neckL.y);
  ctx.save();
  ctx.lineCap = 'round';
  if (cfg.collar) {
    for (const side of [-1, 1]) {
      const n = side < 0 ? neckL : neckR;
      const tip = add(nb, add(mul(a, side * 0.17 * R), mul(d, 0.15 * R)));
      const outer = add(n, add(mul(a, side * 0.035 * R), mul(d, 0.02 * R)));
      const leaf = new Path2D();
      leaf.moveTo(n.x, n.y);
      leaf.lineTo(nb.x, nb.y);
      leaf.lineTo(tip.x, tip.y);
      leaf.lineTo(outer.x, outer.y);
      leaf.closePath();
      ctx.fillStyle = product.pattern ? product.color : shade(product.color, 0.12);
      ctx.fill(leaf);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.lineWidth = Math.max(1, R * 0.008);
      ctx.lineJoin = 'round';
      ctx.stroke(leaf);
    }
  } else {
    ctx.strokeStyle = shade(product.color, cfg.stand ? -0.22 : -0.14);
    ctx.lineWidth = R * (cfg.stand ? 0.1 : 0.045);
    ctx.stroke(neckline);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.stroke(neckline);
  }
  ctx.restore();
}

/* ---------------------------------------------------------------- eyewear */

function lensPath(kind, cx, d) {
  const p = new Path2D();
  if (kind === 'round') {
    p.arc(cx, d * 0.03, d * 0.33, 0, Math.PI * 2);
  } else if (kind === 'aviator') {
    const w = d * 0.4;
    p.moveTo(cx - w, -d * 0.2);
    p.bezierCurveTo(cx - w, -d * 0.3, cx + w, -d * 0.3, cx + w, -d * 0.2);
    p.bezierCurveTo(cx + w * 1.05, d * 0.25, cx + w * 0.4, d * 0.46, cx, d * 0.44);
    p.bezierCurveTo(cx - w * 0.4, d * 0.46, cx - w * 1.05, d * 0.25, cx - w, -d * 0.2);
    p.closePath();
  } else {
    const w = d * 0.8;
    const h = d * 0.58;
    p.roundRect(cx - w / 2, -h / 2 + d * 0.04, w, h, [d * 0.1, d * 0.1, d * 0.2, d * 0.2]);
  }
  return p;
}

/**
 * Where the head is and how big, from the eyes. When the head turns away the
 * eyes close up on screen, so `pose.eyeRef` (an eye spacing estimated from the
 * body) keeps the size steady and `turn` says how side-on the head is.
 */
function headFrame(pose) {
  let l = pose.eyeL;
  let r = pose.eyeR;
  if (!l || !r) return null;
  if (l.x > r.x) [l, r] = [r, l];
  const seen = dist(l, r);
  const d = Math.max(seen, pose.eyeRef || 0);
  if (d < 3) return null;
  const turn = Math.min(1, seen / d); // 1 facing the camera, towards 0 in profile
  // A very short eye line is too noisy to take head tilt from.
  const trust = Math.min(1, Math.max(0, (turn - 0.3) / 0.3));
  const angle = Math.atan2(r.y - l.y, r.x - l.x) * trust;
  return { c: mid(l, r), d, turn, angle };
}

export function drawEyewear(ctx, pose, product) {
  const head = headFrame(pose);
  if (!head) return;
  const { c, d } = head;
  const metal = product.kind === 'aviator';
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(head.angle);
  ctx.scale(Math.max(0.4, head.turn), 1); // foreshorten as the head turns
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Temples.
  ctx.strokeStyle = product.color;
  ctx.lineWidth = d * (metal ? 0.035 : 0.07);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * d * 0.9, -d * 0.12);
    ctx.lineTo(side * d * 1.18, -d * 0.06);
    ctx.stroke();
  }
  // Bridge.
  ctx.lineWidth = d * (metal ? 0.035 : 0.075);
  ctx.beginPath();
  ctx.moveTo(-d * 0.14, -d * 0.06);
  ctx.quadraticCurveTo(0, -d * 0.16, d * 0.14, -d * 0.06);
  ctx.stroke();
  if (metal) {
    ctx.beginPath();
    ctx.moveTo(-d * 0.3, -d * 0.24);
    ctx.lineTo(d * 0.3, -d * 0.24);
    ctx.stroke();
  }

  for (const side of [-1, 1]) {
    const lens = lensPath(product.kind, side * d * 0.5, d);
    const g = ctx.createLinearGradient(0, -d * 0.3, 0, d * 0.4);
    g.addColorStop(0, rgba(product.accent, 0.92));
    g.addColorStop(1, rgba(product.accent, 0.68));
    ctx.fillStyle = g;
    ctx.fill(lens);
    // Glint.
    ctx.save();
    ctx.clip(lens);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.ellipse(side * d * 0.5 - d * 0.14, -d * 0.12, d * 0.22, d * 0.08, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = product.color;
    ctx.lineWidth = d * (metal ? 0.035 : 0.085);
    ctx.stroke(lens);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------- hats */

export function drawHat(ctx, pose, product) {
  const head = headFrame(pose);
  if (!head) return;
  const { c, d } = head;
  const { earL, earR } = pose;
  const earSpan = earL && earR ? dist(earL, earR) : 0;
  // Head width on screen: a head is deeper front-to-back than it is wide,
  // so it grows a little as it turns side-on.
  const W = Math.max(earSpan * 1.08, d * (2.3 + 0.9 * (1 - head.turn)));

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(head.angle);
  if (earL && earR) {
    // The eyes sit at the front of a turned head; slide back towards the ears
    // so the hat stays over the crown.
    const e = sub(mid(earL, earR), c);
    ctx.translate((e.x * Math.cos(head.angle) + e.y * Math.sin(head.angle)) * 0.85, 0);
  }
  ctx.lineJoin = 'round';
  const base = -d * 0.62; // brow line (y is up-negative)
  const half = W * 0.54;
  const outline = 'rgba(0, 0, 0, 0.3)';
  const lw = Math.max(1, W * 0.008);

  const dome = (height, widen = 1) => {
    const p = new Path2D();
    p.moveTo(-half * widen, base);
    p.bezierCurveTo(-half * widen, base - height * 1.25, half * widen, base - height * 1.25, half * widen, base);
    p.closePath();
    return p;
  };
  const shadeDome = (p) => {
    ctx.save();
    ctx.clip(p);
    const g = ctx.createLinearGradient(-half, 0, half, 0);
    g.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
    g.addColorStop(0.45, 'rgba(255, 255, 255, 0.08)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
    ctx.fillStyle = g;
    ctx.fillRect(-W, base - W * 2, W * 2, W * 3);
    ctx.restore();
  };

  if (product.kind === 'beanie') {
    const p = dome(W * 0.72);
    ctx.fillStyle = product.color;
    ctx.fill(p);
    shadeDome(p);
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    ctx.stroke(p);
    // Cuff.
    const cuffH = W * 0.24;
    const cuff = new Path2D();
    cuff.roundRect(-half * 1.04, base - cuffH * 0.75, half * 2.08, cuffH, W * 0.05);
    ctx.fillStyle = product.accent;
    ctx.fill(cuff);
    ctx.save();
    ctx.clip(cuff);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = Math.max(1, W * 0.012);
    for (let x = -half * 1.04; x < half * 1.04; x += W * 0.055) {
      ctx.beginPath();
      ctx.moveTo(x, base - cuffH);
      ctx.lineTo(x, base + cuffH);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    ctx.stroke(cuff);
  } else if (product.kind === 'cap') {
    // Brim.
    const brim = new Path2D();
    brim.moveTo(-half * 0.98, base - W * 0.02);
    brim.bezierCurveTo(-half * 1.05, base + W * 0.22, half * 1.05, base + W * 0.22, half * 0.98, base - W * 0.02);
    brim.closePath();
    ctx.fillStyle = product.accent;
    ctx.fill(brim);
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    ctx.stroke(brim);
    const p = dome(W * 0.56);
    ctx.fillStyle = product.color;
    ctx.fill(p);
    shadeDome(p);
    ctx.stroke(p);
    // Panel seams and button.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, base);
    ctx.lineTo(0, base - W * 0.52);
    ctx.moveTo(-half * 0.55, base);
    ctx.quadraticCurveTo(-half * 0.5, base - W * 0.36, 0, base - W * 0.52);
    ctx.moveTo(half * 0.55, base);
    ctx.quadraticCurveTo(half * 0.5, base - W * 0.36, 0, base - W * 0.52);
    ctx.stroke();
    ctx.fillStyle = product.accent;
    ctx.beginPath();
    ctx.arc(0, base - W * 0.525, W * 0.03, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Bucket.
    const brim = new Path2D();
    brim.moveTo(-half * 0.96, base - W * 0.2);
    brim.lineTo(-half * 1.42, base + W * 0.1);
    brim.quadraticCurveTo(0, base + W * 0.2, half * 1.42, base + W * 0.1);
    brim.lineTo(half * 0.96, base - W * 0.2);
    brim.closePath();
    ctx.fillStyle = product.accent;
    ctx.fill(brim);
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    ctx.stroke(brim);
    const crown = new Path2D();
    crown.moveTo(-half * 0.98, base - W * 0.14);
    crown.lineTo(-half * 0.84, base - W * 0.56);
    crown.quadraticCurveTo(0, base - W * 0.68, half * 0.84, base - W * 0.56);
    crown.lineTo(half * 0.98, base - W * 0.14);
    crown.quadraticCurveTo(0, base - W * 0.06, -half * 0.98, base - W * 0.14);
    crown.closePath();
    ctx.fillStyle = product.color;
    ctx.fill(crown);
    shadeDome(crown);
    ctx.stroke(crown);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.setLineDash([W * 0.03, W * 0.025]);
    ctx.beginPath();
    ctx.moveTo(-half * 1.2, base);
    ctx.quadraticCurveTo(0, base + W * 0.1, half * 1.2, base);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* -------------------------------------------------------------- mannequin */

/** A soft figure to wear the pieces while the camera is off. */
export function drawMannequin(ctx, pose, tone = '#cfc6b6', floor = 0) {
  const { ls, rs, le, re, lw, rw, lh, rh, eyeL, eyeR } = pose;
  const S = dist(ls, rs);
  ctx.save();
  ctx.fillStyle = tone;
  ctx.strokeStyle = tone;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Legs.
  ctx.lineWidth = S * 0.42;
  for (const h of [lh, rh]) {
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x, Math.max(floor, h.y + S));
    ctx.stroke();
  }
  // Torso.
  ctx.lineWidth = S * 0.3;
  ctx.beginPath();
  ctx.moveTo(ls.x, ls.y);
  ctx.lineTo(rs.x, rs.y);
  ctx.lineTo(rh.x, rh.y);
  ctx.lineTo(lh.x, lh.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Arms.
  ctx.lineWidth = S * 0.24;
  for (const [s, e, w] of [[ls, le, lw], [rs, re, rw]]) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(w.x, w.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w.x, w.y, S * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  // Neck and head.
  const M = mid(ls, rs);
  const eyes = mid(eyeL, eyeR);
  const ed = dist(eyeL, eyeR);
  ctx.lineWidth = S * 0.26;
  ctx.beginPath();
  ctx.moveTo(M.x, M.y);
  ctx.lineTo(eyes.x, eyes.y + ed * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(eyes.x, eyes.y + ed * 0.25, ed * 1.12, ed * 1.45, Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------- thumbnails */

/** Size a canvas to its CSS box at device resolution; returns the 2D context. */
export function fitCanvas(canvas, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas.getContext('2d');
}

/** Draw a product on its own, centred in the canvas. */
export function renderProduct(canvas, product) {
  const ctx = fitCanvas(canvas);
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  const side = Math.min(W, H);
  const x = (W - side) / 2;
  const y = (H - side) / 2;
  if (product.slot === 'top') {
    drawTop(ctx, posePx(POSES.flat, x, y + side * 0.03, side, side), product);
  } else if (product.slot === 'eyewear') {
    drawEyewear(ctx, posePx(POSES.eyewear, x, y, side, side), product);
  } else {
    drawHat(ctx, posePx(POSES.hat, x, y, side, side), product);
  }
}

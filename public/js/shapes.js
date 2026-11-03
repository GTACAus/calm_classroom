// Product-shaped models built from a few isometric primitives (boxes and cylinders), so items
// read like the real Beparta pieces without any image assets. Parts are defined in the item's
// local, unrotated footprint (u across w, v across d; v = d is the front), heights in px.

import { project, rectToView, shade, TW, TH } from './iso.js';

const box = (u, v, w, d, z0, z1, c) => ({ t: 'box', u, v, w, d, z0, z1, c });
const cyl = (u, v, r, z0, z1, c) => ({ t: 'cyl', u, v, r, z0, z1, c });
const LEG = '#5B5F57', LAVA = '#8E9590', WOOD = '#D9C7A3';

function legs(W, D, h, c = LEG, s = 0.07, i = 0.08) {
  return [box(i, i, s, s, 0, h, c), box(W - i - s, i, s, s, 0, h, c), box(i, D - i - s, s, s, 0, h, c), box(W - i - s, D - i - s, s, s, 0, h, c)];
}
const table = (W, D, h, top, leg = LEG) => [...legs(W, D, h - 3, leg), box(0.02, 0.02, W - 0.04, D - 0.04, h - 3, h, top)];
function chair(W, D, h, c, legC = LEG) {
  return [...legs(W, D, 11, legC, 0.06, 0.2), box(0.18, 0.2, 0.64, 0.62, 11, 14, c), box(0.18, 0.14, 0.64, 0.08, 14, h, c)];
}
const stool = (h, c, base = LEG) => [cyl(0.5, 0.5, 0.26, 0, 2, base), cyl(0.5, 0.5, 0.05, 2, h - 3, base), cyl(0.5, 0.5, 0.3, h - 3, h, c)];
function lounge(W, D, h, c, arms) {
  const p = [box(0.04, 0.12, W - 0.08, D - 0.16, 0, 6, LEG), box(0.06, 0.15, W - 0.12, D - 0.2, 6, 15, c),
    box(0.06, 0.1, W - 0.12, 0.22, 15, h, shade(c, -0.08))];
  if (arms) p.push(box(0.04, 0.12, 0.14, D - 0.16, 6, 20, shade(c, -0.08)), box(W - 0.18, 0.12, 0.14, D - 0.16, 6, 20, shade(c, -0.08)));
  return p;
}
function shelves(W, D, h, frame, n, fill) {
  const p = [box(0, 0, W, 0.08, 0, h, frame), box(0, 0, 0.06, D, 0, h, frame), box(W - 0.06, 0, 0.06, D, 0, h, frame)];
  for (let i = 0; i <= n; i++) {
    const z = (h - 2) * i / n;
    p.push(box(0.06, 0.08, W - 0.12, D - 0.12, z, z + 2, frame));
    if (fill && i < n) {
      const cols = ['#E84A3C', '#4C34E5', '#00BC74', '#FFCD1F', '#FF6D3A', '#C0ADFF'];
      for (let b = 0; b < W * 6 - 1; b++) p.push(box(0.1 + b * 0.16, 0.2, 0.12, D * 0.5, z + 2, z + 2 + (h / n) * (0.55 + (b % 3) * 0.12), cols[(b + i) % cols.length]));
    }
  }
  return p;
}
function caddy(W, D, h, body, rows, colsN) {
  const p = [box(0.02, 0.04, W - 0.04, D - 0.08, 2, h, body)];
  const tw = (W - 0.16) / colsN, th = (h - 6) / rows;
  const trays = ['#3C8CE8', '#FFCD1F', '#E84A3C', '#00BC74'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < colsN; c++) {
    p.push(box(0.08 + c * tw + 0.02, D - 0.06, tw - 0.04, 0.03, 4 + r * th + 1, 4 + (r + 1) * th - 1, trays[(r + c) % trays.length]));
  }
  return p;
}
// Hooded seat / pod: back + sides + roof, open front, cushion inside.
function pod(W, D, h, shell, cushion, roof = true) {
  const p = [box(0, 0, W, 0.12, 0, h, shell), box(0, 0, 0.1, D, 0, h, shell), box(W - 0.1, 0, 0.1, D, 0, h, shell),
    box(0.1, 0.12, W - 0.2, D - 0.2, 0, 14, cushion)];
  if (roof) p.push(box(0, 0, W, D, h - 4, h, shade(shell, 0.1)));
  return p;
}
const panel = (W, D, h, c, z0 = 3) => [box(0.08, D / 2 - 0.1, 0.06, 0.2, 0, z0, LEG), box(W - 0.14, D / 2 - 0.1, 0.06, 0.2, 0, z0, LEG), box(0.02, D / 2 - 0.05, W - 0.04, 0.1, z0, h, c)];
const plant = (pot, h, leaf) => [cyl(0.5, 0.5, 0.26, 0, pot, '#C77B4A'), cyl(0.5, 0.5, 0.36, pot, h, leaf), cyl(0.42, 0.46, 0.22, h - 6, h + 4, shade(leaf, 0.15))];

const SHAPES = {
  T142: () => table(1, 1, 22, WOOD), T143: () => table(1, 1, 24, '#C8D6E0'), T149: () => table(2, 1, 22, WOOD),
  T083: () => [...table(2, 1, 24, '#C8D6E0'), box(0.2, 0.3, 0.6, 0.6, 12, 16, '#3C8CE8'), box(1.2, 0.3, 0.6, 0.6, 12, 16, '#FFCD1F')],
  T145: () => table(2, 1, 22, '#E6D3B0'), T107: () => [...legs(2, 2, 17), box(0.02, 0.02, 1.96, 1.96, 17, 20, '#F2C66D')],
  T089: () => [cyl(1, 1, 0.12, 0, 21, LEG), cyl(0.7, 0.8, 0.62, 21, 24, '#BFE3F0'), cyl(1.3, 1.1, 0.6, 21, 24, '#BFE3F0'), cyl(1, 1.3, 0.55, 21, 24, '#BFE3F0')],
  T030: () => table(2, 1, 32, LAVA), T113: () => [...table(2, 1, 26, WOOD), box(0, 0, 0.08, 1, 0, 40, WOOD), box(1.92, 0, 0.08, 1, 0, 40, WOOD), box(0.08, 0, 1.84, 0.08, 26, 40, '#B9A889')],
  T052: () => [box(0.08, 0.1, 0.84, 0.8, 2, 32, '#8A6E4B'), ...caddy(1, 1, 32, '#8A6E4B', 3, 1), box(0, 0, 1, 1, 32, 36, LAVA)],
  T112: () => [...legs(3, 1, 23), box(0, 0, 3, 1, 23, 26, '#8A6E4B'), box(2.1, 1, 0.08, 0.08, 0, 23, LEG), box(2, 1, 1, 1, 23, 26, '#8A6E4B')],
  H059: () => chair(1, 1, 26, '#4C34E5'), H060: () => chair(1, 1, 30, '#272A24', '#9AA3A8'),
  H061: () => [...legs(1, 1, 27, '#3C6CE8', 0.06, 0.2), box(0.18, 0.18, 0.64, 0.64, 27, 31, '#3C6CE8')],
  H016: () => stool(15, '#00BC74'), H013: () => [cyl(0.5, 0.5, 0.32, 0, 18, '#7C6CD6')],
  H002: () => [cyl(0.5, 0.5, 0.34, 0, 10, '#FF6D3A'), cyl(0.5, 0.5, 0.22, 10, 12, shade('#FF6D3A', 0.15))],
  M015: () => [box(0.3, 0.42, 0.12, 0.16, 0, 2, LEG), box(0.58, 0.42, 0.12, 0.16, 0, 2, LEG), box(0.08, 0.25, 0.84, 0.5, 2, 4, '#FFCD1F')],
  H023: () => lounge(1, 1, 28, '#7C6CD6'), H024: () => lounge(2, 1, 28, '#7C6CD6'), H035: () => lounge(1, 1, 30, '#9B8BD6', true),
  H007: () => [cyl(0.5, 0.5, 0.36, 0, 11, '#F7A1C4')], H048: () => [box(0.14, 0.14, 0.72, 0.72, 0, 14, '#6BE7BE')],
  H003: () => [cyl(0.5, 0.5, 0.38, 0, 11, '#C0ADFF')],
  H051: () => [cyl(1, 1, 0.82, 0, 8, '#E8B4A0'), cyl(1, 1, 0.82, 8, 12, shade('#E8B4A0', 0.1))],
  H047: () => [box(0.05, 0.05, 1.9, 1.9, 0, 8, '#FF9A76')],
  C044: () => [box(0.2, 0.2, 2, 0.75, 0, 9, '#7DBE5A'), box(0.3, 1.2, 2, 0.75, 0, 14, '#6BAA48'), cyl(2.4, 0.7, 0.55, 0, 14, '#8FD06A'), cyl(2.3, 2.3, 0.55, 0, 14, '#8FD06A')],
  rug: () => [box(0.04, 0.04, 1.92, 1.92, 0, 1, '#E8C9A0'), box(0.2, 0.2, 1.6, 1.6, 1, 1.5, '#D9A97A')],
  M002: () => [...pod(2, 1, 66, '#C0ADFF', '#7C6CD6', false), box(0.1, 0.12, 0.5, 0.3, 14, 44, '#A67C52'), box(1.4, 0.12, 0.5, 0.3, 14, 44, '#A67C52')],
  H052: () => pod(3, 1, 64, '#4C34E5', '#C0ADFF'), M016: () => pod(2, 2, 64, '#00BC74', '#C8F2DE'),
  M014: () => [...pod(3, 3, 64, '#F2D49B', '#FF9A76', false), box(-0.05, -0.05, 3.1, 1.6, 64, 72, '#E8B4A0'), box(-0.05, 1.45, 3.1, 1.6, 64, 70, shade('#E8B4A0', -0.1))],
  M018: () => [box(0, 0, 2, 0.12, 0, 42, '#6BE7BE'), box(0, 0, 0.12, 2, 0, 42, '#6BE7BE'), box(0, 0, 2, 2, 38, 42, '#6BE7BE'), box(0.15, 0.15, 1.8, 1.8, 0, 8, '#FF9A76')],
  T080: () => [...table(1, 1, 22, '#FFCD1F'), box(0, 0, 1, 0.08, 22, 34, '#FFCD1F'), box(0, 0, 0.08, 1, 22, 34, '#FFCD1F'), box(0.92, 0, 0.08, 1, 22, 34, '#FFCD1F')],
  T003: () => [...table(2, 2, 22, '#FF6D3A'), box(0.3, 0.3, 0.6, 1.4, 20, 23, '#8FD3F4'), box(1.1, 0.3, 0.6, 1.4, 20, 23, '#E8C9A0')],
  M006: () => panel(2, 1, 28, '#8C9A9B'), panel: () => panel(2, 1, 52, '#6E7F80'),
  M003: () => [...panel(1, 1, 57, '#FFFFFF', 18)], timetable: () => panel(1, 1, 46, '#00BC74', 16),
  S009: () => shelves(2, 1, 34, '#A67C52', 3, true), S004: () => shelves(2, 1, 34, '#C9A06B', 3, true),
  S015: () => shelves(2, 1, 31, '#E6D3B0', 3, false), C084: () => caddy(1, 1, 24, '#3C8CE8', 3, 2), C140: () => shelves(3, 1, 32, '#B8C4CF', 2, false),
  S017: () => [box(0.05, 0.1, 0.9, 0.8, 0, 30, '#6B8E23'), cyl(0.5, 0.5, 0.36, 30, 46, '#2FA36B'), cyl(0.4, 0.45, 0.24, 40, 50, '#4CC487')],
  lamp: () => [cyl(0.5, 0.5, 0.2, 0, 2, LEG), cyl(0.5, 0.5, 0.03, 2, 40, LEG), cyl(0.5, 0.5, 0.2, 40, 52, '#FFE89A')],
  bubble: () => [cyl(0.5, 0.5, 0.26, 0, 6, '#9AA3A8'), cyl(0.5, 0.5, 0.18, 6, 56, '#8FE8D0')],
  weighted: () => [cyl(0.5, 0.5, 0.32, 0, 14, '#C9A06B'), cyl(0.5, 0.5, 0.26, 14, 16, '#9B8BD6')],
  fidget: () => [cyl(0.5, 0.5, 0.28, 0, 12, '#FFCD1F')],
  plant: () => plant(10, 26, '#00BC74'), bigplant: () => plant(16, 56, '#0A9B60'),
  pet: () => [box(0.1, 0.15, 0.8, 0.7, 0, 16, '#8A6E4B'), { ...box(0.12, 0.18, 0.76, 0.64, 16, 34, '#8FD3F4'), alpha: 0.75 }],
  lego: () => [...table(2, 2, 18, '#E8E8E8'), box(0.4, 0.4, 0.3, 0.2, 18, 22, '#E84A3C'), box(1.1, 0.6, 0.2, 0.4, 18, 24, '#3C8CE8'), box(0.7, 1.2, 0.4, 0.2, 18, 21, '#FFCD1F')],
  toybox: () => [box(0.1, 0.15, 0.8, 0.7, 0, 16, '#3C8CE8'), box(0.08, 0.13, 0.84, 0.74, 16, 18, shade('#3C8CE8', 0.2))],
  headphones: () => [...table(1, 1, 20, '#272A24')],
};

export const hasShape = id => id in SHAPES;

// Local rect -> room rect for item rotation r (90° clockwise steps).
function rot(p, W, D, r) {
  switch (r) {
    case 1: return { x: D - (p.v + (p.t === 'cyl' ? 0 : p.d)), y: p.u, w: p.d, d: p.w };
    case 2: return { x: W - (p.u + (p.t === 'cyl' ? 0 : p.w)), y: D - (p.v + (p.t === 'cyl' ? 0 : p.d)), w: p.w, d: p.d };
    case 3: return { x: p.v, y: W - (p.u + (p.t === 'cyl' ? 0 : p.w)), w: p.d, d: p.w };
    default: return { x: p.u, y: p.v, w: p.w, d: p.d };
  }
}

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

export function drawShape(ctx, cam, room, view, it, def) {
  const W = def.w, D = def.d;
  const parts = SHAPES[it.id]().map(p => {
    const rr = rot(p, W, D, it.rot % 4);
    const v = p.t === 'cyl'
      ? rectToView(room, view, it.x + rr.x, it.y + rr.y, 0, 0)
      : rectToView(room, view, it.x + rr.x, it.y + rr.y, rr.w, rr.d);
    return { ...p, vr: v, depth: v.x + v.y + (v.w + v.d) / 2 + (p.t === 'cyl' ? p.r : 0) };
  });
  parts.sort((a, b) => a.depth - b.depth || a.z0 - b.z0);
  for (const p of parts) {
    ctx.globalAlpha = p.alpha ?? ctx.globalAlpha;
    if (p.t === 'cyl') drawCyl(ctx, cam, p);
    else drawBox(ctx, cam, p);
  }
}

function drawBox(ctx, cam, p) {
  const r = p.vr, P = (x, y, z) => project(cam, x, y, z);
  poly(ctx, [P(r.x, r.y + r.d, p.z0), P(r.x + r.w, r.y + r.d, p.z0), P(r.x + r.w, r.y + r.d, p.z1), P(r.x, r.y + r.d, p.z1)], shade(p.c, -0.16));
  poly(ctx, [P(r.x + r.w, r.y, p.z0), P(r.x + r.w, r.y + r.d, p.z0), P(r.x + r.w, r.y + r.d, p.z1), P(r.x + r.w, r.y, p.z1)], shade(p.c, -0.3));
  poly(ctx, [P(r.x, r.y, p.z1), P(r.x + r.w, r.y, p.z1), P(r.x + r.w, r.y + r.d, p.z1), P(r.x, r.y + r.d, p.z1)], shade(p.c, 0.1), 'rgba(0,0,0,0.1)');
}

function drawCyl(ctx, cam, p) {
  const c0 = project(cam, p.vr.x, p.vr.y, p.z0), c1 = project(cam, p.vr.x, p.vr.y, p.z1);
  const rx = p.r * Math.SQRT2 * (TW / 2) * cam.zoom, ry = p.r * Math.SQRT2 * (TH / 2) * cam.zoom;
  ctx.fillStyle = shade(p.c, -0.22);
  ctx.beginPath(); ctx.ellipse(c0.x, c0.y, rx, ry, 0, 0, Math.PI); ctx.lineTo(c1.x - rx, c1.y); ctx.ellipse(c1.x, c1.y, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(p.c, 0.1);
  ctx.beginPath(); ctx.ellipse(c1.x, c1.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.stroke();
}

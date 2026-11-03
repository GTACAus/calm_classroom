// Isometric maths + drawing. The world rotates in 90° steps only (view 0..3), so each item
// needs at most 4 pre-rendered sprite facings — no 3D meshes. Until sprites exist, items are
// drawn as shaded boxes with an emoji label.

import { ITEM_BY_ID, WALL_COLOURS, LIGHT_TYPES } from './catalog.js';
import { footprint } from './scoring.js';
import { drawShape, hasShape } from './shapes.js';

export const TW = 64, TH = 32, WALL_H = 72;

// Optional sprite atlas: SPRITES[itemId][facing] = { img, ax, ay } (anchor = front-bottom corner
// of the footprint, in image px at zoom 1). Populated in v4 from pre-rendered PNGs.
export const SPRITES = {};

// ---- view rotation ------------------------------------------------------------

export function viewDims(room, view) {
  return view % 2 ? { vc: room.rows, vr: room.cols } : { vc: room.cols, vr: room.rows };
}

// Room grid point -> view grid point.
export function toView(room, view, x, y) {
  const { cols, rows } = room;
  switch (view) {
    case 1: return { x: rows - y, y: x };
    case 2: return { x: cols - x, y: rows - y };
    case 3: return { x: y, y: cols - x };
    default: return { x, y };
  }
}

// View grid point -> room grid point.
export function fromView(room, view, vx, vy) {
  const { cols, rows } = room;
  switch (view) {
    case 1: return { x: vy, y: rows - vx };
    case 2: return { x: cols - vx, y: rows - vy };
    case 3: return { x: cols - vy, y: vx };
    default: return { x: vx, y: vy };
  }
}

// Room rect -> view rect.
export function rectToView(room, view, x, y, w, d) {
  const a = toView(room, view, x, y), b = toView(room, view, x + w, y + d);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), d: Math.abs(b.y - a.y) };
}

// ---- projection ---------------------------------------------------------------

export function project(cam, vx, vy, h = 0) {
  return {
    x: cam.ox + (vx - vy) * (TW / 2) * cam.zoom,
    y: cam.oy + (vx + vy) * (TH / 2) * cam.zoom - h * cam.zoom,
  };
}

export function unproject(cam, sx, sy) {
  const a = (sx - cam.ox) / ((TW / 2) * cam.zoom);
  const b = (sy - cam.oy) / ((TH / 2) * cam.zoom);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// Fit the whole room (with walls) into a w×h viewport, leaving `top`/`bottom` px for overlays.
export function fitCamera(room, view, w, h, top = 0, bottom = 0) {
  const { vc, vr } = viewDims(room, view);
  const worldW = (vc + vr) * TW / 2, worldH = (vc + vr) * TH / 2 + WALL_H;
  const ah = Math.max(120, h - top - bottom);
  const zoom = Math.min(3, (w - 24) / worldW, (ah - 16) / worldH);
  const ox = w / 2 - ((vc - vr) * TW / 4) * zoom;
  const oy = top + ah / 2 - ((vc + vr) * TH / 4) * zoom + (WALL_H / 2) * zoom;
  return { ox, oy, zoom };
}

// ---- colour helpers -----------------------------------------------------------

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

// ---- room ---------------------------------------------------------------------

// Room walls in room coords: N (y=0), W (x=0), S (y=rows), E (x=cols).
function roomWalls(room) {
  const { cols, rows } = room;
  return {
    N: [{ x: 0, y: 0 }, { x: cols, y: 0 }],
    W: [{ x: 0, y: 0 }, { x: 0, y: rows }],
    S: [{ x: 0, y: rows }, { x: cols, y: rows }],
    E: [{ x: cols, y: 0 }, { x: cols, y: rows }],
  };
}

export function drawRoom(ctx, cam, room, view) {
  const { vc, vr } = viewDims(room, view);
  const wall = WALL_COLOURS.find(w => w.id === room.wall);

  // Floor tiles.
  for (let vy = 0; vy < vr; vy++) for (let vx = 0; vx < vc; vx++) {
    const pts = [project(cam, vx, vy), project(cam, vx + 1, vy), project(cam, vx + 1, vy + 1), project(cam, vx, vy + 1)];
    poly(ctx, pts, (vx + vy) % 2 ? '#E9E1C8' : '#EFE8D2', 'rgba(39,42,36,0.08)');
  }

  // Doormat on the entrance tile.
  const dm = rectToView(room, view, 0, room.door, 1, 1);
  poly(ctx, [project(cam, dm.x + .1, dm.y + .1), project(cam, dm.x + .9, dm.y + .1),
    project(cam, dm.x + .9, dm.y + .9), project(cam, dm.x + .1, dm.y + .9)], '#00BC74');

  // Back walls are the ones lying on view x=0 or view y=0.
  const walls = roomWalls(room);
  for (const [side, [a, b]] of Object.entries(walls)) {
    const va = toView(room, view, a.x, a.y), vb = toView(room, view, b.x, b.y);
    const back = (va.y === 0 && vb.y === 0) || (va.x === 0 && vb.x === 0);
    const onX = va.x === 0 && vb.x === 0; // left-hand back wall, darker
    const len = Math.hypot(vb.x - va.x, vb.y - va.y);
    const at = (t, h) => project(cam, va.x + (vb.x - va.x) * t / len, va.y + (vb.y - va.y) * t / len, h);
    if (!back) {
      // Front walls are cut away; show a low skirting so the room edge reads.
      poly(ctx, [at(0, 0), at(len, 0), at(len, 6), at(0, 6)], shade(wall.color, -0.25));
      continue;
    }
    poly(ctx, [at(0, 0), at(len, 0), at(len, WALL_H), at(0, WALL_H)], shade(wall.color, onX ? -0.12 : 0), 'rgba(0,0,0,0.15)');
    poly(ctx, [at(0, WALL_H), at(len, WALL_H), at(len, WALL_H + 4), at(0, WALL_H + 4)], shade(wall.color, -0.35));

    for (const f of room.features.filter(f => f.side === side)) {
      if (f.type === 'window') {
        poly(ctx, [at(f.at + .12, 22), at(f.at + f.len - .12, 22), at(f.at + f.len - .12, 62), at(f.at + .12, 62)], '#BFE6F7', '#7FA9BA');
        poly(ctx, [at(f.at + f.len / 2, 22), at(f.at + f.len / 2 + .02, 22), at(f.at + f.len / 2 + .02, 62), at(f.at + f.len / 2, 62)], '#7FA9BA');
      } else if (f.type === 'door') {
        poly(ctx, [at(f.at + .1, 0), at(f.at + .9, 0), at(f.at + .9, 56), at(f.at + .1, 56)], '#6B4F33', '#3E2C1B');
      }
    }
  }
}

// Outline polygon of a box in view space (used for drawing hit areas).
export function boxHull(cam, r, h) {
  return [
    project(cam, r.x, r.y, h), project(cam, r.x + r.w, r.y, h), project(cam, r.x + r.w, r.y, 0),
    project(cam, r.x + r.w, r.y + r.d, 0), project(cam, r.x, r.y + r.d, 0), project(cam, r.x, r.y + r.d, h),
  ];
}

export function itemViewRect(room, view, it) {
  const f = footprint(it);
  return rectToView(room, view, it.x, it.y, f.w, f.d);
}

export function drawItem(ctx, cam, room, view, it, { alpha = 1, selected = false, tint = null } = {}) {
  const def = ITEM_BY_ID[it.id];
  const r0 = itemViewRect(room, view, it);
  const inset = def.tags.includes('floor') ? 0.04 : 0.1;
  const r = { x: r0.x + inset, y: r0.y + inset, w: r0.w - inset * 2, d: r0.d - inset * 2 };
  const h = def.h;
  ctx.save();
  ctx.globalAlpha = alpha;

  const sprite = SPRITES[it.id]?.[(it.rot + view) % 4];
  if (sprite) {
    const p = project(cam, r0.x, r0.y + r0.d);
    ctx.drawImage(sprite.img, p.x - sprite.ax * cam.zoom, p.y - sprite.ay * cam.zoom,
      sprite.img.width * cam.zoom, sprite.img.height * cam.zoom);
  } else if (hasShape(it.id) && !tint) {
    drawShape(ctx, cam, room, view, it, def);
    if (it.id === 'headphones' || it.id === 'fidget' || it.id === 'pet') {
      const top = project(cam, r.x + r.w / 2, r.y + r.d / 2, h);
      ctx.font = `${Math.round(16 * cam.zoom)}px system-ui, "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, top.x, top.y);
    }
  } else {
    const c = tint || def.color;
    // Left face (along view y+d), right face (along view x+w), then top.
    poly(ctx, [project(cam, r.x, r.y + r.d, 0), project(cam, r.x + r.w, r.y + r.d, 0),
      project(cam, r.x + r.w, r.y + r.d, h), project(cam, r.x, r.y + r.d, h)], shade(c, -0.18));
    poly(ctx, [project(cam, r.x + r.w, r.y, 0), project(cam, r.x + r.w, r.y + r.d, 0),
      project(cam, r.x + r.w, r.y + r.d, h), project(cam, r.x + r.w, r.y, h)], shade(c, -0.32));
    poly(ctx, [project(cam, r.x, r.y, h), project(cam, r.x + r.w, r.y, h),
      project(cam, r.x + r.w, r.y + r.d, h), project(cam, r.x, r.y + r.d, h)], shade(c, 0.12), 'rgba(0,0,0,0.12)');
    if (def.icon) {
      const top = project(cam, r.x + r.w / 2, r.y + r.d / 2, h);
      ctx.font = `${Math.round(18 * cam.zoom * Math.min(1.6, Math.max(1, (r.w + r.d) / 2)))}px system-ui, "Apple Color Emoji", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, top.x, top.y);
    }
  }
  if (selected) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    poly(ctx, boxHull(cam, r, h), null, '#4C34E5');
    ctx.lineWidth = 1;
  }
  ctx.restore();
}

// Footprint highlight under a dragged item.
export function drawFootprint(ctx, cam, room, view, it, ok) {
  const r = itemViewRect(room, view, it);
  poly(ctx, [project(cam, r.x, r.y), project(cam, r.x + r.w, r.y), project(cam, r.x + r.w, r.y + r.d), project(cam, r.x, r.y + r.d)],
    ok ? 'rgba(0,188,116,0.35)' : 'rgba(255,109,58,0.45)', ok ? '#00BC74' : '#FF6D3A');
}

// Room-wide lighting overlay: darkness by level, colour by light type, glow around lamps.
export function drawLighting(ctx, cam, room, view, lampItems) {
  const { vc, vr } = viewDims(room, view);
  const light = LIGHT_TYPES.find(l => l.id === room.light.type);
  const hull = [project(cam, 0, vr), project(cam, 0, vr, WALL_H + 4), project(cam, 0, 0, WALL_H + 4),
    project(cam, vc, 0, WALL_H + 4), project(cam, vc, 0), project(cam, vc, vr)];
  ctx.save();
  poly(ctx, hull);
  ctx.clip();
  const dark = (1 - room.light.level / 100) * 0.55;
  ctx.fillStyle = `rgba(20,18,40,${dark})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = light.warm > 0.6 ? 'rgba(255,170,60,0.10)' : light.flicker ? 'rgba(170,210,255,0.12)' : 'rgba(255,255,240,0.05)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  for (const it of lampItems) {
    const r = itemViewRect(room, view, it);
    const p = project(cam, r.x + r.w / 2, r.y + r.d / 2, 10);
    const rad = 110 * cam.zoom;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
    g.addColorStop(0, `rgba(255,214,120,${0.2 + dark * 0.5})`);
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
  }
  ctx.restore();
}

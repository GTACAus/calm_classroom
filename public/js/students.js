// "Release" simulation: students walk in from the door, react to what they pass, and settle
// in the spot their traits prefer. Students are drawn procedurally for now; STUDENT_SPRITES
// is the hook for pre-rendered sheets (4 directions × walk frames) later.

import { ITEM_BY_ID } from './catalog.js';
import { footprint, STUDENTS, PRINCIPLE_TEXT } from './scoring.js';
import { toView, project } from './iso.js';

export const STUDENT_SPRITES = {};

const SPEED = 2.2;          // tiles per second
const ENTRY_GAP = 0.9;      // seconds between students entering
const CLASSMATES = 8;
const SKIN = ['#F2C9A0', '#D9A066', '#A8703F', '#7A4A26', '#E8B48A', '#C68A5A'];
const HAIR = ['#2B1B10', '#5A3A1E', '#C9A04A', '#1A1A1A', '#8A3B1E', '#3E2C1B'];
const SHIRTS = ['#B8C4CF', '#D9C7A3', '#9FB7A8', '#C9B6A6', '#A9A9C9', '#CFC3A0'];

const tagsOf = it => ITEM_BY_ID[it.id].tags;
const has = (it, t) => tagsOf(it).includes(t);
const centre = it => { const f = footprint(it); return { x: it.x + f.w / 2, y: it.y + f.d / 2 }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Things each trait notices on the way in: [predicate, text, good?]
const NOTICES = {
  move: [
    [it => has(it, 'fidget'), '🌀 Fidgets! Yes!', true],
    [it => has(it, 'movement'), '⚡ I can move on that!', true],
    [it => has(it, 'toys'), '🧱 Ooh… can I play instead?', false],
  ],
  calm: [
    [it => has(it, 'loud'), '😖 That area is too noisy', false],
    [it => has(it, 'escape'), '🏕️ A safe space!', true],
    [it => has(it, 'predictable'), '🗓️ Good, I can see the plan', true],
  ],
  both: [
    [it => has(it, 'movement') || has(it, 'fidget'), '⚡ Let me move first…', true],
    [it => has(it, 'escape'), '🌙 Somewhere to recharge after', true],
  ],
  read: [
    [it => has(it, 'books'), '📚 A reading spot!', true],
    [it => has(it, 'lamp'), '💡 Nice soft light', true],
    [it => has(it, 'clutter'), '😵 So much to look at', false],
  ],
};

// How much a trait wants to settle in a given seat item.
function seatScore(trait, it, ctx) {
  const c = centre(it);
  const loudNear = ctx.loud.filter(l => dist(centre(l), c) < 3).length;
  const nearDoor = dist(c, ctx.door) < 3;
  const nearWindow = c.y < 1.5;
  const lampNear = ctx.lamps.some(l => dist(centre(l), c) < 3);
  let s = 1;
  switch (trait) {
    case 'move':
      s += has(it, 'movement') ? 5 : 0;
      s += ctx.fidget.some(f => dist(centre(f), c) < 2.5) ? 2 : 0;
      s -= (nearDoor ? 2 : 0) + (nearWindow ? 1 : 0);
      break;
    case 'calm': case 'both':
      s += (has(it, 'escape') ? 6 : 0) + (has(it, 'quiet') ? 4 : 0) + (has(it, 'soft') ? 2 : 0);
      s -= loudNear * 3 + (nearDoor ? 2 : 0);
      break;
    case 'read':
      s += (has(it, 'books') ? 5 : 0) + (lampNear ? 2 : 0) + (has(it, 'quiet') ? 1 : 0);
      s -= loudNear * 2 + (has(it, 'clutter') ? 1 : 0);
      break;
    default:
      s += (tagsOf(it).includes('seat:chair') ? 2 : 0) + (ctx.desks.some(d => dist(centre(d), c) < 1.6) ? 1 : 0);
  }
  return s;
}


function seatSlots(room) {
  const slots = [];
  for (const it of room.items) {
    const seatTag = tagsOf(it).find(t => t.startsWith('seat:'));
    if (!seatTag) continue;
    const n = ITEM_BY_ID[it.id].seats || 1;
    const f = footprint(it);
    const def = ITEM_BY_ID[it.id];
    const elev = has(it, 'quiet') || seatTag === 'seat:standing' ? 2 : Math.min(def.h * 0.7, 16);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const pos = f.w >= f.d ? { x: it.x + f.w * t, y: it.y + f.d / 2 } : { x: it.x + f.w / 2, y: it.y + f.d * t };
      slots.push({ item: it, pos, elev, taken: false });
    }
  }
  return slots;
}

// ---- grid + paths ---------------------------------------------------------------

function blockedGrid(room) {
  const g = Array.from({ length: room.rows }, () => new Array(room.cols).fill(false));
  for (const it of room.items) {
    if (has(it, 'floor')) continue;
    const f = footprint(it);
    for (let y = it.y; y < it.y + f.d; y++) for (let x = it.x; x < it.x + f.w; x++) g[y][x] = true;
  }
  return g;
}

// Breadth-first search from one tile: distances + parents for every reachable tile.
function bfs(room, grid, sx, sy) {
  const key = (x, y) => y * room.cols + x;
  const prev = new Map([[key(sx, sy), null]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= room.cols || ny >= room.rows || grid[ny][nx] || prev.has(k)) continue;
      prev.set(k, key(x, y)); q.push([nx, ny]);
    }
  }
  return {
    reach: (x, y) => prev.has(key(x, y)),
    path(x, y) {
      const out = [];
      for (let k = key(x, y); k !== null && k !== undefined; k = prev.get(k)) out.push({ x: k % room.cols + 0.5, y: Math.floor(k / room.cols) + 0.5 });
      return out.reverse();
    },
    len(x, y) { let n = 0; for (let k = key(x, y); prev.get(k) != null; k = prev.get(k)) n++; return n; },
  };
}

// Closest reachable free tile next to an item's footprint.
function approach(room, search, it) {
  const f = footprint(it);
  let best = null;
  for (let y = it.y - 1; y <= it.y + f.d; y++) for (let x = it.x - 1; x <= it.x + f.w; x++) {
    const edge = (x === it.x - 1 || x === it.x + f.w) !== (y === it.y - 1 || y === it.y + f.d); // sides, not corners
    if (!edge || !search.reach(x, y)) continue;
    const l = search.len(x, y);
    if (!best || l < best.l) best = { x, y, l };
  }
  return best;
}

// ---- setup ----------------------------------------------------------------------

export function createSim(room, result) {
  const grid = blockedGrid(room);
  const door = { x: 0.5, y: room.door + 0.5 };
  const ctx = {
    door,
    loud: room.items.filter(i => has(i, 'loud')),
    lamps: room.items.filter(i => has(i, 'lamp')),
    fidget: room.items.filter(i => has(i, 'fidget')),
    desks: room.items.filter(i => has(i, 'desk')),
  };
  const fromDoor = bfs(room, grid, 0, room.door);
  const slots = seatSlots(room).filter(s => approach(room, fromDoor, s.item));

  const agents = [];
  const named = STUDENTS.map((st, i) => ({
    id: st.id, name: st.name, trait: st.trait, emoji: st.emoji, color: st.color, named: true,
    skin: SKIN[i % SKIN.length], hair: HAIR[(i + 2) % HAIR.length],
    result: result.students.find(r => r.id === st.id),
  }));
  const extras = Array.from({ length: CLASSMATES }, (_, i) => ({
    id: 'c' + i, name: '', trait: '', named: false, color: SHIRTS[i % SHIRTS.length],
    skin: SKIN[(i + 3) % SKIN.length], hair: HAIR[i % HAIR.length],
  }));

  // Named students pick first, in roster order; classmates take what's left.
  let order = 0;
  for (const s of [...named, ...extras]) {
    const traitKey = s.named ? s.id : 'class';
    const plan = [];
    if (s.id === 'both') {
      // Burn energy at a movement item first, then retreat somewhere calm.
      const mover = room.items.filter(i => has(i, 'movement') || has(i, 'fidget'))
        .sort((a, b) => dist(centre(a), door) - dist(centre(b), door)).find(i => approach(room, fromDoor, i));
      if (mover) plan.push({ kind: 'visit', item: mover, dwell: 2.2, say: '⚡ Moving helps me focus' });
    }
    const free = slots.filter(sl => !sl.taken);
    free.sort((a, b) => seatScore(traitKey, b.item, ctx) - seatScore(traitKey, a.item, ctx));
    if (free[0]) { free[0].taken = true; plan.push({ kind: 'seat', slot: free[0] }); }
    else plan.push({ kind: 'stand' });

    agents.push({
      ...s, plan, stage: -1,
      pos: { x: -0.6, y: room.door + 0.5 }, elev: 0, path: [], phase: 0, facing: 1,
      state: 'waiting', delay: order++ * ENTRY_GAP, wait: 0,
      noticed: new Set(), bubble: null, status: 'Waiting outside', settled: false,
    });
  }
  return { room, grid, fromDoor, agents, t: 0, settledAt: null, ctx, result };
}

function say(a, text, sim, good = true, secs = 2.6) {
  a.bubble = { text, until: sim.t + secs, good };
}

function nextStage(a, sim) {
  a.stage++;
  const step = a.plan[a.stage];
  const tile = { x: Math.floor(a.pos.x), y: Math.floor(a.pos.y) };
  const search = a.stage === 0 ? sim.fromDoor : bfs(sim.room, sim.grid, tile.x, tile.y);
  if (!step) return settle(a, sim);

  if (step.kind === 'stand') {
    // No seat left: wander to a free spot and complain.
    const spots = [];
    for (let y = 0; y < sim.room.rows; y++) for (let x = 0; x < sim.room.cols; x++) {
      if (search.reach(x, y) && !(x === 0 && y === sim.room.door)) spots.push({ x, y });
    }
    const pick = spots[Math.floor(Math.random() * spots.length)];
    if (!pick) { a.state = 'stuck'; a.status = 'Can’t get in!'; say(a, '😕 The doorway is blocked!', sim, false, 4); return settle(a, sim); }
    a.path = search.path(pick.x, pick.y);
    a.state = 'walking'; a.status = 'Looking for a seat…';
    return;
  }
  const item = step.kind === 'seat' ? step.slot.item : step.item;
  const ap = approach(sim.room, search, item);
  if (!ap) { a.state = 'stuck'; a.status = 'Can’t get in!'; say(a, '😕 I can’t get to anywhere!', sim, false, 4); return settle(a, sim); }
  a.path = search.path(ap.x, ap.y);
  if (step.kind === 'seat') a.path.push({ ...step.slot.pos, sit: step.slot.elev });
  a.state = 'walking';
  a.status = step.kind === 'seat' ? `Heading to: ${ITEM_BY_ID[item.id].name}` : `Off to: ${ITEM_BY_ID[item.id].name}`;
}

function settle(a, sim) {
  a.settled = true;
  const step = a.plan[a.plan.length - 1];
  if (!a.named) {
    if (step?.kind === 'stand') {
      const standing = sim.agents.filter(o => !o.named && o.plan.at(-1)?.kind === 'stand' && o.settled).length;
      if (standing <= 2) say(a, '😕 No seat for me', sim, false, 4);
    }
    a.state = step?.kind === 'seat' ? 'sitting' : 'standing';
    return;
  }
  const stuck = a.state === 'stuck';
  if (!stuck) a.state = step?.kind === 'seat' ? 'sitting' : 'standing';
  const r = a.result;
  const pick = r.score < 60 ? r.dislikes[0] : r.likes[0] || r.dislikes[0];
  if (pick && !stuck) {
    const good = r.score >= 60 && r.likes[0] === pick;
    say(a, `${r.mood} ${PRINCIPLE_TEXT[pick.key][good ? 0 : 1]}`, sim, good, 5);
  }
  a.status = `${r.mood} ${r.score}/100`;
}

// ---- update ---------------------------------------------------------------------

export function stepSim(sim, dt) {
  sim.t += dt;
  for (const a of sim.agents) {
    if (a.bubble && sim.t > a.bubble.until) a.bubble = null;
    if (a.state === 'waiting') {
      if (sim.t >= a.delay) { a.path = [{ x: 0.5, y: sim.room.door + 0.5 }]; a.state = 'entering'; a.status = 'Coming in'; }
      continue;
    }
    if (a.state === 'dwell') {
      if ((a.wait -= dt) <= 0) nextStage(a, sim);
      continue;
    }
    if (a.state !== 'walking' && a.state !== 'entering') continue;

    const tgt = a.path[0];
    if (!tgt) { arrive(a, sim); continue; }
    const dx = tgt.x - a.pos.x, dy = tgt.y - a.pos.y, d = Math.hypot(dx, dy);
    const stepLen = SPEED * dt;
    const before = { ...a.pos };
    if (d <= stepLen) { a.pos = { x: tgt.x, y: tgt.y }; a.path.shift(); if (tgt.sit !== undefined) a.elev = tgt.sit; }
    else { a.pos.x += dx / d * stepLen; a.pos.y += dy / d * stepLen; }
    a.phase += dt * 12;
    a.move = { x: a.pos.x - before.x, y: a.pos.y - before.y };

    if (a.named) notice(a, sim);
  }
  const allDone = sim.agents.every(a => a.settled);
  if (allDone && sim.settledAt === null) sim.settledAt = sim.t;
}

function arrive(a, sim) {
  if (a.state === 'entering') {
    if (a.named) {
      const light = a.result.parts.find(p => p.key === 'lighting');
      if (light && light.value < 0.5) say(a, '😣 These lights hurt my eyes', sim, false);
    }
    return nextStage(a, sim);
  }
  const step = a.plan[a.stage];
  if (step?.kind === 'visit') {
    a.state = 'dwell'; a.wait = step.dwell; a.status = 'Moving to focus';
    say(a, step.say, sim, true, step.dwell);
    return;
  }
  if (a.stage < a.plan.length - 1) return nextStage(a, sim);
  settle(a, sim);
}

function notice(a, sim) {
  if (a.bubble && sim.t < a.bubble.until - 1.2) return; // let the current bubble be read
  for (const it of sim.room.items) {
    if (a.noticed.has(it.uid) || dist(centre(it), a.pos) > 1.8) continue;
    for (const [pred, text, good] of NOTICES[a.id] || []) {
      if (!pred(it)) continue;
      a.noticed.add(it.uid);
      if (a.lastText === text) continue; // don't repeat for a second identical item
      a.lastText = text;
      say(a, text, sim, good, 2.2);
      return;
    }
  }
  // Distracted by the windows (the student who is always moving).
  if (a.id === 'move' && a.pos.y < 1.4 && !a.noticed.has('window')) {
    a.noticed.add('window'); say(a, '👀 What’s happening outside?', sim, false, 2);
  }
}

// ---- drawing --------------------------------------------------------------------

export function agentDepth(sim, view, a) {
  const v = toView(sim.room, view, a.pos.x, a.pos.y);
  return v.x + v.y + (a.elev ? 0.6 : 0.05);
}

function screenPos(cam, sim, view, a, h = 0) {
  const v = toView(sim.room, view, a.pos.x, a.pos.y);
  return project(cam, v.x, v.y, h);
}

export function drawAgent(ctx, cam, sim, view, a) {
  if (a.state === 'waiting') return;
  const z = cam.zoom * 1.25;
  const ground = screenPos(cam, sim, view, a, a.elev);
  const walking = a.state === 'walking' || a.state === 'entering';
  const sitting = a.state === 'sitting' && a.elev > 2;
  const bob = walking ? Math.abs(Math.sin(a.phase)) * 2 * z : 0;
  // Facing the camera if moving down-screen (or settled).
  let front = true;
  if (walking && a.move) {
    const p0 = toView(sim.room, view, 0, 0), p1 = toView(sim.room, view, a.move.x, a.move.y);
    front = (p1.x - p0.x) + (p1.y - p0.y) >= 0;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(ground.x, ground.y, 7 * z, 3.5 * z, 0, 0, Math.PI * 2); ctx.fill();

  const legH = sitting ? 2 * z : 7 * z;
  const hip = ground.y - legH - bob;
  ctx.strokeStyle = '#272A24'; ctx.lineWidth = 2.6 * z; ctx.lineCap = 'round';
  const swing = walking ? Math.sin(a.phase) * 3 * z : 0;
  ctx.beginPath();
  ctx.moveTo(ground.x - 2.5 * z, hip); ctx.lineTo(ground.x - 2.5 * z + swing, ground.y - bob * 0.3);
  ctx.moveTo(ground.x + 2.5 * z, hip); ctx.lineTo(ground.x + 2.5 * z - swing, ground.y - bob * 0.3);
  ctx.stroke();

  const bodyH = 13 * z, bodyW = 12 * z;
  ctx.fillStyle = a.color;
  roundRect(ctx, ground.x - bodyW / 2, hip - bodyH, bodyW, bodyH, 4 * z); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();

  const headY = hip - bodyH - 5.5 * z;
  ctx.fillStyle = a.skin;
  ctx.beginPath(); ctx.arc(ground.x, headY, 6 * z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = a.hair;
  ctx.beginPath();
  if (front) ctx.arc(ground.x, headY - 1 * z, 6.2 * z, Math.PI * 1.05, Math.PI * 1.95);
  else ctx.arc(ground.x, headY, 6.2 * z, 0, Math.PI * 2);
  ctx.fill();
  if (front) {
    ctx.fillStyle = '#272A24';
    ctx.beginPath(); ctx.arc(ground.x - 2.2 * z, headY + 0.8 * z, 0.9 * z, 0, Math.PI * 2); ctx.arc(ground.x + 2.2 * z, headY + 0.8 * z, 0.9 * z, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  a.headScreen = { x: ground.x, y: headY - 7 * z };
}

// Drawn after lighting so they stay readable: name tags, moods, speech bubbles.
export function drawOverlays(ctx, sim) {
  for (const a of sim.agents) {
    if (!a.headScreen || a.state === 'waiting') continue;
    const { x, y } = a.headScreen;
    if (a.bubble) { bubble(ctx, x, y, a.bubble.text, a.named ? a.color : '#8C9A9B'); continue; }
    if (!a.named) continue;
    const label = a.settled ? `${a.result.mood} ${a.name}` : a.name;
    ctx.font = '700 12px Figtree, system-ui, sans-serif';
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = a.color;
    roundRect(ctx, x - w / 2, y - 20, w, 18, 9); ctx.fill();
    ctx.fillStyle = a.id === 'both' ? '#272A24' : '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 11);
  }
}

function bubble(ctx, x, y, text, color) {
  ctx.save();
  ctx.font = '600 13px Figtree, system-ui, sans-serif';
  const lines = wrap(ctx, text, 170);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18, h = lines.length * 17 + 10;
  const bx = Math.max(4, Math.min(ctx.canvas.clientWidth - w - 4, x - w / 2)), by = Math.max(4, y - h - 12);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = color; ctx.lineWidth = 2;
  roundRect(ctx, bx, by, w, h, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, by + h - 1); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 6, by + h - 1); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, by + h - 3, 10, 3);
  ctx.fillStyle = '#272A24'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 9, by + 6 + i * 17));
  ctx.restore();
}

function wrap(ctx, text, max) {
  const out = []; let line = '';
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > max && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function hitAgent(sim, sx, sy) {
  return sim.agents.find(a => a.named && a.headScreen && Math.hypot(a.headScreen.x - sx, a.headScreen.y + 10 - sy) < 22);
}

export function replay(a, sim) {
  const r = a.result;
  const lines = [...r.likes.map(x => PRINCIPLE_TEXT[x.key][0]), ...r.dislikes.map(x => PRINCIPLE_TEXT[x.key][1])];
  if (lines.length) say(a, `${r.mood} ${lines[Math.floor(Math.random() * lines.length)]}`, sim, r.score >= 60, 4);
}

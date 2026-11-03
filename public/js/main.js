import { CATEGORIES, ITEMS, ITEM_BY_ID, ROOM_PRESETS, LIGHT_TYPES, WALL_COLOURS, BUDGETS, SUPPLIER } from './catalog.js';
import { footprint, scoreRoom, PRINCIPLE_TEXT, PRINCIPLE_LABEL, STUDENTS } from './scoring.js';
import {
  drawRoom, drawItem, drawFootprint, drawLighting, fitCamera, unproject, fromView,
  itemViewRect, boxHull,
} from './iso.js';
import { createSim, stepSim, drawAgent, drawOverlays, agentDepth, hitAgent, replay } from './students.js';

const $ = s => document.querySelector(s);
const canvas = $('#stage');
const ctx = canvas.getContext('2d');
const BUILD_SECONDS = 600;
const SAVE_KEY = 'nfspace.room.v2'; // v2: Beparta catalogue on a 600 mm grid

// ---- state --------------------------------------------------------------------

let room = load() || makeRoom(ROOM_PRESETS[1]);
let view = 0;
let cam = { ox: 0, oy: 0, zoom: 1 };
let selected = null;   // uid
let drag = null;       // { kind:'place'|'move', item, ok, lift, orig? }
let uid = Math.max(0, ...room.items.map(i => i.uid)) + 1;
let timer = { left: BUILD_SECONDS, running: false, handle: null };
let dirty = true;
let sim = null;        // release simulation (students walking in); null while building
let lastFrame = 0;

function makeRoom(preset, cols = preset.cols, rows = preset.rows) {
  const door = Math.floor(rows / 2);
  const features = [{ side: 'W', type: 'door', at: door, len: 1 }];
  for (let x = 1; x + 2 <= cols - 1; x += 3) features.push({ side: 'N', type: 'window', at: x, len: 2 });
  return {
    preset: preset.id, cols, rows, door, features,
    light: { level: 75, type: 'fluoro' }, wall: 'white', budget: BUDGETS[1], items: [],
  };
}

// Drop items whose ids are no longer in the catalogue (older saves).
function clean(r) { if (r?.items) r.items = r.items.filter(i => ITEM_BY_ID[i.id]); return r; }
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(room)); } catch {} }
function load() { try { return clean(JSON.parse(localStorage.getItem(SAVE_KEY))); } catch { return null; } }
function changed() { dirty = true; save(); updateHud(); }

// ---- placement rules ----------------------------------------------------------

const isFloor = it => ITEM_BY_ID[it.id].tags.includes('floor');

function overlaps(a, b) {
  const fa = footprint(a), fb = footprint(b);
  return a.x < b.x + fb.w && b.x < a.x + fa.w && a.y < b.y + fb.d && b.y < a.y + fa.d;
}

function canPlace(it) {
  const f = footprint(it);
  if (it.x < 0 || it.y < 0 || it.x + f.w > room.cols || it.y + f.d > room.rows) return false;
  const floor = isFloor(it);
  if (!floor && it.x === 0 && room.door >= it.y && room.door < it.y + f.d) return false; // keep doorway clear
  // Rugs may sit under furniture but not on other rugs; furniture can't overlap furniture.
  return !room.items.some(o => o.uid !== it.uid && isFloor(o) === floor && overlaps(it, o));
}

function findSpot(it) {
  const cx = Math.floor(room.cols / 2), cy = Math.floor(room.rows / 2);
  const spots = [];
  for (let y = 0; y < room.rows; y++) for (let x = 0; x < room.cols; x++) spots.push({ x, y, d: Math.hypot(x - cx, y - cy) });
  spots.sort((a, b) => a.d - b.d);
  for (const s of spots) { const t = { ...it, x: s.x, y: s.y }; if (canPlace(t)) return t; }
  return null;
}

// ---- rendering ----------------------------------------------------------------

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Keep the room clear of the settings panel (top) and the round buttons / roster (bottom).
  const set = $('.settings').getBoundingClientRect();
  const top = set.height ? set.bottom - r.top + 4 : 0;
  cam = fitCamera(room, view, r.width, r.height, top, 76);
  dirty = true;
}

function depth(it) { const r = itemViewRect(room, view, it); return r.x + r.w / 2 + r.y + r.d / 2; }

function render(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (sim) { stepSim(sim, dt); dirty = true; updateRoster(now); }
  if (dirty) {
    dirty = false;
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    drawRoom(ctx, cam, room, view);
    const list = room.items.filter(i => !(drag?.kind === 'move' && drag.item.uid === i.uid));
    const floors = list.filter(isFloor), solids = list.filter(i => !isFloor(i));
    for (const it of floors) drawItem(ctx, cam, room, view, it, { selected: it.uid === selected });
    if (drag) drawFootprint(ctx, cam, room, view, drag.item, drag.ok);
    // Items and students share one painter's-order list.
    const all = (drag ? [...solids, drag.item] : solids).map(it => ({ d: depth(it), it }));
    if (sim) for (const a of sim.agents) all.push({ d: agentDepth(sim, view, a), a });
    all.sort((a, b) => a.d - b.d);
    for (const { it, a } of all) {
      if (a) { drawAgent(ctx, cam, sim, view, a); continue; }
      const isDrag = drag && it === drag.item;
      drawItem(ctx, cam, room, view, it, { alpha: isDrag ? 0.75 : 1, selected: !drag && it.uid === selected });
    }
    drawLighting(ctx, cam, room, view, room.items.filter(i => ITEM_BY_ID[i.id].tags.includes('lamp')));
    if (sim) drawOverlays(ctx, sim);
    placeSelectionBar();
  }
  requestAnimationFrame(render);
}

// ---- hit testing --------------------------------------------------------------

function hitItem(sx, sy) {
  const solids = room.items.filter(i => !isFloor(i)).sort((a, b) => depth(b) - depth(a));
  for (const it of [...solids, ...room.items.filter(isFloor)]) {
    const hull = boxHull(cam, itemViewRect(room, view, it), ITEM_BY_ID[it.id].h);
    const p = new Path2D();
    hull.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y)));
    p.closePath();
    if (ctx.isPointInPath(p, sx * (window.devicePixelRatio || 1), sy * (window.devicePixelRatio || 1))) return it;
  }
  return null;
}

function localPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
}

// Grid position (room coords, top-left of footprint) for an item centred under the pointer.
function snapUnder(it, sx, sy) {
  const g = unproject(cam, sx, sy);
  const rc = fromView(room, view, g.x, g.y);
  const f = footprint(it);
  return { x: Math.round(rc.x - f.w / 2), y: Math.round(rc.y - f.d / 2) };
}

// ---- pointer input ------------------------------------------------------------

const pointers = new Map();
let gesture = null; // { kind:'pan'|'pinch', ... }
let tapCandidate = null;

function updateDrag(e) {
  const p = localPoint(e);
  const lift = e.pointerType === 'touch' ? 48 : 0; // keep item visible above the finger
  const pos = snapUnder(drag.item, p.x - (drag.grab?.x || 0), p.y - lift - (drag.grab?.y || 0));
  Object.assign(drag.item, pos);
  drag.ok = p.inside && canPlace(drag.item);
  drag.inside = p.inside;
  dirty = true;
}

function endDrag() {
  if (drag.kind === 'place') {
    if (drag.ok) { room.items.push(drag.item); selected = drag.item.uid; }
  } else {
    const real = room.items.find(i => i.uid === drag.item.uid);
    if (drag.ok) Object.assign(real, { x: drag.item.x, y: drag.item.y });
  }
  drag = null;
  changed();
}

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    drag = null; tapCandidate = null;
    const [a, b] = [...pointers.values()];
    gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    dirty = true;
    return;
  }
  const p = localPoint(e);
  if (sim) {
    // Watching mode: tap a student to hear from them again, otherwise pan.
    const who = hitAgent(sim, p.x, p.y);
    if (who?.settled) replay(who, sim);
    gesture = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
    return;
  }
  const hit = hitItem(p.x, p.y);
  tapCandidate = { x: e.clientX, y: e.clientY, hit };
  if (hit) {
    selected = hit.uid;
    const r = itemViewRect(room, view, hit);
    const c = boxHull(cam, r, 0); // bottom points: [2],[3],[4]; centre ≈ mid of [2] and [4]
    const cx = (c[2].x + c[4].x) / 2, cy = (c[2].y + c[4].y) / 2;
    drag = { kind: 'move', item: { ...hit }, ok: true, grab: { x: p.x - cx, y: p.y - cy }, started: false };
  } else {
    gesture = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
  }
  dirty = true;
});

canvas.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (tapCandidate && Math.hypot(e.clientX - tapCandidate.x, e.clientY - tapCandidate.y) > 8) tapCandidate = null;

  if (gesture?.kind === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    zoomAt(mid.x, mid.y, dist / gesture.dist);
    cam.ox += mid.x - gesture.mid.x; cam.oy += mid.y - gesture.mid.y;
    gesture.dist = dist; gesture.mid = mid;
    dirty = true;
  } else if (gesture?.kind === 'pan') {
    cam.ox += e.clientX - gesture.last.x; cam.oy += e.clientY - gesture.last.y;
    gesture.last = { x: e.clientX, y: e.clientY };
    dirty = true;
  } else if (drag && !tapCandidate) {
    drag.started = true;
    updateDrag(e);
  }
});

function pointerEnd(e) {
  pointers.delete(e.pointerId);
  if (drag?.kind === 'move' && drag.started) endDrag();
  else if (drag?.kind === 'move') drag = null;
  if (tapCandidate && !tapCandidate.hit) selected = null;
  tapCandidate = null;
  if (pointers.size < 2 && gesture?.kind === 'pinch') {
    const [rest] = [...pointers.values()];
    gesture = rest ? { kind: 'pan', last: rest } : null;
  } else if (!pointers.size) gesture = null;
  dirty = true;
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);

function zoomAt(cx, cy, factor) {
  const r = canvas.getBoundingClientRect();
  const x = cx - r.left, y = cy - r.top;
  const z = Math.max(0.3, Math.min(3, cam.zoom * factor));
  const k = z / cam.zoom;
  cam.ox = x - (x - cam.ox) * k; cam.oy = y - (y - cam.oy) * k; cam.zoom = z;
}
canvas.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); dirty = true; }, { passive: false });

// ---- tray (drag new items in) -------------------------------------------------

let activeCat = CATEGORIES[0].id;

function buildTray() {
  $('#cats').innerHTML = CATEGORIES.map(c =>
    `<button class="cat${c.id === activeCat ? ' on' : ''}" data-cat="${c.id}"><span>${c.icon}</span>${c.label}</button>`).join('');
  $('#items').innerHTML = ITEMS.filter(i => i.cat === activeCat).map(i => `
    <button class="item" data-id="${i.id}">
      <span class="swatch" style="background:${i.color}">${i.icon}</span>
      <span class="nm">${i.name}<small>${i.code ? `${SUPPLIER.name} ${i.code} · ` : ''}$${i.cost.toLocaleString('en-AU')}</small></span>
    </button>`).join('');
}

$('#cats').addEventListener('click', e => {
  const b = e.target.closest('.cat'); if (!b) return;
  activeCat = b.dataset.cat; buildTray();
});

// A drag starts once the finger moves off the tray's scroll axis; a plain tap places the item
// at the nearest free spot to the middle of the room.
let trayPress = null;
$('#items').addEventListener('pointerdown', e => {
  const b = e.target.closest('.item'); if (!b) return;
  trayPress = { id: b.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId };
});
window.addEventListener('pointermove', e => {
  if (trayPress && e.pointerId === trayPress.pid && !drag) {
    const dx = e.clientX - trayPress.x, dy = e.clientY - trayPress.y;
    const vertical = getComputedStyle($('#tray')).flexDirection === 'column';
    const off = vertical ? Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx);
    if (off) {
      drag = { kind: 'place', item: { uid: uid++, id: trayPress.id, x: 0, y: 0, rot: 0 }, ok: false, pid: e.pointerId };
      document.body.classList.add('dragging');
    }
  }
  if (drag?.kind === 'place' && e.pointerId === drag.pid) updateDrag(e);
});
window.addEventListener('pointerup', e => {
  if (drag?.kind === 'place' && e.pointerId === drag.pid) {
    endDrag(); document.body.classList.remove('dragging');
  } else if (trayPress && e.pointerId === trayPress.pid && Math.hypot(e.clientX - trayPress.x, e.clientY - trayPress.y) < 12) {
    const spot = findSpot({ uid: uid++, id: trayPress.id, x: 0, y: 0, rot: 0 });
    if (spot) { room.items.push(spot); selected = spot.uid; changed(); } else toast('No room left for that!');
  }
  trayPress = null;
});
window.addEventListener('pointercancel', e => {
  if (drag?.kind === 'place' && e.pointerId === drag.pid) { drag = null; document.body.classList.remove('dragging'); dirty = true; }
  trayPress = null;
});

// ---- selection bar ------------------------------------------------------------

function placeSelectionBar() {
  const bar = $('#selbar');
  const it = room.items.find(i => i.uid === selected);
  if (!it || drag) { bar.hidden = true; return; }
  const hull = boxHull(cam, itemViewRect(room, view, it), ITEM_BY_ID[it.id].h);
  const top = Math.min(...hull.map(p => p.y)), cx = (Math.min(...hull.map(p => p.x)) + Math.max(...hull.map(p => p.x))) / 2;
  const r = canvas.getBoundingClientRect();
  bar.hidden = false;
  bar.querySelector('.nm').textContent = `${ITEM_BY_ID[it.id].name} · $${ITEM_BY_ID[it.id].cost}`;
  bar.style.left = `${r.left + cx}px`;
  bar.style.top = `${Math.max(r.top + 8, r.top + top - 64)}px`;
}

$('#selbar').addEventListener('click', e => {
  const act = e.target.closest('button')?.dataset.act;
  const it = room.items.find(i => i.uid === selected);
  if (!act || !it) return;
  if (act === 'rotate') {
    const t = { ...it, rot: (it.rot + 1) % 4 };
    if (canPlace(t)) it.rot = t.rot; else toast('Not enough space to rotate');
  } else if (act === 'copy') {
    const t = findSpot({ ...it, uid: uid++ });
    if (t) { room.items.push(t); selected = t.uid; } else toast('No room left!');
  } else if (act === 'delete') {
    room.items = room.items.filter(i => i.uid !== it.uid); selected = null;
  }
  changed();
});

// ---- HUD: budget, settings, view, timer ---------------------------------------

function money(n) { return '$' + n.toLocaleString('en-AU'); }

function updateHud() {
  const spent = room.items.reduce((s, i) => s + ITEM_BY_ID[i.id].cost, 0);
  const pct = Math.min(100, (spent / room.budget) * 100);
  $('#budget-fill').style.width = pct + '%';
  $('#budget-fill').classList.toggle('over', spent > room.budget);
  $('#budget-text').textContent = `${money(spent)} / ${money(room.budget)}`;
  $('#light-level').value = room.light.level;
  $('#light-type').value = room.light.type;
  $('#wall').value = room.wall;
  $('#preset').value = room.preset;
  $('#budget').value = room.budget;
}

function fillSelect(sel, list) { sel.innerHTML = list.map(o => `<option value="${o.id}">${o.name}</option>`).join(''); }
fillSelect($('#preset'), [...ROOM_PRESETS, { id: 'custom', name: 'Custom size…' }]);
fillSelect($('#light-type'), LIGHT_TYPES);
fillSelect($('#wall'), WALL_COLOURS);
fillSelect($('#budget'), BUDGETS.map(b => ({ id: b, name: money(b) })));
$('#budget').addEventListener('change', e => { room.budget = +e.target.value; changed(); });
$('#credit').innerHTML = `Furniture &amp; prices: <a href="${SUPPLIER.url}" target="_blank" rel="noopener">${SUPPLIER.name}</a> (${SUPPLIER.asOf}). Drag onto the room, or tap to drop it in.`;

$('#preset').addEventListener('change', e => {
  const id = e.target.value;
  if (room.items.length && !confirm('Start a new room? This clears your furniture.')) { updateHud(); return; }
  let next;
  if (id === 'custom') {
    const ans = prompt('Grid size (columns × rows), 6–20 each', `${room.cols}x${room.rows}`);
    const m = ans && ans.match(/(\d+)\s*[x×, ]\s*(\d+)/);
    if (!m) { updateHud(); return; }
    const c = Math.max(6, Math.min(20, +m[1])), r = Math.max(6, Math.min(20, +m[2]));
    next = makeRoom({ id: 'custom' }, c, r);
  } else next = makeRoom(ROOM_PRESETS.find(p => p.id === id));
  next.budget = room.budget;
  room = next; selected = null; resize(); changed();
});
$('#light-level').addEventListener('input', e => { room.light.level = +e.target.value; changed(); });
$('#light-type').addEventListener('change', e => { room.light.type = e.target.value; changed(); });
$('#wall').addEventListener('change', e => { room.wall = e.target.value; changed(); });
$('#rot-l').addEventListener('click', () => { view = (view + 3) % 4; resize(); });
$('#rot-r').addEventListener('click', () => { view = (view + 1) % 4; resize(); });
$('#fit').addEventListener('click', resize);

function fmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function drawTimer() {
  $('#timer').textContent = fmt(timer.left);
  $('#timer').classList.toggle('low', timer.left <= 60);
  $('#start').textContent = timer.running ? 'Pause' : timer.left < BUILD_SECONDS ? 'Resume' : 'Start 10 min';
}
const TIMER_CALLS = { 300: '⏱️ 5 minutes left — check every student has a spot', 60: '⏱️ 1 minute left!', 10: '⏱️ 10 seconds…' };
$('#start').addEventListener('click', () => {
  timer.running = !timer.running;
  clearInterval(timer.handle);
  if (timer.running) {
    toast(timer.left === BUILD_SECONDS ? '⏱️ 10 minutes — go! Students arrive when time’s up.' : '⏱️ Timer resumed');
    timer.handle = setInterval(() => {
      timer.left--; drawTimer();
      if (TIMER_CALLS[timer.left]) toast(TIMER_CALLS[timer.left]);
      if (timer.left <= 0) { clearInterval(timer.handle); timer.running = false; toast('⏰ Time’s up! Here come the students…'); release(); }
    }, 1000);
  } else toast('⏸️ Paused — tap Resume to keep building');
  drawTimer();
});

// ---- release + report ---------------------------------------------------------

// Release: lock building, students walk in and react. The report opens from the roster.
function release() {
  if (sim) return stopSim();
  if (timer.running) $('#start').click();
  selected = null; drag = null;
  const res = scoreRoom(room);
  sim = createSim(room, res);
  document.body.classList.add('sim');
  $('#release').textContent = 'Back to building 🛠️';
  $('#roster').innerHTML = sim.agents.filter(a => a.named).map(a => `
    <button class="rcard" data-id="${a.id}" style="--c:${a.color}">
      <span class="face">${a.emoji}</span>
      <span class="who"><b>${a.name}</b><small>${a.trait}</small></span>
      <span class="st"></span>
    </button>`).join('') + '<button id="see-report" class="btn primary">See report</button>';
  $('#roster').hidden = false;
  rosterAt = 0;
}

function stopSim() {
  sim = null;
  document.body.classList.remove('sim');
  $('#release').textContent = 'Release students 🚪';
  $('#roster').hidden = true;
  dirty = true;
}

let rosterAt = 0;
function updateRoster(now) {
  if (now - rosterAt < 250) return;
  rosterAt = now;
  for (const a of sim.agents.filter(x => x.named)) {
    const el = $(`.rcard[data-id="${a.id}"] .st`);
    if (el && el.textContent !== a.status) el.textContent = a.status;
  }
  $('#see-report').classList.toggle('pulse', sim.settledAt !== null);
}

$('#roster').addEventListener('click', e => {
  if (e.target.closest('#see-report')) return showReport(sim.result);
  const card = e.target.closest('.rcard');
  const a = card && sim?.agents.find(x => x.id === card.dataset.id);
  if (a?.settled) replay(a, sim);
});

function showReport(res) {
  const m = res.measures;
  const studentCards = res.students.map(s => `
    <div class="student" style="--c:${s.color}">
      <div class="who"><span class="face">${s.emoji}</span><div><b>${s.name}</b><small>${s.trait}</small></div>
        <span class="mood">${s.mood}</span><span class="score">${s.score}</span></div>
      <div class="bar"><i style="width:${s.score}%"></i></div>
      <p class="blurb">${s.blurb}</p>
      <ul>
        ${s.likes.map(x => `<li class="good">👍 ${PRINCIPLE_TEXT[x.key][0]}</li>`).join('')}
        ${s.dislikes.map(x => `<li class="bad">👎 ${PRINCIPLE_TEXT[x.key][1]}</li>`).join('')}
      </ul>
      <details><summary>Breakdown</summary>${s.parts.map(x =>
        `<div class="pr"><span>${PRINCIPLE_LABEL[x.key]}</span><i style="width:${Math.round(x.value * 100)}%"></i></div>`).join('')}</details>
    </div>`).join('');
  $('#report-body').innerHTML = `
    <div class="overall"><span>${res.overall}</span><small>room score</small></div>
    <div class="facts">
      <div><b>${money(m.spent)}</b> spent${res.overBudget ? ` — <em>${money(res.overBudget)} over budget!</em>` : ''}</div>
      <div><b>${m.seats}</b> / ${m.seatTarget} seats</div>
      ${m.unreachable ? `<div><em>${m.unreachable} item(s) can’t be reached from the door</em></div>` : ''}
    </div>
    <div class="students">${studentCards}</div>`;
  $('#report').hidden = false;
  $('#report').dataset.overall = res.overall;
}
$('#release').addEventListener('click', release);
$('#close-report').addEventListener('click', () => { $('#report').hidden = true; stopSim(); });

$('#save').addEventListener('click', async () => {
  const name = $('#build-name').value.trim();
  if (!name) { toast('Add your name or team name first'); $('#build-name').focus(); return; }
  const res = scoreRoom(room);
  try {
    const r = await fetch('api/builds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, room, overall: res.overall, spent: res.measures.spent, scores: res.students.map(s => ({ id: s.id, score: s.score })) }),
    });
    if (!r.ok) throw new Error(r.status);
    toast('Saved! ✅');
  } catch { toast('Could not save to the server (saved on this iPad only)'); }
});

$('#new').addEventListener('click', () => {
  if (!confirm('Clear the room and reset the timer?')) return;
  room = makeRoom(ROOM_PRESETS.find(p => p.id === room.preset) || ROOM_PRESETS[1], room.cols, room.rows);
  clearInterval(timer.handle); timer = { left: BUILD_SECONDS, running: false, handle: null };
  selected = null; drawTimer(); resize(); changed();
});

// ---- gallery ------------------------------------------------------------------

$('#gallery-btn').addEventListener('click', async () => {
  $('#gallery').hidden = false;
  $('#gallery-list').innerHTML = 'Loading…';
  try {
    const list = await (await fetch('api/builds')).json();
    $('#gallery-list').innerHTML = list.length ? list.map(b => `
      <button class="gb" data-id="${b.id}"><b>${escapeHtml(b.name)}</b>
        <span>${b.overall ?? '–'} pts · ${money(b.spent || 0)}</span><small>${new Date(b.created * 1000).toLocaleString('en-AU')}</small></button>`).join('')
      : '<p>No saved builds yet.</p>';
  } catch { $('#gallery-list').innerHTML = '<p>Gallery needs the server.</p>'; }
});
$('#gallery-list').addEventListener('click', async e => {
  const b = e.target.closest('.gb'); if (!b) return;
  if (room.items.length && !confirm('Load this build? Your current room will be replaced.')) return;
  const data = await (await fetch(`api/builds/${b.dataset.id}`)).json();
  room = clean(data.room); uid = Math.max(0, ...room.items.map(i => i.uid)) + 1;
  selected = null; $('#gallery').hidden = true; resize(); changed();
});
$('#close-gallery').addEventListener('click', () => { $('#gallery').hidden = true; });

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---- onboarding -----------------------------------------------------------------

const ONBOARD_KEY = 'nfspace.onboarded';
const OB_STEPS = [
  { icon: '🏫', title: 'Design a calm classroom', body: `
    <p>Your job is to furnish a classroom where <b>every</b> student can learn well.</p>
    <p>Four students with different needs will walk into your room and tell you how it feels.</p>` },
  { icon: '✋', title: 'How to build', body: `
    <ul class="ob-list">
      <li><span class="i">👉</span><span>Drag furniture from the tray into the room, or tap an item to drop it in.</span></li>
      <li><span class="i">✥</span><span>Drag anything in the room to move it. Green = fits, orange = blocked.</span></li>
      <li><span class="i">⟳ ⧉ 🗑</span><span>Tap an item to rotate, copy or delete it.</span></li>
      <li><span class="i">🤏</span><span>Pinch to zoom, drag the floor to pan. ⟲ ⟳ turn the room, ⤢ fits it to the screen.</span></li>
    </ul>` },
  { icon: '⏱️', title: 'You have 10 minutes', body: `
    <ul class="ob-list">
      <li><span class="i">▶️</span><span>Tap <b>Start 10 min</b> when you’re ready. The clock in the top bar counts down — you can pause it.</span></li>
      <li><span class="i">💰</span><span>Keep an eye on the budget bar. Going over budget costs points.</span></li>
      <li><span class="i">🚪</span><span>When time’s up, the students walk in automatically. Finished early? Tap <b>Release students</b>.</span></li>
    </ul>` },
  { icon: '🚶', title: 'Meet the students', body: () => `
    <ul class="ob-list">${STUDENTS.map(s => `<li><span class="i">${s.emoji}</span><span><b>${s.name}</b> — ${s.trait.toLowerCase()}.</span></li>`).join('')}</ul>
    <p>They’ll find a spot, say what they think, then you get a score for each student. Save your room to the Gallery from the report.</p>` },
];
let obStep = 0;

function showOnboarding(step = 0) {
  obStep = step;
  const s = OB_STEPS[obStep], last = obStep === OB_STEPS.length - 1;
  $('#ob-step').innerHTML = `<div class="ob-icon">${s.icon}</div><h2>${s.title}</h2>${typeof s.body === 'function' ? s.body() : s.body}`;
  $('#ob-dots').innerHTML = OB_STEPS.map((_, i) => `<i class="${i === obStep ? 'on' : ''}"></i>`).join('');
  $('#ob-back').hidden = obStep === 0;
  $('#ob-skip').hidden = !last;
  $('#ob-next').textContent = last ? (timer.left === BUILD_SECONDS && !timer.running ? 'Start the 10-minute timer' : 'Back to building') : 'Next';
  $('#onboard').hidden = false;
}
function closeOnboarding() {
  $('#onboard').hidden = true;
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch {}
}
$('#ob-back').addEventListener('click', () => showOnboarding(obStep - 1));
$('#ob-skip').addEventListener('click', closeOnboarding);
$('#ob-next').addEventListener('click', () => {
  if (obStep < OB_STEPS.length - 1) return showOnboarding(obStep + 1);
  const startNow = timer.left === BUILD_SECONDS && !timer.running;
  closeOnboarding();
  if (startNow) $('#start').click();
});
$('#help').addEventListener('click', () => showOnboarding(0));

// ---- boot ---------------------------------------------------------------------

// iOS Safari ignores user-scalable=no: block its page pinch-zoom (the canvas has its own zoom).
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// The room canvas runs on pointer events only, so cancelling its touch events stops Safari's
// double-tap zoom there without affecting taps, drags or pinches.
for (const ev of ['touchstart', 'touchend']) canvas.addEventListener(ev, e => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

buildTray();
updateHud();
drawTimer();
try { if (!localStorage.getItem(ONBOARD_KEY)) showOnboarding(0); } catch { showOnboarding(0); }
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(render);

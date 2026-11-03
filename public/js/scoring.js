// Scoring engine. Each principle returns 0..1 for a room; each student weights them.
// Research basis: ASPECTSS (Mostafa), Clever Classrooms/HEAD (Barrett et al.), UDL, BDA
// reading-friendly design guidance. Weights are first guesses — tune with a specialist. See PLAN.md §4.

import { ITEM_BY_ID, LIGHT_TYPES, WALL_COLOURS, seatsOf } from './catalog.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

export function footprint(it) {
  const def = ITEM_BY_ID[it.id];
  return it.rot % 2 ? { w: def.d, d: def.w } : { w: def.w, d: def.d };
}

function centre(it) {
  const f = footprint(it);
  return { x: it.x + f.w / 2, y: it.y + f.d / 2 };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tagsOf = it => ITEM_BY_ID[it.id].tags;
const has = (it, tag) => tagsOf(it).includes(tag);
const countTag = (items, tag) => items.reduce((n, it) => n + tagsOf(it).filter(t => t === tag).length, 0);


// ---- principles -------------------------------------------------------------

export function measure(room) {
  const items = room.items;
  const area = room.cols * room.rows;
  const maxDim = Math.max(room.cols, room.rows);
  const door = { x: 0.5, y: room.door + 0.5 };
  const light = LIGHT_TYPES.find(l => l.id === room.light.type);
  const wall = WALL_COLOURS.find(w => w.id === room.wall);
  const loud = items.filter(it => has(it, 'loud'));
  const calm = items.filter(it => has(it, 'quiet') || has(it, 'books') || has(it, 'calm'));

  // Occupancy grid (rugs are walkable floor).
  const grid = Array.from({ length: room.rows }, () => new Array(room.cols).fill(null));
  for (const it of items) {
    if (has(it, 'floor')) continue;
    const f = footprint(it);
    for (let y = it.y; y < it.y + f.d; y++) for (let x = it.x; x < it.x + f.w; x++) grid[y][x] = it;
  }
  const occupied = grid.flat().filter(Boolean).length;

  const p = {};

  // Acoustics: absorbing surfaces vs room size, noisy items count against.
  p.acoustics = clamp((countTag(items, 'absorb') - loud.length * 0.5) / Math.max(3, area / 24));

  // Escape space: a retreat, far from the door, with nothing loud nearby.
  p.escape = 0;
  for (const it of items.filter(i => has(i, 'quiet'))) {
    const c = centre(it);
    const far = clamp(dist(c, door) / (maxDim * 0.6));
    const peaceful = loud.every(l => dist(centre(l), c) > 3) ? 1 : 0;
    const s = (0.4 + 0.3 * far + 0.3 * peaceful) * (has(it, 'escape') ? 1 : 0.7);
    p.escape = Math.max(p.escape, s);
  }

  // Sensory zoning: loud things kept away from calm things.
  if (!loud.length) p.zoning = calm.length ? 0.7 : 0.4;
  else if (!calm.length) p.zoning = 0.2;
  else {
    const avg = loud.reduce((s, l) => s + Math.min(...calm.map(c => dist(centre(l), centre(c)))), 0) / loud.length;
    p.zoning = clamp(avg / (maxDim * 0.5));
  }

  // Circulation: flood-fill from the door; every item should be reachable, floor kept clear.
  const seen = Array.from({ length: room.rows }, () => new Array(room.cols).fill(false));
  const q = [];
  if (!grid[room.door][0]) { seen[room.door][0] = true; q.push([0, room.door]); }
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= room.cols || ny >= room.rows || seen[ny][nx] || grid[ny][nx]) continue;
      seen[ny][nx] = true; q.push([nx, ny]);
    }
  }
  const solid = items.filter(it => !has(it, 'floor'));
  const reachable = solid.filter(it => {
    const f = footprint(it);
    for (let y = it.y - 1; y <= it.y + f.d; y++) for (let x = it.x - 1; x <= it.x + f.w; x++) {
      if (seen[y]?.[x]) return true;
    }
    return false;
  });
  p.unreachable = solid.length - reachable.length;
  const reach = solid.length ? reachable.length / solid.length : 1;
  const clear = 1 - occupied / area;
  p.circulation = grid[room.door][0] ? 0 : reach * reach * (0.6 + 0.4 * clamp(clear / 0.35));

  // Movement & fidget options.
  p.movement = clamp((countTag(items, 'movement') + countTag(items, 'fidget')) / Math.max(2, area / 50));

  // Seating choice (UDL: choice of where/how to work) and capacity.
  const seatTypes = new Set(items.flatMap(it => tagsOf(it).filter(t => t.startsWith('seat:'))));
  p.choice = clamp(seatTypes.size / 5);
  const seats = items.reduce((n, it) => n + seatsOf(ITEM_BY_ID[it.id]), 0);
  p.seatTarget = Math.max(8, Math.round(area / 7));
  p.seats = seats;
  p.capacity = clamp(seats / p.seatTarget);

  // Visual calm: wall colour + density + clutter, helped by storage.
  const density = occupied / area;
  const tidy = clamp(1 - Math.max(0, density - 0.35) * 2.5 - countTag(items, 'clutter') * 0.08
    + Math.min(countTag(items, 'storage'), 3) * 0.05);
  p.visual = 0.5 * wall.calm + 0.5 * tidy;

  p.nature = clamp(countTag(items, 'nature') / Math.max(2, area / 60));
  p.reading = (countTag(items, 'books') ? 0.5 : 0) + (items.some(i => has(i, 'quiet') && has(i, 'soft')) ? 0.25 : 0)
    + (room.light.level >= 50 && !light.flicker ? 0.25 : 0);
  p.predictable = items.some(i => has(i, 'predictable')) ? 1 : 0.3;
  p.balance = Math.min(p.escape, p.movement);

  // Distraction: desks right next to the door or along the window wall (y = 0).
  const desks = items.filter(i => has(i, 'desk') && !has(i, 'teacher'));
  p.focus = desks.length
    ? desks.filter(d => dist(centre(d), door) > 2.5 && d.y > 0).length / desks.length
    : 0.5;

  p.lamps = countTag(items, 'lamp');
  p.light = light; p.lightLevel = room.light.level;
  p.spent = items.reduce((s, it) => s + ITEM_BY_ID[it.id].cost, 0);
  return p;
}

function lighting(p, band, { warmPref = 0, flickerPenalty = 0 }) {
  const [lo, hi] = band, L = p.lightLevel;
  let s = L < lo ? 1 - (lo - L) / 30 : L > hi ? 1 - (L - hi) / 30 : 1;
  s += Math.min(p.lamps, 2) * 0.08;
  s += warmPref * (p.light.warm - 0.5) * 0.3;
  if (p.light.flicker) s -= flickerPenalty;
  return clamp(s);
}

// ---- students ---------------------------------------------------------------

export const STUDENTS = [
  {
    id: 'move', name: 'Max', trait: 'Always on the move', emoji: '⚡', color: '#FF6D3A',
    blurb: 'Needs to move, gets distracted by doors and windows, likes clear zones.',
    light: [55, 80], lightOpts: {},
    weights: { movement: 3, zoning: 2, visual: 2, focus: 2, choice: 1.5, acoustics: 1, capacity: 1, circulation: 2.5, lighting: 1, nature: 0.5 },
  },
  {
    id: 'calm', name: 'Ari', trait: 'Needs calm and quiet', emoji: '🌙', color: '#4C34E5',
    blurb: 'Sensitive to noise and harsh light; needs a place to retreat and a predictable room.',
    light: [30, 60], lightOpts: { warmPref: 1, flickerPenalty: 0.4 },
    weights: { acoustics: 3, escape: 3, lighting: 2.5, visual: 2, predictable: 1.5, zoning: 1.5, circulation: 2.5, capacity: 1, nature: 0.5 },
  },
  {
    id: 'both', name: 'Jules', trait: 'Needs to move and to rest', emoji: '🌗', color: '#C0ADFF',
    blurb: 'Wants to move AND needs calm — only happy if the room has both, kept apart.',
    light: [35, 65], lightOpts: { warmPref: 0.6, flickerPenalty: 0.3 },
    weights: { balance: 3, zoning: 3, acoustics: 2, escape: 1.5, movement: 1.5, lighting: 1.5, choice: 1, capacity: 1, circulation: 2.5 },
  },
  {
    id: 'read', name: 'Priya', trait: 'Reads best in good light', emoji: '📖', color: '#00BC74',
    blurb: 'Needs bright, glare-free light, a calm reading spot and an uncluttered space.',
    light: [55, 85], lightOpts: { flickerPenalty: 0.35 },
    weights: { lighting: 3, reading: 3, visual: 2, choice: 1.5, acoustics: 1, capacity: 1, circulation: 2.5, nature: 0.5 },
  },
];

export const PRINCIPLE_TEXT = {
  acoustics: ['The room is nice and quiet — sound gets soaked up.', 'It’s really echoey and loud in here.'],
  escape: ['There’s a safe, quiet place to retreat to.', 'There’s nowhere quiet to escape to when it gets too much.'],
  zoning: ['Busy areas are kept away from calm areas.', 'The noisy stuff is right next to the calm spots.'],
  circulation: ['Easy to move around from the door.', 'Hard to get around — some places are blocked or crowded.'],
  movement: ['There are ways to move and fidget while learning.', 'Nothing lets me move or fidget.'],
  choice: ['Lots of different places and ways to sit.', 'Every seat is the same — no choice.'],
  capacity: ['There are enough places for the whole class.', 'Not enough seats for everyone.'],
  visual: ['The room looks calm and tidy.', 'Too much visual noise — busy walls or clutter.'],
  nature: ['Plants and nature make it feel fresh.', 'No plants or nature at all.'],
  reading: ['A great, well-lit spot for reading.', 'Nowhere good to read.'],
  predictable: ['I can see what’s happening today.', 'I don’t know what’s coming next — no visual timetable.'],
  balance: ['There’s a space to move AND a space to calm down.', 'I need both an active space and a calm space.'],
  focus: ['My desk isn’t near the door or windows.', 'Desks near the door/windows keep distracting me.'],
  lighting: ['The lighting feels just right.', 'The lighting is uncomfortable for me.'],
};

export const PRINCIPLE_LABEL = {
  acoustics: 'Acoustics', escape: 'Escape space', zoning: 'Sensory zoning', circulation: 'Circulation',
  movement: 'Movement', choice: 'Seating choice', capacity: 'Capacity', visual: 'Visual calm', nature: 'Nature',
  reading: 'Reading', predictable: 'Predictability', balance: 'Active + calm', focus: 'Focus', lighting: 'Lighting',
};

export function scoreRoom(room) {
  const p = measure(room);
  const overBudget = Math.max(0, p.spent - room.budget);
  const budgetFactor = overBudget ? Math.max(0.5, 1 - overBudget / room.budget) : 1;
  // Whole-room gates: a room must seat the class and every item must be reachable from the door.
  const gate = budgetFactor * (0.5 + 0.5 * clamp(p.capacity / 0.75)) * Math.max(0.6, 1 - 0.03 * p.unreachable);

  const students = STUDENTS.map(st => {
    const vals = { ...p, lighting: lighting(p, st.light, st.lightOpts) };
    let sum = 0, wsum = 0;
    const parts = [];
    for (const [k, w] of Object.entries(st.weights)) {
      sum += vals[k] * w; wsum += w;
      parts.push({ key: k, value: vals[k], weight: w });
    }
    const score = Math.round((sum / wsum) * 100 * gate);
    const byImpact = [...parts].sort((a, b) => b.weight * b.value - a.weight * a.value);
    const likes = byImpact.filter(x => x.value >= 0.7).slice(0, 2);
    const dislikes = [...parts].sort((a, b) => b.weight * (1 - b.value) - a.weight * (1 - a.value))
      .filter(x => x.value < 0.5).slice(0, 2);
    return { ...st, score, parts, likes, dislikes, mood: score >= 75 ? '😊' : score >= 50 ? '😐' : '😣' };
  });

  const overall = Math.round(students.reduce((s, x) => s + x.score, 0) / students.length);
  return { overall, students, measures: p, overBudget, budgetFactor, gate };
}

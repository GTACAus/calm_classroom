// Item catalogue. One tile = 600 mm. w/d = footprint in tiles, h = box height in px (≈ mm/28).
// Furniture is from Beparta (https://beparta.com.au) — names, codes and RRP prices as listed
// Nov 2026; footprints rounded from their W×D sizes. Items with no `code` are generic
// supports Beparta doesn't sell; their prices are placeholders.
// Tags drive scoring — see scoring.js. `seats` = how many students it seats (default 1).

export const SUPPLIER = { name: 'Beparta', url: 'https://beparta.com.au', asOf: 'Nov 2026' };

export const CATEGORIES = [
  { id: 'desks', label: 'Desks', icon: '📝' },
  { id: 'seating', label: 'Seating', icon: '🪑' },
  { id: 'soft', label: 'Soft', icon: '🛋️' },
  { id: 'sensory', label: 'Quiet & Sensory', icon: '🏕️' },
  { id: 'storage', label: 'Storage & Books', icon: '📚' },
  { id: 'supports', label: 'Supports', icon: '🎧' },
  { id: 'nature', label: 'Nature & Play', icon: '🌿' },
];

export const ITEMS = [
  // Desks & tables (Beparta)
  { id: 'T142', code: 'T142', name: 'Individual Student Desk', cat: 'desks', w: 1, d: 1, h: 22, cost: 197, color: '#D9C7A3', icon: '📝', tags: ['desk'] },
  { id: 'T149', code: 'T149', name: 'Double Student Table', cat: 'desks', w: 2, d: 1, h: 22, cost: 199, color: '#D9C7A3', icon: '📝', tags: ['desk'] },
  { id: 'T143', code: 'T143', name: 'Adjustable Individual Desk', cat: 'desks', w: 1, d: 1, h: 24, cost: 217, color: '#C8D6E0', icon: '↕️', tags: ['desk', 'adjustable'] },
  { id: 'T083', code: 'T083', name: 'Height Adjustable Double Tray Desk', cat: 'desks', w: 2, d: 1, h: 24, cost: 369, color: '#C8D6E0', icon: '🗃️', tags: ['desk', 'adjustable', 'storage'] },
  { id: 'T145', code: 'T145', name: 'Rounded Rectangle Student Table', cat: 'desks', w: 2, d: 1, h: 22, cost: 272, color: '#E6D3B0', icon: '📝', tags: ['desk'] },
  { id: 'T107', code: 'T107', name: 'Adjustable Quarter Table', cat: 'desks', w: 2, d: 2, h: 20, cost: 299, color: '#F2C66D', icon: '🟡', tags: ['desk', 'group', 'adjustable'] },
  { id: 'T089', code: 'T089', name: 'Cloud Table', cat: 'desks', w: 2, d: 2, h: 24, cost: 549, color: '#BFE3F0', icon: '☁️', tags: ['desk', 'group'] },
  { id: 'T030', code: 'T030', name: 'Perch Straight (standing)', cat: 'desks', w: 2, d: 1, h: 32, cost: 329, color: '#9AA3A8', icon: '🧍', tags: ['desk', 'movement', 'seat:standing'], seats: 2 },
  { id: 'T113', code: 'T113', name: 'Slab End Carrel Table', cat: 'desks', w: 2, d: 1, h: 40, cost: 379, color: '#B9A889', icon: '🔲', tags: ['desk', 'quiet', 'carrel'] },
  { id: 'T052', code: 'T052', name: 'Teachers’ Caddy Mobile Desk', cat: 'desks', w: 1, d: 1, h: 36, cost: 799, color: '#8A6E4B', icon: '👩‍🏫', tags: ['desk', 'teacher', 'storage'] },
  { id: 'T112', code: 'T112', name: 'L Shape Teachers’ Table', cat: 'desks', w: 3, d: 2, h: 26, cost: 1299, color: '#8A6E4B', icon: '👩‍🏫', tags: ['desk', 'teacher'] },

  // Seating (Beparta)
  { id: 'H059', code: 'H059', name: 'Student Chair – Large', cat: 'seating', w: 1, d: 1, h: 18, cost: 59, color: '#4C34E5', icon: '🪑', tags: ['seat:chair'] },
  { id: 'H060', code: 'H060', name: 'Forefront Chair', cat: 'seating', w: 1, d: 1, h: 20, cost: 129, color: '#272A24', icon: '🪑', tags: ['seat:chair'] },
  { id: 'H061', code: 'H061', name: 'High Sled Stool', cat: 'seating', w: 1, d: 1, h: 30, cost: 139, color: '#3C6CE8', icon: '🪑', tags: ['seat:stool'] },
  { id: 'H016', code: 'H016', name: 'Essential Stool', cat: 'seating', w: 1, d: 1, h: 15, cost: 199, color: '#00BC74', icon: '⚪', tags: ['seat:stool'] },
  { id: 'H013', code: 'H013', name: 'Befocus Upholstered Stool', cat: 'seating', w: 1, d: 1, h: 18, cost: 229, color: '#7C6CD6', icon: '🟣', tags: ['seat:stool', 'soft'] },
  { id: 'H002', code: 'H002', name: 'Rockable Seat', cat: 'seating', w: 1, d: 1, h: 12, cost: 324, color: '#FF6D3A', icon: '🌀', tags: ['seat:rock', 'movement', 'fidget', 'soft'] },
  { id: 'M015', code: 'M015', name: 'Beparta Board (balance)', cat: 'seating', w: 1, d: 1, h: 4, cost: 189, color: '#FFCD1F', icon: '🛹', tags: ['movement', 'fidget'] },

  // Soft seating (Beparta)
  { id: 'H023', code: 'H023', name: 'Beparta Lounge Single', cat: 'soft', w: 1, d: 1, h: 28, cost: 899, color: '#7C6CD6', icon: '🛋️', tags: ['seat:lounge', 'soft', 'absorb'] },
  { id: 'H024', code: 'H024', name: 'Beparta Lounge Double', cat: 'soft', w: 2, d: 1, h: 28, cost: 1149, color: '#7C6CD6', icon: '🛋️', tags: ['seat:lounge', 'soft', 'absorb'], seats: 2 },
  { id: 'H035', code: 'H035', name: 'BECOMFY Seat', cat: 'soft', w: 1, d: 1, h: 30, cost: 739, color: '#9B8BD6', icon: '💺', tags: ['seat:lounge', 'soft', 'absorb', 'calm'] },
  { id: 'H007', code: 'H007', name: 'Spot Ottoman', cat: 'soft', w: 1, d: 1, h: 11, cost: 289, color: '#F7A1C4', icon: '🟠', tags: ['seat:ottoman', 'soft', 'absorb'] },
  { id: 'H048', code: 'H048', name: 'Cube Seat', cat: 'soft', w: 1, d: 1, h: 14, cost: 359, color: '#6BE7BE', icon: '🟩', tags: ['seat:ottoman', 'soft', 'absorb'] },
  { id: 'H003', code: 'H003', name: 'Hexagon Seat', cat: 'soft', w: 1, d: 1, h: 11, cost: 349, color: '#C0ADFF', icon: '⬡', tags: ['seat:ottoman', 'soft', 'absorb'] },
  { id: 'H051', code: 'H051', name: 'Half Round Ottoman', cat: 'soft', w: 2, d: 2, h: 12, cost: 749, color: '#E8B4A0', icon: '🌗', tags: ['seat:ottoman', 'soft', 'absorb'], seats: 3 },
  { id: 'H047', code: 'H047', name: 'Crash Mat', cat: 'soft', w: 2, d: 2, h: 8, cost: 599, color: '#FF9A76', icon: '🟥', tags: ['seat:floor', 'soft', 'absorb', 'calm'], seats: 2 },
  { id: 'C044', code: 'C044', name: 'Grass Collection', cat: 'soft', w: 3, d: 3, h: 14, cost: 4699, color: '#7DBE5A', icon: '🌱', tags: ['seat:ottoman', 'soft', 'absorb', 'nature'], seats: 6 },
  { id: 'rug', name: 'Rug (1.2 × 1.2 m)', cat: 'soft', w: 2, d: 2, h: 1, cost: 250, color: '#E8C9A0', icon: '', tags: ['soft', 'absorb', 'floor'] },

  // Quiet & sensory (Beparta)
  { id: 'M002', code: 'M002', name: 'Sensory Comfort Nook', cat: 'sensory', w: 2, d: 1, h: 66, cost: 2999, color: '#C0ADFF', icon: '🏕️', tags: ['quiet', 'escape', 'soft', 'absorb', 'absorb', 'books', 'seat:nook'] },
  { id: 'H052', code: 'H052', name: 'Hooded Seat – Double', cat: 'sensory', w: 3, d: 1, h: 64, cost: 4045, color: '#4C34E5', icon: '🛖', tags: ['quiet', 'escape', 'soft', 'absorb', 'absorb', 'storage', 'seat:nook'], seats: 3 },
  { id: 'M016', code: 'M016', name: 'BEZONE Pod – Double', cat: 'sensory', w: 2, d: 2, h: 64, cost: 5406, color: '#00BC74', icon: '🫧', tags: ['quiet', 'escape', 'absorb', 'absorb', 'storage', 'seat:pod'], seats: 2 },
  { id: 'M014', code: 'M014', name: 'BEHOUSE Cubby', cat: 'sensory', w: 3, d: 3, h: 80, cost: 3999, color: '#F2D49B', icon: '🏠', tags: ['quiet', 'escape', 'soft', 'absorb', 'seat:nook'], seats: 4 },
  { id: 'M018', code: 'M018', name: 'Collab-Pod', cat: 'sensory', w: 2, d: 2, h: 42, cost: 2399, color: '#6BE7BE', icon: '🧺', tags: ['quiet', 'soft', 'absorb', 'seat:pod'], seats: 2 },
  { id: 'T080', code: 'T080', name: 'Sensory Exploration Carrel', cat: 'sensory', w: 1, d: 1, h: 34, cost: 829, color: '#FFCD1F', icon: '🔍', tags: ['desk', 'quiet', 'sensory', 'carrel'] },
  { id: 'T003', code: 'T003', name: 'Sensory Table', cat: 'sensory', w: 2, d: 2, h: 22, cost: 699, color: '#FF6D3A', icon: '🖐️', tags: ['sensory', 'fidget', 'group'] },
  { id: 'M006', code: 'M006', name: 'Room Divider', cat: 'sensory', w: 2, d: 1, h: 28, cost: 1349, color: '#8C9A9B', icon: '🧱', tags: ['divider', 'absorb'] },

  // Storage & books (Beparta)
  { id: 'S009', code: 'S009', name: 'Straight Bookcase Single', cat: 'storage', w: 2, d: 1, h: 34, cost: 499, color: '#A67C52', icon: '📚', tags: ['books', 'storage'] },
  { id: 'S004', code: 'S004', name: 'Front Book Display', cat: 'storage', w: 2, d: 1, h: 34, cost: 1149, color: '#C9A06B', icon: '📖', tags: ['books', 'storage'] },
  { id: 'S015', code: 'S015', name: 'Essential 9 Shelf Storage', cat: 'storage', w: 2, d: 1, h: 31, cost: 889, color: '#E6D3B0', icon: '🗄️', tags: ['storage'] },
  { id: 'C084', code: 'C084', name: 'Tote Caddy (6 Tray)', cat: 'storage', w: 1, d: 1, h: 24, cost: 629, color: '#3C8CE8', icon: '🗃️', tags: ['storage'] },
  { id: 'C140', code: 'C140', name: 'Bag Storage', cat: 'storage', w: 3, d: 1, h: 32, cost: 2598, color: '#B8C4CF', icon: '🎒', tags: ['storage', 'storage'] },
  { id: 'S017', code: 'S017', name: 'Storage Planter Unit', cat: 'storage', w: 1, d: 1, h: 43, cost: 679, color: '#6B8E23', icon: '🪴', tags: ['storage', 'nature', 'divider'] },
  { id: 'M003', code: 'M003', name: 'Magnetic Mobile Whiteboard', cat: 'storage', w: 1, d: 1, h: 57, cost: 1499, color: '#F4F4F4', icon: '⬜', tags: ['clutter'] },

  // Supports (generic)
  { id: 'headphones', name: 'Headphone station', cat: 'supports', w: 1, d: 1, h: 24, cost: 200, color: '#272A24', icon: '🎧', tags: ['headphones', 'absorb'] },
  { id: 'lamp', name: 'Dimmable lamp', cat: 'supports', w: 1, d: 1, h: 50, cost: 120, color: '#FFE89A', icon: '💡', tags: ['lamp'] },
  { id: 'bubble', name: 'Sensory bubble tube', cat: 'supports', w: 1, d: 1, h: 56, cost: 250, color: '#6BE7BE', icon: '🫧', tags: ['sensory', 'calm'] },
  { id: 'weighted', name: 'Weighted blanket basket', cat: 'supports', w: 1, d: 1, h: 14, cost: 100, color: '#9B8BD6', icon: '🧺', tags: ['calm', 'soft'] },
  { id: 'timetable', name: 'Visual timetable board', cat: 'supports', w: 1, d: 1, h: 46, cost: 90, color: '#00BC74', icon: '🗓️', tags: ['predictable'] },
  { id: 'fidget', name: 'Fidget tub', cat: 'supports', w: 1, d: 1, h: 14, cost: 80, color: '#FFCD1F', icon: '🌀', tags: ['fidget', 'loud'] },
  { id: 'panel', name: 'Acoustic screen', cat: 'supports', w: 2, d: 1, h: 52, cost: 300, color: '#6E7F80', icon: '🔇', tags: ['absorb', 'absorb', 'divider'] },

  // Nature & play (generic)
  { id: 'plant', name: 'Pot plant', cat: 'nature', w: 1, d: 1, h: 30, cost: 60, color: '#00BC74', icon: '🪴', tags: ['nature'] },
  { id: 'bigplant', name: 'Large plant', cat: 'nature', w: 1, d: 1, h: 60, cost: 120, color: '#0A9B60', icon: '🌳', tags: ['nature', 'absorb'] },
  { id: 'pet', name: 'Class pet tank', cat: 'nature', w: 1, d: 1, h: 34, cost: 300, color: '#8FD3F4', icon: '🐠', tags: ['nature', 'animal', 'calm'] },
  { id: 'lego', name: 'Lego table', cat: 'nature', w: 2, d: 2, h: 20, cost: 280, color: '#E84A3C', icon: '🧱', tags: ['toys', 'loud', 'clutter'] },
  { id: 'toybox', name: 'Toy box', cat: 'nature', w: 1, d: 1, h: 18, cost: 90, color: '#3C8CE8', icon: '🧸', tags: ['toys', 'loud', 'storage'] },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const seatsOf = def => (def.tags.some(t => t.startsWith('seat:')) ? def.seats || 1 : 0);

// 1 tile = 600 mm, so the standard room is 8.4 × 7.2 m (~60 m²).
export const ROOM_PRESETS = [
  { id: 'small', name: 'Small room (6 × 6 m)', cols: 10, rows: 10 },
  { id: 'standard', name: 'Classroom (8.4 × 7.2 m)', cols: 14, rows: 12 },
  { id: 'large', name: 'Open plan (10.8 × 9.6 m)', cols: 18, rows: 16 },
];

export const BUDGETS = [15000, 25000, 40000];

export const LIGHT_TYPES = [
  { id: 'fluoro', name: 'Fluorescent', flicker: true, warm: 0 },
  { id: 'led', name: 'LED (cool)', flicker: false, warm: 0.3 },
  { id: 'warm', name: 'Warm dimmable', flicker: false, warm: 1 },
];

export const WALL_COLOURS = [
  { id: 'muted', name: 'Muted sage', color: '#C9D4C5', calm: 1 },
  { id: 'white', name: 'Stark white', color: '#F7F7F7', calm: 0.5 },
  { id: 'bright', name: 'Bright primary', color: '#FF6D3A', calm: 0 },
];

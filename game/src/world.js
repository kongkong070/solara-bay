// Solara Bay's city: a deterministic coastal grid built from a seeded RNG,
// so the same seed always builds the same streets, blocks and landmarks.

import { BEACH_EDGE, BUILDING_COLORS, CRATE_COUNT, PACKAGE_COUNT, SEA_EDGE, WORLD_H, WORLD_W } from './config.js';
import { clamp, pointInRect, pushOutOfRect, range, rangeInt } from './util.js';

export const AVENUES = [800, 1200, 1600, 2000, 2400, 2800, 3200];
export const STREETS = [350, 750, 1150, 1550, 1950, 2350];
export const ROAD_W = 90;

const KEEP_CLEAR = [
  { x: 3050, y: 500, w: 400, h: 400 }, // Bay Stadium
  { x: 1900, y: 1050, w: 250, h: 200 }, // City Hall
  { x: 700, y: 1800, w: 250, h: 200 }, // Marina Penthouse
  { x: 600, y: 2400, w: 400, h: 300 }, // The Docks
  { x: 1850, y: 1450, w: 300, h: 200 }, // Downtown Plaza
  { x: 480, y: 180, w: 300, h: 240 }, // Marina
  { x: 1200, y: 750, w: 400, h: 400 }, // North Park
  { x: 2400, y: 1550, w: 400, h: 400 }, // South Park
];

function overlapsClear(r) {
  for (const c of KEEP_CLEAR) {
    if (r.x < c.x + c.w && r.x + r.w > c.x && r.y < c.y + c.h && r.y + r.h > c.y) return true;
  }
  return false;
}

export function buildCity(rng) {
  const city = {
    avenues: AVENUES.slice(),
    streets: STREETS.slice(),
    roadW: ROAD_W,
    solids: [],
    parks: [],
    landmarks: [],
    pier: { x: 180, y: 1330, w: 420, h: 140 },
    marina: { x: 480, y: 180, w: 300, h: 240 },
    docks: { x: 600, y: 2400, w: 400, h: 300 },
    stadium: { x: 3050, y: 500, w: 400, h: 400 },
    plaza: { x: 1850, y: 1450, w: 300, h: 200 },
    cityHall: { x: 1900, y: 1050, w: 250, h: 200 },
    penthouse: { x: 700, y: 1800, w: 250, h: 200 },
    buoys: [
      { x: 250, y: 700, done: false },
      { x: 180, y: 1400, done: false },
      { x: 300, y: 2100, done: false },
    ],
    packages: [],
    crates: [],
    spawn: { x: 700, y: 1400 },
  };

  // Landmark labels for the minimap and the world itself.
  city.landmarks = [
    { name: 'Sunset Pier', x: 390, y: 1400 },
    { name: 'Marina', x: 630, y: 300 },
    { name: 'Bay Stadium', x: 3250, y: 700 },
    { name: 'City Hall', x: 2025, y: 1150 },
    { name: 'Marina Penthouse', x: 825, y: 1900 },
    { name: 'The Docks', x: 800, y: 2550 },
    { name: 'Beachfront', x: 540, y: 900 },
    { name: 'Downtown Plaza', x: 2000, y: 1550 },
  ];

  // Fill every block between the roads with buildings, except the clear
  // zones (landmarks, parks, the docks yard) and the two park blocks.
  const xs = [BEACH_EDGE + 45, ...AVENUES, WORLD_W - 45];
  const ys = [45, ...STREETS, WORLD_H - 45];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx0 = xs[bi] + ROAD_W / 2 + 12;
      const bx1 = xs[bi + 1] - ROAD_W / 2 - 12;
      const by0 = ys[bj] + ROAD_W / 2 + 12;
      const by1 = ys[bj + 1] - ROAD_W / 2 - 12;
      if (bx1 - bx0 < 90 || by1 - by0 < 90) continue;
      const block = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
      if (overlapsClear(block)) {
        if (block.x >= 1200 && block.x < 1600 && block.y >= 750 && block.y < 1150) {
          city.parks.push({ ...block, name: 'North Park' });
        } else if (block.x >= 2400 && block.x < 2800 && block.y >= 1550 && block.y < 1950) {
          city.parks.push({ ...block, name: 'South Park' });
        }
        continue;
      }
      const n = rangeInt(rng, 1, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 90, Math.min(220, block.w - 20));
        const h = range(rng, 80, Math.min(180, block.h - 20));
        const x = range(rng, block.x, block.x + block.w - w);
        const y = range(rng, block.y, block.y + block.h - h);
        const b = { x, y, w, h, color: BUILDING_COLORS[rangeInt(rng, 0, BUILDING_COLORS.length - 1)], kind: 'building' };
        let bad = false;
        for (const s of city.solids) {
          if (b.x < s.x + s.w + 14 && b.x + b.w + 14 > s.x && b.y < s.y + s.h + 14 && b.y + b.h + 14 > s.y) { bad = true; break; }
        }
        if (!bad) city.solids.push(b);
      }
    }
  }

  // Solid landmark structures: the hall, the penthouse tower and the dock
  // containers. The stadium bowl and the plaza stay walkable.
  city.solids.push({ ...city.cityHall, color: '#d8cfc0', kind: 'hall' });
  city.solids.push({ ...city.penthouse, color: '#3f5a7a', kind: 'tower' });
  city.solids.push({ x: 640, y: 2440, w: 130, h: 60, color: '#b3543f', kind: 'container' });
  city.solids.push({ x: 820, y: 2440, w: 130, h: 60, color: '#4f7d5a', kind: 'container' });
  city.solids.push({ x: 640, y: 2560, w: 130, h: 60, color: '#c9a227', kind: 'container' });

  // The 12 hidden cash packages, at fixed spots a player can learn.
  const packageSpots = [
    [220, 1400], [540, 900], [545, 2100], [700, 200], [950, 2650],
    [3060, 700], [2000, 1550], [2025, 1290], [980, 1900], [1400, 950],
    [1750, 2050], [3300, 300],
  ];
  city.packages = packageSpots.slice(0, PACKAGE_COUNT).map(([x, y]) => ({ x, y, taken: false }));

  // Supply crates: health, armour and ammo, respawning after a minute.
  const crateSpots = [
    [700, 1500], [1500, 600], [2500, 1200], [3200, 2200],
    [900, 2600], [2100, 2200], [1400, 2400], [3400, 1400],
  ];
  city.crates = crateSpots.slice(0, CRATE_COUNT).map(([x, y]) => ({ x, y, timer: 0, ready: true }));

  return city;
}

export function onPier(x, y, city) {
  return pointInRect(x, y, city.pier);
}

export function isWater(x, y, city) {
  if (x >= SEA_EDGE) return false;
  return !onPier(x, y, city);
}

export function onRoad(x, y, city) {
  for (const ax of city.avenues) {
    if (Math.abs(x - ax) <= city.roadW / 2) return 'v';
  }
  for (const sy of city.streets) {
    if (Math.abs(y - sy) <= city.roadW / 2) return 'h';
  }
  return null;
}

// Keep a walker inside the world, out of the sea and out of buildings.
export function collideWalker(pos, radius, city) {
  pos.x = clamp(pos.x, 30, WORLD_W - 30);
  pos.y = clamp(pos.y, 30, WORLD_H - 30);
  if (pos.x < SEA_EDGE && !onPier(pos.x, pos.y, city)) {
    pos.x = SEA_EDGE;
  }
  for (const s of city.solids) {
    pushOutOfRect(pos, radius, s);
  }
}

// Keep a car on land and out of buildings. Cars may cross the beach but
// never the water.
export function collideCar(pos, radius, city) {
  pos.x = clamp(pos.x, SEA_EDGE + 10, WORLD_W - 30);
  pos.y = clamp(pos.y, 30, WORLD_H - 30);
  for (const s of city.solids) {
    pushOutOfRect(pos, radius, s);
  }
}

export function randomRoadPoint(rng, city) {
  if (rng() < 0.5) {
    const ax = city.avenues[rangeInt(rng, 0, city.avenues.length - 1)];
    return { x: ax + range(rng, -18, 18), y: range(rng, 120, WORLD_H - 120), axis: 'v', dir: rng() < 0.5 ? 1 : -1 };
  }
  const sy = city.streets[rangeInt(rng, 0, city.streets.length - 1)];
  return { x: range(rng, 700, WORLD_W - 120), y: sy + range(rng, -18, 18), axis: 'h', dir: rng() < 0.5 ? 1 : -1 };
}

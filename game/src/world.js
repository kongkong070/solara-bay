// Solara Bay itself: a coastal grid city generated from a seed.
// Roads, blocks, buildings, parks, a beach and a pier. Everything the game
// collides with or draws lives here, so the renderer and the AI share it.
import { WORLD, COLORS } from './config.js';
import { makeRng, pick, range, rangeInt, shuffle } from './random.js';

export const KIND_BUILDING = 'building';
export const KIND_PARK = 'park';

// A block is the land between four roads. `park` blocks hold trees and a
// pond instead of buildings.
// Landmark note: the 11th supply crate sits by the North Gate, so the
// chill-start neighbourhood has a health crate within a short walk.
function buildBlocks(rng) {
  const blocks = [];
  const xs = WORLD.roadsX;
  const ys = WORLD.roadsY;
  const parkSpots = new Set(['2,1', '4,3', '1,4', '5,1']);
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + WORLD.roadWidth / 2 + WORLD.blockPad;
      const x1 = xs[i + 1] - WORLD.roadWidth / 2 - WORLD.blockPad;
      const y0 = ys[j] + WORLD.roadWidth / 2 + WORLD.blockPad;
      const y1 = ys[j + 1] - WORLD.roadWidth / 2 - WORLD.blockPad;
      const key = i + ',' + j;
      const park = parkSpots.has(key);
      const block = { x0, y0, x1, y1, park, buildings: [], trees: [], pond: null };
      if (park) {
        for (let t = 0; t < 9; t += 1) {
          block.trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 9, 15) });
        }
        if (rng() < 0.7) block.pond = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, rx: range(rng, 40, 70), ry: range(rng, 26, 44) };
      } else {
        const count = rangeInt(rng, 1, 3);
        for (let b = 0; b < count; b += 1) {
          const bw = range(rng, 90, (x1 - x0) / count - 24);
          const bh = range(rng, 80, (y1 - y0) - 24);
          const bx = x0 + ((x1 - x0) / count) * b + 12;
          const by = y0 + 12 + rng() * Math.max(1, (y1 - y0) - bh - 24);
          block.buildings.push({
            x: bx, y: by, w: bw, h: bh,
            height: rangeInt(rng, 1, 4),
            roof: pick(rng, COLORS.buildingRoof),
            wall: pick(rng, COLORS.buildingWall),
            windows: rangeInt(rng, 2, 5),
          });
        }
      }
      blocks.push(block);
    }
  }
  return blocks;
}

// Landmarks the missions and the minimap point at.
function buildLandmarks() {
  return {
    garage: { x: 600, y: 1000, name: "Lena's Garage" },
    safehouse: { x: 2600, y: 600, name: 'Safehouse' },
    docks: { x: 3000, y: 2200, name: 'Solara Docks' },
    penthouse: { x: 1400, y: 200, name: 'Marina Penthouse' },
    beachBar: { x: 1000, y: 2400, name: 'Palma Beach Bar' },
    plaza: { x: 1800, y: 1400, name: 'Solara Plaza' },
    stadium: { x: 2200, y: 1800, name: 'Bay Stadium' },
    nightclub: { x: 2200, y: 400, name: 'Neon Palms' },
    pier: { x: 1480, y: 2440, name: 'Sunset Pier' },
  };
}

// Supply crates: health, armour and ammo, shuffled across fixed spots so
// the same seed always deals the same layout. They respawn after
// PICKUPS.respawnSeconds; taken crates come back for the next run.
export const PICKUP_SPOTS = [
  [820, 420, 'health'], [2580, 820, 'armor'], [420, 1620, 'ammo'],
  [2020, 1220, 'health'], [1220, 1980, 'armor'], [2820, 1620, 'ammo'],
  [1620, 820, 'health'], [620, 2200, 'ammo'], [2420, 2200, 'health'],
  [1000, 2440, 'armor'], [600, 420, 'health'],
];

function buildPickups(rng) {
  const kinds = shuffle(rng, PICKUP_SPOTS.map((s) => s[2]));
  return PICKUP_SPOTS.map(([x, y], i) => ({
    x, y, kind: kinds[i], taken: false, respawnT: 0,
  }));
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const blocks = buildBlocks(rng);
  const landmarks = buildLandmarks();
  // Hidden cash packages scattered where a curious player looks.
  const packages = [];
  const spots = [
    [420, 420], [2580, 420], [420, 1980], [2980, 1980], [1620, 420],
    [820, 1620], [2420, 1220], [1220, 820], [2820, 820], [620, 1220],
    [2020, 2020], [1000, 2440],
  ];
  for (const [x, y] of spots) packages.push({ x, y, taken: false });
  const world = { seed, blocks, landmarks, packages, pickups: buildPickups(rng), rng };
  return world;
}

// Respawn timer for supply crates, ticked from the main loop.
export function updatePickups(world, dt) {
  for (const pk of world.pickups) {
    if (!pk.taken || pk.respawnT <= 0) continue;
    pk.respawnT -= dt;
    if (pk.respawnT <= 0) pk.taken = false;
  }
}

export function isOnRoad(x, y) {
  if (y > WORLD.beachTop) return false;
  for (const rx of WORLD.roadsX) if (Math.abs(x - rx) <= WORLD.roadWidth / 2) return true;
  for (const ry of WORLD.roadsY) if (Math.abs(y - ry) <= WORLD.roadWidth / 2) return true;
  return false;
}

export function isWater(x, y) {
  return y >= WORLD.waterTop;
}

export function isSand(x, y) {
  return y >= WORLD.beachTop && y < WORLD.waterTop;
}

// The building (if any) whose footprint contains the point.
export function buildingAt(world, x, y) {
  for (const block of world.blocks) {
    for (const b of block.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
  }
  return null;
}

// Push a circle out of every building it overlaps; returns true on a hit.
export function collideBuildings(world, body) {
  let hit = false;
  for (const block of world.blocks) {
    for (const b of block.buildings) {
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      const r = body.radius || 12;
      if (d2 < r * r) {
        hit = true;
        const d = Math.sqrt(d2) || 0.001;
        const push = r - d;
        body.x += (dx / d) * push;
        body.y += (dy / d) * push;
      }
    }
  }
  return hit;
}

export function clampToWorld(body, margin) {
  const m = margin || 12;
  body.x = Math.max(m, Math.min(WORLD.width - m, body.x));
  body.y = Math.max(m, Math.min(WORLD.height - m, body.y));
}

// Nearest road centre to a point, for traffic and spawning.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of WORLD.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of WORLD.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

// A random point on a road, away from the given point.
export function randomRoadPoint(rng, awayFrom, minDist) {
  for (let tries = 0; tries < 40; tries += 1) {
    const vertical = rng() < 0.5;
    const x = vertical ? pick(rng, WORLD.roadsX) : range(rng, 120, WORLD.width - 120);
    const y = vertical ? range(rng, 120, WORLD.beachTop - 140) : pick(rng, WORLD.roadsY);
    if (!awayFrom || Math.hypot(x - awayFrom.x, y - awayFrom.y) >= (minDist || 0)) return { x, y };
  }
  return { x: 1000, y: 1000 };
}

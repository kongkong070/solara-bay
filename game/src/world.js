// Solara Bay's city: the road grid, the building blocks, the parks, the
// beach and the sea, plus the collision helpers the rest of the game uses.
import { WORLD, ROADS_X, ROADS_Y, LANDMARKS, BUOYS } from './config.js';
import { clamp, dist } from './util.js';

// One city block's building: a rectangle, a palette pick, a height for
// the fake shadow and a window count for the roof.
function makeBuilding(rng, x, y, w, h) {
  const palettes = [
    ['#d8b48a', '#b98d5f'], ['#e8d8b0', '#c9b183'], ['#a8c8d8', '#7fa3b5'],
    ['#d8a0a0', '#b57f7f'], ['#b0d0a8', '#88a878'], ['#c8c8d8', '#9d9db5'],
  ];
  const pal = rng.pick(palettes);
  return {
    x, y, w, h,
    roof: pal[0], wall: pal[1],
    floors: rng.int(1, 6),
    windows: rng.int(2, 6),
  };
}

export function buildWorld(rng) {
  const buildings = [];
  const parks = [];
  const palms = [];
  // Every block between neighbouring roads gets buildings, except the
  // three blocks we keep as parks.
  const parkBlocks = new Set(['2,2', '5,1', '3,4']);
  for (let ix = 0; ix < ROADS_X.length - 1; ix++) {
    for (let iy = 0; iy < ROADS_Y.length - 1; iy++) {
      const x0 = ROADS_X[ix] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const x1 = ROADS_X[ix + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      const y0 = ROADS_Y[iy] + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const y1 = ROADS_Y[iy + 1] - WORLD.roadWidth / 2 - WORLD.sidewalk;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (parkBlocks.has(ix + ',' + iy)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // Two buildings per block, split along the longer side.
      if ((x1 - x0) > (y1 - y0)) {
        const mid = x0 + (x1 - x0) * rng.range(0.42, 0.58);
        buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, mid - x0 - 16, y1 - y0 - 16));
        buildings.push(makeBuilding(rng, mid + 8, y0 + 8, x1 - mid - 16, y1 - y0 - 16));
      } else {
        const mid = y0 + (y1 - y0) * rng.range(0.42, 0.58);
        buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, x1 - x0 - 16, mid - y0 - 16));
        buildings.push(makeBuilding(rng, x0 + 8, mid + 8, x1 - x0 - 16, y1 - mid - 16));
      }
    }
  }
  // Palms along the beach and inside the parks.
  for (let i = 0; i < 46; i++) {
    palms.push({
      x: rng.range(80, WORLD.width - 80),
      y: rng.range(WORLD.beachTop + 40, WORLD.seaTop - 30),
      lean: rng.range(-0.3, 0.3),
    });
  }
  for (const park of parks) {
    for (let i = 0; i < 5; i++) {
      palms.push({
        x: rng.range(park.x + 20, park.x + park.w - 20),
        y: rng.range(park.y + 20, park.y + park.h - 20),
        lean: rng.range(-0.25, 0.25),
      });
    }
  }
  // The pier reaches out from the beach into the sea.
  const pier = { x: 1660, y: WORLD.seaTop - 10, w: 120, h: 210 };
  // The marina: a wooden jetty on the east side of the bay where the
  // speedboats are moored, plus the buoy line for the Bay Runner run.
  const marina = {
    x: WORLD.marina.x - 150,
    y: WORLD.seaTop - 10,
    w: 300,
    h: 150,
  };
  const buoys = BUOYS.map((b) => ({ x: b.x, y: b.y, r: 16 }));
  return {
    roadsX: ROADS_X, roadsY: ROADS_Y,
    buildings, parks, palms, pier, marina, buoys,
    landmarks: LANDMARKS,
  };
}

// True when the circle (x, y, r) overlaps any building.
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) {
      return b;
    }
  }
  return null;
}

// Push a circle out of buildings, axis by axis, so it slides along walls.
export function slideOutOfBuildings(world, ent, r) {
  const b = hitsBuilding(world, ent.x, ent.y, r);
  if (!b) return;
  const cx = clamp(ent.x, b.x, b.x + b.w);
  const cy = clamp(ent.y, b.y, b.y + b.h);
  const dx = ent.x - cx;
  const dy = ent.y - cy;
  if (dx * dx + dy * dy > 0.01) {
    const d = Math.hypot(dx, dy);
    ent.x = cx + (dx / d) * (r + 0.5);
    ent.y = cy + (dy / d) * (r + 0.5);
  } else if (ent.px !== undefined) {
    // The centre is inside the building: step back to the last good spot.
    ent.x = ent.px;
    ent.y = ent.py;
  }
}

export function isOnRoad(world, x, y) {
  const rw = WORLD.roadWidth / 2;
  for (const rx of world.roadsX) if (Math.abs(x - rx) < rw) return true;
  for (const ry of world.roadsY) if (Math.abs(y - ry) < rw) return true;
  return false;
}

// Closest point on any road centre line to (x, y).
export function nearestRoadPoint(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of world.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of world.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}

// A random point on a road, at least `away` from (fx, fy).
export function randomRoadPoint(rng, world, fx, fy, away) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng.chance(0.5);
    const p = vertical
      ? { x: rng.pick(world.roadsX), y: rng.range(80, WORLD.height - 80) }
      : { x: rng.range(80, WORLD.width - 80), y: rng.pick(world.roadsY) };
    if (dist(p.x, p.y, fx, fy) >= away) return p;
  }
  return { x: ROADS_X[4], y: ROADS_Y[3] };
}

// Is (x, y) inside the world, allowing a margin?
export function insideWorld(x, y, margin) {
  return x > margin && x < WORLD.width - margin &&
    y > margin && y < WORLD.height - margin;
}

// True when the entity's circle overlaps any building.
export function collideBuildings(world, ent) {
  return hitsBuilding(world, ent.x, ent.y, ent.radius || 20) !== null;
}

// Keep an entity inside the world rectangle.
export function clampToWorld(ent, margin) {
  ent.x = clamp(ent.x, margin, WORLD.width - margin);
  ent.y = clamp(ent.y, margin, WORLD.height - margin);
}

// True when (x, y) is in open water — boats only, no walking there.
export function isInWater(x, y) {
  return y >= WORLD.waterTop;
}

// True when (x, y) is on the pier or the marina jetty (walkable wood
// over the water).
export function isOnDock(world, x, y) {
  const pier = world.pier;
  if (x > pier.x && x < pier.x + pier.w && y > pier.y && y < pier.y + pier.h) return true;
  const marina = world.marina;
  if (x > marina.x && x < marina.x + marina.w && y > marina.y && y < marina.y + marina.h) return true;
  return false;
}

// The nearest dry spot to (x, y): the pier, the marina jetty, or the
// beach just above the water line.
export function nearestShore(world, x, y) {
  const spots = [
    { x: world.pier.x + world.pier.w / 2, y: world.pier.y + 30 },
    { x: world.marina.x + world.marina.w / 2, y: world.marina.y + 30 },
    { x: clamp(x, 60, WORLD.width - 60), y: WORLD.beachTop + 40 },
  ];
  let best = spots[0];
  let bestD = Infinity;
  for (const s of spots) {
    const d = dist(x, y, s.x, s.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

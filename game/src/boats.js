// Boats: speedboats and a dinghy moored at the marina and the pier. The
// SBPD cannot follow onto the water, but the heat is still on when the
// player comes back to shore.

import { BOAT_TYPES, SEA_EDGE, WORLD_H } from './config.js';
import { clamp, dist, range } from './util.js';
import { onPier } from './world.js';

export function spawnBoats(S) {
  S.boats = [
    makeBoat(S, 'speedboat', 420, 250, Math.PI / 2, 'Marina'),
    makeBoat(S, 'speedboat', 420, 340, Math.PI / 2, 'Marina'),
    makeBoat(S, 'dinghy', 400, 1420, 0, 'Sunset Pier'),
  ];
}

export function makeBoat(S, typeKey, x, y, angle, mooring) {
  const type = BOAT_TYPES[typeKey];
  return {
    kind: 'boat',
    type: typeKey,
    label: type.label,
    color: type.color,
    x, y,
    angle,
    speed: 0,
    maxSpeed: type.maxSpeed,
    accel: type.accel,
    turn: type.turn,
    w: type.w,
    h: type.h,
    mooring,
    occupied: false,
    wakeTimer: 0,
  };
}

// Sail a boat: throttle, slow wide turns, heavy drag. Boats stay in the
// water — the shore and the pier push them back.
export function sailBoat(S, boat, input, dt) {
  const type = BOAT_TYPES[boat.type];
  let throttle = 0;
  if (input.up) throttle = 1;
  if (input.down) throttle = -0.5;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);

  boat.speed += throttle * type.accel * dt;
  boat.speed -= boat.speed * 0.5 * dt;
  boat.speed = clamp(boat.speed, -140, type.maxSpeed);

  const authority = clamp(Math.abs(boat.speed) / 200, 0, 1);
  boat.angle += steer * authority * type.turn * 0.5 * (boat.speed >= 0 ? 1 : -1) * dt;

  boat.x += Math.cos(boat.angle) * boat.speed * dt;
  boat.y += Math.sin(boat.angle) * boat.speed * dt;

  // Confined to the sea: the beach line, the map edges and the pier deck.
  boat.x = clamp(boat.x, 40, SEA_EDGE + 70);
  boat.y = clamp(boat.y, 40, WORLD_H - 40);
  if (onPier(boat.x, boat.y, S.city)) {
    boat.x -= Math.cos(boat.angle) * boat.speed * dt * 2;
    boat.y -= Math.sin(boat.angle) * boat.speed * dt * 2;
    boat.speed *= 0.4;
  }

  // Wake: white flecks trailing the stern while moving.
  boat.wakeTimer -= dt;
  if (Math.abs(boat.speed) > 60 && boat.wakeTimer <= 0) {
    boat.wakeTimer = 0.05;
    const bx = boat.x - Math.cos(boat.angle) * (boat.w / 2);
    const by = boat.y - Math.sin(boat.angle) * (boat.h / 2);
    S.particles.push({
      x: bx + range(S.rng, -6, 6),
      y: by + range(S.rng, -6, 6),
      vx: -Math.cos(boat.angle) * 40 + range(S.rng, -20, 20),
      vy: -Math.sin(boat.angle) * 40 + range(S.rng, -20, 20),
      life: 0.9, maxLife: 0.9,
      color: 'rgba(240,250,255,0.55)', size: range(S.rng, 3, 7), kind: 'wake',
    });
  }
  return boat.speed;
}

export function nearestBoat(S, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const boat of S.boats) {
    if (boat.occupied) continue;
    const d = dist(boat.x, boat.y, S.player.x, S.player.y);
    if (d < bestD) {
      best = boat;
      bestD = d;
    }
  }
  return best;
}

// Step back onto land: the pier deck or the beach edge.
export function shorePointNear(S, boat) {
  if (onPier(boat.x, boat.y, S.city)) {
    return { x: boat.x, y: boat.y };
  }
  // Nearest point on the beach, just east of the waterline.
  return { x: SEA_EDGE + 16, y: clamp(boat.y, 60, WORLD_H - 60) };
}

// Boats on the bay: speedboats and dinghies moored at the marina and
// the pier, with water physics — slower to get going than a car, but
// they glide, drift and leave a wake behind them.
import { WORLD, BOAT_TYPES, TUNING } from './config.js';
import { clamp, angleDiff } from './util.js';
import { clampToWorld } from './world.js';

export function makeBoat(rng, type, x, y, angle) {
  const spec = BOAT_TYPES[type] || BOAT_TYPES.speedboat;
  return {
    kind: 'boat',
    type,
    spec,
    x, y,
    angle: angle || 0,
    speed: 0,
    vx: 0, vy: 0,
    w: spec.w, h: spec.h,
    radius: 24,
    color: spec.color,
    driver: null, // 'player' | null (moored)
    bob: rng.range(0, Math.PI * 2),
    wakeTimer: 0,
  };
}

// Water physics: gentle acceleration, low drag so the boat glides,
// wide turns that bite less at low speed.
export function driveBoat(boat, dt, throttle, steer) {
  const spec = boat.spec;
  const maxSpeed = TUNING.boatMaxSpeed * spec.top;
  if (throttle > 0) {
    boat.speed += TUNING.boatAccel * spec.accel * throttle * dt;
  } else if (throttle < 0) {
    boat.speed -= TUNING.boatAccel * 0.5 * dt;
  }
  boat.speed -= boat.speed * TUNING.boatDrag * dt;
  boat.speed = clamp(boat.speed, -TUNING.boatMaxSpeed * 0.25, maxSpeed);
  if (Math.abs(boat.speed) < 5 && throttle === 0) boat.speed = 0;
  const bite = clamp(Math.abs(boat.speed) / 120, 0, 1);
  boat.angle += TUNING.boatTurn * steer * bite * (boat.speed < 0 ? -1 : 1) * dt;
  boat.vx = Math.cos(boat.angle) * boat.speed;
  boat.vy = Math.sin(boat.angle) * boat.speed;
  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;
  // Boats stay in the water: the beach line is a wall, the world edges too.
  if (boat.y < WORLD.waterTop) {
    boat.y = WORLD.waterTop;
    boat.speed *= 0.4;
  }
  clampToWorld(boat, 30);
}

// Three boats wait for Rio: two speedboats and a dinghy.
export function spawnBoats(game) {
  const spots = [
    { type: 'speedboat', x: WORLD.marina.x + 40, y: WORLD.marina.y + 110, angle: Math.PI / 2 },
    { type: 'speedboat', x: WORLD.pierDock.x - 90, y: WORLD.pierDock.y + 30, angle: 0 },
    { type: 'dinghy', x: WORLD.marina.x + 220, y: WORLD.marina.y + 110, angle: Math.PI / 2 },
  ];
  for (const s of spots) {
    game.boats.push(makeBoat(game.rng, s.type, s.x, s.y, s.angle));
  }
}

// Bob on the swell and throw a wake while moving.
export function updateBoats(game, dt) {
  for (const boat of game.boats) {
    boat.bob += dt * 1.6;
    boat.wakeTimer -= dt;
    if (Math.abs(boat.speed) > 90 && boat.wakeTimer <= 0) {
      boat.wakeTimer = 0.09;
      const back = boat.angle + Math.PI;
      game.addParticles(
        boat.x + Math.cos(back) * (boat.w / 2) + game.rng.range(-8, 8),
        boat.y + Math.sin(back) * (boat.w / 2) + game.rng.range(-8, 8),
        1, '#d8ecff',
      );
    }
  }
}

// The nearest moored boat to (x, y), within maxDist.
export function nearestBoat(game, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const boat of game.boats) {
    if (boat.driver) continue;
    const d = Math.hypot(boat.x - x, boat.y - y);
    if (d < bestD) { bestD = d; best = boat; }
  }
  return best;
}

// The nearest boat of a given type, moored or driven, for mission steps.
export function nearestBoatOfType(game, type, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const boat of game.boats) {
    if (boat.type !== type) continue;
    const d = Math.hypot(boat.x - x, boat.y - y);
    if (d < bestD) { bestD = d; best = boat; }
  }
  return best;
}

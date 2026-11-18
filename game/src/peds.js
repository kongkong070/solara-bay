// Pedestrians: they stroll the sidewalks, flee from gunfire and police
// chases, and a few of them want a taxi.
import { WORLD } from './config.js';
import { clamp, dist } from './util.js';
import { hitsBuilding, clampToWorld, insideWorld } from './world.js';

const SHIRTS = ['#d85a5a', '#5a8ad8', '#5ad88a', '#d8c95a', '#a05ad8', '#d88a5a', '#5ad8c9', '#e8e8e8'];

export function makePed(rng, x, y) {
  return {
    kind: 'ped',
    x, y,
    px: x, py: y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 52),
    radius: 11,
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(['#e8b88a', '#c98d5f', '#8a5f3d', '#f0c8a0']),
    state: 'walk', // 'walk' | 'flee' | 'down'
    targetX: x,
    targetY: y,
    retarget: 0,
    fleeX: 0,
    fleeY: 0,
    wantsTaxi: false,
    dead: false,
  };
}

export function spawnPeds(game, count) {
  for (let i = 0; i < count; i++) {
    const x = game.rng.range(120, WORLD.width - 120);
    const y = game.rng.range(120, WORLD.beachTop - 60);
    if (hitsBuilding(game.world, x, y, 14)) continue;
    const ped = makePed(game.rng, x, y);
    // One in eight pedestrians is looking for a cab.
    ped.wantsTaxi = game.rng.chance(0.12);
    game.peds.push(ped);
  }
}

// A pedestrian picks a new nearby spot to stroll toward.
function pickStrollTarget(game, ped) {
  const a = game.rng.range(0, Math.PI * 2);
  const d = game.rng.range(60, 260);
  ped.targetX = clamp(ped.x + Math.cos(a) * d, 60, WORLD.width - 60);
  ped.targetY = clamp(ped.y + Math.sin(a) * d, 60, WORLD.beachTop - 40);
  ped.retarget = game.rng.range(2, 6);
}

export function updatePeds(game, dt) {
  const player = game.player;
  for (const ped of game.peds) {
    if (ped.dead) continue;
    ped.px = ped.x;
    ped.py = ped.y;
    // Flee from gunfire, speeding cars and nearby police chases.
    let danger = null;
    if (game.recentShot && dist(ped.x, ped.y, game.recentShot.x, game.recentShot.y) < 320) {
      danger = game.recentShot;
    } else if (player.inCar && player.inCar.speed > 260 &&
      dist(ped.x, ped.y, player.x, player.y) < 200) {
      danger = player;
    } else if (game.police.wanted > 0 && dist(ped.x, ped.y, player.x, player.y) < 160) {
      danger = player;
    }
    if (danger) {
      ped.state = 'flee';
      ped.fleeX = ped.x - danger.x;
      ped.fleeY = ped.y - danger.y;
      const d = Math.hypot(ped.fleeX, ped.fleeY) || 1;
      ped.fleeX /= d;
      ped.fleeY /= d;
    } else if (ped.state === 'flee') {
      ped.state = 'walk';
      pickStrollTarget(game, ped);
    }
    if (ped.state === 'flee') {
      ped.x += ped.fleeX * 150 * dt;
      ped.y += ped.fleeY * 150 * dt;
      ped.angle = Math.atan2(ped.fleeY, ped.fleeX);
    } else {
      ped.retarget -= dt;
      const dx = ped.targetX - ped.x;
      const dy = ped.targetY - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 12 || ped.retarget <= 0) {
        pickStrollTarget(game, ped);
      } else {
        ped.angle = Math.atan2(dy, dx);
        ped.x += (dx / d) * ped.speed * dt;
        ped.y += (dy / d) * ped.speed * dt;
      }
    }
    if (hitsBuilding(game.world, ped.x, ped.y, ped.radius)) {
      ped.x = ped.px;
      ped.y = ped.py;
      pickStrollTarget(game, ped);
    }
    clampToWorld(ped, 30);
  }
}

// Knock a pedestrian down (a punch or a car hit). Returns the ped.
export function knockDown(game, ped) {
  ped.state = 'down';
  ped.dead = false;
  game.addParticles(ped.x, ped.y, 8, '#d85a5a');
  return ped;
}

// The nearest pedestrian who wants a taxi, within range of (x, y).
export function nearestFarePed(game, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of game.peds) {
    if (!ped.wantsTaxi || ped.state === 'down') continue;
    const d = dist(ped.x, ped.y, x, y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

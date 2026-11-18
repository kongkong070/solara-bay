// Pedestrians: they stroll the sidewalks, cross at corners, flee gunfire
// and panic when a car mounts the pavement. A few hail taxis.
import { WORLD } from './config.js';
import { pick, range, rangeInt } from './random.js';
import { collideBuildings, clampToWorld, isOnRoad } from './world.js';

const SHIRTS = ['#e07a3a', '#3a6fd8', '#4f8a6a', '#c94f8a', '#e8d44f', '#7a5ac9', '#d8d8d0', '#5ab8c9'];
const PANTS = ['#2c3242', '#4a3a2c', '#3a4a5a', '#5a2c2c'];

export function makePed(rng, x, y) {
  return {
    kind: 'ped',
    x, y, radius: 11,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 34, 62),
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, ['#e8b88a', '#c98a5a', '#8a5a3a', '#f0c8a0']),
    state: 'walk', // walk | flee | down | taxi
    stateT: 0,
    target: null,
    taxi: rng() < 0.22,
    dead: false,
    bob: rng() * 10,
  };
}

export function spawnPeds(game, count) {
  for (let i = 0; i < count; i += 1) {
    const x = range(game.rng, 100, WORLD.width - 100);
    const y = range(game.rng, 100, WORLD.beachTop - 60);
    if (isOnRoad(x, y)) continue;
    game.peds.push(makePed(game.rng, x, y));
  }
}

// Pick a nearby sidewalk point to wander toward.
function wanderTarget(game, ped) {
  for (let tries = 0; tries < 12; tries += 1) {
    const x = ped.x + range(game.rng, -260, 260);
    const y = ped.y + range(game.rng, -260, 260);
    if (x < 60 || y < 60 || x > WORLD.width - 60 || y > WORLD.beachTop - 30) continue;
    if (!isOnRoad(x, y)) return { x, y };
  }
  return { x: ped.x + 100, y: ped.y };
}

export function updatePed(game, ped, dt) {
  if (ped.dead) return;
  ped.bob += dt * 8;
  if (ped.state === 'down') {
    ped.stateT -= dt;
    if (ped.stateT <= 0) { ped.state = 'walk'; ped.target = null; }
    return;
  }
  // Flee from gunfire, the player's car, or a nearby chase.
  let danger = null;
  if (game.danger) {
    const d = Math.hypot(game.danger.x - ped.x, game.danger.y - ped.y);
    if (d < 260) danger = game.danger;
  }
  if (danger) {
    ped.state = 'flee';
    const a = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.x += Math.cos(a) * 150 * dt;
    ped.y += Math.sin(a) * 150 * dt;
    ped.angle = a;
    collideBuildings(game.world, ped);
    clampToWorld(ped, 14);
    if (Math.hypot(game.danger.x - ped.x, game.danger.y - ped.y) > 420) ped.state = 'walk';
    return;
  }
  if (ped.state === 'flee') ped.state = 'walk';
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 18) {
    ped.target = wanderTarget(game, ped);
  }
  const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
  ped.angle = a;
  ped.x += Math.cos(a) * ped.speed * dt;
  ped.y += Math.sin(a) * ped.speed * dt;
  collideBuildings(game.world, ped);
  clampToWorld(ped, 14);
}

export function knockPedDown(game, ped) {
  ped.state = 'down';
  ped.stateT = 6;
  game.addParticles(ped.x, ped.y, 8, '#d8d8d8');
}

export { rangeInt };

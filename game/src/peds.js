// The people of Solara Bay: pedestrians who stroll the sidewalks, scatter
// when shots are fired, and wave down taxis when they need a ride.

import { PLAYER, WORLD_H, WORLD_W } from './config.js';
import { clamp, dist, pick, range, rangeInt } from './util.js';
import { collideWalker, onRoad, randomRoadPoint } from './world.js';

const SHIRT_COLORS = ['#e07856', '#7fb069', '#6a8caf', '#c77dff', '#f2c14e', '#e8b4b8', '#a3d2ca', '#f4a261'];
const SKIN_COLORS = ['#f2c9a0', '#d9a06b', '#a06b3f', '#8a5a2e', '#f7d7b5'];

export function spawnPeds(S, count) {
  S.peds = [];
  for (let i = 0; i < count; i++) {
    const spot = randomRoadPoint(S.rng, S.city);
    S.peds.push(makePed(S, spot.x + range(S.rng, -120, 120), spot.y + range(S.rng, -120, 120)));
  }
}

function makePed(S, x, y) {
  return {
    x: clamp(x, 620, WORLD_W - 40),
    y: clamp(y, 40, WORLD_H - 40),
    angle: S.rng() * Math.PI * 2,
    speed: range(S.rng, 45, 80),
    shirt: pick(S.rng, SHIRT_COLORS),
    skin: pick(S.rng, SKIN_COLORS),
    state: 'walk', // walk | flee | wave | ride
    wait: range(S.rng, 0, 4),
    targetX: 0,
    targetY: 0,
    taxi: false,
    fare: null,
  };
}

function pickStrollTarget(S, ped) {
  const spot = randomRoadPoint(S.rng, S.city);
  ped.targetX = spot.x + range(S.rng, -160, 160);
  ped.targetY = spot.y + range(S.rng, -160, 160);
  ped.wait = range(S.rng, 1, 5);
}

export function updatePeds(S, dt) {
  const p = S.player;
  for (const ped of S.peds) {
    if (ped.state === 'ride') continue;

    // A gunshot or a speeding car nearby sends everyone running.
    const nearShot = S.events.shotFired > 0 && dist(ped.x, ped.y, S.events.shotX, S.events.shotY) < 420;
    const nearCar = p.vehicle && dist(ped.x, ped.y, p.x, p.y) < 90 && p.speed > 260;
    if ((nearShot || nearCar) && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.wait = range(S.rng, 1.2, 2.4);
      ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
    }

    if (ped.state === 'flee') {
      ped.wait -= dt;
      ped.x += Math.cos(ped.angle) * 190 * dt;
      ped.y += Math.sin(ped.angle) * 190 * dt;
      collideWalker(ped, 12, S.city);
      if (ped.wait <= 0) ped.state = 'walk';
      continue;
    }

    if (ped.state === 'wave') {
      // Waving peds stand still, arm up, hoping a car stops.
      ped.wait -= dt;
      if (ped.wait <= 0) {
        ped.state = 'walk';
        ped.taxi = false;
      }
      continue;
    }

    // Strolling: drift toward a target, then pause and pick a new one.
    if (ped.wait > 0) {
      ped.wait -= dt;
      if (ped.wait <= 0) pickStrollTarget(S, ped);
      continue;
    }
    const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
    if (d < 12) {
      ped.wait = range(S.rng, 0.5, 3);
      continue;
    }
    ped.angle = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    collideWalker(ped, 12, S.city);
  }

  // Keep a few peds waving for fares while the player is driving.
  if (S.mode === 'playing' && p.vehicle && !S.fare.active) {
    const waving = S.peds.filter((q) => q.state === 'wave').length;
    if (waving === 0 && S.rng() < dt * 0.25) {
      const near = S.peds.filter((q) => q.state === 'walk' && dist(q.x, q.y, p.x, p.y) < 700);
      if (near.length > 0) {
        const chosen = near[rangeInt(S.rng, 0, near.length - 1)];
        chosen.state = 'wave';
        chosen.taxi = true;
        chosen.wait = 25;
      }
    }
  }
}

// The player just ran into a pedestrian with a car. Returns true when the
// hit was hard enough to count as a crime.
export function hitPed(S, ped) {
  const p = S.player;
  if (p.speed < 120) return false;
  ped.state = 'flee';
  ped.wait = 3;
  ped.angle = Math.atan2(ped.y - p.y, ped.x - p.x);
  ped.x += Math.cos(ped.angle) * 60;
  ped.y += Math.sin(ped.angle) * 60;
  collideWalker(ped, 12, S.city);
  return true;
}

export function nearestWavingPed(S, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of S.peds) {
    if (ped.state !== 'wave') continue;
    const d = dist(ped.x, ped.y, S.player.x, S.player.y);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  return best;
}

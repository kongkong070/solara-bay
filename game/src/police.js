// The SBPD: five stars of wanted level, interceptor cars that ram, foot
// cops that chase and punch, and heat that cools off when the player hides.

import { DIFFICULTY, WANTED, WORLD_H, WORLD_W } from './config.js';
import { angleTo, clamp, dist, range, turnToward } from './util.js';
import { collideCar, collideWalker, randomRoadPoint } from './world.js';
import { damagePlayer } from './player.js';

export function addHeat(S, amount) {
  const diff = DIFFICULTY[S.difficulty];
  S.heat = clamp((S.heat || 0) + amount * diff.heatGain, 0, 220);
  const stars = S.heat < 20 ? 0 : Math.min(5, 1 + Math.floor((S.heat - 20) / 40));
  if (stars > S.wanted) {
    S.wanted = stars;
    S.stats.bestWanted = Math.max(S.stats.bestWanted || 0, stars);
    if (stars >= 3) S.banner = { text: stars + '-star wanted level — the SBPD is hunting you', t: 2.5 };
  }
}

export function clearWanted(S) {
  S.wanted = 0;
  S.heat = 0;
  S.hiddenTimer = 0;
  S.copCars = [];
  S.cops = [];
}

function makeCopCar(S, x, y) {
  const interceptor = S.wanted >= 4;
  return {
    kind: 'copcar',
    x, y,
    angle: angleTo(x, y, S.player.x, S.player.y),
    speed: 0,
    maxSpeed: (interceptor ? 640 : 540) * DIFFICULTY[S.difficulty].copSpeed,
    accel: interceptor ? 560 : 460,
    interceptor,
    w: 48,
    h: 22,
    ramCooldown: 0,
  };
}

function makeFootCop(S, x, y) {
  return {
    x, y,
    angle: 0,
    hp: 60,
    speed: 175,
    punchCooldown: 0,
  };
}

export function updatePolice(S, dt) {
  const p = S.player;
  // Cool off: hidden from every cop for long enough and the heat drops.
  const nearestCop = nearestCopDistance(S);
  if (S.wanted > 0) {
    if (nearestCop > 520) {
      S.hiddenTimer = (S.hiddenTimer || 0) + dt;
      const need = DIFFICULTY[S.difficulty].coolOffSeconds;
      if (S.hiddenTimer >= need) {
        S.heat = Math.max(0, S.heat - WANTED.decayPerSecond * 10 * dt * 4);
        const stars = S.heat < 20 ? 0 : Math.min(5, 1 + Math.floor((S.heat - 20) / 40));
        if (stars < S.wanted) {
          S.wanted = stars;
          S.hiddenTimer = 0;
          if (stars === 0) clearWanted(S);
        }
      }
    } else {
      S.hiddenTimer = 0;
    }
  }

  // Keep the right number of units on the street for the wanted level.
  if (S.mode === 'playing') {
    const diff = DIFFICULTY[S.difficulty];
    const wantCars = Math.round(Math.min(4, S.wanted) * diff.copCount);
    const wantCops = p.mode === 'foot' ? Math.round(Math.min(3, S.wanted) * diff.copCount) : 0;
    while (S.copCars.length < wantCars) {
      const spot = randomRoadPoint(S.rng, S.city);
      const edge = S.rng() < 0.5;
      const x = edge ? clamp(p.x + (S.rng() < 0.5 ? -900 : 900), 700, WORLD_W - 100) : spot.x;
      const y = edge ? clamp(p.y + (S.rng() < 0.5 ? -700 : 700), 100, WORLD_H - 100) : spot.y;
      S.copCars.push(makeCopCar(S, x, y));
    }
    while (S.cops.length < wantCops) {
      const a = S.rng() * Math.PI * 2;
      S.cops.push(makeFootCop(S, p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420));
    }
    while (S.copCars.length > wantCars) S.copCars.pop();
    while (S.cops.length > wantCops) S.cops.pop();
  }

  // Interceptors steer at the player and ram; at higher stars they shoot.
  for (const car of S.copCars) {
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    const want = angleTo(car.x, car.y, p.x, p.y);
    car.angle = turnToward(car.angle, want, dt * 2.4);
    car.speed += (car.maxSpeed - car.speed) * Math.min(1, dt * 0.9);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideCar(car, 20, S.city);

    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 46 && car.ramCooldown <= 0) {
      car.ramCooldown = 1.1;
      car.speed *= 0.35;
      const dead = damagePlayer(S, S.wanted >= 3 ? 16 : 10);
      S.camera.shake = 7;
      if (p.vehicle) {
        p.vehicle.speed *= 0.6;
      }
      if (dead) S.events.busted = true;
    }
    if (S.wanted >= 3 && d < 420 && S.rng() < dt * 0.5) {
      const dead = damagePlayer(S, 4);
      S.particles.push({
        x: car.x, y: car.y, vx: 0, vy: 0, life: 0.06, maxLife: 0.06,
        color: '#ffe9a8', size: 2, kind: 'tracer', x2: p.x, y2: p.y,
      });
      if (dead) S.events.busted = true;
    }
  }

  // Foot cops run the player down and punch.
  for (const cop of S.cops) {
    cop.punchCooldown = Math.max(0, cop.punchCooldown - dt);
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d > 34) {
      cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      collideWalker(cop, 12, S.city);
    } else if (cop.punchCooldown <= 0) {
      cop.punchCooldown = 0.9;
      const dead = damagePlayer(S, 8);
      S.camera.shake = 4;
      if (dead) S.events.busted = true;
    }
  }
}

function nearestCopDistance(S) {
  let best = Infinity;
  for (const car of S.copCars) best = Math.min(best, dist(car.x, car.y, S.player.x, S.player.y));
  for (const cop of S.cops) best = Math.min(best, dist(cop.x, cop.y, S.player.x, S.player.y));
  return best;
}

// Boats are safe from the road units, but the heat waits on shore.
export function policeCannotReachWater(S) {
  return !!S.player.boat;
}

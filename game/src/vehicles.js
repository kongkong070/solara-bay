// Cars: arcade driving physics, traffic that follows the road grid, and
// parked cars Rio can steal.
import { WORLD, CAR_TYPES, PAINTS, TUNING } from './config.js';
import { clamp, angleDiff } from './util.js';
import { collideBuildings, clampToWorld, nearestRoadPoint, randomRoadPoint } from './world.js';

export function makeCar(rng, type, x, y, angle) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    kind: 'car',
    type,
    spec,
    x, y,
    angle: angle || 0,
    speed: 0,
    vx: 0, vy: 0,
    w: spec.w, h: spec.h,
    radius: 21,
    color: type === 'taxi' ? spec.color : rng.pick(PAINTS),
    health: 100,
    dead: false,
    driver: null, // 'traffic' | 'police' | 'player' | null (parked)
    axis: rng.chance(0.5) ? 'x' : 'y',
    dir: rng.chance(0.5) ? 1 : -1,
    lane: (rng.chance(0.5) ? -1 : 1) * 26,
    turnAt: 0,
    wait: 0,
    sirenPhase: rng.range(0, 10),
    cruise: 0,
  };
}

// Arcade car physics, shared by the player and the police interceptors.
export function driveCar(car, dt, throttle, steer, handbrake) {
  const spec = car.spec;
  const maxSpeed = TUNING.carMaxSpeed * spec.top;
  if (throttle > 0) {
    car.speed += TUNING.carAccel * spec.accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 20) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.6 * dt;
  }
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  car.speed -= car.speed * TUNING.carDrag * dt;
  car.speed = clamp(car.speed, -TUNING.carMaxSpeed * 0.35, maxSpeed);
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const grip = handbrake ? 1.7 : 1;
  const turn = TUNING.carTurn * grip * steer *
    clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turn * dt;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.px = car.x;
  car.py = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
}

// Traffic: cruise along its road, turn at intersections, slow down for
// the car ahead. Mutates the car, returns nothing.
export function updateTraffic(car, dt, game) {
  if (car.wait > 0) {
    car.wait -= dt;
    return;
  }
  const road = nearestRoadPoint(game.world, car.x, car.y);
  let targetAngle;
  if (car.axis === 'x') {
    targetAngle = car.dir > 0 ? 0 : Math.PI;
    car.y += ((road.y + car.lane) - car.y) * Math.min(1, 3 * dt);
  } else {
    targetAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x += ((road.x + car.lane) - car.x) * Math.min(1, 3 * dt);
  }
  const onX = game.world.roadsX.some((rx) => Math.abs(car.x - rx) < 55);
  const onY = game.world.roadsY.some((ry) => Math.abs(car.y - ry) < 55);
  if (onX && onY && game.rng.next() < dt * 0.55) {
    car.axis = car.axis === 'x' ? 'y' : 'x';
    car.dir = game.rng.next() < 0.5 ? 1 : -1;
    car.lane = (game.rng.next() < 0.5 ? -1 : 1) * 26;
  }
  // Ease off when a car is right ahead.
  let ahead = Infinity;
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
    const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
    if (forward > 0 && forward < 130 && side < 30) ahead = Math.min(ahead, forward);
  }
  const cruise = 190 + (car.cruise || 0);
  const want = ahead < 90 ? 0 : cruise;
  const diff = angleDiff(car.angle, targetAngle);
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  car.speed += (want - car.speed) * Math.min(1, 1.6 * dt) * (ahead < 90 ? 2 : 1);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // Never drive onto the beach or into the sea: swing back onto the grid.
  if (car.y > WORLD.beachTop - 120) {
    car.y = WORLD.beachTop - 120;
    car.axis = 'x';
    car.dir = game.rng.next() < 0.5 ? 1 : -1;
    car.lane = (game.rng.next() < 0.5 ? -1 : 1) * 26;
  }
  if (collideBuildings(game.world, car)) car.speed *= 0.4;
  clampToWorld(car, 24);
}

export function spawnTraffic(game, count) {
  const types = ['sedan', 'sedan', 'taxi', 'coupe', 'van', 'truck', 'muscle'];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 420);
    const car = makeCar(game.rng, game.rng.pick(types), p.x, p.y, game.rng.next() * Math.PI * 2);
    car.driver = 'traffic';
    car.cruise = game.rng.range(-30, 60) * game.diff.traffic;
    game.cars.push(car);
  }
}

export function spawnParked(game, count) {
  const types = ['sedan', 'sport', 'coupe', 'taxi', 'van', 'muscle'];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 300);
    const angle = game.rng.chance(0.5) ? 0 : Math.PI / 2;
    const car = makeCar(game.rng, game.rng.pick(types),
      p.x + game.rng.range(-30, 30), p.y + game.rng.range(-30, 30),
      angle + (game.rng.chance(0.5) ? 0 : Math.PI));
    car.driver = null; // parked: free to steal
    car.color = game.rng.pick(PAINTS);
    game.cars.push(car);
  }
}

// Simple circle collision between cars: push apart, trade a little speed,
// dent both. True when this car hit something hard.
export function collideCars(game, car) {
  let hard = false;
  for (const other of game.cars) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x;
    const dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    const min = 34;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 120) {
        hard = true;
        car.health -= impact * 0.02;
        other.health -= impact * 0.02;
        car.speed *= 0.55;
        other.speed *= 0.55;
        game.addParticles((car.x + other.x) / 2, (car.y + other.y) / 2, 6, '#c9c9c9');
      }
    }
  }
  return hard;
}

export function nearestCar(game, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

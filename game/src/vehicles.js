// Cars: arcade physics for the car the player drives, and traffic that
// follows the roads, turns at intersections and gets out of the way.

import { CAR_TYPES, CAR_TYPE_KEYS, WORLD_H, WORLD_W } from './config.js';
import { angleTo, clamp, dist, pick, range, rangeInt, turnToward } from './util.js';
import { collideCar, randomRoadPoint } from './world.js';

export function makeCar(S, typeKey, x, y, angle) {
  const type = CAR_TYPES[typeKey];
  return {
    kind: 'car',
    type: typeKey,
    label: type.label,
    color: type.color,
    x, y,
    angle,
    speed: 0,
    maxSpeed: type.maxSpeed,
    accel: type.accel,
    grip: type.grip,
    w: type.w,
    h: type.h,
    traffic: false,
    axis: 'v',
    dir: 1,
    stuck: 0,
    brakeLight: false,
  };
}

export function spawnTraffic(S, count) {
  S.traffic = [];
  for (let i = 0; i < count; i++) {
    const spot = randomRoadPoint(S.rng, S.city);
    const typeKey = pick(S.rng, CAR_TYPE_KEYS);
    const car = makeCar(S, typeKey, spot.x, spot.y, spot.axis === 'v' ? (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (spot.dir > 0 ? 0 : Math.PI));
    car.traffic = true;
    car.axis = spot.axis;
    car.dir = spot.dir;
    car.speed = range(S.rng, 140, 230);
    S.traffic.push(car);
  }
}

export function spawnParkedCars(S, count) {
  S.parked = [];
  for (let i = 0; i < count; i++) {
    const spot = randomRoadPoint(S.rng, S.city);
    const typeKey = pick(S.rng, CAR_TYPE_KEYS);
    const car = makeCar(S, typeKey, spot.x + range(S.rng, -30, 30), spot.y + range(S.rng, -30, 30), S.rng() * Math.PI * 2);
    car.traffic = false;
    S.parked.push(car);
  }
}

// All cars the player can steal: parked ones plus traffic.
export function stealableCars(S) {
  return S.parked.concat(S.traffic);
}

// Arcade driving: throttle along the nose, steering that bites harder at
// speed, and a handbrake that lets the tail step out.
export function driveCar(S, car, input, dt) {
  const type = CAR_TYPES[car.type];
  let throttle = 0;
  if (input.up) throttle = 1;
  if (input.down) throttle = -0.6;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const handbrake = !!input.handbrake;

  const forward = car.speed >= 0 ? 1 : -1;
  car.speed += throttle * type.accel * dt;
  car.speed -= car.speed * (handbrake ? 1.6 : 0.55) * dt;
  car.speed = clamp(car.speed, -240, type.maxSpeed);

  const steerAuthority = clamp(Math.abs(car.speed) / 240, 0, 1);
  const grip = handbrake ? type.grip * 0.45 : type.grip;
  car.angle += steer * steerAuthority * grip * 0.55 * forward * dt;

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  collideCar(car, 20, S.city);
  car.brakeLight = !!input.down || handbrake;

  if (handbrake && Math.abs(car.speed) > 200 && S.rng() < dt * 22) {
    addSkid(S, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18);
  }
  return car.speed;
}

export function addSkid(S, x, y) {
  S.particles.push({
    x, y, vx: 0, vy: 0, life: 0.7, maxLife: 0.7,
    color: 'rgba(200,200,200,0.35)', size: 7, kind: 'smoke',
  });
}

function atIntersection(car, city) {
  const nearV = city.avenues.some((ax) => Math.abs(car.x - ax) < 46);
  const nearH = city.streets.some((sy) => Math.abs(car.y - sy) < 46);
  return nearV && nearH;
}

export function updateTraffic(S, dt) {
  const p = S.player;
  for (const car of S.traffic) {
    // Slow down for the car ahead and for the player's car.
    let target = 150 + (car.maxSpeed % 90);
    let blocked = false;
    for (const other of S.traffic) {
      if (other === car) continue;
      if (dist(car.x, car.y, other.x, other.y) < 70) {
        const ahead = Math.cos(car.angle) * (other.x - car.x) + Math.sin(car.angle) * (other.y - car.y);
        if (ahead > 0) { blocked = true; break; }
      }
    }
    if (p.vehicle === car) target = 0;
    if (blocked) target = 0;
    if (p.vehicle && p.vehicle !== car && dist(car.x, car.y, p.x, p.y) < 80) target = 0;

    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);

    // At an intersection, sometimes turn onto the crossing road.
    if (atIntersection(car, S.city) && S.rng() < dt * 0.5) {
      if (car.axis === 'v') {
        car.axis = 'h';
        car.dir = S.rng() < 0.5 ? 1 : -1;
      } else {
        car.axis = 'v';
        car.dir = S.rng() < 0.5 ? 1 : -1;
      }
    }
    const want = car.axis === 'v'
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    car.angle = turnToward(car.angle, want, dt * 1.6);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // Keep traffic on the roads: nudge a drifting car back to its lane.
    if (car.axis === 'v') {
      const ax = S.city.avenues.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a));
      if (Math.abs(car.x - ax) > 34) car.x += (ax - car.x) * dt * 0.8;
    } else {
      const sy = S.city.streets.reduce((a, b) => (Math.abs(car.y - b) < Math.abs(car.y - a) ? b : a));
      if (Math.abs(car.y - sy) > 34) car.y += (sy - car.y) * dt * 0.8;
    }
    car.x = clamp(car.x, 640, WORLD_W - 40);
    car.y = clamp(car.y, 40, WORLD_H - 40);
    collideCar(car, 20, S.city);
  }
}

export function nearestStealableCar(S, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of stealableCars(S)) {
    const d = dist(car.x, car.y, S.player.x, S.player.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

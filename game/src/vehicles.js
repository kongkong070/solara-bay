// Cars: arcade driving physics, traffic that follows the road grid, parked
// cars to steal, and police interceptors. One shape, many paint jobs.
import { WORLD, CAR } from './config.js';
import { clamp, angleDiff, pick, range, rangeInt } from './random.js';
import { collideBuildings, clampToWorld, isOnRoad, nearestRoadPoint, randomRoadPoint } from './world.js';

export const CAR_TYPES = {
  sedan: { w: 46, h: 22, color: '#c94f4f', accel: 1.0, top: 1.0, name: 'Solara Sedan' },
  taxi: { w: 46, h: 22, color: '#e8b93a', accel: 0.95, top: 0.95, name: 'Bay Taxi' },
  sport: { w: 48, h: 21, color: '#3a6fd8', accel: 1.35, top: 1.25, name: 'Cometa GT' },
  truck: { w: 58, h: 26, color: '#7a7a72', accel: 0.7, top: 0.8, name: 'Hauler' },
  coupe: { w: 46, h: 21, color: '#8a4fa8', accel: 1.15, top: 1.1, name: 'Vela Coupe' },
  police: { w: 48, h: 22, color: '#20242c', accel: 1.25, top: 1.18, name: 'SBPD Interceptor' },
  van: { w: 52, h: 24, color: '#4f8a6a', accel: 0.85, top: 0.9, name: 'Courier Van' },
};

const PAINTS = ['#c94f4f', '#3a6fd8', '#e8b93a', '#4f8a6a', '#8a4fa8', '#d8d8d0', '#e07a3a', '#5ab8c9'];

export function makeCar(rng, type, x, y, angle) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    kind: 'car', type, spec,
    x, y, angle: angle || 0, speed: 0,
    w: spec.w, h: spec.h, radius: 20,
    color: type === 'taxi' ? spec.color : pick(rng, PAINTS),
    health: 100, dead: false, stolen: false,
    driver: null, // 'traffic' | 'police' | 'player' | null (parked)
    // Traffic brain: which road axis it follows and where it turns.
    axis: rng() < 0.5 ? 'x' : 'y',
    dir: rng() < 0.5 ? 1 : -1,
    lane: (rng() < 0.5 ? -1 : 1) * 26,
    turnAt: 0, wait: 0,
    sirenPhase: rng() * 10,
    vx: 0, vy: 0,
  };
}

// Arcade car physics shared by the player and the police.
export function driveCar(car, dt, throttle, steer) {
  const spec = car.spec;
  const maxSpeed = CAR.maxSpeed * spec.top;
  if (throttle > 0) car.speed += CAR.accel * spec.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  car.speed -= car.speed * CAR.drag * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, maxSpeed);
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const steerAmount = CAR.turnRate * steer * clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount * dt;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
}

// Traffic: cruise along its road, turn at intersections, slow for the car
// ahead. Returns nothing; mutates the car.
export function updateTraffic(car, dt, game) {
  if (car.wait > 0) { car.wait -= dt; return; }
  const road = nearestRoadPoint(car.x, car.y);
  let targetAngle;
  if (car.axis === 'x') {
    targetAngle = car.dir > 0 ? 0 : Math.PI;
    car.y += ((road.y + car.lane) - car.y) * Math.min(1, 3 * dt);
  } else {
    targetAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.x += ((road.x + car.lane) - car.x) * Math.min(1, 3 * dt);
  }
  // At an intersection, sometimes turn onto the crossing road.
  const onX = WORLD.roadsX.some((rx) => Math.abs(car.x - rx) < 55);
  const onY = WORLD.roadsY.some((ry) => Math.abs(car.y - ry) < 55);
  if (onX && onY && game.rng() < dt * 0.55) {
    car.axis = car.axis === 'x' ? 'y' : 'x';
    car.dir = game.rng() < 0.5 ? 1 : -1;
    car.lane = (game.rng() < 0.5 ? -1 : 1) * 26;
  }
  // Slow down for a car ahead.
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
  const throttle = ahead < 90 ? -0.4 : 1;
  const want = ahead < 90 ? 0 : cruise;
  const diff = angleDiff(car.angle, targetAngle);
  car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  car.speed += ((want - car.speed) * Math.min(1, 1.6 * dt)) * (throttle < 0 ? 2 : 1);
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // Never drive onto the beach or into the sea: turn back onto the grid.
  if (car.y > WORLD.beachTop - 120) {
    car.y = WORLD.beachTop - 120;
    car.axis = 'x';
    car.dir = game.rng() < 0.5 ? 1 : -1;
    car.lane = (game.rng() < 0.5 ? -1 : 1) * 26;
  }
  if (collideBuildings(game.world, car)) car.speed *= 0.4;
  clampToWorld(car, 24);
}

export function spawnTraffic(game, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(game.rng, game.player, 420);
    const type = pick(game.rng, ['sedan', 'sedan', 'taxi', 'coupe', 'van', 'truck']);
    const car = makeCar(game.rng, type, p.x, p.y, game.rng() * Math.PI * 2);
    car.driver = 'traffic';
    car.cruise = range(game.rng, -30, 60);
    game.cars.push(car);
  }
}

export function spawnParked(game, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(game.rng, game.player, 300);
    const type = pick(game.rng, ['sedan', 'sport', 'coupe', 'taxi', 'van']);
    const angle = game.rng() < 0.5 ? 0 : Math.PI / 2;
    const car = makeCar(game.rng, type, p.x + range(game.rng, -30, 30), p.y + range(game.rng, -30, 30), angle + (game.rng() < 0.5 ? 0 : Math.PI));
    car.driver = null; // parked: free to steal
    car.color = pick(game.rng, PAINTS);
    game.cars.push(car);
  }
}

// Simple circle collision between cars: push apart, trade a little speed,
// dent both. Returns true when this car hit something hard.
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

export function randomCarColor(rng) {
  return pick(rng, PAINTS);
}
export { rangeInt };

// Rio Vega on foot, behind the wheel, at the helm and in the helicopter:
// movement, stealing cars and boats, punching, shooting and taking damage.

import { PLAYER, WANTED } from './config.js';
import { angleTo, clamp, dist } from './util.js';
import { collideWalker } from './world.js';
import { driveCar, nearestStealableCar } from './vehicles.js';
import { nearestBoat, sailBoat, shorePointNear } from './boats.js';
import { hitPed } from './peds.js';
import { playShot } from './audio.js';
import { addHeat } from './police.js';
import { onBoardBoat, onBoardHeli, onEnterCar } from './missions.js';

export function createPlayer(S) {
  return {
    x: S.city.spawn.x,
    y: S.city.spawn.y,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    armor: 0,
    ammo: PLAYER.startAmmo,
    mag: 12,
    magSize: 12,
    cash: 150,
    speed: 0,
    mode: 'foot', // foot | car | boat | heli
    vehicle: null,
    boat: null,
    heli: null,
    punchTimer: 0,
    shootCooldown: 0,
    muzzle: 0,
  };
}

export function updatePlayer(S, dt) {
  const p = S.player;
  const input = S.input;
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);

  if (p.mode === 'foot') updateOnFoot(S, dt);
  else if (p.mode === 'car' && p.vehicle) updateInCar(S, dt);
  else if (p.mode === 'boat' && p.boat) updateInBoat(S, dt);
  else if (p.mode === 'heli' && p.heli) updateInHeli(S, dt);
  else {
    p.mode = 'foot';
    p.vehicle = null;
    p.boat = null;
    p.heli = null;
  }

  // Aim follows the mouse while on foot.
  if (p.mode === 'foot' && S.mouseWorld) {
    p.angle = angleTo(p.x, p.y, S.mouseWorld.x, S.mouseWorld.y);
  }

  if (input.mouseClicked && p.mode === 'foot') tryShoot(S);
  if (input.mouseDown && p.mode === 'foot' && p.shootCooldown <= 0 && p.mag > 0) {
    tryShoot(S);
  }
}

function updateOnFoot(S, dt) {
  const p = S.player;
  const input = S.input;
  const mv = { x: 0, y: 0 };
  if (input.keys.left) mv.x -= 1;
  if (input.keys.right) mv.x += 1;
  if (input.keys.up) mv.y -= 1;
  if (input.keys.down) mv.y += 1;
  const sprint = !!input.keys.sprint;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = mv.x;
  let my = mv.y;
  if (mx !== 0 && my !== 0) {
    mx *= Math.SQRT1_2;
    my *= Math.SQRT1_2;
  }
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  p.speed = (mx !== 0 || my !== 0) ? speed : 0;
  collideWalker(p, PLAYER.radius, S.city);

  if (input.pressed.punch) doPunch(S);
  if (input.pressed.enter) tryEnter(S);
  if (input.pressed.reload) reloadMag(S);
}

function updateInCar(S, dt) {
  const p = S.player;
  const input = S.input;
  const car = p.vehicle;
  p.speed = driveCar(S, car, {
    up: !!input.keys.up,
    down: !!input.keys.down,
    left: !!input.keys.left,
    right: !!input.keys.right,
    handbrake: !!input.keys.handbrake,
  }, dt);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (input.pressed.enter) exitCar(S);
  // Running over pedestrians is a crime, and it counts.
  for (const ped of S.peds) {
    if (ped.state === 'ride') continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(p.speed) > 120) {
      if (hitPed(S, ped)) addHeat(S, WANTED.hitPedHeat);
    }
  }
}

// The car the player leaves behind stays where it is, ready to steal again.

function updateInBoat(S, dt) {
  const p = S.player;
  const input = S.input;
  const boat = p.boat;
  p.speed = sailBoat(S, boat, {
    up: !!input.keys.up,
    down: !!input.keys.down,
    left: !!input.keys.left,
    right: !!input.keys.right,
  }, dt);
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  if (input.pressed.enter) exitBoat(S);
}

function updateInHeli(S, dt) {
  const p = S.player;
  const input = S.input;
  const heli = p.heli;
  const mv = { x: 0, y: 0 };
  if (input.keys.left) mv.x -= 1;
  if (input.keys.right) mv.x += 1;
  if (input.keys.up) mv.y -= 1;
  if (input.keys.down) mv.y += 1;
  const speed = 420;
  heli.x += mv.x * speed * dt;
  heli.y += mv.y * speed * dt;
  heli.x = clamp(heli.x, 60, 3540);
  heli.y = clamp(heli.y, 60, 2740);
  heli.rotor += dt * 22;
  if (mv.x !== 0 || mv.y !== 0) {
    heli.angle = Math.atan2(mv.y, mv.x);
  }
  p.x = heli.x;
  p.y = heli.y;
  p.angle = heli.angle;
  p.speed = (mv.x !== 0 || mv.y !== 0) ? speed : 0;
  if (input.pressed.enter && heli.altitude < 5) exitHeli(S);
}

function tryEnter(S) {
  const p = S.player;
  // The helicopter comes first: it only lands for the finale.
  if (S.heli && S.heli.landed && dist(p.x, p.y, S.heli.x, S.heli.y) < 90) {
    boardHeli(S);
    return;
  }
  const boat = nearestBoat(S, 70);
  if (boat) {
    boardBoat(S, boat);
    return;
  }
  const car = nearestStealableCar(S, 70);
  if (car) {
    boardCar(S, car);
  }
}

function boardCar(S, car) {
  const p = S.player;
  // Taking a car that is not parked empty is grand theft: the law notices.
  if (car.traffic) {
    addHeat(S, WANTED.stealCarHeat);
    S.banner = { text: 'Car stolen — the SBPD is on its way', t: 2.5 };
  }
  const pi = S.parked.indexOf(car);
  if (pi >= 0) S.parked.splice(pi, 1);
  const ti = S.traffic.indexOf(car);
  if (ti >= 0) S.traffic.splice(ti, 1);
  p.vehicle = car;
  p.mode = 'car';
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = 0;
  S.stats.carsStolen = (S.stats.carsStolen || 0) + 1;
  onEnterCar(S, car);
}

function boardBoat(S, boat) {
  const p = S.player;
  boat.occupied = true;
  p.boat = boat;
  p.mode = 'boat';
  p.x = boat.x;
  p.y = boat.y;
  p.angle = boat.angle;
  p.speed = 0;
  S.stats.boatsRidden = (S.stats.boatsRidden || 0) + 1;
  S.banner = { text: 'Aboard the ' + boat.label + ' — the bay is yours', t: 2.5 };
  onBoardBoat(S, boat);
}

function boardHeli(S) {
  const p = S.player;
  S.heli.landed = false;
  S.heli.altitude = 10;
  p.heli = S.heli;
  p.mode = 'heli';
  p.x = S.heli.x;
  p.y = S.heli.y;
  S.stats.heliRides = (S.stats.heliRides || 0) + 1;
  S.banner = { text: "Lena's helicopter — fly to the escape point over the bay", t: 3 };
  onBoardHeli(S);
}

function exitCar(S) {
  const p = S.player;
  const car = p.vehicle;
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  collideWalker(p, PLAYER.radius, S.city);
  if (!S.parked.includes(car)) S.parked.push(car);
  p.vehicle = null;
  p.mode = 'foot';
  p.speed = 0;
}

function exitBoat(S) {
  const p = S.player;
  const boat = p.boat;
  boat.occupied = false;
  boat.speed = 0;
  const spot = shorePointNear(S, boat);
  p.x = spot.x;
  p.y = spot.y;
  collideWalker(p, PLAYER.radius, S.city);
  p.boat = null;
  p.mode = 'foot';
  p.speed = 0;
}

function exitHeli(S) {
  const p = S.player;
  p.heli = null;
  p.mode = 'foot';
  p.speed = 0;
  collideWalker(p, PLAYER.radius, S.city);
}

function doPunch(S) {
  const p = S.player;
  if (p.punchTimer > 0) return;
  p.punchTimer = 0.45;
  const reach = 46;
  for (const ped of S.peds) {
    if (dist(ped.x, ped.y, p.x, p.y) < reach) {
      ped.state = 'flee';
      ped.wait = 2.5;
      ped.angle = angleTo(p.x, p.y, ped.x, ped.y);
      addHeat(S, WANTED.hitPedHeat * 0.5);
      return;
    }
  }
  for (const cop of S.cops) {
    if (dist(cop.x, cop.y, p.x, p.y) < reach) {
      cop.hp -= PLAYER.punchDamage;
      cop.angle = angleTo(p.x, p.y, cop.x, cop.y);
      addHeat(S, WANTED.hitPedHeat * 0.5);
      return;
    }
  }
}

function reloadMag(S) {
  const p = S.player;
  const need = p.magSize - p.mag;
  if (need <= 0 || p.ammo <= 0) return;
  const take = Math.min(need, p.ammo);
  p.mag += take;
  p.ammo -= take;
}

function tryShoot(S) {
  const p = S.player;
  if (p.shootCooldown > 0 || p.mag <= 0) {
    if (p.mag <= 0) S.banner = { text: 'Out of ammo — find a supply crate', t: 2 };
    return;
  }
  p.shootCooldown = 0.22;
  p.mag -= 1;
  p.muzzle = 0.08;
  playShot(S.audio);
  S.events.shotFired = 0.6;
  S.events.shotX = p.x;
  S.events.shotY = p.y;
  addHeat(S, WANTED.shootHeat);

  // Find the closest person roughly along the aim line.
  const aim = p.angle;
  let best = null;
  let bestScore = Infinity;
  const consider = (t, list) => {
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > PLAYER.gunRange) return;
    const a = angleTo(p.x, p.y, t.x, t.y);
    let diff = Math.abs(a - aim);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 0.14) return;
    const score = d + diff * 900;
    if (score < bestScore) {
      bestScore = score;
      best = { target: t, list };
    }
  };
  for (const ped of S.peds) if (ped.state !== 'ride') consider(ped, 'ped');
  for (const cop of S.cops) consider(cop, 'cop');
  const bx = p.x + Math.cos(aim) * 26;
  const by = p.y + Math.sin(aim) * 26;
  const ex = best ? best.target.x : p.x + Math.cos(aim) * PLAYER.gunRange;
  const ey = best ? best.target.y : p.y + Math.sin(aim) * PLAYER.gunRange;
  S.particles.push({
    x: bx, y: by, vx: 0, vy: 0, life: 0.07, maxLife: 0.07,
    color: '#ffe9a8', size: 2, kind: 'tracer', x2: ex, y2: ey,
  });
  if (!best) return;
  if (best.list === 'ped') {
    best.target.state = 'flee';
    best.target.wait = 4;
    best.target.angle = angleTo(p.x, p.y, best.target.x, best.target.y);
  } else {
    best.target.hp -= PLAYER.gunDamage;
    if (best.target.hp <= 0) {
      S.cops.splice(S.cops.indexOf(best.target), 1);
      addHeat(S, WANTED.killCopHeat);
      S.banner = { text: 'Officer down — heat rising', t: 2 };
    }
  }
}

export function damagePlayer(S, amount) {
  const p = S.player;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  if (p.hp <= 0) {
    p.hp = 0;
    return true;
  }
  return false;
}

export function healPlayer(S, hp, armor, ammo) {
  const p = S.player;
  p.hp = Math.min(PLAYER.maxHp, p.hp + hp);
  p.armor = Math.min(PLAYER.maxArmor, p.armor + armor);
  p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + ammo);
}

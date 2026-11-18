// The player on foot and behind the wheel: Marco "Rio" Vega, a driver new
// to Solara Bay. Walk, sprint, steal cars, punch, shoot, get busted.
import { PLAYER, WORLD, PICKUPS } from './config.js';
import { clamp, angleTo } from './random.js';
import { collideBuildings, clampToWorld, isWater } from './world.js';
import { nearestCar, driveCar, collideCars } from './vehicles.js';
import { knockPedDown } from './peds.js';
import { taxiStart } from './missions.js';
import { keyDown } from './input.js';

export function makePlayer(x, y) {
  return {
    kind: 'player',
    x, y, radius: PLAYER.radius,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: 150,
    speed: 0,
    inCar: null,
    weapon: 'pistol',
    ammo: 12,
    magSize: 12,
    reserveAmmo: 48,
    punchT: 0,
    shootT: 0,
    hurtT: 0,
    bustedT: 0,
    moving: false,
    sprinting: false,
  };
}

export function hurtPlayer(game, amount, source) {
  const p = game.player;
  if (p.hurtT > 0 || game.state !== 'play') return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  p.hurtT = 0.5;
  game.addParticles(p.x, p.y, 6, '#c94f4f');
  if (p.health <= 0) {
    p.health = 0;
    game.endRun(source === 'police' ? 'busted' : 'wasted');
  }
}

export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  p.punchT = Math.max(0, p.punchT - dt);
  p.shootT = Math.max(0, p.shootT - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);

  if (p.inCar) {
    updateDriving(game, dt);
    return;
  }
  // On foot.
  let mx = 0;
  let my = 0;
  if (keyDown(input, 'w', 'ArrowUp')) my -= 1;
  if (keyDown(input, 's', 'ArrowDown')) my += 1;
  if (keyDown(input, 'a', 'ArrowLeft')) mx -= 1;
  if (keyDown(input, 'd', 'ArrowRight')) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  p.sprinting = keyDown(input, 'Shift');
  const speed = (p.sprinting ? PLAYER.runSpeed : PLAYER.walkSpeed) * (p.health < 30 ? 0.8 : 1);
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    // Walking into the sea slows you and hurts.
    if (isWater(p.x, p.y)) {
      p.x -= (mx / len) * speed * dt * 0.8;
      p.y -= (my / len) * speed * dt * 0.8;
    }
  }
  collideBuildings(game.world, p);
  clampToWorld(p, 14);
  // Bump into cars and peds.
  for (const car of game.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 30 && Math.abs(car.speed) > 60) {
      knockPlayerDown(game, car);
    }
  }
  // Punch with F, shoot with the mouse.
  if (game.edge('f') && p.punchT <= 0) punch(game);
  const aim = angleTo(p.x, p.y, game.mouseWorld.x, game.mouseWorld.y);
  if (input.mouse.down && p.shootT <= 0) shoot(game, aim);
  if (game.edge('r')) reload(game);
  // Enter the nearest car with E, or hail a taxi.
  if (game.edge('e')) {
    tryEnterCar(game);
    tryTaxi(game);
  }
  // Collect cash packages.
  for (const pack of game.world.packages) {
    if (!pack.taken && Math.hypot(pack.x - p.x, pack.y - p.y) < 26) {
      pack.taken = true;
      p.cash += 250;
      game.stats.packages += 1;
      game.floater(pack.x, pack.y, '+$250 package', '#e8d44f');
      game.audio.pickup();
    }
  }
  // Collect supply crates: health, armour, ammo. They respawn after a minute.
  for (const pk of game.world.pickups) {
    if (!pk.taken && Math.hypot(pk.x - p.x, pk.y - p.y) < 28) {
      pk.taken = true;
      pk.respawnT = PICKUPS.respawnSeconds;
      game.stats.pickups = (game.stats.pickups || 0) + 1;
      if (pk.kind === 'health') {
        p.health = Math.min(100, p.health + PICKUPS.health);
        game.floater(pk.x, pk.y, '+' + PICKUPS.health + ' HP', '#7ae08a');
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + PICKUPS.armor);
        game.floater(pk.x, pk.y, '+' + PICKUPS.armor + ' ARMOUR', '#7ab8e0');
      } else {
        p.reserveAmmo += PICKUPS.ammo;
        game.floater(pk.x, pk.y, '+' + PICKUPS.ammo + ' AMMO', '#ffd76a');
      }
      game.audio.supply(pk.kind);
      game.addParticles(pk.x, pk.y, 8, '#7ae08a');
    }
  }
}

function knockPlayerDown(game, car) {
  const p = game.player;
  hurtPlayer(game, 12, 'car');
  p.x += Math.cos(p.angle) * 0;
  game.addParticles(p.x, p.y, 8, '#e8b88a');
  game.audio.crash();
}

function punch(game) {
  const p = game.player;
  p.punchT = PLAYER.punchCooldown;
  game.audio.punch();
  const reach = PLAYER.punchRange + 14;
  const px = p.x + Math.cos(p.angle) * reach;
  const py = p.y + Math.sin(p.angle) * reach;
  for (const ped of game.peds) {
    if (ped.dead || ped.state === 'down') continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 26) {
      knockPedDown(game, ped);
      game.raiseWanted(1, 'assault');
      game.addParticles(ped.x, ped.y, 6, '#e8b88a');
      return;
    }
  }
  for (const car of game.cars) {
    if (car.dead) continue;
    if (Math.hypot(car.x - px, car.y - py) < 34) {
      car.health -= PLAYER.punchDamage;
      game.addParticles(car.x, car.y, 4, '#c9c9c9');
      return;
    }
  }
}

function shoot(game, aim) {
  const p = game.player;
  if (p.ammo <= 0) {
    p.shootT = 0.3;
    game.audio.blip(220, 0.06, 'square', 0.06);
    return;
  }
  p.ammo -= 1;
  p.shootT = 0.16;
  p.angle = aim;
  game.audio.shot();
  game.danger = { x: p.x, y: p.y, t: 0.6 };
  const bx = p.x + Math.cos(aim) * 20;
  const by = p.y + Math.sin(aim) * 20;
  game.bullets.push({ x: bx, y: by, vx: Math.cos(aim) * 900, vy: Math.sin(aim) * 900, life: 0.55, from: 'player' });
  game.addParticles(bx, by, 3, '#ffd76a');
  game.raiseWanted(1, 'shots');
}

function reload(game) {
  const p = game.player;
  if (p.ammo >= p.magSize || p.reserveAmmo <= 0) return;
  const need = p.magSize - p.ammo;
  const take = Math.min(need, p.reserveAmmo);
  p.ammo += take;
  p.reserveAmmo -= take;
  p.shootT = 0.5;
  game.audio.blip(440, 0.07, 'sine', 0.08);
}

function tryEnterCar(game) {
  const p = game.player;
  const car = nearestCar(game, p.x, p.y, 64);
  if (!car) return;
  if (car.driver === 'police') return; // you cannot steal a cop car while it chases you
  if (car.driver === 'traffic') {
    // Yank the driver out: a crime, unless nobody sees it.
    car.driver = 'player';
    game.raiseWanted(1, 'carjack');
    game.floater(car.x, car.y - 30, 'Carjacked!', '#ff6a5a');
    const ped = game.peds.find((q) => !q.dead && Math.hypot(q.x - car.x, q.y - car.y) < 120);
    if (ped) knockPedDown(game, ped);
  } else {
    car.driver = 'player';
    if (!car.stolen) {
      car.stolen = true;
      game.raiseWanted(1, 'theft');
      game.floater(car.x, car.y - 30, 'Stolen!', '#ff6a5a');
    }
  }
  p.inCar = car;
  game.audio.blip(330, 0.08, 'sine', 0.1);
}

function tryTaxi(game) {
  const p = game.player;
  if (game.taxi.active || p.inCar) return;
  for (const ped of game.peds) {
    if (ped.taxi && !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 46) {
      taxiStart(game, ped);
      return;
    }
  }
}

function updateDriving(game, dt) {
  const p = game.player;
  const car = p.inCar;
  const input = game.input;
  let throttle = 0;
  if (keyDown(input, 'w', 'ArrowUp')) throttle = 1;
  if (keyDown(input, 's', 'ArrowDown')) throttle = -1;
  let steer = 0;
  if (keyDown(input, 'a', 'ArrowLeft')) steer = -1;
  if (keyDown(input, 'd', 'ArrowRight')) steer = 1;
  if (keyDown(input, ' ')) { // handbrake: hard turn, kill speed
    car.speed *= Math.max(0, 1 - 3.2 * dt);
    steer *= 1.5;
  }
  driveCar(car, dt, throttle, steer);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (collideBuildings(game.world, car)) {
    if (Math.abs(car.speed) > 240) {
      game.audio.crash();
      game.addParticles(car.x, car.y, 8, '#c9c9c9');
      car.health -= 6;
    }
    car.speed *= 0.45;
  }
  if (collideCars(game, car)) game.audio.crash();
  clampToWorld(car, 24);
  // Running over pedestrians is a crime, and a mess.
  for (const ped of game.peds) {
    if (ped.dead || ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 80) {
      knockPedDown(game, ped);
      game.raiseWanted(1, 'hit-ped');
      game.audio.crash();
    }
  }
  // Car wrecked: bail out.
  if (car.health <= 0 && !car.dead) {
    car.dead = true;
    game.addParticles(car.x, car.y, 26, '#ff8a3a');
    game.addParticles(car.x, car.y, 18, '#3a3a3a');
    game.audio.crash();
    p.inCar = null;
    p.x = car.x + 40;
    p.y = car.y + 40;
    hurtPlayer(game, 15, 'crash');
  }
  game.audio.setEngine(Math.abs(car.speed) / 520, true);
  if (game.edge('e')) {
    // Step out (not while flying).
    if (Math.abs(car.speed) < 60) {
      p.inCar = null;
      car.driver = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      game.audio.setEngine(0, false);
    }
  }
  if (game.edge('c')) game.audio.cycleStation();
}

// Rio Vega, on foot and behind the wheel: movement, stealing cars,
// punching, shooting, health and armour.
import { WORLD, TUNING } from './config.js';
import { clamp, dist } from './util.js';
import { hitsBuilding, slideOutOfBuildings, clampToWorld, isOnRoad } from './world.js';
import { nearestCar, collideCars, driveCar } from './vehicles.js';
import { knockDown } from './peds.js';

export function makePlayer(x, y, cash) {
  return {
    kind: 'player',
    x, y,
    px: x, py: y,
    angle: -Math.PI / 2,
    speed: 0,
    radius: 13,
    health: TUNING.playerHealth,
    armor: 0,
    cash,
    ammo: TUNING.startAmmo,
    inCar: null,
    aimX: x,
    aimY: y,
    punchTimer: 0,
    shootTimer: 0,
    reloadTimer: 0,
    dead: false,
  };
}

// Step the player for one frame. `input` is the input module, `game` the
// whole game object.
export function updatePlayer(game, dt) {
  const player = game.player;
  const input = game.input;
  if (player.dead) return;
  player.px = player.x;
  player.py = player.y;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.reloadTimer = Math.max(0, player.reloadTimer - dt);

  if (player.inCar) {
    updateDriving(game, dt);
    return;
  }

  const mv = input.moveVector();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
  player.x += mv.x * speed * dt;
  player.y += mv.y * speed * dt;
  if (mv.x !== 0 || mv.y !== 0) player.angle = Math.atan2(mv.y, mv.x);
  player.speed = (mv.x !== 0 || mv.y !== 0) ? speed : 0;
  slideOutOfBuildings(game.world, player, player.radius);
  clampToWorld(player, 24);

  // Aim at the mouse (screen space -> world space via the camera).
  const cam = game.camera;
  player.aimX = cam.x + input.mouse.x - game.view.w / 2;
  player.aimY = cam.y + input.mouse.y - game.view.h / 2;

  // Punch.
  if (input.wasPressed('KeyF') && player.punchTimer <= 0) {
    player.punchTimer = 0.45;
    doPunch(game);
  }
  // Shoot with the mouse, R reloads.
  if (input.down('Mouse0') || input.mouse.down) {
    if (player.shootTimer <= 0 && player.reloadTimer <= 0) {
      if (player.ammo > 0) {
        player.shootTimer = 0.16;
        shootBullet(game);
      } else {
        player.reloadTimer = 1.1;
      }
    }
  }
  if (input.wasPressed('KeyR') && player.ammo < TUNING.startAmmo) {
    player.reloadTimer = 1.1;
    player.ammo = TUNING.startAmmo;
  }
  // Enter or exit a car.
  if (input.wasPressed('KeyE')) {
    tryEnterCar(game);
  }
}

function updateDriving(game, dt) {
  const player = game.player;
  const input = game.input;
  const car = player.inCar;
  const mv = input.moveVector();
  const handbrake = input.down('Space');
  const throttle = mv.y < 0 ? 1 : mv.y > 0 ? -0.7 : 0;
  const steer = mv.x;
  driveCar(car, dt, throttle, steer, handbrake);
  player.x = car.x;
  player.y = car.y;
  player.px = car.x;
  player.py = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
  // Bounce off buildings and other cars.
  if (hitsBuilding(game.world, car.x, car.y, 20)) {
    slideOutOfBuildings(game.world, car, 20);
    car.speed *= 0.5;
    player.x = car.x;
    player.y = car.y;
  }
  collideCars(game, car);
  clampToWorld(car, 24);
  player.x = car.x;
  player.y = car.y;
  // Skid particles when the handbrake is down at speed.
  if (handbrake && Math.abs(car.speed) > 120 && game.rng.next() < 0.5) {
    game.addParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1, '#bbbbbb');
  }
  // Exit the car.
  if (input.wasPressed('KeyE')) {
    exitCar(game);
  }
  // Radio station.
  if (input.wasPressed('KeyC')) {
    game.audio.nextStation();
  }
  // Hitting pedestrians while driving counts as a crime.
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 30 && Math.abs(car.speed) > 60) {
      knockDown(game, ped);
      game.police.addHeat(game, 1);
      game.audio.punch();
    }
  }
}

function tryEnterCar(game) {
  const player = game.player;
  const car = nearestCar(game, player.x, player.y, 64);
  if (!car) return;
  player.inCar = car;
  if (car.driver !== 'player') {
    // Stealing a car the driver owned is a crime; parked cars are free
    // pickings only when nobody sits in them.
    if (car.driver === 'traffic') {
      game.police.addHeat(game, 1);
      game.addMessage('Car stolen! The SBPD is on to you.');
    }
    car.driver = 'player';
  }
  game.audio.select();
}

function exitCar(game) {
  const player = game.player;
  const car = player.inCar;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  player.inCar = null;
  // Step out to the side of the car.
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  slideOutOfBuildings(game.world, player, player.radius);
  clampToWorld(player, 24);
}

function doPunch(game) {
  const player = game.player;
  game.audio.punch();
  const reach = 46;
  const px = player.x + Math.cos(player.angle) * reach;
  const py = player.y + Math.sin(player.angle) * reach;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, px, py) < 34) {
      knockDown(game, ped);
      game.police.addHeat(game, 1);
      game.addMessage('You decked a pedestrian!');
      return;
    }
  }
  for (const cop of game.police.cops) {
    if (cop.down) continue;
    if (dist(cop.x, cop.y, px, py) < 36) {
      cop.down = true;
      cop.downTimer = 6;
      game.addParticles(cop.x, cop.y, 10, '#3050c8');
      game.police.addHeat(game, 1);
      return;
    }
  }
}

function shootBullet(game) {
  const player = game.player;
  player.ammo -= 1;
  const aim = Math.atan2(player.aimY - player.y, player.aimX - player.x);
  game.bullets.push({
    x: player.x + Math.cos(aim) * 20,
    y: player.y + Math.sin(aim) * 20,
    vx: Math.cos(aim) * 900,
    vy: Math.sin(aim) * 900,
    life: 0.9,
  });
  game.recentShot = { x: player.x, y: player.y, t: 0.6 };
  game.audio.shot();
  game.police.addHeat(game, 1);
}

// Bullets fly, hit peds, cops and cars, and die on walls.
export function updateBullets(game, dt) {
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitsBuilding(game.world, b.x, b.y, 2)) b.life = 0;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (dist(ped.x, ped.y, b.x, b.y) < 16) {
        knockDown(game, ped);
        game.police.addHeat(game, 1);
        b.life = 0;
      }
    }
    for (const cop of game.police.cops) {
      if (cop.down) continue;
      if (dist(cop.x, cop.y, b.x, b.y) < 16) {
        cop.down = true;
        cop.downTimer = 6;
        game.addParticles(cop.x, cop.y, 10, '#3050c8');
        game.police.addHeat(game, 1);
        b.life = 0;
      }
    }
    for (const car of game.cars) {
      if (car === game.player.inCar) continue;
      if (dist(car.x, car.y, b.x, b.y) < 26) {
        car.health -= 12;
        if (car.health <= 0) car.dead = true;
        b.life = 0;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
  if (game.recentShot) {
    game.recentShot.t -= dt;
    if (game.recentShot.t <= 0) game.recentShot = null;
  }
}

// Damage the player: armour soaks 60% first.
export function hurtPlayer(game, amount) {
  const player = game.player;
  if (player.dead) return;
  let rest = amount;
  if (player.armor > 0) {
    const soaked = Math.min(player.armor, rest * 0.6);
    player.armor -= soaked;
    rest -= soaked;
  }
  player.health -= rest;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    game.state = 'busted';
    game.bustedReason = 'You were busted by the SBPD.';
    game.audio.busted();
  }
}

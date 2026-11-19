// Deterministic screenshot scenes: ?shot=start|chase|mission|night|boat
// with &seed=1 always stages the same frame, so the screenshots are real
// renders of the game and reproducible. Shot mode never saves.

import { mulberry32 } from './util.js';
import { buildCity } from './world.js';
import { createPlayer } from './player.js';
import { makeCar, spawnParkedCars, spawnTraffic } from './vehicles.js';
import { spawnBoats } from './boats.js';
import { spawnPeds } from './peds.js';
import { addHeat, clearWanted } from './police.js';
import { createMissions } from './missions.js';

const SCENES = ['start', 'chase', 'mission', 'night', 'boat'];

export function shotNames() {
  return SCENES.slice();
}

export function applyShot(S, name, seed) {
  S.shotMode = true;
  S.shotName = name;
  S.rng = mulberry32(seed);
  S.city = buildCity(S.rng);
  S.player = createPlayer(S);
  S.missions = createMissions();
  S.fare = { active: false, ped: null, dest: null, amount: 0 };
  S.wanted = 0;
  S.heat = 0;
  S.copCars = [];
  S.cops = [];
  S.heli = null;
  S.banner = null;
  S.particles = [];
  S.events = { shotFired: 0, shotX: 0, shotY: 0, busted: false };
  spawnTraffic(S, 14);
  spawnParkedCars(S, 8);
  spawnPeds(S, 22);
  spawnBoats(S);
  S.mode = 'playing';

  if (name === 'start') {
    S.clock.hour = 10;
    S.clock.minute = 0;
    S.player.x = 700;
    S.player.y = 1400;
    S.player.angle = Math.PI / 2;
  } else if (name === 'chase') {
    S.clock.hour = 15;
    S.clock.minute = 30;
    putPlayerInCar(S, 'sports', 1500, 1150, 0);
    S.player.vehicle.speed = 480;
    S.player.speed = 480;
    addHeat(S, 100);
    placeCopCars(S, [[1350, 1150], [1700, 1150], [1500, 950]]);
  } else if (name === 'mission') {
    S.clock.hour = 12;
    S.clock.minute = 0;
    putPlayerInCar(S, 'taxi', 800, 2500, -Math.PI / 2);
    S.player.vehicle.speed = 300;
    S.player.speed = 300;
    S.missions.active = {
      idx: 2, stage: 1, t: 95, countdownFails: true,
      target: { x: 2025, y: 1150, label: 'City Hall — deliver the package' },
      data: {},
    };
    S.missions.idx = 2;
    addHeat(S, 40);
  } else if (name === 'night') {
    S.clock.hour = 21;
    S.clock.minute = 30;
    putPlayerInCar(S, 'sedan', 2100, 1550, Math.PI);
    S.player.vehicle.speed = 350;
    S.player.speed = 350;
    addHeat(S, 30);
    placeCopCars(S, [[1850, 1550]]);
  } else if (name === 'boat') {
    S.clock.hour = 11;
    S.clock.minute = 0;
    const boat = S.boats[0];
    boat.x = 420;
    boat.y = 900;
    boat.angle = -Math.PI / 2;
    boat.occupied = true;
    S.player.boat = boat;
    S.player.mode = 'boat';
    S.player.x = boat.x;
    S.player.y = boat.y;
    S.player.angle = boat.angle;
    S.missions.active = {
      idx: 6, stage: 1, t: 80, countdownFails: true,
      target: { x: 250, y: 700, label: 'Buoy 1 of 3' },
      data: {},
    };
    S.missions.idx = 6;
    S.city.buoys.forEach((b) => { b.done = false; });
  }
  // Camera starts exactly on the player: no slide-in between shots.
  S.camera.x = Math.max(0, Math.min(3600 - 1280, S.player.x - 640));
  S.camera.y = Math.max(0, Math.min(2800 - 720, S.player.y - 360));
}

function putPlayerInCar(S, typeKey, x, y, angle) {
  const car = makeCar(S, typeKey, x, y, angle);
  S.player.vehicle = car;
  S.player.mode = 'car';
  S.player.x = x;
  S.player.y = y;
  S.player.angle = angle;
  S.player.speed = 0;
}

function placeCopCars(S, spots) {
  for (const [x, y] of spots) {
    S.copCars.push({
      kind: 'copcar', x, y,
      angle: Math.atan2(S.player.y - y, S.player.x - x),
      speed: 300, maxSpeed: 540, accel: 460,
      interceptor: false, w: 48, h: 22, ramCooldown: 0,
    });
  }
}

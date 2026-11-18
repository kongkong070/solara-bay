// Solara Bay — entry point. Builds the game state, runs the loop, wires
// every system together and serves the deterministic screenshot scenes.
import { WORLD, VIEW, DAY, LIGHTING } from './config.js';
import { makeRng, clamp } from './random.js';
import { createWorld, collideBuildings, clampToWorld, updatePickups } from './world.js';
import { createInput, keyDown } from './input.js';
import { createAudio } from './audio.js';
import { makePlayer, updatePlayer, hurtPlayer } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePed } from './peds.js';
import { makePolice, raiseWanted, updatePolice, clearPolice } from './police.js';
import { makeMissions, startMission, updateMissions, makeTaxi, updateTaxi } from './missions.js';
import { readSave, writeSave, applySave, saveSummaryText } from './save.js';
import {
  createCamera, drawWorld, drawCars, drawPeds, drawPlayer, drawBullets,
  drawParticles, drawMarker, drawHUD, drawTitle, drawPause, drawEnd, drawSunsetGrade,
  drawNightGrade,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

export function createGame() {
  const game = {
    canvas, ctx,
    input: createInput(canvas),
    audio: createAudio(),
    camera: createCamera(),
    state: 'title', // title | play | pause | busted | wasted | complete
    time: 0,
    clockMinutes: DAY.startMinutes,
    lighting: 'day',
    seed: 20261118,
    rng: makeRng(20261118),
    world: null,
    player: null,
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    floaters: [],
    missions: null,
    taxi: makeTaxi(),
    police: makePolice(),
    danger: null,
    mouseWorld: { x: 0, y: 0 },
    bannerText: null,
    bannerT: 0,
    storyComplete: false,
    minimapZoom: 1, // 0 small, 1 normal, 2 large: N key or mouse wheel
    stats: { fares: 0, packages: 0, stolen: 0, bestWanted: 0, pickups: 0 },
    saveExists: false,
    saveSummary: '',
    edge(name) {
      if (game.input.pressed.has(name)) {
        game.input.pressed.delete(name);
        return true;
      }
      return false;
    },
    banner(title, sub, secs) {
      game.bannerText = { title, sub: sub || '' };
      game.bannerT = secs || 4;
    },
    floater(x, y, text, color) {
      game.floaters.push({ x, y, text, color: color || '#fff', life: 1.6 });
    },
    addParticles(x, y, n, color) {
      for (let i = 0; i < n; i += 1) {
        const a = game.rng() * Math.PI * 2;
        const sp = 40 + game.rng() * 120;
        game.particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5 + game.rng() * 0.5, max: 1, size: 2 + game.rng() * 3, color,
        });
      }
    },
    raiseWanted(levels, crime) { raiseWanted(game, levels, crime); },
    saveGame() { writeSave(game); },
    endRun(kind) { endRun(game, kind); },
  };
  game.reset = (seed) => resetGame(game, seed || 20261118);
  game.update = (dt) => updateGame(game, dt);
  game.render = () => renderGame(game);
  game.startGame = (useSave) => startGame(game, useSave);
  game.reset(game.seed);
  const save = readSave();
  if (save) {
    game.saveExists = true;
    game.saveSummary = saveSummaryText(save);
    game.pendingSave = save;
  }
  return game;
}

function resetGame(game, seed) {
  game.seed = seed;
  game.rng = makeRng(seed + 7);
  game.world = createWorld(seed);
  game.player = makePlayer(1000, 1000);
  game.cars = [];
  game.peds = [];
  game.bullets = [];
  game.particles = [];
  game.floaters = [];
  game.missions = makeMissions(game.world);
  game.taxi = makeTaxi();
  game.police = makePolice();
  game.danger = null;
  game.time = 0;
  game.clockMinutes = DAY.startMinutes;
  game.lighting = 'day';
  game.bannerText = null;
  game.bannerT = 0;
  game.storyComplete = false;
  game.minimapZoom = 1;
  game.stats = { fares: 0, packages: 0, stolen: 0, bestWanted: 0, pickups: 0 };
  spawnTraffic(game, 14);
  spawnParked(game, 12);
  spawnPeds(game, 64);
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
}

function startGame(game, useSave) {
  game.reset(game.seed);
  if (useSave && game.pendingSave) applySave(game, game.pendingSave);
  game.state = 'play';
  game.audio.ensure();
  game.banner('Solara Bay', 'Find Lena at the garage — press M to start your first mission.', 5);
}

function endRun(game, kind) {
  if (game.state !== 'play') return;
  const p = game.player;
  const fine = kind === 'busted' ? 120 : 150;
  p.cash = Math.max(0, p.cash - fine);
  if (game.missions.active) {
    game.missions.failed = { title: game.missions.active.title, reason: kind === 'busted' ? 'Busted' : 'Wasted' };
    game.missions.active = null;
  }
  clearPolice(game);
  p.health = 100;
  p.armor = 0;
  p.ammo = 12;
  p.reserveAmmo = 48;
  if (p.inCar) { p.inCar.driver = null; p.inCar = null; }
  p.x = game.world.landmarks.garage.x;
  p.y = game.world.landmarks.garage.y + 40;
  game.audio.busted();
  game.audio.setEngine(0, false);
  game.saveGame();
  game.state = kind;
}

function updateGame(game, dt) {
  game.time += dt;
  // The city lives even behind the title screen.
  for (const car of game.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') updateTraffic(car, dt, game);
  }
  for (const ped of game.peds) updatePed(game, ped, dt);
  if (game.state !== 'play') return;
  game.clockMinutes += dt * DAY.minutesPerSecond;
  // Day/night cycle: the clock drives the lighting — day, golden hour,
  // then night with headlights after 19:00 until dawn at 06:00.
  const mins = game.clockMinutes % (24 * 60);
  game.lighting = mins >= LIGHTING.nightStart || mins < LIGHTING.nightEnd ? 'night'
    : mins >= LIGHTING.sunsetStart ? 'sunset' : 'day';
  updatePickups(game.world, dt);
  // Mouse position in world space (for aiming). input.mouse is already in
  // canvas pixels, so only the camera offset applies.
  game.mouseWorld.x = game.camera.x - VIEW.width / 2 + game.input.mouse.x;
  game.mouseWorld.y = game.camera.y - VIEW.height / 2 + game.input.mouse.y;
  updatePlayer(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  updateTaxi(game, dt);
  game.stats.stolen = game.cars.filter((c) => c.stolen).length;
  game.stats.bestWanted = Math.max(game.stats.bestWanted, game.police.wanted);
  // Bullets fly, hit things, and die on walls.
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (collideBuildings(game.world, { x: b.x, y: b.y, radius: 2 })) b.life = 0;
  }
  game.bullets = game.bullets.filter((b) => {
    if (b.life <= 0) return false;
    if (b.from === 'player') {
      for (const ped of game.peds) {
        if (!ped.dead && ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.state = 'down';
          ped.stateT = 8;
          game.raiseWanted(1, 'shooting');
          game.addParticles(ped.x, ped.y, 6, '#c94f4f');
          return false;
        }
      }
      for (const car of game.cars) {
        if (!car.dead && Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.health -= 9;
          game.addParticles(b.x, b.y, 4, '#ffd76a');
          if (car.health <= 0 && !car.dead) {
            car.dead = true;
            game.addParticles(car.x, car.y, 24, '#ff8a3a');
            if (car.driver === 'police') game.raiseWanted(1, 'cop-down');
          }
          return false;
        }
      }
      for (const cop of game.police.footCops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
          game.police.footCops.splice(game.police.footCops.indexOf(cop), 1);
          game.raiseWanted(1, 'cop-down');
          game.addParticles(cop.x, cop.y, 8, '#c94f4f');
          return false;
        }
      }
    } else if (b.from === 'police') {
      const p = game.player;
      if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        hurtPlayer(game, 7, 'police');
        return false;
      }
      if (p.inCar && Math.hypot(p.inCar.x - b.x, p.inCar.y - b.y) < 26) {
        p.inCar.health -= 4;
        return false;
      }
    }
    return true;
  });
  // Particles and floating text fade.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  for (const f of game.floaters) {
    f.y -= 26 * dt;
    f.life -= dt;
  }
  game.floaters = game.floaters.filter((f) => f.life > 0);
  if (game.danger) {
    game.danger.t -= dt;
    if (game.danger.t <= 0) game.danger = null;
  }
  if (game.bannerT > 0) {
    game.bannerT -= dt;
    if (game.bannerT <= 0) game.bannerText = null;
  }
  // Camera follows the player, clamped to the world.
  const p = game.player;
  const tx = clamp(p.x, VIEW.width / 2 - 40, WORLD.width - VIEW.width / 2 + 40);
  const ty = clamp(p.y, VIEW.height / 2 - 40, WORLD.height - VIEW.height / 2 + 40);
  game.camera.x += (tx - game.camera.x) * Math.min(1, 5 * dt);
  game.camera.y += (ty - game.camera.y) * Math.min(1, 5 * dt);
  // Global keys.
  if (game.edge('p') || game.edge('Escape')) {
    game.state = 'pause';
    game.audio.setEngine(0, false);
  }
  if (game.edge('q')) game.audio.toggleMute();
  if (game.edge('n')) game.minimapZoom = (game.minimapZoom + 1) % 3;
  if (game.input.wheelY !== 0) {
    // Wheel up zooms the minimap in, wheel down zooms it out.
    const steps = game.input.wheelY > 0 ? -1 : 1;
    game.minimapZoom = clamp(game.minimapZoom + steps, 0, 2);
    game.input.wheelY = 0;
  }
  if (game.edge('m') && !game.missions.active && game.missions.index < game.missions.list.length) {
    startMission(game, game.missions.index);
  }
}

function renderGame(game) {
  const ctx2 = game.ctx;
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.fillStyle = '#1d5f86';
  ctx2.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx2.save();
  ctx2.translate(VIEW.width / 2 - game.camera.x, VIEW.height / 2 - game.camera.y);
  drawWorld(ctx2, game);
  drawMarker(ctx2, game);
  drawCars(ctx2, game);
  drawPeds(ctx2, game);
  drawPlayer(ctx2, game);
  drawBullets(ctx2, game);
  drawParticles(ctx2, game);
  ctx2.restore();
  if (game.lighting === 'sunset') drawSunsetGrade(ctx2);
  else if (game.lighting === 'night') drawNightGrade(ctx2, game);
  if (game.state === 'title') drawTitle(ctx2, game);
  else if (game.state === 'pause') { drawHUD(ctx2, game); drawPause(ctx2, game); }
  else if (game.state === 'busted' || game.state === 'wasted' || game.state === 'complete') {
    drawHUD(ctx2, game);
    drawEnd(ctx2, game, game.state);
  } else drawHUD(ctx2, game);
}

// ---- Boot ----
const game = createGame();
window.__game = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot, game);
  game.render();
  window.__shotReady = true;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state === 'title') {
      if (game.edge('Enter') || game.input.mouse.clicked) startGame(game, false);
      else if (game.edge('c') && game.saveExists) startGame(game, true);
      game.update(dt);
    } else if (game.state === 'pause') {
      if (game.edge('p') || game.edge('Escape')) game.state = 'play';
      else if (game.edge('r')) startGame(game, false);
      else if (game.edge('m') && !game.missions.active && game.missions.index < game.missions.list.length) {
        game.state = 'play';
        startMission(game, game.missions.index);
      }
    } else if (game.state === 'busted' || game.state === 'wasted' || game.state === 'complete') {
      if (game.edge('Enter')) { game.state = 'play'; game.banner('Free roam', 'Missions, fares and packages are still out there.', 4); }
      else if (game.edge('r')) startGame(game, false);
    } else {
      game.update(dt);
    }
    game.input.mouse.clicked = false;
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.addEventListener('mousedown', () => game.audio.ensure(), { once: true });
  window.addEventListener('keydown', () => game.audio.ensure(), { once: true });
}

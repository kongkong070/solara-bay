// Solara Bay boot and game loop: builds the world, wires every system,
// and runs the frame loop. Exposes the game as window.__game so the
// playtest and the shot tool can drive it.
import { WORLD, DIFFICULTIES, CLOCK, TUNING } from './config.js';
import { makeRng, clamp } from './util.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { makePlayer, updatePlayer, updateBullets } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { makePolice, updatePolice } from './police.js';
import { makeMissions, startNextMission, updateMissions } from './missions.js';
import { render } from './render.js';
import { saveGame, loadGame, applySave } from './save.js';
import { stageShot, shotSeed } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newGame() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.has('seed') || params.has('shot')
    ? shotSeed()
    : Math.floor(Math.random() * 100000);
  const game = {
    state: 'title',
    time: 0,
    timePlayed: 0,
    clockMinutes: CLOCK.startMinutes,
    rng: makeRng(seed),
    view: { w: canvas.width, h: canvas.height },
    ctx,
    camera: { x: 1720, y: 1200 },
    mapZoom: 1,
    difficultyKey: 'normal',
    difficulties: DIFFICULTIES,
    diff: DIFFICULTIES.normal,
    messages: [],
    particles: [],
    bullets: [],
    recentShot: null,
    bustedReason: '',
    saveData: null,
  };
  game.input = createInput(canvas);
  game.audio = createAudio();
  game.world = buildWorld(game.rng);
  game.player = makePlayer(1720, 1200, DIFFICULTIES.normal.startCash);
  game.police = makePolice();
  game.missions = makeMissions(game);
  game.cars = [];
  game.peds = [];
  game.saveData = loadGame();
  if (game.saveData && game.saveData.difficulty && DIFFICULTIES[game.saveData.difficulty]) {
    game.difficultyKey = game.saveData.difficulty;
    game.diff = DIFFICULTIES[game.difficultyKey];
  }
  game.player.cash = game.diff.startCash;
  applySave(game, game.saveData);

  game.addMessage = function addMessage(text) {
    game.messages.push({ text, ttl: 5 });
    if (game.messages.length > 4) game.messages.shift();
  };
  game.addParticles = function addParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = game.rng.range(0, Math.PI * 2);
      const sp = game.rng.range(40, 180);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: game.rng.range(0.3, 0.7),
        maxLife: 0.7,
        color,
        size: game.rng.range(2, 5),
      });
    }
  };
  game.save = function save() {
    saveGame(game);
  };
  game.setDifficulty = function setDifficulty(key) {
    if (!DIFFICULTIES[key]) return;
    game.difficultyKey = key;
    game.diff = DIFFICULTIES[key];
    game.player.cash = game.diff.startCash;
  };
  game.startMission = function startMission() {
    return startNextMission(game);
  };

  spawnTraffic(game, 14);
  spawnParked(game, 9);
  spawnPeds(game, 26);
  return game;
}

const game = newGame();
window.__game = game;

// Keep traffic and pedestrians topped up near the player.
function upkeep(game, dt) {
  game.upkeepTimer = (game.upkeepTimer || 0) - dt;
  if (game.upkeepTimer > 0) return;
  game.upkeepTimer = 2;
  const near = (e) => Math.hypot(e.x - game.player.x, e.y - game.player.y) < 1300;
  game.cars = game.cars.filter((c) => !c.dead && (c.driver === 'player' || near(c) || c.driver === 'police'));
  game.peds = game.peds.filter((p) => p.state !== 'down' || near(p));
  const traffic = game.cars.filter((c) => c.driver === 'traffic').length;
  const parked = game.cars.filter((c) => c.driver === null).length;
  if (traffic < 12) spawnTraffic(game, 12 - traffic);
  if (parked < 7) spawnParked(game, 7 - parked);
  if (game.peds.length < 22) spawnPeds(game, 22 - game.peds.length);
}

function updatePlaying(game, dt) {
  game.timePlayed += dt;
  game.clockMinutes += CLOCK.minutesPerSecond * dt;
  if (game.clockMinutes >= 1440) game.clockMinutes -= 1440;
  updatePlayer(game, dt);
  updateBullets(game, dt);
  for (const car of game.cars) {
    if (car.driver === 'traffic' && !car.dead) {
      // Traffic brains live in vehicles.js; call through the game.
      updateTrafficCar(game, car, dt);
    }
  }
  updatePeds(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  // Particles.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.98;
    pt.vy *= 0.98;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
  // Messages fade.
  for (const m of game.messages) m.ttl -= dt;
  game.messages = game.messages.filter((m) => m.ttl > 0);
  // Camera follows the player.
  const cam = game.camera;
  cam.x += (game.player.x - cam.x) * Math.min(1, 5 * dt);
  cam.y += (game.player.y - cam.y) * Math.min(1, 5 * dt);
  cam.x = clamp(cam.x, game.view.w / 2 - 200, WORLD.width - game.view.w / 2 + 200);
  cam.y = clamp(cam.y, game.view.h / 2 - 200, WORLD.height - game.view.h / 2 + 200);
  // Minimap zoom: N cycles, the wheel steps.
  if (game.input.wasPressed('KeyN')) {
    game.mapZoom = (game.mapZoom + 1) % 3;
  }
  const wheel = game.input.takeWheel();
  if (wheel !== 0) {
    game.mapZoom = clamp(game.mapZoom + (wheel > 0 ? -1 : 1), 0, 2);
  }
  // Mission key, pause, mute.
  if (game.input.wasPressed('KeyM')) game.startMission();
  if (game.input.wasPressed('KeyP') || game.input.wasPressed('Escape')) {
    game.state = 'paused';
  }
  if (game.input.wasPressed('KeyQ')) {
    game.audio.toggleMute();
  }
  upkeep(game, dt);
  game.audio.setEngine(
    game.player.inCar ? Math.abs(game.player.inCar.speed) / (TUNING.carMaxSpeed * 1.3) : 0,
    !!game.player.inCar,
  );
  game.audio.setSiren(game.police.wanted);
  game.audio.update(dt);
}

// Traffic update lives here so main.js owns the frame order.
function updateTrafficCar(game, car, dt) {
  updateTraffic(car, dt, game);
}

// Title screen keys: 1/2/3 pick a difficulty, Enter starts the game.
function updateTitle(game) {
  const input = game.input;
  if (input.wasPressed('Digit1')) game.setDifficulty('chill');
  if (input.wasPressed('Digit2')) game.setDifficulty('normal');
  if (input.wasPressed('Digit3')) game.setDifficulty('hardcore');
  if (input.wasPressed('Enter')) {
    game.audio.ensure();
    game.audio.select();
    game.state = 'playing';
    game.addMessage('Welcome to Solara Bay. Press M for your first mission.');
    game.save();
  }
  if (input.wasPressed('KeyQ')) game.audio.toggleMute();
}

// The busted screen waits for Enter, then play resumes from the hospital.
function updateBusted(game) {
  if (game.input.wasPressed('Enter')) {
    game.state = 'playing';
    game.audio.select();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.time += dt;
  if (game.state === 'title') {
    updateTitle(game);
  } else if (game.state === 'playing') {
    updatePlaying(game, dt);
  } else if (game.state === 'paused') {
    if (game.input.wasPressed('KeyP') || game.input.wasPressed('Escape') || game.input.wasPressed('Enter')) {
      game.state = 'playing';
    }
  } else if (game.state === 'busted') {
    updateBusted(game);
  }
  render(game);
  game.input.clearEdges();
  requestAnimationFrame(frame);
}

// Stage a deterministic screenshot scene when the URL asks for one.
stageShot(game);
requestAnimationFrame(frame);

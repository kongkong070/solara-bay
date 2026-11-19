// Solara Bay boot and game loop: builds the state, steps every system in
// order, and switches between title, playing, paused, busted and finale.

import { GAME_HOUR_SECONDS, VIEW_H, VIEW_W, WANTED } from './config.js';
import { clamp, mulberry32 } from './util.js';
import { buildCity } from './world.js';
import { createAudio, cycleStation, ensureAudio, setMuted, updateAudio } from './audio.js';
import { clearSave, hasSave, loadSave, saveGame } from './save.js';
import { createInput, endFrame, held, wasPressed } from './input.js';
import { spawnPeds, updatePeds } from './peds.js';
import { spawnParkedCars, spawnTraffic, updateTraffic } from './vehicles.js';
import { spawnBoats } from './boats.js';
import { createPlayer, updatePlayer } from './player.js';
import { clearWanted, updatePolice } from './police.js';
import { createMissions, startNextMission, tryPickupFare, updateMissions } from './missions.js';
import { createCamera, drawGame } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function newRun(S, seed) {
  S.rng = mulberry32(seed);
  S.city = buildCity(S.rng);
  S.player = createPlayer(S);
  S.missions = createMissions();
  S.fare = { active: false, ped: null, dest: null, amount: 0 };
  S.wanted = 0;
  S.heat = 0;
  S.hiddenTimer = 0;
  S.copCars = [];
  S.cops = [];
  S.heli = null;
  S.banner = null;
  S.particles = [];
  S.events = { shotFired: 0, shotX: 0, shotY: 0, busted: false };
  S.clock = { hour: 8, minute: 0 };
  S.stats = { timePlayed: 0, earnings: 0, fares: 0, packages: 0, carsStolen: 0, boatsRidden: 0, heliRides: 0, bestWanted: 0 };
  S.minimapZoom = 0;
  spawnTraffic(S, 14);
  spawnParkedCars(S, 8);
  spawnPeds(S, 24);
  spawnBoats(S);
  S.camera.x = clamp(S.player.x - VIEW_W / 2, 0, 3600 - VIEW_W);
  S.camera.y = clamp(S.player.y - VIEW_H / 2, 0, 2800 - VIEW_H);
}

function createState() {
  const S = {
    rng: mulberry32(1),
    seed: 1,
    city: null,
    clock: { hour: 8, minute: 0 },
    difficulty: 'normal',
    mode: 'title',
    camera: createCamera(),
    player: null,
    missions: createMissions(),
    fare: { active: false, ped: null, dest: null, amount: 0 },
    wanted: 0,
    heat: 0,
    hiddenTimer: 0,
    copCars: [],
    cops: [],
    heli: null,
    banner: null,
    particles: [],
    events: { shotFired: 0, shotX: 0, shotY: 0, busted: false },
    stats: { timePlayed: 0, earnings: 0, fares: 0, packages: 0, carsStolen: 0, boatsRidden: 0, heliRides: 0, bestWanted: 0 },
    minimapZoom: 0,
    timeMs: 0,
    autosaveTimer: 30,
    audio: createAudio(),
    input: createInput(canvas),
    mouseWorld: { x: 0, y: 0 },
    hasSave: false,
    shotMode: false,
    shotName: null,
  };
  newRun(S, (Date.now() % 100000) + 7);
  S.hasSave = hasSave();
  return S;
}

function applyLoadedSave(S, save) {
  const p = S.player;
  p.cash = save.cash;
  p.hp = save.hp;
  p.armor = save.armor;
  p.ammo = save.ammo;
  S.difficulty = save.difficulty || 'normal';
  S.clock.hour = save.hour;
  S.clock.minute = save.minute;
  S.missions.done = save.missionsDone.slice();
  S.missions.idx = save.missionsDone.length;
  S.stats = { ...S.stats, ...save.stats };
  save.packagesTaken.forEach((taken, i) => {
    if (taken && S.city.packages[i]) S.city.packages[i].taken = true;
  });
  p.x = save.x;
  p.y = save.y;
  S.camera.x = clamp(p.x - VIEW_W / 2, 0, 3600 - VIEW_W);
  S.camera.y = clamp(p.y - VIEW_H / 2, 0, 2800 - VIEW_H);
}

function enterBusted(S) {
  S.events.busted = false;
  S.missions.active = null;
  S.fare.active = false;
  S.player.hp = 100;
  S.player.armor = 0;
  S.player.cash = Math.max(0, S.player.cash - WANTED.bustPenalty);
  S.player.mode = 'foot';
  S.player.vehicle = null;
  S.player.boat = null;
  S.player.heli = null;
  S.player.x = 2025;
  S.player.y = 1300;
  clearWanted(S);
  S.mode = 'busted';
  saveGame(S);
}

function updateParticles(S, dt) {
  for (const pt of S.particles) {
    pt.life -= dt;
    pt.x += (pt.vx || 0) * dt;
    pt.y += (pt.vy || 0) * dt;
  }
  S.particles = S.particles.filter((pt) => pt.life > 0);
  if (S.particles.length > 400) S.particles.splice(0, S.particles.length - 400);
}

function updatePlaying(S, dt) {
  const input = S.input;
  // The clock drives day and night.
  S.clock.minute += dt * (60 / GAME_HOUR_SECONDS);
  if (S.clock.minute >= 60) {
    S.clock.minute -= 60;
    S.clock.hour = (S.clock.hour + 1) % 24;
  }
  S.stats.timePlayed += dt;

  if (wasPressed(input, 'pause')) {
    S.mode = 'paused';
    saveGame(S);
    return;
  }
  if (wasPressed(input, 'mission')) startNextMission(S);
  if (wasPressed(input, 'radio')) {
    const name = cycleStation(S.audio);
    S.banner = { text: 'Radio: ' + name, t: 1.5 };
  }
  if (wasPressed(input, 'zoom') || input.wheel !== 0) {
    S.minimapZoom = ((S.minimapZoom || 0) + 1) % 3;
  }
  if (wasPressed(input, 'mute')) {
    setMuted(S.audio, !S.audio.muted);
    S.banner = { text: S.audio.muted ? 'Sound muted' : 'Sound on', t: 1.5 };
  }

  S.mouseWorld.x = input.mouseX + S.camera.x;
  S.mouseWorld.y = input.mouseY + S.camera.y;

  tryPickupFare(S);
  updatePlayer(S, dt);
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateMissions(S, dt);
  updateParticles(S, dt);

  S.events.shotFired = Math.max(0, S.events.shotFired - dt);
  if (S.banner) {
    S.banner.t -= dt;
    if (S.banner.t <= 0) S.banner = null;
  }
  if (S.events.busted) enterBusted(S);

  S.autosaveTimer -= dt;
  if (S.autosaveTimer <= 0) {
    S.autosaveTimer = 30;
    saveGame(S);
  }
  updateAudio(S.audio, S, dt);
}

function updateTitle(S, dt) {
  const input = S.input;
  if (wasPressed(input, 'diff1')) S.difficulty = 'chill';
  if (wasPressed(input, 'diff2')) S.difficulty = 'normal';
  if (wasPressed(input, 'diff3')) S.difficulty = 'hardcore';
  if (wasPressed(input, 'confirm')) {
    ensureAudio(S.audio);
    const save = S.hasSave ? loadSave() : null;
    if (save) applyLoadedSave(S, save);
    S.mode = 'playing';
    return;
  }
  // On the title screen N starts a fresh run instead of continuing a save.
  if (S.hasSave && wasPressed(input, 'zoom')) {
    clearSave();
    S.hasSave = false;
    newRun(S, (Date.now() % 100000) + 7);
    S.mode = 'playing';
    return;
  }
  updateTraffic(S, dt);
  updatePeds(S, dt);
  updateParticles(S, dt);
}

let S = createState();

// Deterministic screenshot scenes come from the URL, before the first frame.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number(params.get('seed') || '1');
if (shot) {
  applyShot(S, shot, Number.isFinite(seedParam) ? seedParam : 1);
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  S.timeMs += dt * 1000;
  const input = S.input;

  if (S.mode === 'playing') updatePlaying(S, dt);
  else if (S.mode === 'title') updateTitle(S, dt);
  else if (S.mode === 'paused') {
    if (wasPressed(input, 'pause')) S.mode = 'playing';
    if (wasPressed(input, 'mute')) setMuted(S.audio, !S.audio.muted);
  } else if (S.mode === 'busted') {
    if (wasPressed(input, 'confirm')) S.mode = 'playing';
  } else if (S.mode === 'finale') {
    if (wasPressed(input, 'confirm')) S.mode = 'playing';
    updateTraffic(S, dt);
    updatePeds(S, dt);
  }

  drawGame(ctx, S);
  endFrame(input);
  requestAnimationFrame(frame);
}

// Clicking the canvas also starts the game from the title screen.
canvas.addEventListener('click', () => {
  ensureAudio(S.audio);
  if (S.mode === 'title') {
    const save = S.hasSave ? loadSave() : null;
    if (save) applyLoadedSave(S, save);
    S.mode = 'playing';
  }
});

// Test hooks for the headless playtest: teleport, stage control, state read.
window.SOLARA_DEBUG = {
  state: () => S,
  teleport(x, y) {
    S.player.x = x;
    S.player.y = y;
    if (S.player.vehicle) { S.player.vehicle.x = x; S.player.vehicle.y = y; }
    if (S.player.boat) { S.player.boat.x = x; S.player.boat.y = y; }
    if (S.player.heli) { S.player.heli.x = x; S.player.heli.y = y; }
    return { x: S.player.x, y: S.player.y };
  },
  setWanted(n) {
    S.heat = n * 40 + 10;
    S.wanted = n;
  },
  startMission(i) {
    S.missions.idx = i;
    S.missions.active = null;
    startNextMission(S);
    return S.missions.active;
  },
  snapshot() {
    const p = S.player;
    return {
      mode: S.mode,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: Math.round(p.hp),
      cash: Math.round(p.cash),
      wanted: S.wanted,
      playerMode: p.mode,
      mission: S.missions.active ? { idx: S.missions.active.idx, stage: S.missions.active.stage, t: Math.round(S.missions.active.t) } : null,
      missionsDone: S.missions.done.slice(),
      stats: { ...S.stats },
      clock: S.clock.hour + ':' + Math.round(S.clock.minute),
    };
  },
};

requestAnimationFrame(frame);

// Story and side work in Solara Bay. Six story missions with Lena Cruz,
// plus taxi fares and the hidden packages. The mission engine is a small
// stage machine: each stage names a place or a deed, and the HUD points at it.
import { fmtCash } from './random.js';
import { randomRoadPoint } from './world.js';

function stage(kind, x, y, text, extra) {
  return Object.assign({ kind, x, y, r: 70, text }, extra || {});
}

export function buildMissions(world) {
  const L = world.landmarks;
  return [
    {
      id: 'welcome', title: 'Welcome to Solara', reward: 100,
      brief: 'Lena Cruz runs a garage on the east side and needs a driver. Get over there and introduce yourself.',
      stages: [stage('goto', L.garage.x, L.garage.y, "Reach Lena's Garage", { r: 90 })],
    },
    {
      id: 'wheels', title: 'Wheels Up', reward: 250,
      brief: 'Lena needs a fast car for a job tonight. Find a sports car — a Cometa GT — take it, and bring it to the garage.',
      stages: [
        stage('steal', 0, 0, 'Steal a sports car (Cometa GT)', { carType: 'sport' }),
        stage('driveTo', L.garage.x, L.garage.y, 'Deliver the Cometa GT to the garage', { r: 90 }),
      ],
    },
    {
      id: 'delivery', title: 'Special Delivery', reward: 400,
      brief: 'Three parcels, three corners of the city, one very impatient client. 150 seconds. Do not keep them waiting.',
      stages: [
        stage('collect', 2200, 600, 'Drop-off 1 of 3: Bay Stadium', { time: 150 }),
        stage('collect', 600, 1800, 'Drop-off 2 of 3: South Market', {}),
        stage('collect', 2600, 1800, 'Drop-off 3 of 3: East Docks Road', {}),
      ],
    },
    {
      id: 'getaway', title: 'The Getaway', reward: 500,
      brief: 'Lena lifted a ledger from the wrong people. Pick her up at Solara Plaza, then lose the police and get her to the safehouse.',
      stages: [
        stage('goto', L.plaza.x, L.plaza.y, 'Pick up Lena at Solara Plaza', { r: 80 }),
        stage('escape', L.safehouse.x, L.safehouse.y, 'Lose the cops — reach the Safehouse', { r: 90, wantedOnStart: 2 }),
      ],
    },
    {
      id: 'heist', title: 'Harbor Heist', reward: 800,
      brief: 'Three loot bags sit in containers at the docks and the police already know. Grab all three, then bring them to the garage.',
      stages: [
        stage('collect', 2950, 2050, 'Loot bag 1 of 3: Docks North', { wantedOnStart: 3 }),
        stage('collect', 3050, 2250, 'Loot bag 2 of 3: Docks South', {}),
        stage('collect', 2850, 2150, 'Loot bag 3 of 3: Crane Yard', {}),
        stage('driveTo', L.garage.x, L.garage.y, 'Deliver the loot to the garage', { r: 90 }),
      ],
    },
    {
      id: 'king', title: 'King of Solara', reward: 1200,
      brief: 'One last run to own this city: hit every checkpoint across Solara Bay, then take the crown at the Marina Penthouse.',
      stages: [
        stage('collect', 600, 600, 'Checkpoint 1 of 4: North Gate', { time: 240 }),
        stage('collect', 2600, 1000, 'Checkpoint 2 of 4: East Bridge', {}),
        stage('collect', 1000, 2200, 'Checkpoint 3 of 4: Beach Road', {}),
        stage('collect', 2200, 2200, 'Checkpoint 4 of 4: Stadium Loop', {}),
        stage('driveTo', L.penthouse.x, L.penthouse.y, 'Finish at the Marina Penthouse', { r: 90 }),
      ],
    },
  ];
}

export function makeMissions(world) {
  return {
    list: buildMissions(world),
    index: 0, // next mission to start
    active: null,
    stageIndex: 0,
    stageT: 0,
    completed: 0,
    failed: null,
  };
}

export function startMission(game, index) {
  const m = game.missions;
  const def = m.list[index];
  if (!def) return false;
  m.active = def;
  m.stageIndex = 0;
  m.stageT = 0;
  m.failed = null;
  applyStageStart(game);
  game.banner(def.title, def.brief, 6);
  game.audio.blip(523, 0.15, 'triangle', 0.14);
  return true;
}

function applyStageStart(game) {
  const m = game.missions;
  const st = m.active.stages[m.stageIndex];
  if (!st) return;
  if (st.time) m.stageT = st.time;
  if (st.wantedOnStart) {
    game.police.wanted = st.wantedOnStart;
    game.police.heat = 0;
    game.floater(game.player.x, game.player.y - 44, 'WANTED LEVEL ' + st.wantedOnStart, '#ff5a4a');
  }
}

export function currentStage(game) {
  const m = game.missions;
  if (!m.active) return null;
  return m.active.stages[m.stageIndex] || null;
}

export function missionMarker(game) {
  const st = currentStage(game);
  if (!st) return null;
  if (st.kind === 'steal') {
    // Point at the nearest sports car.
    let best = null;
    let bestD = Infinity;
    for (const car of game.cars) {
      if (car.type !== 'sport' || car.dead) continue;
      const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best ? { x: best.x, y: best.y, label: 'Cometa GT' } : null;
  }
  return { x: st.x, y: st.y, label: st.text };
}

function completeStage(game) {
  const m = game.missions;
  m.stageIndex += 1;
  game.audio.pickup();
  if (m.stageIndex >= m.active.stages.length) completeMission(game);
  else applyStageStart(game);
}

function completeMission(game) {
  const m = game.missions;
  const def = m.active;
  game.player.cash += def.reward;
  m.completed += 1;
  m.index = Math.max(m.index, m.completed);
  game.banner('Mission complete: ' + def.title, 'Paid ' + fmtCash(def.reward) + ' — ' + m.completed + ' of ' + m.list.length + ' missions done.', 5);
  game.floater(game.player.x, game.player.y - 50, '+' + fmtCash(def.reward), '#7ae08a');
  game.audio.missionDone();
  game.saveGame();
  if (m.completed >= m.list.length) {
    game.storyComplete = true;
    game.state = 'complete';
  }
  m.active = null;
}

function failMission(game, reason) {
  const m = game.missions;
  m.failed = { title: m.active.title, reason };
  game.banner('Mission failed: ' + m.active.title, reason + ' — press M to try again.', 5);
  game.audio.busted();
  m.active = null;
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (!m.active) return;
  const st = currentStage(game);
  if (!st) return;
  const p = game.player;
  if (st.time) {
    m.stageT -= dt;
    if (m.stageT <= 0) {
      failMission(game, 'Out of time');
      return;
    }
  }
  const d = Math.hypot(p.x - st.x, p.y - st.y);
  switch (st.kind) {
    case 'goto':
      if (d < st.r) completeStage(game);
      break;
    case 'driveTo':
      if (p.inCar && d < st.r) completeStage(game);
      break;
    case 'collect':
      if (d < st.r) completeStage(game);
      break;
    case 'steal':
      if (p.inCar && p.inCar.type === st.carType) completeStage(game);
      break;
    case 'escape':
      if (d < st.r) {
        // Only counts once the heat is down to one star.
        if (game.police.wanted <= 1) completeStage(game);
      }
      break;
    default:
      break;
  }
}

// ---- Taxi side jobs ----
export function makeTaxi() {
  return { active: false, ped: null, target: null, timer: 0, fare: 0, waitT: 0 };
}

export function taxiStart(game, ped) {
  const taxi = game.taxi;
  const dest = randomRoadPoint(game.rng, game.player, 700);
  taxi.active = true;
  taxi.ped = ped;
  taxi.target = dest;
  taxi.timer = 75;
  taxi.fare = 45 + Math.round(Math.hypot(dest.x - game.player.x, dest.y - game.player.y) * 0.08);
  taxi.waitT = 0;
  ped.state = 'taxi';
  game.banner('Taxi fare', 'Get your passenger to the marker — ' + fmtCash(taxi.fare) + ' if you make it in time.', 4);
  game.audio.blip(660, 0.12, 'sine', 0.12);
}

export function updateTaxi(game, dt) {
  const taxi = game.taxi;
  if (!taxi.active) return;
  const p = game.player;
  taxi.timer -= dt;
  if (taxi.timer <= 0) {
    taxiCancel(game, 'Fare expired — the passenger walked away.');
    return;
  }
  if (p.inCar) {
    // The passenger rides with you.
    taxi.ped.x = p.x;
    taxi.ped.y = p.y;
    taxi.ped.state = 'taxi';
    const d = Math.hypot(p.x - taxi.target.x, p.y - taxi.target.y);
    if (d < 70) {
      p.cash += taxi.fare;
      game.floater(taxi.target.x, taxi.target.y - 30, '+' + fmtCash(taxi.fare), '#7ae08a');
      game.audio.missionDone();
      game.stats.fares += 1;
      taxi.active = false;
      taxi.ped.state = 'walk';
      taxi.ped.taxi = false;
      game.saveGame();
    }
  } else {
    taxi.waitT += dt;
    if (taxi.waitT > 25) taxiCancel(game, 'You left your passenger waiting too long.');
  }
}

function taxiCancel(game, reason) {
  const taxi = game.taxi;
  if (taxi.ped) taxi.ped.state = 'walk';
  taxi.active = false;
  taxi.ped = null;
  game.banner('Fare lost', reason, 3.5);
}

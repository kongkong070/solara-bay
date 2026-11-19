// Story missions, taxi fares, hidden cash packages and supply crates.
// Lena Cruz hands Rio Vega the jobs; each one pays in cash.
import { WORLD, TUNING, BUOYS } from './config.js';
import { clamp, dist } from './util.js';
import { randomRoadPoint } from './world.js';
import { setWanted } from './police.js';
import { nearestBoatOfType } from './boats.js';

const STORY = [
  {
    id: 'welcome',
    name: 'Welcome to Solara',
    brief: 'Lena Cruz is waiting at Neon Palms. Go and meet her.',
    reward: 100,
    steps: [
      { kind: 'goto', x: 640, y: 560, r: 70, text: 'Meet Lena at Neon Palms' },
    ],
  },
  {
    id: 'wheels',
    name: 'Wheels Up',
    brief: 'Lena needs a fast car. Steal a Cometa GT and bring it to the garage on 5th Ave.',
    reward: 250,
    steps: [
      { kind: 'inCar', type: 'sport', text: 'Steal a Cometa GT' },
      { kind: 'inCarGoto', x: 2080, y: 1200, r: 90, text: 'Deliver the GT to the garage' },
    ],
  },
  {
    id: 'delivery',
    name: 'Special Delivery',
    brief: 'A package for the Docks, and the clock is ticking. Drive it there in time.',
    reward: 300,
    steps: [
      { kind: 'timedGoto', x: 3160, y: 2160, r: 90, seconds: 95, text: 'Deliver the package to the Docks' },
    ],
  },
  {
    id: 'getaway',
    name: 'The Getaway',
    brief: 'You tripped an alarm. Lose the SBPD, then lay low at the safehouse.',
    reward: 400,
    steps: [
      { kind: 'wantedAtLeast', n: 2, text: 'Get the cops on your tail' },
      { kind: 'wantedZero', text: 'Lose the cops' },
      { kind: 'goto', x: 1360, y: 880, r: 80, text: 'Reach the safehouse at City Hall' },
    ],
  },
  {
    id: 'harbor',
    name: 'Harbor Heist',
    brief: 'Three crates are sitting on the Docks. Grab them all and drop them at the pier.',
    reward: 500,
    steps: [
      { kind: 'collect', count: 3, spread: 220, cx: 3160, cy: 2160, text: 'Collect the dock crates (0/3)' },
      { kind: 'goto', x: 1720, y: 2520, r: 90, text: 'Drop the crates at Sunset Pier' },
    ],
  },
  {
    id: 'finale',
    name: 'King of Solara',
    brief: 'One last job: reach the Marina Penthouse and hold the block for 30 seconds.',
    reward: 900,
    steps: [
      { kind: 'goto', x: 3160, y: 240, r: 90, text: 'Reach the Marina Penthouse' },
      { kind: 'survive', seconds: 30, wanted: 3, text: 'Hold the block — survive 30 seconds' },
    ],
  },
  {
    id: 'bay-runner',
    name: 'Bay Runner',
    brief: 'A package for the far side of the bay. Take a speedboat from the marina, round all three buoys, then bring her home to Sunset Pier.',
    reward: 600,
    steps: [
      { kind: 'inBoat', type: 'speedboat', text: 'Take a speedboat from the marina' },
      { kind: 'buoyRun', seconds: 85, text: 'Round the buoys (0/3)' },
      { kind: 'goto', x: 1720, y: 2520, r: 100, text: 'Bring the boat home to Sunset Pier' },
    ],
  },
  {
    id: 'skyline',
    name: 'Skyline Escape',
    brief: 'The city wants you gone. Reach Bay Stadium, hold the block at four stars, and catch Lena\'s helicopter out.',
    reward: 1200,
    steps: [
      { kind: 'goto', x: 2800, y: 1520, r: 90, text: 'Reach Bay Stadium' },
      { kind: 'survive', seconds: 20, wanted: 4, text: 'Hold the block — survive 20 seconds' },
      { kind: 'heli', x: 2800, y: 1520, text: 'Board the helicopter' },
    ],
  },
];

export function makeMissions(game) {
  const missions = {
    defs: STORY,
    index: 0,
    active: null,
    done: [],
    packages: [],
    crates: [],
    fare: null,
    fareCooldown: 12,
    earned: 0,
    faresDone: 0,
    packagesFound: 0,
    boatsRidden: 0,
    heliFlown: 0,
  };
  // Twelve hidden cash packages scattered across the city and the beach.
  for (let i = 0; i < 12; i++) {
    const p = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 200);
    missions.packages.push({ x: p.x, y: p.y, taken: false });
  }
  // Eight supply crates: health, armour and ammo, respawning after a minute.
  const crateSpots = [
    [280, 240], [1000, 560], [1720, 880], [2440, 1200],
    [3160, 1520], [640, 1840], [2080, 2160], [1720, 2450],
  ];
  for (const [x, y] of crateSpots) {
    missions.crates.push({ x, y, taken: false, respawn: 0 });
  }
  return missions;
}

export function startNextMission(game) {
  const missions = game.missions;
  if (missions.active) return false;
  if (missions.index >= missions.defs.length) {
    game.addMessage('All story missions complete — Solara Bay is yours, Rio.');
    return false;
  }
  const def = missions.defs[missions.index];
  missions.active = {
    def,
    stepIdx: 0,
    timer: null,
    collected: [],
    points: [],
    buoys: [],
    surviveLeft: 0,
  };
  prepareStep(game, missions.active);
  game.addMessage('Mission: ' + def.name + ' — ' + def.brief);
  game.audio.select();
  return true;
}

function prepareStep(game, active) {
  const step = active.def.steps[active.stepIdx];
  if (!step) return;
  active.timer = null;
  if (step.kind === 'timedGoto') {
    active.timer = step.seconds * game.diff.missionTime;
  }
  if (step.kind === 'collect') {
    active.points = [];
    for (let i = 0; i < step.count; i++) {
      const a = game.rng.range(0, Math.PI * 2);
      const d = game.rng.range(40, step.spread);
      active.points.push({
        x: clamp(step.cx + Math.cos(a) * d, 60, WORLD.width - 60),
        y: clamp(step.cy + Math.sin(a) * d, 60, WORLD.beachTop - 40),
        taken: false,
      });
    }
    active.collected = [];
  }
  if (step.kind === 'buoyRun') {
    active.buoys = BUOYS.map((b) => ({ x: b.x, y: b.y, taken: false }));
    active.timer = step.seconds * game.diff.missionTime;
  }
  if (step.kind === 'survive') {
    active.surviveLeft = step.seconds;
    setWanted(game, step.wanted || 2);
  }
  if (step.kind === 'wantedAtLeast') {
    setWanted(game, step.n);
  }
  if (step.kind === 'heli') {
    // Lena's helicopter comes in over the stadium and sets down.
    game.heli = {
      x: step.x, y: step.y,
      angle: 0,
      state: 'landing', // 'landing' | 'landed' | 'boarding' | 'gone'
      altitude: 1,
      timer: 0,
    };
    game.addMessage('The helicopter is coming in — get to the pad!');
    game.audio.heli();
  }
}

function stepText(active) {
  const step = active.def.steps[active.stepIdx];
  if (!step) return '';
  if (step.kind === 'collect') {
    return step.text.replace('(0/3)', '(' + active.collected.length + '/' + step.count + ')');
  }
  if (step.kind === 'buoyRun') {
    const hit = active.buoys.filter((b) => b.taken).length;
    return step.text.replace('(0/3)', '(' + hit + '/' + active.buoys.length + ')');
  }
  return step.text;
}

export function currentObjective(game) {
  const missions = game.missions;
  if (missions.active) {
    const active = missions.active;
    const step = active.def.steps[active.stepIdx];
    if (!step) return null;
    if (step.kind === 'goto' || step.kind === 'timedGoto' || step.kind === 'inCarGoto') {
      return { x: step.x, y: step.y, text: stepText(active) };
    }
    if (step.kind === 'collect') {
      const next = active.points.find((p) => !p.taken);
      if (next) return { x: next.x, y: next.y, text: stepText(active) };
    }
    if (step.kind === 'buoyRun') {
      const next = active.buoys.find((b) => !b.taken);
      if (next) return { x: next.x, y: next.y, text: stepText(active) };
    }
    if (step.kind === 'inCar') {
      // Point at the nearest car of the wanted type.
      let best = null;
      let bestD = Infinity;
      for (const car of game.cars) {
        if (car.type !== step.type || car.dead) continue;
        const d = dist(car.x, car.y, game.player.x, game.player.y);
        if (d < bestD) { bestD = d; best = car; }
      }
      if (best) return { x: best.x, y: best.y, text: stepText(active) };
    }
    if (step.kind === 'inBoat') {
      const boat = nearestBoatOfType(game, step.type, game.player.x, game.player.y);
      if (boat) return { x: boat.x, y: boat.y, text: stepText(active) };
    }
    if (step.kind === 'heli' && game.heli) {
      return { x: game.heli.x, y: game.heli.y, text: stepText(active) };
    }
    return { x: game.player.x, y: game.player.y, text: stepText(active) };
  }
  if (missions.fare) {
    const fare = missions.fare;
    if (fare.phase === 'pickup') return { x: fare.ped.x, y: fare.ped.y, text: 'Pick up the fare' };
    return { x: fare.destX, y: fare.destY, text: 'Drop the fare off' };
  }
  return null;
}

function completeMission(game) {
  const missions = game.missions;
  const active = missions.active;
  const payout = Math.round(active.def.reward * game.diff.payout);
  game.player.cash += payout;
  missions.earned += payout;
  missions.done.push(active.def.id);
  missions.index += 1;
  missions.active = null;
  game.addMessage('Mission complete: ' + active.def.name + ' (+$' + payout + ')');
  game.audio.cash();
  game.save();
}

function failMission(game, reason) {
  const missions = game.missions;
  const active = missions.active;
  missions.active = null;
  game.addMessage('Mission failed: ' + active.def.name + ' — ' + reason);
}

export function updateMissions(game, dt) {
  const missions = game.missions;
  const player = game.player;

  if (missions.active) {
    const active = missions.active;
    const step = active.def.steps[active.stepIdx];
    if (active.timer !== null) {
      active.timer -= dt;
      if (active.timer <= 0) {
        failMission(game, 'out of time');
        return;
      }
    }
    let done = false;
    if (step.kind === 'goto' || step.kind === 'timedGoto' || step.kind === 'inCarGoto') {
      if (step.kind === 'inCarGoto' && !player.inCar) {
        // Must arrive in a car; on foot does not count.
      } else if (dist(player.x, player.y, step.x, step.y) < step.r) {
        done = true;
      }
    } else if (step.kind === 'inCar') {
      if (player.inCar && player.inCar.type === step.type) done = true;
    } else if (step.kind === 'inBoat') {
      if (player.inBoat && (!step.type || player.inBoat.type === step.type)) {
        missions.boatsRidden += 1;
        done = true;
      }
    } else if (step.kind === 'buoyRun') {
      for (const b of active.buoys) {
        if (!b.taken && dist(player.x, player.y, b.x, b.y) < 52) {
          b.taken = true;
          game.audio.chime();
          game.addMessage('Buoy ' + active.buoys.filter((x) => x.taken).length + ' of ' + active.buoys.length + '!');
        }
      }
      if (active.buoys.every((b) => b.taken)) done = true;
    } else if (step.kind === 'collect') {
      for (const p of active.points) {
        if (!p.taken && dist(player.x, player.y, p.x, p.y) < 42) {
          p.taken = true;
          active.collected.push(p);
          game.audio.chime();
        }
      }
      if (active.collected.length >= step.count) done = true;
    } else if (step.kind === 'wantedAtLeast') {
      if (game.police.wanted >= step.n) done = true;
    } else if (step.kind === 'wantedZero') {
      if (game.police.wanted === 0) done = true;
    } else if (step.kind === 'survive') {
      active.surviveLeft -= dt;
      if (active.surviveLeft <= 0) done = true;
    } else if (step.kind === 'heli') {
      if (game.heli && game.heli.state === 'gone') {
        missions.heliFlown += 1;
        done = true;
      }
    }
    if (done) {
      active.stepIdx += 1;
      if (active.stepIdx >= active.def.steps.length) {
        completeMission(game);
      } else {
        prepareStep(game, active);
        game.addMessage('Next: ' + stepText(active));
      }
    }
  }

  // Cash packages.
  for (const pkg of missions.packages) {
    if (!pkg.taken && dist(player.x, player.y, pkg.x, pkg.y) < 34) {
      pkg.taken = true;
      missions.packagesFound += 1;
      player.cash += TUNING.packageValue;
      missions.earned += TUNING.packageValue;
      game.addMessage('Hidden package found! +$' + TUNING.packageValue);
      game.audio.cash();
      game.save();
    }
  }

  // Supply crates.
  for (const crate of missions.crates) {
    if (crate.taken) {
      crate.respawn -= dt;
      if (crate.respawn <= 0) crate.taken = false;
      continue;
    }
    if (dist(player.x, player.y, crate.x, crate.y) < 36) {
      crate.taken = true;
      crate.respawn = 60;
      player.health = Math.min(TUNING.playerHealth, player.health + 40);
      player.armor = Math.min(TUNING.playerArmor, player.armor + 25);
      player.ammo += 24;
      game.addMessage('Supply crate: +health, +armour, +ammo');
      game.audio.chime();
    }
  }

  updateFare(game, dt);
}

// The extraction helicopter: it lands, waits for Rio, then climbs away.
export function updateHeli(game, dt) {
  const heli = game.heli;
  if (!heli) return;
  if (heli.state === 'landing') {
    heli.altitude -= dt * 0.5;
    heli.angle += dt * 0.4;
    if (heli.altitude <= 0) {
      heli.altitude = 0;
      heli.state = 'landed';
      game.addMessage('The helicopter is down — get aboard!');
    }
  } else if (heli.state === 'boarding') {
    heli.timer += dt;
    heli.altitude += dt * 0.35;
    if (heli.timer >= 3) {
      heli.state = 'gone';
      game.player.inHeli = null;
      game.addMessage('You are clear of Solara Bay!');
    }
  }
}

// Taxi fares: a pedestrian who wants a cab flags you down; drive them
// to their destination before the meter runs out.
function updateFare(game, dt) {
  const missions = game.missions;
  const player = game.player;
  if (!missions.fare) {
    missions.fareCooldown -= dt;
    if (missions.fareCooldown <= 0) {
      missions.fareCooldown = 18;
      tryStartFare(game);
    }
    return;
  }
  const fare = missions.fare;
  fare.timer -= dt;
  if (fare.timer <= 0) {
    game.addMessage('Fare cancelled — too slow.');
    if (fare.ped) fare.ped.wantsTaxi = true;
    missions.fare = null;
    return;
  }
  if (fare.phase === 'pickup') {
    if (dist(player.x, player.y, fare.ped.x, fare.ped.y) < 46) {
      fare.phase = 'dropoff';
      fare.ped.wantsTaxi = false;
      fare.ped.state = 'walk';
      game.addMessage('Passenger aboard — take them to the marker.');
    }
  } else if (dist(player.x, player.y, fare.destX, fare.destY) < 70) {
    const pay = Math.round(fare.reward * game.diff.payout);
    player.cash += pay;
    missions.earned += pay;
    missions.faresDone += 1;
    game.addMessage('Fare complete! +$' + pay);
    game.audio.cash();
    missions.fare = null;
    game.save();
  }
}

function tryStartFare(game) {
  // Find a waving pedestrian near the player.
  let best = null;
  let bestD = 420;
  for (const ped of game.peds) {
    if (!ped.wantsTaxi || ped.state === 'down') continue;
    const d = dist(ped.x, ped.y, game.player.x, game.player.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  if (!best) return;
  const dest = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 500);
  game.missions.fare = {
    ped: best,
    destX: dest.x,
    destY: dest.y,
    phase: 'pickup',
    timer: game.diff.taxiSeconds,
    reward: 45 + Math.round(bestD / 12),
  };
  game.addMessage('A fare is waving nearby — pick them up!');
}

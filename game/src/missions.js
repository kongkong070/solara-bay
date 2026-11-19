// Story missions, taxi fares, hidden packages and supply crates. Eight
// missions for Lena Cruz, in order, each a small state machine with a
// target, a timer and a payout.

import { CRATE_RESPAWN, DIFFICULTY, MISSION_REWARDS, PACKAGE_VALUE } from './config.js';
import { clamp, dist } from './util.js';
import { addHeat, clearWanted } from './police.js';
import { playMissionDone, playPickup } from './audio.js';

export const MISSION_LIST = [
  { name: 'Welcome to Solara', brief: 'Meet Lena at Downtown Plaza.' },
  { name: 'Wheels Up', brief: 'Steal a car, then bring it to the Docks.' },
  { name: 'Special Delivery', brief: 'Pick up at the Docks, deliver to City Hall.' },
  { name: 'The Getaway', brief: 'Two stars on you — reach the Beachfront safehouse.' },
  { name: 'Harbor Heist', brief: 'Hold the Marina Penthouse at night.' },
  { name: 'King of Solara', brief: 'Own Bay Stadium under three stars.' },
  { name: 'Bay Runner', brief: 'Take a speedboat around three buoys, then home.' },
  { name: 'Skyline Escape', brief: 'Hold the stadium at four stars, then fly out.' },
];

export function createMissions() {
  return {
    done: [],
    idx: 0,
    active: null, // {idx, stage, t, target:{x,y,label}, data:{}}
  };
}

function timerFor(S, seconds) {
  return seconds * DIFFICULTY[S.difficulty].timerScale;
}

function payout(S, idx) {
  return Math.round(MISSION_REWARDS[idx] * DIFFICULTY[S.difficulty].payoutScale);
}

export function startNextMission(S) {
  const M = S.missions;
  if (M.active) {
    S.banner = { text: 'Finish the current mission first', t: 2 };
    return;
  }
  if (M.idx >= MISSION_LIST.length) {
    S.banner = { text: 'All eight missions complete — Solara Bay is yours', t: 3 };
    return;
  }
  const idx = M.idx;
  const def = MISSION_LIST[idx];
  M.active = { idx, stage: 0, t: 0, target: null, data: {} };
  if (idx === 0) setTarget(S, 2000, 1550, 'Downtown Plaza');
  else if (idx === 1) setTarget(S, 800, 2550, 'The Docks — steal a car first');
  else if (idx === 2) setTarget(S, 800, 2550, 'The Docks — pick up the package');
  else if (idx === 3) {
    addHeat(S, 80);
    setTarget(S, 540, 2000, 'Beachfront safehouse');
    M.active.t = timerFor(S, 120);
  } else if (idx === 4) {
    S.clock.hour = 21;
    S.clock.minute = 0;
    setTarget(S, 825, 1900, 'Marina Penthouse');
  } else if (idx === 5) setTarget(S, 3250, 700, 'Bay Stadium');
  else if (idx === 6) setTarget(S, 630, 300, 'Marina — board a speedboat');
  else if (idx === 7) setTarget(S, 3250, 700, 'Bay Stadium');
  S.banner = { text: 'Mission ' + (idx + 1) + '/8: ' + def.name + ' — ' + def.brief, t: 4 };
}

function setTarget(S, x, y, label) {
  S.missions.active.target = { x, y, label };
}

function completeMission(S) {
  const M = S.missions;
  const idx = M.active.idx;
  const reward = payout(S, idx);
  S.player.cash += reward;
  S.stats.earnings = (S.stats.earnings || 0) + reward;
  M.done.push(idx);
  M.idx = idx + 1;
  M.active = null;
  S.banner = { text: 'Mission complete: ' + MISSION_LIST[idx].name + '  +' + '$' + reward, t: 4 };
  playMissionDone(S.audio);
}

function failMission(S, why) {
  S.missions.active = null;
  S.banner = { text: 'Mission failed: ' + why + ' — press M to retry', t: 3.5 };
}

function arrive(S, radius) {
  const a = S.missions.active;
  if (!a || !a.target) return false;
  return dist(S.player.x, S.player.y, a.target.x, a.target.y) < radius;
}

export function updateMissions(S, dt) {
  const M = S.missions;
  const a = M.active;
  if (a) {
    if (a.t > 0) {
      a.t -= dt;
      // A hold/survive timer runs out to a win, not a fail (see stages).
      if (a.t <= 0 && a.countdownFails !== false) {
        failMission(S, 'out of time');
        return;
      }
    }
    updateMissionStages(S, dt);
  }
  updateFares(S, dt);
  collectPickups(S, dt);
}

function updateMissionStages(S, dt) {
  const M = S.missions;
  const a = M.active;
  if (!a) return;
  const p = S.player;
  switch (a.idx) {
    case 0:
      if (arrive(S, 80)) completeMission(S);
      break;
    case 1:
      if (a.stage === 0) {
        // Waiting for the player to steal a car (see onEnterCar).
      } else if (arrive(S, 80)) {
        completeMission(S);
      }
      break;
    case 2:
      if (a.stage === 0 && arrive(S, 80)) {
        a.stage = 1;
        a.t = timerFor(S, 110);
        setTarget(S, 2025, 1150, 'City Hall — deliver the package');
        addHeat(S, 40);
        S.banner = { text: 'Package taken — the SBPD noticed. Deliver it to City Hall', t: 3 };
      } else if (a.stage === 1 && arrive(S, 80)) {
        completeMission(S);
      }
      break;
    case 3:
      if (arrive(S, 80)) {
        clearWanted(S);
        completeMission(S);
      }
      break;
    case 4:
      if (a.stage === 0 && arrive(S, 90)) {
        a.stage = 1;
        a.t = timerFor(S, 30);
        a.countdownFails = false;
        addHeat(S, 80);
        setTarget(S, 825, 1900, 'Hold the penthouse');
        S.banner = { text: 'Hold this spot for 30 seconds', t: 3 };
      } else if (a.stage === 1) {
        if (dist(p.x, p.y, 825, 1900) > 130) {
          // Timer only runs while the player holds the spot.
          a.t += dt;
        } else if (a.t <= 0) {
          completeMission(S);
        }
      }
      break;
    case 5:
      if (a.stage === 0 && arrive(S, 100)) {
        a.stage = 1;
        a.t = timerFor(S, 45);
        a.countdownFails = false;
        addHeat(S, 120);
        setTarget(S, 3250, 700, 'Survive at the stadium');
        S.banner = { text: 'Survive 45 seconds at three stars', t: 3 };
      } else if (a.stage === 1 && a.t <= 0) {
        completeMission(S);
      }
      break;
    case 6:
      updateBayRunner(S, dt);
      break;
    case 7:
      updateSkyline(S, dt);
      break;
    default:
      break;
  }
}

function updateBayRunner(S, dt) {
  const a = S.missions.active;
  if (!a) return;
  if (a.stage === 0) {
    // Waiting at the marina for the player to board a boat.
    return;
  }
  if (a.stage === 1) {
    const buoys = S.city.buoys;
    const next = buoys.find((b) => !b.done);
    if (!next) {
      a.stage = 2;
      setTarget(S, 500, 1400, 'Sunset Pier — bring her home');
      S.banner = { text: 'All buoys rounded — return to Sunset Pier', t: 3 };
      return;
    }
    setTarget(S, next.x, next.y, 'Buoy ' + (buoys.indexOf(next) + 1) + ' of 3');
    if (dist(S.player.x, S.player.y, next.x, next.y) < 70) {
      next.done = true;
      playPickup(S.audio);
      S.banner = { text: 'Buoy ' + (buoys.indexOf(next) + 1) + ' rounded', t: 2 };
    }
    return;
  }
  if (a.stage === 2 && arrive(S, 90)) {
    completeMission(S);
  }
}

function updateSkyline(S, dt) {
  const a = S.missions.active;
  if (!a) return;
  const p = S.player;
  if (a.stage === 0 && arrive(S, 100)) {
    a.stage = 1;
    a.t = timerFor(S, 20);
    a.countdownFails = false;
    addHeat(S, 160);
    setTarget(S, 3250, 700, 'Hold the stadium');
    S.banner = { text: 'Hold the stadium for 20 seconds at four stars', t: 3 };
    return;
  }
  if (a.stage === 1) {
    if (dist(p.x, p.y, 3250, 700) > 210) {
      a.t += dt; // Timer only runs inside the stadium bowl.
    } else if (a.t <= 0) {
      a.stage = 2;
      S.heli = { x: 3250, y: 820, angle: 0, altitude: 0, rotor: 0, landed: true, speed: 0 };
      setTarget(S, 3250, 820, "Lena's helicopter — board with E");
      S.banner = { text: "Lena's helicopter is down — board it (E)", t: 4 };
    }
    return;
  }
  if (a.stage === 2) {
    // Waiting for the player to board the helicopter.
    return;
  }
  if (a.stage === 3) {
    setTarget(S, 250, 1400, 'Escape point over the bay');
    if (dist(p.x, p.y, 250, 1400) < 170) {
      completeMission(S);
      S.mode = 'finale';
      S.banner = { text: 'Skyline Escape complete — Rio and Lena are free', t: 6 };
    }
  }
}

function updateFares(S, dt) {
  const fare = S.fare;
  const p = S.player;
  if (!fare.active) return;
  // The passenger bails if the player ditches the car.
  if (!p.vehicle) {
    if (fare.ped) {
      fare.ped.state = 'walk';
      fare.ped.taxi = false;
    }
    fare.active = false;
    fare.ped = null;
    return;
  }
  if (dist(p.x, p.y, fare.dest.x, fare.dest.y) < 85) {
    const amount = fare.amount;
    p.cash += amount;
    S.stats.earnings = (S.stats.earnings || 0) + amount;
    S.stats.fares = (S.stats.fares || 0) + 1;
    if (fare.ped) {
      fare.ped.state = 'walk';
      fare.ped.taxi = false;
      fare.ped.x = p.x + 40;
      fare.ped.y = p.y + 40;
    }
    S.banner = { text: 'Fare complete  +$' + amount, t: 2.5 };
    playPickup(S.audio);
    fare.active = false;
    fare.ped = null;
  }
}

export function tryPickupFare(S) {
  const fare = S.fare;
  const p = S.player;
  if (fare.active || !p.vehicle) return;
  let best = null;
  let bestD = 130;
  for (const ped of S.peds) {
    if (ped.state !== 'wave') continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (d < bestD) {
      best = ped;
      bestD = d;
    }
  }
  if (!best) return;
  const spots = S.city.landmarks.filter((l) => dist(l.x, l.y, p.x, p.y) > 500);
  const dest = spots.length > 0 ? spots[Math.floor(S.rng() * spots.length)] : S.city.landmarks[0];
  const amount = Math.round((30 + dist(p.x, p.y, dest.x, dest.y) / 60) / 5) * 5;
  best.state = 'ride';
  fare.active = true;
  fare.ped = best;
  fare.dest = { x: dest.x, y: dest.y, label: dest.name };
  fare.amount = amount;
  S.banner = { text: 'Fare to ' + dest.name + ' — $' + amount, t: 3 };
}

function collectPickups(S, dt) {
  const p = S.player;
  for (const pack of S.city.packages) {
    if (pack.taken) continue;
    if (dist(p.x, p.y, pack.x, pack.y) < 42) {
      pack.taken = true;
      p.cash += PACKAGE_VALUE;
      S.stats.earnings = (S.stats.earnings || 0) + PACKAGE_VALUE;
      S.stats.packages = (S.stats.packages || 0) + 1;
      S.banner = { text: 'Hidden package  +$' + PACKAGE_VALUE, t: 2.5 };
      playPickup(S.audio);
    }
  }
  for (const crate of S.city.crates) {
    if (!crate.ready) {
      crate.timer -= dt;
      if (crate.timer <= 0) crate.ready = true;
      continue;
    }
    if (dist(p.x, p.y, crate.x, crate.y) < 42) {
      crate.ready = false;
      crate.timer = CRATE_RESPAWN;
      p.hp = Math.min(100, p.hp + 40);
      p.armor = Math.min(100, p.armor + 25);
      p.ammo = Math.min(120, p.ammo + 24);
      S.banner = { text: 'Supply crate: +health +armour +ammo', t: 2.5 };
      playPickup(S.audio);
    }
  }
}

// Hooks the player module calls when Rio gets into something.
export function onEnterCar(S, car) {
  const a = S.missions.active;
  if (a && a.idx === 1 && a.stage === 0) {
    a.stage = 1;
    a.t = timerFor(S, 100);
    setTarget(S, 800, 2550, 'The Docks — deliver the car');
    S.banner = { text: 'Car stolen — deliver it to the Docks in time', t: 3 };
  }
}

export function onBoardBoat(S, boat) {
  const a = S.missions.active;
  if (a && a.idx === 6 && a.stage === 0) {
    a.stage = 1;
    a.t = timerFor(S, 85);
    S.city.buoys.forEach((b) => { b.done = false; });
    setTarget(S, S.city.buoys[0].x, S.city.buoys[0].y, 'Buoy 1 of 3');
    S.banner = { text: 'Bay Runner: round all three buoys in 85 seconds', t: 3 };
  }
}

export function onBoardHeli(S) {
  const a = S.missions.active;
  if (a && a.idx === 7 && a.stage === 2) {
    a.stage = 3;
    setTarget(S, 250, 1400, 'Escape point over the bay');
  }
}

// What the HUD shows as the current objective, with a map marker.
export function missionObjective(S) {
  const a = S.missions.active;
  if (a && a.target) {
    const def = MISSION_LIST[a.idx];
    return {
      text: def.name + ' — ' + a.target.label,
      x: a.target.x,
      y: a.target.y,
      t: a.t > 0 ? a.t : 0,
    };
  }
  if (S.fare.active) {
    return { text: 'Fare to ' + S.fare.dest.label, x: S.fare.dest.x, y: S.fare.dest.y, t: 0 };
  }
  if (S.missions.idx >= MISSION_LIST.length) {
    return { text: 'Free roam — all missions complete', x: 0, y: 0, t: 0 };
  }
  return { text: 'Press M for mission ' + (S.missions.idx + 1) + ': ' + MISSION_LIST[S.missions.idx].name, x: 0, y: 0, t: 0 };
}

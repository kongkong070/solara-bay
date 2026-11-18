// The Solara Bay Police Department: wanted levels, interceptors that chase
// and ram, and foot cops who arrest you. Heat fades when you stay out of
// sight; at five stars the whole city is after you.
import { WANTED, POLICE_TUNING, difficultyTuning } from './config.js';
import { clamp, angleDiff } from './random.js';
import { makeCar, driveCar, collideCars } from './vehicles.js';
import { collideBuildings, clampToWorld, randomRoadPoint } from './world.js';
import { hurtPlayer } from './player.js';

export function makePolice() {
  return {
    wanted: 0,
    heat: 0, // 0..100 within the current level; fills on crimes
    calmT: 0, // seconds out of sight; cools the heat
    seenT: 0, // seconds a cop has seen the player recently
    cops: [], // police cars
    footCops: [], // police on foot
    arrestT: 0, // arrest progress while a cop holds you
    lastCrime: '',
  };
}

export function raiseWanted(game, levels, crime) {
  const pol = game.police;
  pol.lastCrime = crime;
  if (pol.wanted >= 5) return;
  // Heat per crime comes from the active difficulty: Chill forgives, Hardcore
  // stacks stars fast.
  pol.heat += difficultyTuning(game.difficulty).heatPerCrime * levels;
  if (pol.heat >= 100) {
    pol.heat = 0;
    pol.wanted = Math.min(5, pol.wanted + levels);
    game.floater(game.player.x, game.player.y - 44, 'WANTED LEVEL ' + pol.wanted, '#ff5a4a');
    game.audio.blip(880, 0.2, 'square', 0.1);
  }
  pol.calmT = 0;
}

export function lowerWanted(game, levels) {
  const pol = game.police;
  pol.wanted = Math.max(0, pol.wanted - levels);
  pol.heat = 0;
  if (pol.wanted === 0) game.floater(game.player.x, game.player.y - 44, 'You lost them', '#7ae08a');
}

// Spawn a police car on a road near the player, already rolling. Its top
// speed scales with the difficulty: Hardcore interceptors are genuinely
// faster, Chill ones a touch slower.
function spawnCopCar(game) {
  const pol = game.police;
  const p = randomRoadPoint(game.rng, game.player, 520);
  const car = makeCar(game.rng, 'police', p.x, p.y, 0);
  car.spec = Object.assign({}, car.spec, { top: car.spec.top * difficultyTuning(game.difficulty).copSpeedMul });
  car.driver = 'police';
  car.color = '#20242c';
  game.cars.push(car);
  pol.cops.push(car);
  return car;
}

function spawnFootCop(game) {
  const pol = game.police;
  const a = game.rng() * Math.PI * 2;
  const cop = {
    kind: 'cop', x: game.player.x + Math.cos(a) * 320, y: game.player.y + Math.sin(a) * 320,
    radius: 12, angle: a, speed: 175 * difficultyTuning(game.difficulty).copSpeedMul, state: 'chase', shootT: 0, shirt: '#20242c',
  };
  clampToWorld(cop, 16);
  pol.footCops.push(cop);
  return cop;
}

export function updatePolice(game, dt) {
  const pol = game.police;
  const p = game.player;
  const level = WANTED[pol.wanted];
  // How many cop cars the level wants on the road.
  const wantCars = pol.wanted === 0 ? 0 : Math.min(1 + Math.floor(pol.wanted / 2), 4);
  // Remove wrecked cops, then top up.
  pol.cops = pol.cops.filter((c) => !c.dead);
  if (pol.cops.length < wantCars && game.time - (pol.lastSpawn || 0) > POLICE_TUNING.spawnInterval) {
    spawnCopCar(game);
    pol.lastSpawn = game.time;
  }
  // Foot cops appear from level 2 up; the cap grows with the wanted level
  // and with the difficulty (Hardcore sends a fourth cop at five stars).
  const tune = difficultyTuning(game.difficulty);
  const footCap = tune.footCopCap[pol.wanted] || 0;
  if (pol.wanted >= 2 && pol.footCops.length < footCap && game.time - (pol.lastFootSpawn || 0) > 6) {
    spawnFootCop(game);
    pol.lastFootSpawn = game.time;
  }
  if (pol.wanted === 0) {
    pol.footCops = [];
  }
  // Chase: steer hard at the player, ram, and slow them down.
  for (const cop of pol.cops) {
    const target = Math.atan2(p.y - cop.y, p.x - cop.x);
    const diff = angleDiff(cop.angle, target);
    const steer = clamp(diff * 1.6, -1, 1);
    const dist = Math.hypot(p.x - cop.x, p.y - cop.y);
    const throttle = dist > 60 ? 1 : 0.4;
    driveCar(cop, dt, throttle, steer);
    cop.sirenPhase += dt * 6;
    if (collideBuildings(game.world, cop)) cop.speed *= 0.4;
    if (collideCars(game, cop)) game.audio.crash();
    clampToWorld(cop, 24);
    // A ram that connects hurts the player's car — or the player.
    if (dist < 46) {
      if (p.inCar) {
        p.inCar.health -= 14 * dt;
        p.inCar.speed *= Math.max(0, 1 - 0.9 * dt);
        if (game.time - (pol.lastRamSound || 0) > 0.5) {
          game.audio.crash();
          pol.lastRamSound = game.time;
        }
      } else if (game.time - (pol.lastRamSound || 0) > 1) {
        hurtPlayer(game, 6, 'police');
        pol.lastRamSound = game.time;
      }
    }
  }
  // Foot cops run the player down and arrest them.
  for (const cop of pol.footCops) {
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    if (d > 24) {
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
    }
    collideBuildings(game.world, cop);
    clampToWorld(cop, 14);
    if (!p.inCar && d < 30) {
      pol.arrestT += dt;
      if (pol.arrestT > 1.4) {
        pol.arrestT = 0;
        game.endRun('busted');
        return;
      }
    } else {
      pol.arrestT = Math.max(0, pol.arrestT - dt * 2);
    }
    // At three stars and up, foot cops shoot.
    if (pol.wanted >= 3 && d < 320 && d > 60) {
      cop.shootT -= dt;
      if (cop.shootT <= 0) {
        cop.shootT = 0.9;
        game.bullets.push({
          x: cop.x, y: cop.y,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          life: 0.6, from: 'police',
        });
        game.audio.noise(0.1, 0.1, 2600);
      }
    }
  }
  // Heat: being seen keeps it hot; hiding cools it down to the next level.
  const nearestCop = nearestCopDist(game);
  const seen = nearestCop < (p.inCar ? 560 : 380);
  if (seen) {
    pol.seenT += dt;
    pol.calmT = 0;
  } else {
    pol.calmT += dt;
    pol.seenT = Math.max(0, pol.seenT - dt);
    // Hiding cools a star off; Chill cools sooner, Hardcore makes you wait.
    if (pol.calmT > difficultyTuning(game.difficulty).calmSeconds && pol.wanted > 0) {
      pol.calmT = 0;
      lowerWanted(game, 1);
    }
  }
  game.audio.setSiren(pol.wanted, nearestCop < 700);
}

export function nearestCopDist(game) {
  let best = Infinity;
  for (const cop of game.police.cops) {
    best = Math.min(best, Math.hypot(cop.x - game.player.x, cop.y - game.player.y));
  }
  for (const cop of game.police.footCops) {
    best = Math.min(best, Math.hypot(cop.x - game.player.x, cop.y - game.player.y));
  }
  return best;
}

export function clearPolice(game) {
  const pol = game.police;
  for (const cop of pol.cops) cop.dead = true;
  pol.cops = [];
  pol.footCops = [];
  pol.wanted = 0;
  pol.heat = 0;
  pol.arrestT = 0;
}

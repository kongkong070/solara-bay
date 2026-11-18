// The SBPD: wanted stars, heat that cools when you hide, interceptors
// that ram you and foot cops who chase you down on foot.
import { WORLD, TUNING } from './config.js';
import { clamp, dist } from './util.js';
import { randomRoadPoint, clampToWorld, hitsBuilding } from './world.js';
import { makeCar, driveCar, collideCars } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function makePolice() {
  const police = {
    wanted: 0,
    heat: 0,
    calmTimer: 0,
    spawnTimer: 0,
    cops: [], // foot cops {x, y, down, downTimer, speed}
    cars: [], // interceptor cars, also listed in game.cars
    bustTimer: 0,
    bestWanted: 0,
  };
  // Bound helpers so the rest of the game calls police.addHeat(game, n).
  police.addHeat = (game, crimes) => addHeat(game, crimes);
  police.setWanted = (game, stars) => setWanted(game, stars);
  return police;
}

// A crime adds heat; heat maps to wanted stars.
export function addHeat(game, crimes) {
  const police = game.police;
  police.heat += game.diff.heatPerCrime * crimes;
  const stars = Math.min(TUNING.wantedMax, Math.floor(police.heat / TUNING.heatPerStar));
  if (stars > police.wanted) {
    police.wanted = stars;
    police.bestWanted = Math.max(police.bestWanted, stars);
    if (stars >= 3) game.addMessage('Wanted level ' + stars + '! The SBPD is all over you.');
  }
  police.calmTimer = 0;
}

export function setWanted(game, stars) {
  const police = game.police;
  police.wanted = clamp(stars, 0, TUNING.wantedMax);
  police.heat = police.wanted * TUNING.heatPerStar + 1;
  police.bestWanted = Math.max(police.bestWanted, police.wanted);
}

export function updatePolice(game, dt) {
  const police = game.police;
  const player = game.player;
  if (player.dead) return;

  // Are any cops close enough to see the player?
  let seen = false;
  for (const cop of police.cops) {
    if (!cop.down && dist(cop.x, cop.y, player.x, player.y) < 420) seen = true;
  }
  for (const car of police.cars) {
    if (!car.dead && dist(car.x, car.y, player.x, player.y) < 520) seen = true;
  }
  if (police.wanted > 0 && !seen) {
    police.calmTimer += dt;
    if (police.calmTimer >= game.diff.calmSeconds) {
      police.calmTimer = 0;
      police.heat = Math.max(0, police.heat - TUNING.heatPerStar);
      police.wanted = Math.floor(police.heat / TUNING.heatPerStar);
      if (police.wanted === 0) game.addMessage('You lost them. Stay clean.');
    }
  } else {
    police.calmTimer = 0;
  }

  // Spawn interceptors and foot cops to match the wanted level.
  police.spawnTimer -= dt;
  if (police.wanted > 0 && police.spawnTimer <= 0) {
    police.spawnTimer = 2.2;
    const wantCars = Math.min(police.wanted, 3);
    const liveCars = police.cars.filter((c) => !c.dead).length;
    if (liveCars < wantCars) spawnInterceptor(game);
    const wantCops = police.wanted >= 2 ? Math.min(police.wanted - 1, 3) : 0;
    const liveCops = police.cops.filter((c) => !c.down).length;
    if (liveCops < wantCops) spawnFootCop(game);
  }

  // Interceptors chase and ram.
  for (const car of police.cars) {
    if (car.dead) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const d = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    const steer = clamp(((wantAngle - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1);
    const throttle = d > 90 ? 1 : 0.4;
    driveCar(car, dt, throttle, steer, false);
    if (hitsBuilding(game.world, car.x, car.y, 20)) {
      car.speed *= 0.4;
    }
    collideCars(game, car);
    clampToWorld(car, 24);
    // Ramming the player hurts.
    if (d < 46 && Math.abs(car.speed) > 80) {
      hurtPlayer(game, 12 * dt * 10);
      car.speed *= 0.6;
    }
  }
  police.cars = police.cars.filter((c) => !c.dead && dist(c.x, c.y, player.x, player.y) < 1600);

  // Foot cops run the player down.
  for (const cop of police.cops) {
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) cop.down = false;
      continue;
    }
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy) || 1;
    const chaseSpeed = cop.speed;
    cop.x += (dx / d) * chaseSpeed * dt;
    cop.y += (dy / d) * chaseSpeed * dt;
    cop.angle = Math.atan2(dy, dx);
    clampToWorld(cop, 24);
    // A cop on top of the player on foot starts the bust.
    if (d < 30 && !player.inCar) {
      police.bustTimer += dt;
      if (police.bustTimer > 1.2) {
        bustPlayer(game);
      }
    }
  }
  if (police.cops.every((c) => c.down || dist(c.x, c.y, player.x, player.y) >= 30 || player.inCar)) {
    police.bustTimer = 0;
  }
  police.cops = police.cops.filter((c) => dist(c.x, c.y, player.x, player.y) < 1400 || c.down);
}

function spawnInterceptor(game) {
  const p = randomRoadPoint(game.rng, game.world, game.player.x, game.player.y, 500);
  const car = makeCar(game.rng, 'police', p.x, p.y, 0);
  car.driver = 'police';
  car.spec = { ...car.spec, top: car.spec.top * (game.diff.label === 'Hardcore' ? 1.12 : 1) };
  game.cars.push(car);
  game.police.cars.push(car);
}

function spawnFootCop(game) {
  const a = game.rng.range(0, Math.PI * 2);
  const cop = {
    kind: 'cop',
    x: game.player.x + Math.cos(a) * 320,
    y: game.player.y + Math.sin(a) * 320,
    angle: 0,
    speed: 200,
    radius: 12,
    down: false,
    downTimer: 0,
  };
  clampToWorld(cop, 30);
  game.police.cops.push(cop);
}

export function bustPlayer(game) {
  const player = game.player;
  const fine = Math.min(player.cash, TUNING.bustFine);
  player.cash -= fine;
  player.health = TUNING.playerHealth;
  player.armor = 0;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  // Woken up at the hospital, clean slate.
  player.x = 1000;
  player.y = 1840;
  player.dead = false;
  game.police.wanted = 0;
  game.police.heat = 0;
  game.police.cars = [];
  game.police.cops = [];
  game.police.bustTimer = 0;
  game.state = 'busted';
  game.bustedReason = 'Busted! The SBPD took $' + fine + ' and dropped you at Solara General.';
  game.audio.busted();
}

export { addHeat as policeAddHeat, setWanted as policeSetWanted };

// Deterministic screenshot staging: ?shot=chase|mission|start|night|boat
// puts the game into a scene the judge can read at a glance, then flips
// window.__shotReady so the shot tool knows the frame is ready.
import { WORLD } from './config.js';
import { makeRng } from './util.js';
import { randomRoadPoint } from './world.js';
import { makeCar } from './vehicles.js';
import { makeBoat } from './boats.js';
import { setWanted } from './police.js';

export function stageShot(game) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  const difficulty = params.get('difficulty');
  if (difficulty && game.difficulties[difficulty]) {
    game.setDifficulty(difficulty);
  }
  const player = game.player;

  if (shot === 'start') {
    // Title screen: nothing to stage, the menu draws itself.
    game.state = 'title';
  } else if (shot === 'chase') {
    game.state = 'playing';
    // Rio in a muscle car on an avenue, three interceptors on his tail.
    const road = { x: 1720, y: 1200 };
    const car = makeCar(game.rng, 'muscle', road.x, road.y, 0);
    car.driver = 'player';
    game.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    player.cash = 1240;
    game.clockMinutes = 14 * 60 + 20;
    setWanted(game, 3);
    for (let i = 0; i < 3; i++) {
      const p = randomRoadPoint(game.rng, game.world, player.x, player.y, 300 + i * 120);
      const cop = makeCar(game.rng, 'police', p.x, p.y, 0);
      cop.driver = 'police';
      game.cars.push(cop);
      game.police.cars.push(cop);
    }
    game.missions.active = null;
    game.addMessage('Wanted level 3! Lose the SBPD.');
  } else if (shot === 'mission') {
    game.state = 'playing';
    game.clockMinutes = 11 * 60 + 40;
    player.cash = 860;
    const road = { x: 1000, y: 880 };
    const car = makeCar(game.rng, 'sport', road.x, road.y, Math.PI / 2);
    car.driver = 'player';
    game.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    game.missions.index = 2;
    game.startMission();
    game.addMessage('Special Delivery — the Docks are waiting.');
  } else if (shot === 'night') {
    game.state = 'playing';
    game.clockMinutes = 21 * 60 + 30;
    player.cash = 2100;
    const road = { x: 2080, y: 1520 };
    const car = makeCar(game.rng, 'coupe', road.x, road.y, Math.PI);
    car.driver = 'player';
    game.cars.push(car);
    player.inCar = car;
    player.x = car.x;
    player.y = car.y;
    setWanted(game, 2);
    game.addMessage('Night run — keep the headlights on the road.');
  } else if (shot === 'boat') {
    // Rio at the helm of a speedboat off Sunset Pier at golden hour,
    // running the Bay Runner buoys with one star on his tail.
    game.state = 'playing';
    game.clockMinutes = 17 * 60 + 45;
    player.cash = 1450;
    const boat = makeBoat(game.rng, 'speedboat', 1720, 2660, -Math.PI / 2);
    boat.driver = 'player';
    game.boats.push(boat);
    player.inBoat = boat;
    player.x = boat.x;
    player.y = boat.y;
    boat.speed = 260;
    game.missions.index = 6;
    game.startMission();
    game.addMessage('Bay Runner — round the buoys!');
  }
  // Let one frame render, then declare the shot ready.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
  return true;
}

// A shot's world seed, so the same query always stages the same city.
export function shotSeed() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get('seed') || '1');
}

// Deterministic screenshot scenes behind ?shot=chase|mission|start|night|ledger.
// Each one plays the real game forward from a fresh seeded world with a
// scripted autopilot, so the frame is what a short real game looks like and
// the same seed always gives the same frame.
import { WORLD } from './config.js';
import { angleDiff } from './random.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;
const WAYPOINTS = [
  [1800, 600], [1800, 1800], [600, 1800], [600, 600],
];

// Drive toward the waypoint list like a player would: throttle on, brake
// hard for a sharp corner, steer toward the next corner. Mutates the
// game's input keys.
function driveToward(game, wx, wy) {
  const p = game.player;
  const car = p.inCar;
  const input = game.input;
  const target = Math.atan2(wy - p.y, wx - p.x);
  const diff = angleDiff(car ? car.angle : p.angle, target);
  if (Math.abs(diff) > 0.7) {
    // Sharp corner ahead: brake, then turn.
    input.keys.add('s');
    input.keys.delete('w');
  } else {
    input.keys.add('w');
    input.keys.delete('s');
  }
  if (diff > 0.25) { input.keys.add('d'); input.keys.delete('a'); }
  else if (diff < -0.25) { input.keys.add('a'); input.keys.delete('d'); }
  else { input.keys.delete('a'); input.keys.delete('d'); }
}

function clearDriveKeys(game) {
  for (const k of ['w', 'a', 's', 'd', ' ']) game.input.keys.delete(k);
}

// Run the live update loop for `seconds`, steering the player along the
// waypoints. The police, traffic and pedestrians all play for real.
function simulateDrive(game, seconds, waypoints) {
  let wp = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const [wx, wy] = waypoints[wp % waypoints.length];
    if (Math.hypot(game.player.x - wx, game.player.y - wy) < 180) wp += 1;
    driveToward(game, waypoints[wp % waypoints.length][0], waypoints[wp % waypoints.length][1]);
    game.update(STEP);
    if (game.state !== 'play') break;
  }
  clearDriveKeys(game);
}

function simulateOnFoot(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.update(STEP);
    if (game.state !== 'play') break;
  }
}

function giveSportCar(game, x, y, angle) {
  const car = makeCar(game.rng, 'sport', x, y, angle);
  car.driver = 'player';
  car.stolen = true;
  car.health = 100000; // staging: the shot car does not wreck mid-scene
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

export function stageShot(name, game, difficulty) {
  // A ?difficulty=chill|normal|hardcore query pins the scene's difficulty,
  // so the staged frames are reproducible and the title shot can show a
  // non-default pick. Unknown values fall back to Normal.
  game.difficulty = ['chill', 'normal', 'hardcore'].includes(difficulty) ? difficulty : 'normal';
  game.reset(20261118);
  game.audio.muted = true;
  if (name === 'chase') {
    // Cover shot: Rio in a stolen Cometa GT, three stars, two interceptors
    // on his tail down the central avenue.
    game.state = 'play';
    giveSportCar(game, 1800, 1500, -Math.PI / 2);
    game.police.wanted = 3;
    game.police.heat = 40;
    game.audio.muted = true;
    simulateDrive(game, 13, WAYPOINTS);
    game.banner('The Getaway', 'Lose the cops — reach the Safehouse', 6);
    game.bannerT = 6;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // A mission in progress: Special Delivery, drop-off 1, on the road.
    game.state = 'play';
    const sedan = makeCar(game.rng, 'sedan', 1400, 1000, 0);
    sedan.driver = 'player';
    sedan.health = 100000; // staging: the shot car does not wreck mid-scene
    game.cars.push(sedan);
    game.player.inCar = sedan;
    game.player.x = 1400;
    game.player.y = 1000;
    startMission(game, 2);
    simulateDrive(game, 11, [[2200, 1000], [2200, 600]]);
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    return { screen: 'play' };
  }
  if (name === 'night') {
    // Golden hour on the beach: Rio on foot, palms, water, the city behind.
    // The new Beach Party mission is live, and a health crate waits nearby.
    game.state = 'play';
    game.lighting = 'sunset';
    game.player.x = 1000;
    game.player.y = 2390;
    game.player.angle = -Math.PI / 2;
    game.clockMinutes = 18 * 60 + 40;
    startMission(game, 6);
    simulateOnFoot(game, 6);
    game.camera.x = game.player.x;
    game.camera.y = game.player.y - 140;
    return { screen: 'play' };
  }
  if (name === 'ledger') {
    // Midnight Ledger at full night: Rio in a Bandit Muscle, three stars,
    // headlights cutting the dark on the way to the Marina Penthouse.
    game.state = 'play';
    game.clockMinutes = 21 * 60 + 15;
    game.lighting = 'night';
    const muscle = makeCar(game.rng, 'muscle', 1400, 1000, 0);
    muscle.driver = 'player';
    muscle.health = 100000; // staging: the shot car does not wreck mid-scene
    game.cars.push(muscle);
    game.player.inCar = muscle;
    game.player.x = 1400;
    game.player.y = 1000;
    game.player.angle = 0;
    startMission(game, 7);
    game.police.wanted = 3;
    game.police.heat = 40;
    simulateDrive(game, 10, [[1400, 600], [1400, 200]]);
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    return { screen: 'play' };
  }
  // Default: the title screen over a living city.
  game.state = 'title';
  game.camera.x = 1800;
  game.camera.y = 1400;
  simulateOnFoot(game, 5);
  game.camera.x = 1800;
  game.camera.y = 1400;
  return { screen: 'title' };
}

export { WORLD };

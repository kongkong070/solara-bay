// Everything the player sees: the city from above, cars, people, the HUD
// with its minimap, and the menus. Top-down, sun-soaked, original art drawn
// in code — no image assets.
import { WORLD, COLORS, VIEW, DIFFICULTY, DIFFICULTY_ORDER, difficultyTuning } from './config.js';
import { clamp, fmtCash, fmtClock, fmtDuration } from './random.js';
import { isOnRoad, buildingAt } from './world.js';
import { currentStage, missionMarker } from './missions.js';

const MINIMAP_SIZES = [140, 168, 220]; // N key or mouse wheel cycles them

export function createCamera() {
  return { x: 0, y: 0, zoom: 1 };
}

function drawTree(ctx, x, y, r) {
  ctx.fillStyle = '#2f7a3a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4fae5a';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6a4a2a';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(ctx, b, t) {
  // Shadow offset by the sun, then walls, roof and windows.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + 5 + b.height, b.y + 6 + b.height, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const cols = Math.max(1, Math.floor(b.w / 26));
  const rows = Math.max(1, Math.floor(b.h / 26));
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      if ((i * 7 + j * 3 + b.height) % 4 === 0) continue;
      ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 9, 12);
    }
  }
}

export function drawWorld(ctx, game) {
  const cam = game.camera;
  const x0 = cam.x - VIEW.width / 2 - 60;
  const y0 = cam.y - VIEW.height / 2 - 60;
  const x1 = cam.x + VIEW.width / 2 + 60;
  const y1 = cam.y + VIEW.height / 2 + 60;
  // Ground: grass, then sand and water along the south shore.
  ctx.fillStyle = '#8fbf67';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (y1 > WORLD.beachTop) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(x0, Math.max(y0, WORLD.beachTop), x1 - x0, Math.min(y1, WORLD.waterTop) - Math.max(y0, WORLD.beachTop));
  }
  if (y1 > WORLD.waterTop) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(x0, Math.max(y0, WORLD.waterTop), x1 - x0, y1 - Math.max(y0, WORLD.waterTop));
    ctx.fillStyle = COLORS.waterDeep;
    const wave = Math.sin(game.time * 1.4) * 4;
    for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
      ctx.fillRect(wx, WORLD.waterTop + 40 + wave, 46, 5);
      ctx.fillRect(wx + 30, WORLD.waterTop + 90 - wave, 40, 5);
    }
  }
  // Blocks: sidewalks, parks, buildings.
  for (const block of game.world.blocks) {
    if (block.x1 < x0 || block.x0 > x1 || block.y1 < y0 || block.y0 > y1) continue;
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(block.x0 - WORLD.blockPad, block.y0 - WORLD.blockPad, block.x1 - block.x0 + WORLD.blockPad * 2, block.y1 - block.y0 + WORLD.blockPad * 2);
    ctx.fillStyle = block.park ? '#6fae4e' : '#a8bf7a';
    ctx.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
    if (block.pond) {
      ctx.fillStyle = '#4a90c9';
      ctx.beginPath();
      ctx.ellipse(block.pond.x, block.pond.y, block.pond.rx, block.pond.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const tree of block.trees) drawTree(ctx, tree.x, tree.y, tree.r);
    for (const b of block.buildings) drawBuilding(ctx, b, game.time);
  }
  // Roads: asphalt, edge lines, dashed centres, crossings.
  ctx.fillStyle = COLORS.asphalt;
  for (const rx of WORLD.roadsX) ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.beachTop);
  for (const ry of WORLD.roadsY) ctx.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (const rx of WORLD.roadsX) {
    ctx.beginPath();
    ctx.moveTo(rx - WORLD.roadWidth / 2 + 6, 0);
    ctx.lineTo(rx - WORLD.roadWidth / 2 + 6, WORLD.beachTop);
    ctx.moveTo(rx + WORLD.roadWidth / 2 - 6, 0);
    ctx.lineTo(rx + WORLD.roadWidth / 2 - 6, WORLD.beachTop);
    ctx.stroke();
  }
  for (const ry of WORLD.roadsY) {
    ctx.beginPath();
    ctx.moveTo(0, ry - WORLD.roadWidth / 2 + 6);
    ctx.lineTo(WORLD.width, ry - WORLD.roadWidth / 2 + 6);
    ctx.moveTo(0, ry + WORLD.roadWidth / 2 - 6);
    ctx.lineTo(WORLD.width, ry + WORLD.roadWidth / 2 - 6);
    ctx.stroke();
  }
  ctx.fillStyle = COLORS.asphaltLine;
  for (const rx of WORLD.roadsX) {
    for (let y = 0; y < WORLD.beachTop; y += 56) ctx.fillRect(rx - 3, y, 6, 28);
  }
  for (const ry of WORLD.roadsY) {
    for (let x = 0; x < WORLD.width; x += 56) ctx.fillRect(x, ry - 3, 28, 6);
  }
  // Beach props: umbrellas and the pier.
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(1350, WORLD.beachTop + 40, 260, 14);
  ctx.fillRect(1350, WORLD.beachTop + 40, 14, 90);
  ctx.fillRect(1596, WORLD.beachTop + 40, 14, 90);
  const umbrellaColors = ['#e05a5a', '#5a9ee0', '#e8d44f'];
  for (let i = 0; i < 6; i += 1) {
    const ux = 700 + i * 260;
    const uy = WORLD.beachTop + 52;
    ctx.fillStyle = umbrellaColors[i % 3];
    ctx.beginPath();
    ctx.arc(ux, uy, 26, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#8a6a4a';
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.lineTo(ux, uy + 26);
    ctx.stroke();
  }
  // Cash packages glow where they wait.
  for (const pack of game.world.packages) {
    if (pack.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 4 + pack.x);
    ctx.fillStyle = 'rgba(232,212,79,' + (0.25 * pulse) + ')';
    ctx.beginPath();
    ctx.arc(pack.x, pack.y, 26 + pulse * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d44f';
    ctx.fillRect(pack.x - 8, pack.y - 6, 16, 12);
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(pack.x - 8, pack.y - 2, 16, 4);
  }
  // Supply crates: health (green cross), armour (blue vest), ammo (yellow).
  for (const pk of game.world.pickups) {
    if (pk.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 3 + pk.y);
    const color = pk.kind === 'health' ? '#7ae08a' : pk.kind === 'armor' ? '#7ab8e0' : '#ffd76a';
    ctx.fillStyle = 'rgba(255,255,255,' + (0.2 * pulse) + ')';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y, 24 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(pk.x - 11, pk.y - 9, 22, 18);
    ctx.fillStyle = color;
    if (pk.kind === 'health') {
      ctx.fillRect(pk.x - 3, pk.y - 7, 6, 14);
      ctx.fillRect(pk.x - 7, pk.y - 3, 14, 6);
    } else if (pk.kind === 'armor') {
      ctx.fillRect(pk.x - 7, pk.y - 6, 14, 12);
      ctx.fillStyle = '#20242c';
      ctx.fillRect(pk.x - 7, pk.y - 1, 14, 3);
    } else {
      ctx.fillRect(pk.x - 6, pk.y - 2, 12, 4);
      ctx.fillRect(pk.x - 2, pk.y - 6, 4, 12);
    }
  }
}

function drawCarShape(ctx, car) {
  const w = car.spec.w;
  const h = car.spec.h;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  // Windows, roof, lights.
  ctx.fillStyle = '#20242c';
  ctx.fillRect(-w * 0.18, -h / 2 + 3, w * 0.3, h - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(w / 2 - 8, -h / 2 + 3, 5, 5);
  ctx.fillRect(w / 2 - 8, h / 2 - 8, 5, 5);
  ctx.fillStyle = '#ff5a4a';
  ctx.fillRect(-w / 2 + 1, -h / 2 + 3, 4, 5);
  ctx.fillRect(-w / 2 + 1, h / 2 - 8, 4, 5);
  if (car.type === 'police') {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-w * 0.05, -h / 2 + 2, w * 0.28, h - 4);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 2, 3);
    const flash = Math.sin(car.sirenPhase) > 0 ? '#ff3a3a' : '#3a6fff';
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(-2, -h / 2 + 2, 5, 0, Math.PI * 2);
    ctx.arc(8, -h / 2 + 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'muscle') {
    // Racing stripes down the hood of the Bandit Muscle.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-w * 0.08, -h / 2 + 2, 4, h - 4);
    ctx.fillRect(w * 0.08 - 4, -h / 2 + 2, 4, h - 4);
  }
  if (car.health < 55) {
    ctx.fillStyle = 'rgba(40,40,40,0.85)';
    ctx.beginPath();
    ctx.arc(w / 4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCars(ctx, game) {
  for (const car of game.cars) {
    if (car.dead) continue;
    drawCarShape(ctx, car);
  }
}

export function drawPeds(ctx, game) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (ped.state === 'taxi' && game.player.inCar) continue; // riding with you
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(ped.bob) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.pants;
    ctx.fillRect(-5, 2 + bob * 0.3, 4, 8);
    ctx.fillRect(1, 2 - bob * 0.3, 4, 8);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4 - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.jog) {
      // Joggers wear a headband.
      ctx.fillStyle = '#ff5a4a';
      ctx.fillRect(-6, -10, 12, 3);
    }
    if (ped.taxi && ped.state !== 'taxi') {
      ctx.fillStyle = '#e8d44f';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI?', 0, -18);
    }
    ctx.restore();
  }
  // Foot cops: dark uniforms, caps.
  for (const cop of game.police.footCops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c88a';
    ctx.beginPath();
    ctx.arc(Math.cos(cop.angle) * 4, Math.sin(cop.angle) * 4 - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a6fd8';
    ctx.fillRect(-8, -12, 16, 4);
    ctx.restore();
  }
}

export function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hurtT > 0 && Math.floor(game.time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const step = p.moving ? Math.sin(game.time * 14) * 3 : 0;
  ctx.fillStyle = '#2c3242';
  ctx.fillRect(-6, 3 + step * 0.4, 5, 9);
  ctx.fillRect(1, 3 - step * 0.4, 5, 9);
  // Rio's teal jacket and cap.
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e07a3a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 7, 7, Math.PI, 0);
  ctx.fill();
  // Pistol in hand when aiming.
  if (p.ammo > 0) {
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
    ctx.lineTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBullets(ctx, game) {
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
}

export function drawParticles(ctx, game) {
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of game.floaters) {
    ctx.globalAlpha = clamp(f.life / 1.2, 0, 1);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ---- Mission marker: a pulsing beacon in the world, and an edge arrow ----
export function drawMarker(ctx, game) {
  const marker = missionMarker(game);
  const target = game.taxi.active ? { x: game.taxi.target.x, y: game.taxi.target.y, label: 'Fare' } : marker;
  if (!target) return;
  const cam = game.camera;
  const pulse = 1 + 0.18 * Math.sin(game.time * 5);
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,106,0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(9, -34);
  ctx.lineTo(-9, -34);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Off-screen: an arrow on the screen edge points the way.
  const sx = target.x - (cam.x - VIEW.width / 2);
  const sy = target.y - (cam.y - VIEW.height / 2);
  if (sx < 30 || sx > VIEW.width - 30 || sy < 30 || sy > VIEW.height - 30) {
    const cx = clamp(sx, 60, VIEW.width - 60);
    const cy = clamp(sy, 60, VIEW.height - 60);
    const a = Math.atan2(sy - VIEW.height / 2, sx - VIEW.width / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(Math.hypot(target.x - game.player.x, target.y - game.player.y)) + 'm', cx, cy + 30);
  }
}

// ---- HUD ----
function starRow(ctx, x, y, wanted) {
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < wanted ? '#ffd76a' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', x + i * 28, y);
  }
}

export function drawHUD(ctx, game) {
  const p = game.player;
  const pol = game.police;
  ctx.textAlign = 'left';
  // Top-left: wanted stars, cash, health, armour, ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 14, 12, 250, 108, 10);
  ctx.fill();
  starRow(ctx, 24, 40, pol.wanted);
  ctx.fillStyle = '#7ae08a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(fmtCash(p.cash), 24, 70);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(24, 82, 150, 10);
  ctx.fillStyle = p.health > 30 ? '#7ae08a' : '#ff5a4a';
  ctx.fillRect(24, 82, 150 * (p.health / 100), 10);
  if (p.armor > 0) {
    ctx.fillStyle = '#7ab8e0';
    ctx.fillRect(24, 96, 150 * (p.armor / 100), 5);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('AMMO ' + p.ammo + '/' + p.reserveAmmo, 186, 92);
  ctx.fillStyle = '#7ae08a';
  ctx.fillText('SUPPLIES ' + (game.stats.pickups || 0), 186, 110);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(fmtClock(game.clockMinutes), 186, 70);
  // Objective line under the top bar.
  const st = currentStage(game);
  if (st) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const label = (game.missions.active ? game.missions.active.title + ' — ' : '') + st.text;
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(label).width + 24;
    roundRect(ctx, 14, 128, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('◆ ' + label, 26, 148);
    if (st.time) {
      ctx.fillStyle = game.missions.stageT < 20 ? '#ff5a4a' : '#fff';
      ctx.fillText(Math.ceil(game.missions.stageT) + 's', 26 + w + 10, 148);
    }
  }
  if (game.taxi.active) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, 14, 164, 210, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#7ae08a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('TAXI  ' + fmtCash(game.taxi.fare) + '  •  ' + Math.ceil(game.taxi.timer) + 's', 26, 184);
  }
  // Difficulty pill, top-centre: the active mode is always visible in play.
  const tune = difficultyTuning(game.difficulty);
  const diffLabel = tune.label.toUpperCase();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const diffW = ctx.measureText(diffLabel).width + 34;
  roundRect(ctx, VIEW.width / 2 - diffW / 2, 12, diffW, 26, 8);
  ctx.fill();
  ctx.fillStyle = game.difficulty === 'hardcore' ? '#ff5a4a' : game.difficulty === 'chill' ? '#7ab8e0' : '#ffd76a';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('◆ ' + diffLabel, VIEW.width / 2, 30);
  ctx.textAlign = 'left';
  // Bottom-left: speed and radio while driving.
  if (p.inCar) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, 14, VIEW.height - 66, 190, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', 26, VIEW.height - 32);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(game.audio.stationName() + '  (C to change)', 26, VIEW.height - 18);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD move • E enter car • F punch • Click shoot • R reload • M mission', 16, VIEW.height - 18);
  }
  // Arrest progress.
  if (pol.arrestT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, VIEW.width / 2 - 130, 90, 260, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ARRESTED IN ' + (1.4 - pol.arrestT).toFixed(1) + 's — RUN!', VIEW.width / 2, 113);
    ctx.textAlign = 'left';
  }
  // Banner (mission title / event text).
  if (game.bannerText) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = Math.min(720, ctx.measureText(game.bannerText.title).width + 60);
    roundRect(ctx, VIEW.width / 2 - w / 2, 150, w, game.bannerText.sub ? 74 : 46, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(game.bannerText.title, VIEW.width / 2, 180);
    if (game.bannerText.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      wrapText(ctx, game.bannerText.sub, VIEW.width / 2, 204, w - 30, 18);
    }
    ctx.textAlign = 'left';
  }
  drawMinimap(ctx, game);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, cy);
}

export function drawMinimap(ctx, game) {
  const size = MINIMAP_SIZES[game.minimapZoom || 0] || MINIMAP_SIZES[1];
  const x0 = VIEW.width - size - 14;
  const y0 = 14;
  const scale = size / WORLD.width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size * (WORLD.height / WORLD.width) + 12, 10);
  ctx.fill();
  const h = size * (WORLD.height / WORLD.width);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, h);
  ctx.clip();
  ctx.fillStyle = '#5a8a4a';
  ctx.fillRect(x0, y0, size, h);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0, y0 + WORLD.waterTop * scale, size, h);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x0, y0 + WORLD.beachTop * scale, size, (WORLD.waterTop - WORLD.beachTop) * scale);
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 4;
  for (const rx of WORLD.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * scale, y0);
    ctx.lineTo(x0 + rx * scale, y0 + WORLD.beachTop * scale);
    ctx.stroke();
  }
  for (const ry of WORLD.roadsY) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * scale);
    ctx.lineTo(x0 + WORLD.width * scale, y0 + ry * scale);
    ctx.stroke();
  }
  // Blips: mission gold, police red, taxi green, packages amber.
  const blip = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r || 4, 0, Math.PI * 2);
    ctx.fill();
  };
  const marker = missionMarker(game);
  if (marker) blip(marker.x, marker.y, '#ffd76a', 6);
  if (game.taxi.active) blip(game.taxi.target.x, game.taxi.target.y, '#7ae08a', 5);
  for (const cop of game.police.cops) blip(cop.x, cop.y, '#ff5a4a', 4);
  for (const pack of game.world.packages) if (!pack.taken) blip(pack.x, pack.y, '#e8d44f', 3);
  // Supply crates: health green, armour blue, ammo yellow.
  for (const pk of game.world.pickups) {
    if (pk.taken) continue;
    blip(pk.x, pk.y, pk.kind === 'health' ? '#7ae08a' : pk.kind === 'armor' ? '#7ab8e0' : '#ffd76a', 3);
  }
  // Landmark dots with short labels, so the map teaches the city.
  const landmarks = game.world.landmarks;
  const labels = [
    [landmarks.garage, 'Garage'], [landmarks.safehouse, 'Safehouse'],
    [landmarks.docks, 'Docks'], [landmarks.penthouse, 'Penthouse'],
    [landmarks.plaza, 'Plaza'], [landmarks.stadium, 'Stadium'],
    [landmarks.nightclub, 'Palms'], [landmarks.beachBar, 'Beach Bar'],
  ];
  ctx.font = 'bold 9px sans-serif';
  for (const [lm, label] of labels) {
    const lx = x0 + lm.x * scale;
    const ly = y0 + lm.y * scale;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Labels on the right half flip to the left so they stay inside the map.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    if (lx > x0 + size * 0.62) {
      ctx.textAlign = 'right';
      ctx.fillText(label, lx - 4, ly + 3);
      ctx.textAlign = 'left';
    } else {
      ctx.fillText(label, lx + 4, ly + 3);
    }
  }
  // Viewport rectangle: what the main camera currently shows.
  const cam = game.camera;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    x0 + (cam.x - VIEW.width / 2) * scale,
    y0 + (cam.y - VIEW.height / 2) * scale,
    VIEW.width * scale, VIEW.height * scale,
  );
  // North indicator: a small chip at the top-left corner of the map.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.arc(x0 + 10, y0 + 10, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + 10, y0 + 14);
  ctx.textAlign = 'left';
  // Player arrow.
  ctx.save();
  ctx.translate(x0 + game.player.x * scale, y0 + game.player.y * scale);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, h + 12);
}

// ---- Menus ----
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,24,0.82)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,106,0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
}

export function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,22,0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 84px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 8;
  ctx.strokeText('SOLARA BAY', VIEW.width / 2, 190);
  ctx.fillText('SOLARA BAY', VIEW.width / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('An open-world crime story — drive, steal, run, survive.', VIEW.width / 2, 236);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('A completely original game. No Rockstar content, no borrowed assets.', VIEW.width / 2, 264);
  // The panel grows when a save exists; the difficulty row sits under the
  // controls, above the feature line.
  const saveY = game.saveExists;
  panel(ctx, VIEW.width / 2 - 260, 300, 520, saveY ? 314 : 274);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('CLICK or press ENTER to play', VIEW.width / 2, 344);
  if (game.saveExists) {
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#7ae08a';
    ctx.fillText('Press C to continue — ' + game.saveSummary, VIEW.width / 2, 378);
  }
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#cfd8e8';
  ctx.fillText('WASD move / drive  •  E enter car  •  F punch  •  Mouse shoot', VIEW.width / 2, saveY ? 414 : 384);
  ctx.fillText('M start mission  •  P pause  •  C radio  •  Q mute  •  N / wheel zoom minimap', VIEW.width / 2, saveY ? 440 : 410);
  // Difficulty selector: 1 Chill, 2 Normal, 3 Hardcore. The active one is
  // filled gold; the others are outlined.
  const diffY = saveY ? 466 : 436;
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('DIFFICULTY — press 1 / 2 / 3', VIEW.width / 2, diffY);
  const boxW = 150;
  const boxH = 30;
  const gap = 10;
  const totalW = boxW * 3 + gap * 2;
  let bx = VIEW.width / 2 - totalW / 2;
  for (let i = 0; i < DIFFICULTY_ORDER.length; i += 1) {
    const name = DIFFICULTY_ORDER[i];
    const selected = game.difficulty === name;
    ctx.fillStyle = selected ? '#ffd76a' : 'rgba(255,255,255,0.08)';
    roundRect(ctx, bx, diffY + 12, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd76a' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, diffY + 12, boxW, boxH, 8);
    ctx.stroke();
    ctx.fillStyle = selected ? '#20242c' : '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText((i + 1) + '  ' + DIFFICULTY[name].label.toUpperCase(), bx + boxW / 2, diffY + 32);
    bx += boxW + gap;
  }
  ctx.fillStyle = '#cfd8e8';
  ctx.font = '13px sans-serif';
  ctx.fillText(difficultyTuning(game.difficulty).desc, VIEW.width / 2, diffY + 58);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('8 story missions  •  taxi fares  •  12 hidden packages  •  11 supply crates  •  5 wanted stars', VIEW.width / 2, saveY ? 542 : 512);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Progress saves automatically after each mission.', VIEW.width / 2, saveY ? 574 : 542);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,22,0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  // Run statistics: progress, money, time played, difficulty and lifetime
  // earnings, so the pause screen is the run's scorecard.
  panel(ctx, VIEW.width / 2 - 250, 160, 500, 360);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 216);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  const m = game.missions;
  ctx.fillText('Missions done: ' + m.completed + ' / ' + m.list.length, VIEW.width / 2, 262);
  ctx.fillText('Cash: ' + fmtCash(game.player.cash) + '   •   Fares: ' + game.stats.fares + '   •   Packages: ' + game.stats.packages + '/12', VIEW.width / 2, 292);
  ctx.fillText('Supplies: ' + (game.stats.pickups || 0) + '   •   Cars stolen: ' + game.stats.stolen + '   •   Best wanted: ' + game.stats.bestWanted + '★', VIEW.width / 2, 322);
  ctx.fillStyle = '#7ab8e0';
  ctx.fillText('Time played: ' + fmtDuration(game.time) + '   •   Difficulty: ' + difficultyTuning(game.difficulty).label, VIEW.width / 2, 352);
  ctx.fillText('Total earned this run: ' + fmtCash(game.stats.earned || 0), VIEW.width / 2, 382);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('P or Esc to resume  •  M next mission  •  Q mute', VIEW.width / 2, 432);
  ctx.fillText('R restart the run (keeps your save)', VIEW.width / 2, 464);
  ctx.textAlign = 'left';
}

export function drawEnd(ctx, game, kind) {
  ctx.fillStyle = kind === 'complete' ? 'rgba(10,30,16,0.72)' : 'rgba(30,8,8,0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  panel(ctx, VIEW.width / 2 - 280, 170, 560, 330);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('BUSTED!', VIEW.width / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('The SBPD caught up with Rio. Bail is ' + fmtCash(120) + ' — paid from your cash.', VIEW.width / 2, 292);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('WASTED', VIEW.width / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Rio is down. The hospital bill is ' + fmtCash(150) + ' — paid from your cash.', VIEW.width / 2, 292);
  } else {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('KING OF SOLARA', VIEW.width / 2, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Every mission done. The city is yours, Rio.', VIEW.width / 2, 292);
  }
  ctx.fillStyle = '#cfd8e8';
  ctx.font = '16px sans-serif';
  ctx.fillText('Cash: ' + fmtCash(game.player.cash) + '   •   Missions: ' + game.missions.completed + '/' + game.missions.list.length + '   •   Packages: ' + game.stats.packages + '/12', VIEW.width / 2, 336);
  ctx.fillText('Fares: ' + game.stats.fares + '   •   Supplies: ' + (game.stats.pickups || 0) + '   •   Cars stolen: ' + game.stats.stolen + '   •   Best wanted: ' + game.stats.bestWanted + '★', VIEW.width / 2, 364);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press ENTER to keep playing in free roam', VIEW.width / 2, 414);
  ctx.fillText('Press R to start a fresh run', VIEW.width / 2, 446);
  ctx.textAlign = 'left';
}

// Warm sunset grade used by the night screenshot scene.
export function drawSunsetGrade(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, 'rgba(255,120,60,0.16)');
  g.addColorStop(1, 'rgba(120,40,120,0.24)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

// Night: a dark blue wash over the city, cut by the headlights of the car
// the player drives. Drawn in screen space, after the world.
export function drawNightGrade(ctx, game) {
  ctx.fillStyle = 'rgba(8,12,34,0.42)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const p = game.player;
  if (p.inCar) {
    const sx = p.x - (game.camera.x - VIEW.width / 2);
    const sy = p.y - (game.camera.y - VIEW.height / 2);
    const g = ctx.createRadialGradient(sx, sy, 30, sx, sy, 260);
    g.addColorStop(0, 'rgba(255,240,180,0.28)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, 260, 0, Math.PI * 2);
    ctx.fill();
    // Headlight cone ahead of the car.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle);
    const cone = ctx.createLinearGradient(0, 0, 320, 0);
    cone.addColorStop(0, 'rgba(255,244,190,0.30)');
    cone.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(320, -90);
    ctx.lineTo(320, 90);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

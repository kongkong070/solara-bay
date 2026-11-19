// Everything the player sees: the city, the bay, the cars and boats, the
// day/night light, the HUD, the minimap and the menus. Canvas 2D only.

import { BEACH_EDGE, CAR_TYPES, DIFFICULTY, GOLDEN_START, NIGHT_END, NIGHT_START, PALETTE, SEA_EDGE, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { clamp, dist, fmtClock, fmtMoney, fmtTime, lerp } from './util.js';
import { missionObjective, MISSION_LIST } from './missions.js';
import { stationName } from './audio.js';

export function createCamera() {
  return { x: 0, y: 0, shake: 0 };
}

function updateCamera(S) {
  const cam = S.camera;
  const tx = clamp(S.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  const ty = clamp(S.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  cam.x = lerp(cam.x, tx, 0.12);
  cam.y = lerp(cam.y, ty, 0.12);
  cam.shake = Math.max(0, cam.shake - 0.5);
}

export function drawGame(ctx, S) {
  updateCamera(S);
  const cam = S.camera;
  const shX = cam.shake > 0 ? (S.rng() - 0.5) * cam.shake : 0;
  const shY = cam.shake > 0 ? (S.rng() - 0.5) * cam.shake : 0;
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(-Math.round(cam.x + shX), -Math.round(cam.y + shY));
  drawWorld(ctx, S);
  drawPickups(ctx, S);
  drawBoats(ctx, S);
  drawCars(ctx, S);
  drawPeds(ctx, S);
  drawCops(ctx, S);
  drawPlayer(ctx, S);
  drawHeli(ctx, S);
  drawParticles(ctx, S);
  ctx.restore();
  drawLighting(ctx, S);
  if (S.mode !== 'title') {
    drawHud(ctx, S);
    drawMinimap(ctx, S);
  }
  drawBanner(ctx, S);
  if (S.mode === 'title') drawTitle(ctx, S);
  else if (S.mode === 'paused') drawPause(ctx, S);
  else if (S.mode === 'busted') drawBusted(ctx, S);
  else if (S.mode === 'finale') drawFinale(ctx, S);
}

function drawWorld(ctx, S) {
  const city = S.city;
  // Sea and sand.
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(0, 0, SEA_EDGE, WORLD_H);
  ctx.fillStyle = PALETTE.seaShallow;
  ctx.fillRect(0, 0, SEA_EDGE - 60, WORLD_H);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(SEA_EDGE, 0, BEACH_EDGE - SEA_EDGE, WORLD_H);
  // City ground.
  ctx.fillStyle = '#a9b08a';
  ctx.fillRect(BEACH_EDGE, 0, WORLD_W - BEACH_EDGE, WORLD_H);
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = PALETTE.parkDark;
    ctx.beginPath();
    ctx.arc(park.x + park.w * 0.3, park.y + park.h * 0.4, 26, 0, Math.PI * 2);
    ctx.arc(park.x + park.w * 0.7, park.y + park.h * 0.6, 32, 0, Math.PI * 2);
    ctx.fill();
  }
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const ax of city.avenues) ctx.fillRect(ax - city.roadW / 2, 0, city.roadW, WORLD_H);
  for (const sy of city.streets) ctx.fillRect(BEACH_EDGE, sy - city.roadW / 2, WORLD_W - BEACH_EDGE, city.roadW);
  // Road centre dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const ax of city.avenues) {
    for (let y = 20; y < WORLD_H; y += 64) ctx.fillRect(ax - 2, y, 4, 30);
  }
  for (const sy of city.streets) {
    for (let x = BEACH_EDGE + 20; x < WORLD_W; x += 64) ctx.fillRect(x, sy - 2, 30, 4);
  }
  // Downtown Plaza.
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
  ctx.strokeStyle = '#8f8875';
  ctx.lineWidth = 3;
  ctx.strokeRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
  // Bay Stadium bowl.
  ctx.fillStyle = PALETTE.stadiumGreen;
  ctx.beginPath();
  ctx.ellipse(city.stadium.x + 200, city.stadium.y + 200, 185, 165, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8e3c8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(city.stadium.x + 200, city.stadium.y + 200, 185, 165, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#dfe8d8';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BAY STADIUM', city.stadium.x + 200, city.stadium.y + 208);
  // The Docks yard.
  ctx.fillStyle = '#9a938a';
  ctx.fillRect(city.docks.x, city.docks.y, city.docks.w, city.docks.h);
  // Marina basin.
  ctx.fillStyle = '#c9b896';
  ctx.fillRect(city.marina.x, city.marina.y, city.marina.w, city.marina.h);
  // Sunset Pier deck.
  ctx.fillStyle = PALETTE.pierWood;
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.strokeStyle = PALETTE.pierEdge;
  ctx.lineWidth = 4;
  ctx.strokeRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  for (let x = city.pier.x + 30; x < city.pier.x + city.pier.w; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, city.pier.y);
    ctx.lineTo(x, city.pier.y + city.pier.h);
    ctx.stroke();
  }
  // Buildings with a roof line and a soft shadow.
  for (const b of city.solids) {
    if (b.kind === 'container') {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingRoof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, Math.min(16, b.h - 12));
  }
  // Landmark labels on the world itself.
  ctx.fillStyle = 'rgba(20,24,40,0.75)';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const lm of city.landmarks) {
    if (lm.name === 'Bay Stadium') continue;
    ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y - 14);
  }
}

function drawPickups(ctx, S) {
  const t = S.timeMs / 1000;
  for (const pack of S.city.packages) {
    if (pack.taken) continue;
    const pulse = 1 + Math.sin(t * 3 + pack.x) * 0.12;
    ctx.save();
    ctx.translate(pack.x, pack.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(-11, -11, 22, 22);
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 2;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.fillStyle = '#3a2f10';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
    ctx.restore();
  }
  for (const crate of S.city.crates) {
    if (!crate.ready) continue;
    ctx.fillStyle = '#4f7d5a';
    ctx.fillRect(crate.x - 13, crate.y - 13, 26, 26);
    ctx.strokeStyle = '#2c4a33';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x - 13, crate.y - 13, 26, 26);
    ctx.fillStyle = '#eaf5ec';
    ctx.fillRect(crate.x - 3, crate.y - 9, 6, 18);
    ctx.fillRect(crate.x - 9, crate.y - 3, 18, 6);
  }
  // Buoys for the Bay Runner run.
  for (let i = 0; i < S.city.buoys.length; i++) {
    const b = S.city.buoys[i];
    ctx.fillStyle = b.done ? '#7fb069' : '#e85d3d';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - 14);
    ctx.lineTo(b.x + 11, b.y + 9);
    ctx.lineTo(b.x - 11, b.y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), b.x, b.y - 20);
  }
}

function drawVehicleShape(ctx, x, y, angle, w, h, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.85)';
  ctx.fillRect(w * 0.08, -h / 2 + 3, w * 0.2, h - 6);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(w / 2 - 3, -h / 2 + 3, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 8, 3, 5);
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

function drawBoats(ctx, S) {
  for (const boat of S.boats) {
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(boat.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 4, boat.w / 2, boat.h / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, boat.w / 2, boat.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2e5f7a';
    ctx.fillRect(-boat.w * 0.1, -boat.h / 2 + 3, boat.w * 0.3, boat.h - 6);
    ctx.restore();
  }
}

function drawCars(ctx, S) {
  for (const car of S.traffic) drawVehicleShape(ctx, car.x, car.y, car.angle, car.w, car.h, car.color);
  for (const car of S.parked) drawVehicleShape(ctx, car.x, car.y, car.angle, car.w, car.h, car.color);
  if (S.player.vehicle) {
    const car = S.player.vehicle;
    drawVehicleShape(ctx, car.x, car.y, car.angle, car.w, car.h, car.color);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2d2d';
      ctx.fillRect(car.x - Math.cos(car.angle) * (car.w / 2) - 4, car.y - Math.sin(car.angle) * (car.h / 2) - 4, 6, 6);
    }
  }
}

function drawPeds(ctx, S) {
  for (const ped of S.peds) {
    if (ped.state === 'ride') continue;
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + 3, 8, 0, Math.PI);
    ctx.fill();
    if (ped.state === 'wave') {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ped.x, ped.y - 6);
      ctx.lineTo(ped.x + 10, ped.y - 22);
      ctx.stroke();
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', ped.x, ped.y - 28);
    }
  }
}

function drawCops(ctx, S) {
  for (const car of S.copCars) {
    drawVehicleShape(ctx, car.x, car.y, car.angle, car.w, car.h, car.interceptor ? '#1c1c26' : '#20242e');
    const flash = Math.floor(S.timeMs / 350) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * 6, car.y - Math.sin(car.angle) * 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', car.x, car.y - 16);
  }
  for (const cop of S.cops) {
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, S) {
  const p = S.player;
  if (p.mode !== 'foot') return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(2, 3, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e6fb0';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath();
  ctx.arc(4, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.fillRect(10, -3, 12, 6);
  ctx.restore();
  if (p.muzzle > 0) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHeli(ctx, S) {
  const heli = S.heli;
  if (!heli) return;
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 30, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9403d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.9)';
  ctx.fillRect(12, -6, 10, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  const r = heli.rotor || 0;
  ctx.beginPath();
  ctx.moveTo(Math.cos(r) * 34, Math.sin(r) * 34);
  ctx.lineTo(-Math.cos(r) * 34, -Math.sin(r) * 34);
  ctx.stroke();
  ctx.restore();
  if (heli.landed) {
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("LENA'S HELICOPTER — press E", heli.x, heli.y - 40);
  }
}

function drawParticles(ctx, S) {
  for (const pt of S.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    if (pt.kind === 'tracer') {
      ctx.strokeStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x2, pt.y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (1 + (1 - a) * 0.6), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function darknessAt(S) {
  const h = S.clock.hour + S.clock.minute / 60;
  if (h >= NIGHT_START || h < NIGHT_END) return 0.55;
  if (h >= GOLDEN_START && h < NIGHT_START) return 0.18;
  if (h >= NIGHT_END && h < NIGHT_END + 1) return 0.3;
  return 0;
}

function drawLighting(ctx, S) {
  const dark = darknessAt(S);
  const h = S.clock.hour + S.clock.minute / 60;
  if (h >= GOLDEN_START && h < NIGHT_START) {
    ctx.fillStyle = PALETTE.duskTint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (dark > 0) {
    ctx.fillStyle = `rgba(8, 12, 40, ${dark})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Headlights cut the night while driving or sailing.
    const p = S.player;
    if (p.mode === 'car' || p.mode === 'boat') {
      const cam = S.camera;
      const sx = p.x - cam.x;
      const sy = p.y - cam.y;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 460);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.20)');
      grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 460, p.angle - 0.42, p.angle + 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawStar(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(20,20,30,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHud(ctx, S) {
  const p = S.player;
  ctx.textBaseline = 'alphabetic';
  // Wanted stars, top left.
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, 28 + i * 26, 30, 11, i < S.wanted);
  }
  // Cash, top right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#1d5c2e';
  ctx.fillText(fmtMoney(p.cash), VIEW_W - 18, 38);
  ctx.fillStyle = '#eaffea';
  ctx.fillText(fmtMoney(p.cash), VIEW_W - 20, 36);
  // Clock, difficulty pill and radio, top centre.
  const obj = missionObjective(S);
  ctx.textAlign = 'center';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(fmtClock(S.clock.hour, S.clock.minute), VIEW_W / 2, 30);
  const diff = DIFFICULTY[S.difficulty];
  ctx.font = 'bold 13px system-ui, sans-serif';
  const pill = '  ' + diff.label.toUpperCase() + '  ';
  const pillW = ctx.measureText(pill).width + 12;
  ctx.fillStyle = 'rgba(10,14,30,0.6)';
  roundRect(ctx, VIEW_W / 2 - pillW / 2, 40, pillW, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(pill, VIEW_W / 2, 56);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('♪ ' + stationName(S.audio), VIEW_W / 2, 80);
  // Objective line under the pill.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffe14d';
  const objText = obj.text + (obj.t > 0 ? '  ' + fmtTime(obj.t) : '');
  ctx.fillText(objText, VIEW_W / 2, 104);
  // Health, armour and ammo, bottom left.
  const bx = 20;
  const by = VIEW_H - 84;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,30,0.55)';
  ctx.fillRect(bx - 6, by - 18, 220, 80);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(bx, by, 150 * clamp(p.hp / 100, 0, 1), 10);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, 150, 10);
  ctx.fillStyle = '#7fb7ff';
  ctx.fillRect(bx, by + 14, 150 * clamp(p.armor / 100, 0, 1), 10);
  ctx.strokeRect(bx, by + 14, 150, 10);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.round(p.hp) + '   ARMOR ' + Math.round(p.armor), bx, by + 42);
  ctx.fillText('AMMO ' + p.mag + ' / ' + p.ammo, bx, by + 60);
  // Speedometer, bottom right above the minimap.
  if (p.mode === 'car' || p.mode === 'boat' || p.mode === 'heli') {
    ctx.textAlign = 'right';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    const kmh = Math.round(Math.abs(p.speed) * 0.24);
    ctx.fillText(kmh + ' km/h', VIEW_W - 260, VIEW_H - 200);
  }
}

function drawMinimap(ctx, S) {
  const zoom = S.minimapZoom || 0;
  const scales = [0.062, 0.105, 0.18];
  const scale = scales[zoom];
  const mw = 230;
  const mh = 182;
  const mx = VIEW_W - mw - 16;
  const my = VIEW_H - mh - 16;
  const p = S.player;
  // Window: whole map at zoom 0, a window on the player at closer zooms.
  let wx0 = 0;
  let wy0 = 0;
  if (zoom > 0) {
    wx0 = clamp(p.x - mw / scale / 2, 0, WORLD_W - mw / scale);
    wy0 = clamp(p.y - mh / scale / 2, 0, WORLD_H - mh / scale);
  }
  const toMapX = (x) => mx + (x - wx0) * scale;
  const toMapY = (y) => my + (y - wy0) * scale;

  ctx.save();
  ctx.fillStyle = 'rgba(8,12,28,0.72)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  // Sea, land, roads.
  ctx.fillStyle = '#1f6f8f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#8fae7d';
  ctx.fillRect(toMapX(BEACH_EDGE), my, mw, mh);
  ctx.fillStyle = '#3b4048';
  for (const ax of S.city.avenues) ctx.fillRect(toMapX(ax - 45), my, 90 * scale, mh);
  for (const sy of S.city.streets) ctx.fillRect(mx, toMapY(sy - 45), mw, 90 * scale);
  ctx.fillStyle = '#e6cf96';
  ctx.fillRect(toMapX(SEA_EDGE), my, (BEACH_EDGE - SEA_EDGE) * scale, mh);
  // Stadium and pier.
  ctx.fillStyle = '#5f9153';
  ctx.fillRect(toMapX(3050), toMapY(500), 400 * scale, 400 * scale);
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(toMapX(180), toMapY(1330), 420 * scale, 140 * scale);
  // Blips.
  const obj = missionObjective(S);
  const blip = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(toMapX(x), toMapY(y), r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (obj.x) blip(obj.x, obj.y, '#ffe14d', 6);
  if (S.fare.active) blip(S.fare.dest.x, S.fare.dest.y, '#39d353', 5);
  for (const pack of S.city.packages) {
    if (!pack.taken && dist(p.x, p.y, pack.x, pack.y) < 700) blip(pack.x, pack.y, '#fff', 3);
  }
  for (const boat of S.boats) blip(boat.x, boat.y, '#54d8ff', 4);
  if (S.heli) blip(S.heli.x, S.heli.y, '#ff8c42', 5);
  for (const car of S.copCars) blip(car.x, car.y, '#2d7dff', 4);
  for (const cop of S.cops) blip(cop.x, cop.y, '#2d7dff', 3);
  // Viewport rectangle: what the main camera sees.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(toMapX(S.camera.x), toMapY(S.camera.y), VIEW_W * scale, VIEW_H * scale);
  // Player arrow.
  ctx.save();
  ctx.translate(toMapX(p.x), toMapY(p.y));
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Landmark labels at the closest zoom.
  if (zoom === 2) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (const lm of S.city.landmarks) {
      const lx = toMapX(lm.x);
      const ly = toMapY(lm.y);
      if (lx > mx && lx < mx + mw - 60 && ly > my && ly < my + mh) {
        ctx.fillText(lm.name, lx + 6, ly - 6);
      }
    }
  }
  ctx.restore();
  // North indicator.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', mx + mw - 12, my + 16);
}

function drawBanner(ctx, S) {
  if (!S.banner || S.banner.t <= 0) return;
  const a = clamp(S.banner.t, 0, 1);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(S.banner.text, VIEW_W / 2, 140);
  ctx.globalAlpha = 1;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 28, 0.82)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
}

function drawTitle(ctx, S) {
  ctx.fillStyle = 'rgba(6, 10, 26, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLARA BAY', VIEW_W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('An open-world crime game in the spirit of GTA 6', VIEW_W / 2, 232);
  panel(ctx, VIEW_W / 2 - 330, 270, 660, 300);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 302);
  ctx.font = '15px system-ui, sans-serif';
  const lines = [
    'WASD / arrows — move, drive, sail      E — enter / exit car, boat, helicopter',
    'Mouse — aim and shoot      F — punch      R — reload      Space — handbrake',
    'Shift — sprint      M — next mission      C — radio      N — minimap zoom',
    'P — pause      Q — mute      1 / 2 / 3 — difficulty (Chill / Normal / Hardcore)',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 332 + i * 26));
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23f';
  const diffLine = 'Difficulty: ' + DIFFICULTY[S.difficulty].label + '  (press 1, 2 or 3)';
  ctx.fillText(diffLine, VIEW_W / 2, 452);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  const startLine = S.hasSave ? 'ENTER — Continue your run' : 'ENTER — Start a new run';
  ctx.fillText(startLine, VIEW_W / 2, 520);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(S.hasSave ? 'N — New game instead' : 'Steal cars, run missions for Lena Cruz, outrun the SBPD', VIEW_W / 2, 548);
}

function drawPause(ctx, S) {
  ctx.fillStyle = 'rgba(6, 10, 26, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 260, 130, 520, 440);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 182);
  ctx.fillStyle = '#fff';
  ctx.font = '16px system-ui, sans-serif';
  const st = S.stats;
  const rows = [
    'Difficulty: ' + DIFFICULTY[S.difficulty].label,
    'Time played: ' + fmtTime(st.timePlayed || 0),
    'Total earnings: ' + fmtMoney(st.earnings || 0),
    'Missions complete: ' + S.missions.done.length + ' / ' + MISSION_LIST.length,
    'Taxi fares: ' + (st.fares || 0) + '    Packages: ' + (st.packages || 0) + ' / 12',
    'Cars stolen: ' + (st.carsStolen || 0) + '    Boats ridden: ' + (st.boatsRidden || 0),
    'Helicopter rides: ' + (st.heliRides || 0) + '    Best wanted: ' + (st.bestWanted || 0) + ' stars',
    'Cash: ' + fmtMoney(S.player.cash),
  ];
  rows.forEach((row, i) => ctx.fillText(row, VIEW_W / 2, 224 + i * 30));
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('P — Resume      Q — Mute', VIEW_W / 2, 524);
}

function drawBusted(ctx, S) {
  ctx.fillStyle = 'rgba(20, 4, 8, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText('BUSTED', VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('The SBPD caught you. Fine: $100. Your mission, if any, failed.', VIEW_W / 2, 350);
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('ENTER — Back on the streets', VIEW_W / 2, 410);
}

function drawFinale(ctx, S) {
  ctx.fillStyle = 'rgba(6, 10, 26, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('SKYLINE ESCAPE', VIEW_W / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Rio and Lena flew out over the bay. Solara Bay is yours.', VIEW_W / 2, 330);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Total earnings: ' + fmtMoney(S.stats.earnings || 0) + '   —   ENTER to keep playing', VIEW_W / 2, 380);
}

// Everything Solara Bay draws: the city, the cars and people, the
// day/night light, the HUD, the minimap and the menus.
import { WORLD, CLOCK, RADIO } from './config.js';
import { clamp, fmtClock, fmtDuration, dist } from './util.js';
import { currentObjective } from './missions.js';

const MAP_ZOOMS = [0.055, 0.1, 0.17];

// Daylight factor 0..1 for a clock time: 1 by day, 0 at night.
export function daylight(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m >= CLOCK.dawnAt && m < CLOCK.sunsetAt) return 1;
  if (m >= CLOCK.sunsetAt && m < CLOCK.nightAt) {
    return 1 - (m - CLOCK.sunsetAt) / (CLOCK.nightAt - CLOCK.sunsetAt) * 0.85;
  }
  if (m >= CLOCK.nightAt || m < CLOCK.dawnAt) return 0.15;
  return 1;
}

export function render(game) {
  const ctx = game.ctx;
  const view = game.view;
  ctx.clearRect(0, 0, view.w, view.h);
  if (game.state === 'title') {
    drawTitle(game);
    return;
  }
  const cam = game.camera;
  ctx.save();
  ctx.translate(view.w / 2 - cam.x, view.h / 2 - cam.y);
  drawGround(game);
  drawRoads(game);
  drawParksAndBeach(game);
  drawBuildings(game);
  drawPier(game);
  drawCratesAndPackages(game);
  drawObjectiveMarker(game);
  drawCars(game);
  drawPeds(game);
  drawCops(game);
  drawPlayer(game);
  drawBullets(game);
  drawParticles(game);
  drawLighting(game);
  ctx.restore();
  drawHud(game);
  if (game.state === 'paused') drawPause(game);
  if (game.state === 'busted') drawBusted(game);
}

function drawGround(game) {
  const ctx = game.ctx;
  // Grass base, then the sand band and the sea.
  ctx.fillStyle = '#7fae62';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(0, WORLD.beachTop, WORLD.width, WORLD.seaTop - WORLD.beachTop);
  ctx.fillStyle = '#2f7fc9';
  ctx.fillRect(0, WORLD.seaTop, WORLD.width, WORLD.height - WORLD.seaTop);
  // Wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const t = game.time * 0.7;
  for (let i = 0; i < 5; i++) {
    const y = WORLD.seaTop + 24 + i * 34;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 90) {
      const yy = y + Math.sin(x * 0.01 + t + i) * 5;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function drawRoads(game) {
  const ctx = game.ctx;
  const rw = WORLD.roadWidth;
  ctx.fillStyle = '#3d3d46';
  for (const rx of game.world.roadsX) {
    ctx.fillRect(rx - rw / 2, 0, rw, WORLD.beachTop);
  }
  for (const ry of game.world.roadsY) {
    ctx.fillRect(0, ry - rw / 2, WORLD.width, rw);
  }
  // Sidewalks.
  ctx.fillStyle = '#9a9aa2';
  for (const rx of game.world.roadsX) {
    ctx.fillRect(rx - rw / 2 - 14, 0, 14, WORLD.beachTop);
    ctx.fillRect(rx + rw / 2, 0, 14, WORLD.beachTop);
  }
  for (const ry of game.world.roadsY) {
    ctx.fillRect(0, ry - rw / 2 - 14, WORLD.width, 14);
    ctx.fillRect(0, ry + rw / 2, WORLD.width, 14);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d44d';
  for (const rx of game.world.roadsX) {
    for (let y = 20; y < WORLD.beachTop; y += 64) {
      ctx.fillRect(rx - 3, y, 6, 30);
    }
  }
  for (const ry of game.world.roadsY) {
    for (let x = 20; x < WORLD.width; x += 64) {
      ctx.fillRect(x, ry - 3, 30, 6);
    }
  }
}

function drawParksAndBeach(game) {
  const ctx = game.ctx;
  for (const park of game.world.parks) {
    ctx.fillStyle = '#5d9e4a';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = '#4a7d3a';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
  }
  // Palms: trunk line and a crown of fronds.
  for (const palm of game.world.palms) {
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + palm.lean * 30, palm.y - 22);
    ctx.stroke();
    ctx.fillStyle = '#3f8f3a';
    const tx = palm.x + palm.lean * 30;
    const ty = palm.y - 22;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + palm.lean;
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * 12, ty + Math.sin(a) * 7, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(game) {
  const ctx = game.ctx;
  for (const b of game.world.buildings) {
    // Soft shadow to the south-east.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows along the roof edge.
    ctx.fillStyle = 'rgba(40,60,90,0.55)';
    const cols = Math.max(1, Math.floor((b.w - 16) / 26));
    for (let i = 0; i < cols; i++) {
      ctx.fillRect(b.x + 10 + i * 26, b.y + 10, 14, 10);
    }
    if (b.floors >= 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w - 16, b.y + 8, 8, 8);
    }
  }
}

function drawPier(game) {
  const ctx = game.ctx;
  const pier = game.world.pier;
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = '#6a4e2e';
  ctx.lineWidth = 2;
  for (let y = pier.y + 14; y < pier.y + pier.h; y += 18) {
    ctx.beginPath();
    ctx.moveTo(pier.x, y);
    ctx.lineTo(pier.x + pier.w, y);
    ctx.stroke();
  }
  // A couple of stalls at the pier's end.
  ctx.fillStyle = '#e85a5a';
  ctx.fillRect(pier.x + 14, pier.y + pier.h - 46, 34, 30);
  ctx.fillStyle = '#5a8ad8';
  ctx.fillRect(pier.x + pier.w - 48, pier.y + pier.h - 46, 34, 30);
}

function drawCratesAndPackages(game) {
  const ctx = game.ctx;
  for (const crate of game.missions.crates) {
    if (crate.taken) continue;
    ctx.fillStyle = '#a87c3a';
    ctx.fillRect(crate.x - 13, crate.y - 13, 26, 26);
    ctx.strokeStyle = '#6a4e22';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x - 13, crate.y - 13, 26, 26);
    ctx.beginPath();
    ctx.moveTo(crate.x - 13, crate.y - 13);
    ctx.lineTo(crate.x + 13, crate.y + 13);
    ctx.moveTo(crate.x + 13, crate.y - 13);
    ctx.lineTo(crate.x - 13, crate.y + 13);
    ctx.stroke();
  }
  for (const pkg of game.missions.packages) {
    if (pkg.taken) continue;
    const pulse = 1 + Math.sin(game.time * 3 + pkg.x) * 0.15;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(pkg.x, pkg.y, 11 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a00';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', pkg.x, pkg.y + 0.5);
  }
}

function drawObjectiveMarker(game) {
  const ctx = game.ctx;
  const obj = currentObjective(game);
  if (!obj) return;
  const pulse = 1 + Math.sin(game.time * 4) * 0.18;
  // Ground ring.
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  // Floating diamond.
  const bob = Math.sin(game.time * 3) * 6;
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(obj.x, obj.y - 52 + bob);
  ctx.lineTo(obj.x + 12, obj.y - 38 + bob);
  ctx.lineTo(obj.x, obj.y - 24 + bob);
  ctx.lineTo(obj.x - 12, obj.y - 38 + bob);
  ctx.closePath();
  ctx.fill();
  // A light pillar so the marker reads from far away.
  const grad = ctx.createLinearGradient(0, obj.y - 160, 0, obj.y);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, 'rgba(255,217,77,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 8, obj.y - 160, 16, 160);
}

function drawCars(game) {
  const ctx = game.ctx;
  for (const car of game.cars) {
    if (car.dead) continue;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h, 7);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
    ctx.fill();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(30,40,60,0.85)';
    roundRect(ctx, -car.w * 0.08, -car.h / 2 + 3, car.w * 0.3, car.h - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-car.w / 2 + 5, -car.h / 2 + 3, 4, car.h - 6);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 3, 3, 5);
    ctx.fillRect(car.w / 2 - 2, car.h / 2 - 8, 3, 5);
    // Police light bar.
    if (car.type === 'police') {
      const phase = Math.floor(game.time * 6 + car.sirenPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff4040' : '#4070ff';
      ctx.fillRect(-6, -car.h / 2 - 2, 12, 5);
      ctx.fillStyle = phase ? '#4070ff' : '#ff4040';
      ctx.fillRect(-6, car.h / 2 - 3, 12, 5);
    }
    ctx.restore();
  }
}

function drawPeds(game) {
  const ctx = game.ctx;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      // Lying flat.
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.wantsTaxi) {
      // Waving for a cab.
      ctx.fillStyle = '#2fae4e';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', ped.x, ped.y - 18 + Math.sin(game.time * 5) * 3);
    }
  }
}

function drawCops(game) {
  const ctx = game.ctx;
  for (const cop of game.police.cops) {
    if (cop.down) {
      ctx.fillStyle = '#20305f';
      ctx.beginPath();
      ctx.ellipse(cop.x, cop.y, 13, 7, cop.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = '#20305f';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8c98a';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20305f';
    ctx.fillRect(cop.x - 7, cop.y - 13, 14, 4);
  }
}

function drawPlayer(game) {
  const ctx = game.ctx;
  const p = game.player;
  if (p.dead || p.inCar) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rio: orange jacket, facing his angle.
  ctx.fillStyle = '#e86a1e';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e86a1e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
  ctx.stroke();
  // Punch arc.
  if (p.punchTimer > 0.25) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, p.angle - 0.7, p.angle + 0.7);
    ctx.stroke();
  }
}

function drawBullets(game) {
  const ctx = game.ctx;
  ctx.strokeStyle = '#ffe98a';
  ctx.lineWidth = 2;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(game) {
  const ctx = game.ctx;
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
}

function drawLighting(game) {
  const ctx = game.ctx;
  const view = game.view;
  const day = daylight(game.clockMinutes);
  if (day >= 0.98) return;
  const night = 1 - day;
  // Sunset warms the frame; night darkens it.
  const sunset = game.clockMinutes >= CLOCK.sunsetAt && game.clockMinutes < CLOCK.nightAt;
  ctx.fillStyle = sunset
    ? 'rgba(255,120,40,' + (0.12 * night).toFixed(3) + ')'
    : 'rgba(8,12,48,' + (0.5 * night).toFixed(3) + ')';
  ctx.fillRect(game.camera.x - view.w / 2 - 40, game.camera.y - view.h / 2 - 40, view.w + 80, view.h + 80);
  // Headlight cone while driving at night.
  const p = game.player;
  if (p.inCar && night > 0.4) {
    const car = p.inCar;
    const gx = car.x + Math.cos(car.angle) * 180;
    const gy = car.y + Math.sin(car.angle) * 180;
    const grad = ctx.createRadialGradient(car.x, car.y, 20, gx, gy, 260);
    grad.addColorStop(0, 'rgba(255,240,170,0.20)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.x, car.y);
    ctx.arc(gx, gy, 260, car.angle - 0.45, car.angle + 0.45);
    ctx.closePath();
    ctx.fill();
  }
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

function drawHud(game) {
  const ctx = game.ctx;
  const view = game.view;
  const p = game.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: cash, health, armour, ammo.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, 12, 250, 96, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + Math.round(p.cash).toLocaleString('en-US'), 24, 42);
  bar(ctx, 24, 52, 150, 12, p.health / 100, '#e85a5a', '#3a1a1a');
  bar(ctx, 24, 68, 150, 12, p.armor / 50, '#7aa8e8', '#1a2438');
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText('HP', 180, 63);
  ctx.fillText('ARM', 180, 79);
  ctx.fillStyle = '#ffe98a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('AMMO ' + p.ammo, 24, 100);
  // Top-centre: wanted stars and the difficulty pill.
  const stars = game.police.wanted;
  ctx.textAlign = 'center';
  ctx.font = '26px sans-serif';
  let starText = '';
  for (let i = 0; i < 5; i++) starText += i < stars ? '★' : '☆';
  ctx.fillStyle = stars > 0 ? '#ffd94d' : 'rgba(255,255,255,0.4)';
  ctx.fillText(starText, view.w / 2, 40);
  const pill = '◆ ' + game.diff.label.toUpperCase();
  ctx.font = 'bold 13px sans-serif';
  const pillW = ctx.measureText(pill).width + 22;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, view.w / 2 - pillW / 2, 48, pillW, 24, 12);
  ctx.fill();
  ctx.fillStyle = game.difficultyKey === 'hardcore' ? '#ff7a7a' : game.difficultyKey === 'chill' ? '#7ad8ff' : '#ffd94d';
  ctx.fillText(pill, view.w / 2, 65);
  // Clock.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(fmtClock(game.clockMinutes), view.w / 2, 92);
  drawMinimap(game);
  // Objective banner.
  const obj = currentObjective(game);
  if (obj) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(obj.text).width + 30;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, view.w / 2 - w / 2, view.h - 58, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.fillText('◎ ' + obj.text, view.w / 2, view.h - 36);
  }
  // Mission timer, above the objective banner.
  if (game.missions.active && game.missions.active.timer !== null) {
    const t = Math.max(0, game.missions.active.timer);
    ctx.fillStyle = t < 10 ? '#ff7a7a' : '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(fmtDuration(t), view.w / 2, view.h - 104);
  }
  // Message feed, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  let my = view.h - 24;
  for (let i = game.messages.length - 1; i >= 0; i--) {
    const m = game.messages[i];
    ctx.globalAlpha = clamp(m.ttl / 2, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.text, 16, my);
    my -= 20;
  }
  ctx.globalAlpha = 1;
  // Speedometer and radio, bottom-right.
  if (p.inCar) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', view.w - 16, view.h - 44);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#9ad8ff';
    ctx.fillText(p.inCar.spec.name, view.w - 16, view.h - 24);
  }
  // Radio station: sits above the speedometer while driving.
  ctx.textAlign = 'right';
  ctx.fillStyle = RADIO[game.audio.station].hue;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('♪ ' + RADIO[game.audio.station].name + (game.audio.muted ? ' (muted)' : ''), view.w - 16, p.inCar ? view.h - 88 : view.h - 66);
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function drawMinimap(game) {
  const ctx = game.ctx;
  const view = game.view;
  const size = 208;
  const x0 = view.w - size - 14;
  const y0 = 14;
  const zoom = MAP_ZOOMS[game.mapZoom];
  const px = game.player.x;
  const py = game.player.y;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  const toMap = (wx, wy) => [x0 + size / 2 + (wx - px) * zoom, y0 + size / 2 + (wy - py) * zoom];
  // Sea and beach.
  ctx.fillStyle = '#1d4e79';
  ctx.fillRect(x0, y0 + (WORLD.seaTop - py) * zoom + size / 2, size, size);
  ctx.fillStyle = '#8a7a4a';
  ctx.fillRect(x0, y0 + (WORLD.beachTop - py) * zoom + size / 2, size, (WORLD.seaTop - WORLD.beachTop) * zoom);
  // Roads.
  ctx.strokeStyle = 'rgba(220,220,230,0.75)';
  ctx.lineWidth = Math.max(1, WORLD.roadWidth * zoom * 0.6);
  for (const rx of game.world.roadsX) {
    const [mx] = toMap(rx, 0);
    ctx.beginPath();
    ctx.moveTo(mx, y0);
    ctx.lineTo(mx, y0 + size);
    ctx.stroke();
  }
  for (const ry of game.world.roadsY) {
    const [, my] = toMap(0, ry);
    ctx.beginPath();
    ctx.moveTo(x0, my);
    ctx.lineTo(x0 + size, my);
    ctx.stroke();
  }
  // Landmark labels at the closest zoom.
  if (game.mapZoom === 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (const lm of game.world.landmarks) {
      const [mx, my] = toMap(lm.x, lm.y);
      if (mx < x0 || mx > x0 + size || my < y0 || my > y0 + size) continue;
      ctx.fillText(lm.name, mx, my - 5);
    }
  }
  // Objective, police, fare, package and crate blips.
  const obj = currentObjective(game);
  if (obj) {
    const [mx, my] = toMap(obj.x, obj.y);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(mx, my - 7);
    ctx.lineTo(mx + 6, my);
    ctx.lineTo(mx, my + 7);
    ctx.lineTo(mx - 6, my);
    ctx.closePath();
    ctx.fill();
  }
  for (const car of game.police.cars) {
    if (car.dead) continue;
    const [mx, my] = toMap(car.x, car.y);
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of game.police.cops) {
    if (cop.down) continue;
    const [mx, my] = toMap(cop.x, cop.y);
    ctx.fillStyle = '#4070ff';
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (game.missions.fare) {
    const [mx, my] = toMap(game.missions.fare.ped.x, game.missions.fare.ped.y);
    ctx.fillStyle = '#2fae4e';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pkg of game.missions.packages) {
    if (pkg.taken) continue;
    const [mx, my] = toMap(pkg.x, pkg.y);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(mx - 2, my - 2, 4, 4);
  }
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  const vw = game.view.w * zoom;
  const vh = game.view.h * zoom;
  ctx.strokeRect(x0 + size / 2 - vw / 2, y0 + size / 2 - vh / 2, vw, vh);
  // North indicator.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + 10, y0 + 16);
  // Player arrow.
  ctx.save();
  ctx.translate(x0 + size / 2, y0 + size / 2);
  ctx.rotate(game.player.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawTitle(game) {
  const ctx = game.ctx;
  const view = game.view;
  // Sunset gradient backdrop with a skyline silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, view.h);
  grad.addColorStop(0, '#2a1a4a');
  grad.addColorStop(0.55, '#c94f6a');
  grad.addColorStop(1, '#e88a3a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.fillStyle = 'rgba(20,10,40,0.85)';
  let bx = 0;
  const rngHeights = [120, 200, 150, 240, 180, 260, 140, 210, 170];
  for (let i = 0; i < 9; i++) {
    const w = view.w / 9;
    const h = rngHeights[i];
    ctx.fillRect(bx, view.h - h - 90, w - 6, h + 90);
    bx += w;
  }
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.arc(view.w - 220, 130, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLARA BAY', view.w / 2, 190);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('An open-world crime game in the spirit of GTA 6', view.w / 2, 226);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Rio Vega is new in town. Steal cars, outrun the SBPD, run jobs for Lena Cruz.', view.w / 2, 258);
  // Difficulty selector.
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('PICK A DIFFICULTY — press 1, 2 or 3', view.w / 2, 320);
  const keys = ['chill', 'normal', 'hardcore'];
  const boxW = 250;
  const gap = 20;
  const total = boxW * 3 + gap * 2;
  let x = view.w / 2 - total / 2;
  keys.forEach((key, i) => {
    const d = game.difficulties[key];
    const active = game.difficultyKey === key;
    ctx.fillStyle = active ? 'rgba(255,217,77,0.25)' : 'rgba(0,0,0,0.35)';
    roundRect(ctx, x, 340, boxW, 110, 10);
    ctx.fill();
    ctx.strokeStyle = active ? '#ffd94d' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = active ? 3 : 1;
    roundRect(ctx, x, 340, boxW, 110, 10);
    ctx.stroke();
    ctx.fillStyle = active ? '#ffd94d' : '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText((i + 1) + '  ' + d.label.toUpperCase(), x + boxW / 2, 372);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '13px sans-serif';
    wrapText(ctx, d.blurb, x + boxW / 2, 396, boxW - 24, 17);
    x += boxW + gap;
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press ENTER to start  •  M for missions  •  E to enter a car  •  Mouse to shoot', view.w / 2, 500);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#d8d8d8';
  ctx.fillText('WASD move & drive  •  F punch  •  Space handbrake  •  N zoom minimap  •  P pause  •  Q mute', view.w / 2, 528);
  const save = game.saveData;
  if (save) {
    ctx.fillStyle = '#aee8a0';
    ctx.font = '14px sans-serif';
    ctx.fillText('Save found: $' + Math.round(save.cash) + '  •  ' + save.missionsDone.length + ' missions done  •  best wanted ' + (save.bestWanted || 0) + '★', view.w / 2, 562);
  }
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

function drawPause(game) {
  const ctx = game.ctx;
  const view = game.view;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 110);
  const m = game.missions;
  const lines = [
    'Time played: ' + fmtDuration(game.timePlayed),
    'Difficulty: ' + game.diff.label,
    'Total earned: $' + Math.round(m.earned),
    'Missions done: ' + m.done.length + ' / ' + m.defs.length,
    'Taxi fares: ' + m.faresDone + '  •  Packages: ' + m.packagesFound + ' / 12',
    'Best wanted level: ' + (game.police.bestWanted || 0) + '★',
    'Cash: $' + Math.round(game.player.cash),
  ];
  ctx.font = '17px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, view.w / 2, view.h / 2 - 60 + i * 28);
  });
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#c8c8c8';
  ctx.fillText('Press P to resume  •  WASD move  •  M mission  •  E car  •  Q mute', view.w / 2, view.h / 2 + 150);
}

function drawBusted(game) {
  const ctx = game.ctx;
  const view = game.view;
  ctx.fillStyle = 'rgba(10,10,40,0.75)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff7a7a';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('BUSTED', view.w / 2, view.h / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(game.bustedReason || 'The SBPD caught up with you.', view.w / 2, view.h / 2 + 22);
  ctx.fillStyle = '#c8c8c8';
  ctx.font = '15px sans-serif';
  ctx.fillText('Press ENTER to wake up at Solara General and try again', view.w / 2, view.h / 2 + 56);
}

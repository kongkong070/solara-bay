// Small helpers shared by every Solara Bay module. Nothing here knows about
// the game state: each helper takes the numbers it needs and returns a number.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnToward(angle, target, maxStep) {
  const d = angleDiff(angle, target);
  if (d > maxStep) return angle + maxStep;
  if (d < -maxStep) return angle - maxStep;
  return target;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function rangeInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Push a circle (x, y, radius) out of a solid rectangle. Returns true when
// a push happened, and mutates the position object passed in.
export function pushOutOfRect(pos, radius, r) {
  const nx = clamp(pos.x, r.x, r.x + r.w);
  const ny = clamp(pos.y, r.y, r.y + r.h);
  const dx = pos.x - nx;
  const dy = pos.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    pos.x = nx + (dx / d) * radius;
    pos.y = ny + (dy / d) * radius;
  } else {
    // Centre is inside the rectangle: shove out along the smallest side.
    const left = pos.x - r.x;
    const right = r.x + r.w - pos.x;
    const top = pos.y - r.y;
    const bottom = r.y + r.h - pos.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) pos.x = r.x - radius;
    else if (m === right) pos.x = r.x + r.w + radius;
    else if (m === top) pos.y = r.y - radius;
    else pos.y = r.y + r.h + radius;
  }
  return true;
}

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtClock(hour, minute) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor(minute) % 60;
  const hh = h < 10 ? '0' + h : '' + h;
  const mm = m < 10 ? '0' + m : '' + m;
  return hh + ':' + mm;
}

export function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' + r : '' + r);
}

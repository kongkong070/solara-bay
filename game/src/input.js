// Keyboard and mouse input. The game reads `keys` and `mouse` each frame;
// the shot stager feeds the same shape from its autopilot.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // Edge-triggered presses, recorded at event time so a quick tap is never
    // lost between animation frames. game.edge() consumes one entry.
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    anyKey: false,
    wheelY: 0, // accumulated mouse-wheel delta; the game consumes it
    lastKey: '', // most recent key pressed, for hints and the autopilot
  };
  const down = (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!input.keys.has(key)) input.pressed.add(key);
    input.keys.add(key);
    input.anyKey = true;
    input.lastKey = key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  };
  const up = (e) => input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouse.down = true;
    input.mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  // Wheel zooms the minimap (N cycles it too); the game reads wheelY.
  canvas.addEventListener('wheel', (e) => {
    input.wheelY += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  return input;
}

export function keyDown(input, ...names) {
  for (const n of names) if (input.keys.has(n)) return true;
  return false;
}

// Drop every buffered edge press: call it when the game changes state
// (title -> play, play -> pause and back) so a key tapped in one screen
// cannot fire an action in the next one.
export function clearPressed(input) {
  input.pressed.clear();
}

// Edge-triggered key: true once per press, consumed on read. Kept for
// callers that track their own previous set; the game itself uses the
// input.pressed buffer through game.edge().
export function makeEdgeKeys() {
  const prev = new Set();
  return function pressed(input, name) {
    const now = input.keys.has(name);
    const was = prev.has(name);
    if (now) prev.add(name); else prev.delete(name);
    return now && !was;
  };
}

// Keyboard and mouse state for Solara Bay. The game reads held keys every
// frame and consumes pressed keys (edges) once, so a single tap never fires
// twice. Mouse position is tracked in canvas pixels and converted to world
// coordinates by the caller.

export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    pressed: Object.create(null),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    wheel: 0,
    anyKey: false,
  };

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    KeyE: 'enter', KeyF: 'punch', KeyM: 'mission',
    KeyP: 'pause', Escape: 'pause', KeyR: 'reload',
    Space: 'handbrake', ShiftLeft: 'sprint', ShiftRight: 'sprint',
    KeyC: 'radio', KeyN: 'zoom', KeyQ: 'mute',
    Digit1: 'diff1', Digit2: 'diff2', Digit3: 'diff3',
    Enter: 'confirm',
  };

  window.addEventListener('keydown', (ev) => {
    const name = KEYMAP[ev.code];
    if (!name) return;
    if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
    if (!input.keys[name]) input.pressed[name] = true;
    input.keys[name] = true;
    input.anyKey = true;
  });
  window.addEventListener('keyup', (ev) => {
    const name = KEYMAP[ev.code];
    if (name) input.keys[name] = false;
  });
  window.addEventListener('blur', () => {
    input.keys = Object.create(null);
  });

  canvas.addEventListener('mousemove', (ev) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (ev.clientX - r.left) * (canvas.width / r.width);
    input.mouseY = (ev.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0) return;
    input.mouseDown = true;
    input.mouseClicked = true;
    input.anyKey = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    input.wheel += ev.deltaY > 0 ? 1 : -1;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  return input;
}

export function held(input, name) {
  return !!input.keys[name];
}

export function wasPressed(input, name) {
  return !!input.pressed[name];
}

// Call once per frame, after the game has read the edges.
export function endFrame(input) {
  input.pressed = Object.create(null);
  input.mouseClicked = false;
  input.wheel = 0;
  input.anyKey = false;
}

// Movement vector from WASD/arrows, normalised. Returns {x, y, active}.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (held(input, 'left')) x -= 1;
  if (held(input, 'right')) x += 1;
  if (held(input, 'up')) y -= 1;
  if (held(input, 'down')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y, active: x !== 0 || y !== 0 };
}

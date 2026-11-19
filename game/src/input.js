// Keyboard and mouse state for Solara Bay. The game polls `down` every
// frame and consumes `pressed` edges once, so a key tap fires exactly once.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, wheelY: 0 };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    mouse.wheelY += e.deltaY;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    down(code) {
      return keys.has(code);
    },
    // True once after the key goes down; call once per frame per key.
    wasPressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    // True once after a left click; call once per frame.
    wasClicked() {
      if (mouse.clicked) {
        mouse.clicked = false;
        return true;
      }
      return false;
    },
    // Accumulated wheel delta since the last read, then cleared.
    takeWheel() {
      const w = mouse.wheelY;
      mouse.wheelY = 0;
      return w;
    },
    // Movement vector from WASD / arrows, normalised.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    // Drop all edges at the end of a frame so taps never leak across states.
    clearEdges() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}

/** 键盘 + 触屏 + 空闲自动驾驶 */
export function createControls() {
  const keys = new Set();
  const state = {
    throttle: 0, // -1..1
    steer: 0, // -1..1
    jump: false,
    wing: false,
    camSwitch: false,
    soundToggle: false,
    lastInput: 0,
    autopilot: false,
  };

  const keyMap = {
    KeyW: 'up',
    KeyS: 'down',
    ArrowUp: 'up',
    ArrowDown: 'down',
    KeyA: 'left',
    KeyD: 'right',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    Space: 'jump',
    KeyT: 'wing',
    KeyC: 'cam',
    KeyM: 'sound',
  };

  function markInput() {
    state.lastInput = performance.now();
    state.autopilot = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    keys.add(k);
    markInput();
    if (k === 'jump') state.jump = true;
    if (k === 'wing') state.wing = true;
    if (k === 'cam') state.camSwitch = true;
    if (k === 'sound') state.soundToggle = true;
  });

  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (k) keys.delete(k);
  });

  // Touch buttons
  const pressMap = new Map();
  document.querySelectorAll('[data-key]').forEach((btn) => {
    const code = btn.getAttribute('data-key');
    const k = keyMap[code];
    if (!k) return;

    const down = (e) => {
      e.preventDefault();
      btn.classList.add('active');
      keys.add(k);
      markInput();
      if (k === 'jump') state.jump = true;
      if (k === 'wing') state.wing = true;
      if (k === 'cam') state.camSwitch = true;
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('active');
      keys.delete(k);
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
    pressMap.set(btn, k);
  });

  const btnSound = document.getElementById('btn-sound');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      state.soundToggle = true;
      markInput();
    });
  }

  /** 每帧读取 */
  function sample(dt, player, fishNearest) {
    let throttle = 0;
    if (keys.has('up')) throttle += 1;
    if (keys.has('down')) throttle -= 1;
    let steer = 0;
    if (keys.has('left')) steer -= 1;
    if (keys.has('right')) steer += 1;

    const idleMs = performance.now() - state.lastInput;
    if (idleMs > 6000 && fishNearest) {
      state.autopilot = true;
      // drive toward nearest fish x
      const dx = fishNearest.mesh.position.x - player.x;
      steer = Math.sign(dx) * Math.min(Math.abs(dx) / 4, 1);
      throttle = 0.55;
      // auto jump if fish is high and close
      const dz = fishNearest.mesh.position.z - player.z;
      if (dz > -2 && dz < 6 && fishNearest.jumping && fishNearest.mesh.position.y > 1.2) {
        state.jump = true;
      }
    } else if (idleMs > 6000) {
      state.autopilot = true;
      throttle = 0.35;
      // gentle cruise toward center-ish lanes
      steer = -player.x * 0.08;
    }

    const jump = state.jump;
    const wing = state.wing;
    const camSwitch = state.camSwitch;
    const soundToggle = state.soundToggle;
    state.jump = false;
    state.wing = false;
    state.camSwitch = false;
    state.soundToggle = false;

    return {
      throttle,
      steer,
      jump,
      wing,
      camSwitch,
      soundToggle,
      autopilot: state.autopilot,
      wingHeld: keys.has('wing'),
    };
  }

  return { sample, state, keys };
}

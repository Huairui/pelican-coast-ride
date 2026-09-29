import * as THREE from 'three';
import {
  createSky,
  createOcean,
  createRoad,
  createLights,
  updateDayNight,
  createAmbientParticles,
  followPlayer,
  DAY_LENGTH,
} from './world.js';
import { createPelicanRig } from './pelican.js';
import { createFishSystem } from './fish.js';
import { createControls } from './controls.js';
import { createCameraDirector, CAMERA_MODES } from './cameras.js';
import { AudioEngine } from './audio.js';
import { createAchievements, ACHIEVEMENTS } from './achievements.js';
import { createQualityController } from './quality.js';

// ---------- DOM ----------
const canvas = document.getElementById('scene');
const introEl = document.getElementById('intro');
const hudEl = document.getElementById('hud');
const speedVal = document.getElementById('speed-val');
const cadenceVal = document.getElementById('cadence-val');
const fishVal = document.getElementById('fish-val');
const distVal = document.getElementById('dist-val');
const camName = document.getElementById('cam-name');
const achCount = document.getElementById('ach-count');
const achFill = document.getElementById('ach-fill');
const timeLabel = document.getElementById('time-label');
const toastLayer = document.getElementById('toast-layer');
const autoBadge = document.getElementById('autopilot-badge');
const achPanel = document.getElementById('ach-panel');
const achGrid = document.getElementById('ach-grid');
const panelStats = document.getElementById('panel-stats');

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x2a2850, 0.0065);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, 4, -8);

// ---------- World ----------
const sky = createSky();
scene.add(sky.mesh);

const ocean = createOcean();
scene.add(ocean.mesh);

const road = createRoad();
scene.add(road.group);

const lights = createLights();
scene.add(lights.hemi, lights.sun, lights.moon, lights.ambient);

const particles = createAmbientParticles();
scene.add(particles);

// ---------- Player ----------
const rig = createPelicanRig();
scene.add(rig.root);

const fishSys = createFishSystem();
scene.add(fishSys.group);

// ---------- Systems ----------
const controls = createControls();
const cameraDir = createCameraDirector(camera);
const audio = new AudioEngine();
const quality = createQualityController(renderer, scene);
const achievements = createAchievements((def) => showToast(def));

// ---------- Game state ----------
const player = {
  x: 0,
  y: 0,
  z: 0,
  speed: 6,
  targetSpeed: 10,
  maxSpeed: 28,
  minSpeed: 0,
  lean: 0,
  wheelie: 0,
  wingSpread: 0,
  jumpY: 0,
  jumpV: 0,
  grounded: true,
  lookX: 0,
  lookY: 0,
  yaw: 0,
};

const game = {
  started: false,
  dayT: 0.02, // start at dusk
  distance: 0,
  fishCaught: 0,
  lastCatchTime: -999,
  running: true,
};

const LANE_X = [-4.6, -2.3, 0, 2.3, 4.6];
let laneIndex = 2;
let laneCooldown = 0;

// ---------- UI helpers ----------
function showToast(def) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast-icon">${def.icon}</div>
    <div class="toast-body">
      <div class="toast-title">${def.name}</div>
      <div class="toast-desc">${def.desc}</div>
    </div>
  `;
  toastLayer.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 420);
  }, 2400);
  refreshAchUI();
  audio.achievement?.();
}

function refreshAchUI() {
  const p = achievements.progress();
  achCount.textContent = p.unlocked;
  achFill.style.width = `${(p.unlocked / p.total) * 100}%`;
}

function renderAchPanel() {
  achGrid.innerHTML = '';
  const p = achievements.progress();
  for (const a of ACHIEVEMENTS) {
    const unlocked = p.unlockedIds.includes(a.id);
    const card = document.createElement('div');
    card.className = `ach-card ${unlocked ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <div class="icon">${a.icon}</div>
      <div class="name">${a.name}</div>
      <div class="desc">${a.desc}</div>
    `;
    achGrid.appendChild(card);
  }
  panelStats.innerHTML = `
    <div>鱼获<strong>${p.stats.fish}</strong></div>
    <div>最高连击<strong>${p.stats.bestCombo}</strong></div>
    <div>里程<strong>${p.stats.distance.toFixed(2)} km</strong></div>
    <div>最高速度<strong>${p.stats.maxSpeed.toFixed(0)} km/h</strong></div>
    <div>骑行时长<strong>${p.stats.rideTime.toFixed(0)} s</strong></div>
  `;
}

function timeName(t) {
  if (t < 0.15) return '黄昏';
  if (t < 0.32) return '暮色';
  if (t < 0.55) return '星夜';
  if (t < 0.78) return '月夜';
  return '黎明前';
}

// ---------- Input edge handlers ----------
function handleActions(input, dt) {
  if (input.camSwitch) {
    const mode = cameraDir.next();
    camName.textContent = mode.name;
    if (mode.id === 'cinematic') {
      achievements.tick({ camMode: 'cinematic' });
    }
    if (mode.id === 'pov') {
      achievements.tick({ camMode: 'pov' });
    }
    audio.lane?.();
  }

  if (input.soundToggle) {
    audio.setMuted(!audio.muted);
    const btn = document.getElementById('btn-sound');
    if (btn) btn.textContent = audio.muted ? '♪̸' : '♪';
  }

  if (input.jump && player.grounded) {
    player.jumpV = 7.2;
    player.grounded = false;
    audio.jump();
    achievements.tick({ jumped: true });
  }

  if (input.wing || input.wingHeld) {
    player.wingSpread = THREE.MathUtils.lerp(player.wingSpread, 1, 1 - Math.exp(-8 * dt));
    if (input.wing) {
      audio.wing();
      achievements.tick({ wing: true });
    }
  } else {
    player.wingSpread = THREE.MathUtils.lerp(player.wingSpread, 0, 1 - Math.exp(-5 * dt));
  }

  // lane change
  laneCooldown = Math.max(0, laneCooldown - dt);
  if (Math.abs(input.steer) > 0.35 && laneCooldown <= 0) {
    const dir = Math.sign(input.steer);
    const next = THREE.MathUtils.clamp(laneIndex + dir, 0, LANE_X.length - 1);
    if (next !== laneIndex) {
      laneIndex = next;
      laneCooldown = 0.22;
      achievements.tick({ laneChanged: true });
      audio.lane();
    }
  }
}

// ---------- Physics step ----------
function stepPlayer(dt, input) {
  // throttle
  const accel = 9.5;
  const brake = 12;
  if (input.throttle > 0) {
    player.targetSpeed = Math.min(player.maxSpeed, player.targetSpeed + accel * dt * input.throttle);
  } else if (input.throttle < 0) {
    player.targetSpeed = Math.max(player.minSpeed, player.targetSpeed + brake * dt * input.throttle);
  } else if (input.autopilot) {
    // already set via throttle
  } else {
    // coast drag
    player.targetSpeed = Math.max(4, player.targetSpeed - 1.2 * dt);
  }

  // wing wheelie
  const targetWheelie = player.wingSpread * 0.55 + (player.speed > 18 ? 0.05 : 0);
  player.wheelie = THREE.MathUtils.lerp(player.wheelie, targetWheelie, 1 - Math.exp(-4 * dt));

  // jump physics
  if (!player.grounded) {
    player.jumpV -= 18 * dt;
    player.jumpY += player.jumpV * dt;
    if (player.jumpY <= 0) {
      player.jumpY = 0;
      player.jumpV = 0;
      player.grounded = true;
    }
  }

  // speed smoothing
  player.speed = THREE.MathUtils.lerp(player.speed, player.targetSpeed, 1 - Math.exp(-2.2 * dt));

  // lateral move toward lane
  const targetX = LANE_X[laneIndex];
  const prevX = player.x;
  player.x = THREE.MathUtils.lerp(player.x, targetX, 1 - Math.exp(-6 * dt));
  const lateral = (player.x - prevX) / Math.max(dt, 1e-4);
  player.lean = THREE.MathUtils.clamp(-lateral * 0.045, -0.45, 0.45);

  // move forward
  player.z += player.speed * dt * 0.55;
  game.distance += player.speed * dt * 0.55 / 1000;

  // look
  player.lookX = THREE.MathUtils.lerp(player.lookX, input.steer, 1 - Math.exp(-4 * dt));
  player.lookY = THREE.MathUtils.lerp(player.lookY, input.throttle * 0.5, 1 - Math.exp(-3 * dt));

  // cadence from speed (rpm-ish)
  return player.speed * 3.2 + player.wingSpread * 8;
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let catchCooldown = 0;

// ---------- Catch sparkle ----------
const sparks = [];
function spawnCatchSpark(pos) {
  const geo = new THREE.SphereGeometry(0.12, 6, 5);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0.95,
  });
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.copy(pos);
    m.userData.v = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      Math.random() * 3.5,
      (Math.random() - 0.5) * 4
    );
    m.userData.life = 0.7;
    scene.add(m);
    sparks.push(m);
  }
}

function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.userData.life -= dt;
    s.position.addScaledVector(s.userData.v, dt);
    s.userData.v.y -= 8 * dt;
    s.material.opacity = Math.max(0, s.userData.life / 0.7);
    if (s.userData.life <= 0) {
      scene.remove(s);
      sparks.splice(i, 1);
    }
  }
}

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Start ----------
async function startGame() {
  await audio.start();
  game.started = true;
  introEl.classList.add('gone');
  hudEl.classList.remove('hidden');
  camName.textContent = cameraDir.getMode().name;
  refreshAchUI();
  achievements.tick({ started: true });
  player.targetSpeed = 12;
}

document.getElementById('btn-start')?.addEventListener('click', () => {
  startGame();
});

document.getElementById('btn-cam')?.addEventListener('click', () => {
  const mode = cameraDir.next();
  camName.textContent = mode.name;
  if (mode.id === 'cinematic') achievements.tick({ camMode: 'cinematic' });
  if (mode.id === 'pov') achievements.tick({ camMode: 'pov' });
});

// Achievement panel open via long-press on progress or keyboard E
document.querySelector('.ach-progress')?.addEventListener('click', () => {
  renderAchPanel();
  achPanel.classList.remove('hidden');
});
document.getElementById('btn-close-ach')?.addEventListener('click', () => {
  achPanel.classList.add('hidden');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') achPanel.classList.add('hidden');
  if (e.code === 'KeyE') {
    renderAchPanel();
    achPanel.classList.remove('hidden');
  }
});

// ---------- Render loop ----------
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!game.running) return;

  game.dayT = (game.dayT + dt / DAY_LENGTH) % 1;
  const dayEnv = updateDayNight({ sky, ocean, lights, lamps: road.lamps }, game.dayT);
  scene.fog.color.copy(dayEnv.fogColor);
  sky.uniforms.uTime.value += dt;
  ocean.uniforms.uTime.value += dt;

  // infinite road: world scrolls with player
  followPlayer(road.group, ocean.mesh, player.z);
  sky.mesh.position.set(player.x * 0.3, 0, player.z);

  const nearest = fishSys.nearestJumping(player.x, player.z);
  const input = controls.sample(dt, player, nearest);
  if (game.started) handleActions(input, dt);
  const cadence = stepPlayer(dt, {
    ...input,
    throttle: game.started ? input.throttle : 0,
  });

  rig.root.position.x = player.x;
  rig.root.position.z = player.z;
  rig.update(dt, {
    speed: player.speed,
    lean: player.lean,
    wingSpread: player.wingSpread,
    wheelie: player.wheelie,
    jumpY: player.jumpY,
    lookX: player.lookX,
    lookY: player.lookY,
  });

  fishSys.update(dt, player.z, player.x, game.dayT);
  catchCooldown = Math.max(0, catchCooldown - dt);
  if (game.started && catchCooldown <= 0) {
    const result = fishSys.tryCatch(player.x, player.z, player.jumpY);
    if (result.ok) {
      catchCooldown = 0.35;
      game.fishCaught += 1;
      fishVal.textContent = game.fishCaught;
      audio.catchFish();
      achievements.tick({
        fishCaught: true,
        autopilot: input.autopilot,
        speed: player.speed,
      });
      spawnCatchSpark(result.fish.mesh.position);
    }
  }

  if (game.started) {
    achievements.tick({ speed: player.speed, dayT: game.dayT, dt });
  }

  particles.rotation.y += dt * 0.01;
  particles.position.z = player.z * 0.35;
  updateSparks(dt);

  if (audio.ready) audio.update(dt, player.speed, cadence, dayEnv.nightMix);

  cameraDir.update(
    dt,
    {
      pos: new THREE.Vector3(player.x, 0.2 + player.jumpY, player.z),
      lean: player.lean,
      lookX: player.lookX,
      lookY: player.lookY,
      yaw: 0,
    },
    player.speed,
    dayEnv.nightMix
  );

  if (game.started) {
    speedVal.textContent = Math.round(player.speed * 1.15);
    cadenceVal.textContent = Math.round(cadence);
    distVal.textContent = game.distance.toFixed(2);
    timeLabel.textContent = timeName(game.dayT);
    autoBadge.classList.toggle('hidden', !input.autopilot);
    achievements.stats.distance = game.distance;
    achievements.stats.maxSpeed = Math.max(
      achievements.stats.maxSpeed,
      player.speed * 1.15
    );
  }

  quality.update(dt);

  // keep HUD camera label in sync
  const modeNow = cameraDir.getMode();
  if (camName && camName.textContent !== modeNow.name) {
    camName.textContent = modeNow.name;
  }

  renderer.render(scene, camera);
}

frame();

// Expose for debugging
window.__pelican = { player, game, cameraDir, achievements, audio };

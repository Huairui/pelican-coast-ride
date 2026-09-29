import * as THREE from 'three';

export const CAMERA_MODES = [
  { id: 'chase', name: '追尾跟随', fov: 58 },
  { id: 'side', name: '侧面跟拍', fov: 50 },
  { id: 'cinematic', name: '电影运镜', fov: 42 },
  { id: 'pov', name: '鹈鹕视角', fov: 72 },
  { id: 'aerial', name: '高空俯瞰', fov: 48 },
];

export function createCameraDirector(camera) {
  let modeIndex = 0;
  let modeT = 0;
  const currentPos = new THREE.Vector3(0, 4, -8);
  const currentLook = new THREE.Vector3(0, 1.5, 0);
  const targetPos = new THREE.Vector3();
  const targetLook = new THREE.Vector3();
  let shake = 0;

  function next() {
    modeIndex = (modeIndex + 1) % CAMERA_MODES.length;
    modeT = 0;
    return CAMERA_MODES[modeIndex];
  }

  function set(i) {
    modeIndex = i % CAMERA_MODES.length;
    modeT = 0;
    return CAMERA_MODES[modeIndex];
  }

  function getMode() {
    return CAMERA_MODES[modeIndex];
  }

  function update(dt, player, speed, nightMix) {
    const mode = CAMERA_MODES[modeIndex];
    modeT += dt;
    const p = player.pos;
    const yaw = player.yaw || 0;

    // base offset in player local space
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    switch (mode.id) {
      case 'chase': {
        targetPos.copy(p)
          .addScaledVector(forward, -5.2 - speed * 0.05)
          .addScaledVector(right, player.lean * 1.6)
          .add(new THREE.Vector3(0, 2.15 + speed * 0.02, 0));
        targetLook.copy(p).addScaledVector(forward, 3.2).add(new THREE.Vector3(0, 1.35, 0));
        break;
      }
      case 'side': {
        const side = Math.sin(modeT * 0.15) > 0 ? 1 : -1;
        targetPos.copy(p)
          .addScaledVector(right, 6.2 * side)
          .addScaledVector(forward, -1.2)
          .add(new THREE.Vector3(0, 1.85, 0));
        targetLook.copy(p).add(new THREE.Vector3(0, 1.25, 0)).addScaledVector(forward, 1.5);
        break;
      }
      case 'cinematic': {
        // orbit + dolly mix
        const ang = modeT * 0.22;
        const radius = 9 + Math.sin(modeT * 0.18) * 2.5;
        targetPos.copy(p)
          .addScaledVector(right, Math.cos(ang) * radius)
          .addScaledVector(forward, Math.sin(ang) * radius * 0.7 - 2)
          .add(new THREE.Vector3(0, 2.0 + Math.sin(modeT * 0.3) * 1.2, 0));
        targetLook.copy(p).add(new THREE.Vector3(0, 1.5 + Math.sin(modeT * 0.2) * 0.3, 0));
        break;
      }
      case 'pov': {
        targetPos.copy(p)
          .addScaledVector(forward, 0.55)
          .add(new THREE.Vector3(0, 2.35, 0))
          .addScaledVector(right, player.lean * 0.35);
        targetLook.copy(p)
          .addScaledVector(forward, 10)
          .add(new THREE.Vector3(0, 1.9 + player.lookY * 1.5, 0))
          .addScaledVector(right, player.lookX * 2);
        break;
      }
      case 'aerial': {
        targetPos.copy(p)
          .addScaledVector(forward, -4)
          .add(new THREE.Vector3(0, 16 + Math.sin(modeT * 0.1) * 2, -2));
        targetLook.copy(p).addScaledVector(forward, 6);
        break;
      }
    }

    // cinematic FOV breathing
    const targetFov = mode.fov + Math.sin(modeT * 0.4) * (mode.id === 'cinematic' ? 6 : 1.5) + Math.min(speed * 0.25, 4);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();

    const lerpPos = 1 - Math.exp(-(mode.id === 'pov' ? 12 : 3.2) * dt);
    currentPos.lerp(targetPos, lerpPos);
    currentLook.lerp(targetLook, 1 - Math.exp(-4.5 * dt));

    // speed shake
    shake = THREE.MathUtils.lerp(shake, Math.min(speed * 0.012, 0.08), 1 - Math.exp(-2 * dt));
    const sh = shake;
    camera.position.copy(currentPos).add(
      new THREE.Vector3(
        (Math.random() - 0.5) * sh,
        (Math.random() - 0.5) * sh * 0.6,
        (Math.random() - 0.5) * sh
      )
    );
    camera.lookAt(currentLook);

    // night slight FOV tighten
    if (nightMix > 0.6 && mode.id !== 'pov') {
      camera.fov += 1;
      camera.updateProjectionMatrix();
    }
  }

  return { next, set, getMode, update, modeIndex: () => modeIndex };
}

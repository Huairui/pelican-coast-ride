import * as THREE from 'three';

/** 海鱼：沿岸游动，周期性跃出水面供抓取 */
export function createFishSystem() {
  const group = new THREE.Group();
  const fishList = [];
  const COUNT = 18;

  const fishMat = new THREE.MeshStandardMaterial({
    color: 0x7fd1c8,
    roughness: 0.45,
    metalness: 0.15,
    flatShading: true,
  });
  const fishMatAlt = new THREE.MeshStandardMaterial({
    color: 0xffb17a,
    roughness: 0.5,
    metalness: 0.1,
    flatShading: true,
  });

  function makeFish() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.45, 4, 8),
      Math.random() > 0.5 ? fishMat : fishMatAlt
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    g.add(body);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.28, 5), body.material);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.42;
    g.add(tail);

    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), body.material);
    fin.position.set(0, 0.18, 0.05);
    g.add(fin);

    return g;
  }

  for (let i = 0; i < COUNT; i++) {
    const mesh = makeFish();
    const fish = {
      mesh,
      baseX: -12 - Math.random() * 30, // ocean side only (-x)
      z: -Math.random() * 180 - 5,
      speed: 6 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      jumpTimer: Math.random() * 12 + 4,
      jumping: false,
      jumpT: 0,
      jumpDur: 1.2,
      caught: false,
      size: 0.75 + Math.random() * 0.55,
    };
    mesh.scale.setScalar(fish.size);
    mesh.position.set(fish.baseX, -0.4, fish.z);
    group.add(mesh);
    fishList.push(fish);
  }

  const splashGeo = new THREE.SphereGeometry(0.12, 6, 4);
  const splashMat = new THREE.MeshBasicMaterial({
    color: 0xb8f0ea,
    transparent: true,
    opacity: 0.7,
  });

  function update(dt, playerZ, playerX, dayT) {
    const nightBoost = 1 + (dayT > 0.3 && dayT < 0.75 ? 0.25 : 0);
    for (const f of fishList) {
      if (f.caught) {
        f.mesh.visible = false;
        continue;
      }

      f.z += f.speed * dt * nightBoost;
      // recycle
      if (f.z > playerZ + 40) {
        f.z = playerZ - 160 - Math.random() * 40;
        f.baseX = -12 - Math.random() * 30;
        f.caught = false;
        f.jumping = false;
        f.jumpT = 0;
        f.jumpTimer = Math.random() * 10 + 3;
        f.mesh.visible = true;
      }

      f.jumpTimer -= dt;
      if (!f.jumping && f.jumpTimer <= 0 && f.z > playerZ - 80 && f.z < playerZ + 20) {
        f.jumping = true;
        f.jumpT = 0;
      }

      const sway = Math.sin(performance.now() * 0.002 + f.phase) * 1.8;
      let y = -0.35 + Math.sin(performance.now() * 0.003 + f.phase) * 0.15;

      if (f.jumping) {
        f.jumpT += dt;
        const t = Math.min(f.jumpT / f.jumpDur, 1);
        const hop = Math.sin(t * Math.PI);
        y = -0.2 + hop * 2.4;
        f.mesh.rotation.x = -hop * 0.9;
        if (t >= 1) {
          f.jumping = false;
          f.jumpTimer = Math.random() * 9 + 4;
          f.mesh.rotation.x = 0;
        }
      }

      f.mesh.position.set(f.baseX + sway, y, f.z);
      f.mesh.rotation.y = sway * 0.15;
      f.mesh.rotation.z = Math.sin(performance.now() * 0.004 + f.phase) * 0.25;
    }
    return fishList;
  }

  /** 尝试抓鱼：返回是否抓到 */
  function tryCatch(playerX, playerZ, playerY = 0) {
    for (const f of fishList) {
      if (f.caught || !f.jumping) continue;
      const dx = f.mesh.position.x - playerX;
      const dz = f.mesh.position.z - playerZ;
      const dy = f.mesh.position.y - (0.8 + playerY);
      if (Math.abs(dx) < 3.2 && Math.abs(dz) < 2.8 && dy > -1.2 && dy < 2.2) {
        f.caught = true;
        f.mesh.visible = false;
        return { ok: true, fish: f };
      }
    }
    return { ok: false };
  }

  function nearestJumping(playerX, playerZ) {
    let best = null;
    let bestD = Infinity;
    for (const f of fishList) {
      if (f.caught) continue;
      const dx = f.mesh.position.x - playerX;
      const dz = f.mesh.position.z - playerZ;
      if (dz < -5 || dz > 35) continue;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  return { group, fishList, update, tryCatch, nearestJumping };
}

import * as THREE from 'three';

/**
 * 程序化鹈鹕 + 自行车 + Verlet 布料围巾
 */
export function createPelicanRig() {
  const root = new THREE.Group();
  root.scale.setScalar(1.22);

  // ---------- Materials ----------
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf3efe6,
    roughness: 0.78,
    metalness: 0.02,
    flatShading: true,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xe7e0d2,
    roughness: 0.82,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: 0xf4a261,
    roughness: 0.55,
    metalness: 0.05,
    flatShading: true,
  });
  const pouchMat = new THREE.MeshStandardMaterial({
    color: 0xffb17a,
    roughness: 0.6,
    flatShading: true,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0xf4a261,
    roughness: 0.35,
    metalness: 0.25,
    flatShading: true,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1b1b2e,
    roughness: 0.4,
    metalness: 0.2,
    flatShading: true,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x14213d,
    roughness: 0.15,
    metalness: 0.7,
    flatShading: true,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    roughness: 0.72,
    metalness: 0.0,
    side: THREE.DoubleSide,
    flatShading: true,
    emissive: 0xe63946,
    emissiveIntensity: 0.12,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x8a8f9a,
    roughness: 0.35,
    metalness: 0.75,
    flatShading: true,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x22222c,
    roughness: 0.9,
    flatShading: true,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd8dde8,
    roughness: 0.3,
    metalness: 0.8,
    flatShading: true,
  });

  // ---------- Bicycle ----------
  const bike = new THREE.Group();
  bike.position.y = 0.55;

  const wheelGeo = new THREE.TorusGeometry(0.62, 0.1, 10, 24);
  const spokeGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.15, 4);

  function makeWheel() {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    w.add(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 6, 20), rimMat);
    w.add(rim);
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.rotation.z = (i / 8) * Math.PI;
      w.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8), metalMat);
    hub.rotation.x = Math.PI / 2;
    w.add(hub);
    return w;
  }

  const frontWheel = makeWheel();
  frontWheel.position.set(0, 0, 1.15);
  bike.add(frontWheel);

  const rearWheel = makeWheel();
  rearWheel.position.set(0, 0, -1.05);
  bike.add(rearWheel);

  // Frame tubes
  function tube(a, b, r = 0.05, mat = metalMat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.castShadow = true;
    return mesh;
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // main triangle
  bike.add(tube(V(0, 0.15, -1.05), V(0, 0.95, -0.15), 0.055)); // seat tube-ish
  bike.add(tube(V(0, 0.15, -1.05), V(0, 0.2, 1.15), 0.05)); // chainstay / down
  bike.add(tube(V(0, 0.95, -0.15), V(0, 0.2, 1.15), 0.05)); // top
  bike.add(tube(V(0, 0.95, -0.15), V(0, 1.05, -0.85), 0.045)); // seat post
  bike.add(tube(V(0, 0.2, 1.15), V(0, 1.15, 1.25), 0.05)); // fork
  bike.add(tube(V(0, 1.15, 1.25), V(0, 1.25, 1.35), 0.04)); // stem

  // handlebars
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6), metalMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.25, 1.35);
  bike.add(bar);
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), darkMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(side * 0.38, 1.25, 1.35);
    bike.add(grip);
  }

  // saddle (kept clear of pelican torso)
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.42), darkMat);
  saddle.position.set(0, 1.05, -0.95);
  saddle.castShadow = true;
  bike.add(saddle);

  // crank + pedals
  const crank = new THREE.Group();
  crank.position.set(0, 0.35, -0.1);
  const crankArmL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.7), metalMat);
  crankArmL.position.z = 0.35;
  crank.add(crankArmL);
  const crankArmR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.7), metalMat);
  crankArmR.position.z = -0.35;
  crank.add(crankArmR);
  const pedalGeo = new THREE.BoxGeometry(0.22, 0.04, 0.12);
  const pedalL = new THREE.Mesh(pedalGeo, darkMat);
  pedalL.position.set(0.12, 0, 0.7);
  crank.add(pedalL);
  const pedalR = new THREE.Mesh(pedalGeo, darkMat);
  pedalR.position.set(-0.12, 0, -0.7);
  crank.add(pedalR);
  bike.add(crank);

  // chain ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 16), metalMat);
  ring.position.set(0.08, 0.35, -0.1);
  ring.rotation.y = Math.PI / 2;
  bike.add(ring);

  root.add(bike);

  // ---------- Pelican body ----------
  const pelican = new THREE.Group();
  pelican.position.set(0, 1.72, -0.05);

  // torso
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), bodyMat);
  torso.scale.set(1.02, 1.12, 1.28);
  torso.castShadow = true;
  pelican.add(torso);

  // belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 8), bodyMat);
  belly.position.set(0, -0.25, 0.15);
  belly.scale.set(1, 0.9, 1.1);
  pelican.add(belly);

  // neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 0.55, 8), bodyMat);
  neck.position.set(0, 0.55, 0.35);
  neck.rotation.x = -0.35;
  neck.castShadow = true;
  pelican.add(neck);

  // head
  const head = new THREE.Group();
  head.position.set(0, 0.95, 0.55);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), bodyMat);
  skull.scale.set(1, 0.95, 1.1);
  skull.castShadow = true;
  head.add(skull);

  // beak (long pelican bill)
  const beakUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.7, 4, 8), beakMat);
  beakUpper.rotation.x = Math.PI / 2;
  beakUpper.position.set(0, -0.02, 0.55);
  beakUpper.castShadow = true;
  head.add(beakUpper);

  // pouch
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), pouchMat);
  pouch.scale.set(1, 0.85, 1.6);
  pouch.position.set(0, -0.12, 0.55);
  head.add(pouch);

  // beak tip
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), beakMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, -0.02, 1.0);
  head.add(tip);

  // helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    helmetMat
  );
  helmet.position.set(0, 0.12, -0.02);
  helmet.castShadow = true;
  head.add(helmet);
  // helmet stripe
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI),
    darkMat
  );
  stripe.position.set(0, 0.12, 0);
  stripe.rotation.x = Math.PI / 2;
  head.add(stripe);
  // helmet brim
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 16), helmetMat);
  brim.position.set(0, 0.1, 0);
  brim.rotation.x = Math.PI / 2;
  head.add(brim);

  // sunglasses
  const glasses = new THREE.Group();
  const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), lensMat);
  lensL.position.set(-0.14, 0.05, 0.3);
  glasses.add(lensL);
  const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), lensMat);
  lensR.position.set(0.14, 0.05, 0.3);
  glasses.add(lensR);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), darkMat);
  bridge.position.set(0, 0.05, 0.3);
  glasses.add(bridge);
  // temple arms
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), darkMat);
    arm.position.set(side * 0.26, 0.06, 0.18);
    glasses.add(arm);
  }
  head.add(glasses);

  pelican.add(head);

  // wings
  function makeWing(side) {
    const wing = new THREE.Group();
    // folded wing plate along the body
    const shape = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 4, 8), wingMat);
    shape.rotation.z = side * 0.15;
    shape.rotation.x = -0.35;
    shape.position.set(side * 0.42, 0.12, -0.2);
    shape.scale.set(1.15, 1, 1.8);
    shape.castShadow = true;
    wing.add(shape);
    // layered feathers pointing back
    for (let i = 0; i < 3; i++) {
      const feather = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.4, 3, 6), wingMat);
      feather.position.set(side * (0.38 + i * 0.06), 0.08 - i * 0.06, -0.45 - i * 0.18);
      feather.rotation.z = side * 0.25;
      feather.rotation.x = -0.85 - i * 0.15;
      wing.add(feather);
    }
    wing.userData.restRot = {
      z: side * 0.12,
      x: -0.25,
    };
    wing.rotation.z = wing.userData.restRot.z;
    wing.rotation.x = wing.userData.restRot.x;
    return wing;
  }

  const wingL = makeWing(-1);
  const wingR = makeWing(1);
  pelican.add(wingL, wingR);

  // legs to pedals
  function makeLeg(side) {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.45, 6), bodyMat);
    thigh.position.set(side * 0.22, -0.55, 0.1);
    thigh.rotation.x = 0.55;
    leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 6), bodyMat);
    shin.position.set(side * 0.28, -0.85, 0.35);
    shin.rotation.x = 0.95;
    leg.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.28), beakMat);
    foot.position.set(side * 0.3, -1.05, 0.55);
    leg.add(foot);
    return leg;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  pelican.add(legL, legR);

  // tail
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 3, 6), wingMat);
  tail.position.set(0, 0.15, -0.75);
  tail.rotation.x = -0.45;
  pelican.add(tail);

  root.add(pelican);

  // ---------- Scarf (Verlet cloth chain) ----------
  const SCARF_SEGMENTS = 18;
  const SCARF_SEGMENT_LEN = 0.2;
  const scarfPoints = [];
  for (let i = 0; i < SCARF_SEGMENTS; i++) {
    scarfPoints.push({
      pos: new THREE.Vector3(0, 1.05, 0.45 - i * SCARF_SEGMENT_LEN * 0.3),
      prev: new THREE.Vector3(0, 1.05, 0.45 - i * SCARF_SEGMENT_LEN * 0.3),
    });
  }

  const scarfGeo = new THREE.BufferGeometry();
  const scarfPositions = new Float32Array(SCARF_SEGMENTS * 2 * 3);
  const scarfIndices = [];
  for (let i = 0; i < SCARF_SEGMENTS - 1; i++) {
    const a = i * 2;
    scarfIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPositions, 3));
  scarfGeo.setIndex(scarfIndices);
  const scarfMesh = new THREE.Mesh(scarfGeo, scarfMat);
  scarfMesh.castShadow = true;
  scarfMesh.frustumCulled = false;
  root.add(scarfMesh);

  // scarf knot
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), scarfMat);
  knot.position.set(0, 1.12, 0.42);
  root.add(knot);

  // wing flap state
  const anim = {
    pedalPhase: 0,
    wingSpread: 0, // 0..1
    wheelie: 0,
    lean: 0,
    jumpY: 0,
    bob: 0,
  };

  function updateScarf(dt, speed, headWorldY) {
    // pin first point at neck
    const anchor = new THREE.Vector3(0, 1.12, 0.42);
    scarfPoints[0].pos.copy(anchor);
    scarfPoints[0].prev.copy(anchor);

    const wind = new THREE.Vector3(-speed * 0.18, 0.22 + Math.sin(performance.now() * 0.002) * 0.28, -speed * 0.72);
    const gravity = new THREE.Vector3(0, -9.5, 0);

    for (let i = 1; i < SCARF_SEGMENTS; i++) {
      const p = scarfPoints[i];
      const vel = p.pos.clone().sub(p.prev).multiplyScalar(0.94);
      p.prev.copy(p.pos);
      p.pos.add(vel);
      p.pos.addScaledVector(gravity, dt * dt * 1.2);
      p.pos.addScaledVector(wind, dt * dt * 2.4);
      // slight flutter
      p.pos.x += Math.sin(performance.now() * 0.004 + i) * 0.0025 * speed;
      p.pos.y += Math.cos(performance.now() * 0.0035 + i * 0.7) * 0.002 * speed;
    }

    // constraints
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < SCARF_SEGMENTS - 1; i++) {
        const a = scarfPoints[i];
        const b = scarfPoints[i + 1];
        const delta = b.pos.clone().sub(a.pos);
        const dist = delta.length() || 1e-5;
        const diff = (dist - SCARF_SEGMENT_LEN) / dist;
        if (i === 0) {
          b.pos.addScaledVector(delta, -diff);
        } else {
          a.pos.addScaledVector(delta, diff * 0.5);
          b.pos.addScaledVector(delta, -diff * 0.5);
        }
      }
    }

    // write ribbon vertices (left/right along local X)
    for (let i = 0; i < SCARF_SEGMENTS; i++) {
      const p = scarfPoints[i];
      const width = 0.16 * (1 - (i / SCARF_SEGMENTS) * 0.4);
      const idx = i * 2 * 3;
      scarfPositions[idx] = p.pos.x - width;
      scarfPositions[idx + 1] = p.pos.y;
      scarfPositions[idx + 2] = p.pos.z;
      scarfPositions[idx + 3] = p.pos.x + width;
      scarfPositions[idx + 4] = p.pos.y;
      scarfPositions[idx + 5] = p.pos.z;
    }
    scarfGeo.attributes.position.needsUpdate = true;
    scarfGeo.computeVertexNormals();
  }

  function update(dt, state) {
    anim.pedalPhase += state.speed * dt * 2.8;
    anim.lean = THREE.MathUtils.lerp(anim.lean, state.lean, 1 - Math.exp(-8 * dt));
    anim.wingSpread = THREE.MathUtils.lerp(anim.wingSpread, state.wingSpread, 1 - Math.exp(-6 * dt));
    anim.wheelie = THREE.MathUtils.lerp(anim.wheelie, state.wheelie, 1 - Math.exp(-5 * dt));
    anim.jumpY = THREE.MathUtils.lerp(anim.jumpY, state.jumpY, 1 - Math.exp(-10 * dt));
    anim.bob = Math.sin(anim.pedalPhase * 2) * 0.03 * Math.min(state.speed / 12, 1);

    root.rotation.z = anim.lean;
    root.rotation.x = -anim.wheelie * 0.55 + anim.jumpY * 0.08;
    root.position.y = anim.jumpY + anim.bob;

    // wheels spin
    const spin = state.speed * dt * 1.6;
    frontWheel.rotation.x -= spin;
    rearWheel.rotation.x -= spin;
    crank.rotation.x = anim.pedalPhase;

    // pedaling legs
    const pedalSwing = Math.sin(anim.pedalPhase);
    legL.rotation.x = pedalSwing * 0.55;
    legR.rotation.x = -pedalSwing * 0.55;
    legL.position.y = Math.cos(anim.pedalPhase) * 0.04;
    legR.position.y = Math.cos(anim.pedalPhase + Math.PI) * 0.04;

    // wings
    const spread = anim.wingSpread;
    const flap = Math.sin(performance.now() * 0.012) * 0.15 * spread;
    wingL.rotation.z = THREE.MathUtils.lerp(-0.12, -1.45, spread) + flap;
    wingR.rotation.z = THREE.MathUtils.lerp(0.12, 1.45, spread) - flap;
    wingL.rotation.x = THREE.MathUtils.lerp(-0.25, -0.65, spread);
    wingR.rotation.x = THREE.MathUtils.lerp(-0.25, -0.65, spread);

    // head bob / look
    head.rotation.y = Math.sin(performance.now() * 0.0015) * 0.12 + state.lookX * 0.35;
    head.rotation.x = -anim.wheelie * 0.25 + state.lookY * 0.15;

    // handlebar micro-steer
    bike.rotation.y = anim.lean * 0.6;

    updateScarf(Math.min(dt, 0.033), state.speed);
  }

  return {
    root,
    bike,
    pelican,
    head,
    wingL,
    wingR,
    scarfMesh,
    scarfMat,
    frontWheel,
    rearWheel,
    update,
    anim,
  };
}

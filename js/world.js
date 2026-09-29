import * as THREE from 'three';

/** 日夜时间 0=黄昏, 0.5=深夜, 1=黎明前 */
export const DAY_LENGTH = 120; // 秒一循环

export function createSky() {
  const uniforms = {
    uTime: { value: 0 },
    uDay: { value: 0 }, // 0 dusk → 0.5 night → 1 pre-dawn
    uSunDir: { value: new THREE.Vector3(0.2, 0.15, -1).normalize() },
  };

  const geo = new THREE.SphereGeometry(400, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uDay;
      uniform vec3 uSunDir;
      varying vec3 vWorld;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec3 dir = normalize(vWorld);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);

        // Dusk palette
        vec3 duskTop = vec3(0.10, 0.10, 0.28);
        vec3 duskMid = vec3(0.72, 0.32, 0.38);
        vec3 duskLow = vec3(1.0, 0.42, 0.22);
        vec3 duskHorizon = vec3(1.0, 0.55, 0.28);

        // Night palette
        vec3 nightTop = vec3(0.05, 0.06, 0.18);
        vec3 nightMid = vec3(0.08, 0.10, 0.28);
        vec3 nightLow = vec3(0.12, 0.14, 0.32);
        vec3 nightHorizon = vec3(0.18, 0.22, 0.40);

        float nightMix = smoothstep(0.05, 0.55, uDay) * (1.0 - smoothstep(0.75, 1.0, uDay));
        float dawnMix = smoothstep(0.8, 1.0, uDay);

        vec3 top = mix(duskTop, nightTop, nightMix);
        vec3 mid = mix(duskMid, nightMid, nightMix);
        vec3 low = mix(duskLow, nightLow, nightMix);
        vec3 hor = mix(duskHorizon, nightHorizon, nightMix);

        // Dawn re-warm
        top = mix(top, duskTop * 0.9, dawnMix * 0.5);
        hor = mix(hor, duskHorizon, dawnMix * 0.7);

        vec3 col;
        if (h > 0.55) {
          col = mix(mid, top, smoothstep(0.55, 1.0, h));
        } else if (h > 0.48) {
          col = mix(hor, mid, smoothstep(0.48, 0.55, h));
        } else {
          col = mix(low, hor, smoothstep(0.35, 0.48, h));
        }

        // Sun glow near horizon
        float sunAmt = pow(max(dot(dir, normalize(uSunDir)), 0.0), 8.0);
        float sunDisc = smoothstep(0.995, 0.999, dot(dir, normalize(uSunDir)));
        vec3 sunCol = mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.85, 0.55), sunDisc);
        float sunVis = 1.0 - nightMix * 0.85;
        col += sunCol * (sunAmt * 0.55 + sunDisc * 1.4) * sunVis;

        // Moon
        vec3 moonDir = normalize(vec3(-0.35, 0.55, -0.75));
        float moonAmt = pow(max(dot(dir, moonDir), 0.0), 24.0);
        float moonDisc = smoothstep(0.998, 0.9992, dot(dir, moonDir));
        col += vec3(0.85, 0.9, 1.0) * (moonAmt * 0.35 + moonDisc * 1.2) * nightMix;

        // Stars — point-like, anti-streak
        vec3 sdir = dir;
        vec2 suv = sdir.xz / max(abs(sdir.y), 0.08);
        suv *= 90.0;
        vec2 cell = floor(suv);
        vec2 f = fract(suv) - 0.5;
        float hsh = hash(cell + 17.0);
        float star = smoothstep(0.08, 0.0, length(f)) * step(0.978, hsh);
        float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + hsh * 40.0);
        float starVis = star * twinkle * nightMix * smoothstep(0.42, 0.72, h);
        col += vec3(0.92, 0.95, 1.0) * starVis * 1.8;

        // Soft horizon haze
        float haze = exp(-abs(dir.y) * 10.0);
        col = mix(col, hor * 0.9, haze * 0.25);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

export function createOcean() {
  const uniforms = {
    uTime: { value: 0 },
    uDay: { value: 0 },
    uColorDeep: { value: new THREE.Color('#06425a') },
    uColorShallow: { value: new THREE.Color('#0A6B7C') },
    uColorFoam: { value: new THREE.Color('#7FD1C8') },
    uSunDir: { value: new THREE.Vector3(0.2, 0.2, -1).normalize() },
    uQuality: { value: 1 },
  };

  const geo = new THREE.PlaneGeometry(600, 600, 180, 180);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying float vFoam;

      // Gerstner-ish wave
      vec3 waveSum(vec3 p, float t) {
        vec3 q = p;
        float y = 0.0;
        // damp waves near shore (x ≈ -28)
        float off = smoothstep(-20.0, -45.0, p.x); // 0 near shore, 1 open sea
        float amp = 0.22 + off * 0.85;
        y += sin(p.x * 0.08 + t * 1.1) * 0.55 * amp;
        y += cos(p.z * 0.064 + t * 0.99) * 0.35 * amp;
        y += sin(p.x * 0.18 + p.z * 0.12 + t * 1.6) * 0.22 * amp;
        y += sin(p.x * 0.45 - t * 2.2) * cos(p.z * 0.38 + t * 1.7) * 0.1 * amp;
        q.y = y;
        return q;
      }

      void main() {
        vec3 pos = position;
        vec3 displaced = waveSum(pos, uTime);
        // Approx normal via finite difference
        float e = 0.6;
        vec3 px = waveSum(pos + vec3(e, 0.0, 0.0), uTime);
        vec3 pz = waveSum(pos + vec3(0.0, 0.0, e), uTime);
        vNormal = normalize(cross(pz - displaced, px - displaced));

        // Shore line is along X ≈ -28 (beach). Foam when x is near shore.
        // Ocean is on -X side; road at X≈0.
        float shore = smoothstep(-22.0, -32.0, pos.x); // 1 near beach, 0 out to sea
        float crest = smoothstep(0.25, 0.65, displaced.y);
        vFoam = clamp(shore * 0.85 + crest * 0.4, 0.0, 1.0);

        vPos = (modelMatrix * vec4(displaced, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uDay;
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      uniform vec3 uColorFoam;
      uniform vec3 uSunDir;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying float vFoam;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 viewDir = normalize(cameraPosition - vPos);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);

        float nightMix = smoothstep(0.1, 0.55, uDay) * (1.0 - smoothstep(0.8, 1.0, uDay));
        vec3 deep = mix(uColorDeep, vec3(0.03, 0.05, 0.16), nightMix * 0.65);
        vec3 shallow = mix(uColorShallow, vec3(0.08, 0.14, 0.28), nightMix * 0.55);

        vec3 col = mix(deep, shallow, fres);
        // Specular sparkle
        vec3 halfV = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(dot(n, halfV), 0.0), 64.0);
        vec3 sunTint = mix(vec3(1.0, 0.7, 0.4), vec3(0.75, 0.85, 1.0), nightMix);
        col += sunTint * spec * 0.85;

        // Foam
        float foamNoise = sin(vPos.x * 1.7 + uTime * 1.8) * cos(vPos.z * 1.3 - uTime * 1.2);
        float foam = smoothstep(0.15, 0.85, vFoam + foamNoise * 0.12);
        col = mix(col, uColorFoam, foam * 0.72);

        gl_FragColor = vec4(col, 0.92);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -1.05;
  mesh.position.z = -40;
  mesh.renderOrder = 1;
  return { mesh, uniforms };
}

export function createRoad() {
  const group = new THREE.Group();

  // Long coastal road (repeats conceptually via fog + moving props)
  const roadLen = 400;
  const roadW = 14;

  const roadGeo = new THREE.PlaneGeometry(roadW, roadLen, 1, 40);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x2e2a33,
    roughness: 0.92,
    metalness: 0.05,
  });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.position.set(0, 0, -80);
  road.receiveShadow = true;
  group.add(road);

  // Lane dashes
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xf1faee,
    emissive: 0xf4a261,
    emissiveIntensity: 0.12,
    roughness: 0.6,
  });
  for (let lane = -1; lane <= 1; lane++) {
    if (lane === 0) continue;
    for (let i = 0; i < 40; i++) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 1.6), dashMat);
      dash.position.set(lane * 2.3, 0.02, -i * 10 + 20);
      group.add(dash);
    }
  }

  // Center double line
  for (const off of [-0.2, 0.2]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, roadLen), dashMat);
    line.position.set(off, 0.02, -80);
    group.add(line);
  }

  // Curbs
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xe8c99b, roughness: 0.85 });
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, roadLen), curbMat);
    curb.position.set(side * (roadW / 2 + 0.25), 0.09, -80);
    curb.receiveShadow = true;
    group.add(curb);
  }

  // Beach sand strip (ocean side is -x / screen right when looking +z)
  const sandGeo = new THREE.PlaneGeometry(22, roadLen, 1, 1);
  sandGeo.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({ color: 0xe8c99b, roughness: 1 })
  );
  sand.position.set(-18.5, -0.15, -80);
  sand.receiveShadow = true;
  group.add(sand);

  // Foam edge on sand
  const foamEdge = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, roadLen, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0xb8f0ea,
      roughness: 0.85,
      transparent: true,
      opacity: 0.55,
    })
  );
  foamEdge.geometry.rotateX(-Math.PI / 2);
  foamEdge.position.set(-28.5, -0.25, -80);
  group.add(foamEdge);

  // Inland grass strip
  const grassGeo = new THREE.PlaneGeometry(36, roadLen, 1, 1);
  grassGeo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(
    grassGeo,
    new THREE.MeshStandardMaterial({ color: 0x3d6b4f, roughness: 1 })
  );
  grass.position.set(26, -0.12, -80);
  grass.receiveShadow = true;
  group.add(grass);

  // Street lamps (recycled)
  const lamps = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2830, roughness: 0.7, metalness: 0.3 });
  const lampGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.2, 8);
  const armGeo = new THREE.BoxGeometry(1.8, 0.1, 0.1);
  const bulbGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffe0a0,
    emissive: 0xffb347,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });

  for (let i = 0; i < 14; i++) {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(lampGeo, poleMat);
    pole.position.y = 2.6;
    pole.castShadow = true;
    lamp.add(pole);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(-0.9, 5.1, 0);
    lamp.add(arm);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(-1.7, 5.0, 0);
    lamp.add(bulb);
    lamp.position.set(7.8, 0, -i * 28 + 30);
    lamp.userData.bulb = bulb;
    lamps.add(lamp);
  }
  group.add(lamps);

  // Palm trees (simplified)
  const palms = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2f8f6b,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 10; i++) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.5, 7), trunkMat);
    trunk.position.y = 2.25;
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let l = 0; l < 6; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), leafMat);
      leaf.position.y = 4.6;
      leaf.rotation.z = Math.PI / 2.6;
      leaf.rotation.y = (l / 6) * Math.PI * 2;
      leaf.translateY(1.0);
      palm.add(leaf);
    }
    palm.position.set(12 + Math.random() * 16, 0, -i * 32 - 10);
    palms.add(palm);
  }
  group.add(palms);

  // Distant lighthouse
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xf1faee, roughness: 0.7 })
  );
  tower.position.y = 6;
  lh.add(tower);
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 1.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.6 })
  );
  top.position.y = 12.5;
  lh.add(top);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffe08a,
      emissive: 0xffc857,
      emissiveIntensity: 2.2,
    })
  );
  beacon.position.y = 13.6;
  lh.add(beacon);
  lh.position.set(-70, 0, -160);
  group.add(lh);

  return { group, lamps, roadW };
}

export function createLights() {
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x1b2840, 0.85);
  const sun = new THREE.DirectionalLight(0xffb07a, 1.35);
  sun.position.set(30, 28, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;

  const moon = new THREE.DirectionalLight(0x8aa4ff, 0.0);
  moon.position.set(-25, 35, -30);

  const ambient = new THREE.AmbientLight(0x3a4568, 0.35);

  return { hemi, sun, moon, ambient };
}

/** 每帧推进昼夜 */
export function updateDayNight(env, dayT) {
  const { sky, ocean, lights, lamps } = env;
  sky.uniforms.uDay.value = dayT;
  ocean.uniforms.uDay.value = dayT;

  // Sun path: high at dusk start, sinks
  const sunAngle = Math.PI * (0.12 + dayT * 0.55);
  const sunY = Math.cos(sunAngle) * 40;
  const sunX = Math.sin(sunAngle) * 50;
  const sunDir = new THREE.Vector3(sunX, Math.max(sunY, 2), -60).normalize();
  sky.uniforms.uSunDir.value.copy(sunDir);
  ocean.uniforms.uSunDir.value.copy(sunDir);

  lights.sun.position.set(sunX, Math.max(sunY, 4), -40);
  const nightMix = smoothstep(0.08, 0.5, dayT) * (1 - smoothstep(0.82, 1, dayT));
  const dawnMix = smoothstep(0.82, 1, dayT);

  lights.sun.intensity = 1.35 * (1 - nightMix * 0.82) + dawnMix * 0.4;
  lights.sun.color.setHex(nightMix > 0.5 ? 0x9bb4ff : 0xffb07a);
  lights.moon.intensity = nightMix * 0.95;
  lights.hemi.intensity = 0.85 - nightMix * 0.28 + dawnMix * 0.15;
  lights.ambient.intensity = 0.38 + nightMix * 0.42;

  // Lamps brighter at night
  const lampGlow = 0.6 + nightMix * 1.8;
  lamps.traverse((obj) => {
    if (obj.userData && obj.userData.bulb) {
      obj.userData.bulb.material.emissiveIntensity = lampGlow;
    }
  });

  // Fog color follows sky
  const fogColor = new THREE.Color().setHSL(
    0.62 - (1 - nightMix) * 0.08,
    0.35 + nightMix * 0.1,
    0.18 + (1 - nightMix) * 0.12
  );
  return { nightMix, fogColor, sunDir };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 海鸥/萤火/远景微粒 */
export function createAmbientParticles() {
  const count = 160;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // mostly near road height, softer sky sparsity
    const skyOne = Math.random() > 0.72;
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = skyOne ? Math.random() * 18 + 6 : Math.random() * 3.2 + 0.3;
    positions[i * 3 + 2] = -Math.random() * 160 + 20;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.PointsMaterial({
    color: 0xffe6b0,
    size: 0.14,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.phases = phases;
  return points;
}

/** 让道路/沙滩/道具跟随玩家（无限公路） */
export function followPlayer(roadGroup, oceanMesh, playerZ) {
  roadGroup.position.z = playerZ;
  oceanMesh.position.z = playerZ - 40;
}

/** 帧率自适应画质 */
export function createQualityController(renderer, scene) {
  let level = 2; // 0 low, 1 med, 2 high
  let fpsAccum = 0;
  let fpsCount = 0;
  let fpsTimer = 0;
  let currentFps = 60;

  const settings = [
    {
      name: 'low',
      pixelRatio: Math.min(window.devicePixelRatio, 1),
      shadows: false,
      particles: 40,
      oceanSeg: 1,
    },
    {
      name: 'medium',
      pixelRatio: Math.min(window.devicePixelRatio, 1.25),
      shadows: true,
      shadowMap: 512,
      particles: 120,
      oceanSeg: 1,
    },
    {
      name: 'high',
      pixelRatio: Math.min(window.devicePixelRatio, 1.75),
      shadows: true,
      shadowMap: 1024,
      particles: 220,
      oceanSeg: 1,
    },
  ];

  function apply() {
    const s = settings[level];
    renderer.setPixelRatio(s.pixelRatio);
    renderer.shadowMap.enabled = s.shadows;
    renderer.shadowMap.type = 2; // PCFSoftShadowMap equivalent number
    scene.traverse((obj) => {
      if (obj.isLight && obj.shadow) {
        if (obj.shadow.mapSize) {
          obj.shadow.mapSize.set(s.shadowMap || 1024, s.shadowMap || 1024);
        }
      }
      if (obj.isPoints && obj.geometry && obj.geometry.attributes.position) {
        const attr = obj.geometry.attributes.position;
        if (attr.count > s.particles) {
          obj.geometry.setDrawRange(0, s.particles);
        }
      }
    });
  }

  function update(dt) {
    fpsAccum += 1 / Math.max(dt, 1e-4);
    fpsCount += 1;
    fpsTimer += dt;
    if (fpsTimer >= 1.0) {
      currentFps = fpsAccum / fpsCount;
      fpsAccum = 0;
      fpsCount = 0;
      fpsTimer = 0;

      if (currentFps < 28 && level > 0) {
        level -= 1;
        apply();
      } else if (currentFps > 52 && level < 2) {
        // slowly climb
        level += 1;
        apply();
      }
    }
    return { level, fps: currentFps, name: settings[level].name };
  }

  apply();
  return { update, apply, getLevel: () => level, settings };
}

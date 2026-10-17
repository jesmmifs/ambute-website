import * as THREE from "three";

const CYCLE_SECONDS = 64;
const TREE_COLORS = {
  summer: new THREE.Color(0x8fa568),
  autumnEarly: new THREE.Color(0xdf3446),
  autumnPeak: new THREE.Color(0xf5223d),
  autumnLate: new THREE.Color(0xc51e38),
  winter: new THREE.Color(0x927b54),
  spring: new THREE.Color(0xd9678e)
};
const GRASS_COLORS = {
  summer: new THREE.Color(0x5d733b),
  autumnEarly: new THREE.Color(0xb28737),
  autumnPeak: new THREE.Color(0xb28737),
  autumnLate: new THREE.Color(0xb28737),
  winter: new THREE.Color(0x898d6d),
  spring: new THREE.Color(0x78945a)
};
const SEASON_STOPS = [
  [0, "summer"],
  [0.1, "summer"],
  [0.2, "autumnEarly"],
  [0.27, "autumnPeak"],
  [0.34, "autumnLate"],
  [0.46, "winter"],
  [0.54, "winter"],
  [0.66, "spring"],
  [0.9, "spring"],
  [1, "summer"]
];
const TREE_ORIGIN = new THREE.Vector3(-0.88, 3.22, 0.2);

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(start, end, value) {
  const amount = clamp01((value - start) / (end - start));
  return amount * amount * (3 - 2 * amount);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createLeafGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.055);
  shape.bezierCurveTo(0.05, -0.025, 0.052, 0.035, 0, 0.065);
  shape.bezierCurveTo(-0.052, 0.035, -0.05, -0.025, 0, -0.055);
  return new THREE.ShapeGeometry(shape, 5);
}

function createPetalGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.038);
  shape.bezierCurveTo(0.012, -0.03, 0.027, -0.014, 0.03, 0.008);
  shape.bezierCurveTo(0.032, 0.029, 0.021, 0.047, 0.008, 0.041);
  shape.lineTo(0, 0.032);
  shape.lineTo(-0.008, 0.041);
  shape.bezierCurveTo(-0.021, 0.047, -0.032, 0.029, -0.03, 0.008);
  shape.bezierCurveTo(-0.027, -0.014, -0.012, -0.03, 0, -0.038);
  return new THREE.ShapeGeometry(shape, 6);
}

function createParticleLayer({ geometry, colors, count, seed, petal = false }) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = seededRandom(seed);
  const dummy = new THREE.Object3D();
  const palette = colors.map((color) => new THREE.Color(color));
  const particles = Array.from({ length: count }, (_, index) => {
    mesh.setColorAt(index, palette[index % palette.length]);
    return {
      x: 0,
      y: 0,
      z: 0,
      drift: 0.12 + random() * 0.13,
      phase: random() * Math.PI * 2,
      frequency: 0.55 + random() * 0.52,
      speed: (petal ? 0.11 : 0.2) + random() * (petal ? 0.07 : 0.1),
      spinX: 0.45 + random() * 0.9,
      spinY: 0.4 + random() * 0.85,
      spinZ: 0.55 + random() * 1.05,
      rotationX: random() * Math.PI,
      rotationY: random() * Math.PI,
      rotationZ: random() * Math.PI,
      scale: (petal ? 0.78 : 0.72) + random() * 0.34
    };
  });

  function reset(particle, index) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * (petal ? 0.72 : 0.9);
    particle.x = TREE_ORIGIN.x + Math.cos(angle) * radius;
    particle.y = TREE_ORIGIN.y - (index / count) * 2.55 + random() * 0.24;
    particle.z = TREE_ORIGIN.z + Math.sin(angle) * radius * 0.48;
    if (particle.y < 0.28) particle.y += 2.72;
  }

  particles.forEach(reset);
  mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 4;
  mesh.visible = false;

  return {
    mesh,
    material,
    particles,
    dummy,
    reset,
    update(delta, elapsed, opacity, activeCount) {
      const visible = opacity > 0.015 && activeCount > 0;
      mesh.visible = visible;
      material.opacity = opacity;
      mesh.count = activeCount;
      if (!visible) return;

      particles.slice(0, activeCount).forEach((particle, index) => {
        particle.y -= particle.speed * delta;
        particle.x += Math.sin(elapsed * 0.31 + particle.phase) * delta * 0.012;
        if (particle.y <= 0.18) reset(particle, index);

        const driftTime = elapsed * particle.frequency + particle.phase;
        dummy.position.set(
          particle.x + Math.sin(driftTime) * particle.drift,
          particle.y,
          particle.z + Math.cos(driftTime * 0.78) * particle.drift * 0.35
        );
        particle.rotationX += particle.spinX * delta;
        particle.rotationY += particle.spinY * delta;
        particle.rotationZ += particle.spinZ * delta;
        dummy.rotation.set(
          particle.rotationX,
          particle.rotationY,
          particle.rotationZ
        );
        dummy.scale.setScalar(particle.scale * (petal ? 1.65 : 1.35));
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function sampleSeasonColors(phase, treeColor, grassColor) {
  for (let index = 0; index < SEASON_STOPS.length - 1; index += 1) {
    const [start, fromName] = SEASON_STOPS[index];
    const [end, toName] = SEASON_STOPS[index + 1];
    if (phase > end) continue;
    const amount = smoothstep(start, end, phase);
    treeColor.copy(TREE_COLORS[fromName]).lerp(TREE_COLORS[toName], amount);
    grassColor.copy(GRASS_COLORS[fromName]).lerp(GRASS_COLORS[toName], amount);
    return;
  }
  treeColor.copy(TREE_COLORS.summer);
  grassColor.copy(GRASS_COLORS.summer);
}

export function createIslandSeasonCycle() {
  const group = new THREE.Group();
  group.name = "island-seasonal-drift";
  const fallingLeaves = createParticleLayer({
    geometry: createLeafGeometry(),
    colors: [0xffb23f, 0xff7452, 0xf05257, 0xffcf66],
    count: 7,
    seed: 4107
  });
  const fallingPetals = createParticleLayer({
    geometry: createPetalGeometry(),
    colors: [0xffffff, 0xffdbea, 0xffb8d2],
    count: 6,
    seed: 8103,
    petal: true
  });
  group.add(fallingLeaves.mesh, fallingPetals.mesh);

  const treeColor = TREE_COLORS.summer.clone();
  const grassColor = GRASS_COLORS.summer.clone();
  let elapsed = 0;
  let compact = false;

  return {
    group,
    update(delta, motion = true) {
      if (!motion) {
        treeColor.copy(TREE_COLORS.summer);
        grassColor.copy(GRASS_COLORS.summer);
        fallingLeaves.mesh.visible = false;
        fallingPetals.mesh.visible = false;
        return { treeColor, grassColor };
      }

      elapsed = (elapsed + Math.min(delta, 0.05)) % CYCLE_SECONDS;
      const phase = elapsed / CYCLE_SECONDS;
      sampleSeasonColors(phase, treeColor, grassColor);
      const autumnAmount =
        smoothstep(0.14, 0.2, phase) * (1 - smoothstep(0.36, 0.45, phase));
      const springAmount =
        smoothstep(0.59, 0.66, phase) * (1 - smoothstep(0.91, 0.98, phase));
      fallingLeaves.update(
        delta,
        elapsed,
        autumnAmount * 0.92,
        compact ? 4 : 7
      );
      fallingPetals.update(
        delta,
        elapsed,
        springAmount * 0.88,
        compact ? 3 : 6
      );
      return { treeColor, grassColor };
    },
    setCompact(value) {
      compact = Boolean(value);
    },
    dispose() {
      fallingLeaves.dispose();
      fallingPetals.dispose();
    }
  };
}

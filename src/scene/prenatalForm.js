import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

function addSoftEllipsoid(metabody, shape) {
  const {
    x,
    y,
    z,
    rx,
    ry,
    rz,
    strength,
    falloff = 1.2,
    cutoff = 3
  } = shape;
  const { size, halfsize, field } = metabody;
  const range = Math.sqrt(cutoff);
  const minX = Math.max(1, Math.floor(((x - rx * range) * 0.5 + 0.5) * size));
  const maxX = Math.min(size - 2, Math.ceil(((x + rx * range) * 0.5 + 0.5) * size));
  const minY = Math.max(1, Math.floor(((y - ry * range) * 0.5 + 0.5) * size));
  const maxY = Math.min(size - 2, Math.ceil(((y + ry * range) * 0.5 + 0.5) * size));
  const minZ = Math.max(1, Math.floor(((z - rz * range) * 0.5 + 0.5) * size));
  const maxZ = Math.min(size - 2, Math.ceil(((z + rz * range) * 0.5 + 0.5) * size));

  for (let zi = minZ; zi <= maxZ; zi += 1) {
    const gz = (zi - halfsize) / halfsize;
    const dz = (gz - z) / rz;
    const dz2 = dz * dz;
    const zOffset = metabody.size2 * zi;
    for (let yi = minY; yi <= maxY; yi += 1) {
      const gy = (yi - halfsize) / halfsize;
      const dy = (gy - y) / ry;
      const dy2 = dy * dy;
      const yOffset = zOffset + size * yi;
      for (let xi = minX; xi <= maxX; xi += 1) {
        const gx = (xi - halfsize) / halfsize;
        const dx = (gx - x) / rx;
        const distance = dx * dx + dy2 + dz2;
        if (distance > cutoff) continue;
        field[yOffset + xi] += strength * Math.exp(-distance * falloff);
      }
    }
  }
}

function createRadialTexture(stops, width = 512, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) / 2
  );
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createPrenatalForm() {
  let currentOpacity = 1;
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xeeb297,
    emissive: 0xffc4a8,
    emissiveIntensity: 0.2,
    transmission: 0.75,
    thickness: 1.2,
    ior: 1.35,
    roughness: 0.35,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    transparent: true,
    opacity: 1
  });

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float milkyFresnel = 1.0 - max(dot(normalize(vViewPosition), normalize(vNormal)), 0.0);
      milkyFresnel = pow(milkyFresnel, 3.5);
      vec3 rimColor = vec3(1.0, 0.94, 0.90);
      totalEmissiveRadiance += rimColor * milkyFresnel * 0.25;
      `
    );
  };
  material.customProgramCacheKey = () => "ambute-prenatal-milky-rim-v1";

  const metabody = new MarchingCubes(28, material, false, false, 20000);
  metabody.isolation = 1;
  metabody.scale.setScalar(0.68);
  metabody.castShadow = true;
  metabody.receiveShadow = true;
  metabody.frustumCulled = false;
  bodyRoot.add(metabody);

  const innerGeometry = new THREE.SphereGeometry(1, 32, 32);
  const createInnerMaterial = (color) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.15,
      roughness: 0.8
    });
  const coreMesh = new THREE.Mesh(
    innerGeometry,
    createInnerMaterial(0xdda671)
  );
  const bulge1Mesh = new THREE.Mesh(
    innerGeometry,
    createInnerMaterial(0xbc6e7a)
  );
  const bulge2Mesh = new THREE.Mesh(
    innerGeometry,
    createInnerMaterial(0x8e6378)
  );
  const innerMeshes = [coreMesh, bulge1Mesh, bulge2Mesh];
  bodyRoot.add(...innerMeshes);

  const shadowTexture = createRadialTexture([
    [0, "rgba(0,0,0,.72)"],
    [0.35, "rgba(0,0,0,.38)"],
    [1, "rgba(0,0,0,0)"]
  ]);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.4,
    depthWrite: false
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.78), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  group.add(shadow);

  const glowTexture = createRadialTexture([
    [0, "rgba(255,212,179,.42)"],
    [0.25, "rgba(182,122,82,.19)"],
    [0.68, "rgba(73,48,31,.05)"],
    [1, "rgba(0,0,0,0)"]
  ]);
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), glowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.015;
  group.add(glow);

  function update(now, motion = true) {
    const time = motion ? now : 900;
    const floatPhase = time * 0.0012;
    const floatY = 0.86 + Math.sin(floatPhase) * (motion ? 0.1 : 0);
    bodyRoot.position.set(0, floatY, 0);
    bodyRoot.rotation.y = time * (motion ? 0.0003 : 0);
    metabody.reset();

    const breath = Math.sin(time * 0.0009);
    const coreShape = {
      x: 0,
      y: 0,
      z: 0,
      rx: 0.46,
      ry: 0.46,
      rz: 0.46,
      strength: 1.8 * (1 + breath * 0.03)
    };
    const bulge1Shape = {
      x: Math.sin(time * 0.0018) * 0.32,
      y: Math.cos(time * 0.0014) * 0.22,
      z: Math.sin(time * 0.001) * 0.28,
      rx: 0.36,
      ry: 0.36,
      rz: 0.36,
      strength: 1.2
    };
    const bulge2Shape = {
      x: Math.cos(time * 0.0016) * 0.28,
      y: Math.sin(time * 0.0019) * 0.22,
      z: Math.cos(time * 0.0012) * 0.28,
      rx: 0.32,
      ry: 0.32,
      rz: 0.32,
      strength: 1
    };
    const shapes = [coreShape, bulge1Shape, bulge2Shape];
    shapes.forEach((shape) => addSoftEllipsoid(metabody, shape));

    const metabodyScale = 0.68;
    const innerScaleMultiplier = 0.35;
    shapes.forEach((shape, index) => {
      innerMeshes[index].position.set(
        shape.x * metabodyScale,
        shape.y * metabodyScale,
        shape.z * metabodyScale
      );
      innerMeshes[index].scale.setScalar(
        shape.rx * metabodyScale * innerScaleMultiplier
      );
    });
    metabody.update();

    const shadowScale = 0.88 - (floatY - 0.86) * 0.16;
    shadow.scale.set(shadowScale, 0.78 * shadowScale, 1);
    shadowMaterial.opacity =
      currentOpacity * (0.4 - (floatY - 0.86) * 0.14);
  }

  function setOpacity(opacity) {
    currentOpacity = opacity;
    material.opacity = opacity;
    innerMeshes.forEach((mesh) => {
      mesh.visible = opacity > 0.999;
    });
    shadowMaterial.opacity = opacity * 0.4;
    glowMaterial.opacity = opacity * 0.72;
    group.visible = opacity > 0.004;
  }

  function dispose() {
    metabody.geometry.dispose();
    material.dispose();
    innerGeometry.dispose();
    innerMeshes.forEach((mesh) => mesh.material.dispose());
    shadow.geometry.dispose();
    shadowMaterial.dispose();
    shadowTexture.dispose();
    glow.geometry.dispose();
    glowMaterial.dispose();
    glowTexture.dispose();
  }

  update(900, false);
  return { group, update, setOpacity, dispose };
}

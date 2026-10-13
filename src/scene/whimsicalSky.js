import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The lobe layouts and vertex-color painting follow the game's painted clouds.
const CLOUD_SHAPES = [
  [
    { position: [0, -0.08, 0.02], radius: 0.31, scale: [1.72, 0.5, 1.02] },
    { position: [-0.39, -0.03, 0.04], radius: 0.25, scale: [1.25, 0.72, 0.96] },
    { position: [0.39, -0.04, -0.03], radius: 0.26, scale: [1.32, 0.7, 1] },
    { position: [-0.16, 0.14, -0.04], radius: 0.28, scale: [1.08, 0.92, 1.03] },
    { position: [0.17, 0.17, 0.03], radius: 0.25, scale: [1.1, 0.94, 1] },
    { position: [0.02, 0.03, 0.15], radius: 0.25, scale: [1.38, 0.72, 0.82] }
  ],
  [
    { position: [-0.04, -0.08, 0.01], radius: 0.3, scale: [1.82, 0.48, 1] },
    { position: [-0.44, -0.04, -0.01], radius: 0.23, scale: [1.18, 0.7, 0.92] },
    { position: [0.43, -0.03, 0.04], radius: 0.24, scale: [1.3, 0.68, 0.95] },
    { position: [-0.24, 0.12, 0.03], radius: 0.26, scale: [1.02, 0.88, 1.02] },
    { position: [0.08, 0.2, -0.05], radius: 0.29, scale: [1.13, 0.98, 1.05] },
    { position: [0.33, 0.11, 0.02], radius: 0.21, scale: [1.1, 0.8, 0.96] }
  ],
  [
    { position: [0.02, -0.09, 0], radius: 0.32, scale: [1.68, 0.48, 1.04] },
    { position: [-0.43, -0.04, 0.06], radius: 0.24, scale: [1.3, 0.66, 0.94] },
    { position: [0.45, -0.05, -0.03], radius: 0.22, scale: [1.24, 0.64, 0.96] },
    { position: [-0.2, 0.18, -0.06], radius: 0.27, scale: [1.08, 0.94, 1.03] },
    { position: [0.14, 0.12, 0.02], radius: 0.25, scale: [1.16, 0.86, 1] },
    { position: [0.31, 0.08, 0.11], radius: 0.2, scale: [1.08, 0.76, 0.88] }
  ]
];

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
const smoothstep = (min, max, value) => {
  const amount = clamp((value - min) / (max - min));
  return amount * amount * (3 - 2 * amount);
};

function paintCloudGeometry(geometry, variant) {
  geometry.computeBoundingBox();
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const colors = new Float32Array(positions.count * 3);
  const height = Math.max(
    0.001,
    geometry.boundingBox.max.y - geometry.boundingBox.min.y
  );

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const normalY = normals?.getY(index) || 0;
    const vertical = clamp((y - geometry.boundingBox.min.y) / height);
    const topLight =
      smoothstep(0.32, 0.92, vertical) * smoothstep(-0.05, 0.82, normalY);
    const underside =
      (1 - smoothstep(0.12, 0.52, vertical)) *
      (1 - smoothstep(-0.85, 0.15, normalY));
    const wash = 0.5 + Math.sin(x * 6.1 + z * 4.3 + variant * 1.7) * 0.5;
    const middle = clamp(vertical * 0.72 + topLight * 0.28 - underside * 0.16);
    colors[index * 3] =
      THREE.MathUtils.lerp(0.68, 1.06, middle) * (0.97 + wash * 0.03);
    colors[index * 3 + 1] = THREE.MathUtils.lerp(0.75, 1.01, middle);
    colors[index * 3 + 2] =
      THREE.MathUtils.lerp(0.86, 0.94, middle) * (1.02 - wash * 0.02);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function createPaintedCloud(size, variant) {
  const shapeIndex = Math.abs(Math.trunc(variant)) % CLOUD_SHAPES.length;
  const parts = CLOUD_SHAPES[shapeIndex].map((lobe, lobeIndex) => {
    const geometry = new THREE.SphereGeometry(lobe.radius * size, 10, 7);
    geometry.scale(...lobe.scale);
    geometry.rotateY((shapeIndex * 0.19 + lobeIndex * 0.13) % 0.42 - 0.21);
    geometry.translate(
      lobe.position[0] * size,
      lobe.position[1] * size,
      lobe.position[2] * size
    );
    return geometry;
  });
  const geometry = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  paintCloudGeometry(geometry, shapeIndex);
  geometry.scale(1, 1, 0.15);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: true,
    fog: false
  });
  return new THREE.Mesh(geometry, material);
}

function createSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#83bedb");
  gradient.addColorStop(0.48, "#b9dce7");
  gradient.addColorStop(0.78, "#e9d9c7");
  gradient.addColorStop(1, "#f4d4b8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createWhimsicalSky() {
  const group = new THREE.Group();
  group.renderOrder = -10;
  const texture = createSkyTexture();
  const backdropMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false
  });
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 15),
    backdropMaterial
  );
  backdrop.position.set(0, 1.2, -7);
  backdrop.renderOrder = -10;
  group.add(backdrop);

  const cloudConfigs = [
    { position: [-4.5, 3.15, -5.5], size: 1.65, speed: 0.045, variant: 0 },
    { position: [3.9, 2.85, -5.2], size: 1.32, speed: 0.032, variant: 1 },
    { position: [0.4, 4.2, -5.8], size: 1.08, speed: 0.038, variant: 2 }
  ];
  const clouds = cloudConfigs.map((config, index) => {
    const cloud = createPaintedCloud(config.size, config.variant);
    cloud.position.set(...config.position);
    cloud.userData.baseX = config.position[0];
    cloud.userData.baseY = config.position[1];
    cloud.userData.speed = config.speed;
    cloud.userData.phase = index * 1.7;
    cloud.renderOrder = -5;
    group.add(cloud);
    return cloud;
  });

  function setOpacity(opacity) {
    backdropMaterial.opacity = opacity;
    clouds.forEach((cloud) => {
      cloud.material.opacity = opacity;
    });
    group.visible = opacity > 0.004;
  }

  function update(timeSeconds, motion = true) {
    clouds.forEach((cloud) => {
      const phase = cloud.userData.phase;
      cloud.position.x =
        cloud.userData.baseX +
        (motion ? Math.sin(timeSeconds * cloud.userData.speed + phase) * 0.42 : 0);
      cloud.position.y =
        cloud.userData.baseY +
        (motion ? Math.sin(timeSeconds * 0.16 + phase) * 0.055 : 0);
    });
  }

  function dispose() {
    backdrop.geometry.dispose();
    backdropMaterial.dispose();
    texture.dispose();
    clouds.forEach((cloud) => {
      cloud.geometry.dispose();
      cloud.material.dispose();
    });
  }

  setOpacity(0);
  return { group, setOpacity, update, dispose };
}

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const CARD_VERTEX_COUNT = 4;

function stableUnit(x, y, z, seed = 0) {
  const value =
    Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 19.19) *
    43758.5453;
  return value - Math.floor(value);
}

function stablePhase(x, y, z) {
  return stableUnit(x, y, z) * Math.PI * 2;
}

function cloneWorldSpaceGeometry(node) {
  node.updateWorldMatrix(true, false);
  const geometry = node.geometry.clone();
  geometry.applyMatrix4(node.matrixWorld);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function scaleGeometryAroundCenter(geometry, scale) {
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  geometry.translate(center.x, center.y, center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createRelativeTreeTint(targetHex, referenceHex, maxRatio = 1.75) {
  const target = new THREE.Color(targetHex);
  const reference = new THREE.Color(referenceHex);
  const paintedAtlasBrightness = 0.28;
  return new THREE.Color(
    THREE.MathUtils.clamp(
      target.r / Math.max(reference.r, 0.04),
      0.22,
      maxRatio
    ) * paintedAtlasBrightness,
    THREE.MathUtils.clamp(
      target.g / Math.max(reference.g, 0.04),
      0.22,
      maxRatio
    ) * paintedAtlasBrightness,
    THREE.MathUtils.clamp(
      target.b / Math.max(reference.b, 0.04),
      0.22,
      maxRatio
    ) * paintedAtlasBrightness
  );
}

// This is the same card preparation used by the game. It preserves one center,
// corner offset, roll, breeze phase, and painted normal for each four-vertex card.
function preparePaintedLeafCardGeometry(sourceGeometry) {
  const geometry = sourceGeometry.clone();
  const positions = geometry.getAttribute("position");
  if (!positions || positions.count % CARD_VERTEX_COUNT !== 0) {
    geometry.dispose();
    throw new Error("Painted leaf geometry must contain four vertices per card.");
  }

  const centers = new Float32Array(positions.count * 3);
  const corners = new Float32Array(positions.count * 2);
  const phases = new Float32Array(positions.count);
  const rotations = new Float32Array(positions.count * 2);
  const surfaceNormals = new Float32Array(positions.count * 3);
  const paintedColors = new Float32Array(positions.count * 3);
  const encodedNormals =
    geometry.getAttribute("color_1") || geometry.getAttribute("color");
  const points = Array.from({ length: CARD_VERTEX_COUNT }, () =>
    new THREE.Vector3()
  );
  const center = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const paintedSunDirection = new THREE.Vector3(5.5, 8.2, -4.6).normalize();

  for (let base = 0; base < positions.count; base += CARD_VERTEX_COUNT) {
    center.set(0, 0, 0);
    for (let cornerIndex = 0; cornerIndex < CARD_VERTEX_COUNT; cornerIndex += 1) {
      points[cornerIndex].fromBufferAttribute(positions, base + cornerIndex);
      center.add(points[cornerIndex]);
    }
    center.multiplyScalar(1 / CARD_VERTEX_COUNT);

    if (encodedNormals?.itemSize >= 3) {
      surfaceNormal.set(0, 0, 0);
      for (
        let cornerIndex = 0;
        cornerIndex < CARD_VERTEX_COUNT;
        cornerIndex += 1
      ) {
        const vertexIndex = base + cornerIndex;
        surfaceNormal.x += encodedNormals.getX(vertexIndex) * 2 - 1;
        surfaceNormal.y += encodedNormals.getY(vertexIndex) * 2 - 1;
        surfaceNormal.z += encodedNormals.getZ(vertexIndex) * 2 - 1;
      }
      if (surfaceNormal.lengthSq() > 0.0001) surfaceNormal.normalize();
    } else {
      surfaceNormal
        .set(
          center.x * 0.42,
          Math.max(0.16, (center.y - 4.28) * 0.82),
          center.z * 0.62
        )
        .normalize();
    }

    const width =
      0.5 *
      (points[0].distanceTo(points[1]) + points[2].distanceTo(points[3]));
    const height =
      0.5 *
      (points[0].distanceTo(points[3]) + points[1].distanceTo(points[2]));
    const phase = stablePhase(center.x, center.y, center.z);
    const directionalLight = Math.max(
      0,
      surfaceNormal.dot(paintedSunDirection)
    );
    const leafVariation =
      (stableUnit(center.x, center.y, center.z, 47) - 0.5) * 0.12;
    const paintedLight = THREE.MathUtils.clamp(
      0.76 + directionalLight * 0.3 + Math.max(0, surfaceNormal.y) * 0.08 + leafVariation,
      0.7,
      1.16
    );
    const rollMagnitude = THREE.MathUtils.degToRad(
      7 + stableUnit(center.x, center.y, center.z, 11) * 13
    );
    const roll =
      stableUnit(center.x, center.y, center.z, 29) < 0.5
        ? -rollMagnitude
        : rollMagnitude;
    const rollCos = Math.cos(roll);
    const rollSin = Math.sin(roll);
    const cardCorners = [
      [-0.5 * width, -0.5 * height],
      [0.5 * width, -0.5 * height],
      [0.5 * width, 0.5 * height],
      [-0.5 * width, 0.5 * height]
    ];

    for (let cornerIndex = 0; cornerIndex < CARD_VERTEX_COUNT; cornerIndex += 1) {
      const vertexIndex = base + cornerIndex;
      centers[vertexIndex * 3] = center.x;
      centers[vertexIndex * 3 + 1] = center.y;
      centers[vertexIndex * 3 + 2] = center.z;
      corners[vertexIndex * 2] = cardCorners[cornerIndex][0];
      corners[vertexIndex * 2 + 1] = cardCorners[cornerIndex][1];
      phases[vertexIndex] = phase;
      rotations[vertexIndex * 2] = rollCos;
      rotations[vertexIndex * 2 + 1] = rollSin;
      surfaceNormals[vertexIndex * 3] = surfaceNormal.x;
      surfaceNormals[vertexIndex * 3 + 1] = surfaceNormal.y;
      surfaceNormals[vertexIndex * 3 + 2] = surfaceNormal.z;
      paintedColors[vertexIndex * 3] = paintedLight * 1.04;
      paintedColors[vertexIndex * 3 + 1] = paintedLight;
      paintedColors[vertexIndex * 3 + 2] = paintedLight * 0.92;
    }
  }

  geometry.setAttribute(
    "ambuteCardCenter",
    new THREE.BufferAttribute(centers, 3)
  );
  geometry.setAttribute(
    "ambuteCardCorner",
    new THREE.BufferAttribute(corners, 2)
  );
  geometry.setAttribute(
    "ambuteCardPhase",
    new THREE.BufferAttribute(phases, 1)
  );
  geometry.setAttribute(
    "ambuteCardRotation",
    new THREE.BufferAttribute(rotations, 2)
  );
  geometry.setAttribute(
    "ambuteCardSurfaceNormal",
    new THREE.BufferAttribute(surfaceNormals, 3)
  );
  geometry.deleteAttribute("color_1");
  geometry.deleteAttribute("color");
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(paintedColors, 3)
  );
  geometry.deleteAttribute("normal");
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPaintedLeafMaterial(texture) {
  const uniforms = {
    ambuteLeafTime: { value: 0 },
    ambuteLeafWindStrength: { value: 0 }
  };
  const material = new THREE.MeshBasicMaterial({
    color: createRelativeTreeTint(0x8fa568, 0x849a54),
    map: texture,
    vertexColors: true,
    alphaTest: 0.52,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: true,
    fog: true
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "attribute vec3 ambuteCardCenter;",
          "attribute vec2 ambuteCardCorner;",
          "attribute float ambuteCardPhase;",
          "attribute vec2 ambuteCardRotation;",
          "attribute vec3 ambuteCardSurfaceNormal;",
          "uniform float ambuteLeafTime;",
          "uniform float ambuteLeafWindStrength;"
        ].join("\n")
      )
      .replace(
        "#include <project_vertex>",
        [
          "vec3 ambuteCenter = ambuteCardCenter;",
          "float ambuteCrownHeight = smoothstep(4.0, 6.9, ambuteCenter.y);",
          // Move neighboring leaves as one canopy mass so their front-to-back
          // order does not continually swap during the breeze.
          "float ambuteSway = sin(ambuteLeafTime * 0.72 + ambuteCenter.y * 0.18);",
          "ambuteCenter.x += ambuteSway * 0.014 * ambuteCrownHeight * ambuteLeafWindStrength;",
          // The asset stores a painted outward normal per card. Use it to seat
          // the leaves above the smooth core rather than flattening them onto it.
          "ambuteCenter += ambuteCardSurfaceNormal * 0.11;",
          "vec4 mvPosition = modelViewMatrix * vec4(ambuteCenter, 1.0);",
          // A stable micro-offset breaks ties between almost coplanar cards
          // without disabling their real depth or changing as they move.
          "mvPosition.z += 0.018 + fract(ambuteCardPhase * 0.15915494) * 0.003;",
          "float ambuteSlowWave = sin(ambuteLeafTime * 3.60 + ambuteCardPhase * 6.28318);",
          "float ambuteBladeFlutter = ambuteSlowWave * 0.004 * ambuteLeafWindStrength;",
          "float cosF = cos(ambuteBladeFlutter);",
          "float sinF = sin(ambuteBladeFlutter);",
          "vec2 ambuteDynamicRotation = vec2(",
          "  ambuteCardRotation.x * cosF - ambuteCardRotation.y * sinF,",
          "  ambuteCardRotation.x * sinF + ambuteCardRotation.y * cosF",
          ");",
          "vec2 ambuteRolledCorner = vec2(",
          "  ambuteCardCorner.x * ambuteDynamicRotation.x - ambuteCardCorner.y * ambuteDynamicRotation.y,",
          "  ambuteCardCorner.x * ambuteDynamicRotation.y + ambuteCardCorner.y * ambuteDynamicRotation.x",
          ");",
          "mvPosition.xy -= ambuteRolledCorner * 1.22;",
          "gl_Position = projectionMatrix * mvPosition;"
        ].join("\n")
      );
  };
  material.customProgramCacheKey = () =>
    "ambute-painted-tree-leaves-billboard-site-v4";
  material.needsUpdate = true;

  return {
    material,
    update(timeSeconds, active) {
      uniforms.ambuteLeafTime.value = Number.isFinite(timeSeconds)
        ? timeSeconds % 10000
        : 0;
      uniforms.ambuteLeafWindStrength.value = active ? 1 : 0;
    }
  };
}

export function createPaintedTree(gltf, leafTexture) {
  const sourceRoot = gltf.scene;
  sourceRoot.updateMatrixWorld(true);
  const trunkSource = sourceRoot.getObjectByName("Tree_Trunk");
  const leafSource = sourceRoot.getObjectByName("Canopy_Painted_Leaf_Cards");
  const coreSources = [];
  sourceRoot.traverse((child) => {
    if (child.isMesh && child.name.startsWith("Canopy_Core_")) {
      coreSources.push(child);
    }
  });

  if (!trunkSource?.isMesh || !leafSource?.isMesh || coreSources.length === 0) {
    throw new Error("The painted tree is missing its trunk, cores, or leaf cards.");
  }

  leafTexture.colorSpace = THREE.SRGBColorSpace;
  leafTexture.minFilter = THREE.LinearMipmapLinearFilter;
  leafTexture.magFilter = THREE.LinearFilter;
  leafTexture.generateMipmaps = true;

  const root = new THREE.Group();
  const trunk = new THREE.Mesh(
    cloneWorldSpaceGeometry(trunkSource),
    new THREE.MeshStandardMaterial({
      color: 0x855b3f,
      roughness: 0.96,
      metalness: 0
    })
  );
  trunk.name = "painted-tree-trunk";
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  root.add(trunk);

  const coreParts = coreSources.map((source) =>
    scaleGeometryAroundCenter(cloneWorldSpaceGeometry(source), 0.95)
  );
  const coreGeometry = mergeGeometries(coreParts, false);
  coreParts.forEach((geometry) => geometry.dispose());
  if (!coreGeometry) throw new Error("Unable to merge the painted canopy cores.");
  const cores = new THREE.Mesh(
    coreGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x657b45,
      roughness: 1,
      metalness: 0
    })
  );
  cores.name = "painted-tree-canopy-cores";
  cores.castShadow = true;
  cores.receiveShadow = true;
  root.add(cores);

  const sourceLeafGeometry = cloneWorldSpaceGeometry(leafSource);
  const leafGeometry = preparePaintedLeafCardGeometry(sourceLeafGeometry);
  sourceLeafGeometry.dispose();
  const leafController = createPaintedLeafMaterial(leafTexture);
  const leaves = new THREE.Mesh(leafGeometry, leafController.material);
  leaves.name = "painted-tree-leaf-cards";
  leaves.frustumCulled = false;
  leaves.castShadow = false;
  leaves.receiveShadow = false;
  root.add(leaves);

  return {
    root,
    update(timeSeconds, active) {
      leafController.update(timeSeconds, active);
    }
  };
}

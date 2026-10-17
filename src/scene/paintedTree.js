import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const CARD_VERTEX_COUNT = 4;
const PAINTED_TREE_ATLAS_ANCHOR_COLOR = 0x849a54;
const SUMMER_TREE_COLOR = new THREE.Color(0x8fa568);
const CANOPY_ANCHOR_COLOR = new THREE.Color(PAINTED_TREE_ATLAS_ANCHOR_COLOR);

function writeSeasonTint(target, output) {
  output.setRGB(
    THREE.MathUtils.clamp(target.r / Math.max(SUMMER_TREE_COLOR.r, 0.001), 0.12, 4.5),
    THREE.MathUtils.clamp(target.g / Math.max(SUMMER_TREE_COLOR.g, 0.001), 0.12, 4.5),
    THREE.MathUtils.clamp(target.b / Math.max(SUMMER_TREE_COLOR.b, 0.001), 0.12, 4.5)
  );
  return output;
}

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

function createPaintedLightingUniforms() {
  return {
    ambuteTreeSunDirection: {
      value: new THREE.Vector3(0.2, 0.85, 0.48).normalize()
    },
    ambuteTreeSunColor: { value: new THREE.Color(0xfff4e0) },
    ambuteTreeSunStrength: { value: 0.55 },
    ambuteTreeAmbientColor: { value: new THREE.Color(0xffeedd) },
    ambuteTreeAmbientStrength: { value: 0.35 },
    ambuteTreeSkyColor: { value: new THREE.Color(0xd8e7ee) },
    ambuteTreeGroundColor: { value: new THREE.Color(0xc1aa84) },
    ambuteTreeSkyStrength: { value: 0 }
  };
}

function updatePaintedLighting(uniforms, sun, ambient, skyFill, direction) {
  if (sun) {
    direction.copy(sun.position);
    if (sun.target) direction.sub(sun.target.position);
    if (direction.lengthSq() > 0.0001) direction.normalize();
    uniforms.ambuteTreeSunDirection.value.copy(direction);
    uniforms.ambuteTreeSunColor.value.copy(sun.color);
    uniforms.ambuteTreeSunStrength.value = THREE.MathUtils.clamp(
      sun.intensity / 2.4,
      0,
      1.1
    );
  }
  if (ambient) {
    uniforms.ambuteTreeAmbientColor.value.copy(ambient.color);
    uniforms.ambuteTreeAmbientStrength.value = THREE.MathUtils.clamp(
      ambient.intensity,
      0,
      1.2
    );
  }
  if (skyFill) {
    uniforms.ambuteTreeSkyColor.value.copy(skyFill.color);
    uniforms.ambuteTreeGroundColor.value.copy(skyFill.groundColor);
    uniforms.ambuteTreeSkyStrength.value = THREE.MathUtils.clamp(
      skyFill.intensity,
      0,
      1.2
    );
  }
}

function paintedLightingDeclarations() {
  return [
    "uniform vec3 ambuteTreeSunDirection;",
    "uniform vec3 ambuteTreeSunColor;",
    "uniform float ambuteTreeSunStrength;",
    "uniform vec3 ambuteTreeAmbientColor;",
    "uniform float ambuteTreeAmbientStrength;",
    "uniform vec3 ambuteTreeSkyColor;",
    "uniform vec3 ambuteTreeGroundColor;",
    "uniform float ambuteTreeSkyStrength;",
    "varying vec3 vAmbutePaintedTreeLight;"
  ];
}

function paintedLightingVertexLines(positionExpression) {
  return [
    `vec3 ambutePaintedPosition = ${positionExpression};`,
    "vec3 ambutePaintedNormal = normalize(vec3(",
    "  ambutePaintedPosition.x * 0.42,",
    "  max(0.16, (ambutePaintedPosition.y - 4.28) * 0.82),",
    "  ambutePaintedPosition.z * 0.62",
    "));",
    "ambutePaintedNormal = normalize(mat3(modelMatrix) * ambutePaintedNormal);",
    "float ambuteTopWash = smoothstep(4.10, 6.88, ambutePaintedPosition.y);",
    "float ambuteSunFacing = smoothstep(-0.18, 0.92, dot(ambutePaintedNormal, normalize(ambuteTreeSunDirection)));",
    "float ambuteSkyFacing = smoothstep(-0.34, 0.88, ambutePaintedNormal.y);",
    "float ambuteRadialDistance = length(vec2(ambutePaintedPosition.x, ambutePaintedPosition.z));",
    "float ambuteInnerShade = (1.0 - ambuteTopWash)",
    "  * (1.0 - smoothstep(0.45, 2.40, ambuteRadialDistance));",
    "float ambuteLowerShade = (1.0 - ambuteTopWash) * (1.0 - ambuteSkyFacing);",
    "float ambuteHemisphereMix = clamp(ambutePaintedNormal.y * 0.5 + 0.5, 0.0, 1.0);",
    "vec3 ambuteAmbientTint = mix(vec3(1.0), ambuteTreeAmbientColor, 0.24);",
    "vec3 ambuteSunTint = mix(vec3(1.0), ambuteTreeSunColor, 0.40);",
    "vec3 ambuteHemisphereTint = mix(ambuteTreeGroundColor, ambuteTreeSkyColor, ambuteHemisphereMix);",
    "vec3 ambutePaintedLight = ambuteAmbientTint * (0.18 + ambuteTreeAmbientStrength * 0.92);",
    "ambutePaintedLight += ambuteHemisphereTint * ambuteTreeSkyStrength * (0.20 + ambuteSkyFacing * 0.44);",
    "float ambuteCrownSunlight = ambuteTopWash * (0.28 + ambuteSunFacing * 0.44);",
    "ambutePaintedLight += ambuteSunTint * ambuteTreeSunStrength * (0.025 + ambuteSunFacing * 0.52 + ambuteCrownSunlight);",
    "ambutePaintedLight += vec3(ambuteSkyFacing * ambuteTreeAmbientStrength * 0.08);",
    "ambutePaintedLight -= vec3(ambuteInnerShade * 0.14 + ambuteLowerShade * 0.12);",
    "ambutePaintedLight = clamp(ambutePaintedLight, vec3(0.48), vec3(1.55));",
    "float ambuteLowerCanopyOcclusion = mix(",
    "  0.68,",
    "  1.0,",
    "  smoothstep(4.10, 6.20, ambutePaintedPosition.y)",
    ");",
    // The website runs at a brighter filmic exposure than the game. Apply the
    // same wash to both layers, then compensate once so the atlas green stays
    // recognisable instead of bleaching toward yellow.
    "vAmbutePaintedTreeLight = ambutePaintedLight * ambuteLowerCanopyOcclusion * 0.70;"
  ];
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
  const encodedNormals =
    geometry.getAttribute("color_1") || geometry.getAttribute("color");
  const points = Array.from({ length: CARD_VERTEX_COUNT }, () =>
    new THREE.Vector3()
  );
  const center = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();

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
  geometry.deleteAttribute("normal");
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCanopyGapLeafGeometry() {
  const center = new THREE.Vector3(-0.82, 6.64, 0.78);
  const width = 0.48;
  const height = 0.44;
  const roll = THREE.MathUtils.degToRad(11);
  const rotation = [Math.cos(roll), Math.sin(roll)];
  const phase = stablePhase(center.x, center.y, center.z);
  const surfaceNormal = new THREE.Vector3(-0.08, 0.96, 0.2).normalize();
  const corners = [
    [-0.5 * width, -0.5 * height],
    [0.5 * width, -0.5 * height],
    [0.5 * width, 0.5 * height],
    [-0.5 * width, 0.5 * height]
  ];
  const positions = [];
  const centers = [];
  const cardCorners = [];
  const phases = [];
  const rotations = [];
  const surfaceNormals = [];

  corners.forEach(([x, y]) => {
    positions.push(center.x + x, center.y + y, center.z);
    centers.push(center.x, center.y, center.z);
    cardCorners.push(x, y);
    phases.push(phase);
    rotations.push(...rotation);
    surfaceNormals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [0.504, 0.004, 0.996, 0.004, 0.996, 0.496, 0.504, 0.496],
      2
    )
  );
  geometry.setAttribute(
    "ambuteCardCenter",
    new THREE.Float32BufferAttribute(centers, 3)
  );
  geometry.setAttribute(
    "ambuteCardCorner",
    new THREE.Float32BufferAttribute(cardCorners, 2)
  );
  geometry.setAttribute(
    "ambuteCardPhase",
    new THREE.Float32BufferAttribute(phases, 1)
  );
  geometry.setAttribute(
    "ambuteCardRotation",
    new THREE.Float32BufferAttribute(rotations, 2)
  );
  geometry.setAttribute(
    "ambuteCardSurfaceNormal",
    new THREE.Float32BufferAttribute(surfaceNormals, 3)
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPaintedLeafMaterial(texture) {
  const uniforms = {
    ...createPaintedLightingUniforms(),
    ambuteLeafTime: { value: 0 },
    ambuteLeafWindStrength: { value: 0 }
  };
  const lightDirection = new THREE.Vector3();
  const seasonTint = new THREE.Color(0xffffff);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: texture,
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
          "uniform float ambuteLeafWindStrength;",
          ...paintedLightingDeclarations()
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
          "ambuteCenter += ambuteCardSurfaceNormal * 0.015;",
          ...paintedLightingVertexLines("ambuteCenter"),
          "vec4 mvPosition = modelViewMatrix * vec4(ambuteCenter, 1.0);",
          // A stable micro-offset breaks ties between almost coplanar cards
          // without disabling their real depth or changing as they move.
          "float ambuteModelScale = length(modelMatrix[0].xyz);",
          "mvPosition.z += (0.018 + fract(ambuteCardPhase * 0.15915494) * 0.003) * ambuteModelScale;",
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
          // Card corners are reconstructed in view space, so explicitly apply
          // the complete parent scale used by the responsive island layout.
          "mvPosition.xy -= ambuteRolledCorner * 1.34 * ambuteModelScale;",
          "gl_Position = projectionMatrix * mvPosition;"
        ].join("\n")
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec3 vAmbutePaintedTreeLight;"
        ].join("\n")
      )
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          "diffuseColor.rgb *= vAmbutePaintedTreeLight;"
        ].join("\n")
      );
  };
  material.customProgramCacheKey = () =>
    "ambute-painted-tree-leaves-billboard-site-v6";
  material.needsUpdate = true;

  return {
    material,
    update(timeSeconds, active, lighting) {
      uniforms.ambuteLeafTime.value = Number.isFinite(timeSeconds)
        ? timeSeconds % 10000
        : 0;
      uniforms.ambuteLeafWindStrength.value = active ? 1 : 0;
      updatePaintedLighting(
        uniforms,
        lighting?.sun,
        lighting?.ambient,
        lighting?.skyFill,
        lightDirection
      );
    },
    setSeasonColor(color) {
      if (!color?.isColor) return;
      material.color.copy(writeSeasonTint(color, seasonTint));
    }
  };
}

function createPaintedCoreMaterial() {
  const uniforms = createPaintedLightingUniforms();
  const lightDirection = new THREE.Vector3();
  const seasonTint = new THREE.Color(0xffffff);
  const material = new THREE.MeshBasicMaterial({
    color: PAINTED_TREE_ATLAS_ANCHOR_COLOR,
    toneMapped: true,
    fog: true
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        ["#include <common>", ...paintedLightingDeclarations()].join("\n")
      )
      .replace(
        "#include <begin_vertex>",
        ["#include <begin_vertex>", "vec3 ambuteCorePosition = transformed;"].join("\n")
      )
      .replace(
        "#include <project_vertex>",
        [
          ...paintedLightingVertexLines("ambuteCorePosition"),
          "#include <project_vertex>"
        ].join("\n")
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec3 vAmbutePaintedTreeLight;"
        ].join("\n")
      )
      .replace(
        "#include <color_fragment>",
        [
          "#include <color_fragment>",
          "diffuseColor.rgb *= vAmbutePaintedTreeLight;"
        ].join("\n")
      );
  };
  material.customProgramCacheKey = () => "ambute-painted-tree-core-site-v1";
  material.needsUpdate = true;

  return {
    material,
    update(lighting) {
      updatePaintedLighting(
        uniforms,
        lighting?.sun,
        lighting?.ambient,
        lighting?.skyFill,
        lightDirection
      );
    },
    setSeasonColor(color) {
      if (!color?.isColor) return;
      material.color
        .copy(CANOPY_ANCHOR_COLOR)
        .multiply(writeSeasonTint(color, seasonTint));
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
    cloneWorldSpaceGeometry(source)
  );
  const coreGeometry = mergeGeometries(coreParts, false);
  coreParts.forEach((geometry) => geometry.dispose());
  if (!coreGeometry) throw new Error("Unable to merge the painted canopy cores.");
  const coreController = createPaintedCoreMaterial();
  const cores = new THREE.Mesh(
    coreGeometry,
    coreController.material
  );
  cores.name = "painted-tree-canopy-cores";
  cores.castShadow = true;
  cores.receiveShadow = false;
  root.add(cores);

  const sourceLeafGeometry = cloneWorldSpaceGeometry(leafSource);
  const preparedLeafGeometry = preparePaintedLeafCardGeometry(sourceLeafGeometry);
  const gapLeafGeometry = createCanopyGapLeafGeometry();
  const leafGeometry = mergeGeometries(
    [preparedLeafGeometry, gapLeafGeometry],
    false
  );
  sourceLeafGeometry.dispose();
  preparedLeafGeometry.dispose();
  gapLeafGeometry.dispose();
  if (!leafGeometry) throw new Error("Unable to add the canopy gap leaf card.");
  const leafController = createPaintedLeafMaterial(leafTexture);
  const leaves = new THREE.Mesh(leafGeometry, leafController.material);
  leaves.name = "painted-tree-leaf-cards";
  leaves.frustumCulled = false;
  leaves.castShadow = false;
  leaves.receiveShadow = false;
  root.add(leaves);

  return {
    root,
    update(timeSeconds, active, lighting) {
      leafController.update(timeSeconds, active, lighting);
      coreController.update(lighting);
    },
    setSeasonColor(color) {
      leafController.setSeasonColor(color);
      coreController.setSeasonColor(color);
    }
  };
}

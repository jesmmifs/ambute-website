import * as THREE from "three";

const DESKTOP_BLADE_COUNT = 2200;
const MOBILE_BLADE_COUNT = 850;
const DEFAULT_CAMERA_POSITION = { x: 0, z: 8.8 };

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function createBladeGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.026, 0, 0, 0.026, 0, 0, 0.04, 0.128, 0, 0.022, 0.192, 0,
        0, 0.205, 0, -0.022, 0.192, 0, -0.04, 0.128, 0
      ],
      3
    )
  );
  geometry.setIndex([0, 1, 2, 0, 2, 6, 6, 2, 3, 6, 3, 5, 5, 3, 4]);
  geometry.computeVertexNormals();
  return geometry;
}

function createGrassMaterial() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.ShaderLib.lambert.uniforms,
    {
      uTime: { value: 0 },
      uWindSpeed: { value: 1 },
      uTopColor: { value: new THREE.Color(0x5d733b) },
      uBottomColor: { value: new THREE.Color(0x5d733b) }
    }
  ]);

  let vertexShader = THREE.ShaderLib.lambert.vertexShader;
  vertexShader = vertexShader.replace(
    "#include <common>",
    `
      #include <common>
      uniform float uTime;
      uniform float uWindSpeed;
      attribute float aOffset;
      attribute float aWindScale;
      varying float vHeight;
      varying float vBladeLocalX;
      varying float vPaintedVariation;
    `
  );
  vertexShader = vertexShader.replace(
    "#include <beginnormal_vertex>",
    `
      vec3 objectNormal = vec3(normal);
      objectNormal = mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.75);
    `
  );
  vertexShader = vertexShader.replace(
    "#include <begin_vertex>",
    `
      #include <begin_vertex>
      vHeight = clamp(position.y / 0.205, 0.0, 1.0);
      vBladeLocalX = position.x;
      float hash = fract(sin(aOffset * 12.9898) * 43758.5453);
      float isLighter = 1.0 - step(0.10, hash);
      float isDarker = step(0.10, hash) * (1.0 - step(0.20, hash));
      vPaintedVariation = 1.0 + (isLighter * 0.15) - (isDarker * 0.15);
    `
  );
  vertexShader = vertexShader.replace(
    "#include <project_vertex>",
    `
      vec4 mvPosition = vec4(transformed, 1.0);

      #ifdef USE_BATCHING
        mvPosition = batchingMatrix * mvPosition;
      #endif

      vec2 origin = vec2(0.0);
      #ifdef USE_INSTANCING
        origin = instanceMatrix[3].xz;
        mvPosition = instanceMatrix * mvPosition;
      #endif

      float wind = clamp(uWindSpeed, 0.0, 3.8);
      float calmFactor = smoothstep(0.04, 0.40, wind);
      vec2 windDir = normalize(vec2(0.82, 0.57));
      vec2 crossDir = vec2(-windDir.y, windDir.x);
      float travel = dot(origin, windDir);
      float broadWave = sin(
        uTime * (0.88 + wind * 0.11) + travel * 1.15 + aOffset
      );
      float localWave = sin(
        uTime * 1.72 + aOffset * 2.37 + origin.x * 2.1
      );
      float broadAmplitude = min(0.075, 0.034 + 0.018 * wind) * calmFactor;
      float localAmplitude =
        (0.009 + 0.005 * min(wind, 3.0)) * calmFactor;
      float sideAmount =
        (0.006 + 0.004 * min(wind, 2.8)) * calmFactor *
        sin(uTime * 1.24 + aOffset + origin.y * 1.7);
      float bendAmount =
        (broadWave * broadAmplitude + localWave * localAmplitude) *
        aWindScale;
      vec2 bend = windDir * bendAmount + crossDir * sideAmount;
      mvPosition.xz += bend * pow(vHeight, 1.62);

      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `
  );

  let fragmentShader = THREE.ShaderLib.lambert.fragmentShader;
  fragmentShader = fragmentShader.replace(
    "#include <common>",
    `
      #include <common>
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      varying float vHeight;
      varying float vBladeLocalX;
      varying float vPaintedVariation;
    `
  );
  fragmentShader = fragmentShader.replace(
    "#include <color_fragment>",
    `
      #include <color_fragment>
      vec3 gradientTop = uTopColor * 0.75;
      diffuseColor.rgb = mix(uBottomColor, gradientTop, vHeight);
      diffuseColor.rgb *= vPaintedVariation;

      float bladeHalfWidth;
      if (vHeight < 0.624) {
        bladeHalfWidth = mix(0.026, 0.040, vHeight / 0.624);
      } else if (vHeight < 0.937) {
        bladeHalfWidth = mix(0.040, 0.022, (vHeight - 0.624) / 0.313);
      } else {
        bladeHalfWidth = mix(0.022, 0.0, (vHeight - 0.937) / 0.063);
      }
      float bladeEdgeDistance =
        max(0.0, bladeHalfWidth - abs(vBladeLocalX));
      float bladeEdgeAA = max(fwidth(bladeEdgeDistance), 0.00015);
      float bladeOutline = 1.0 - smoothstep(
        bladeEdgeAA * 0.55,
        bladeEdgeAA * 1.85,
        bladeEdgeDistance
      );
      bladeOutline *= smoothstep(0.04, 0.20, vHeight);
      vec3 bladeOutlineColor = diffuseColor.rgb * 0.82;
      diffuseColor.rgb = mix(
        diffuseColor.rgb,
        bladeOutlineColor,
        bladeOutline * 0.72
      );
    `
  );

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    lights: true,
    side: THREE.DoubleSide,
    extensions: { derivatives: true }
  });
}

export function createIslandGrass() {
  const geometry = createBladeGeometry();
  const offsets = new Float32Array(DESKTOP_BLADE_COUNT);
  const windScales = new Float32Array(DESKTOP_BLADE_COUNT);
  const placements = [];
  const material = createGrassMaterial();

  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    DESKTOP_BLADE_COUNT
  );
  const dummy = new THREE.Object3D();
  const random = seededRandom(8217);
  let placed = 0;

  while (placed < DESKTOP_BLADE_COUNT) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = Math.cos(angle) * radius * 2.16;
    const z = Math.sin(angle) * radius * 1.42;
    const treeDistance = Math.hypot(x + 0.82, z + 0.34);
    const popiDistance = Math.hypot(x - 0.48, z - 0.2);
    if (treeDistance < 0.53) continue;

    const edge = 1 - radius;
    const heightScale = 0.58 + random() * 0.62;
    const popiClearance =
      0.08 +
      THREE.MathUtils.smoothstep(popiDistance, 0.28, 0.96) * 0.92;
    const edgeScale = THREE.MathUtils.smoothstep(edge, 0.02, 0.16);
    const y = 0.105 + (1 - radius * radius) * 0.025;
    const scaleX = 0.72 + random() * 0.55;
    const scaleY =
      heightScale * (0.62 + edgeScale * 0.38) * popiClearance;
    const scaleZ = 0.72 + random() * 0.55;
    const facingOffset = THREE.MathUtils.degToRad((random() - 0.5) * 16);
    dummy.position.set(x, y, z);
    dummy.rotation.set(
      0,
      Math.atan2(
        DEFAULT_CAMERA_POSITION.x - x,
        DEFAULT_CAMERA_POSITION.z - z
      ) + facingOffset,
      0
    );
    dummy.scale.set(scaleX, scaleY, scaleZ);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placements.push({
      x,
      y,
      z,
      scaleX,
      scaleY,
      scaleZ,
      facingOffset
    });
    offsets[placed] = random() * Math.PI * 2;
    windScales[placed] = Math.min(1, heightScale);
    placed += 1;
  }

  geometry.setAttribute(
    "aOffset",
    new THREE.InstancedBufferAttribute(offsets, 1)
  );
  geometry.setAttribute(
    "aWindScale",
    new THREE.InstancedBufferAttribute(windScales, 1)
  );
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;

  let lastCameraX = DEFAULT_CAMERA_POSITION.x;
  let lastCameraZ = DEFAULT_CAMERA_POSITION.z;

  return {
    mesh,
    orientToCamera(cameraPosition) {
      if (!cameraPosition) return;
      const cameraX = Number(cameraPosition.x);
      const cameraZ = Number(cameraPosition.z);
      if (!Number.isFinite(cameraX) || !Number.isFinite(cameraZ)) return;
      if (
        Math.abs(cameraX - lastCameraX) < 0.01 &&
        Math.abs(cameraZ - lastCameraZ) < 0.01
      ) {
        return;
      }

      placements.forEach((placement, index) => {
        dummy.position.set(placement.x, placement.y, placement.z);
        dummy.rotation.set(
          0,
          Math.atan2(
            cameraX - placement.x,
            cameraZ - placement.z
          ) + placement.facingOffset,
          0
        );
        dummy.scale.set(
          placement.scaleX,
          placement.scaleY,
          placement.scaleZ
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      lastCameraX = cameraX;
      lastCameraZ = cameraZ;
    },
    setCompact(compact) {
      mesh.count = compact ? MOBILE_BLADE_COUNT : DESKTOP_BLADE_COUNT;
    },
    setSeasonColor(color) {
      if (!color?.isColor) return;
      material.uniforms.uTopColor.value.copy(color);
      material.uniforms.uBottomColor.value.copy(color);
    },
    update(timeSeconds, motion = true) {
      material.uniforms.uTime.value = motion ? timeSeconds % 10000 : 0.8;
      material.uniforms.uWindSpeed.value = motion ? 1 : 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createIslandGrass } from "./islandGrass";
import { createPaintedTree } from "./paintedTree";

const POPI_HEIGHT = 1.64;
const INITIAL_SCRATCH_DELAY_MS = 15000;
const INITIAL_SCRATCH_JITTER_MS = 7000;
const SCRATCH_COOLDOWN_MS = 24000;
const SCRATCH_COOLDOWN_JITTER_MS = 14000;

function irregularity(angle) {
  return (
    1 +
    Math.sin(angle * 3 + 0.75) * 0.035 +
    Math.sin(angle * 7 - 0.4) * 0.02 +
    Math.cos(angle * 11 + 1.2) * 0.012
  );
}

function softenCylinder(geometry, verticalAmount = 0.02) {
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const radius = Math.hypot(x, z);
    if (radius < 0.01) continue;
    const angle = Math.atan2(z, x);
    const shape = irregularity(angle);
    positions.setXYZ(
      index,
      x * shape,
      y + Math.sin(angle * 5.4) * verticalAmount,
      z * shape
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function paintEarthGeometry(geometry) {
  const positions = geometry.getAttribute("position");
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const height = Math.max(0.001, max.y - min.y);
  const colors = new Float32Array(positions.count * 3);
  const lowerColor = new THREE.Color(0x603a2b);
  const middleColor = new THREE.Color(0x9a6243);
  const upperColor = new THREE.Color(0xb97a50);
  const contactColor = new THREE.Color(0x542f22);
  const color = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const heightAmount = THREE.MathUtils.clamp((y - min.y) / height, 0, 1);
    const angle = Math.atan2(z, x);

    color.copy(lowerColor).lerp(
      middleColor,
      THREE.MathUtils.smoothstep(heightAmount, 0.08, 0.58)
    );
    color.lerp(
      upperColor,
      THREE.MathUtils.smoothstep(heightAmount, 0.46, 0.86) * 0.72
    );

    // A soft shadow directly beneath the turf makes the green ledge feel as
    // though it sits above the exposed earth instead of being painted onto it.
    const contactShadow = THREE.MathUtils.smoothstep(heightAmount, 0.78, 0.98);
    color.lerp(contactColor, contactShadow * 0.68);

    // Broad, low-frequency variation catches the sunlight without turning the
    // island into striped or photorealistic soil.
    const sunFacing = 0.5 + 0.5 * Math.cos(angle + 0.72);
    const paintedVariation =
      Math.sin(angle * 3.0 + heightAmount * 4.2) * 0.035 +
      Math.sin(angle * 7.0 - heightAmount * 2.4) * 0.018;
    color.multiplyScalar(0.94 + sunFacing * 0.16 + paintedVariation);

    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function fitAsset(root, height) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const wrapper = new THREE.Group();
  if (size.y > 0) root.scale.multiplyScalar(height / size.y);
  root.updateMatrixWorld(true);
  box.setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  wrapper.add(root);
  return wrapper;
}

function cloneMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => material.clone());
    } else if (object.material) {
      object.material = object.material.clone();
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.filter(Boolean).forEach((material) => {
      if (material.aoMap && object.geometry?.attributes?.uv) {
        if (!object.geometry.attributes.uv2) {
          object.geometry.setAttribute("uv2", object.geometry.attributes.uv);
        }
        material.aoMapIntensity = 1.1;
      }
      material.needsUpdate = true;
    });
  });
}

function createIslandBase() {
  const group = new THREE.Group();
  const earthMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
    metalness: 0,
    flatShading: true
  });
  const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d733b,
    roughness: 0.96,
    metalness: 0
  });

  const earth = new THREE.Mesh(
    paintEarthGeometry(
      softenCylinder(
        new THREE.CylinderGeometry(2.25, 0.96, 1.12, 72, 7),
        0.026
      )
    ),
    earthMaterial
  );
  earth.scale.z = 0.68;
  earth.position.y = -0.48;
  earth.castShadow = true;
  earth.receiveShadow = true;
  group.add(earth);

  const turf = new THREE.Mesh(
    softenCylinder(
      new THREE.CylinderGeometry(2.3, 2.22, 0.2, 80, 2),
      0.018
    ),
    grassMaterial
  );
  turf.scale.z = 0.68;
  turf.position.y = 0.08;
  turf.castShadow = true;
  turf.receiveShadow = true;
  group.add(turf);

  return group;
}

function disposeGraph(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

export function createIslandWorld(assetUrl, onReady) {
  const group = new THREE.Group();
  const floatingRoot = new THREE.Group();
  group.add(floatingRoot);
  floatingRoot.add(createIslandBase());

  const grass = createIslandGrass();
  floatingRoot.add(grass.mesh);

  const shadowTextureCanvas = document.createElement("canvas");
  shadowTextureCanvas.width = 256;
  shadowTextureCanvas.height = 128;
  const shadowContext = shadowTextureCanvas.getContext("2d");
  const shadowGradient = shadowContext.createRadialGradient(
    128,
    64,
    0,
    128,
    64,
    125
  );
  shadowGradient.addColorStop(0, "rgba(36,46,33,.24)");
  shadowGradient.addColorStop(1, "rgba(36,46,33,0)");
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 256, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowTextureCanvas);
  const islandShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 2.5),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false
    })
  );
  islandShadow.rotation.x = -Math.PI / 2;
  islandShadow.position.y = -1.36;
  floatingRoot.add(islandShadow);

  let reducedMotion = false;
  let loadPromise = null;
  let mixer = null;
  let standbyAction = null;
  let scratchAction = null;
  let scratchPlaying = false;
  let nextScratchAt = Infinity;
  let previousTime = 0;
  let paintedTree = null;
  const neutralFaceMeshes = [];
  const localCameraPosition = new THREE.Vector3();

  function scheduleNextScratch(now, initial = false) {
    const delay = initial
      ? INITIAL_SCRATCH_DELAY_MS + Math.random() * INITIAL_SCRATCH_JITTER_MS
      : SCRATCH_COOLDOWN_MS + Math.random() * SCRATCH_COOLDOWN_JITTER_MS;
    nextScratchAt = now + delay;
  }

  function handleScratchFinished({ action }) {
    if (action !== scratchAction || !standbyAction) return;
    scratchPlaying = false;
    scratchAction.fadeOut(0.55);
    standbyAction.reset().fadeIn(0.55).play();
    // Schedule from the actual finish time. Advancing the old deadline could
    // leave it in the past after a slow load or hidden tab and immediately
    // start another belly scratch.
    scheduleNextScratch(previousTime || performance.now());
  }

  function prepareTree(gltf, leafTexture) {
    paintedTree = createPaintedTree(gltf, leafTexture);
    const wrapper = fitAsset(paintedTree.root, 3.5);
    wrapper.position.set(-0.88, 0.15, -0.5);
    wrapper.rotation.y = 0.2;
    floatingRoot.add(wrapper);
    disposeGraph(gltf.scene);
  }

  function setNeutralFace(blinkAmount = 0) {
    neutralFaceMeshes.forEach((mesh) => {
      const dictionary = mesh.morphTargetDictionary || {};
      const influences = mesh.morphTargetInfluences;
      if (!influences) return;
      Object.entries(dictionary).forEach(([name, index]) => {
        influences[index] = name === "Eye_Blink" ? blinkAmount : 0;
      });
    });
  }

  function preparePopi(gltf) {
    const popi = gltf.scene;
    cloneMaterials(popi);
    popi.traverse((object) => {
      if (object.morphTargetDictionary && object.morphTargetInfluences) {
        neutralFaceMeshes.push(object);
      }
    });
    setNeutralFace(0);
    const wrapper = fitAsset(popi, POPI_HEIGHT);
    wrapper.position.set(0.5, 0.16, 0.22);
    wrapper.rotation.y = -0.12;
    floatingRoot.add(wrapper);

    mixer = new THREE.AnimationMixer(popi);
    const clips = gltf.animations || [];
    const standbyClip = clips.find((clip) => clip.name === "Idle_Standby");
    const scratchClip = clips.find((clip) => clip.name === "Idle_BellyScratch");
    if (standbyClip) {
      standbyAction = mixer.clipAction(standbyClip);
      standbyAction.setLoop(THREE.LoopRepeat, Infinity);
      standbyAction.play();
    }
    if (scratchClip) {
      scratchAction = mixer.clipAction(scratchClip);
      scratchAction.setLoop(THREE.LoopOnce, 1);
      scratchAction.clampWhenFinished = true;
      mixer.addEventListener("finished", handleScratchFinished);
      scheduleNextScratch(previousTime || performance.now(), true);
    }
    return clips.map((clip) => clip.name);
  }

  function load() {
    if (loadPromise) return loadPromise;
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    loadPromise = Promise.allSettled([
      loader.loadAsync(assetUrl("characters/Popi_LabPreview.glb")),
      loader.loadAsync(assetUrl("world/ambute-painted-tree.glb")),
      textureLoader.loadAsync(
        assetUrl("world/ambute-painted-leaf-atlas-watercolor-v3.png")
      )
    ]).then(([popiResult, treeResult, leafResult]) => {
      const clips =
        popiResult.status === "fulfilled" ? preparePopi(popiResult.value) : [];
      if (treeResult.status === "fulfilled" && leafResult.status === "fulfilled") {
        prepareTree(treeResult.value, leafResult.value);
      }
      onReady?.({ clips });
      return { clips };
    });
    return loadPromise;
  }

  function update(now, camera) {
    const seconds = now * 0.001;
    const motion = !reducedMotion;
    const delta = previousTime
      ? Math.min(0.05, (now - previousTime) / 1000)
      : 0;
    previousTime = now;
    floatingRoot.position.y = motion ? Math.sin(seconds * 0.72) * 0.035 : 0;
    floatingRoot.rotation.z = motion ? Math.sin(seconds * 0.42) * 0.004 : 0;
    grass.update(seconds, motion);
    if (camera) {
      camera.getWorldPosition(localCameraPosition);
      group.worldToLocal(localCameraPosition);
      grass.orientToCamera(localCameraPosition);
    }
    paintedTree?.update(seconds, motion);
    floatingRoot.children.forEach((child) => {
      if (child.userData.breezePhase === undefined) return;
      child.rotation.z = motion
        ? Math.sin(seconds * 1.1 + child.userData.breezePhase) * 0.035
        : 0;
    });

    if (mixer && motion) {
      mixer.update(delta);
      const blinkPhase = seconds % 4.8;
      const blinkAmount =
        blinkPhase > 4.58
          ? Math.sin(((blinkPhase - 4.58) / 0.22) * Math.PI)
          : 0;
      setNeutralFace(Math.max(0, blinkAmount));
      if (
        scratchAction &&
        standbyAction &&
        !scratchPlaying &&
        now >= nextScratchAt
      ) {
        scratchPlaying = true;
        standbyAction.fadeOut(0.55);
        scratchAction.reset().fadeIn(0.55).play();
      }
    } else {
      setNeutralFace(0);
    }
  }

  function setCompact(compact) {
    grass.setCompact(compact);
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    if (reducedMotion && mixer) mixer.setTime(0.55);
  }

  function dispose() {
    if (mixer) {
      mixer.removeEventListener("finished", handleScratchFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(mixer.getRoot());
    }
    disposeGraph(group);
  }

  return {
    group,
    load,
    update,
    setCompact,
    setReducedMotion,
    dispose
  };
}

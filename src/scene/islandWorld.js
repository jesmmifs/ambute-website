import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createIslandGrass } from "./islandGrass";
import { createPaintedTree } from "./paintedTree";

const POPI_HEIGHT = 1.64;

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

function createFlower(color, x, z, scale = 1) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.016, 0.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x456037, roughness: 0.95 })
  );
  stem.position.y = 0.1;
  stem.castShadow = true;
  stem.receiveShadow = true;
  group.add(stem);
  const petalMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    side: THREE.DoubleSide
  });
  for (let index = 0; index < 5; index += 1) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6),
      petalMaterial
    );
    const angle = (index / 5) * Math.PI * 2;
    petal.position.set(
      Math.cos(angle) * 0.052,
      0.218,
      Math.sin(angle) * 0.052
    );
    petal.scale.set(1.25, 0.42, 0.78);
    petal.castShadow = true;
    petal.receiveShadow = true;
    group.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xe7bc54, roughness: 0.7 })
  );
  center.position.y = 0.228;
  center.castShadow = true;
  center.receiveShadow = true;
  group.add(center);
  group.position.set(x, 0.11, z);
  group.scale.setScalar(scale);
  group.userData.breezePhase = x * 2.1 + z * 1.7;
  return group;
}

function createIslandBase() {
  const group = new THREE.Group();
  const earthMaterial = new THREE.MeshStandardMaterial({
    color: 0x825b3e,
    emissive: 0x2a160d,
    emissiveIntensity: 0.18,
    roughness: 0.98,
    flatShading: true
  });
  const grassMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d733b,
    roughness: 0.96,
    metalness: 0
  });

  const earth = new THREE.Mesh(
    softenCylinder(
      new THREE.CylinderGeometry(2.25, 0.96, 1.12, 72, 7),
      0.026
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

  const rocks = [
    [-1.72, 0.18, 0.46, 0.18],
    [1.68, 0.16, -0.35, 0.16],
    [1.42, 0.15, 0.83, 0.11],
    [-1.34, 0.15, -0.86, 0.12]
  ];
  rocks.forEach(([x, y, z, scale], index) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: index % 2 ? 0x776e60 : 0x887d6a,
        roughness: 1,
        flatShading: true
      })
    );
    rock.position.set(x, y, z);
    rock.scale.set(scale * 1.35, scale * 0.7, scale);
    rock.rotation.set(index * 0.17, index * 0.82, index * 0.11);
    rock.castShadow = true;
    group.add(rock);
  });

  [
    [0xf2d3d8, -1.42, 0.72, 0.82],
    [0xd8c5ef, 1.57, 0.56, 0.72],
    [0xf0cf7a, 1.32, -0.78, 0.8],
    [0xe9b59f, -1.66, -0.38, 0.68]
  ].forEach(([color, x, z, scale]) =>
    group.add(createFlower(color, x, z, scale))
  );

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
  let nextScratchAt = 15000;
  let previousTime = 0;
  let paintedTree = null;
  const neutralFaceMeshes = [];
  const localCameraPosition = new THREE.Vector3();

  function handleScratchFinished({ action }) {
    if (action !== scratchAction || !standbyAction) return;
    scratchPlaying = false;
    scratchAction.fadeOut(0.55);
    standbyAction.reset().fadeIn(0.55).play();
    nextScratchAt += 21000;
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

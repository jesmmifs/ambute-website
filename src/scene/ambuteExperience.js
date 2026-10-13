import * as THREE from "three";
import { createPrenatalForm } from "./prenatalForm";
import { createIslandWorld } from "./islandWorld";
import { createWhimsicalSky } from "./whimsicalSky";

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const mix = (start, end, amount) => start + (end - start) * amount;
const smoothstep = (start, end, value) => {
  const amount = clamp((value - start) / (end - start));
  return amount * amount * (3 - 2 * amount);
};

function publicAssetUrl(relativePath) {
  return `${import.meta.env.BASE_URL}assets/game/${relativePath}`;
}

export function createAmbuteExperience(
  mount,
  { reducedMotion = false, onReady, onWorldReady, onError } = {}
) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
  } catch (error) {
    onError?.(error);
    return {
      loadWorld: () => Promise.resolve(),
      setProgress() {},
      resize() {},
      setActive() {},
      setReducedMotion() {},
      dispose() {}
    };
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.tabIndex = -1;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const nightColor = new THREE.Color(0x030403);
  const daylightColor = new THREE.Color(0xb8d8e5);
  const nightAmbient = new THREE.Color(0xffead9);
  const daylightAmbient = new THREE.Color(0xffedda);
  const nightSky = new THREE.Color(0xffead9);
  const daylightSky = new THREE.Color(0xd8e7ee);
  const nightGround = new THREE.Color(0x301c18);
  const daylightGround = new THREE.Color(0xc1aa84);
  const nightKey = new THREE.Color(0xffd7bc);
  const daylightKey = new THREE.Color(0xffd9ac);
  scene.background = nightColor.clone();
  scene.fog = new THREE.Fog(0x030403, 8, 18);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  const prenatal = createPrenatalForm();
  scene.add(prenatal.group);

  const sky = createWhimsicalSky();
  scene.add(sky.group);

  const island = createIslandWorld(publicAssetUrl, (details) => {
    onWorldReady?.(details);
  });
  island.setReducedMotion(reducedMotion);
  island.group.visible = false;
  scene.add(island.group);

  const ambient = new THREE.AmbientLight(0xffead9, 0.34);
  scene.add(ambient);
  const skyFill = new THREE.HemisphereLight(0xffead9, 0x301c18, 0.42);
  scene.add(skyFill);
  const keyLight = new THREE.DirectionalLight(0xffd7bc, 3.1);
  keyLight.position.set(-3.4, 5.2, 5.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1536, 1536);
  keyLight.shadow.radius = 5;
  keyLight.shadow.blurSamples = 16;
  keyLight.shadow.camera.left = -4.25;
  keyLight.shadow.camera.right = 4.25;
  keyLight.shadow.camera.top = 4.25;
  keyLight.shadow.camera.bottom = -4.25;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 24;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.normalBias = 0.022;
  scene.add(keyLight);
  scene.add(keyLight.target);
  const rimLight = new THREE.PointLight(0xb7dcca, 6.5, 8, 2);
  rimLight.position.set(3.2, 2.4, 4.3);
  scene.add(rimLight);
  const nightSunOffset = new THREE.Vector3(-3.4, 5.2, 5.5);
  const daylightSunOffset = new THREE.Vector3(5.5, 8.2, -4.6);
  const sunOffset = new THREE.Vector3();

  let active = true;
  let pageVisible = !document.hidden;
  let disposed = false;
  let frameId = 0;
  let progress = 0;
  let worldLoadPromise = null;
  let layout = {};

  function loadWorld() {
    if (!worldLoadPromise) worldLoadPromise = island.load();
    return worldLoadPromise;
  }

  function applyProgress() {
    const transition = smoothstep(0.34, 0.52, progress);
    const islandEntrance = smoothstep(0.39, 0.62, progress);
    const heroPresence = 1 - smoothstep(0.32, 0.49, progress);
    prenatal.setOpacity(heroPresence);
    prenatal.group.position.set(
      layout.heroX,
      layout.heroY + transition * layout.heroLift,
      0
    );
    prenatal.group.scale.setScalar(
      layout.heroScale * mix(1, 0.82, transition)
    );
    prenatal.group.rotation.z = transition * -0.08;
    sky.setOpacity(transition);

    island.group.visible = progress > 0.24;
    island.group.position.set(
      layout.worldX,
      layout.worldY + (1 - islandEntrance) * -4.2,
      layout.worldZ
    );
    island.group.scale.setScalar(
      layout.worldScale * mix(0.86, 1, islandEntrance)
    );
    island.group.rotation.y = mix(
      -0.16,
      layout.worldRotation,
      islandEntrance
    );

    keyLight.target.position.set(
      layout.worldX,
      layout.worldY + (1 - islandEntrance) * -4.2 + 0.35,
      layout.worldZ
    );
    sunOffset.copy(nightSunOffset).lerp(daylightSunOffset, transition);
    keyLight.position.copy(keyLight.target.position).add(sunOffset);

    scene.background.copy(nightColor).lerp(daylightColor, transition);
    scene.fog.color.copy(scene.background);
    scene.fog.near = mix(8, 10, transition);
    scene.fog.far = mix(18, 24, transition);
    ambient.color.copy(nightAmbient).lerp(daylightAmbient, transition);
    ambient.intensity = mix(0.34, 0.42, transition);
    skyFill.color.copy(nightSky).lerp(daylightSky, transition);
    skyFill.groundColor.copy(nightGround).lerp(daylightGround, transition);
    skyFill.intensity = mix(0.42, 0.48, transition);
    keyLight.color.copy(nightKey).lerp(daylightKey, transition);
    keyLight.intensity = mix(3.1, 2.75, transition);
    rimLight.intensity = mix(6.5, 0.32, transition);
    renderer.toneMappingExposure = mix(1.08, 1.42, transition);
  }

  function render(now = performance.now()) {
    frameId = 0;
    if (disposed) return;
    applyProgress();
    prenatal.update(now, !reducedMotion);
    sky.update(now * 0.001, !reducedMotion);
    if (island.group.visible) island.update(now, camera);
    renderer.render(scene, camera);
    if (active && pageVisible) frameId = window.requestAnimationFrame(render);
  }

  function start() {
    if (!frameId && active && pageVisible && !disposed) {
      frameId = window.requestAnimationFrame(render);
    }
  }

  function stop() {
    if (!frameId) return;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function resize() {
    const { width, height } = mount.getBoundingClientRect();
    if (!width || !height) return;
    const shortLandscape = height < 620 && width > height;
    const compact = width < 760 || (width < 900 && height >= width);
    const portraitCompact = compact && !shortLandscape;
    const pixelRatio = compact
      ? Math.min(window.devicePixelRatio, 1.15)
      : Math.min(window.devicePixelRatio, 1.55);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    keyLight.shadow.mapSize.set(compact ? 768 : 1536, compact ? 768 : 1536);
    camera.aspect = width / height;
    camera.fov = portraitCompact ? 38 : shortLandscape ? 36 : 34;
    camera.position.set(
      0,
      portraitCompact ? 1.3 : 1.12,
      portraitCompact ? 9.25 : 8.25
    );
    camera.lookAt(0, portraitCompact ? 0.85 : 0.65, 0);
    camera.updateProjectionMatrix();

    if (shortLandscape) {
      layout = {
        heroX: -1.72,
        heroY: -0.18,
        heroLift: 4.5,
        heroScale: 1.2,
        worldX: -1.72,
        worldY: -0.16,
        worldZ: 0,
        worldScale: 0.7,
        worldRotation: 0.02
      };
    } else if (compact) {
      layout = {
        heroX: 0,
        heroY: 1.05,
        heroLift: 5.2,
        heroScale: height < 680 ? 1.02 : 1.14,
        worldX: 0,
        worldY: height < 680 ? 1.25 : 1.5,
        worldZ: 0,
        worldScale: height < 680 ? 0.62 : 0.7,
        worldRotation: 0.02
      };
    } else {
      layout = {
        heroX: -1.72,
        heroY: -0.28,
        heroLift: 4.8,
        heroScale: 1.38,
        worldX: -1.88,
        worldY: -0.2,
        worldZ: 0,
        worldScale: 0.86,
        worldRotation: 0.02
      };
    }
    island.setCompact(compact || shortLandscape);
    applyProgress();
    if (!active || !pageVisible) render();
  }

  function setProgress(value) {
    progress = clamp(value);
    if (progress > 0.08) loadWorld();
    applyProgress();
    if (!active || !pageVisible) render();
  }

  function setActive(value) {
    active = value;
    if (active) start();
    else stop();
  }

  function setReducedMotion(value) {
    reducedMotion = value;
    island.setReducedMotion(value);
  }

  function handleVisibility() {
    pageVisible = !document.hidden;
    if (pageVisible) start();
    else stop();
  }

  document.addEventListener("visibilitychange", handleVisibility);
  resize();
  render();
  onReady?.();

  function dispose() {
    disposed = true;
    stop();
    document.removeEventListener("visibilitychange", handleVisibility);
    prenatal.dispose();
    sky.dispose();
    island.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return {
    loadWorld,
    setProgress,
    resize,
    setActive,
    setReducedMotion,
    dispose
  };
}

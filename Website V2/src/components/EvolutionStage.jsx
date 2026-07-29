import { useEffect, useRef } from "react";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { bipedCharacter } from "../game/characters/bipedCharacter";

const MODEL_SCALE = 0.72;
const FLOOR_HEIGHT = 0.09;

function addSoftEllipsoid(metabody, shape) {
  const { x, y, z, rx, ry, rz, strength, falloff = 1.2, cutoff = 3.0 } = shape;
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
        const d2 = dx * dx + dy2 + dz2;
        if (d2 > cutoff) continue;
        field[yOffset + xi] += strength * Math.exp(-d2 * falloff);
      }
    }
  }
}

function createShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.save();
  context.translate(128, 64);
  context.scale(1, 0.48);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 124);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.88)");
  gradient.addColorStop(0.35, "rgba(0, 0, 0, 0.54)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(-128, -134, 256, 268);
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFloorGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 250);
  gradient.addColorStop(0, "rgba(235, 188, 149, 0.42)");
  gradient.addColorStop(0.2, "rgba(180, 130, 94, 0.26)");
  gradient.addColorStop(0.5, "rgba(104, 73, 52, 0.11)");
  gradient.addColorStop(0.78, "rgba(51, 36, 26, 0.035)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.35, 2.25), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, FLOOR_HEIGHT, 2);
  mesh.renderOrder = 0;

  return { mesh, material, texture };
}

function createSparkles(count = 50) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 1.8;
    positions[i * 3 + 1] = Math.random() * 1.8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.045,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const points = new THREE.Points(geometry, material);
  return { points, material, geometry, count };
}

function createPrenatalModel() {
  const group = new THREE.Group();
  group.position.set(0, 0, 2);
  group.scale.setScalar(MODEL_SCALE);

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xeeb297,
    roughness: 0.65,
    metalness: 0,
    emissive: 0xffc4a8,
    emissiveIntensity: 0.24,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25
  });

  const metabody = new MarchingCubes(28, material, false, false, 20000);
  metabody.isolation = 1;
  metabody.scale.set(0.68, 0.68, 0.68);
  metabody.frustumCulled = false;
  bodyRoot.add(metabody);

  const shadowTexture = createShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.48, 0.72),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = FLOOR_HEIGHT / MODEL_SCALE + 0.012;
  shadow.renderOrder = 1;
  group.add(shadow);

  return { group, bodyRoot, metabody, material, shadow, shadowTexture };
}

function animatePrenatalModel(model, now, evolutionProgress = 0) {
  const floatPhase = now * 0.0012;
  const floatY = 0.86 + Math.sin(floatPhase) * 0.1;

  model.bodyRoot.position.set(0, floatY, 0);

  // Gentle, controlled spin during evolution (not too fast)
  const spinSpeed = 0.0003 + evolutionProgress * 0.0018;
  model.bodyRoot.rotation.y = now * spinSpeed;

  // Gentle emissive white glow
  const baseColor = new THREE.Color(0xeeb297);
  const whiteColor = new THREE.Color(0xffffff);
  model.material.emissive.copy(new THREE.Color(0xffc4a8)).lerp(whiteColor, evolutionProgress);
  model.material.emissiveIntensity = 0.24 + evolutionProgress * 1.5;
  model.material.color.copy(baseColor).lerp(whiteColor, evolutionProgress);

  model.metabody.reset();

  const breath = Math.sin(now * (0.0009 + evolutionProgress * 0.002));
  addSoftEllipsoid(model.metabody, {
    x: 0,
    y: 0,
    z: 0,
    rx: 0.46,
    ry: 0.46,
    rz: 0.46,
    strength: 1.8 * (1 + breath * 0.03)
  });

  addSoftEllipsoid(model.metabody, {
    x: Math.sin(now * 0.0018) * 0.32,
    y: Math.cos(now * 0.0014) * 0.22,
    z: Math.sin(now * 0.001) * 0.28,
    rx: 0.36,
    ry: 0.36,
    rz: 0.36,
    strength: 1.2
  });

  addSoftEllipsoid(model.metabody, {
    x: Math.cos(now * 0.0016) * 0.28,
    y: Math.sin(now * 0.0019) * 0.22,
    z: Math.cos(now * 0.0012) * 0.28,
    rx: 0.32,
    ry: 0.32,
    rz: 0.32,
    strength: 1
  });

  model.metabody.update();

  const scaleFactor = 0.87 - (floatY - 0.86) * 0.14;
  model.shadow.scale.set(scaleFactor, 0.78 * scaleFactor, 1);
  model.shadow.material.opacity = Math.max(0.24, 0.5 - (floatY - 0.86) * 0.16);
}

export default function EvolutionStage({ onReady, scrollProgress = 0, stagePositionX = -0.65 }) {
  const mountRef = useRef(null);
  const stageStateRef = useRef({ scrollProgress, stagePositionX });

  useEffect(() => {
    stageStateRef.current = { scrollProgress, stagePositionX };
  }, [scrollProgress, stagePositionX]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch {
      mount.dataset.webgl = "unavailable";
      onReady?.();
      return undefined;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 40);

    // Lights
    scene.add(new THREE.HemisphereLight(0xffeee1, 0x3a2119, 1.4));
    const keyLight = new THREE.DirectionalLight(0xffd7bc, 2.9);
    keyLight.position.set(-3, 4, 5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0xb9d8c9, 7, 7, 2);
    rimLight.position.set(2.5, 1.8, 3.5);
    scene.add(rimLight);

    // Root Group
    const presentationRoot = new THREE.Group();
    scene.add(presentationRoot);

    // 1. Prenatal Blob & Floor Glow & Sparkles
    const prenatalModel = createPrenatalModel();
    const floorGlow = createFloorGlow();
    const sparkles = createSparkles(50);

    presentationRoot.add(floorGlow.mesh);
    presentationRoot.add(prenatalModel.group);
    presentationRoot.add(sparkles.points);

    // 2. Biped Character Model (Scaled to match Prenatal Blob size EXACTLY!)
    const biped = bipedCharacter.createModel();
    biped.group.position.set(0, 0, 2);
    // Biped model scale adjusted so it matches prenatal blob size perfectly (0.65 scale)
    biped.group.scale.setScalar(0.65);
    biped.group.visible = false;
    presentationRoot.add(biped.group);

    const bipedState = {
      action: "idle",
      expression: "neutral",
      wobblePhase: 0,
      jellyX: 1,
      jellyZ: 1,
      ax: 0,
      bx: 0
    };

    function resize() {
      const { width, height } = mount.getBoundingClientRect();
      if (width === 0 || height === 0) return;

      const isCompact = width < 760;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = isCompact ? 38 : 33;
      camera.position.set(0, isCompact ? 1.25 : 1.05, 6);
      camera.lookAt(0, isCompact ? 0.7 : 0.45, 2);
      camera.updateProjectionMatrix();

      presentationRoot.scale.setScalar(
        isCompact ? (height < 680 ? 1.02 : 1.28) : 1.32
      );
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    let isVisible = true;
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { rootMargin: "25% 0px" }
    );
    visibilityObserver.observe(mount);
    window.addEventListener("resize", resize);
    resize();

    let frameId;
    let hasAnnouncedReady = false;

    function render(now) {
      if (isVisible) {
        const { scrollProgress, stagePositionX } = stageStateRef.current;

        const isCompact = window.innerWidth < 760;
        presentationRoot.position.set(
          isCompact ? 0 : stagePositionX,
          isCompact ? Math.max(0.22, Math.min(0.55, mount.clientHeight * 0.0007)) : -0.32,
          0
        );

        // Evolution progress (0 to 1 during centered spin phase: progress 0.45 -> 0.65)
        const clamp = (v) => Math.min(1, Math.max(0, v));
        const evolutionProgress = clamp((scrollProgress - 0.45) / 0.20);

        // Animate sparkles gently during evolution
        sparkles.material.opacity = evolutionProgress * 0.8;
        const positions = sparkles.geometry.attributes.position.array;
        for (let i = 0; i < sparkles.count; i++) {
          positions[i * 3 + 1] += 0.005 + evolutionProgress * 0.008;
          if (positions[i * 3 + 1] > 2.0) positions[i * 3 + 1] = 0;
        }
        sparkles.geometry.attributes.position.needsUpdate = true;
        sparkles.points.rotation.y = now * 0.001;

        // Model swap happens at peak white-out (progress > 0.65)
        const showBiped = scrollProgress > 0.65;
        prenatalModel.group.visible = !showBiped;
        biped.group.visible = showBiped;

        if (!showBiped) {
          animatePrenatalModel(prenatalModel, now, evolutionProgress);
        } else {
          // Biped Descent animation (progress 0.65 -> 0.85)
          const descentProgress = clamp((scrollProgress - 0.65) / 0.20);
          const floatY = (1 - descentProgress) * 1.8;
          biped.bodyRoot.position.y = floatY;

          const expr = descentProgress < 0.5 ? "closed" : "neutral";
          bipedState.wobblePhase = now * 0.0016;
          biped.animations.apply("idle", biped, bipedState, {
            now,
            expression: expr
          });
        }

        renderer.render(scene, camera);
      }

      if (!hasAnnouncedReady) {
        hasAnnouncedReady = true;
        onReady?.();
      }
      frameId = window.requestAnimationFrame(render);
    }
    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("resize", resize);
      prenatalModel.metabody.geometry.dispose();
      prenatalModel.material.dispose();
      prenatalModel.shadow.geometry.dispose();
      prenatalModel.shadow.material.dispose();
      prenatalModel.shadowTexture.dispose();
      sparkles.geometry.dispose();
      sparkles.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onReady]);

  return <div ref={mountRef} className="prenatal-stage" />;
}

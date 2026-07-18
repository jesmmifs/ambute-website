import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { bipedCharacter } from "../game/characters/bipedCharacter";
import {
  applyFaceExpression,
  updateFaceTracking
} from "../game/characters/faceRig";
import { createGardenVignette } from "../game/gardenVignette";

const DESCENT_DURATION_MS = 6000;
const REVEAL_DURATION_MS = 2500;
const ISLAND_REVEAL_DURATION_MS = 2200;
const TALK_START_DELAY_MS = 2500;
const TALK_WAVE_LEAD_MS = 500;
const TALK_WAVE_TRAIL_MS = 500;
const TALK_PROMPT_DURATION_MS = 4000;
const TALK_REPLY_DURATION_MS = 4000;
const TALK_BREATH_MS = 520;

const TALK_EXCHANGES = [
  {
    question: "How are you feeling, Ambute?",
    answer: "A little hungry, actually. My belly feels very dramatic today."
  },
  {
    question: "Maybe you should go eat something.",
    answer: "That is a good idea. I was hoping you would say that."
  },
  {
    question: "Then go on, little one.",
    answer: "Okay. I will find food before my belly writes a poem."
  }
];

const clamp = (value, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

function smoothstep(start, end, value) {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

function setupLighting(scene) {
  scene.add(new THREE.AmbientLight(0xffeedd, 0.35));

  const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
  sun.position.set(1, 5, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 18;
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 4;
  sun.shadow.camera.bottom = -4;
  sun.shadow.bias = -0.002;
  scene.add(sun);

  const coolFill = new THREE.PointLight(0xa8d8ff, 0.45, 9);
  coolFill.position.set(-3.2, 2.4, 1);
  scene.add(coolFill);

  const warmFill = new THREE.PointLight(0xffcc88, 0.3, 10);
  warmFill.position.set(3.2, 1.5, 2);
  scene.add(warmFill);
}

export default function EmergenceSection({ onDescentActiveChange }) {
  const sectionRef = useRef(null);
  const mountRef = useRef(null);
  const [hasLanded, setHasLanded] = useState(false);
  const [hasTalkStarted, setHasTalkStarted] = useState(false);
  const [conversationState, setConversationState] = useState({
    index: 0,
    phase: "listening"
  });

  useEffect(() => {
    if (!hasTalkStarted) return undefined;

    let disposed = false;
    const timers = new Set();

    const wait = (callback, delay) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!disposed) callback();
      }, delay);
      timers.add(timer);
    };

    const playExchange = (index, firstRun = false) => {
      setConversationState({ index, phase: "listening" });
      wait(
        () => {
          setConversationState({ index, phase: "voice" });
          wait(() => {
            setConversationState({ index, phase: "question" });
            wait(() => {
              setConversationState({ index, phase: "voice" });
              wait(() => {
                setConversationState({ index, phase: "breath" });
                wait(() => {
                  setConversationState({ index, phase: "answer" });
                  wait(() => {
                    setConversationState({ index, phase: "breath" });
                    wait(
                      () =>
                        playExchange(
                          (index + 1) % TALK_EXCHANGES.length,
                          false
                        ),
                      TALK_BREATH_MS
                    );
                  }, TALK_REPLY_DURATION_MS);
                }, TALK_BREATH_MS);
              }, TALK_WAVE_TRAIL_MS);
            }, TALK_PROMPT_DURATION_MS);
          }, TALK_WAVE_LEAD_MS);
        },
        firstRun
          ? Math.max(0, TALK_START_DELAY_MS - TALK_WAVE_LEAD_MS)
          : TALK_BREATH_MS
      );
    };

    playExchange(0, true);

    return () => {
      disposed = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [hasTalkStarted]);

  useEffect(() => {
    const section = sectionRef.current;
    const mount = mountRef.current;
    if (!section || !mount) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch {
      mount.dataset.webgl = "unavailable";
      setHasLanded(true);
      onDescentActiveChange?.(false);
      return undefined;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.shadowMap.enabled = true;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    setupLighting(scene);

    const livingScene = new THREE.Group();
    scene.add(livingScene);

    const vignette = createGardenVignette();
    const ground = vignette.group;
    ground.visible = false;
    livingScene.add(ground);

    const groundMaterialState = new Map();
    const groundMeshState = new Map();
    ground.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      groundMeshState.set(child, {
        castShadow: child.castShadow,
        receiveShadow: child.receiveShadow
      });
      child.castShadow = false;
      child.receiveShadow = false;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => {
        if (groundMaterialState.has(material)) return;
        groundMaterialState.set(material, {
          opacity: material.opacity ?? 1,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
          revealLayer: child.userData.revealLayer
        });
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
      });
    });

    const model = bipedCharacter.createModel();
    model.group.visible = false;
    livingScene.add(model.group);

    const materialState = new Map();
    model.bodyRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      materials.forEach((material) => {
        if (materialState.has(material)) return;
        materialState.set(material, {
          emissive: material.emissive?.clone(),
          emissiveIntensity: material.emissiveIntensity ?? 0,
          opacity: material.opacity ?? 1,
          transparent: material.transparent,
          depthWrite: material.depthWrite
        });
      });
    });

    const bubbleAnchorWorld = new THREE.Vector3();
    const bubbleAnchorScreen = new THREE.Vector3();
    const white = new THREE.Color(1, 1, 1);
    const idleState = {
      action: "idle",
      expression: "neutral",
      wobblePhase: 0,
      jellyX: 1,
      jellyZ: 1,
      ax: 0,
      bx: 0
    };

    let scrollProgress = 0;
    let previousCopyScrollProgress = 0;
    let hasTriggered = false;
    let descentStartedAt = 0;
    let revealLockedScrollY = 0;
    let landingScrollProgress = 0;
    let descentComplete = false;
    let islandRevealComplete = false;
    let isSectionNear = false;
    let frameId;
    let previousFrame = performance.now();

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function getSceneLayout() {
      const width = mount.clientWidth;
      const height = Math.max(1, mount.clientHeight);
      const aspect = width / height;
      const phone = width < 760;
      const tablet = width >= 760 && width < 1180;
      const tabletPortrait = tablet && height > width;
      const tabletLandscape = tablet && height <= width;

      return {
        aspect,
        phone,
        stacked: phone || tabletPortrait,
        tabletLandscape,
        tabletPortrait
      };
    }

    function placeScene() {
      const { aspect, phone, stacked, tabletLandscape, tabletPortrait } =
        getSceneLayout();
      const narrowPhone = stacked ? clamp((0.62 - aspect) / 0.18) : 0;
      const characterX = stacked ? 0 : tabletLandscape ? 2.15 : 1.35;
      const postLandingScrollProgress = clamp(
        scrollProgress - landingScrollProgress
      );
      const companionProgress =
        stacked && descentComplete
          ? smoothstep(0.04, 0.2, postLandingScrollProgress)
          : 0;
      const sceneLift = THREE.MathUtils.lerp(
        0,
        tabletPortrait ? 2.45 : 2.78,
        companionProgress
      );
      const baseSceneScale = tabletLandscape ? 0.86 : 1;
      const settledSceneScale = tabletPortrait ? 0.78 : 0.72;
      const sceneScale = stacked
        ? THREE.MathUtils.lerp(baseSceneScale, settledSceneScale, companionProgress)
        : baseSceneScale;
      const sceneZ = THREE.MathUtils.lerp(0.45, 0.34, companionProgress);

      livingScene.position.set(characterX, sceneLift, sceneZ);
      livingScene.scale.setScalar(sceneScale);
      model.group.position.set(0, 0, 0);
      ground.position.set(0, 0, 0);
      ground.scale.setScalar(
        stacked
          ? THREE.MathUtils.lerp(0.72, phone ? 0.64 : 0.68, narrowPhone)
          : tabletLandscape
            ? 0.82
            : 1
      );

      camera.fov = stacked ? 45 : tabletLandscape ? 43 : 42;
      camera.position.set(
        stacked ? 0 : tabletLandscape ? 0.35 : 0.25,
        stacked ? 2.3 : 2.2,
        stacked
          ? THREE.MathUtils.lerp(8.8, phone ? 9.7 : 9.35, narrowPhone)
          : tabletLandscape
            ? 9.65
            : 8.8
      );
      camera.lookAt(
        stacked ? 0 : tabletLandscape ? 0.95 : 0.72,
        stacked ? 1.55 : 1.45,
        0.35
      );
      camera.updateProjectionMatrix();
    }

    function updateThoughtBubbleAnchor() {
      if (!model.group.visible || !model.face?.group) return;

      model.face.group.getWorldPosition(bubbleAnchorWorld);
      bubbleAnchorWorld.y += 0.95;
      bubbleAnchorScreen.copy(bubbleAnchorWorld).project(camera);

      const x = (bubbleAnchorScreen.x * 0.5 + 0.5) * mount.clientWidth;
      const y = (-bubbleAnchorScreen.y * 0.5 + 0.5) * mount.clientHeight;
      section.style.setProperty("--thought-bubble-x", `${x}px`);
      section.style.setProperty("--thought-bubble-y", `${y}px`);
    }

    function restoreNaturalMaterials() {
      materialState.forEach((original, material) => {
        if (material.emissive && original.emissive) {
          material.emissive.copy(original.emissive);
          material.emissiveIntensity = original.emissiveIntensity;
        }
        material.opacity = original.opacity;
        material.transparent = original.transparent;
        material.depthWrite = original.depthWrite;
      });
    }

    function setGroundPresence(presence) {
      ground.visible = presence > 0.001;
      groundMeshState.forEach((original, mesh) => {
        const shadowsReady = presence > 0.98;
        mesh.castShadow = shadowsReady && original.castShadow;
        mesh.receiveShadow = shadowsReady && original.receiveShadow;
      });
      groundMaterialState.forEach((original, material) => {
        const materialPresence =
          original.revealLayer === "island-shadow"
            ? smoothstep(0.38, 1, presence)
            : presence;
        material.transparent = materialPresence < 0.999 || original.transparent;
        material.opacity = original.opacity * materialPresence;
        material.depthWrite = materialPresence > 0.98 && original.depthWrite;
      });
    }

    function updateScrollState() {
      const rect = section.getBoundingClientRect();
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const { stacked } = getSceneLayout();
      let nextScrollProgress = clamp(-rect.top / range);

      if (!hasTriggered && rect.top <= 0) {
        hasTriggered = true;
        descentStartedAt = performance.now();
        revealLockedScrollY = window.scrollY + rect.top;
        ground.visible = true;
        model.group.visible = true;
        onDescentActiveChange?.(!prefersReducedMotion);
      }

      if (stacked && hasTriggered && !descentComplete && !prefersReducedMotion) {
        if (Math.abs(window.scrollY - revealLockedScrollY) > 1) {
          window.scrollTo(0, revealLockedScrollY);
        }
        nextScrollProgress = 0;
      }

      scrollProgress = nextScrollProgress;
      const copyScrollProgress =
        stacked
          ? descentComplete
            ? clamp(scrollProgress - landingScrollProgress)
            : 0
          : scrollProgress;
      const introPresence =
        smoothstep(0.055, 0.13, copyScrollProgress) *
        (1 - smoothstep(0.24, 0.31, copyScrollProgress));
      const lifePresence =
        smoothstep(0.34, 0.44, copyScrollProgress) *
        (1 - smoothstep(0.56, 0.64, copyScrollProgress));
      const talkPresence = smoothstep(0.68, 0.8, copyScrollProgress);
      const isScrollingBack = copyScrollProgress < previousCopyScrollProgress;
      section.style.setProperty("--emergence-intro-presence", introPresence);
      section.style.setProperty("--emergence-life-presence", lifePresence);
      section.style.setProperty("--emergence-talk-presence", talkPresence);
      if (talkPresence > 0.24) {
        setHasTalkStarted(true);
      }
      section.style.setProperty(
        "--emergence-copy-duration",
        stacked && isScrollingBack ? "0.38s" : "1.55s"
      );
      previousCopyScrollProgress = copyScrollProgress;
      placeScene();

      if (hasTriggered && prefersReducedMotion && !descentComplete) {
        descentComplete = true;
        islandRevealComplete = true;
        landingScrollProgress = scrollProgress;
        setGroundPresence(1);
        restoreNaturalMaterials();
        applyFaceExpression(model.face, "neutral");
        placeScene();
        setHasLanded(true);
        onDescentActiveChange?.(false);
      }
    }

    function resize() {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      placeScene();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isSectionNear = entry.isIntersecting;
      },
      { rootMargin: "100% 0px" }
    );
    visibilityObserver.observe(section);

    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    updateScrollState();
    resize();

    function render(now) {
      const delta = Math.min(now - previousFrame, 100);
      previousFrame = now;

      if (isSectionNear) {
        if (hasTriggered && !islandRevealComplete) {
          const islandProgress = clamp(
            (now - descentStartedAt) / ISLAND_REVEAL_DURATION_MS
          );
          setGroundPresence(
            islandProgress * islandProgress * (3 - 2 * islandProgress)
          );
          islandRevealComplete = islandProgress >= 1;
        }

        if (ground.visible) vignette.update(now);

        if (model.group.visible) {
          idleState.wobblePhase += delta * 0.00162;
          model.animations.apply("idle", model, idleState, {
            now,
            expression: "neutral",
            ballPosition: { x: 0, z: 0 }
          });

          if (!descentComplete && !prefersReducedMotion) {
            const elapsed = now - descentStartedAt;
            const progress = clamp(elapsed / DESCENT_DURATION_MS);
            const floatY = (1 - progress) * 2.2;
            const glow = Math.pow(1 - progress, 1.8);
            const reveal = clamp(elapsed / REVEAL_DURATION_MS);

            model.bodyRoot.position.y = floatY;
            model.group.rotation.y = glow * Math.PI * 4;

            materialState.forEach((original, material) => {
              if (material.emissive && original.emissive) {
                material.emissive.copy(original.emissive).lerp(white, glow);
                material.emissiveIntensity = THREE.MathUtils.lerp(
                  original.emissiveIntensity,
                  1.5,
                  glow
                );
              }
              material.transparent = true;
              material.opacity = original.opacity * reveal;
              material.depthWrite = reveal > 0.98 && original.depthWrite;
            });

            applyFaceExpression(model.face, "closed");
            updateFaceTracking(model.face, { sleeping: true });

            const shadowScale = Math.max(0.1, 1 - floatY * 0.35);
            model.shadow.scale.set(shadowScale, 1, 0.78 * shadowScale);
            model.shadow.material.opacity =
              Math.max(0, 0.14 - floatY * 0.06) * reveal;

            if (progress >= 1) {
              descentComplete = true;
              landingScrollProgress = scrollProgress;
              model.group.rotation.y = 0;
              restoreNaturalMaterials();
              applyFaceExpression(model.face, "neutral");
              updateFaceTracking(model.face, { sleeping: false });
              placeScene();
              setHasLanded(true);
              onDescentActiveChange?.(false);
            }
          }
        }

        updateThoughtBubbleAnchor();
        renderer.render(scene, camera);
      }

      frameId = window.requestAnimationFrame(render);
    }

    frameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frameId);
      onDescentActiveChange?.(false);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);

      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => materials.add(material));
        } else if (object.material) {
          materials.add(object.material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const currentExchange = TALK_EXCHANGES[conversationState.index];
  const isQuestionVisible = conversationState.phase === "question";
  const isWaveVisible =
    conversationState.phase === "voice" || conversationState.phase === "question";
  const isAnswerVisible = conversationState.phase === "answer";

  return (
    <section
      ref={sectionRef}
      className={`emergence${hasLanded ? " emergence--landed" : ""}`}
      aria-labelledby="lives-with-you-title"
    >
      <div className="emergence__sticky">
        <div
          ref={mountRef}
          className="emergence__stage"
          role="img"
          aria-label="Ambute's biped form descending onto a small flowering garden island and coming to life"
        />

        <div className="emergence__copy emergence__copy--intro">
          <p className="emergence__prelude">From first thought to first step.</p>
          <h2 id="lives-with-you-title">It lives with you.</h2>
          <p>
            Ambute lives in a small world on your desktop. Time of day,
            weather, its needs, personality, age, and surroundings shape what
            it does next.
          </p>
        </div>

        <div
          className="emergence__copy emergence__copy--life"
          aria-labelledby="life-cycle-title"
        >
          <p className="emergence__prelude">Born, changed, returned.</p>
          <h2 id="life-cycle-title">A life cycle, not a script.</h2>
          <p className="emergence__life-lead">
            Ambute is born, grows, changes, dies, and begins again. Needs,
            personality, age, environment, weather, time of day, and choices
            shape each life.
          </p>

          <div className="life-cycle__beats" aria-label="Ambute's life cycle">
            <div>
              <span>It grows</span>
              <p>From first shapeless form into later stages of life.</p>
            </div>
            <div>
              <span>It chooses</span>
              <p>Needs, mood, age, weather, and time shape its actions.</p>
            </div>
            <div>
              <span>It ends</span>
              <p>Ambute is aware of its mortality.</p>
            </div>
            <div>
              <span>It returns</span>
              <p>Death is not deletion. It is reborn.</p>
            </div>
          </div>
        </div>

        <div
          className="conversation-demo"
          aria-label="A looping example of a voice conversation with Ambute"
        >
          <div className="conversation-demo__voice">
            <p className={isQuestionVisible ? "is-visible" : ""}>
              {currentExchange.question}
            </p>
            <div
              className={`voice-wave${isWaveVisible ? " is-visible" : ""}`}
              aria-hidden="true"
            >
              {Array.from({ length: 21 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </div>
          <p
            className={`conversation-demo__thought${
              isAnswerVisible ? " is-visible" : ""
            }`}
          >
            {currentExchange.answer}
          </p>
        </div>

        <div
          className="emergence__copy emergence__copy--talk"
          aria-labelledby="talk-title"
        >
          <p className="emergence__prelude">Voice in. Voice out.</p>
          <h2 id="talk-title">Talk to Ambute.</h2>
          <p>
            Ask how it feels, talk about the weather, or tell it what to do.
            Ambute thinks, answers, and speaks through the AI model you
            connect.
          </p>
        </div>
      </div>
    </section>
  );
}

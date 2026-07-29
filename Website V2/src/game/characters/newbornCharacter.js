import * as THREE from "three";
import { AMBUTE_CONFIG } from "../constants";
import { createFaceRig, updateFaceTracking, projectFaceOnMesh, applyFaceExpression } from "./faceRig";

const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

const faceMount = {
  position: [0, 0.26, 0],
  rotation: [0, 0, 0],
  scale: 0.72,
  eyeLPosition: [-0.18, 0.14, 0.51],
  eyeRPosition: [0.22, 0.22, 0.49],
  blushLPosition: [-0.33, -0.04, 0.43],
  blushRPosition: [0.36, 0.06, 0.41],
  mouthPosition: [0.03, -0.06, 0.53]
};

function updateNewbornPose(model, state, context = {}) {
  const now = context.now ?? Date.now();
  const expression = context.expression || state.expression || "neutral";
  const startle = state.startle || 0;
  const bodyRoot = model.bodyRoot;
  const body = model.parts.body;
  const shadow = model.shadow;

  const sqAbs = Math.abs(state.squash || 0);
  const standbyJelly = !state.moving && !state.sleeping;

  let targetScaleX;
  let targetScaleY;
  let targetScaleZ;
  let idleBob = 0;
  let swayX = 0;
  let swayZ = 0;

  const wobblePhase = state.wobblePhase || now * 0.0015;

  if (state.moving && !state.sleeping) {
    const walkPhase = state.walkPhase || now * 0.003;
    const crawlCycle = Math.sin(walkPhase);
    const crawlWobble = Math.cos(walkPhase * 1.4) * 0.16;

    targetScaleZ = 1.0 + crawlCycle * 0.16 - (state.squash || 0) * 0.80;
    targetScaleY = 1.0 - crawlCycle * 0.12 + (state.squash || 0) * 0.70;
    targetScaleX = 1.0 - crawlCycle * 0.06 + Math.sin(walkPhase * 2.8) * 0.03;

    swayX = Math.sin(walkPhase * 0.9) * 0.06;
    swayZ = Math.cos(walkPhase * 0.9) * 0.02;

    bodyRoot.position.set(swayX, startle * 0.035, swayZ);

    bodyRoot.rotation.z = crawlWobble + Math.sin(walkPhase) * 0.04;
    bodyRoot.rotation.x = Math.sin(walkPhase * 1.8) * 0.08;
    bodyRoot.rotation.y = Math.sin(walkPhase * 0.7) * 0.12;
  } else {
    const idleBreath = Math.sin(wobblePhase * 1.55);
    const idleRipple = Math.cos(wobblePhase * 3.1 + 0.5) * 0.18;
    
    targetScaleY = 1.0 - idleBreath * 0.045 - (state.squash || 0) * 0.90;
    targetScaleX = 1.0 + idleBreath * 0.035 + idleRipple * 0.015;
    targetScaleZ = 1.0 + idleBreath * 0.035 - idleRipple * 0.015;

    idleBob = Math.sin(wobblePhase * 1.65) * 0.015 + Math.sin(wobblePhase * 3.8) * 0.004;
    swayX = Math.sin(wobblePhase * 0.88) * 0.018;
    swayZ = Math.cos(wobblePhase * 0.72) * 0.012;

    bodyRoot.position.set(swayX, idleBob + startle * 0.035, swayZ);

    bodyRoot.rotation.z = Math.sin(wobblePhase * 1.05) * 0.075 + Math.cos(wobblePhase * 2.3) * 0.018;
    bodyRoot.rotation.x = Math.cos(wobblePhase * 0.92) * 0.035;
    bodyRoot.rotation.y = 0;
  }

  targetScaleX += startle * 0.12;
  targetScaleY -= startle * 0.08;
  targetScaleZ += startle * 0.06;

  state.jellyX = lerp(state.jellyX ?? 1, targetScaleX, 0.085);
  state.jellyY = lerp(state.jellyY ?? 1, targetScaleY, 0.075);
  state.jellyZ = lerp(state.jellyZ ?? 1, targetScaleZ, 0.085);
  bodyRoot.scale.set(state.jellyX, state.jellyY, state.jellyZ);

  model.face.group.scale.set(
    faceMount.scale / state.jellyX,
    faceMount.scale / state.jellyY,
    faceMount.scale / state.jellyZ
  );

  const stretchY = (state.jellyY - 1.0);
  model.face.group.position.y = faceMount.position[1] + cl(stretchY * 0.15, -0.05, 0.15);

  if (model.face) {
    applyFaceExpression(model.face, expression);
  }

  if (state.newbornLastScaleX) {
    model.eyeL.position.x /= state.newbornLastScaleX;
    model.eyeR.position.x /= state.newbornLastScaleX;
  }

  updateFaceTracking(model.face, {
    sleeping: state.sleeping,
    interested: expression === "curious",
    targetOffsetX: ((context.ballPosition?.x ?? state.bx ?? 0) - (state.ax ?? 0)) * 0.05
  });

  model.eyeL.position.x *= state.jellyX;
  model.eyeR.position.x *= state.jellyX;
  state.newbornLastScaleX = state.jellyX;

  model.blushL.position.x = faceMount.blushLPosition[0] * state.jellyX;
  model.blushR.position.x = faceMount.blushRPosition[0] * state.jellyX;
  model.face.mouthGroup.position.x = faceMount.mouthPosition[0] * state.jellyX;

  model.eyeL.position.y = faceMount.eyeLPosition[1];
  model.eyeR.position.y = faceMount.eyeRPosition[1];
  model.blushL.position.y = faceMount.blushLPosition[1];
  model.blushR.position.y = faceMount.blushRPosition[1];

  projectFaceOnMesh(model.face, body);

  const stretchFactor = cl(stretchY / 0.85, 0, 1);
  const eyeExtraZ = 0.015 + stretchFactor * 0.025;
  if (model.face.eyeL) model.face.eyeL.position.z += eyeExtraZ;
  if (model.face.eyeR) model.face.eyeR.position.z += eyeExtraZ;

  if (model.mouth) {
    model.mouth.scale.set(1, 1, 1);
  }

  shadow.scale.set(0.85 + sqAbs * 0.8, 1, 0.85 + sqAbs * 0.6);
  shadow.material.opacity = cl(0.12 - idleBob * 0.4, 0.06, 0.14);
}

const animationHooks = {
  idle: updateNewbornPose,
  walk: updateNewbornPose,
  talking: updateNewbornPose,
  apply(animationName, model, state, context) {
    const hook = animationHooks[animationName] || animationHooks.idle;
    hook(model, state, context);
  }
};

function createModel() {
  const group = new THREE.Group();
  group.position.set(0, 0, 2);
  group.scale.setScalar(0.44);

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const geom = new THREE.SphereGeometry(0.55, 32, 24);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    
    const lump = 1.0 
      + 0.14 * Math.sin(x * 5.0) * Math.cos(y * 4.5) * Math.sin(z * 5.0) 
      + 0.06 * Math.cos(x * 8.5) * Math.sin(y * 8.0) * Math.cos(z * 8.5);
      
    pos.setX(i, x * lump);
    pos.setY(i, y * lump);
    pos.setZ(i, z * lump);
  }
  geom.computeVertexNormals();

  const body = new THREE.Mesh(
    geom,
    new THREE.MeshPhysicalMaterial({
      color: 0xffdcd0,
      roughness: 0.78,
      metalness: 0.0,
      emissive: 0xffbda6,
      emissiveIntensity: 0.18,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45
    })
  );
  body.position.y = 0.42;
  body.castShadow = true;
  bodyRoot.add(body);

  const face = createFaceRig(faceMount);
  bodyRoot.add(face.group);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 32),
    new THREE.MeshBasicMaterial({ color: 0x0a0500, transparent: true, opacity: 0.12 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  group.add(shadow);

  return {
    id: newbornCharacter.id,
    label: newbornCharacter.label,
    group,
    bodyRoot,
    face,
    shadow,
    parts: { body },
    animations: animationHooks,
    squashGroup: bodyRoot,
    body,
    mouth: face.mouth,
    eyeL: face.eyeL,
    eyeR: face.eyeR,
    blushL: face.blushL,
    blushR: face.blushR,
    shadowDisc: shadow
  };
}

export const newbornCharacter = {
  id: "newborn",
  label: "Newborn",
  playable: true,
  labVisible: true,
  placeholder: false,
  supportedAnimations: ["idle", "walk", "talking"],
  faceMount,
  createModel,
  animations: animationHooks
};

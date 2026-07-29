import * as THREE from "three";
import { AMBUTE_CONFIG } from "../constants";

const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

function nextBlinkDelay() {
  return 2400 + Math.random() * 2600;
}

function applyMountTransform(group, mount = {}) {
  const position = mount.position || [0, 0, 0];
  const rotation = mount.rotation || [0, 0, 0];
  const scale = mount.scale ?? 1;

  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  if (Array.isArray(scale)) group.scale.set(scale[0], scale[1], scale[2]);
  else group.scale.setScalar(scale);
}

function createEye(x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 12),
    new THREE.MeshStandardMaterial({ color: AMBUTE_CONFIG.EYE_COLOR, roughness: 0.8 })
  );
  mesh.position.set(x, y, z);
  mesh.scale.z = 0.5;
  return mesh;
}

function createBlush(x, y, z) {
  const material = new THREE.MeshStandardMaterial({
    color: AMBUTE_CONFIG.BLUSH_COLOR,
    transparent: true,
    opacity: 0,
    roughness: 0.95
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(1.5, 0.6, 0.3);
  return mesh;
}

export function createMouthGeometry(type) {
  if (type === "talking") {
    const geo = new THREE.SphereGeometry(0.04, 16, 16);
    geo.scale(2.0, 1.2, 0.2);
    return geo;
  }

  if (type === "open_wide" || type === "eating") {
    const geo = new THREE.SphereGeometry(0.12, 16, 16);
    geo.scale(2.0, 1.2, 0.2);
    return geo;
  }

  if (type === "open_small" || type === "small") {
    const geo = new THREE.SphereGeometry(0.04, 16, 16);
    geo.scale(1, 1, 0.2);
    return geo;
  }

  let p0;
  let p1;
  let p2;
  if (type === "happy") {
    p0 = new THREE.Vector3(-0.08, 0, 0);
    p1 = new THREE.Vector3(0, -0.05, 0.02);
    p2 = new THREE.Vector3(0.08, 0, 0);
  } else if (type === "sad") {
    p0 = new THREE.Vector3(-0.08, -0.03, 0);
    p1 = new THREE.Vector3(0, 0.02, 0.02);
    p2 = new THREE.Vector3(0.08, -0.03, 0);
  } else {
    p0 = new THREE.Vector3(-0.06, 0, 0);
    p1 = new THREE.Vector3(0, 0, 0.01);
    p2 = new THREE.Vector3(0.06, 0, 0);
  }

  return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 8, 0.012, 6, false);
}

function mouthTypeForExpression(expr) {
  if (expr === "talking") return "talking";
  if (["eating", "open_wide"].includes(expr)) return "open_wide";
  if (["happy", "veryhappy", "excited", "playful", "affectionate", "content"].includes(expr)) return "happy";
  if (["sad", "melancholy", "worried", "scared", "anxious"].includes(expr)) return "sad";
  if (expr === "sleepy") return "small";
  if (expr === "startled") return "open_small";
  return "neutral";
}

export function createFaceRig(faceMount) {
  const group = new THREE.Group();
  applyMountTransform(group, faceMount);

  const eyeLPos = faceMount.eyeLPosition || [-0.16, 0.65, 0.52];
  const eyeRPos = faceMount.eyeRPosition || [0.16, 0.65, 0.52];
  const blushLPos = faceMount.blushLPosition || [-0.35, 0.45, 0.48];
  const blushRPos = faceMount.blushRPosition || [0.35, 0.45, 0.48];
  const mouthPos = faceMount.mouthPosition || [0, 0.45, 0.56];

  const eyeL = createEye(eyeLPos[0], eyeLPos[1], eyeLPos[2]);
  const eyeR = createEye(eyeRPos[0], eyeRPos[1], eyeRPos[2]);
  group.add(eyeL, eyeR);

  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(mouthPos[0], mouthPos[1], mouthPos[2]);
  const mouth = new THREE.Mesh(
    createMouthGeometry("neutral"),
    new THREE.MeshStandardMaterial({ color: AMBUTE_CONFIG.MOUTH_COLOR, roughness: 0.8 })
  );
  mouthGroup.add(mouth);
  group.add(mouthGroup);

  const blushL = createBlush(blushLPos[0], blushLPos[1], blushLPos[2]);
  const blushR = createBlush(blushRPos[0], blushRPos[1], blushRPos[2]);
  group.add(blushL, blushR);

  return {
    group,
    eyeL,
    eyeR,
    mouth,
    mouthGroup,
    blushL,
    blushR,
    baseEyeX: { left: eyeLPos[0], right: eyeRPos[0] },
    baseZ: {
      eyeL: eyeLPos[2],
      eyeR: eyeRPos[2],
      blushL: blushLPos[2],
      blushR: blushRPos[2],
      mouth: mouthPos[2]
    },
    baseMouthY: mouthPos[1],
    baseEyeScaleY: 1,
    blinkStartedAt: 0,
    blinkDuration: 145,
    nextBlinkAt: Date.now() + nextBlinkDelay(),
    expression: "neutral",
    mouthType: "neutral"
  };
}

export function applyFaceExpression(face, expr = "neutral") {
  if (!face) return;
  const nextMouthType = mouthTypeForExpression(expr);
  if (face.mouth && face.mouthType !== nextMouthType) {
    face.mouth.geometry.dispose();
    face.mouth.geometry = createMouthGeometry(nextMouthType);
    face.mouthType = nextMouthType;
  }

  const hasBlush = ["happy", "veryhappy", "excited", "affectionate", "playful", "content", "eating"].includes(expr);
  if (face.blushL) face.blushL.material.opacity = hasBlush ? 0.6 : 0;
  if (face.blushR) face.blushR.material.opacity = hasBlush ? 0.6 : 0;

  const wideEyes = ["scared", "worried", "anxious"].includes(expr);
  const eyeScaleY = (expr === "sleepy") ? 0.05 : (expr === "closed") ? 0.18 : wideEyes ? 1.35 : 1;
  face.baseEyeScaleY = eyeScaleY;
  if (face.eyeL) face.eyeL.scale.y = eyeScaleY;
  if (face.eyeR) face.eyeR.scale.y = eyeScaleY;
  face.expression = expr;
}

export function updateFaceTracking(face, { sleeping = false, interested = false, targetOffsetX = 0 } = {}) {
  if (!face?.eyeL || !face?.eyeR) return;
  const now = Date.now();
  const offset = !sleeping && interested ? cl(targetOffsetX, -0.04, 0.04) : 0;
  const alpha = interested ? 0.06 : 0.04;
  face.eyeL.position.x = lerp(face.eyeL.position.x, face.baseEyeX.left + offset, alpha);
  face.eyeR.position.x = lerp(face.eyeR.position.x, face.baseEyeX.right + offset, alpha);

  const canBlink = !sleeping && face.expression !== "sleepy" && face.expression !== "closed";
  let blinkAmount = 0;

  if (!canBlink) {
    face.blinkStartedAt = 0;
    face.nextBlinkAt = now + nextBlinkDelay();
  } else {
    if (!face.blinkStartedAt && now >= face.nextBlinkAt) {
      face.blinkStartedAt = now;
    }

    if (face.blinkStartedAt) {
      const progress = (now - face.blinkStartedAt) / face.blinkDuration;
      if (progress >= 1) {
        face.blinkStartedAt = 0;
        face.nextBlinkAt = now + nextBlinkDelay();
      } else {
        blinkAmount = Math.sin(progress * Math.PI);
      }
    }
  }

  const openScale = face.baseEyeScaleY ?? 1;
  const blinkScale = lerp(openScale, 0.04, blinkAmount);
  face.eyeL.scale.y = blinkScale;
  face.eyeR.scale.y = blinkScale;

  if (face.mouthGroup) {
    if (face.expression === "talking") {
      const talkTime = now * 0.018;
      const wave1 = Math.sin(talkTime * 0.85);
      const wave2 = Math.sin(talkTime * 1.95 + 0.4);
      const wave3 = Math.cos(talkTime * 3.4 + 1.1);

      let openFactor = (wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2 + 0.35);
      openFactor = cl(openFactor, 0.12, 1.0);

      const targetScaleY = 0.25 + openFactor * 0.9;
      const targetScaleX = 1.10 - openFactor * 0.25;

      face.mouthGroup.scale.y = lerp(face.mouthGroup.scale.y, targetScaleY, 0.35);
      face.mouthGroup.scale.x = lerp(face.mouthGroup.scale.x, targetScaleX, 0.35);

      if (face.baseMouthY !== undefined) {
        const jawDip = (openFactor - 0.5) * -0.006;
        face.mouthGroup.position.y = face.baseMouthY + jawDip;
      }
    } else {
      face.mouthGroup.scale.y = lerp(face.mouthGroup.scale.y, 1, 0.2);
      face.mouthGroup.scale.x = lerp(face.mouthGroup.scale.x, 1, 0.2);
      if (face.baseMouthY !== undefined) {
        face.mouthGroup.position.y = lerp(face.mouthGroup.position.y, face.baseMouthY, 0.2);
      }
    }
  }
}

const _raycaster = new THREE.Raycaster();
const _nominalWorldPos = new THREE.Vector3();
const _rayDirection = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _localPos = new THREE.Vector3();

export function projectFaceOnMesh(face, bodyMesh) {
  if (!face || !bodyMesh) return;

  face.group.updateWorldMatrix(true, true);
  bodyMesh.updateWorldMatrix(true, true);

  const elements = [
    { mesh: face.eyeL, baseZ: face.baseZ.eyeL, offset: 0.018 },
    { mesh: face.eyeR, baseZ: face.baseZ.eyeR, offset: 0.018 },
    { mesh: face.blushL, baseZ: face.baseZ.blushL, offset: 0.022 },
    { mesh: face.blushR, baseZ: face.baseZ.blushR, offset: 0.022 },
    { mesh: face.mouthGroup, baseZ: face.baseZ.mouth, offset: 0.020 }
  ];

  face.group.getWorldDirection(_rayDirection).negate();

  const wasVisible = face.group.visible;
  face.group.visible = false;

  for (const el of elements) {
    if (!el.mesh) continue;

    _nominalWorldPos.set(el.mesh.position.x, el.mesh.position.y, el.baseZ);
    face.group.localToWorld(_nominalWorldPos);

    _rayOrigin.copy(_nominalWorldPos).addScaledVector(_rayDirection, -2.0);

    _raycaster.set(_rayOrigin, _rayDirection);

    const intersects = _raycaster.intersectObject(bodyMesh, true);
    if (intersects.length > 0) {
      _localPos.copy(intersects[0].point);
      face.group.worldToLocal(_localPos);
      
      el.mesh.position.z = _localPos.z + el.offset;
    }
  }

  face.group.visible = wasVisible;
}

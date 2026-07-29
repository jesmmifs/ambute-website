import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { AMBUTE_CONFIG } from "../constants";
import { createFaceRig, updateFaceTracking, projectFaceOnMesh, applyFaceExpression } from "./faceRig";

const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

const METABODY_RESOLUTION = 38;
const METABODY_ISOLATION = 1.0;
const METABODY_POSITION = [0, 0.75, 0];
const METABODY_SCALE = [0.88, 0.95, 0.80];

const faceMount = {
  position: [0, 0.63, -0.085],
  rotation: [0, 0, 0],
  scale: 0.78,
  eyeLPosition: [-0.16, 0.65, 0.53],
  eyeRPosition: [0.16, 0.65, 0.53],
  blushLPosition: [-0.35, 0.45, 0.51],
  blushRPosition: [0.35, 0.45, 0.51],
  mouthPosition: [0, 0.48, 0.60]
};

function createBodyMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: AMBUTE_CONFIG.BODY_COLOR,
    roughness: 0.7,
    metalness: 0.0,
    emissive: AMBUTE_CONFIG.EMISSIVE_COLOR,
    emissiveIntensity: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25
  });
}

function addSoftEllipsoid(metabody, shape) {
  const {
    x,
    y,
    z,
    rx,
    ry,
    rz,
    strength,
    falloff = 1.2,
    cutoff = 3.0
  } = shape;
  const size = metabody.size;
  const halfsize = metabody.halfsize;
  const field = metabody.field;
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

function updateMetabodySurface(metabody, phase = 0, breath = 0, ripple = 0, walkPhase = 0, walkWeight = 0, legOffsets = null) {
  metabody.reset();

  const localScale = 0.82; // Scale factor to fit metabody safely inside marching cubes bounds without clipping

  const softPulse = breath * 0.018 * localScale;
  const headPulse = (breath * 0.014 + ripple * 0.007) * localScale;
  const bellyBreath = Math.max(0, breath) * 0.055 * localScale;
  const sway = Math.sin(phase * 0.58) * 0.030 * localScale;
  const headSway = sway * 0.70;
  const torsoSway = sway * 0.45;
  const hipSway = sway * 0.18;
  const leftArmLift = Math.sin(phase * 0.72 + 0.35) * 0.052 * localScale;
  const rightArmLift = Math.sin(phase * 0.72 + 1.10) * 0.052 * localScale;
  const leftArmReach = (0.014 + Math.sin(phase * 0.72 + 0.85) * 0.006) * localScale;
  const rightArmReach = (0.014 + Math.sin(phase * 0.72 + 1.60) * 0.006) * localScale;
  const footWobble = Math.sin(phase * 0.86) * 0.010 * localScale;

  // Walk cycle parameters
  const walkSway = Math.sin(walkPhase) * 0.05 * walkWeight * localScale;
  const walkBob = Math.cos(walkPhase * 2) * -0.045 * walkWeight * localScale; // Dip twice per cycle
  
  // Leg movement
  const leftLegZ = Math.sin(walkPhase) * 0.22 * walkWeight * localScale;
  const rightLegZ = -Math.sin(walkPhase) * 0.22 * walkWeight * localScale;
  const leftLegLift = Math.max(0, Math.cos(walkPhase)) * 0.12 * walkWeight * localScale;
  const rightLegLift = Math.max(0, -Math.cos(walkPhase)) * 0.12 * walkWeight * localScale;
  
  // Arm movement (swing in opposition to legs)
  const armSwingZ = Math.sin(walkPhase) * 0.16 * walkWeight * localScale;
  const armSwingY = Math.cos(walkPhase) * 0.08 * walkWeight * localScale;

  const getOffset = (val) => (val ?? 0) * localScale;

  const scaledOffsets = {
    pelvisY: getOffset(legOffsets?.pelvisY),
    pelvisZ: getOffset(legOffsets?.pelvisZ),
    bellyScale: legOffsets?.bellyScale ?? 1.0,
    bellyStrength: legOffsets?.bellyStrength ?? 1.0,
    neckX: getOffset(legOffsets?.neckX),
    neckY: getOffset(legOffsets?.neckY),
    neckZ: getOffset(legOffsets?.neckZ),
    headX: getOffset(legOffsets?.headX),
    headY: getOffset(legOffsets?.headY),
    headZ: getOffset(legOffsets?.headZ),
    leftLegX: getOffset(legOffsets?.leftLegX),
    leftLegY: getOffset(legOffsets?.leftLegY),
    leftLegZ: getOffset(legOffsets?.leftLegZ),
    rightLegX: getOffset(legOffsets?.rightLegX),
    rightLegY: getOffset(legOffsets?.rightLegY),
    rightLegZ: getOffset(legOffsets?.rightLegZ),
    crotchY: getOffset(legOffsets?.crotchY),
    crotchZ: getOffset(legOffsets?.crotchZ),
    leftArmX: getOffset(legOffsets?.leftArmX),
    leftArmY: getOffset(legOffsets?.leftArmY),
    leftArmZ: getOffset(legOffsets?.leftArmZ),
    rightArmX: getOffset(legOffsets?.rightArmX),
    rightArmY: getOffset(legOffsets?.rightArmY),
    rightArmZ: getOffset(legOffsets?.rightArmZ)
  };

  const fields = [
    {
      x: hipSway + walkSway,
      y: -0.20 * localScale + softPulse * 0.45 + walkBob + scaledOffsets.pelvisY,
      z: 0 + scaledOffsets.pelvisZ,
      rx: (0.56 - breath * 0.010) * localScale,
      ry: (0.54 + breath * 0.014) * localScale,
      rz: (0.55 + ripple * 0.008) * localScale,
      strength: 3.30
    },
    {
      x: hipSway * 0.55 + walkSway * 0.6,
      y: -0.48 * localScale + softPulse * 0.30 + walkBob + scaledOffsets.pelvisY,
      z: 0.01 * localScale + scaledOffsets.pelvisZ,
      rx: (0.46 - breath * 0.006) * localScale,
      ry: (0.28 + breath * 0.010) * localScale,
      rz: (0.45 + ripple * 0.006) * localScale,
      strength: 1.92
    },
    {
      x: torsoSway + walkSway * 0.4,
      y: -0.28 * localScale + softPulse * 0.30 + walkBob,
      z: 0.34 * localScale + bellyBreath * 0.65,
      rx: (0.41 + bellyBreath * 0.70 - breath * 0.006) * scaledOffsets.bellyScale * localScale,
      ry: (0.42 + bellyBreath * 0.36 + breath * 0.012) * scaledOffsets.bellyScale * localScale,
      rz: (0.36 + bellyBreath + ripple * 0.006) * scaledOffsets.bellyScale * localScale,
      strength: (1.24 + bellyBreath * 2.1) * scaledOffsets.bellyStrength,
      falloff: 1.28,
      cutoff: 2.6
    },
    {
      x: torsoSway + walkSway * 0.2,
      y: 0.16 * localScale + softPulse + walkBob,
      z: 0,
      rx: (0.46 + ripple * 0.008) * localScale,
      ry: (0.40 + breath * 0.010) * localScale,
      rz: 0.47 * localScale,
      strength: 2.08
    },
    {
      x: headSway * 0.75 + walkSway * 0.1 + scaledOffsets.neckX,
      y: 0.35 * localScale + walkBob + scaledOffsets.neckY,
      z: 0 + scaledOffsets.neckZ,
      rx: 0.34 * localScale,
      ry: 0.18 * localScale,
      rz: 0.35 * localScale,
      strength: 1.08
    },
    {
      x: headSway + walkSway * 0.05 + scaledOffsets.headX,
      y: 0.57 * localScale + headPulse + walkBob + scaledOffsets.headY,
      z: 0.01 * localScale + scaledOffsets.headZ,
      rx: (0.44 + ripple * 0.006) * localScale,
      ry: (0.36 + breath * 0.008) * localScale,
      rz: 0.50 * localScale,
      strength: 2.32
    },
    {
      x: (-0.50 - leftArmReach * 0.30 + torsoSway * 0.55 + walkSway * 0.3) * localScale + scaledOffsets.leftArmX * 0.30,
      y: 0.03 * localScale + leftArmLift * 0.30 + walkBob + armSwingY * 0.2 + scaledOffsets.leftArmY * 0.30,
      z: armSwingZ * 0.2 + scaledOffsets.leftArmZ * 0.30,
      rx: 0.082 * localScale,
      ry: 0.098 * localScale,
      rz: 0.120 * localScale,
      strength: 0.65
    },
    {
      x: (-0.62 - leftArmReach * 0.70 + torsoSway * 0.45 + walkSway * 0.2) * localScale + scaledOffsets.leftArmX * 0.70,
      y: -0.05 * localScale + leftArmLift * 0.70 + walkBob + armSwingY * 0.6 + scaledOffsets.leftArmY * 0.70,
      z: armSwingZ * 0.6 + scaledOffsets.leftArmZ * 0.70,
      rx: 0.088 * localScale,
      ry: 0.118 * localScale,
      rz: 0.125 * localScale,
      strength: 1.05
    },
    {
      x: (-0.72 - leftArmReach + torsoSway * 0.35 + walkSway * 0.1) * localScale + scaledOffsets.leftArmX,
      y: -0.14 * localScale + leftArmLift + walkBob + armSwingY + scaledOffsets.leftArmY,
      z: armSwingZ + scaledOffsets.leftArmZ,
      rx: 0.080 * localScale,
      ry: 0.130 * localScale,
      rz: 0.115 * localScale,
      strength: 1.40,
      cutoff: 2.4
    },
    {
      x: (0.50 + rightArmReach * 0.30 + torsoSway * 0.55 + walkSway * 0.3) * localScale + scaledOffsets.rightArmX * 0.30,
      y: 0.03 * localScale + rightArmLift * 0.30 + walkBob - armSwingY * 0.2 + scaledOffsets.rightArmY * 0.30,
      z: -armSwingZ * 0.2 + scaledOffsets.rightArmZ * 0.30,
      rx: 0.082 * localScale,
      ry: 0.098 * localScale,
      rz: 0.120 * localScale,
      strength: 0.65
    },
    {
      x: (0.62 + rightArmReach * 0.70 + torsoSway * 0.45 + walkSway * 0.2) * localScale + scaledOffsets.rightArmX * 0.70,
      y: -0.05 * localScale + rightArmLift * 0.70 + walkBob - armSwingY * 0.6 + scaledOffsets.rightArmY * 0.70,
      z: -armSwingZ * 0.6 + scaledOffsets.rightArmZ * 0.70,
      rx: 0.088 * localScale,
      ry: 0.118 * localScale,
      rz: 0.125 * localScale,
      strength: 1.05
    },
    {
      x: (0.72 + rightArmReach + torsoSway * 0.35 + walkSway * 0.1) * localScale + scaledOffsets.rightArmX,
      y: -0.14 * localScale + rightArmLift + walkBob - armSwingY + scaledOffsets.rightArmY,
      z: -armSwingZ + scaledOffsets.rightArmZ,
      rx: 0.080 * localScale,
      ry: 0.130 * localScale,
      rz: 0.115 * localScale,
      strength: 1.40,
      cutoff: 2.4
    },
    {
      x: (-0.46 + torsoSway * 0.40 + walkSway * 0.3) * localScale,
      y: -0.13 * localScale + walkBob + armSwingY * 0.3,
      z: armSwingZ * 0.08,
      rx: 0.055 * localScale,
      ry: 0.14 * localScale,
      rz: 0.13 * localScale,
      strength: -0.14,
      falloff: 1.25,
      cutoff: 1.8
    },
    {
      x: (0.46 + torsoSway * 0.40 + walkSway * 0.3) * localScale,
      y: -0.13 * localScale + walkBob - armSwingY * 0.3,
      z: -armSwingZ * 0.08,
      rx: 0.055 * localScale,
      ry: 0.14 * localScale,
      rz: 0.13 * localScale,
      strength: -0.14,
      falloff: 1.25,
      cutoff: 1.8
    },
    {
      x: -0.19 * localScale + walkSway * 0.8 + scaledOffsets.leftLegX,
      y: -0.82 * localScale + lerp(Math.max(0, footWobble) * 0.4, leftLegLift, walkWeight) + scaledOffsets.leftLegY,
      z: 0.01 * localScale + leftLegZ + scaledOffsets.leftLegZ,
      rx: 0.13 * localScale,
      ry: 0.18 * localScale,
      rz: 0.20 * localScale,
      strength: 2.85,
      falloff: 2.2,
      cutoff: 2.4
    },
    {
      x: 0.19 * localScale + walkSway * 0.8 + scaledOffsets.rightLegX,
      y: -0.82 * localScale + lerp(Math.max(0, -footWobble) * 0.4, rightLegLift, walkWeight) + scaledOffsets.rightLegY,
      z: 0.01 * localScale + rightLegZ + scaledOffsets.rightLegZ,
      rx: 0.13 * localScale,
      ry: 0.18 * localScale,
      rz: 0.20 * localScale,
      strength: 2.85,
      falloff: 2.2,
      cutoff: 2.4
    },
    {
      x: 0 + walkSway * 0.7,
      y: -0.80 * localScale + walkBob + scaledOffsets.crotchY,
      z: 0.02 * localScale + (leftLegZ + rightLegZ) * 0.5 + scaledOffsets.crotchZ,
      rx: 0.085 * localScale,
      ry: 0.18 * localScale,
      rz: 0.16 * localScale,
      strength: -0.34,
      falloff: 1.0,
      cutoff: 2.1
    },
    {
      x: -0.19 * localScale + walkSway * 0.8 + scaledOffsets.leftLegX,
      y: -0.64 * localScale + lerp(0, leftLegLift * 0.6, walkWeight) + scaledOffsets.leftLegY,
      z: 0.02 * localScale + leftLegZ * 0.6 + scaledOffsets.leftLegZ * 0.6,
      rx: 0.09 * localScale,
      ry: 0.12 * localScale,
      rz: 0.18 * localScale,
      strength: -0.18,
      falloff: 1.15,
      cutoff: 1.8
    },
    {
      x: 0.19 * localScale + walkSway * 0.8 + scaledOffsets.rightLegX,
      y: -0.64 * localScale + lerp(0, rightLegLift * 0.6, walkWeight) + scaledOffsets.rightLegY,
      z: 0.02 * localScale + rightLegZ * 0.6 + scaledOffsets.rightLegZ * 0.6,
      rx: 0.09 * localScale,
      ry: 0.12 * localScale,
      rz: 0.18 * localScale,
      strength: -0.18,
      falloff: 1.15,
      cutoff: 1.8
    }
  ];

  fields.forEach((field) => addSoftEllipsoid(metabody, field));
  metabody.update();
}

function createMetabody(material) {
  const metabody = new MarchingCubes(METABODY_RESOLUTION, material, false, false, 50000);
  metabody.isolation = METABODY_ISOLATION;
  metabody.position.set(...METABODY_POSITION);
  metabody.scale.set(...METABODY_SCALE);
  metabody.castShadow = true;
  metabody.frustumCulled = false;
  updateMetabodySurface(metabody);
  return metabody;
}

function handleBipedWakeUp(model, state, now, context) {
  if (state.sleepAnimState === undefined) return false;
  
  if (state.sleepAnimState !== "waking_up") {
    state.sleepAnimState = "waking_up";
    state.wakeAnimStart = now;
  }

  const t_wake = (now - state.wakeAnimStart) / 1000.0;
  const bodyRoot = model.bodyRoot;
  const parts = model.parts;
  const breath = Math.sin(now * 0.0012);

  if (t_wake >= 6.0) {
    // Completed waking up!
    state.sleepAnimState = undefined;
    state.wakeAnimStart = undefined;
    bodyRoot.position.set(0, 0, 0);
    bodyRoot.rotation.set(0, 0, 0);
    bodyRoot.scale.set(1, 1, 1);
    model.shadow.scale.set(1, 1, 0.78);
    model.shadow.position.set(0, 0.006, 0);
    return false;
  }

  let rootY = 0;
  let rootRotX = 0;
  let legOffsets = null;
  let shadowZScale = 0.78;
  let shadowZPos = 0;
  let headTiltX = 0;
  let headLookY = 0;
  let wakeScaleX = 1;
  let wakeScaleY = 1;
  let wakeScaleZ = 1;

  if (t_wake < 2.0) {
    // Stage 0: Lift head, look sideways, blink twice (0.0s to 2.0s)
    rootRotX = -1.5708;
    rootY = 0.28;
    shadowZScale = 2.1;
    shadowZPos = -0.25;

    // Head lift: tilts up towards the chest and lifts off the ground (more visible lift & tilt)
    let headZ = 0;
    let neckZ = 0;
    if (t_wake < 0.5) {
      headTiltX = lerp(0, 0.45, t_wake / 0.5);
      headZ = lerp(0, 0.24, t_wake / 0.5);
      neckZ = lerp(0, 0.12, t_wake / 0.5);
    } else if (t_wake < 1.5) {
      headTiltX = 0.45;
      headZ = 0.24;
      neckZ = 0.12;
    } else {
      headTiltX = lerp(0.45, 0, (t_wake - 1.5) / 0.5);
      headZ = lerp(0.24, 0, (t_wake - 1.5) / 0.5);
      neckZ = lerp(0.12, 0, (t_wake - 1.5) / 0.5);
    }

    // Look sideways (left then right then center)
    if (t_wake >= 0.4 && t_wake < 0.9) {
      headLookY = lerp(0, 0.4, (t_wake - 0.4) / 0.5);
    } else if (t_wake >= 0.9 && t_wake < 1.5) {
      headLookY = lerp(0.4, -0.4, (t_wake - 0.9) / 0.6);
    } else if (t_wake >= 1.5 && t_wake < 2.0) {
      headLookY = lerp(-0.4, 0, (t_wake - 1.5) / 0.5);
    }

    const headX = headLookY * 0.12;
    const neckX = headLookY * 0.06;

    legOffsets = {
      leftLegX: -0.20,
      leftLegY: 0.10,
      leftLegZ: -0.22,
      rightLegX: 0.20,
      rightLegY: 0.10,
      rightLegZ: -0.22,
      crotchY: 0.20,
      pelvisY: 0.0,
      headX,
      headY: 0,
      headZ,
      neckX,
      neckY: 0,
      neckZ
    };

    model.face.mouthGroup.position.y = faceMount.mouthPosition[1] + 0.07;
    model.face.mouthGroup.position.z = faceMount.mouthPosition[2] + 0.04;
  } else if (t_wake < 3.2) {
    // Stage 1: Sit up with a jerk and elastic jiggle (2.0s to 3.2s)
    const t_sit = t_wake - 2.0;
    
    if (t_sit < 0.4) {
      // Jerk phase: quadratic ease-in for snapping up
      const progress = Math.pow(t_sit / 0.4, 2);
      rootRotX = lerp(-1.5708, 0.0, progress);
      rootY = lerp(0.28, -0.22, progress);
      shadowZScale = lerp(2.1, 0.78, progress);
      shadowZPos = lerp(-0.25, 0.0, progress);

      // Head leads sit up: tilts and pushes forward
      const headLead = Math.sin(progress * Math.PI);
      headTiltX = headLead * 0.38;
      const headZ = headLead * 0.22;
      const neckZ = headLead * 0.10;

      legOffsets = {
        leftLegX: -0.15,
        leftLegY: 0.22,
        leftLegZ: lerp(-0.22, 0.45, progress),
        rightLegX: 0.15,
        rightLegY: 0.22,
        rightLegZ: lerp(-0.22, 0.45, progress),
        crotchY: 0.28,
        pelvisY: 0.08,
        headX: 0,
        headY: 0,
        headZ,
        neckX: 0,
        neckY: 0,
        neckZ
      };
      model.face.mouthGroup.position.y = lerp(faceMount.mouthPosition[1] + 0.07, faceMount.mouthPosition[1], progress);
      model.face.mouthGroup.position.z = lerp(faceMount.mouthPosition[2] + 0.04, faceMount.mouthPosition[2], progress);
    } else {
      // Jiggle/bounce phase: decaying elastic oscillation
      rootRotX = 0.0;
      rootY = -0.22;
      shadowZScale = 0.78;
      shadowZPos = 0.0;

      const bounceTime = t_sit - 0.4;
      const bounceAmp = Math.sin(bounceTime * 24) * Math.exp(-bounceTime * 5.0) * 0.22;
      
      rootRotX += bounceAmp * 0.65;
      rootY += bounceAmp * 0.12;

      // Squish-and-stretch body deformation (upright: local Y is height)
      wakeScaleX = 1 + bounceAmp * 0.20;
      wakeScaleZ = 1 + bounceAmp * 0.20;
      wakeScaleY = 1 - bounceAmp * 0.40;

      // Head tilts in opposition and jiggles
      headTiltX = -bounceAmp * 0.45;

      legOffsets = {
        leftLegX: -0.15,
        leftLegY: 0.22 + bounceAmp * 0.12,
        leftLegZ: 0.45 + bounceAmp * 0.18,
        rightLegX: 0.15,
        rightLegY: 0.22 + bounceAmp * 0.12,
        rightLegZ: 0.45 + bounceAmp * 0.18,
        crotchY: 0.28 + bounceAmp * 0.08,
        pelvisY: 0.08 + bounceAmp * 0.06,
        headX: 0,
        headY: 0,
        headZ: 0,
        neckX: 0,
        neckY: 0,
        neckZ: 0
      };
      model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
      model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
    }
  } else if (t_wake < 4.2) {
    // Stage 2: Lean forward, crouch slightly, and pull legs back underneath for support (3.2s to 4.2s)
    const progress = (t_wake - 3.2) / 1.0;
    
    // Lean forward more (anticipation)
    rootRotX = lerp(0.0, 0.08, progress);
    
    // Crouch down slightly from -0.22 to -0.25 (shallower to prevent floor clipping)
    rootY = lerp(-0.22, -0.25, progress);

    // Body squishes down vertically slightly
    wakeScaleX = lerp(1.0, 1.04, progress);
    wakeScaleZ = lerp(1.0, 1.04, progress);
    wakeScaleY = lerp(1.0, 0.92, progress);

    // Gentle, quick tension tremble
    const trembleAmp = 0.006 * Math.pow(progress, 2);
    const tremble = Math.sin(t_wake * 70) * trembleAmp;
    
    rootRotX += tremble * 0.4;
    rootY += tremble;
    wakeScaleY += tremble * 0.5;

    legOffsets = {
      leftLegX: lerp(-0.15, -0.05, progress) + tremble * 0.2,
      leftLegY: lerp(0.22, 0.25, progress) + tremble, // stays on floor as rootY drops to -0.25
      leftLegZ: lerp(0.45, 0.18, progress) + tremble * 0.3, // pull left leg back to support
      rightLegX: lerp(0.15, 0.0, progress) + tremble * 0.2,
      rightLegY: lerp(0.22, 0.25, progress) + tremble, // stays on floor as rootY drops to -0.25
      rightLegZ: lerp(0.45, -0.18, progress) + tremble * 0.3, // pull right leg back to support
      crotchY: lerp(0.28, 0.22, progress),
      pelvisY: lerp(0.08, 0.0, progress)
    };
    model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
    model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
  } else {
    // Stage 3: Push up and stand (4.2s to 6.0s)
    const t_stand = t_wake - 4.2;
    const progress = t_stand / 1.8;

    // Rises up and completes upright rotation/legs transition over the first 1.1s
    // Starts from crouched -0.25 and leans from 0.08 to 0.0
    const p_rise = Math.min(1.0, t_stand / 1.1);
    const rise = Math.sin(p_rise * Math.PI / 2);

    // Elastic stand overshoot: peaks high, bobs down, settles
    const standBounce = Math.sin(progress * Math.PI * 1.5) * Math.exp(-progress * 2.5);
    
    rootRotX = lerp(0.08, 0.0, rise) + standBounce * 0.05;
    rootY = lerp(-0.25, 0.0, rise) + standBounce * 0.08;

    // Squish-and-stretch: releases crouch compression, stretches tall, then settles
    const startScaleX = 1.04;
    const startScaleY = 0.92;
    wakeScaleX = lerp(startScaleX, 1.0, rise) - standBounce * 0.08;
    wakeScaleZ = lerp(startScaleX, 1.0, rise) - standBounce * 0.08;
    wakeScaleY = lerp(startScaleY, 1.0, rise) + standBounce * 0.16;

    // Head reacts to standing inertia
    headTiltX = standBounce * 0.06;

    legOffsets = {
      leftLegX: lerp(-0.05, 0.0, rise),
      leftLegY: lerp(0.25, 0.0, rise),
      leftLegZ: lerp(0.18, 0.0, rise),
      rightLegX: 0,
      rightLegY: lerp(0.25, 0.0, rise),
      rightLegZ: lerp(-0.18, 0.0, rise),
      crotchY: lerp(0.22, 0.0, rise),
      pelvisY: 0
    };
    model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
    model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
  }

  bodyRoot.position.set(0, rootY, 0);
  bodyRoot.rotation.set(rootRotX, 0, 0);
  bodyRoot.scale.set(wakeScaleX, wakeScaleY, wakeScaleZ);

  model.shadow.scale.set(1, 1, shadowZScale);
  model.shadow.position.z = shadowZPos;

  // Update metabody surface
  const phase = now * 0.0012;
  updateMetabodySurface(parts.metabody, phase, breath, 0, 0, 0, legOffsets);

  const headPulse = breath * 0.014;
  let snugCorrection = 0;
  if (t_wake < 2.0) {
    snugCorrection = 0.05 + Math.abs(headLookY) * 0.08;
  } else if (t_wake < 3.5) {
    const progress = (t_wake - 2.0) / 1.5;
    snugCorrection = lerp(0.05, 0, progress);
  }

  let faceOffsetZ = (legOffsets?.headZ ?? 0) * 0.66 - snugCorrection;
  let faceOffsetY = (legOffsets?.headY ?? 0) * 0.78;

  if (headTiltX !== 0) {
    // Compensate for the rotational swing of the eyes and mouth about the neck mount origin
    // to keep them perfectly snug on the head surface.
    const ry = 0.55;
    const rz = 0.53;
    const z_unrot = rz;
    const z_rot = ry * Math.sin(headTiltX) + rz * Math.cos(headTiltX);
    const delta_z = (z_rot - z_unrot) * 0.78; // scale by faceMount.scale

    const y_unrot = ry;
    const y_rot = ry * Math.cos(headTiltX) - rz * Math.sin(headTiltX);
    const delta_y = (y_rot - y_unrot) * 0.78; // scale by faceMount.scale

    faceOffsetZ -= delta_z;
    faceOffsetY -= delta_y;
  }

  model.face.group.position.x = faceMount.position[0] + (legOffsets?.headX ?? 0) * 0.72;
  model.face.group.position.y = faceMount.position[1] + headPulse * 0.78 + faceOffsetY;
  model.face.group.position.z = faceMount.position[2] + faceOffsetZ;
  model.face.group.rotation.x = headTiltX;
  model.face.group.rotation.y = headLookY;

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: false,
    targetOffsetX: 0
  });

  projectFaceOnMesh(model.face, parts.metabody);

  // Custom rapid blink override for Stage 0 of waking up
  if (t_wake < 2.0) {
    let blinkScale = 1.0;
    if (t_wake >= 0.2 && t_wake < 0.45) {
      const t_blink = (t_wake - 0.2) / 0.25;
      blinkScale = lerp(1.0, 0.04, Math.sin(t_blink * Math.PI));
    } else if (t_wake >= 0.9 && t_wake < 1.15) {
      const t_blink = (t_wake - 0.9) / 0.25;
      blinkScale = lerp(1.0, 0.04, Math.sin(t_blink * Math.PI));
    }
    model.face.eyeL.scale.y = blinkScale;
    model.face.eyeR.scale.y = blinkScale;
  }

  return true;
}

function updateBipedIdle(model, state, context = {}) {
  const now = context.now ?? Date.now();
  if (handleBipedWakeUp(model, state, now, context)) {
    return;
  }
  model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
  model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(1, 1, 1);
  }
  const phase = state.wobblePhase || now * 0.0012;
  const breath = Math.sin(phase * 1.1);
  const tinyRipple = Math.sin(phase * 2.45 + 0.35);
  const sway = Math.sin(phase * 0.58);
  const settle = Math.cos(phase * 0.48);
  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  const targetX = 1 - breath * 0.020 + tinyRipple * 0.012;
  const targetZ = 1 + breath * 0.020 + tinyRipple * 0.010;
  state.jellyX = lerp(state.jellyX ?? 1, targetX, 0.075);
  state.jellyZ = lerp(state.jellyZ ?? 1, targetZ, 0.075);

  bodyRoot.scale.set(state.jellyX, 1, state.jellyZ);
  bodyRoot.position.set(
    sway * 0.014,
    0,
    settle * 0.008
  );
  bodyRoot.rotation.z = sway * 0.032 + Math.sin(phase * 1.04) * 0.006;
  bodyRoot.rotation.x = settle * 0.010;

  updateMetabodySurface(parts.metabody, phase, breath, tinyRipple, 0, 0);

  const headPulse = breath * 0.014 + tinyRipple * 0.007;
  const headSway = sway * 0.030 * 0.70;
  model.face.group.position.x = faceMount.position[0] + headSway * 0.72;
  model.face.group.position.y = faceMount.position[1] + headPulse * 0.78;
  model.face.group.position.z = faceMount.position[2];

  // Look sideways periodic state machine
  if (state.lookTimer === undefined) {
    state.lookTimer = now + 1500 + Math.random() * 2000;
    state.targetLookYaw = 0;
    state.currentLookYaw = 0;
  }

  if (now >= state.lookTimer) {
    const rand = Math.random();
    if (rand < 0.70) {
      state.targetLookYaw = 0;
    } else if (rand < 0.85) {
      state.targetLookYaw = 0.32; // Look left
    } else {
      state.targetLookYaw = -0.32; // Look right
    }
    state.lookTimer = now + 2000 + Math.random() * 2500;
  }

  state.currentLookYaw = lerp(state.currentLookYaw ?? 0, state.targetLookYaw, 0.08);
  model.face.group.rotation.y = state.currentLookYaw;

  const shadowPulse = cl(Math.abs(breath), 0, 1);
  model.shadow.scale.set(1 + shadowPulse * 0.08, 1, 0.76 + shadowPulse * 0.06);
  model.shadow.position.set(0, 0.006, 0);
  model.shadow.material.opacity = 0.13 + shadowPulse * 0.025;

  const activeExpr = context.expression || state.expression || "neutral";
  if (model.face) {
    applyFaceExpression(model.face, activeExpr);
  }

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: activeExpr === "curious",
    targetOffsetX: ((context.ballPosition?.x ?? state.bx ?? 0) - (state.ax ?? 0)) * 0.05
  });

  projectFaceOnMesh(model.face, parts.metabody);
}

function updateBipedWalk(model, state, context = {}) {
  const now = context.now ?? Date.now();
  if (handleBipedWakeUp(model, state, now, context)) {
    return;
  }
  model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
  model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(1, 1, 1);
  }
  const phase = state.wobblePhase || now * 0.0012;
  const walkPhase = state.walkPhase || 0;
  const breath = Math.sin(phase * 1.1);
  const tinyRipple = Math.sin(phase * 2.45 + 0.35);
  const sway = Math.sin(phase * 0.58);
  const settle = Math.cos(phase * 0.48);
  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  const targetX = 1 - breath * 0.020 + tinyRipple * 0.012;
  const targetZ = 1 + breath * 0.020 + tinyRipple * 0.010;
  state.jellyX = lerp(state.jellyX ?? 1, targetX, 0.075);
  state.jellyZ = lerp(state.jellyZ ?? 1, targetZ, 0.075);

  bodyRoot.scale.set(state.jellyX, 1, state.jellyZ);
  
  // Forward walk lean and walk-driven root sway/bob
  const walkSwayX = Math.sin(walkPhase) * 0.025;
  bodyRoot.position.set(
    sway * 0.014 + walkSwayX,
    0,
    settle * 0.008 + Math.cos(walkPhase * 2) * -0.012
  );
  bodyRoot.rotation.z = sway * 0.032 + Math.sin(phase * 1.04) * 0.006 - Math.sin(walkPhase) * 0.05;
  bodyRoot.rotation.x = settle * 0.010 + 0.06; // Walk lean

  updateMetabodySurface(parts.metabody, phase, breath, tinyRipple, walkPhase, 1.0);

  const headPulse = breath * 0.014 + tinyRipple * 0.007;
  const headSway = sway * 0.030 * 0.70;
  const walkSway = Math.sin(walkPhase) * 0.05;
  const walkBob = Math.cos(walkPhase * 2) * -0.045;
  
  const headDispX = (headSway + walkSway * 0.05) * 0.72;
  const headDispY = (headPulse + walkBob) * 0.78;

  model.face.group.position.x = faceMount.position[0] + headDispX;
  model.face.group.position.y = faceMount.position[1] + headDispY;
  model.face.group.position.z = faceMount.position[2];

  // Return to forward looking during walk
  state.targetLookYaw = 0;
  state.currentLookYaw = lerp(state.currentLookYaw ?? 0, 0, 0.12);
  model.face.group.rotation.y = state.currentLookYaw;
  state.lookTimer = now + 1500 + Math.random() * 1500;

  const shadowPulse = cl(Math.abs(breath), 0, 1);
  const walkShadowScale = 1 + Math.abs(Math.sin(walkPhase)) * 0.05;
  model.shadow.scale.set((1 + shadowPulse * 0.08) * walkShadowScale, 1, (0.76 + shadowPulse * 0.06) * walkShadowScale);
  model.shadow.position.set(0, 0.006, 0);
  model.shadow.material.opacity = 0.13 + shadowPulse * 0.025;

  const activeExpr = context.expression || state.expression || "neutral";
  if (model.face) {
    applyFaceExpression(model.face, activeExpr);
  }

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: activeExpr === "curious",
    targetOffsetX: ((context.ballPosition?.x ?? state.bx ?? 0) - (state.ax ?? 0)) * 0.05
  });

  projectFaceOnMesh(model.face, parts.metabody);
}

function updateBipedSleep(model, state, context = {}) {
  const now = context.now ?? Date.now();
  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  if (state.sleepAnimState === undefined || state.sleepAnimState === "waking_up") {
    state.sleepAnimState = "going_to_sleep";
    state.sleepAnimStart = now;
  }

  const t = (now - state.sleepAnimStart) / 1000.0; // t is in seconds
  let rootY = 0;
  let rootRotX = 0;
  let scaleX = 1;
  let scaleZ = 1;
  let sleeping = false;
  let legOffsets = null;
  let shadowZScale = 0.78;
  let shadowZPos = 0;

  const breath = Math.sin(now * 0.0015); // Slower deep breathing during sleep
  
  if (t < 1.0) {
    // Stage 1: Lean forward (0.0s to 1.0s)
    const progress = t / 1.0;
    rootRotX = progress * 0.07; // reduced lean rotation to 0.07 to prevent belly floor melding
    rootY = 0.0;                // no drop in height during lean to prevent ground melding
  } else if (t < 2.2) {
    // Stage 2: Crouch and sit, splaying legs (1.0s to 2.2s)
    const progress = (t - 1.0) / 1.2;
    rootRotX = lerp(0.07, 0.0, progress);
    rootY = lerp(0.0, -0.22, progress); // sitting Y is -0.22 to keep pelvis above ground
    
    // Leg splaying
    const splay = progress;
    legOffsets = {
      leftLegX: splay * -0.15,
      leftLegY: splay * 0.25,
      leftLegZ: splay * 0.15,
      rightLegX: splay * 0.15,
      rightLegY: splay * 0.25,
      rightLegZ: splay * 0.15,
      crotchY: splay * 0.28,
      pelvisY: splay * 0.08
    };
  } else if (t < 2.5) {
    // Stage 3: Fall backward to flat (2.2s to 2.5s) - much faster fall (0.3s)
    const progress = (t - 2.2) / 0.3;
    rootRotX = lerp(0.0, -1.5708, progress); // Lie flat!
    rootY = lerp(-0.22, 0.28, progress);     // Elevate so back rests on the floor!
    shadowZScale = lerp(0.78, 2.1, progress); // Elongate shadow
    shadowZPos = lerp(0.0, -0.25, progress);  // Shift shadow center

    legOffsets = {
      leftLegX: lerp(-0.15, -0.20, progress),
      leftLegY: lerp(0.25, 0.10, progress),
      leftLegZ: lerp(0.15, -0.22, progress),
      rightLegX: lerp(0.15, 0.20, progress),
      rightLegY: lerp(0.25, 0.10, progress),
      rightLegZ: lerp(0.15, -0.22, progress),
      crotchY: lerp(0.28, 0.20, progress),
      pelvisY: lerp(0.08, 0.0, progress)
    };
  } else {
    // Stage 4: Deep Sleep & Jelly Jiggle (2.5s onwards)
    state.sleepAnimState = "sleeping";
    rootRotX = -1.5708;
    rootY = 0.28;
    sleeping = true;
    shadowZScale = 2.1;
    shadowZPos = -0.25;

    // Decaying jelly wiggle after the thud at 2.5s
    const wiggleTime = t - 2.5;
    const wiggleAmp = Math.sin(wiggleTime * 30) * Math.exp(-wiggleTime * 3.2) * 0.22;
    // Volume-conserving 3D squish-and-stretch (scaleZ is world Y, scaleX is world X, scaleY is world Z)
    scaleX = 1 + wiggleAmp * 0.35;
    scaleZ = 1 - wiggleAmp * 1.5;
    const scaleY = 1 + wiggleAmp * 0.25;
    rootY += wiggleAmp * 0.15;

    // Belly expands up and down with breath, fading in as wiggle settles
    const breathWeight = cl((wiggleTime - 0.5) * 0.5, 0, 1);
    const bellyBreath = Math.max(0, breath) * breathWeight;
    const bellyScale = 1.0 + bellyBreath * 0.24;
    const bellyStrength = 1.0 + bellyBreath * 0.35;

    legOffsets = {
      leftLegX: -0.20,
      leftLegY: 0.10,
      leftLegZ: -0.22,
      rightLegX: 0.20,
      rightLegY: 0.10,
      rightLegZ: -0.22,
      crotchY: 0.20,
      pelvisY: 0.0,
      bellyScale,
      bellyStrength
    };

    bodyRoot.scale.set(scaleX, scaleY, scaleZ);
  }

  bodyRoot.position.set(0, rootY, 0);
  bodyRoot.rotation.set(rootRotX, 0, 0);
  if (t < 2.5) {
    bodyRoot.scale.set(scaleX, 1, scaleZ);
  }

  // Update metabody with sleep phase
  const sleepPhase = now * 0.0012;
  updateMetabodySurface(parts.metabody, sleepPhase, breath, 0, 0, 0, legOffsets);

  // Position face snugly on the head during sleep
  const headPulse = breath * 0.014;
  model.face.group.position.x = faceMount.position[0];
  model.face.group.position.y = faceMount.position[1] + headPulse * 0.78;
  model.face.group.position.z = faceMount.position[2];
  model.face.group.rotation.x = 0;
  model.face.group.rotation.y = 0;
  model.face.group.rotation.z = 0;

  // Move mouth slightly up and forward during sleep to prevent engulfment by expanding belly
  model.face.mouthGroup.position.y = faceMount.mouthPosition[1] + 0.07;
  model.face.mouthGroup.position.z = faceMount.mouthPosition[2] + 0.04;
  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(1, 1, 1);
  }

  // Closed eyes
  updateFaceTracking(model.face, {
    sleeping: sleeping,
    interested: false,
    targetOffsetX: 0
  });

  projectFaceOnMesh(model.face, parts.metabody);

  // Update shadow size/opacity based on sleep position
  const shadowOpacity = lerp(0.14, 0.22, cl(t / 2.5, 0, 1));
  model.shadow.scale.set(1.1, 1, shadowZScale);
  model.shadow.position.z = shadowZPos;
  model.shadow.material.opacity = shadowOpacity;
}

function updateBipedEat(model, state, context = {}) {
  const now = context.now ?? Date.now();
  if (handleBipedWakeUp(model, state, now, context)) {
    return;
  }
  model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
  model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(1, 1, 1);
  }

  const phase = state.wobblePhase || now * 0.0012;
  const breath = Math.sin(phase * 1.1);
  const tinyRipple = Math.sin(phase * 2.45 + 0.35);
  const sway = Math.sin(phase * 0.58);
  const settle = Math.cos(phase * 0.48);
  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  // Volume-conserving breathing scaling
  const targetX = 1 - breath * 0.020 + tinyRipple * 0.012;
  const targetZ = 1 + breath * 0.020 + tinyRipple * 0.010;
  state.jellyX = lerp(state.jellyX ?? 1, targetX, 0.075);
  state.jellyZ = lerp(state.jellyZ ?? 1, targetZ, 0.075);

  bodyRoot.scale.set(state.jellyX, 1, state.jellyZ);

  // Body bends down slightly
  bodyRoot.position.set(
    sway * 0.014,
    -0.03, // slightly lower
    settle * 0.008 + 0.02 // slightly forward
  );
  bodyRoot.rotation.z = sway * 0.032 + Math.sin(phase * 1.04) * 0.006;
  bodyRoot.rotation.x = settle * 0.010 + 0.12; // bend body slightly forward (0.12 rad)

  // Eating cycle calculations (2.4 seconds total cycle, 1.2s per arm)
  const halfCycle = 1200;
  const eatCycleDuration = halfCycle * 2; // 2400ms
  const eatTime = now % eatCycleDuration;

  let leftArmX = 0;
  let leftArmY = 0;
  let leftArmZ = 0;
  let rightArmX = 0;
  let rightArmY = 0;
  let rightArmZ = 0;
  let headLookY = 0;
  let t_lift = 0;
  let activeExpr = "neutral";

  const localTime = eatTime % halfCycle;
  const isLeftArm = eatTime < halfCycle;

  // Compute snappier lift with a 300ms linger at peak
  const reachDuration = 450;
  const lingerDuration = 300;
  const returnDuration = 450;

  if (localTime < reachDuration) {
    // Phase 1: Reach forward (0 to 450ms)
    t_lift = Math.sin((localTime / reachDuration) * Math.PI / 2);
  } else if (localTime < reachDuration + lingerDuration) {
    // Phase 2: Linger at peak (450ms to 750ms)
    t_lift = 1.0;
  } else {
    // Phase 3: Return to side (750ms to 1200ms)
    const t_return = (localTime - reachDuration - lingerDuration) / returnDuration;
    t_lift = Math.cos(t_return * Math.PI / 2);
  }

  // Set offsets and head look based on active arm
  const targetYaw = 0.18;
  if (isLeftArm) {
    leftArmX = 0.20 * t_lift;
    leftArmY = 0;
    leftArmZ = 0.64 * t_lift;
    headLookY = targetYaw * t_lift;
  } else {
    rightArmX = -0.20 * t_lift;
    rightArmY = 0;
    rightArmZ = 0.64 * t_lift;
    headLookY = -targetYaw * t_lift;
  }

  // Mouth opens wide when hand is close to peak (t_lift > 0.45)
  activeExpr = t_lift > 0.45 ? "eating" : "happy";

  // Head bends down even more
  const headTiltX = 0.24 + settle * 0.02; // constant tilt forward/down plus tiny breathing sway

  const legOffsets = {
    pelvisY: 0,
    pelvisZ: 0,
    neckX: 0,
    neckY: -0.04,
    neckZ: 0.05,
    headX: 0,
    headY: -0.07,
    headZ: 0.09,
    leftLegX: 0,
    leftLegY: 0,
    leftLegZ: 0,
    rightLegX: 0,
    rightLegY: 0,
    rightLegZ: 0,
    crotchY: 0,
    crotchZ: 0,
    leftArmX,
    leftArmY,
    leftArmZ,
    rightArmX,
    rightArmY,
    rightArmZ
  };

  updateMetabodySurface(parts.metabody, phase, breath, tinyRipple, 0, 0, legOffsets);

  const headPulse = breath * 0.014 + tinyRipple * 0.007;
  const headSway = sway * 0.030 * 0.70;

  const headDispX = (headSway + legOffsets.headX) * 0.72;
  const headDispY = (headPulse + legOffsets.headY) * 0.78;
  const headDispZ = legOffsets.headZ * 0.66;

  model.face.group.position.x = faceMount.position[0] + headDispX;
  model.face.group.position.y = faceMount.position[1] + headDispY;
  model.face.group.position.z = faceMount.position[2] + headDispZ;
  model.face.group.rotation.x = headTiltX;
  model.face.group.rotation.y = headLookY;

  // Apply face expression based on hand proximity
  applyFaceExpression(model.face, activeExpr);

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: false,
    targetOffsetX: 0
  });

  // Snap the face onto the metabody surface
  projectFaceOnMesh(model.face, parts.metabody);

  // shadow scale/opacity
  const shadowPulse = cl(Math.abs(breath), 0, 1);
  model.shadow.scale.set(1 + shadowPulse * 0.08, 1, 0.76 + shadowPulse * 0.06);
  model.shadow.position.set(0, 0.006, 0);
  model.shadow.material.opacity = 0.13 + shadowPulse * 0.025;
}

function updateBipedSit(model, state, context = {}) {
  const now = context.now ?? Date.now();
  if (handleBipedWakeUp(model, state, now, context)) {
    return;
  }
  model.face.mouthGroup.position.y = faceMount.mouthPosition[1];
  model.face.mouthGroup.position.z = faceMount.mouthPosition[2];
  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(1, 1, 1);
  }

  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  const seatHeight = state.sitSpot?.height ?? 0.45;
  const sitHeight = seatHeight - 0.23; // Offset body root so pelvis rests on the cushion (raised by 0.10)

  let rootY = 0;
  let rootRotX = 0;
  let scaleX = 1;
  let scaleY = 1;
  let scaleZ = 1;
  let zOffset = 0;
  let legOffsets = null;

  const phase = state.wobblePhase || now * 0.0012;
  const breath = Math.sin(phase * 1.1);
  const tinyRipple = Math.sin(phase * 2.45 + 0.35);

  const isStandingUp = state.standAnimState === "standing_up";

  if (isStandingUp) {
    // Stand Up Transition
    const t_stand = (now - (state.standAnimStart || now)) / 1000.0;
    const progress = Math.min(1.0, t_stand / 1.2);

    // Lean forward to stand up, then recover upright
    rootRotX = lerp(0.0, 0.18, Math.sin(progress * Math.PI));
    rootY = lerp(sitHeight, 0.0, progress);
    zOffset = lerp(-0.74, 0.0, progress);

    // Minor stretch/compression while pushing up
    const stretch = Math.sin(progress * Math.PI) * 0.06;
    scaleY = 1.0 + stretch;
    scaleX = 1.0 - stretch * 0.5;
    scaleZ = 1.0 - stretch * 0.5;

    legOffsets = {
      leftLegX: lerp(-0.18, 0.0, progress),
      leftLegY: lerp(0.35, 0.0, progress),
      leftLegZ: lerp(0.54, 0.0, progress),
      rightLegX: lerp(0.18, 0.0, progress),
      rightLegY: lerp(0.35, 0.0, progress),
      rightLegZ: lerp(0.54, 0.0, progress),
      crotchY: lerp(0.20, 0.0, progress),
      pelvisY: lerp(0.05, 0.0, progress)
    };
  } else {
    // Normal Sitting Timeline
    const startTime = state.actionArrivedAt || now;
    const t = (now - startTime) / 1000.0;

    if (t < 1.2) {
      // Stage 1: Prep and Lean Forward (0.0s to 1.2s)
      const progress = t / 1.2;
      rootRotX = progress * 0.22;
      rootY = -progress * 0.06;
      zOffset = 0;

      scaleY = 1.0 - progress * 0.08;
      scaleX = 1.0 + progress * 0.04;
      scaleZ = 1.0 + progress * 0.04;

      legOffsets = {
        leftLegX: 0,
        leftLegY: progress * 0.15,
        leftLegZ: 0,
        rightLegX: 0,
        rightLegY: progress * 0.15,
        rightLegZ: 0,
        crotchY: 0,
        pelvisY: 0
      };
    } else if (t < 2.0) {
      // Stage 2: Jump Backwards (1.2s to 2.0s)
      const jumpProgress = (t - 1.2) / 0.8;
      rootRotX = lerp(0.22, -0.15, jumpProgress);

      const baseY = lerp(-0.06, sitHeight, jumpProgress);
      rootY = baseY + 0.35 * Math.sin(jumpProgress * Math.PI);
      zOffset = -0.74 * jumpProgress;

      scaleY = lerp(0.92, 1.10, jumpProgress);
      scaleX = lerp(1.04, 0.95, jumpProgress);
      scaleZ = lerp(1.04, 0.95, jumpProgress);

      legOffsets = {
        leftLegX: lerp(0.0, -0.18, jumpProgress),
        leftLegY: lerp(0.15, 0.35, jumpProgress),
        leftLegZ: lerp(0, 0.54, jumpProgress),
        rightLegX: lerp(0.0, 0.18, jumpProgress),
        rightLegY: lerp(0.15, 0.35, jumpProgress),
        rightLegZ: lerp(0, 0.54, jumpProgress),
        crotchY: lerp(0, 0.20, jumpProgress),
        pelvisY: lerp(0, 0.05, jumpProgress)
      };
    } else if (t < 2.8) {
      // Stage 3: Landing and Squish (2.0s to 2.8s)
      const bounceTime = t - 2.0;
      const bounceAmp = Math.sin(bounceTime * 20) * Math.exp(-bounceTime * 4.0) * 0.15;

      rootRotX = lerp(-0.15, 0.0, Math.min(1, bounceTime / 0.4));
      rootY = sitHeight + bounceAmp;
      zOffset = -0.74;

      scaleY = 1.0 - bounceAmp * 2.0;
      scaleX = 1.0 + bounceAmp;
      scaleZ = 1.0 + bounceAmp;

      legOffsets = {
        leftLegX: -0.18,
        leftLegY: 0.35 - bounceAmp * 0.5,
        leftLegZ: 0.54 + bounceAmp * 0.8,
        rightLegX: 0.18,
        rightLegY: 0.35 - bounceAmp * 0.5,
        rightLegZ: 0.54 + bounceAmp * 0.8,
        crotchY: 0.20 - bounceAmp * 0.3,
        pelvisY: 0.05 - bounceAmp * 0.2
      };
    } else {
      // Stage 4: Sitting Idle / Breathing (2.8s onwards)
      rootRotX = 0;
      rootY = sitHeight + breath * 0.015;
      zOffset = -0.74;

      scaleY = 1.0;
      scaleX = 1.0;
      scaleZ = 1.0;

      legOffsets = {
        leftLegX: -0.18,
        leftLegY: 0.35 + breath * 0.02,
        leftLegZ: 0.54,
        rightLegX: 0.18,
        rightLegY: 0.35 + breath * 0.02,
        rightLegZ: 0.54,
        crotchY: 0.20,
        pelvisY: 0.05
      };
    }
  }

  bodyRoot.position.set(0, rootY, zOffset);
  bodyRoot.rotation.set(rootRotX, 0, 0);
  bodyRoot.scale.set(scaleX, scaleY, scaleZ);

  // Smooth shadow opacity & scaling when elevated on chair
  const shadowOpacity = lerp(0.14, 0.04, cl((rootY - 0.1) / 0.45, 0, 1));
  const shadowScale = lerp(1.0, 0.72, cl(rootY / 0.45, 0, 1));
  model.shadow.scale.set(shadowScale, 1, 0.78 * shadowScale);
  model.shadow.position.set(0, 0.006, zOffset);
  model.shadow.material.opacity = shadowOpacity;

  updateMetabodySurface(parts.metabody, phase, breath, tinyRipple, 0, 0, legOffsets);

  const headPulse = breath * 0.014 + tinyRipple * 0.007;
  model.face.group.position.x = faceMount.position[0];
  model.face.group.position.y = faceMount.position[1] + headPulse * 0.78;
  model.face.group.position.z = faceMount.position[2];
  model.face.group.rotation.x = rootRotX * 0.6;
  model.face.group.rotation.y = 0;

  let activeExpr = "neutral";
  if (isStandingUp) {
    activeExpr = "neutral";
  } else {
    const startTime = state.actionArrivedAt || now;
    const t = (now - startTime) / 1000.0;
    if (t < 1.2) {
      activeExpr = "neutral";
    } else if (t < 2.0) {
      activeExpr = "happy";
    } else {
      activeExpr = "content";
    }
  }

  applyFaceExpression(model.face, activeExpr);

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: false,
    targetOffsetX: 0
  });

  projectFaceOnMesh(model.face, parts.metabody);
}

function updateBipedScared(model, state, context = {}) {
  const now = context.now ?? Date.now();
  if (handleBipedWakeUp(model, state, now, context)) {
    return;
  }

  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  // Fast tremble wiggles on position and rotation
  const shiverX = Math.sin(now * 0.16) * 0.006;
  const shiverY = Math.cos(now * 0.18) * 0.004;
  const shiverZ = Math.sin(now * 0.15) * 0.006;
  
  const rotX = Math.sin(now * 0.20) * 0.012;
  const rotZ = Math.cos(now * 0.22) * 0.012;

  bodyRoot.position.set(shiverX, shiverY, shiverZ);
  bodyRoot.rotation.set(rotX, 0, rotZ);

  // Volume-conserving jiggle/shivering scale
  const scalePulse = Math.sin(now * 0.24) * 0.010;
  const scaleY = 1.0 + scalePulse;
  const scaleX = 1.0 - scalePulse * 0.5;
  const scaleZ = 1.0 - scalePulse * 0.5;
  bodyRoot.scale.set(scaleX, scaleY, scaleZ);

  const phase = state.wobblePhase || now * 0.0012;
  const breath = Math.sin(phase * 1.1);
  const tinyRipple = Math.sin(phase * 2.45 + 0.35);

  const legOffsets = {
    leftLegX: 0,
    leftLegY: 0,
    leftLegZ: 0,
    rightLegX: 0,
    rightLegY: 0,
    rightLegZ: 0,
    crotchY: 0,
    pelvisY: 0
  };

  updateMetabodySurface(parts.metabody, phase, breath, tinyRipple, 0, 0, legOffsets);

  // Face updates: Force scared expression (wide eyes, sad mouth)
  if (model.face) {
    applyFaceExpression(model.face, "scared");
  }

  // Erratic look-around behavior
  const lookTime = now * 0.0018;
  const lookPattern = Math.sin(lookTime * 1.4) * 0.6 + Math.cos(lookTime * 3.7) * 0.4;
  const targetOffsetX = lookPattern * 0.07; // range -0.07 to +0.07

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: true,
    targetOffsetX: targetOffsetX
  });

  projectFaceOnMesh(model.face, parts.metabody);

  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(1, 1, 1);
  }

  // Reset face group position/scale to defaults
  model.face.group.scale.set(faceMount.scale, faceMount.scale, faceMount.scale);
  model.face.group.position.y = faceMount.position[1];

  // Shadow scaling
  model.shadow.scale.set(1.0, 1, 0.78);
  model.shadow.position.set(shiverX, 0.006, shiverZ);
  model.shadow.material.opacity = 0.14;
}

function updateBipedStartled(model, state, context = {}) {
  const now = context.now ?? Date.now();
  if (handleBipedWakeUp(model, state, now, context)) {
    return;
  }

  const bodyRoot = model.bodyRoot;
  const parts = model.parts;

  const startleFactor = state.startle || 1.0;

  // Duck down very slightly and bend forward just a tiny bit (not exaggerated)
  const rootRotX = 0.06 * startleFactor;
  const rootY = -0.04 * startleFactor;

  bodyRoot.position.set(0, rootY, 0);
  bodyRoot.rotation.set(rootRotX, 0, 0);

  // Squash while ducking down (subtle)
  const scaleY = 1.0 - 0.12 * startleFactor;
  const scaleX = 1.0 + 0.06 * startleFactor;
  const scaleZ = 1.0 + 0.06 * startleFactor;
  bodyRoot.scale.set(scaleX, scaleY, scaleZ);

  const phase = state.wobblePhase || now * 0.0012;
  const breath = Math.sin(phase * 1.1);
  const tinyRipple = Math.sin(phase * 2.45 + 0.35);

  // Arms go up a bit (Z offset is forward/up direction for arms)
  const armZOffset = 0.25 * startleFactor;
  const armXOffset = 0.08 * startleFactor;
  
  // Lower his head and neck slightly to duck down without massive leaning
  const legOffsets = {
    leftLegX: 0,
    leftLegY: 0,
    leftLegZ: 0,
    rightLegX: 0,
    rightLegY: 0,
    rightLegZ: 0,
    crotchY: 0,
    pelvisY: 0,
    leftArmX: armXOffset,
    leftArmY: 0,
    leftArmZ: armZOffset,
    rightArmX: -armXOffset,
    rightArmY: 0,
    rightArmZ: armZOffset,
    headY: -0.15 * startleFactor,
    headZ: 0.04 * startleFactor,
    neckY: -0.08 * startleFactor,
    neckZ: 0.02 * startleFactor
  };

  updateMetabodySurface(parts.metabody, phase, breath, tinyRipple, 0, 0, legOffsets);

  // Force startled face expression: open small startled mouth (mapped in faceRig)
  if (model.face) {
    applyFaceExpression(model.face, "startled");
  }

  updateFaceTracking(model.face, {
    sleeping: false,
    interested: false,
    targetOffsetX: 0
  });

  // Track face group positioning to match the lowered head/neck
  const headPulse = breath * 0.014 + tinyRipple * 0.007;
  const headDispY = headPulse * 0.78 + (-0.15 * startleFactor) * 0.78;
  const headDispZ = (0.04 * startleFactor) * 0.66;

  model.face.group.scale.set(faceMount.scale, faceMount.scale, faceMount.scale);
  model.face.group.position.x = faceMount.position[0];
  model.face.group.position.y = faceMount.position[1] + headDispY;
  model.face.group.position.z = faceMount.position[2] + headDispZ;
  model.face.group.rotation.x = 0.05 * startleFactor;
  model.face.group.rotation.y = 0;

  projectFaceOnMesh(model.face, parts.metabody);

  // Close eyes completely in the middle of startle (similar to Blob & Newborn)
  const eyeScaleY = Math.max(0.04, 1.0 - startleFactor * 1.5);
  if (model.face && model.face.eyeL) model.face.eyeL.scale.y = eyeScaleY;
  if (model.face && model.face.eyeR) model.face.eyeR.scale.y = eyeScaleY;

  // Open mouth in a small O shape, scaling with startleFactor for smooth transition
  if (model.face && model.face.mouth) {
    model.face.mouth.scale.set(startleFactor, startleFactor, 1.0);
  }

  // Shadow scaling
  model.shadow.scale.set(1.0 + startleFactor * 0.10, 1, 0.78 + startleFactor * 0.06);
  model.shadow.position.set(0, 0.006, 0);
  model.shadow.material.opacity = 0.14 - startleFactor * 0.02;
}

const animationHooks = {
  idle: updateBipedIdle,
  walk: updateBipedWalk,
  sleep: updateBipedSleep,
  eat: updateBipedEat,
  sit: updateBipedSit,
  scared: updateBipedScared,
  startled: updateBipedStartled,
  apply(animationName, model, state, context) {
    const hook = animationHooks[animationName] || animationHooks.idle;
    hook(model, state, context);
  }
};

function createModel() {
  const group = new THREE.Group();
  group.position.set(0, 0, 2);

  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const material = createBodyMaterial();
  const metabody = createMetabody(material);
  bodyRoot.add(metabody);

  const face = createFaceRig(faceMount);
  bodyRoot.add(face.group);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 40),
    new THREE.MeshBasicMaterial({ color: 0x0a0500, transparent: true, opacity: 0.14 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  shadow.scale.set(1, 1, 0.78);
  shadow.visible = false;
  group.add(shadow);

  return {
    id: bipedCharacter.id,
    label: bipedCharacter.label,
    group,
    bodyRoot,
    face,
    shadow,
    parts: {
      metabody
    },
    animations: animationHooks
  };
}

export const bipedCharacter = {
  id: "biped",
  label: "Biped",
  playable: true,
  labVisible: true,
  placeholder: false,
  supportedAnimations: ["idle", "walk", "sleep", "eat", "sit", "scared", "startled"],
  faceMount,
  createModel,
  animations: animationHooks
};


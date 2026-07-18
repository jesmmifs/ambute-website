import * as THREE from "three";

function softenIslandOutline(geometry, amount = 0.04, phase = 0) {
  const positions = geometry.attributes.position;

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const radius = Math.hypot(x, z);
    if (radius < 0.05) continue;

    const angle = Math.atan2(z, x);
    const irregularity =
      1 +
      Math.sin(angle * 3 + phase) * amount +
      Math.sin(angle * 7 - phase * 0.7) * amount * 0.42;
    positions.setX(index, x * irregularity);
    positions.setZ(index, z * irregularity);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createFlower(color, x, z, seed) {
  const flower = new THREE.Group();
  flower.position.set(x, 0.01, z);
  flower.userData.swayOffset = seed * 1.7;
  flower.userData.swaySpeed = 1.8 + seed * 0.16;

  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x3f7d3b,
    roughness: 0.9
  });
  const flowerMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    side: THREE.DoubleSide
  });
  const stemHeight = 0.26;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.015, stemHeight, 6),
    stemMaterial
  );
  stem.position.y = stemHeight / 2;
  stem.castShadow = true;
  flower.add(stem);

  for (let index = 0; index < 3; index += 1) {
    const bladePivot = new THREE.Group();
    const bladeLength = 0.17 + index * 0.018;
    bladePivot.position.y = 0.02;
    bladePivot.rotation.y =
      index * ((Math.PI * 2) / 3) + seed * 0.21;
    bladePivot.rotation.z = 0.47 + index * 0.035;
    flower.add(bladePivot);

    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.014, bladeLength, 4),
      stemMaterial
    );
    blade.position.y = bladeLength / 2;
    blade.castShadow = true;
    bladePivot.add(blade);
  }

  const bloom = new THREE.Group();
  bloom.position.y = stemHeight;
  bloom.rotation.set(seed * 0.025, seed * 0.8, -seed * 0.018);
  flower.add(bloom);

  const cupHeight = 0.095;
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.024, cupHeight, 6, 1, true),
    flowerMaterial
  );
  cup.position.y = cupHeight / 2;
  cup.castShadow = true;
  bloom.add(cup);

  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 8, 8),
    flowerMaterial
  );
  center.position.y = 0.015;
  center.castShadow = true;
  bloom.add(center);

  for (let index = 0; index < 3; index += 1) {
    const petalPivot = new THREE.Group();
    petalPivot.position.y = cupHeight - 0.01;
    petalPivot.rotation.y = index * ((Math.PI * 2) / 3);
    bloom.add(petalPivot);

    const petal = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.042, 3),
      flowerMaterial
    );
    petal.position.set(0.045, 0.015, 0);
    petal.rotation.z = -0.18;
    petal.castShadow = true;
    petalPivot.add(petal);
  }

  return flower;
}

function createButterfly() {
  const butterfly = new THREE.Group();
  butterfly.name = "garden-butterfly";

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6),
    new THREE.MeshStandardMaterial({ color: 0x1f1a17, roughness: 0.9 })
  );
  body.rotation.x = Math.PI / 2;
  butterfly.add(body);

  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8a25,
    roughness: 0.5,
    side: THREE.DoubleSide
  });
  const leftPivot = new THREE.Group();
  const rightPivot = new THREE.Group();
  leftPivot.position.x = -0.008;
  rightPivot.position.x = 0.008;
  butterfly.add(leftPivot, rightPivot);

  const wingParts = [
    [leftPivot, 0.13, 0.09, -0.065, 0.02],
    [leftPivot, 0.09, 0.07, -0.045, -0.04],
    [rightPivot, 0.13, 0.09, 0.065, 0.02],
    [rightPivot, 0.09, 0.07, 0.045, -0.04]
  ];
  wingParts.forEach(([pivot, width, depth, x, z]) => {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.003, depth),
      wingMaterial
    );
    wing.position.set(x, 0, z);
    pivot.add(wing);
  });

  butterfly.userData.update = (now) => {
    const time = now * 0.00055;
    const x =
      Math.sin(time * 1.55) * 1.38 + Math.sin(time * 4.1) * 0.18;
    const y =
      0.72 + Math.sin(time * 2.8) * 0.16 + Math.cos(time * 5.3) * 0.06;
    const z = 0.2 + Math.cos(time * 1.2) * 0.72;
    const nextTime = time + 0.01;
    const nextX =
      Math.sin(nextTime * 1.55) * 1.38 +
      Math.sin(nextTime * 4.1) * 0.18;
    const nextZ = 0.2 + Math.cos(nextTime * 1.2) * 0.72;

    butterfly.position.set(x, y, z);
    butterfly.rotation.y = Math.atan2(nextX - x, nextZ - z);
    butterfly.rotation.z = Math.sin(time * 3.4) * 0.08;

    const flap = (Math.sin(now * 0.024) + 1) * 0.625;
    leftPivot.rotation.z = flap;
    rightPivot.rotation.z = -flap;
  };

  return butterfly;
}

export function createGardenVignette() {
  const group = new THREE.Group();
  group.name = "garden-vignette";

  const shadowLayers = [
    { scale: [2.75, 1.32], opacity: 0.022 },
    { scale: [2.42, 1.1], opacity: 0.027 },
    { scale: [2.08, 0.9], opacity: 0.033 },
    { scale: [1.7, 0.7], opacity: 0.04 }
  ];
  shadowLayers.forEach(({ scale, opacity }) => {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x5f6b62,
        transparent: true,
        opacity,
        depthWrite: false,
        toneMapped: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -0.94, 0.18);
    shadow.scale.set(scale[0], scale[1], 1);
    shadow.renderOrder = -1;
    shadow.userData.revealLayer = "island-shadow";
    group.add(shadow);
  });

  const earthGeometry = softenIslandOutline(
    new THREE.CylinderGeometry(2.28, 2.02, 0.46, 64, 4),
    0.045,
    0.4
  );
  const earth = new THREE.Mesh(
    earthGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x664525,
      roughness: 0.98,
      flatShading: true
    })
  );
  earth.position.y = -0.23;
  earth.scale.z = 0.68;
  earth.castShadow = true;
  earth.receiveShadow = true;
  group.add(earth);

  const grassGeometry = softenIslandOutline(
    new THREE.CylinderGeometry(2.31, 2.28, 0.09, 64, 1),
    0.045,
    0.4
  );
  const grass = new THREE.Mesh(
    grassGeometry,
    new THREE.MeshStandardMaterial({ color: 0x4f9f48, roughness: 0.94 })
  );
  grass.position.y = -0.041;
  grass.scale.z = 0.68;
  grass.receiveShadow = true;
  group.add(grass);

  const flowers = [
    createFlower(0xe75878, -1.32, 0.54, 1),
    createFlower(0xf3d34a, 1.38, 0.42, 2),
    createFlower(0x7c62d9, 1.08, -0.5, 3)
  ];
  flowers.forEach((flower) => group.add(flower));

  const butterfly = createButterfly();
  group.add(butterfly);

  return {
    group,
    flowers,
    butterfly,
    update(now) {
      flowers.forEach((flower) => {
        const time =
          now * 0.001 * flower.userData.swaySpeed +
          flower.userData.swayOffset;
        flower.rotation.x = Math.sin(time) * 0.045;
        flower.rotation.z = Math.cos(time * 0.85) * 0.045;
      });
      butterfly.userData.update(now);
    }
  };
}

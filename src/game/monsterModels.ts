import * as THREE from 'three';
import { armorPanel, contourGeometry, taperedCurve } from './sculpting';
import { inkCharacter } from './anime';

export interface MonsterVisualProfile {
  id: 'golza' | 'melba' | 'kyrieloid' | 'gatanothor' | 'demogea' | 'belial';
  name: string;
  color: number;
  accent: number;
  variant?: 'enhanced';
}

interface MonsterSurfaces {
  skin: THREE.MeshStandardMaterial;
  armor: THREE.MeshPhysicalMaterial;
  dark: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
}

function noiseTexture(seed: number) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const x = index % size;
    const y = Math.floor(index / size);
    const scaleX = (x + (Math.floor(y / 8) % 2) * 4) % 8 - 4;
    const scaleY = y % 8 - 4;
    const scale = Math.max(0, 1 - (scaleX * scaleX + scaleY * scaleY) / 20);
    const grain = Math.sin((index + seed * 31) * 12.9898);
    const value = Math.round(72 + scale * 110 + grain * 14);
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  texture.needsUpdate = true;
  return texture;
}

function surfaces(profile: MonsterVisualProfile): MonsterSurfaces {
  const bump = noiseTexture(profile.id.length * 19);
  const armorColor = new THREE.Color(profile.accent).lerp(new THREE.Color(0x79756b), 0.5);
  const colorData = (bump.image.data as Uint8Array).slice();
  for (let index = 0; index < colorData.length; index += 4) {
    const value = 168 + colorData[index] * 0.32;
    colorData[index] = colorData[index + 1] = colorData[index + 2] = value;
  }
  const skinMap = new THREE.DataTexture(colorData, 64, 64);
  skinMap.wrapS = skinMap.wrapT = THREE.RepeatWrapping;
  skinMap.repeat.copy(bump.repeat);
  skinMap.colorSpace = THREE.SRGBColorSpace;
  skinMap.needsUpdate = true;
  return {
    skin: new THREE.MeshStandardMaterial({
      color: profile.color,
      roughness: 0.82,
      metalness: 0.03,
      bumpMap: bump,
      bumpScale: 0.055,
      map: skinMap,
    }),
    armor: new THREE.MeshPhysicalMaterial({
      color: armorColor,
      roughness: 0.61,
      metalness: 0.12,
      clearcoat: 0.22,
      bumpMap: bump,
      bumpScale: 0.04,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x171a1d,
      roughness: 0.86,
      bumpMap: bump,
      bumpScale: 0.07,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: 0xffd0a6,
      emissive: 0xff3218,
      emissiveIntensity: 2.2,
      roughness: 0.12,
    }),
  };
}

function part(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position?: [number, number, number],
  scale?: [number, number, number],
) {
  const result = new THREE.Mesh(geometry, surface);
  if (position) result.position.set(...position);
  if (scale) result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addEyes(
  group: THREE.Group,
  eyeSurface: THREE.Material,
  y: number,
  z: number,
  spacing: number,
  scale: [number, number, number] = [1.25, 0.5, 0.22],
) {
  for (const side of [-1, 1]) {
    const eye = part(
      new THREE.SphereGeometry(0.2, 18, 12),
      eyeSurface,
      [side * spacing, y, z],
      scale,
    );
    eye.rotation.z = -side * 0.1;
    group.add(eye);
  }
}

function jointedLimb(
  surface: THREE.Material,
  jointSurface: THREE.Material,
  length: number,
  radius: number,
  withClaws = false,
  isLeg = false,
) {
  const limb = new THREE.Group();
  const upper = part(contourGeometry([
    [0, radius * 0.3], [radius * 0.8, radius * 0.2], [radius * 1.1, -length * 0.16],
    [radius * 0.85, -length * 0.35], [radius * 0.66, -length * 0.5], [0, -length * 0.55],
  ], 0.87), surface);
  const joint = part(
    new THREE.SphereGeometry(radius * 0.88, 18, 12),
    jointSurface,
    [0, -length * 0.5, 0],
    [1, 0.8, 0.9],
  );
  const lower = new THREE.Group();
  lower.name = 'limb-joint';
  lower.position.y = -length * 0.5;
  lower.rotation.x = isLeg ? 0.13 : -0.27;
  lower.add(part(contourGeometry([
    [0, 0.07], [radius * 0.65, 0], [radius * 0.92, -length * 0.15],
    [radius * 0.67, -length * 0.33], [radius * 0.5, -length * 0.47], [0, -length * 0.52],
  ], 0.9), surface));
  limb.add(upper, joint, lower);
  if (withClaws) {
    const clawSurface = new THREE.MeshStandardMaterial({ color: 0xbdb394, roughness: 0.55 });
    lower.add(part(new THREE.SphereGeometry(radius * 0.86, 20, 14), surface,
      [0, -length * 0.47, isLeg ? 0.23 : 0.04], [1.12, isLeg ? 0.5 : 0.85, isLeg ? 1.65 : 0.8]));
    for (const offset of [-0.28, 0, 0.28]) {
      const x = offset * radius * 2;
      const y = -length * 0.48;
      lower.add(taperedCurve(isLeg
        ? [[x, y, 0.35], [x * 1.2, y - 0.04, 0.7], [x * 1.4, y - 0.13, 1.0]]
        : [[x, y, 0.13], [x * 1.2, y - 0.37, 0.23], [x * 1.25, y - 0.52, 0.53]],
      radius * 0.22, clawSurface, 12));
    }
  }
  return limb;
}

function organicSphere(radius: number, seed = 0) {
  const geometry = new THREE.SphereGeometry(radius, 36, 28);
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    // Position-based noise keeps the UV seam closed.
    const noise = Math.sin(x * 9 + seed) * Math.sin(y * 7 + z * 3) * Math.cos(z * 8 - x * 2);
    const factor = 1 + noise * 0.035;
    positions.setXYZ(index, x * factor, y * factor, z * factor);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function addScaleArmor(group: THREE.Group, material: THREE.Material, radius: number, centerY: number, height: number) {
  const rows = 12, columns = 22;
  const scaleShape = new THREE.Shape();
  scaleShape.moveTo(0,-.32);scaleShape.quadraticCurveTo(-.35,-.12,-.28,.18);
  scaleShape.quadraticCurveTo(0,.31,.28,.18);scaleShape.quadraticCurveTo(.35,-.12,0,-.32);
  const scales = new THREE.InstancedMesh(new THREE.ExtrudeGeometry(scaleShape, {depth:.035,bevelEnabled:false}), material, rows * columns);
  scales.name = 'overlapping-scales';
  scales.castShadow = scales.receiveShadow = true;
  const transform = new THREE.Object3D();
  for (let row = 0; row < rows; row += 1) {
    const latitude = -0.85 + row / (rows - 1) * 1.8;
    for (let column = 0; column < columns; column += 1) {
      const angle = (column + row % 2 * 0.5) / columns * Math.PI * 2;
      const width = Math.cos(latitude) * radius;
      transform.position.set(Math.sin(angle) * width, centerY + Math.sin(latitude) * height, Math.cos(angle) * width * 0.8);
      transform.rotation.set(-latitude * 0.4, angle, 0);
      transform.scale.set(.85,.9,1);
      transform.updateMatrix();
      scales.setMatrixAt(row * columns + column, transform.matrix);
      scales.setColorAt(row * columns + column, new THREE.Color().setScalar(.8+Math.sin(row*9+column*3)*.07));
    }
  }
  group.add(scales);
}

function addFangs(group: THREE.Group, material: THREE.Material, y: number, z: number, width: number) {
  for (let index = 0; index < 7; index += 1) {
    const x = (index / 6 - 0.5) * width;
    group.add(taperedCurve([[x, y, z], [x, y - 0.13, z + 0.025], [x * 0.98, y - 0.24, z + 0.06]], 0.06, material, 8));
  }
}

function createGolza(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const torso = part(
    organicSphere(1.48),
    skin.skin,
    [0, 4.65, 0],
    [1.08, 1.45, 0.86],
  );
  const chestArmor = part(
    new THREE.SphereGeometry(1.2, 24, 16),
    skin.armor,
    [0, 5.2, 0.72],
    [1.02, 0.92, 0.28],
  );
  monster.add(torso, chestArmor);
  addScaleArmor(monster, skin.skin, 1.59, 4.65, 2.12);

  for (let index = 0; index < 5; index += 1) {
    const bellyPlate = part(
      new THREE.SphereGeometry(0.78 - index * 0.06, 18, 10),
      skin.dark,
      [0, 4.55 - index * 0.52, 0.88],
      [1, 0.2, 0.18],
    );
    monster.add(bellyPlate);
  }

  const neck = part(
    new THREE.CylinderGeometry(0.72, 0.94, 1.25, 22),
    skin.skin,
    [0, 6.45, -0.05],
    [1, 1, 0.9],
  );
  const head = part(
    organicSphere(0.92, 2),
    skin.skin,
    [0, 7.35, 0.15],
    [0.92, 0.88, 1.12],
  );
  const jaw = part(
    new THREE.SphereGeometry(0.72, 22, 14),
    skin.dark,
    [0, 7.0, 0.76],
    [1, 0.45, 0.72],
  );
  monster.add(neck, head, jaw);
  const ivory = new THREE.MeshStandardMaterial({ color: 0xc9b994, roughness: 0.58 });
  addFangs(monster, ivory, 7.12, 1.2, 0.95);
  addEyes(monster, skin.eye, 7.48, 1.02, 0.34, [1.1, 0.46, 0.18]);

  const horn = taperedCurve([[0, 7.9, 0.12], [0, 8.6, -0.1], [0, 9.28, 0.22]], 0.33, skin.armor);
  monster.add(horn);
  for (const side of [-1, 1]) {
    const cheekHorn = part(
      new THREE.ConeGeometry(0.18, 0.78, 7),
      skin.armor,
      [side * 0.62, 7.32, 0.55],
    );
    cheekHorn.rotation.z = side * 0.82;
    monster.add(cheekHorn);

    const arm = jointedLimb(skin.skin, skin.armor, 3.15, 0.48, true);
    arm.position.set(side * 1.48, 5.65, 0);
    arm.rotation.z = -side * 0.15;
    arm.name = side < 0 ? 'monster-left-arm' : 'monster-right-arm';
    monster.add(arm);

    const leg = jointedLimb(skin.skin, skin.dark, 3.0, 0.62, true, true);
    leg.position.set(side * 0.66, 3.3, 0);
    leg.name = side < 0 ? 'monster-left-leg' : 'monster-right-leg';
    monster.add(leg);
  }

  for (let index = 0; index < 6; index += 1) {
    const spike = part(
      new THREE.ConeGeometry(0.18 + index * 0.025, 0.8 + index * 0.1, 7),
      skin.armor,
      [0, 6.55 - index * 0.62, -1.05],
    );
    spike.rotation.x = -Math.PI / 2.4;
    monster.add(spike);
  }

  const tail = taperedCurve([[0, 3.35, -1.05], [0.25, 2.5, -2.2], [0.8, 1.55, -3.5], [1.7, 0.4, -5.6]], 0.7, skin.skin, 32);
  tail.name = 'monster-tail';
  monster.add(tail);
  for (const side of [-1, 1]) {
    const brow = part(new THREE.CapsuleGeometry(0.17, 0.42, 4, 16), skin.armor, [side * 0.38, 7.65, 1.0], [1, 1, 0.6]);
    brow.rotation.z = side * 1.04;
    monster.add(brow);
  }
  return monster;
}

function createWing(side: number, surface: THREE.Material, boneSurface: THREE.Material) {
  const wing = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.7, 0.8, 2.3, 1.32, 3.9, 0.55);
  shape.bezierCurveTo(3.2, 0.24, 2.9, -0.12, 2.92, -0.85);
  shape.quadraticCurveTo(2.3, -0.48, 2.08, -1.62);
  shape.quadraticCurveTo(1.38, -1.0, 1.03, -2.22);
  shape.quadraticCurveTo(0.65, -1.65, 0, -1.7);
  shape.closePath();
  const membraneGeometry = new THREE.ShapeGeometry(shape, 24);
  const positions = membraneGeometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index), y = positions.getY(index);
    positions.setZ(index, Math.sin(x * 0.9) * 0.26 + Math.sin(y * 1.8) * 0.09);
  }
  membraneGeometry.computeVertexNormals();
  const membrane = part(membraneGeometry, surface);
  membrane.scale.x = side;
  membrane.position.z = -0.08;
  wing.add(membrane);
  for (const [x, y] of [[3.9, 0.55], [2.92, -0.85], [2.08, -1.62], [1.03, -2.22]]) {
    wing.add(taperedCurve([[0, 0, 0.08], [side * x * 0.55, y * 0.2 + 0.3, 0.34], [side * x, y, 0.1]], 0.105, boneSurface));
  }
  wing.name = side < 0 ? 'left-wing' : 'right-wing';
  return wing;
}

function createMelba(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const wingSurface = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(profile.accent).lerp(new THREE.Color(0x72613e), 0.55),
    roughness: 0.77,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
    bumpMap: noiseTexture(37),
    bumpScale: 0.025,
  });

  const torso = part(
    organicSphere(1.05, 4),
    skin.skin,
    [0, 4.65, 0],
    [0.85, 1.5, 0.72],
  );
  const chest = part(
    new THREE.SphereGeometry(0.76, 22, 14),
    skin.armor,
    [0, 5.05, 0.69],
    [0.88, 1.2, 0.25],
  );
  const neck = part(
    contourGeometry([[0, -0.9], [0.59, -0.75], [0.52, -0.3], [0.4, 0.3], [0.47, 0.83], [0, 0.94]], 0.86),
    skin.skin,
    [0, 6.25, 0],
  );
  const head = part(
    new THREE.SphereGeometry(0.68, 24, 16),
    skin.skin,
    [0, 7.35, 0.12],
    [0.88, 0.92, 1.08],
  );
  monster.add(torso, chest, neck, head);
  for (let row = 0; row < 6; row += 1) {
    const plate = part(new THREE.SphereGeometry(0.58 - row * 0.035, 20, 12), skin.armor,
      [0, 5.65 - row * 0.39, 0.67], [1, 0.4, 0.36]);
    monster.add(plate);
  }
  addEyes(monster, skin.eye, 7.48, 0.86, 0.28, [1, 0.5, 0.2]);
  const beakSurface = new THREE.MeshStandardMaterial({ color: 0x8d866c, roughness: 0.62 });

  const beak = taperedCurve([[0, 7.34, 0.55], [0, 7.24, 1.2], [0, 6.96, 1.96]], 0.34, beakSurface);
  monster.add(beak);
  monster.add(taperedCurve([[0, 7.0, 0.6], [0, 6.95, 1.11], [0, 6.9, 1.7]], 0.18, skin.dark));
  monster.add(taperedCurve([[0, 7.77, 0.12], [0, 8.1, -0.54], [0, 7.89, -1.3]], 0.3, skin.armor));
  for (const side of [-1, 1]) {
    monster.add(taperedCurve([[side * 0.11, 7.7, 0.76], [side * 0.42, 7.63, 0.73], [side * 0.63, 7.41, 0.28]], 0.15, skin.armor));
  }
  for (let row = 0; row < 5; row += 1) {
    const ridge = part(new THREE.TorusGeometry(0.44 + row * 0.016, 0.035, 5, 24), skin.armor,
      [0, 6.35 + row * 0.18, 0], [1, 1, 0.86]);
    ridge.rotation.x = Math.PI / 2;
    monster.add(ridge);
  }
  for (const side of [-1, 1]) {
    const horn = part(
      new THREE.ConeGeometry(0.16, 0.95, 7),
      skin.armor,
      [side * 0.42, 8.0, 0],
    );
    horn.rotation.z = side * 0.34;
    monster.add(horn);

    const wing = createWing(side, wingSurface, skin.armor);
    wing.position.set(side * 0.78, 5.7, -0.32);
    monster.add(wing);

    const leg = jointedLimb(skin.skin, skin.armor, 3.15, 0.38, true, true);
    leg.position.set(side * 0.46, 3.45, 0);
    leg.name = side < 0 ? 'monster-left-leg' : 'monster-right-leg';
    monster.add(leg);
  }
  monster.scale.setScalar(0.93);
  return monster;
}

function createKyrieloid(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const maskMaterial = new THREE.MeshPhysicalMaterial({ color: 0xa7acae, metalness: 0.25, roughness: 0.49 });
  const torso = part(
    organicSphere(1.05, 7),
    skin.skin,
    [0, 4.85, 0],
    [0.98, 1.45, 0.68],
  );
  const waist = part(
    new THREE.CylinderGeometry(0.62, 0.78, 1.3, 20),
    skin.dark,
    [0, 3.55, 0],
    [1, 1, 0.78],
  );
  const head = part(
    new THREE.SphereGeometry(0.72, 24, 16),
    skin.dark,
    [0, 7.2, 0],
    [0.78, 1.15, 0.75],
  );
  const facePlate = part(
    new THREE.SphereGeometry(0.56, 20, 14),
    maskMaterial,
    [0, 7.18, 0.56],
    [0.72, 1.18, 0.26],
  );
  monster.add(torso, waist, head, facePlate);
  for (const side of [-1, 1]) {
    monster.add(armorPanel([
      [side * 0.04, 7.15], [side * 0.45, 7.72], [side * 0.34, 7.82],
      [side * 0.12, 7.54], [side * 0.12, 6.85], [side * 0.04, 6.67],
    ], maskMaterial, 0.59));
    for (let rib = 0; rib < 5; rib += 1) {
      monster.add(taperedCurve([
        [side * 0.13, 5.82 - rib * 0.34, 0.68],
        [side * 0.65, 5.64 - rib * 0.34, 0.75],
        [side * (0.98 - rib * 0.055), 5.82 - rib * 0.34, 0.37],
      ], 0.13, skin.armor, 14));
    }
  }
  addEyes(monster, skin.eye, 7.42, 0.72, 0.24, [0.82, 0.38, 0.16]);
  for (const side of [-1, 1]) {
    monster.add(taperedCurve([[side * 0.16, 7.25, 0.72], [side * 0.29, 7.0, 0.71], [side * 0.24, 6.84, 0.58]], 0.035, skin.dark));
    monster.add(taperedCurve([[side * 0.07, 7.64, 0.7], [side * 0.27, 7.66, 0.69], [side * 0.45, 7.5, 0.58]], 0.09, maskMaterial));
  }
  monster.add(armorPanel([[-0.09, 7.18], [0, 7.05], [0.09, 7.18], [0.065, 6.89], [-0.065, 6.89]], skin.dark, 0.73, 0.008));

  const chestGlowSurface = new THREE.MeshStandardMaterial({
    color: 0xff6b45,
    emissive: 0xc52c16,
    emissiveIntensity: 3.4,
    roughness: 0.25,
  });
  for (const side of [-1, 1]) {
    const chestLine = part(
      new THREE.CapsuleGeometry(0.11, 1.5, 6, 14),
      chestGlowSurface,
      [side * 0.38, 5.25, 0.72],
      [1, 1, 0.16],
    );
    chestLine.rotation.z = side * 0.55;
    monster.add(chestLine);

    const horn = part(
      new THREE.ConeGeometry(0.15, 1.15, 6),
      skin.armor,
      [side * 0.36, 8.15, 0],
    );
    horn.rotation.z = side * 0.35;
    monster.add(horn);

    const arm = jointedLimb(skin.skin, skin.armor, 3.85, 0.34, true);
    arm.position.set(side * 1.2, 5.85, 0);
    arm.rotation.z = -side * 0.12;
    arm.name = side < 0 ? 'monster-left-arm' : 'monster-right-arm';
    monster.add(arm);

    const shoulderBlade = part(
      new THREE.ConeGeometry(0.28, 1.05, 6),
      skin.armor,
      [side * 1.1, 6.2, -0.1],
    );
    shoulderBlade.rotation.z = side * 1.05;
    monster.add(shoulderBlade);

    const leg = jointedLimb(skin.skin, skin.dark, 3.05, 0.44, true, true);
    leg.position.set(side * 0.48, 3.35, 0);
    leg.name = side < 0 ? 'monster-left-leg' : 'monster-right-leg';
    monster.add(leg);
  }
  return monster;
}

function createGatanothor(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const shell = part(
    new THREE.SphereGeometry(2.7, 34, 24),
    skin.dark,
    [0, 4.1, 0],
    [1.35, 0.95, 1.05],
  );
  const shellCrown = part(
    new THREE.SphereGeometry(2.35, 30, 20, 0, Math.PI * 2, 0, Math.PI * 0.55),
    skin.armor,
    [0, 4.72, -0.15],
    [1.3, 0.75, 1],
  );
  monster.add(shell, shellCrown);

  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2;
    const ridge = part(
      new THREE.ConeGeometry(0.22 + (index % 2) * 0.06, 1.2, 7),
      skin.armor,
      [Math.cos(angle) * 2.5, 6.0 + (index % 3) * 0.2, Math.sin(angle) * 1.65],
    );
    ridge.rotation.z = Math.cos(angle) * 0.55;
    ridge.rotation.x = Math.sin(angle) * 0.45;
    monster.add(ridge);
  }

  const face = part(
    new THREE.SphereGeometry(1.35, 26, 18),
    skin.skin,
    [0, 5.25, 2.18],
    [1.05, 0.75, 0.58],
  );
  const mouth = part(
    new THREE.TorusGeometry(0.62, 0.14, 10, 26, Math.PI),
    skin.dark,
    [0, 4.9, 2.85],
  );
  mouth.rotation.z = Math.PI;
  monster.add(face, mouth);
  addEyes(monster, skin.eye, 5.55, 2.78, 0.52, [1.35, 0.5, 0.16]);

  const mainHorn = part(new THREE.ConeGeometry(0.52, 3.25, 9), skin.armor, [0, 7.3, 0.55]);
  mainHorn.rotation.x = -0.24;
  monster.add(mainHorn);
  for (const side of [-1, 1]) {
    const tusk = part(
      new THREE.ConeGeometry(0.3, 2.15, 8),
      skin.armor,
      [side * 1.15, 4.45, 2.72],
    );
    tusk.rotation.set(Math.PI / 2.4, 0, side * 0.18);
    monster.add(tusk);
  }

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const start = new THREE.Vector3(Math.cos(angle) * 2.35, 2.7, Math.sin(angle) * 1.5);
    const curve = new THREE.CatmullRomCurve3([
      start,
      start.clone().add(new THREE.Vector3(Math.cos(angle) * 0.9, -0.8, Math.sin(angle) * 0.7)),
      start.clone().add(new THREE.Vector3(Math.cos(angle) * 1.8, -1.6, Math.sin(angle) * 1.3)),
      start.clone().add(new THREE.Vector3(Math.cos(angle + 0.35) * 2.7, -2.05, Math.sin(angle + 0.35) * 2.1)),
    ]);
    const tentacle = part(new THREE.TubeGeometry(curve, 22, 0.3, 10, false), skin.dark);
    tentacle.name = `tentacle-${index}`;
    monster.add(tentacle);
  }
  monster.scale.setScalar(1.1);
  return monster;
}

function createDemogea(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();const skin=surfaces(profile);
  monster.add(part(contourGeometry([[0,1],[1.8,1.4],[2.7,3.6],[2.4,6],[1.2,8],[.8,10.5],[0,11.5]],.7),skin.skin));
  for(const side of [-1,1]){
    const wing=new THREE.Shape();wing.moveTo(side*.7,8);wing.lineTo(side*5,12);wing.lineTo(side*9,11);wing.lineTo(side*7,7.5);wing.lineTo(side*8,4);wing.lineTo(side*4,5.7);wing.lineTo(side*1.4,3);wing.closePath();
    monster.add(part(new THREE.ExtrudeGeometry(wing,{depth:.35,bevelEnabled:true,bevelSize:.15,bevelThickness:.15,bevelSegments:2,steps:1}),skin.armor,[0,0,-1.4]));
    monster.add(taperedCurve([[side*.6,10,-.2],[side*1.6,12,-.5],[side*2.5,13.4,-1]],.36,skin.armor));
    for(let i=0;i<5;i++){
      const angle=i*.5+side*.3;
      const tentacle=taperedCurve([[side*1.7,4.5,-.4],[side*(3+i*.4),3.2,-1],[side*(3.8+i*.5),1.3,Math.sin(angle)*3],[side*(4.5+i*.4),.2,Math.cos(angle)*3]],.33-i*.025,skin.dark,26);
      tentacle.name=`tentacle-${side}-${i}`;monster.add(tentacle);
    }
    for(let rib=0;rib<5;rib++)monster.add(taperedCurve([[side*.3,7-rib*.7,1.4],[side*1.6,6.7-rib*.7,1.1],[side*2.3,7-rib*.7,.3]],.14,skin.armor));
  }
  addEyes(monster,skin.eye,9.5,.65,.45,[1,.35,.2]);
  const core=part(new THREE.OctahedronGeometry(.8,1),skin.eye,[0,6.2,1.65],[.7,1.5,.5]);core.name='dark-core';monster.add(core);
  return monster;
}

export function createMonsterVisual(profile: MonsterVisualProfile) {
  const monster =
    profile.id === 'golza'
      ? createGolza(profile)
      : profile.id === 'melba'
          ? createMelba(profile)
          : profile.id === 'kyrieloid'
            ? createKyrieloid(profile)
            : profile.id === 'gatanothor'
              ? createGatanothor(profile)
              : createDemogea(profile);
  monster.name = profile.name;
  if(profile.variant==='enhanced'){
    const magma=new THREE.MeshStandardMaterial({color:0xffa13e,emissive:0xff3b12,emissiveIntensity:1.5});
    for(const side of [-1,1])for(let i=0;i<6;i++){
      monster.add(taperedCurve([[side*(.2+i*.13),3.1+i*.5,.9],[side*(.6+i*.12),3.4+i*.5,1],[side*(.4+i*.12),3.7+i*.5,.9]],.045,magma,10));
    }
    monster.scale.multiplyScalar(1.12);monster.userData.variant='enhanced';
  }
  inkCharacter(monster);
  monster.traverse((object) => {
    if (object instanceof THREE.Mesh) object.frustumCulled = false;
  });
  return monster;
}

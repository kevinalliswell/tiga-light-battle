import * as THREE from 'three';

export interface MonsterVisualProfile {
  id: 'golza' | 'melba' | 'kyrieloid' | 'gatanothor';
  name: string;
  color: number;
  accent: number;
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
    const wave = Math.sin((x + seed) * 0.73) * Math.cos((y - seed) * 0.51);
    const grain = Math.sin((index + seed * 31) * 12.9898) * 0.5;
    const value = Math.round(128 + wave * 52 + grain * 24);
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
  texture.needsUpdate = true;
  return texture;
}

function surfaces(profile: MonsterVisualProfile): MonsterSurfaces {
  const bump = noiseTexture(profile.id.length * 19);
  return {
    skin: new THREE.MeshStandardMaterial({
      color: profile.color,
      roughness: 0.78,
      metalness: 0.05,
      bumpMap: bump,
      bumpScale: 0.09,
    }),
    armor: new THREE.MeshPhysicalMaterial({
      color: profile.accent,
      roughness: 0.48,
      metalness: 0.26,
      clearcoat: 0.16,
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
      emissiveIntensity: 4.8,
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

function claw(surface: THREE.Material, position: [number, number, number], rotationZ: number) {
  const result = part(new THREE.ConeGeometry(0.12, 0.62, 7), surface, position);
  result.rotation.z = rotationZ;
  return result;
}

function jointedLimb(
  surface: THREE.Material,
  jointSurface: THREE.Material,
  length: number,
  radius: number,
  withClaws = false,
) {
  const limb = new THREE.Group();
  const upper = part(
    new THREE.CylinderGeometry(radius * 0.82, radius, length * 0.47, 18, 3),
    surface,
    [0, -length * 0.23, 0],
  );
  const joint = part(
    new THREE.SphereGeometry(radius * 0.88, 18, 12),
    jointSurface,
    [0, -length * 0.5, 0],
    [1, 0.8, 0.9],
  );
  const lower = part(
    new THREE.CylinderGeometry(radius * 0.92, radius * 0.72, length * 0.48, 18, 3),
    surface,
    [0, -length * 0.75, 0],
  );
  limb.add(upper, joint, lower);
  if (withClaws) {
    for (const offset of [-0.16, 0, 0.16]) {
      const talon = part(
        new THREE.ConeGeometry(0.08, 0.52, 6),
        jointSurface,
        [offset, -length - 0.12, 0.14],
      );
      talon.rotation.x = Math.PI * 0.36;
      limb.add(talon);
    }
  }
  return limb;
}

function createGolza(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const torso = part(
    new THREE.SphereGeometry(1.48, 28, 20),
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
    new THREE.SphereGeometry(0.92, 26, 18),
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
  addEyes(monster, skin.eye, 7.48, 1.02, 0.34, [1.1, 0.46, 0.18]);

  const horn = part(new THREE.ConeGeometry(0.33, 1.85, 9), skin.armor, [0, 8.42, 0.12]);
  horn.rotation.x = -0.18;
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
    monster.add(arm);

    const leg = jointedLimb(skin.skin, skin.dark, 3.25, 0.62, true);
    leg.position.set(side * 0.66, 3.3, 0);
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

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 3.35, -1.05),
    new THREE.Vector3(0.25, 2.5, -2.2),
    new THREE.Vector3(0.8, 1.55, -3.5),
    new THREE.Vector3(1.7, 0.75, -4.7),
  ]);
  monster.add(part(new THREE.TubeGeometry(tailCurve, 28, 0.38, 12, false), skin.skin));
  return monster;
}

function createWing(side: number, surface: THREE.Material, boneSurface: THREE.Material) {
  const wing = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(1.35, 0.75);
  shape.lineTo(2.8, 0.2);
  shape.lineTo(2.2, -1.35);
  shape.lineTo(0.65, -1.9);
  shape.closePath();
  const membrane = part(new THREE.ShapeGeometry(shape, 10), surface);
  membrane.scale.x = side;
  membrane.position.z = -0.08;
  wing.add(membrane);
  for (const [x, y, angle] of [
    [0.68, 0.36, -0.95],
    [1.25, -0.44, -0.55],
    [1.7, -1.0, -0.35],
  ] as Array<[number, number, number]>) {
    const bone = part(new THREE.CylinderGeometry(0.07, 0.1, 2.1, 10), boneSurface);
    bone.position.set(side * x, y, 0.03);
    bone.rotation.z = side * angle;
    wing.add(bone);
  }
  return wing;
}

function createMelba(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const wingSurface = new THREE.MeshPhysicalMaterial({
    color: profile.accent,
    roughness: 0.58,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });

  const torso = part(
    new THREE.SphereGeometry(1.05, 26, 18),
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
    new THREE.CylinderGeometry(0.42, 0.66, 1.85, 18),
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
  addEyes(monster, skin.eye, 7.48, 0.72, 0.28, [1, 0.5, 0.2]);

  const beak = part(new THREE.ConeGeometry(0.38, 1.65, 8), skin.armor, [0, 7.22, 1.22]);
  beak.rotation.x = Math.PI / 2;
  monster.add(beak);
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

    const leg = jointedLimb(skin.skin, skin.armor, 3.45, 0.38, true);
    leg.position.set(side * 0.46, 3.45, 0);
    monster.add(leg);
  }
  monster.scale.setScalar(0.93);
  return monster;
}

function createKyrieloid(profile: MonsterVisualProfile) {
  const monster = new THREE.Group();
  const skin = surfaces(profile);
  const torso = part(
    new THREE.SphereGeometry(1.05, 26, 18),
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
    skin.armor,
    [0, 7.18, 0.56],
    [0.72, 1.18, 0.26],
  );
  monster.add(torso, waist, head, facePlate);
  addEyes(monster, skin.eye, 7.42, 0.72, 0.24, [0.82, 0.38, 0.16]);

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
    monster.add(arm);

    const shoulderBlade = part(
      new THREE.ConeGeometry(0.28, 1.05, 6),
      skin.armor,
      [side * 1.1, 6.2, -0.1],
    );
    shoulderBlade.rotation.z = side * 1.05;
    monster.add(shoulderBlade);

    const leg = jointedLimb(skin.skin, skin.dark, 3.45, 0.44, true);
    leg.position.set(side * 0.48, 3.35, 0);
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

export function createMonsterVisual(profile: MonsterVisualProfile) {
  const monster =
    profile.id === 'golza'
      ? createGolza(profile)
      : profile.id === 'melba'
        ? createMelba(profile)
        : profile.id === 'kyrieloid'
          ? createKyrieloid(profile)
          : createGatanothor(profile);
  monster.name = profile.name;
  monster.traverse((object) => {
    if (object instanceof THREE.Mesh) object.frustumCulled = false;
  });
  return monster;
}

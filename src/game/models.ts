import * as THREE from 'three';
import { FORM_STATS, type TigaForm } from './rules';

export { createTiga } from './tigaModel';

export interface MonsterProfile {
  id: 'golza' | 'melba' | 'kyrieloid' | 'gatanothor';
  name: string;
  maxHealth: number;
  speed: number;
  power: number;
  attackRange: number;
  color: number;
  accent: number;
}

export const MONSTER_PROFILES: MonsterProfile[] = [
  {
    id: 'golza',
    name: '哥尔赞',
    maxHealth: 150,
    speed: 1.35,
    power: 15,
    attackRange: 3.5,
    color: 0x514842,
    accent: 0xb24a35,
  },
  {
    id: 'melba',
    name: '美尔巴',
    maxHealth: 110,
    speed: 2.55,
    power: 11,
    attackRange: 4.5,
    color: 0x6c4534,
    accent: 0xd3a145,
  },
  {
    id: 'kyrieloid',
    name: '基里艾洛德人',
    maxHealth: 135,
    speed: 1.85,
    power: 13,
    attackRange: 5,
    color: 0x3d4050,
    accent: 0xa94742,
  },
];

export const GATANOTHOR_PROFILE: MonsterProfile = {
  id: 'gatanothor',
  name: '邪神加坦杰厄',
  maxHealth: 240,
  speed: 0.75,
  power: 24,
  attackRange: 6,
  color: 0x17191c,
  accent: 0x59616a,
};

function material(color: number, metalness = 0.1, roughness = 0.7) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function mesh(
  geometry: THREE.BufferGeometry,
  color: number,
  metalness?: number,
  roughness?: number,
) {
  const result = new THREE.Mesh(geometry, material(color, metalness, roughness));
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function limb(radius: number, length: number, color: number) {
  return mesh(new THREE.CapsuleGeometry(radius, length, 6, 10), color, 0.25, 0.52);
}

export function applyTigaForm(tiga: THREE.Group, form: TigaForm) {
  const stats = FORM_STATS[form];
  tiga.userData.form = form;
  tiga.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const objectMaterial = object.material as THREE.MeshStandardMaterial;
    if (object.name === 'form-color') objectMaterial.color.setHex(stats.color);
    if (object.name === 'form-accent') objectMaterial.color.setHex(stats.accent);
  });
}

function addMonsterEyes(group: THREE.Group, y: number, z: number, spacing: number) {
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc9a8,
    emissive: 0xff3c16,
    emissiveIntensity: 3,
  });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), eyeMaterial);
    eye.position.set(side * spacing, y, z);
    eye.scale.set(1.2, 0.55, 0.4);
    group.add(eye);
  }
}

export function createMonster(profile: MonsterProfile): THREE.Group {
  const monster = new THREE.Group();
  monster.name = profile.name;
  if (profile.id === 'gatanothor') return createGatanothor(monster, profile);
  const body = mesh(new THREE.CapsuleGeometry(1.35, 3.1, 7, 14), profile.color, 0.08, 0.92);
  body.position.y = 4.5;
  body.scale.set(1, 1, 0.75);
  monster.add(body);

  const head = mesh(new THREE.SphereGeometry(1.08, 14, 10), profile.color, 0.08, 0.9);
  head.position.set(0, 7.1, 0);
  head.scale.set(0.88, 1, 0.76);
  monster.add(head);
  addMonsterEyes(monster, 7.25, 0.82, 0.37);

  for (const side of [-1, 1]) {
    const arm = limb(0.42, profile.id === 'kyrieloid' ? 3.5 : 2.8, profile.color);
    arm.position.set(side * 1.5, 4.55, 0);
    arm.rotation.z = side * 0.18;
    monster.add(arm);
    const leg = limb(0.58, 3.1, profile.color);
    leg.position.set(side * 0.65, 1.7, 0);
    monster.add(leg);
  }

  if (profile.id === 'golza') {
    const horn = mesh(new THREE.ConeGeometry(0.38, 1.9, 7), profile.accent);
    horn.position.set(0, 8.4, 0);
    horn.rotation.z = -0.16;
    monster.add(horn);
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.ConeGeometry(0.42, 1.4, 7), profile.accent);
      shoulder.position.set(side * 1.35, 6.1, 0);
      shoulder.rotation.z = side * 1.15;
      monster.add(shoulder);
    }
  }

  if (profile.id === 'melba') {
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(1.35, 4.8, 3), profile.accent, 0.05, 0.85);
      wing.position.set(side * 2.45, 5.3, -0.4);
      wing.rotation.z = side * 0.95;
      wing.scale.z = 0.25;
      monster.add(wing);
    }
    const beak = mesh(new THREE.ConeGeometry(0.5, 1.8, 6), profile.accent);
    beak.position.set(0, 7, 1.2);
    beak.rotation.x = Math.PI / 2;
    monster.add(beak);
  }

  if (profile.id === 'kyrieloid') {
    const face = mesh(new THREE.BoxGeometry(0.55, 1.4, 0.35), profile.accent);
    face.position.set(0, 7, 0.9);
    monster.add(face);
    for (const side of [-1, 1]) {
      const blade = mesh(new THREE.ConeGeometry(0.23, 1.4, 5), profile.accent);
      blade.position.set(side * 1.55, 2.9, 0);
      blade.rotation.z = side * 0.28;
      monster.add(blade);
    }
  }

  monster.scale.setScalar(profile.id === 'melba' ? 0.9 : 1);
  return monster;
}

function createGatanothor(monster: THREE.Group, profile: MonsterProfile): THREE.Group {
  const shell = mesh(new THREE.SphereGeometry(2.8, 20, 14), profile.color, 0.18, 0.88);
  shell.position.set(0, 4.1, 0);
  shell.scale.set(1.35, 0.95, 1);
  monster.add(shell);

  const face = mesh(new THREE.SphereGeometry(1.35, 16, 12), 0x25282c, 0.12, 0.8);
  face.position.set(0, 5.4, 2.1);
  face.scale.set(1.05, 0.75, 0.55);
  monster.add(face);
  addMonsterEyes(monster, 5.65, 2.78, 0.55);

  const mainHorn = mesh(new THREE.ConeGeometry(0.55, 3.3, 7), profile.accent, 0.28, 0.7);
  mainHorn.position.set(0, 7.2, 0.45);
  mainHorn.rotation.x = -0.28;
  monster.add(mainHorn);

  for (const side of [-1, 1]) {
    const tusk = mesh(new THREE.ConeGeometry(0.32, 2.1, 7), 0x777b78, 0.22, 0.72);
    tusk.position.set(side * 1.2, 4.5, 2.7);
    tusk.rotation.set(Math.PI / 2.45, 0, side * 0.18);
    monster.add(tusk);
  }

  for (let index = 0; index < 8; index += 1) {
    const tentacle = mesh(new THREE.CapsuleGeometry(0.34, 3.6, 6, 10), 0x202328, 0.05, 0.94);
    const angle = (index / 8) * Math.PI * 2;
    tentacle.name = `tentacle-${index}`;
    tentacle.position.set(Math.cos(angle) * 2.8, 1.45, Math.sin(angle) * 1.7);
    tentacle.rotation.z = Math.cos(angle) * 0.65;
    tentacle.rotation.x = Math.sin(angle) * 0.5;
    monster.add(tentacle);
  }

  monster.scale.setScalar(1.12);
  return monster;
}

function addWindowGrid(building: THREE.Mesh, width: number, height: number, depth: number) {
  const windows = new THREE.Group();
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x9ac5ce });
  const columns = Math.max(2, Math.floor(width / 1.4));
  const rows = Math.max(2, Math.floor(height / 1.5));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if ((row + column) % 3 === 0) continue;
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), windowMaterial);
      window.position.set(
        -width / 2 + ((column + 0.7) * width) / columns,
        -height / 2 + ((row + 0.7) * height) / rows,
        depth / 2 + 0.012,
      );
      windows.add(window);
    }
  }
  building.add(windows);
}

export function createCity(): THREE.Group {
  const city = new THREE.Group();
  const roadMaterial = material(0x1b2024, 0, 0.96);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 48), roadMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.add(ground);

  const roadLineMaterial = new THREE.MeshBasicMaterial({ color: 0xc9aa5a });
  for (let x = -36; x <= 36; x += 6) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.12), roadLineMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.015, 1.5);
    city.add(line);
  }

  const seeded = (index: number) => Math.abs(Math.sin(index * 91.17));
  let index = 1;
  for (const z of [-12, 11]) {
    for (let x = -39; x <= 39; x += 6.5) {
      if (z > 0 && Math.abs(x) < 20) {
        index += 1;
        continue;
      }
      const width = 3.6 + seeded(index) * 1.5;
      const depth = 3.8 + seeded(index + 2) * 1.7;
      const height = 4.5 + seeded(index + 4) * 8;
      const colors = [0x465056, 0x57595c, 0x414a4c, 0x68635c];
      const building = mesh(
        new THREE.BoxGeometry(width, height, depth),
        colors[index % colors.length],
        0.05,
        0.88,
      );
      building.position.set(x, height / 2, z);
      addWindowGrid(building, width, height, depth);
      city.add(building);
      index += 1;
    }
  }

  return city;
}

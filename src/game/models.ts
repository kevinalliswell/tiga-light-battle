import * as THREE from 'three';
import { createMonsterVisual } from './monsterModels';
import { FORM_STATS, type TigaForm } from './rules';

export { createTiga } from './tigaModel';

export interface MonsterProfile {
  id: 'golza' | 'melba' | 'kyrieloid' | 'gatanothor' | 'demogea';
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

export const DEMOGEA_PROFILE: MonsterProfile = {
  id: 'demogea',
  name: '迪莫杰厄',
  maxHealth: 420,
  speed: 0.58,
  power: 30,
  attackRange: 7,
  color: 0x241625,
  accent: 0xb54e7c,
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

export function createMonster(profile: MonsterProfile): THREE.Group {
  return createMonsterVisual(profile);
}

function addWindowGrid(building: THREE.Mesh, width: number, height: number, depth: number) {
  const windows = new THREE.Group();
  const windowMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0xb9e2e8,
      emissive: 0x75b7c1,
      emissiveIntensity: 1.25,
      roughness: 0.42,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xf2d49d,
      emissive: 0xc28e42,
      emissiveIntensity: 1.15,
      roughness: 0.46,
    }),
    new THREE.MeshStandardMaterial({ color: 0x263137, roughness: 0.7 }),
  ];
  const columns = Math.max(2, Math.floor(width / 1.4));
  const rows = Math.max(2, Math.floor(height / 1.5));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if ((row + column) % 3 === 0) continue;
      const window = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.45),
        windowMaterials[(row * 7 + column * 3) % windowMaterials.length],
      );
      window.position.set(
        -width / 2 + ((column + 0.7) * width) / columns,
        -height / 2 + ((row + 0.7) * height) / rows,
        depth / 2 + 0.012,
      );
      windows.add(window);
    }
  }

  const sideColumns = Math.max(2, Math.floor(depth / 1.5));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < sideColumns; column += 1) {
      if ((row * 2 + column) % 4 === 0) continue;
      const window = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.45),
        windowMaterials[(row * 5 + column * 2 + 1) % windowMaterials.length],
      );
      window.position.set(
        width / 2 + 0.012,
        -height / 2 + ((row + 0.7) * height) / rows,
        -depth / 2 + ((column + 0.7) * depth) / sideColumns,
      );
      window.rotation.y = Math.PI / 2;
      windows.add(window);
    }
  }
  building.add(windows);
}

function asphaltBumpTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const grain = Math.sin(index * 17.31) * Math.cos(index * 0.731);
    const value = Math.round(128 + grain * 54);
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 10);
  texture.needsUpdate = true;
  return texture;
}

export function createCity(): THREE.Group {
  const city = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x171d21,
    roughness: 0.94,
    metalness: 0.02,
    bumpMap: asphaltBumpTexture(),
    bumpScale: 0.035,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 48), roadMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.add(ground);

  const curbMaterial = material(0x697278, 0.05, 0.72);
  for (const z of [-6.8, 6.8]) {
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(90, 0.22, 2.1), curbMaterial);
    sidewalk.position.set(0, 0.08, z);
    sidewalk.receiveShadow = true;
    city.add(sidewalk);
  }

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

      const roofBase = mesh(
        new THREE.BoxGeometry(width * 0.7, 0.28, depth * 0.65),
        0x32393d,
        0.18,
        0.68,
      );
      roofBase.position.set(x, height + 0.14, z);
      city.add(roofBase);

      if (index % 2 === 0) {
        const utility = mesh(
          new THREE.BoxGeometry(width * 0.28, 0.72, depth * 0.3),
          0x4a5256,
          0.24,
          0.58,
        );
        utility.position.set(x + width * 0.16, height + 0.62, z);
        city.add(utility);
      }

      if (index % 3 === 0) {
        const antenna = mesh(new THREE.CylinderGeometry(0.035, 0.05, 2.5, 8), 0x8a969a, 0.5, 0.4);
        antenna.position.set(x - width * 0.18, height + 1.35, z);
        city.add(antenna);
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 10, 8),
          new THREE.MeshStandardMaterial({
            color: 0xff795f,
            emissive: 0xff2f18,
            emissiveIntensity: 3,
          }),
        );
        beacon.position.set(x - width * 0.18, height + 2.62, z);
        city.add(beacon);
      }
      index += 1;
    }
  }

  for (let x = -30; x <= 30; x += 10) {
    for (const z of [-5.6, 5.6]) {
      const post = mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.1, 10), 0x343b3f, 0.35, 0.5);
      post.position.set(x, 1.05, z);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 9),
        new THREE.MeshStandardMaterial({
          color: 0xffe4a8,
          emissive: 0xffc55a,
          emissiveIntensity: 2.2,
        }),
      );
      lamp.position.set(x, 2.08, z);
      city.add(post, lamp);
    }
  }

  return city;
}

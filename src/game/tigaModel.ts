import * as THREE from 'three';
import { FORM_STATS } from './rules';

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

function formPart(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  name: 'form-color' | 'form-accent',
) {
  const result = part(geometry, surface);
  result.name = name;
  return result;
}

function fabricBumpTexture() {
  const size = 96;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const x = index % size;
    const y = Math.floor(index / size);
    const warp = Math.sin(x * 0.68) * Math.cos(y * 0.54);
    const weave = (x % 6 === 0 ? 18 : 0) + (y % 6 === 0 ? 14 : 0);
    const value = Math.max(74, Math.min(190, Math.round(128 + warp * 16 + weave)));
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.needsUpdate = true;
  return texture;
}

interface TigaSurfaces {
  silver: THREE.MeshPhysicalMaterial;
  darkSilver: THREE.MeshPhysicalMaterial;
  red: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
}

function createArm(side: number, surfaces: TigaSurfaces) {
  const arm = new THREE.Group();
  arm.name = side < 0 ? 'left-arm' : 'right-arm';
  arm.position.set(side * 1.32, 5.88, 0);
  arm.rotation.z = -side * 0.1;

  const shoulder = part(new THREE.SphereGeometry(0.5, 30, 22), surfaces.silver);
  shoulder.scale.set(1.16, 0.94, 0.92);
  arm.add(shoulder);

  const shoulderMark = formPart(
    new THREE.SphereGeometry(0.5, 24, 16),
    surfaces.red,
    'form-color',
  );
  shoulderMark.position.set(0, -0.14, 0.04);
  shoulderMark.scale.set(0.86, 0.58, 0.8);
  arm.add(shoulderMark);

  const upperArm = part(
    new THREE.CapsuleGeometry(0.38, 0.72, 7, 20),
    surfaces.silver,
    [0, -0.78, 0],
    [1, 1, 0.9],
  );
  upperArm.name = side < 0 ? 'left-upper-arm' : 'right-upper-arm';
  arm.add(upperArm);

  const upperStripe = formPart(
    new THREE.CapsuleGeometry(0.1, 0.76, 6, 16),
    surfaces.accent,
    'form-accent',
  );
  upperStripe.position.set(-side * 0.18, -0.82, 0.3);
  upperStripe.scale.z = 0.18;
  arm.add(upperStripe);

  const elbow = part(
    new THREE.SphereGeometry(0.34, 22, 16),
    surfaces.silver,
    [0, -1.46, 0],
    [1, 0.84, 0.9],
  );
  arm.add(elbow);

  const forearm = part(
    new THREE.CapsuleGeometry(0.37, 0.72, 7, 20),
    surfaces.silver,
    [0, -2.06, 0],
    [1, 1, 0.92],
  );
  forearm.name = side < 0 ? 'left-forearm' : 'right-forearm';
  arm.add(forearm);

  const cuff = formPart(
    new THREE.CylinderGeometry(0.39, 0.36, 0.54, 22),
    surfaces.red,
    'form-color',
  );
  cuff.position.y = -2.4;
  arm.add(cuff);

  const hand = part(
    new THREE.SphereGeometry(0.36, 22, 16),
    surfaces.silver,
    [0, -2.86, 0.04],
    [0.88, 1.16, 0.78],
  );
  hand.name = side < 0 ? 'left-hand' : 'right-hand';
  arm.add(hand);

  const thumb = part(
    new THREE.SphereGeometry(0.16, 16, 12),
    surfaces.silver,
    [side * 0.2, -2.78, 0.22],
    [0.8, 1, 0.75],
  );
  thumb.name = side < 0 ? 'left-thumb' : 'right-thumb';
  arm.add(thumb);
  return arm;
}

function createLeg(side: number, surfaces: TigaSurfaces) {
  const leg = new THREE.Group();
  leg.name = side < 0 ? 'left-leg' : 'right-leg';
  leg.position.set(side * 0.62, 3.35, 0);

  const thigh = part(
    new THREE.CapsuleGeometry(0.5, 0.88, 7, 20),
    surfaces.silver,
    [0, -0.82, 0],
    [1, 1, 0.9],
  );
  thigh.name = side < 0 ? 'left-thigh' : 'right-thigh';
  leg.add(thigh);

  const thighStripe = formPart(
    new THREE.CapsuleGeometry(0.11, 1.08, 6, 16),
    surfaces.accent,
    'form-accent',
  );
  thighStripe.position.set(side * 0.21, -0.8, 0.39);
  thighStripe.rotation.z = side * 0.12;
  thighStripe.scale.z = 0.18;
  leg.add(thighStripe);

  const knee = part(
    new THREE.SphereGeometry(0.43, 22, 16),
    surfaces.silver,
    [0, -1.61, 0],
    [0.9, 0.78, 0.84],
  );
  leg.add(knee);

  const shin = part(
    new THREE.CapsuleGeometry(0.43, 0.9, 7, 20),
    surfaces.silver,
    [0, -2.36, 0],
    [1, 1, 0.88],
  );
  shin.name = side < 0 ? 'left-shin' : 'right-shin';
  leg.add(shin);

  const bootCuff = formPart(
    new THREE.CylinderGeometry(0.46, 0.41, 0.72, 24),
    surfaces.red,
    'form-color',
  );
  bootCuff.position.y = -2.82;
  leg.add(bootCuff);

  const foot = formPart(new THREE.SphereGeometry(0.54, 24, 17), surfaces.red, 'form-color');
  foot.name = side < 0 ? 'left-foot' : 'right-foot';
  foot.position.set(0, -3.3, 0.3);
  foot.scale.set(0.82, 0.56, 1.32);
  leg.add(foot);
  return leg;
}

export function createTiga(): THREE.Group {
  const tiga = new THREE.Group();
  tiga.name = 'tiga';
  const fabric = fabricBumpTexture();

  const surfaces: TigaSurfaces = {
    silver: new THREE.MeshPhysicalMaterial({
      color: 0xa4b0b5,
      metalness: 0.01,
      roughness: 0.56,
      clearcoat: 0.12,
      clearcoatRoughness: 0.48,
      bumpMap: fabric,
      bumpScale: 0.016,
      sheen: 0.24,
      sheenColor: 0x64747c,
      sheenRoughness: 0.78,
    }),
    darkSilver: new THREE.MeshPhysicalMaterial({
      color: 0x68777d,
      metalness: 0.01,
      roughness: 0.64,
      clearcoat: 0.09,
      clearcoatRoughness: 0.54,
      bumpMap: fabric,
      bumpScale: 0.018,
      sheen: 0.18,
      sheenColor: 0x46545b,
      sheenRoughness: 0.82,
    }),
    red: new THREE.MeshPhysicalMaterial({
      color: FORM_STATS.multi.color,
      metalness: 0.01,
      roughness: 0.62,
      clearcoat: 0.05,
      clearcoatRoughness: 0.56,
      bumpMap: fabric,
      bumpScale: 0.02,
      sheen: 0.16,
      sheenColor: 0x5b1c27,
      sheenRoughness: 0.8,
    }),
    accent: new THREE.MeshPhysicalMaterial({
      color: FORM_STATS.multi.accent,
      metalness: 0.01,
      roughness: 0.64,
      clearcoat: 0.05,
      clearcoatRoughness: 0.58,
      bumpMap: fabric,
      bumpScale: 0.02,
      sheen: 0.18,
      sheenColor: 0x3e345c,
      sheenRoughness: 0.82,
    }),
  };

  const torso = part(
    new THREE.CapsuleGeometry(0.96, 2.15, 10, 28),
    surfaces.silver,
    [0, 4.72, 0],
    [1.18, 1, 0.76],
  );
  const neck = part(
    new THREE.CylinderGeometry(0.42, 0.5, 0.55, 22),
    surfaces.darkSilver,
    [0, 6.62, 0],
    [1, 1, 0.82],
  );
  const chestPlate = part(
    new THREE.SphereGeometry(1.24, 36, 26),
    surfaces.silver,
    [0, 5.48, 0.6],
    [0.98, 0.74, 0.18],
  );
  const pelvis = part(
    new THREE.SphereGeometry(1, 32, 22),
    surfaces.silver,
    [0, 3.72, 0],
    [1, 0.5, 0.74],
  );
  const waistBand = part(
    new THREE.TorusGeometry(0.84, 0.1, 14, 36),
    surfaces.accent,
    [0, 3.9, 0],
  );
  waistBand.rotation.x = Math.PI / 2;
  tiga.add(torso, chestPlate, pelvis, waistBand, neck);

  for (const side of [-1, 1]) {
    const chestStripe = formPart(
      new THREE.CapsuleGeometry(0.12, 1.42, 8, 18),
      surfaces.red,
      'form-color',
    );
    chestStripe.position.set(side * 0.48, 5.61, 0.77);
    chestStripe.rotation.z = side * 0.72;
    chestStripe.scale.z = 0.2;
    tiga.add(chestStripe);

    const waistStripe = formPart(
      new THREE.CapsuleGeometry(0.105, 1.34, 8, 18),
      surfaces.accent,
      'form-accent',
    );
    waistStripe.position.set(side * 0.37, 4.24, 0.6);
    waistStripe.rotation.z = side * 0.27;
    waistStripe.scale.z = 0.18;
    tiga.add(waistStripe);
  }

  const collar = part(
    new THREE.TorusGeometry(0.78, 0.1, 10, 32, Math.PI),
    surfaces.darkSilver,
    [0, 6.25, 0.53],
  );
  collar.rotation.set(Math.PI / 2, 0, Math.PI);
  tiga.add(collar);

  const head = part(
    new THREE.CapsuleGeometry(0.66, 0.5, 8, 26),
    surfaces.silver,
    [0, 7.42, 0],
    [0.94, 1.06, 0.92],
  );
  const jaw = part(
    new THREE.SphereGeometry(0.62, 30, 22),
    surfaces.silver,
    [0, 7.06, 0.14],
    [0.92, 0.64, 0.88],
  );
  const crown = part(
    new THREE.ConeGeometry(0.22, 0.9, 6),
    surfaces.silver,
    [0, 8.22, 0.02],
    [0.88, 1, 0.76],
  );
  tiga.add(head, jaw, crown);

  const foreheadGem = formPart(
    new THREE.SphereGeometry(0.12, 14, 10),
    surfaces.accent,
    'form-accent',
  );
  foreheadGem.position.set(0, 7.94, 0.7);
  foreheadGem.scale.set(0.7, 1.25, 0.3);
  tiga.add(foreheadGem);

  const eyeSurface = new THREE.MeshPhysicalMaterial({
    color: 0xf2fdff,
    emissive: 0xbcefff,
    emissiveIntensity: 3.8,
    roughness: 0.08,
    clearcoat: 0.5,
    clearcoatRoughness: 0.12,
  });
  for (const side of [-1, 1]) {
    const templeFin = part(
      new THREE.ConeGeometry(0.12, 0.72, 4),
      surfaces.silver,
      [side * 0.55, 7.8, -0.02],
    );
    templeFin.rotation.z = side * 0.44;
    tiga.add(templeFin);

    const eyeSocket = part(
      new THREE.SphereGeometry(0.25, 20, 14),
      surfaces.darkSilver,
      [side * 0.29, 7.55, 0.65],
      [1.32, 0.55, 0.2],
    );
    eyeSocket.rotation.z = -side * 0.12;
    const eye = part(
      new THREE.CapsuleGeometry(0.17, 0.18, 5, 14),
      eyeSurface,
      [side * 0.29, 7.57, 0.695],
      [1.4, 0.62, 0.16],
    );
    eye.rotation.z = -side * 0.12;
    tiga.add(eyeSocket, eye);

    const ear = part(
      new THREE.CylinderGeometry(0.19, 0.19, 0.09, 18),
      surfaces.darkSilver,
      [side * 0.68, 7.42, 0],
    );
    ear.rotation.z = Math.PI / 2;
    tiga.add(ear);
  }

  const mouth = part(
    new THREE.BoxGeometry(0.34, 0.035, 0.035),
    surfaces.darkSilver,
    [0, 6.98, 0.61],
  );
  tiga.add(mouth);

  const timerSurface = new THREE.MeshPhysicalMaterial({
    color: 0x8ff5ff,
    emissive: 0x2bbfd6,
    emissiveIntensity: 4.2,
    metalness: 0.12,
    roughness: 0.08,
    clearcoat: 0.5,
  });
  const timerFrame = part(
    new THREE.TorusGeometry(0.21, 0.055, 10, 26),
    surfaces.darkSilver,
    [0, 5.95, 0.82],
  );
  const timer = part(
    new THREE.SphereGeometry(0.18, 20, 14),
    timerSurface,
    [0, 5.95, 0.84],
    [1, 1, 0.24],
  );
  timer.name = 'color-timer';
  tiga.add(timerFrame, timer);

  for (const side of [-1, 1]) tiga.add(createArm(side, surfaces), createLeg(side, surfaces));

  tiga.scale.setScalar(0.98);
  tiga.userData.form = 'multi';
  tiga.traverse((object) => {
    if (object instanceof THREE.Mesh) object.frustumCulled = false;
  });
  return tiga;
}

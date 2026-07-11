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

interface TigaSurfaces {
  silver: THREE.MeshPhysicalMaterial;
  darkSilver: THREE.MeshStandardMaterial;
  red: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
}

function createArm(side: number, surfaces: TigaSurfaces) {
  const arm = new THREE.Group();
  arm.name = side < 0 ? 'left-arm' : 'right-arm';
  arm.position.set(side * 1.13, 5.9, 0);
  arm.rotation.z = -side * 0.1;

  const shoulder = part(new THREE.SphereGeometry(0.45, 24, 16), surfaces.silver);
  shoulder.scale.set(1.05, 0.9, 0.86);
  arm.add(shoulder);

  const shoulderMark = formPart(
    new THREE.SphereGeometry(0.47, 22, 14),
    surfaces.red,
    'form-color',
  );
  shoulderMark.position.set(0, -0.14, 0.04);
  shoulderMark.scale.set(0.86, 0.58, 0.8);
  arm.add(shoulderMark);

  const upperArm = part(
    new THREE.CylinderGeometry(0.31, 0.36, 1.25, 20, 4),
    surfaces.silver,
    [0, -0.78, 0],
    [1, 1, 0.9],
  );
  arm.add(upperArm);

  const upperStripe = formPart(
    new THREE.CapsuleGeometry(0.09, 0.7, 6, 14),
    surfaces.accent,
    'form-accent',
  );
  upperStripe.position.set(-side * 0.18, -0.82, 0.3);
  upperStripe.scale.z = 0.18;
  arm.add(upperStripe);

  const elbow = part(
    new THREE.SphereGeometry(0.31, 20, 14),
    surfaces.darkSilver,
    [0, -1.46, 0],
    [1, 0.84, 0.9],
  );
  arm.add(elbow);

  const forearm = part(
    new THREE.CylinderGeometry(0.34, 0.27, 1.25, 20, 4),
    surfaces.silver,
    [0, -2.06, 0],
    [1, 1, 0.92],
  );
  arm.add(forearm);

  const cuff = formPart(
    new THREE.CylinderGeometry(0.355, 0.33, 0.52, 20),
    surfaces.red,
    'form-color',
  );
  cuff.position.y = -2.4;
  arm.add(cuff);

  const hand = part(
    new THREE.SphereGeometry(0.31, 20, 14),
    surfaces.silver,
    [0, -2.82, 0.04],
    [0.82, 1.12, 0.72],
  );
  arm.add(hand);
  return arm;
}

function createLeg(side: number, surfaces: TigaSurfaces) {
  const leg = new THREE.Group();
  leg.name = side < 0 ? 'left-leg' : 'right-leg';
  leg.position.set(side * 0.48, 3.35, 0);

  const thigh = part(
    new THREE.CylinderGeometry(0.42, 0.47, 1.46, 22, 4),
    surfaces.silver,
    [0, -0.82, 0],
    [1, 1, 0.9],
  );
  leg.add(thigh);

  const thighStripe = formPart(
    new THREE.CapsuleGeometry(0.1, 1.02, 6, 14),
    surfaces.accent,
    'form-accent',
  );
  thighStripe.position.set(side * 0.21, -0.8, 0.39);
  thighStripe.rotation.z = side * 0.12;
  thighStripe.scale.z = 0.18;
  leg.add(thighStripe);

  const knee = part(
    new THREE.SphereGeometry(0.4, 20, 14),
    surfaces.darkSilver,
    [0, -1.61, 0],
    [0.9, 0.78, 0.84],
  );
  leg.add(knee);

  const shin = part(
    new THREE.CylinderGeometry(0.36, 0.4, 1.46, 22, 4),
    surfaces.silver,
    [0, -2.36, 0],
    [1, 1, 0.88],
  );
  leg.add(shin);

  const bootCuff = formPart(
    new THREE.CylinderGeometry(0.42, 0.38, 0.7, 22),
    surfaces.red,
    'form-color',
  );
  bootCuff.position.y = -2.82;
  leg.add(bootCuff);

  const foot = formPart(new THREE.SphereGeometry(0.48, 22, 15), surfaces.red, 'form-color');
  foot.position.set(0, -3.24, 0.27);
  foot.scale.set(0.78, 0.54, 1.25);
  leg.add(foot);
  return leg;
}

export function createTiga(): THREE.Group {
  const tiga = new THREE.Group();
  tiga.name = 'tiga';

  const surfaces: TigaSurfaces = {
    silver: new THREE.MeshPhysicalMaterial({
      color: 0xbfc7cb,
      metalness: 0.72,
      roughness: 0.23,
      clearcoat: 0.4,
      clearcoatRoughness: 0.2,
    }),
    darkSilver: new THREE.MeshStandardMaterial({
      color: 0x606a70,
      metalness: 0.64,
      roughness: 0.31,
    }),
    red: new THREE.MeshPhysicalMaterial({
      color: FORM_STATS.multi.color,
      metalness: 0.16,
      roughness: 0.42,
      clearcoat: 0.18,
    }),
    accent: new THREE.MeshPhysicalMaterial({
      color: FORM_STATS.multi.accent,
      metalness: 0.14,
      roughness: 0.44,
      clearcoat: 0.16,
    }),
  };

  const pelvis = part(
    new THREE.SphereGeometry(0.9, 26, 18),
    surfaces.silver,
    [0, 3.42, 0],
    [1, 0.62, 0.72],
  );
  const abdomen = part(
    new THREE.CylinderGeometry(0.92, 0.7, 1.55, 26, 5),
    surfaces.silver,
    [0, 4.25, 0],
    [1, 1, 0.72],
  );
  const chest = part(
    new THREE.SphereGeometry(1.2, 30, 22),
    surfaces.silver,
    [0, 5.45, 0],
    [1.08, 0.95, 0.67],
  );
  const neck = part(
    new THREE.CylinderGeometry(0.42, 0.5, 0.55, 22),
    surfaces.darkSilver,
    [0, 6.62, 0],
    [1, 1, 0.82],
  );
  tiga.add(pelvis, abdomen, chest, neck);

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
    new THREE.SphereGeometry(0.78, 32, 24),
    surfaces.silver,
    [0, 7.42, 0],
    [0.82, 1.08, 0.82],
  );
  const jaw = part(
    new THREE.SphereGeometry(0.58, 26, 18),
    surfaces.silver,
    [0, 7.08, 0.12],
    [0.88, 0.62, 0.86],
  );
  const crown = part(
    new THREE.ConeGeometry(0.22, 1.16, 5),
    surfaces.silver,
    [0, 8.36, 0.02],
    [1, 1, 0.82],
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

  const eyeSurface = new THREE.MeshStandardMaterial({
    color: 0xf2fdff,
    emissive: 0xbcefff,
    emissiveIntensity: 5.2,
    roughness: 0.1,
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
      new THREE.SphereGeometry(0.2, 20, 14),
      eyeSurface,
      [side * 0.29, 7.57, 0.695],
      [1.25, 0.46, 0.16],
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

  const timerSurface = new THREE.MeshStandardMaterial({
    color: 0x8ff5ff,
    emissive: 0x2bbfd6,
    emissiveIntensity: 5.4,
    metalness: 0.1,
    roughness: 0.1,
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

  tiga.scale.setScalar(0.94);
  tiga.userData.form = 'multi';
  tiga.traverse((object) => {
    if (object instanceof THREE.Mesh) object.frustumCulled = false;
  });
  return tiga;
}

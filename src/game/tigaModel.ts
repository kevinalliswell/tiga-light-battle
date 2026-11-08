import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { FORM_STATS } from './rules';
import { armorPanel, contourGeometry, sculptMesh as part, taperedCurve } from './sculpting';
import { inkCharacter } from './anime';

interface UltraSurfaces {
  silver: THREE.MeshPhysicalMaterial;
  joint: THREE.MeshPhysicalMaterial;
  color: THREE.MeshPhysicalMaterial;
  accent: THREE.MeshPhysicalMaterial;
  trim: THREE.MeshPhysicalMaterial;
  eye: THREE.MeshStandardMaterial;
}

function suitTexture() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = 128 + Math.sin(x * Math.PI / 2) * Math.cos(y * Math.PI / 2) * 12;
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 8);
  texture.needsUpdate = true;
  return texture;
}

function createSurfaces(belial: boolean): UltraSurfaces {
  const texture = suitTexture();
  const suit = (color: number, metalness: number, roughness: number) => new THREE.MeshPhysicalMaterial({
    color, metalness, roughness, clearcoat: 0.28, clearcoatRoughness: 0.36,
    bumpMap: texture, bumpScale: 0.006,
  });
  return {
    silver: suit(belial ? 0x20222b : 0xd5e0eb, belial ? 0.38 : 0.65, 0.32),
    joint: suit(belial ? 0x0c1019 : 0x626777, 0.22, 0.62),
    color: suit(belial ? 0xb70d28 : FORM_STATS.multi.color, 0.26, 0.4),
    accent: suit(belial ? 0xe82a3d : FORM_STATS.multi.accent, 0.32, 0.38),
    trim: suit(belial ? 0x4a2530 : 0xc5a86c, 0.74, 0.3),
    eye: new THREE.MeshStandardMaterial({
      color: belial ? 0xffb24d : 0xffffe5, emissive: belial ? 0xff5a0b : 0xc4efff,
      emissiveIntensity: 2.4, roughness: 0.22, toneMapped: false,
    }),
  };
}

function marking(mesh: THREE.Mesh, accent = false) {
  mesh.name = accent ? 'form-accent' : 'form-color';
  return mesh;
}

function createArm(side: number, m: UltraSurfaces, belial: boolean) {
  const arm = new THREE.Group();
  arm.name = side < 0 ? 'left-arm' : 'right-arm';
  arm.position.set(side * 1.13, 6.13, 0);
  arm.rotation.z = -side * 0.12;
  arm.add(part(contourGeometry([
    [0, 0.24], [0.3, 0.18], [0.43, -0.12], [0.36, -0.55], [0.29, -1.04], [0.24, -1.27], [0, -1.4],
  ], 0.88), m.silver));
  arm.add(marking(part(contourGeometry([[0,.2],[.3,.16],[.41,-.1],[.36,-.42],[0,-.46]],.88), m.accent), true));
  const elbow = new THREE.Group();
  elbow.name = side < 0 ? 'left-elbow' : 'right-elbow';
  elbow.position.y = -1.31;
  elbow.rotation.x = -0.14;
  elbow.add(part(new THREE.SphereGeometry(0.25, 20, 12), m.silver, [0, 0, 0], [1, 0.82, 0.9]));
  elbow.add(part(contourGeometry([
    [0, 0.1], [0.24, 0.02], [0.34, -0.36], [0.31, -0.65], [0.21, -1.18], [0, -1.28],
  ], 0.9), m.silver));
  elbow.add(marking(armorPanel([
    [-0.21, -0.26], [0.21, -0.26], [0.17, -1.07], [0, -1.2], [-0.17, -1.07],
  ], m.color, 0.257)));
  const hand = part(new THREE.SphereGeometry(0.29, 24, 16), m.silver,
    [0, -1.43, 0.035], [0.82, 1.12, 0.75]);
  hand.name = side < 0 ? 'left-hand' : 'right-hand';
  elbow.add(hand);
  for (let finger = 0; finger < 3; finger += 1) {
    const x = (finger - 1) * 0.12;
    if (belial) elbow.add(taperedCurve([[x, -1.48, 0.15], [x * 1.3, -1.8, 0.27], [x * 1.4, -2.02, 0.49]], 0.075, m.silver, 12));
    else elbow.add(part(new THREE.CapsuleGeometry(0.068, 0.21, 3, 10), m.silver, [x, -1.62, 0.09], [1, 1, 0.85]));
  }
  elbow.add(part(new THREE.CapsuleGeometry(0.095, 0.17, 4, 12), m.silver, [-side * 0.24, -1.39, 0.08], [1, 1, 0.9]));
  arm.add(elbow);
  return arm;
}

function createLeg(side: number, m: UltraSurfaces) {
  const leg = new THREE.Group();
  leg.name = side < 0 ? 'left-leg' : 'right-leg';
  leg.position.set(side * 0.53, 3.73, 0);
  leg.add(part(contourGeometry([
    [0, 0.25], [0.39, 0.14], [0.48, -0.35], [0.43, -0.8], [0.31, -1.44], [0.27, -1.63], [0, -1.72],
  ], 0.91), m.silver));
  leg.add(marking(armorPanel([
    [side * 0.18, -0.1], [side * 0.37, -0.26], [side * 0.22, -1.35], [side * 0.1, -1.51],
  ], m.accent, 0.34), true));
  const knee = new THREE.Group();
  knee.name = side < 0 ? 'left-knee' : 'right-knee';
  knee.position.y = -1.66;
  knee.add(part(new THREE.SphereGeometry(0.27, 20, 14), m.silver, [0, 0, 0], [1, 0.85, 0.85]));
  knee.add(part(new THREE.SphereGeometry(0.29, 20, 14), m.silver, [0, 0.04, 0.17], [0.87, 1.05, 0.48]));
  knee.add(part(contourGeometry([
    [0, 0.05], [0.25, -0.08], [0.36, -0.46], [0.31, -0.89], [0.22, -1.49], [0, -1.62],
  ], 0.91), m.silver));
  knee.add(marking(part(contourGeometry([
    [0, -0.55], [0.32, -0.58], [0.29, -0.94], [0.23, -1.51], [0, -1.63],
  ], 0.93), m.color)));
  knee.add(marking(part(new THREE.SphereGeometry(0.42, 24, 16), m.color, [0, -1.79, 0.21], [0.73, 0.57, 1.47])));
  knee.add(part(new THREE.SphereGeometry(0.4, 20, 12), m.joint, [0, -1.93, 0.24], [0.79, 0.14, 1.48]));
  leg.add(knee);
  return leg;
}

function eyeShape(side: number, belial: boolean) {
  const shape = new THREE.Shape();
  shape.moveTo(side * 0.075, 0.01);
  shape.bezierCurveTo(side * 0.18, 0.17, side * 0.45, 0.23, side * 0.54, 0.16);
  shape.bezierCurveTo(side * 0.5, belial ? -0.17 : -0.1, side * 0.22, -0.16, side * 0.075, 0.01);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.025, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.025, bevelSegments: 3, steps: 1,
  });
}

function createHelmet(m: UltraSurfaces, belial: boolean) {
  const head = new THREE.Group();
  head.name = 'helmet';
  head.position.set(0, 7.3, 0);
  head.add(part(contourGeometry([
    [0, -0.65], [0.24, -0.59], [0.44, -0.33], [0.57, 0.06], [0.58, 0.43], [0.42, 0.77], [0, 0.9],
  ], 0.83), m.silver));
  const crest = armorPanel([
    [-0.045, -0.04], [-0.09, 0.66], [0, belial ? 1.38 : 1.16], [0.09, 0.66], [0.045, -0.04],
  ], m.silver, 0.47, 0.04);
  crest.scale.z = 3.2;
  crest.position.z = 0.22;
  head.add(crest);
  for (const side of [-1, 1]) {
    const socket = part(eyeShape(side, belial), m.joint, [0, 0.2, 0.49], [1.12, 1.14, 1]);
    const eye = part(eyeShape(side, belial), m.eye, [0, 0.2, 0.54]);
    eye.name = side < 0 ? 'left-eye' : 'right-eye';
    socket.rotation.y = eye.rotation.y = side * 0.24;
    head.add(socket, eye);
    const ear = part(new THREE.CylinderGeometry(0.15, 0.17, 0.11, 20), m.trim, [side * 0.56, 0.06, -0.01], [1, 1, 0.8]);
    ear.rotation.z = Math.PI / 2;
    head.add(ear);
    if (belial) head.add(taperedCurve([[side * 0.43, 0.48, 0], [side * 0.63, 0.92, -0.18], [side * 0.47, 1.33, -0.4]], 0.14, m.silver));
  }
  head.add(armorPanel([[-0.05, 0.25], [0.05, 0.25], [0.085, -0.2], [0, -0.27], [-0.085, -0.2]], m.silver, 0.61, 0.012));
  head.add(part(new THREE.BoxGeometry(0.28, 0.026, 0.025), m.joint, [0, -0.4, 0.5]));
  if (!belial) head.add(part(new THREE.OctahedronGeometry(0.095), m.accent, [0, 0.61, 0.59], [0.7, 1.4, 0.35]));
  return head;
}

function createUltra(belial: boolean) {
  const ultra = new THREE.Group();
  ultra.name = belial ? 'belial' : 'tiga';
  const m = createSurfaces(belial);
  const torsoProfile:Array<[number,number]> = [
    [0, 3.35], [0.64, 3.48], [0.8, 3.8], [0.71, 4.3], [0.8, 4.85],
    [1.12, 5.65], [1.13, 5.97], [0.81, 6.34], [0.43, 6.5], [0, 6.52],
  ];
  const torso = part(contourGeometry(torsoProfile, 0.62), m.silver);
  torso.name = 'torso';
  ultra.add(torso);
  ultra.add(part(new THREE.CylinderGeometry(0.32, 0.4, 0.56, 24), m.joint, [0, 6.65, 0], [1, 1, 0.83]));
  for (const side of [-1, 1]) {
    ultra.add(marking(armorPanel([
      [side * 0.08, 5.61], [side * 0.97, 6.12], [side * 1.03, 5.84], [side * 0.61, 5.47], [side * 0.1, 5.17],
    ], m.color, 0.59)));
    ultra.add(marking(armorPanel([
      [side * 0.14, 5.14], [side * 0.72, 5.48], [side * 0.65, 4.82], [side * 0.4, 4.3],
      [side * 0.32, 3.63], [side * 0.04, 3.49], [side * 0.13, 4.5],
    ], m.accent, 0.45), true));
    ultra.add(armorPanel([
      [side * 0.06, 5.79], [side * 0.95, 6.31], [side * 1.02, 6.16], [side * 0.12, 5.59],
    ], m.trim, 0.65));
    ultra.add(armorPanel([
      [side * 0.13, 5.8], [side * 0.9, 6.25], [side * 0.9, 6.15], [side * 0.13, 5.67],
    ], m.silver, 0.69, 0.012));
    const back = marking(armorPanel([
      [side * 0.08, 5.7], [side * 0.89, 6.16], [side * 0.73, 5.48], [side * 0.13, 4.12],
    ], m.accent, 0), true);
    back.rotation.y = Math.PI;
    back.position.z = -0.56;
    ultra.add(back, createArm(side, m, belial), createLeg(side, m));
    if (belial) ultra.add(taperedCurve([[side * 1.02, 6.07, -0.1], [side * 1.62, 6.42, -0.27], [side * 1.81, 6.78, -0.56]], 0.3, m.silver));
  }
  const timerMaterial = new THREE.MeshPhysicalMaterial({
    color: belial ? 0xe72d36 : 0x8ff5ff, emissive: belial ? 0xd30a25 : 0x2bbfd6,
    emissiveIntensity: 2.5, metalness: 0.22, roughness: 0.13, clearcoat: 1,
  });
  const frame = part(new THREE.TorusGeometry(0.19, 0.045, 10, 32), m.trim, [0, 5.87, 0.76], [0.87, 1.15, 1]);
  const timer = part(new THREE.SphereGeometry(0.16, 24, 16), timerMaterial, [0, 5.87, 0.79], [0.9, 1.18, 0.47]);
  timer.name = 'color-timer';
  ultra.add(frame, timer, createHelmet(m, belial));
  // Project suit markings onto the same surface as the torso to prevent clipping.
  const sections = new THREE.SplineCurve(torsoProfile.map(([r,y])=>new THREE.Vector2(r,y))).getPoints(160);
  const suitDetail = new TessellateModifier(.16,6);
  for (const child of ultra.children) {
    if (!(child instanceof THREE.Mesh) || !(child.geometry instanceof THREE.ExtrudeGeometry)) continue;
    const flatGeometry = child.geometry;
    child.geometry = suitDetail.modify(flatGeometry);
    flatGeometry.dispose();
    const positions = child.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      const y=positions.getY(index),x=positions.getX(index);
      const next=Math.max(1,sections.findIndex(section=>section.y>=y));
      const low=sections[next-1],high=sections[next];
      const radius=THREE.MathUtils.lerp(low.x,high.x,THREE.MathUtils.clamp((y-low.y)/(high.y-low.y||1),0,1));
      const surface=Math.sqrt(Math.max(0,radius*radius-x*x))*.62;
      const layer = child.material === m.silver ? .065 : child.material === m.trim ? .045 : .025;
      positions.setZ(index, surface+positions.getZ(index)+layer);
    }
    child.position.z=0;
    child.geometry.computeVertexNormals();
  }
  if (belial) {
    const staff = new THREE.Group();
    staff.name = 'giga-battlenizer';
    staff.position.set(1.55, 4.4, 0.25);
    staff.rotation.z = -0.12;
    staff.add(part(new THREE.CylinderGeometry(0.085, 0.11, 8.2, 16), m.joint));
    for (const end of [-1, 1]) {
      staff.add(part(new THREE.BoxGeometry(0.5, 1.45, 0.38), m.silver, [0, end * 3.65, 0]));
      for (let row = 0; row < 4; row += 1) {
        for (const side of [-1, 1]) staff.add(part(new THREE.SphereGeometry(0.09, 12, 8), m.eye,
          [side * 0.13, end * 3.65 - 0.46 + row * 0.3, 0.21], [0.8, 1, 0.4]));
      }
    }
    ultra.add(staff);
    ultra.getObjectByName('helmet')!.rotation.x = 0.16;
    torso.scale.x = 1.07;
  }
  inkCharacter(ultra);
  ultra.userData.form = 'multi';
  return ultra;
}

export function createTiga(): THREE.Group { return createUltra(false); }
export function createBelial(): THREE.Group { return createUltra(true); }

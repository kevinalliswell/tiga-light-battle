import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyTigaForm, BELIAL_PROFILE, createMonster, createTiga, MONSTER_PROFILES } from './models';
import { disposeObject } from './disposal';
import { FORM_STATS } from './rules';

describe('sculpted character compatibility', () => {
  it('keeps the animated joints attached beneath the combat rig', () => {
    const tiga = createTiga();
    for (const side of ['left', 'right']) {
      expect(tiga.getObjectByName(`${side}-elbow`)?.parent).toBe(tiga.getObjectByName(`${side}-arm`));
      expect(tiga.getObjectByName(`${side}-knee`)?.parent).toBe(tiga.getObjectByName(`${side}-leg`));
      expect(tiga.getObjectByName(`${side}-hand`)?.parent).toBe(tiga.getObjectByName(`${side}-elbow`));
    }
    disposeObject(tiga);
  });

  it('changes suit markings without recoloring the helmet or color timer', () => {
    const tiga = createTiga();
    const timer = tiga.getObjectByName('color-timer') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const timerColor = timer.material.color.getHex();
    applyTigaForm(tiga, 'sky');
    const marking = tiga.getObjectByName('form-color') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(marking.material.color.getHex()).toBe(FORM_STATS.sky.color);
    expect(timer.material.color.getHex()).toBe(timerColor);
    disposeObject(tiga);
  });

  it('builds finite geometry for every campaign enemy and gives Belial his own weapon and eyes', () => {
    const characters = [createTiga(), ...MONSTER_PROFILES.map(createMonster), createMonster(BELIAL_PROFILE)];
    for (const character of characters) {
      character.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        expect(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        expect(Array.from(object.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
      });
      const box = new THREE.Box3().setFromObject(character);
      expect(box.max.y).toBeGreaterThan(7);
      expect(box.min.y).toBeGreaterThan(-0.2);
    }
    const belial = characters.at(-1)!;
    expect(belial.getObjectByName('giga-battlenizer')).toBeDefined();
    expect(belial.getObjectByName('left-eye')).toBeDefined();
    characters.forEach(disposeObject);
  });
});

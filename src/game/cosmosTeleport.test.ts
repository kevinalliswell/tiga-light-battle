import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CosmosTeleport } from './cosmosTeleport';

describe('Cosmos teleport', () => {
  it('allows one activation and at most ten jumps within 100 metres', () => {
    const teleport = new CosmosTeleport();
    const start = new THREE.Vector3();
    for (let i = 0; i < 10; i++) {
      const next = teleport.press(start, () => .5);
      expect(next).not.toBeNull();
      expect(next!.distanceTo(start)).toBeLessThanOrEqual(100);
    }
    expect(teleport.press(start)).toBeNull();
    teleport.update(10);
    expect(teleport.press(start)).toBeNull();
    expect(teleport.used).toBe(true);
  });
});

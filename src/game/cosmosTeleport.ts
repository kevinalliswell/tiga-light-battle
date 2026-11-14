import * as THREE from 'three';

/** One ten-second activation per round; each key press consumes one teleport. */
export class CosmosTeleport {
  used = false;
  remaining = 0;
  jumps = 0;
  get protected() { return this.remaining > 0; }
  reset() { this.used = false; this.remaining = 0; this.jumps = 0; }
  update(delta: number) { this.remaining = Math.max(0, this.remaining - delta); }
  press(position: THREE.Vector3, random: () => number = Math.random): THREE.Vector3 | null {
    if (!this.used) { this.used = true; this.remaining = 10; }
    if (!this.protected || this.jumps >= 10) return null;
    this.jumps++;
    const angle = random() * Math.PI * 2;
    const distance = 20 + random() * 80;
    return position.clone().add(new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance));
  }
}

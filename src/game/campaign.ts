export const LEVELS = [
  { name: '地球', color: 0x071019, ground: 0x171d21 },
  { name: '月球', color: 0x050610, ground: 0x777b86 },
  { name: '火星', color: 0x35150e, ground: 0xa34b2e },
  { name: '宇宙', color: 0x020216, ground: 0x151c48 },
  { name: '光之国', color: 0x063e36, ground: 0x36a58d },
] as const;

export function canHumanClimb(distance: number, taps: number): boolean {
  return distance <= 3.5 && taps >= 3;
}

export function humanAttackDamage(maxHealth: number): number {
  return Math.max(0, maxHealth) * 0.01;
}

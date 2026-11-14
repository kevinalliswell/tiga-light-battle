/** Model height is 8 units; a human is 1.65 units tall. Damage is size independent. */
export function shrinkScale(presses: number): number {
  const count = Math.max(0, presses);
  if (count <= 10) return Math.pow(1.65 / 7.52, count / 10);
  return (1.65 / 7.52) * Math.pow(.01, (count - 10) / 10);
}

export function sizeDescription(presses: number): string {
  if (presses > 20) return '比蚂蚁更小';
  if (presses === 20) return '蚂蚁大小';
  if (presses > 10) return '比人类更小';
  if (presses === 10) return '人类大小';
  return presses > 0 ? '缩小中' : '巨人大小';
}

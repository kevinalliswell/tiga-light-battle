import { describe, expect, it } from 'vitest';
import { LEVELS, canHumanClimb, humanAttackDamage } from './campaign';

describe('five-level campaign', () => {
  it('human hits remove exactly one percent of maximum health, without rounding up', () => {
    expect(humanAttackDamage(150)).toBe(1.5);
    expect(humanAttackDamage(110)).toBe(1.1);
    expect(humanAttackDamage(500)).toBe(5);
    expect(humanAttackDamage(0)).toBe(0);
  });
  it('visits the requested worlds in order', () => {
    expect(LEVELS.map(level => level.name)).toEqual(['地球', '月球', '火星', '宇宙', '光之国']);
  });
  it('requires three jumps close to a monster to climb', () => {
    expect(canHumanClimb(3, 3)).toBe(true);
    expect(canHumanClimb(3, 2)).toBe(false);
    expect(canHumanClimb(4, 3)).toBe(false);
  });
});

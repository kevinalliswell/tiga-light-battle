import { describe, expect, it } from 'vitest';
import { BELIAL_PROFILE } from './models';
import { belialAttackDamage, resolveBelialDamage } from './rules';

describe('Belial boss', () => {
  it('has 1000 health and powerful melee and ranged attacks', () => {
    expect(BELIAL_PROFILE.maxHealth).toBe(1000);
    expect(belialAttackDamage(true)).toBe(70);
    expect(belialAttackDamage(false)).toBe(85);
  });
  it('shares a 400 damage budget across ordinary rays', () => {
    expect(resolveBelialDamage(999, 'zeperion', 0, 1000)).toBe(400);
    expect(resolveBelialDamage(999, 'delacium', 350, 650)).toBe(50);
    expect(resolveBelialDamage(999, 'runboldt', 400, 600)).toBe(0);
  });
  it('does not let ordinary rays deliver the last hit', () => {
    expect(resolveBelialDamage(999, 'zeperion', 0, 10)).toBe(9);
    expect(resolveBelialDamage(999, 'zeperion', 9, 1)).toBe(0);
    expect(resolveBelialDamage(10, 'punch', 400, 1)).toBe(1);
  });
});

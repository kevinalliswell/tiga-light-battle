import { describe, expect, it } from 'vitest';
import { DEMOGEA_PROFILE, GATANOTHOR_PROFILE, MONSTER_PROFILES } from './models';

describe('monster encounter pools', () => {
  it('keeps Gatanothor out of the random monster pool', () => {
    expect(MONSTER_PROFILES.some((monster) => monster.id === 'gatanothor')).toBe(false);
  });

  it('defines Gatanothor as a separate final boss', () => {
    expect(GATANOTHOR_PROFILE.id).toBe('gatanothor');
    expect(GATANOTHOR_PROFILE.maxHealth).toBeGreaterThan(
      Math.max(...MONSTER_PROFILES.map((monster) => monster.maxHealth)),
    );
  });

  it('places Demogea after Gatanothor as the last boss', () => {
    expect(DEMOGEA_PROFILE.id).toBe('demogea');
    expect(DEMOGEA_PROFILE.maxHealth).toBeGreaterThan(GATANOTHOR_PROFILE.maxHealth);
  });

  it('marks Melba and Kyrieloid as flying opponents', () => {
    expect(MONSTER_PROFILES.find((monster) => monster.id === 'melba')?.canFly).toBe(true);
    expect(MONSTER_PROFILES.find((monster) => monster.id === 'kyrieloid')?.canFly).toBe(true);
    expect(GATANOTHOR_PROFILE.canFly).toBe(false);
  });

  it('gives Demogea an air-reaching ranged attack without flight', () => {
    expect(DEMOGEA_PROFILE.canFly).toBe(false);
    expect(DEMOGEA_PROFILE.rangedAttack).toBe(true);
  });
});

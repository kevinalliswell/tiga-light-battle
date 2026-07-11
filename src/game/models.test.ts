import { describe, expect, it } from 'vitest';
import { GATANOTHOR_PROFILE, MONSTER_PROFILES } from './models';

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
});

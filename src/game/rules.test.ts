import { describe, expect, it } from 'vitest';
import {
  FORM_STATS,
  canTransform,
  canUseAbility,
  resolveDamage,
  resolveRevival,
} from './rules';

describe('Tiga forms', () => {
  it('makes power form strongest and slowest', () => {
    expect(FORM_STATS.power.strength).toBeGreaterThan(FORM_STATS.multi.strength);
    expect(FORM_STATS.power.speed).toBeLessThan(FORM_STATS.multi.speed);
  });

  it('keeps multi form strength and speed balanced', () => {
    expect(FORM_STATS.multi.strength).toBe(FORM_STATS.multi.speed);
  });

  it('makes sky form fastest but weakest', () => {
    expect(FORM_STATS.sky.speed).toBeGreaterThan(FORM_STATS.multi.speed);
    expect(FORM_STATS.sky.strength).toBeLessThan(FORM_STATS.multi.strength);
  });
});

describe('form abilities', () => {
  it.each([
    ['power', 'delacium'],
    ['multi', 'zeperion'],
    ['sky', 'runboldt'],
    ['shining', 'super-lightning'],
  ] as const)('allows %s form to use %s', (form, ability) => {
    expect(canUseAbility(form, ability)).toBe(true);
  });

  it('prevents ordinary forms from using another form light attack', () => {
    expect(canUseAbility('multi', 'delacium')).toBe(false);
    expect(canUseAbility('power', 'zeperion')).toBe(false);
    expect(canUseAbility('sky', 'zeperion')).toBe(false);
  });

  it('requires a full light meter before shining transformation', () => {
    expect(canTransform('shining', 99)).toBe(false);
    expect(canTransform('shining', 100)).toBe(true);
  });
});

describe('light revival', () => {
  it('revives an exhausted stone statue in multi form', () => {
    expect(resolveRevival('exhausted')).toEqual({
      form: 'multi',
      healthRatio: 0.45,
      energyRatio: 0.65,
    });
  });

  it('revives a fully defeated Tiga in shining form through everyone\'s light', () => {
    expect(resolveRevival('defeated')).toEqual({
      form: 'shining',
      healthRatio: 1,
      energyRatio: 1,
    });
  });
});

describe('Gatanothor final battle', () => {
  it.each([
    ['power', 'punch'],
    ['multi', 'kick'],
    ['power', 'delacium'],
    ['sky', 'runboldt'],
  ] as const)('blocks %s form using %s', (form, ability) => {
    expect(resolveDamage(form, ability, 'gatanothor')).toBe(0);
  });

  it('takes damage from multi form Zeperion beam', () => {
    expect(resolveDamage('multi', 'zeperion', 'gatanothor')).toBeGreaterThan(0);
  });

  it('takes greater Zeperion damage from shining form', () => {
    expect(resolveDamage('shining', 'zeperion', 'gatanothor')).toBeGreaterThan(
      resolveDamage('multi', 'zeperion', 'gatanothor'),
    );
  });

  it('can still be damaged by shining super space-time lightning', () => {
    expect(resolveDamage('shining', 'super-lightning', 'gatanothor')).toBeGreaterThan(0);
  });

  it('lets ordinary monsters take damage from form-appropriate attacks', () => {
    expect(resolveDamage('power', 'delacium', 'ordinary')).toBeGreaterThan(0);
  });
});

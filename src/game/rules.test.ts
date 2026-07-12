import { describe, expect, it } from 'vitest';
import {
  FORM_STATS,
  canTransform,
  canEnterFlight,
  canEnterFlightFromTaps,
  canUseAbility,
  canUseFlashlight,
  getEnergyPhase,
  hasInfiniteEnergy,
  hasInfiniteHealth,
  normalizeEnergy,
  requiresCloseRange,
  resolveDamage,
  resolveDemogeaFinisher,
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

  it('gives shining form a clear strength and speed lead', () => {
    expect(FORM_STATS.shining.strength).toBeGreaterThan(FORM_STATS.power.strength + 0.4);
    expect(FORM_STATS.shining.strength).toBeGreaterThan(FORM_STATS.sky.strength + 0.4);
    expect(FORM_STATS.shining.speed).toBeGreaterThan(FORM_STATS.power.speed + 0.4);
    expect(FORM_STATS.shining.speed).toBeGreaterThan(FORM_STATS.sky.speed + 0.4);
  });
});

describe('form abilities', () => {
  it('requires holding the jump key for three seconds to enter flight', () => {
    expect(canEnterFlight(2.99)).toBe(false);
    expect(canEnterFlight(3)).toBe(true);
  });

  it('enters flight after three consecutive up presses', () => {
    expect(canEnterFlightFromTaps(2)).toBe(false);
    expect(canEnterFlightFromTaps(3)).toBe(true);
    expect(canEnterFlightFromTaps(5)).toBe(true);
  });

  it('keeps punches close range while allowing flying kicks to travel', () => {
    expect(requiresCloseRange('punch')).toBe(true);
    expect(requiresCloseRange('kick')).toBe(false);
  });

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

  it('reserves the evolution ray for shining form', () => {
    expect(canUseAbility('shining', 'evolution-ray')).toBe(true);
    expect(canUseAbility('multi', 'evolution-ray')).toBe(false);
  });

  it('requires a full light meter and Gatanothor defeat before shining transformation', () => {
    expect(canTransform('shining', 100, false)).toBe(false);
    expect(canTransform('shining', 99, true)).toBe(false);
    expect(canTransform('shining', 100, true)).toBe(true);
  });

  it('gives shining form an energy reserve that never drains', () => {
    expect(hasInfiniteEnergy('shining')).toBe(true);
    expect(hasInfiniteEnergy('multi')).toBe(false);
    expect(normalizeEnergy('shining', 1)).toBe(100);
    expect(normalizeEnergy('shining', 0)).toBe(100);
    expect(normalizeEnergy('multi', 1)).toBe(1);
  });

  it('gives shining form a health reserve that never drops', () => {
    expect(hasInfiniteHealth('shining')).toBe(true);
    expect(hasInfiniteHealth('sky')).toBe(false);
  });
});

describe('light revival', () => {
  it('revives a stone statue with flashlight light in multi form', () => {
    expect(resolveRevival('flashlight')).toEqual({
      form: 'multi',
      healthRatio: 0.45,
      energyRatio: 0.65,
    });
  });

  it('revives a Gatanothor defeat with Ultraman statues\' belief light in shining form', () => {
    expect(resolveRevival('belief')).toEqual({
      form: 'shining',
      healthRatio: 1,
      energyRatio: 1,
    });
  });

  it('allows flashlight revival only against ordinary monsters', () => {
    expect(canUseFlashlight('ordinary')).toBe(true);
    expect(canUseFlashlight('gatanothor')).toBe(false);
  });
});

describe('energy feedback', () => {
  it('starts flashing at half energy', () => {
    expect(getEnergyPhase(51)).toBe('stable');
    expect(getEnergyPhase(50)).toBe('warning');
  });

  it('shows a critical prompt at a quarter energy', () => {
    expect(getEnergyPhase(26)).toBe('warning');
    expect(getEnergyPhase(25)).toBe('critical');
    expect(getEnergyPhase(0)).toBe('critical');
  });
});

describe('Gatanothor final battle', () => {
  it.each([
    ['power', 'punch'],
    ['multi', 'kick'],
    ['power', 'delacium'],
    ['sky', 'runboldt'],
    ['shining', 'evolution-ray'],
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

  it('lets a form-appropriate finisher defeat any ordinary monster in one hit', () => {
    expect(resolveDamage('power', 'delacium', 'ordinary')).toBeGreaterThanOrEqual(999);
    expect(resolveDamage('multi', 'zeperion', 'ordinary')).toBeGreaterThanOrEqual(999);
    expect(resolveDamage('sky', 'runboldt', 'ordinary')).toBeGreaterThanOrEqual(999);
  });

  it('makes the shining evolution ray a one-hit finisher for ordinary monsters', () => {
    expect(resolveDamage('shining', 'evolution-ray', 'ordinary')).toBeGreaterThanOrEqual(999);
  });
});

describe('Demogea body-burst finisher', () => {
  it('lets key 6 detonate Demogea while keeping shining energy full', () => {
    expect(resolveDemogeaFinisher('shining', 'demogea', 72)).toEqual({
      canUse: true,
      damage: 9999,
      remainingEnergy: 100,
    });
  });

  it('does not allow the body-burst finisher against another target or at one energy', () => {
    expect(resolveDemogeaFinisher('shining', 'gatanothor', 72).canUse).toBe(false);
    expect(resolveDemogeaFinisher('shining', 'demogea', 1).canUse).toBe(false);
  });

  it.each(['power', 'multi', 'sky'] as const)('%s form cannot enter Demogea for the body burst', (form) => {
    expect(resolveDemogeaFinisher(form, 'demogea', 72).canUse).toBe(false);
  });

  it.each([
    ['power', 'punch'],
    ['power', 'delacium'],
    ['multi', 'zeperion'],
    ['sky', 'runboldt'],
    ['shining', 'evolution-ray'],
    ['shining', 'super-lightning'],
  ] as const)('blocks %s form %s against Demogea', (form, ability) => {
    expect(resolveDamage(form, ability, 'demogea')).toBe(0);
  });
});

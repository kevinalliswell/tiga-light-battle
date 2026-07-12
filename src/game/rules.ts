export type TigaForm = 'power' | 'multi' | 'sky' | 'shining';
export type Ability =
  | 'punch'
  | 'kick'
  | 'boomerang'
  | 'delacium'
  | 'zeperion'
  | 'runboldt'
  | 'evolution-ray'
  | 'super-lightning';
export type DefeatReason = 'exhausted' | 'defeated';
export type RevivalMethod = 'flashlight' | 'belief';
export type EnergyPhase = 'stable' | 'warning' | 'critical';
export type RevivalTarget = 'ordinary' | 'gatanothor';
export type DamageTarget = 'ordinary' | 'gatanothor' | 'demogea';

export interface FormStats {
  label: string;
  strength: number;
  speed: number;
  color: number;
  accent: number;
}

export const FORM_STATS: Record<TigaForm, FormStats> = {
  power: {
    label: '强力型',
    strength: 1.45,
    speed: 0.65,
    color: 0xc52f2f,
    accent: 0xe14d34,
  },
  multi: {
    label: '复合型',
    strength: 1,
    speed: 1,
    color: 0xb92d35,
    accent: 0x6752aa,
  },
  sky: {
    label: '空中型',
    strength: 0.65,
    speed: 1.45,
    color: 0x5142a3,
    accent: 0x6c62c9,
  },
  shining: {
    label: '闪耀型',
    strength: 1.95,
    speed: 1.9,
    color: 0xd8b43f,
    accent: 0xffe588,
  },
};

const FORM_ABILITIES: Record<TigaForm, Ability[]> = {
  power: ['punch', 'kick', 'boomerang', 'delacium'],
  multi: ['punch', 'kick', 'boomerang', 'zeperion'],
  sky: ['punch', 'kick', 'boomerang', 'runboldt'],
  shining: [
    'punch',
    'kick',
    'boomerang',
    'delacium',
    'zeperion',
    'runboldt',
    'evolution-ray',
    'super-lightning',
  ],
};

const BASE_DAMAGE: Record<Ability, number> = {
  punch: 10,
  kick: 14,
  boomerang: 8,
  delacium: 34,
  zeperion: 38,
  runboldt: 30,
  'evolution-ray': 52,
  'super-lightning': 80,
};

const FINISHER_ABILITIES: Ability[] = [
  'delacium',
  'zeperion',
  'runboldt',
  'evolution-ray',
  'super-lightning',
];

export function canUseAbility(form: TigaForm, ability: Ability): boolean {
  return FORM_ABILITIES[form].includes(ability);
}

export function requiresCloseRange(ability: Ability): boolean {
  return ability === 'punch';
}

export const FLIGHT_HOLD_SECONDS = 3;

export function canEnterFlight(holdSeconds: number): boolean {
  return holdSeconds >= FLIGHT_HOLD_SECONDS;
}

export function canTransform(
  form: TigaForm,
  lightMeter: number,
  defeatedByGatanothor = false,
): boolean {
  return form !== 'shining' || (lightMeter >= 100 && defeatedByGatanothor);
}

export function hasInfiniteEnergy(form: TigaForm): boolean {
  return form === 'shining';
}

export function hasInfiniteHealth(form: TigaForm): boolean {
  return form === 'shining';
}

export function normalizeEnergy(form: TigaForm, energy: number): number {
  return hasInfiniteEnergy(form) ? 100 : Math.max(0, energy);
}

export function getEnergyPhase(energy: number): EnergyPhase {
  if (energy <= 25) return 'critical';
  if (energy <= 50) return 'warning';
  return 'stable';
}

export function canUseFlashlight(target: RevivalTarget): boolean {
  return target === 'ordinary';
}

export function resolveDamage(
  form: TigaForm,
  ability: Ability,
  target: DamageTarget,
): number {
  if (!canUseAbility(form, ability)) return 0;
  if (target === 'demogea') return 0;
  if (target === 'gatanothor') {
    if (ability === 'zeperion') {
      return Math.round(BASE_DAMAGE[ability] * FORM_STATS[form].strength);
    }
    return form === 'shining' && ability === 'super-lightning' ? BASE_DAMAGE[ability] : 0;
  }
  if (FINISHER_ABILITIES.includes(ability)) return 999;
  return Math.round(BASE_DAMAGE[ability] * FORM_STATS[form].strength);
}

export function resolveDemogeaFinisher(
  form: TigaForm,
  target: DamageTarget,
  energy: number,
): { canUse: boolean; damage: number; remainingEnergy: number } {
  const canUse = form === 'shining' && target === 'demogea' && energy > 1;
  return {
    canUse,
    damage: canUse ? 9999 : 0,
    remainingEnergy: canUse ? (hasInfiniteEnergy(form) ? 100 : 1) : energy,
  };
}

export function resolveRevival(method: RevivalMethod | DefeatReason): {
  form: TigaForm;
  healthRatio: number;
  energyRatio: number;
} {
  if (method === 'belief' || method === 'defeated') {
    return { form: 'shining', healthRatio: 1, energyRatio: 1 };
  }

  return { form: 'multi', healthRatio: 0.45, energyRatio: 0.65 };
}

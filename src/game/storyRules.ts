import type { Episode } from './episodes';
import type { Ability } from './rules';

export const ESCAPE_SECONDS = 6;
export const ULTRA_EXPLOSION_RANK = 4;
export const MOVE_RANK: Record<Ability, number> = {punch:1,kick:1,boomerang:1,delacium:3,zeperion:3,runboldt:2,'evolution-ray':4,'super-lightning':4,'tiga-freeze':2,'tiga-slash':3,'flying-charge':4};
export const MOVE_NAMES: Record<Ability, string> = {punch:'格斗拳',kick:'飞踢',boomerang:'光之飞镖',delacium:'迪拉修姆光流',zeperion:'哉佩利敖光线',runboldt:'兰帕尔特光弹','evolution-ray':'闪耀哉佩利敖光线','super-lightning':'超级时空闪电','tiga-freeze':'迪迦冰冻','tiga-slash':'迪迦光刃','flying-charge':'深空重砸'};

export function canFireStoryRay(episode: Episode, health: number, maxHealth: number, digging: boolean, shining: boolean) {
  return episode.openingRay === true || digging || health <= maxHealth * 0.35 ||
    (shining && episode.enemies.some(enemy => enemy.id === 'gatanothor' || enemy.id === 'demogea'));
}
export function skipReturnEpisode(episode: number, golzaDefeatedEarly: boolean) { return episode === 18 && golzaDefeatedEarly; }
export function shouldRescueWithLight(episode: number, used: boolean, health: number, energy: number) {
  return episode === 25 && !used && (health <= 20 || energy <= 15);
}
export function storyMoveDamage(baseDamage: number, ability: Ability, health: number, tier: number, required: Ability[] = []) {
  if (required.length && !required.includes(ability) && baseDamage >= health) return Math.max(0,health-1);
  if (MOVE_RANK[ability] < tier && baseDamage >= health) return Math.max(0,health-1);
  return baseDamage;
}

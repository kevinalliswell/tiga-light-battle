import type { TigaForm } from './rules';

export const BIG_SHINING_DEATHS=10;
export const SMALL_SHINING_SECONDS=60;
export const NORMAL_FORM_SECONDS=180;
export const FLIGHT_EXPLOSION_SECONDS=30;
export const GALAXY_EXIT_SECONDS=20;
export const JUMP_METERS: Record<TigaForm,number>={power:500,multi:700,sky:1000,'small-shining':10000,shining:11000000000000000000};
export function jumpHeightLabel(form:TigaForm){return form==='shining'?'11000000000000000000 米':`${JUMP_METERS[form]} 米`;}
/** Compress only the astronomical jump into a readable camera scale. */
export function jumpWorldHeight(form:TigaForm){return Math.min(1800,JUMP_METERS[form]/10);}
export function bigShiningUnlocked(deaths:number){return deaths>=BIG_SHINING_DEATHS;}

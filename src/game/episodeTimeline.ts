export const EPISODE_SECONDS = 24 * 60;
export const INTRO_SECONDS = 19 * 60;
export const OUTRO_SECONDS = 60;
export const PILOT_START = 5 * 60;
export const PILOT_SECONDS = 4 * 60;
export const TRANSFORM_SECONDS = 12;

export type SceneKind = 'briefing' | 'launch' | 'pilot' | 'rescue' | 'monster' | 'counterattack' | 'resolve';
const ACTS: Array<{start:number; kind:SceneKind; title:string}> = [
  {start:0,kind:'briefing',title:'基地警报 · 分析怪兽反应'},
  {start:120,kind:'launch',title:'胜利队出动 · 战机升空'},
  {start:PILOT_START,kind:'pilot',title:'胜利飞跃号 · 四分钟驾驶任务'},
  {start:540,kind:'rescue',title:'掩护撤离 · 搜救街区'},
  {start:720,kind:'monster',title:'怪兽袭城 · 防线告急'},
  {start:900,kind:'counterattack',title:'胜利队反击 · 交叉掩护'},
  {start:1020,kind:'resolve',title:'光的继承者 · 奔向战场'},
];
export function episodeScene(time:number) {
  const act=[...ACTS].reverse().find(a=>time>=a.start)??ACTS[0];
  const local=Math.max(0,time-act.start);
  return {...act,local,shot:Math.floor(local/10),pilot:act.kind==='pilot'};
}
export function remainingOutro(episodeElapsed:number) {
  return Math.max(OUTRO_SECONDS,EPISODE_SECONDS-episodeElapsed);
}
export function formatTime(seconds:number) {
  const whole=Math.max(0,Math.floor(seconds));
  return `${Math.floor(whole/60).toString().padStart(2,'0')}:${(whole%60).toString().padStart(2,'0')}`;
}
export function canUltraExplode(human:boolean,health:number) {
  return !human && health>=0 && health<=30;
}
/** Logical size can outgrow the planet while rendering stays numerically stable. */
export function giantSize(level:number) {
  const visual=Math.pow(2,Math.min(level,6));
  const metersLog=Math.log10(53)+level*Math.log10(2);
  const height=metersLog<6?`${Math.round(Math.pow(10,metersLog)).toLocaleString()} 米`:`10^${metersLog.toFixed(1)} 米`;
  const planetRatio=Math.pow(2,Math.min(level,1023))/(12742000/53);
  return {visual,height,largerThanEarth:planetRatio>1,earthScale:Math.max(.008,(12742000/53)*8*visual/Math.pow(2,Math.min(level,1023))/11.2)};
}

/** Release-based gestures keep a held explosion from also entering exploration. */
export class SpaceGesture {
  private downAt:number|null=null;
  private pendingAt:number|null=null;
  private consumed=false;
  get pressed(){return this.downAt!==null;}
  consume(){this.consumed=true;this.pendingAt=null;}
  down(time:number){if(this.downAt===null){this.downAt=time;this.consumed=false;}}
  release(time:number):'grow'|null {
    if(this.downAt===null)return null;
    this.downAt=null;
    if(this.consumed){this.pendingAt=null;return null;}
    if(this.pendingAt!==null&&time-this.pendingAt<=.32){this.pendingAt=null;return 'grow';}
    this.pendingAt=time;return null;
  }
  update(time:number):'hold'|'explore'|null {
    if(this.downAt!==null&&!this.consumed&&time-this.downAt>=1.2){this.consumed=true;this.pendingAt=null;return 'hold';}
    if(this.downAt===null&&this.pendingAt!==null&&time-this.pendingAt>.32){this.pendingAt=null;return 'explore';}
    return null;
  }
  reset(){this.downAt=null;this.pendingAt=null;this.consumed=false;}
}

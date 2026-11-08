import * as THREE from 'three';
import { FORM_STATS, type Ability, type TigaForm } from './rules';
import type { Episode } from './episodes';
import { disposeObject } from './disposal';

export type HeroId = 'tiga' | 'zero' | 'dyna' | 'gaia' | 'zeta' | 'trigger' | 'yasuo' | 'cosmos';
export interface HeroProfile {
  name: string; scene: string; region: number; color: number; accent: number;
  skills: Record<Ability, string>; enemies: string[]; story: string;
}
const skills = (names: string[]): Record<Ability, string> => Object.fromEntries(
  ['punch','kick','boomerang','delacium','zeperion','runboldt','evolution-ray','super-lightning','tiga-freeze','tiga-slash','flying-charge'].map((key,i)=>[key,names[i]]),
) as Record<Ability,string>;
export const HEROES: Record<HeroId, HeroProfile> = {
  tiga: {name:'迪迦',scene:'胜利队 · 地球都市',region:1,color:0xb92d35,accent:0x6752aa,
    skills:skills(['格斗拳','迪迦飞踢','迪迦飞镖','迪拉修姆光流','哉佩利敖光线','兰帕尔特光弹','闪耀哉佩利敖光线','超级时空闪电','迪迦冰冻','迪迦光刃','深空重砸']),enemies:[],story:'胜利队发现古代遗迹，光的继承者守护地球。'},
  zero: {name:'赛罗',scene:'光之国 · 宇宙警备队',region:5,color:0xc63940,accent:0x328ee0,
    skills:skills(['赛罗重拳','赛罗飞踢','赛罗头镖','强壮日冕冲击','赛罗集束射线','月神奇迹光弹','究极赛罗射线','闪耀赛罗光线','月神奇迹定身','赛罗双刃剑','究极赛罗突击']),enemies:['贝利亚','机械哥莫拉','黑暗洛普斯赛罗'],story:'宇宙警备队追踪贝利亚的黑暗信号，赛罗赶往光之国前线。'},
  dyna: {name:'戴拿',scene:'超级胜利队 · 火星前线',region:3,color:0xd23c3e,accent:0x4772cf,
    skills:skills(['戴拿拳','戴拿飞踢','戴拿切割','加尔奈特轰炸','索尔捷特光线','立波留姆光波','闪耀索尔捷特','奇迹雷击','戴拿冻结','戴拿手刀','戴拿旋转冲撞']),enemies:['达兰比尔','雷丘巴斯','斯菲亚合成兽'],story:'超级胜利队收到火星警报，戴拿迎击斯菲亚合成兽。'},
  gaia: {name:'盖亚',scene:'XIG · 大地守护战线',region:1,color:0xc42a35,accent:0xc5a756,
    skills:skills(['盖亚重拳','盖亚飞踢','盖亚切割','量子流线','光子冰刀','光子之刃','至高光子流线','大地之光','盖亚冰冻','盖亚光剑','盖亚至高重砸']),enemies:['戈布','阿帕苔','佐格'],story:'XIG发现根源性破灭招来体，大地之光回应了守护者。'},
  zeta: {name:'泽塔',scene:'军械库 · 特空机基地',region:1,color:0x346ad0,accent:0x85dfff,
    skills:skills(['阿尔法连拳','贝塔飞踢','泽塔光轮','贝塔爆裂','泽斯蒂姆光线','伽马幻象召唤','德尔塔泽斯蒂姆光线','宇宙泽塔之光','伽马守护','贝利亚黄昏斩','德尔塔天降突击']),enemies:['盖内伽古','内隆嘎','格鲁吉欧雷电'],story:'军械库的特空机出动，泽塔与队员们协力保卫城市。'},
  cosmos: {name:'高斯',scene:'青年精英队 · 镝矢群岛',region:1,color:0x3674c9,accent:0xb8edff,
    skills:skills(['高斯掌击','高斯飞踢','月神光轮','日冕爆裂','日蚀光线','月神净化波','未来光线','奇迹之光','月神镇静','日冕光刃','日蚀突击']),enemies:['利多利阿斯','高尔美第','卡欧斯头部'],story:'青年精英队保护怪兽栖息地，高斯用温柔与勇气驱散卡欧斯。'},
  trigger: {name:'特利迦',scene:'精英胜利队 · 火星遗迹',region:3,color:0xb92d35,accent:0x6752aa,
    skills:skills(['特利迦拳','特利迦飞踢','特利迦光轮','迪拉修姆光流','哉佩利敖光线','兰帕尔特光弹','永恒哉佩利敖光线','闪耀永恒光线','特利迦冰冻','圆环武装剑','永恒深空突击']),enemies:['强化哥尔巴','强化加佐特','强化达贡'],story:'精英胜利队调查火星遗迹，特利迦迎战强化的黑暗怪兽。'},
  yasuo: {name:'亚索',scene:'艾欧尼亚 · 疾风之境',region:1,color:0x337d91,accent:0x9bdcd6,
    skills:skills(['疾风斩','踏前斩','斩钢闪','旋风烈斩','疾风剑气','踏风突刺','狂风绝息斩','无尽剑风','风之壁障','拔刀连斩','御风俯冲']),enemies:['黑暗剑魔兽','风暴巨兽','深渊守卫'],story:'异界裂隙出现在艾欧尼亚，流浪剑士以疾风迎击巨兽。'},
};

const OWN_FORMS: Partial<Record<HeroId, Record<TigaForm,string>>> = {
  zeta:{multi:'阿尔法装甲',power:'贝塔冲击',sky:'伽马未来','small-shining':'德尔塔天爪',shining:'宇宙泽塔'},
  zero:{multi:'赛罗标准型',power:'强壮日冕',sky:'月神奇迹','small-shining':'光辉赛罗',shining:'光辉终极铠甲'},
  dyna:{multi:'闪亮型',power:'强壮型',sky:'奇迹型','small-shining':'闪耀戴拿',shining:'无限闪耀戴拿'},
  gaia:{multi:'V1 型',power:'V2 型',sky:'高速型','small-shining':'至高型',shining:'大地闪耀型'},
  cosmos:{multi:'月神型',power:'日冕型',sky:'宇宙日冕型','small-shining':'日蚀型',shining:'未来型'},
  trigger:{multi:'复合型',power:'强力型',sky:'空中型','small-shining':'闪耀永恒',shining:'真理特利迦'},
  yasuo:{multi:'疾风剑客',power:'浪客剑意',sky:'御风剑意','small-shining':'风之觉醒',shining:'无尽剑意'},
};
export function heroFormName(hero:HeroId,form:TigaForm) { return OWN_FORMS[hero]?.[form]??FORM_STATS[form].label; }

export function heroFormColors(hero:HeroId,form:TigaForm):[number,number] {
  if(hero==='zeta')return form==='power'?[0xa82835,0xd6a43a]:form==='sky'?[0x633b97,0xe2b861]:form==='small-shining'?[0x151b39,0xe7c24e]:[0x2966b6,0x8edaff];
  if(hero==='cosmos')return form==='power'?[0xbf3a34,0xf6ac53]:form==='sky'?[0x773c92,0xa5dfff]:[0x3674c9,0xb8edff];
  return [HEROES[hero].color,HEROES[hero].accent];
}

export function heroSkillTraits(hero: HeroId, ability: Ability) {
  return {
    hits: hero==='zero'&&ability==='boomerang'?2:hero==='zeta'&&ability==='runboldt'?3:1,
    area: hero==='gaia'&&ability==='delacium'?14:hero==='yasuo'&&ability==='delacium'?10:0,
    pull: hero==='dyna'&&ability==='runboldt',
    windWall: hero==='yasuo'&&ability==='tiga-freeze',
    dash: hero==='yasuo'&&(ability==='kick'||ability==='runboldt'),
  };
}

export function zeroVariantForm(action: string) {
  return action==='zero-ultimate'?'multi':action==='zero-shining'?'small-shining':'shining';
}

/** Lightweight landmarks distinguish each character's home battlefield. */
export function createHeroStage(hero: HeroId) {
  const group=new THREE.Group();group.name=`hero-stage-${hero}`;
  if(hero==='tiga'||hero==='zero')return group;
  const metal=new THREE.MeshStandardMaterial({color:0x8599aa,metalness:.65,roughness:.4});
  const light=new THREE.MeshStandardMaterial({color:HEROES[hero].accent,emissive:HEROES[hero].accent,emissiveIntensity:.8});
  const box=(size:[number,number,number],pos:[number,number,number],mat=metal)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);mesh.position.set(...pos);group.add(mesh);return mesh;
  };
  if(hero==='gaia'){
    const base=new THREE.Mesh(new THREE.TorusGeometry(24,2.2,8,48),metal);base.rotation.x=Math.PI/2;base.position.set(0,35,-65);group.add(base);
    box([12,6,9],[0,35,-65]);box([1,12,1],[0,44,-65],light);
  }else if(hero==='zeta'){
    for(const x of [-40,40]){box([20,16,16],[x,8,-45]);box([16,12,.4],[x,6,-36.7],light);}
    box([100,3,10],[0,18,-45]);
  }else if(hero==='dyna'){
    for(const x of [-34,0,34]){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(12,20,12,0,Math.PI*2,0,Math.PI/2),metal);dome.position.set(x,0,-65);group.add(dome);
      box([3,16,3],[x,8,-80],light);
    }
  }else if(hero==='trigger'){
    const stone=new THREE.MeshStandardMaterial({color:0xa18b80,roughness:.8});
    for(const x of [-30,30]){box([6,27,6],[x,13.5,-45],stone);box([9,2,9],[x,27,-45],light);}
    box([68,4,7],[0,29,-45],stone);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(10,.7,8,48),light);ring.position.set(0,16,-49);group.add(ring);
  }else if(hero==='yasuo'){
    const wood=new THREE.MeshStandardMaterial({color:0x923b32,roughness:.8});
    box([2,20,2],[-16,10,-40],wood);box([2,20,2],[16,10,-40],wood);box([42,2,3],[0,20,-40],wood);box([34,1,2],[0,16,-40],wood);
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=side*(35+i*10),z=-25-i*17;
      box([2,15,2],[x,7.5,z],wood);
      const leaves=new THREE.Mesh(new THREE.SphereGeometry(9,12,8),new THREE.MeshStandardMaterial({color:i%2?0xc899b3:0x658c88,roughness:.9}));leaves.position.set(x,17,z);group.add(leaves);
    }
  }
  return group;
}
export function heroEpisode(base: Episode, hero: HeroId, wave: number): Episode {
  const profile=HEROES[hero];
  if(hero==='tiga'||wave>=53)return base;
  const teams:Record<Exclude<HeroId,'tiga'>,string[]>={
    zero:['赛罗','赛文','镜子骑士','火焰战士'],dyna:['飞鸟信','由美村良','幸田','中岛'],gaia:['高山我梦','佐佐木敦子','梶尾','堤主任'],
    zeta:['夏川遥辉','中岛洋子','青柳','大田结花'],trigger:['真中剑悟','静间结名','七濑日葵','圣彰人'],yasuo:['亚索','阿狸','永恩','卡尔玛'],cosmos:['春野武藏','日浦晴光','水木忍','森本绫乃'],
  };
  const [lead,partner,pilot,analyst]=teams[hero];
  return {...base,title:`${profile.name} · ${profile.scene} · ${wave}`,region:profile.region,
    sceneName:profile.scene,cast:{'大古':lead,'丽娜':partner,'新城':pilot,'堀井':analyst},
    enemies:base.enemies.map((enemy,i)=>({...enemy,name:profile.enemies[(wave-1+i)%profile.enemies.length],
      id:hero==='zero'&&wave%3===1?'belial':enemy.id,
      maxHealth:hero==='trigger'?Math.round(enemy.maxHealth*1.2):enemy.maxHealth,
      power:hero==='trigger'?enemy.power*1.15:enemy.power,
      variant:hero==='trigger'?'enhanced':enemy.variant})),
    narration:[profile.story,`${profile.scene}出现${profile.enemies[(wave-1)%profile.enemies.length]}的反应。`,'选择你的专属招式，和同伴一起守护这片世界。']};
}

/** Attach distinguishing armor to the existing articulated rig, preserving its animations. */
export function applyHeroIdentity(actor: THREE.Group, hero: HeroId, ultimate=false) {
  const old=actor.getObjectByName('hero-identity');
  if(old){old.removeFromParent();disposeObject(old);}
  actor.userData.hero=hero;
  if(hero==='tiga')return;
  const profile=HEROES[hero],details=new THREE.Group();details.name='hero-identity';
  const silver=new THREE.MeshStandardMaterial({color:0xd8e7ef,metalness:.7,roughness:.28});
  const glow=new THREE.MeshStandardMaterial({color:profile.accent,emissive:profile.accent,emissiveIntensity:.65});
  const add=(geometry:THREE.BufferGeometry,position:[number,number,number],material= silver)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);details.add(mesh);return mesh;
  };
  // The Ultimate Zero blades grow from the hands/forearms, so the sword attack
  // reads clearly in the idle pose instead of leaving two small bars above the head.
  if(hero==='zero')for(const side of [-1,1]){
    const blade=add(new THREE.ConeGeometry(.18,2.35,6),[side*1.22,3.05,.42],glow);
    blade.rotation.z=side*.16;
    const guard=add(new THREE.BoxGeometry(.7,.1,.18),[side*1.15,3.98,.42],silver);
    guard.rotation.z=side*.16;
  }
  if(hero==='zero'&&ultimate){
    for(const side of [-1,1]){
      const wing=add(new THREE.ConeGeometry(.7,3,4),[side*1.8,6.3,-.5]);wing.rotation.z=side*-.85;
      add(new THREE.BoxGeometry(.8,.5,1),[side*1.45,6.4,0]);
    }
    add(new THREE.OctahedronGeometry(.5),[0,5.7,.8],glow);
    const blade=add(new THREE.ConeGeometry(.25,3.8,4),[2.25,3.15,.56],glow);blade.rotation.z=-.4;
  }
  if(hero==='zeta'){const crest=add(new THREE.TorusGeometry(.65,.12,6,3),[0,7.9,.24],glow);crest.rotation.z=Math.PI;}
  if(hero==='dyna')add(new THREE.ConeGeometry(.25,1.2,4),[0,8.1,0]);
  if(hero==='cosmos'){
    add(new THREE.ConeGeometry(.18,1.1,4),[0,8.05,0]);
    add(new THREE.SphereGeometry(.24,12,8),[0,5.95,.73],glow);
    for(const side of [-1,1]){const stripe=add(new THREE.BoxGeometry(.16,1.65,.12),[side*.62,5.6,.65],glow);stripe.rotation.z=side*-.48;}
  }
  if(hero==='gaia')add(new THREE.TorusGeometry(.85,.15,6,3),[0,5.75,.57],glow);
  if(hero==='trigger'){
    const crest=add(new THREE.ConeGeometry(.22,1.1,4),[0,8,.15],glow);crest.rotation.x=.2;
    add(new THREE.TorusGeometry(.65,.1,6,3),[0,5.9,.68],glow);
  }
  if(hero==='yasuo'){
    add(new THREE.SphereGeometry(.75,12,8),[0,7.8,-.15],new THREE.MeshStandardMaterial({color:0x172e43}));
    const sword=add(new THREE.BoxGeometry(.13,4.8,.24),[1.1,4.3,.4]);sword.rotation.z=-.25;
    add(new THREE.BoxGeometry(1,.12,.3),[1.7,2.1,.4],glow);
    add(new THREE.TorusGeometry(.7,.23,8,24),[0,6.6,0],glow).rotation.x=Math.PI/2;
  }
  actor.add(details);
}

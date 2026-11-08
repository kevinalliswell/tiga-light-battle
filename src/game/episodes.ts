import { DEMOGEA_PROFILE, GATANOTHOR_PROFILE, MONSTER_PROFILES, type MonsterProfile } from './models';
import { BELIAL_PROFILE } from './models';

export interface Episode {
  title: string;
  enemies: MonsterProfile[];
  narration: string[];
  region: number;
  openingRay?: boolean;
  cast?: Record<string,string>;
  sceneName?: string;
}

const chapters: Array<[string, string, number]> = [
  ['光的继承者', '哥尔赞与美尔巴', 0], ['石头的神话', '加库玛', 0],
  ['恶魔的预言', '基里艾洛德人', 2], ['再见了，地球', '立加德隆', 0],
  ['怪兽出没的日子', '西利赞', 0], ['第二次接触', '加佐特', 1],
  ['降临地球的外星人', '雷丘兰星人', 2], ['万圣节的夜晚', '基兰勃', 2],
  ['等待怪兽的少女', '玛奇那', 0], ['封闭的游乐园', '嘎地', 0],
  ['黑暗中苏醒的巨人', '艾勃隆', 2], ['从深海来的 SOS', '雷伊洛斯', 0],
  ['不做奴隶', '勒比克星人', 2], ['被流放的目标', '木珍星人', 2],
  ['梦幻疾走', '加佐特二代', 1], ['苏醒的鬼神', '宿那鬼', 2],
  ['红与蓝的决战', '阿勃巴斯与雷德尔', 2], ['哥尔赞的逆袭', '火焰哥尔赞', 0],
  ['GUTS 奔向宇宙（上）', '哥布纽', 2], ['GUTS 奔向宇宙（下）', '机械岛巨人', 2],
  ['出场了，德班！', '艾能美那', 2], ['大雾来了', '玛格尼亚', 0],
  ['恐龙们的星球', '丸迫奈扎', 0], ['前进！怪兽探险队', '立特玛鲁斯', 0],
  ['恶魔的审判', '基里艾洛德人二代', 2], ['彩虹般的怪兽魔境', '希尔巴贡', 0],
  ['看见了奥比克', '奥比克', 2], ['呼唤', '乔贝利艾', 0],
  ['蓝色夜晚的记忆', '基加', 2], ['怪兽动物园', '莫拉特王', 0],
  ['GUTS 基地被袭击', '比佐摩', 2], ['滋尔达中心的攻防', '西拉', 1],
  ['吸血都市', '休拉诺斯', 1], ['南方海峡', '戴西玛尼亚', 1],
  ['沉睡的少女', '古瓦木', 0], ['超越时空的微笑', '哥尔德拉斯', 0],
  ['花', '马农星人', 2], ['蜃楼的怪兽', '法尔顿', 0],
  ['你好，奥特曼', '加鲁拉', 0], ['梦', '巴克贡', 0],
  ['宇宙来的朋友', '伊路德人', 2], ['少女消失的街道', '法伊巴斯', 2],
  ['地之鲨', '盖欧扎克', 0], ['影之继承者', '邪恶迪迦', 2],
  ['永远的生命', '齐杰拉', 0], ['至急！镰仓', '塔拉班', 0],
  ['告别黑暗', '梅塔莫尔加', 0], ['来自月球的逃亡者', '梅珠朗', 0],
  ['奥特之星', '查利迦与亚那加基', 0], ['飞得更高！', '佐加', 1],
  ['黑暗的支配者', '加坦杰厄', 0], ['致以辉煌的人', '加坦杰厄', 0],
];

export const EPISODES: Episode[] = chapters.map(([title, enemy, shape], i) => {
  const base = MONSTER_PROFILES[shape];
  const profile: MonsterProfile = { ...base, name: enemy, maxHealth: 150 + i * 7, power: 13 + Math.floor(i / 6),
    color: [0x55756e, 0x536890, 0x62527c, 0x8b614d][i % 4], accent: [0x89c3be, 0xc4b991, 0xd97486][i % 3] };
  if (i === 17 || i === 24) {
    profile.variant = 'enhanced';profile.tier = 2;
    profile.color = 0x343344;profile.accent = 0xff6338;
    profile.maxHealth *= 1.6;profile.power *= 1.4;
    profile.requiredFinisher = i === 17 ? ['delacium','evolution-ray','super-lightning'] : ['zeperion','evolution-ray','super-lightning'];
  }
  if (i === 2 || i === 17 || i === 24) {profile.rangedAttack = true;profile.attackRange = 7;}
  return {
    title, region: i === 47 ? 2 : i === 18 || i === 19 || i === 33 ? 4 : 1,
    enemies: i === 0 ? MONSTER_PROFILES.slice(0, 2).map(p => ({ ...p }))
      : i >= 50 ? [{ ...GATANOTHOR_PROFILE, maxHealth: i === 50 ? 900 : 1200 }]
        : [profile],
    narration: i === 0 ? [
      '远古的预言，再次降临这颗蓝色星球。',
      '哥尔赞与美尔巴同时出现，金字塔中的巨人正在苏醒。',
      '当人类选择守护，光便有了新的继承者。',
    ] : i === 24 ? ['基里艾洛德人二代现身，铠甲中的熔岩纹路比初代更加炽烈。','黑暗笼罩城市，迪迦的能量正在被消耗。','当迪迦倒下，人们会举起光芒，自动唤醒反击。'] : i === 17 ? ['曾经逃入地下的哥尔赞，吸收岩浆后重新出现。','它的熔岩装甲抵挡弱小招式，需要更强的终结技。','使用强力型的迪拉修姆光流，打破它的装甲。'] : i >= 50 ? [
      '黑雾掩没海岸，世界正在失去最后的光。',
      '加坦杰厄从深海苏醒。即使倒下，人们的信念也不会熄灭。',
      '将所有人的光，交给迪迦。',
    ] : [`第 ${i + 1} 集 · ${title}`, `${enemy}的反应被发现，胜利队正前往现场。`,
      '镜头之外，是等待守护的人们。轮到你接过这束光。'],
  };
});

export const AFTER_STORY: Episode = {
  title: '两年后 · 最终圣战', region: 5,
  enemies: [{ ...DEMOGEA_PROFILE, name: '梅加洛杰厄', maxHealth: 1800, power: 45 }],
  narration: ['两年过去，和平的天空下，新的黑暗正在苏醒。',
    '梅加洛杰厄降临光之国。透明的水晶之城，再次响起警报。',
    '最后的战斗。即使光芒消散一次，闪耀也会再次出现。'],
};

export const MONSTER_SIEGE: Episode = {
  title:'第 53 集 · 银河怪兽总攻',region:5,openingRay:true,
  enemies:[...EPISODES.flatMap(ep=>ep.enemies).filter((enemy,i,all)=>all.findIndex(m=>m.name===enemy.name)===i).map(enemy=>({...enemy})),
    {...DEMOGEA_PROFILE,maxHealth:1800}, {...BELIAL_PROFILE,maxHealth:1000}],
  narration:['特别篇之后，银河深处的裂隙全部打开。','历代怪兽与贝利亚涌向光之国，所有守护者集结。','按住空格再按「飞」或 B，释放四星飞行爆炸，连爆之后俯冲迎击！'],
};
export function episodeAt(number: number): Episode { return number===54?MONSTER_SIEGE:EPISODES[number - 1] ?? AFTER_STORY; }

export function shiningDeathThreshold(enemies: Array<{ id: string }>) {
  return enemies.some(e => e.id === 'gatanothor' || e.id === 'demogea') ? 1 : 3;
}

export const RAY_CHARGE_SECONDS = 1.65;
export const RAY_POSE_SECONDS = 2.45;
export function rayPhase(elapsed: number): 'cross' | 'spread' | 'aim' | 'fire' {
  return elapsed < .5 ? 'cross' : elapsed < 1.05 ? 'spread' : elapsed < RAY_CHARGE_SECONDS ? 'aim' : 'fire';
}

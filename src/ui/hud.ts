import {
  Activity,
  BicepsFlexed,
  Bolt,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  createIcons,
} from 'lucide';
import {
  FORM_STATS,
  formForAbility,
  type Ability,
  type DefeatReason,
  type EnergyPhase,
  type RevivalMethod,
  type TigaForm,
} from '../game/rules';
import { getTutorialInstruction, type TutorialStage } from '../game/tutorial';
import { MOVE_RANK } from '../game/storyRules';
import { HEROES, heroFormName, type HeroId } from '../game/heroes';
import { bigShiningUnlocked, jumpHeightLabel } from '../game/progression';

export type GameAction =
  | 'eject' | 'aircraft' | 'submarine' | 'sea-teleport' | 'pilot-fire-left' | 'pilot-fire-right' | 'glide' | 'flight-explosion' | 'zero-ultimate' | 'zero-shining' | 'zero-shining-ultimate'
  | 'explore'
  | 'grow'
  | 'ultra-explosion'
  | 'human-form'
  | 'transform'
  | Ability
  | 'demogea-finish'
  | 'move-left'
  | 'move-right'
  | 'move-down'
  | 'move-forward'
  | 'move-back'
  | 'jump'
  | 'land'
  | 'space-flight'
  | 'perspective-l'
  | 'perspective-n'
  | 'shrink' | 'enlarge' | 'cosmos-teleport'
  | 'illusion-tiga' | 'illusion-dyna' | 'illusion-gaia' | 'illusion-core'
  | 'guard'
  | 'revive'
  | `form-${TigaForm}`;

export type PerspectiveMode = 'first' | 'second';

export interface HudSnapshot {
  hero:HeroId;
  totalDeaths:number;
  formSeconds:number|null;
  glideUnlocked:boolean;
  zeroUltimate:boolean;
  human: boolean;
  levelName: string;
  started: boolean;
  form: TigaForm;
  playerHealth: number;
  lastStandSeconds: number | null;
  playerEnergy: number;
  energyPhase: EnergyPhase;
  energyAlert: string;
  lightMeter: number;
  shiningUnlocked: boolean;
  monsterName: string;
  monsterHealth: number;
  monsterMaxHealth: number;
  monsterCount: number;
  demogeaBattle: boolean;
  moveHint: string;
  wave: number;
  message: string;
  defeatReason: DefeatReason | null;
  revivalMethod: RevivalMethod | null;
  reviving: boolean;
  recharging: boolean;
  tutorialStage: TutorialStage;
  viewMode: PerspectiveMode;
  flying: boolean;
  earthView: boolean;
}

type CombatAction = Ability | 'demogea-finish';

const ABILITY_KEYS: Array<{ key: string; action: CombatAction; label: string; icon: string }> = [
  { key: 'Q', action: 'punch', label: '光拳', icon: 'biceps-flexed' },
  { key: 'W', action: 'kick', label: '飞踢', icon: 'activity' },
  { key: 'E', action: 'boomerang', label: '迪迦飞镖', icon: 'sparkles' },
  { key: 'Z', action: 'delacium', label: '迪拉修姆', icon: 'bolt' },
  { key: 'X', action: 'zeperion', label: '哉佩利敖', icon: 'swords' },
  { key: 'C', action: 'runboldt', label: '兰帕尔特', icon: 'gauge' },
  { key: '5', action: 'evolution-ray', label: '光之进化', icon: 'sparkles' },
  { key: 'D', action: 'super-lightning', label: '时空闪电', icon: 'bolt' },
  { key: '6', action: 'demogea-finish', label: '体内爆破', icon: 'bolt' },
  { key: 'A', action: 'tiga-freeze', label: '迪迦冰冻', icon: 'sparkles' },
  { key: 'S', action: 'tiga-slash', label: '迪迦光刃', icon: 'swords' },
  { key: 'V', action: 'flying-charge', label: '深空重砸', icon: 'activity' },
];

export class Hud {
  private readonly host: HTMLElement;
  private actionHandler: ((action: GameAction, pressed: boolean) => void) | null = null;
  private startHandler: (() => void) | null = null;
  private muteHandler: ((muted: boolean) => void) | null = null;
  private muted = false;
  private heroHandler:((hero:HeroId)=>void)|null=null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.host.innerHTML = `
      <div class="hud" aria-label="游戏状态">
        <header class="status-row">
          <section class="fighter-status fighter-status--player" aria-label="迪迦状态">
            <div class="status-heading">
              <span class="fighter-name" data-hud="hero-name">迪迦奥特曼</span>
              <span class="form-name" data-hud="form">复合型</span>
            </div>
            <div class="meter meter--health"><span data-hud="player-health"></span></div>
            <div class="meter-labels"><span>生命</span><strong data-hud="player-health-text">100</strong></div>
            <div class="meter meter--energy"><span data-hud="player-energy"></span></div>
            <div class="meter-labels"><span>能量</span><strong data-hud="player-energy-text">100</strong></div>
          </section>

          <div class="battle-mark" aria-label="当前波次">
            <span>EPISODE</span><strong data-hud="wave">01</strong>
            <small data-hud="view-mode">第二视角</small>
            <small data-hud="flight-mode">地面</small>
          </div>

          <section class="fighter-status fighter-status--monster" aria-label="怪兽状态">
            <div class="status-heading">
              <span class="monster-count" data-hud="monster-count">1 TARGET</span>
              <span class="fighter-name" data-hud="monster-name">哥尔赞</span>
            </div>
            <div class="meter meter--monster"><span data-hud="monster-health"></span></div>
            <div class="meter-labels"><strong data-hud="monster-health-text">150</strong><span>怪兽生命</span></div>
          </section>
        </header>

        <div class="announcement" role="status" aria-live="polite" data-hud="message"></div>
        <div class="last-stand" data-hud="last-stand" role="status" hidden></div>
        <div class="hero-toolbar"><label>角色 <select data-hero aria-label="切换角色">${Object.entries(HEROES).map(([id,hero])=>`<option value="${id}">${hero.name}</option>`).join('')}</select></label><span data-hud="progression"></span><span data-hud="hero-scene"></span></div>

        <section class="tutorial-panel" data-hud="tutorial" aria-live="polite" hidden>
          <div class="tutorial-label" data-hud="tutorial-label">教学 1 / 4</div>
          <h2 data-hud="tutorial-title">先让迪迦移动起来</h2>
          <p data-hud="tutorial-copy">按住左箭头或右箭头，走近前面的怪兽。</p>
          <div class="tutorial-footer">
            <kbd data-hud="tutorial-key">←  →</kbd>
            <button class="tutorial-skip" type="button" data-command="tutorial-skip">跳过教学</button>
          </div>
        </section>

        <div class="energy-alert" data-hud="energy-alert" role="status" aria-live="polite" hidden>
          <button class="energy-help-command" type="button" data-action="revive">
            <kbd>O</kbd><span data-hud="energy-alert-text">能量很低，使用手电筒补充</span>
          </button>
        </div>

        <div class="light-meter" aria-label="闪耀光能">
          <i data-lucide="sparkles" aria-hidden="true"></i>
          <div class="light-track"><span data-hud="light-meter"></span></div>
          <strong data-hud="light-text">0%</strong>
        </div>

        <section class="forms" aria-label="形态切换">
          ${(['power', 'multi', 'sky', 'small-shining', 'shining'] as TigaForm[])
            .map(
              (form, index) => `
                <button class="form-button" type="button" data-action="form-${form}" aria-pressed="${form === 'multi'}">
                  <kbd>${form==='small-shining'?'0':form==='shining'?'4':index + 1}</kbd><span>${FORM_STATS[form].label}</span>
                </button>`,
            )
            .join('')}
        </section>
        <section class="zero-forms" data-hud="zero-forms" hidden><button data-action="zero-ultimate">赛罗终极铠甲</button><button data-action="zero-shining">赛罗光辉型</button><button data-action="zero-shining-ultimate">赛罗光辉终极铠甲</button></section>
        <section class="illusion-forms" data-hud="illusion-forms" hidden><span>伽马未来幻象</span><button data-action="illusion-core">本体</button><button data-action="illusion-tiga">迪迦</button><button data-action="illusion-dyna">戴拿</button><button data-action="illusion-gaia">盖亚</button></section>

        <p class="move-guide" data-hud="move-hint"></p>
        <section class="action-dock" aria-label="战斗技能">
          <button class="action-button" type="button" data-action="transform"><kbd>9</kbd><span>变身奥特曼</span></button>
          <button class="action-button" type="button" data-action="human-form"><kbd>8</kbd><span>变回人类</span></button>
          <button class="action-button" type="button" data-action="aircraft"><kbd>U</kbd><span>驾驶战机 · 50 HP</span></button>
          ${ABILITY_KEYS.map(
            ({ key, action, label, icon }) => `
              <button class="action-button" type="button" data-action="${action}">
                <kbd>${key}</kbd><i data-lucide="${icon}" aria-hidden="true"></i><span><span data-skill="${action}">${label}</span><small>威力 ${action === 'demogea-finish' ? '★★★★★' : '★'.repeat(MOVE_RANK[action])}</small></span>
              </button>`,
          ).join('')}
        </section>

        <section class="touch-movement" aria-label="移动控制">
          <button type="button" data-hold-action="move-left" aria-label="向左移动"><i data-lucide="chevron-left"></i></button>
          <button type="button" data-hold-action="guard" aria-label="防御"><i data-lucide="shield"></i></button>
          <button type="button" data-hold-action="jump" aria-label="跳跃或飞行上升"><i data-lucide="activity"></i></button>
          <button type="button" data-hold-action="move-right" aria-label="向右移动"><i data-lucide="chevron-right"></i></button>
          <button type="button" data-hold-action="move-forward" aria-label="向前移动">前</button>
          <button type="button" data-hold-action="move-back" aria-label="向后移动">后</button>
          <button type="button" data-action="space-flight" aria-label="起飞">飞</button>
          <button type="button" data-action="submarine" aria-label="进入或离开潜艇">潜艇 · P</button>
          <button type="button" data-action="sea-teleport" aria-label="瞬移到海边">海边 · O</button>
          <button type="button" data-action="glide" data-hud="glide" disabled>滑行</button>
          <button type="button" data-action="flight-explosion">空格＋飞 · 飞行爆炸 ★★★★</button>
          <button type="button" data-hold-action="move-down" aria-label="飞行下降">降</button>
          <button type="button" data-action="explore" aria-label="进入自由探索">探索</button>
          <button type="button" data-action="shrink" aria-label="按 G 缩小">G 缩小</button>
          <button type="button" data-action="enlarge" aria-label="按 H 变大">H 变大</button>
          <button type="button" data-action="cosmos-teleport" aria-label="高斯瞬间移动">Delete 瞬移</button>
          <button type="button" data-hold-action="ultra-explosion" aria-label="长按奥特爆炸，生命0到30点可用">奥特爆炸 ★★★★</button>
        </section>

        <div class="start-screen" data-hud="start-screen">
          <div class="game-title">
            <span>ULTRAMAN TIGA</span>
            <h1>迪迦：光之决战</h1>
            <p>52 集光的故事 · 特别篇 · 第 53 集怪兽总攻</p>
            <label class="hero-picker">出战角色 <select data-hero aria-label="开局选择角色">${Object.entries(HEROES).map(([id,hero])=>`<option value="${id}">${hero.name}</option>`).join('')}</select></label>
            <p>每集 24 分钟 · 胜利队出动 · 四分钟战机驾驶 · 角色语音。</p>
            <p>默认手动战斗，可切换自动。单击空格探索，双击空格变大。</p>
            <p>长按空格：生命 0～30 点释放四星奥特爆炸。零血后还有 30 秒，先击败怪兽就赢！</p>
            <p>战机 50 点生命 · P 跳伞，空中变身解锁滑行 · 0 小闪耀，累计死亡 10 次解锁大闪耀。</p>
            <p>空格＋飞 / B：四星飞行爆炸，20 秒飞出银河系，连续爆炸后俯冲。</p>
            <p>V 深空重砸 ★★★★：飞出太阳系，俯冲回战场重击。</p>
          </div>
          <button class="primary-command" type="button" data-command="start">
            <i data-lucide="play" aria-hidden="true"></i><span>开始第一集</span>
          </button>
        </div>

        <div class="revive-screen" data-hud="revive-screen" hidden>
          <p class="revive-kicker" data-hud="revive-kicker">能量耗尽</p>
          <h2 data-hud="revive-title">迪迦变成了石像</h2>
          <button class="light-command" type="button" data-action="revive">
            <kbd>O</kbd><i data-lucide="sparkles" aria-hidden="true"></i><span data-hud="revive-action">汇聚手电筒之光</span>
          </button>
        </div>

        <button class="mute-command" type="button" data-command="mute" aria-pressed="false" aria-label="静音" hidden>
          <i data-lucide="volume-2" aria-hidden="true"></i>
        </button>

        <button class="restart-command" type="button" data-command="restart" aria-label="重新开始">
          <i data-lucide="rotate-ccw" aria-hidden="true"></i>
        </button>
      </div>`;

    createIcons({
      icons: {
        Activity,
        BicepsFlexed,
        Bolt,
        ChevronLeft,
        ChevronRight,
        Gauge,
        Play,
        RotateCcw,
        Shield,
        Sparkles,
        Swords,
        Volume2,
        VolumeX,
      },
    });
    this.bindControls();
    this.host.querySelector<HTMLButtonElement>('[data-command="start"]')?.focus();
  }

  onAction(handler: (action: GameAction, pressed: boolean) => void) {
    this.actionHandler = handler;
  }
  onHeroChange(handler:(hero:HeroId)=>void){this.heroHandler=handler;}

  onStart(handler: () => void) {
    this.startHandler = handler;
  }

  onTutorialSkip(handler: () => void) {
    this.host.querySelector<HTMLButtonElement>('[data-command="tutorial-skip"]')?.addEventListener('click', handler);
  }

  onToggleMute(handler: (muted: boolean) => void) {
    this.muteHandler = handler;
  }

  render(snapshot: HudSnapshot) {
    const hero=HEROES[snapshot.hero];
    this.setText('hero-name',hero.name);
    this.setText('hero-scene',hero.scene);
    this.setText('progression',`${snapshot.human?'人类':`${snapshot.form==='shining'?'无限时间':`${Math.ceil(snapshot.formSeconds??0)}秒`} · 高跳 ${jumpHeightLabel(snapshot.form)}`} · 累计死亡 ${snapshot.totalDeaths}/10${bigShiningUnlocked(snapshot.totalDeaths)?' · 大闪耀已解锁':''}`);
    this.host.querySelectorAll<HTMLSelectElement>('[data-hero]').forEach(select=>{select.value=snapshot.hero;});
    this.query<HTMLElement>('zero-forms').hidden=snapshot.hero!=='zero';
    this.query<HTMLButtonElement>('glide').disabled=!snapshot.glideUnlocked||snapshot.human;
    this.host.querySelectorAll<HTMLElement>('[data-skill]').forEach(label=>{
      const ability=label.dataset.skill as Ability;
      label.textContent=ability in hero.skills?hero.skills[ability]:snapshot.hero==='tiga'?'体内爆破':`${hero.name}最终爆破`;
      if(snapshot.hero==='zero'&&snapshot.zeroUltimate){
        if(ability==='tiga-slash')label.textContent='究极赛罗之剑';
        if(ability==='zeperion')label.textContent=snapshot.form==='shining'?'光辉究极赛罗射线':'究极赛罗射线';
      }
    });
    const lastStand=this.query<HTMLElement>('last-stand');
    lastStand.hidden=snapshot.lastStandSeconds===null||snapshot.defeatReason!==null;
    if(snapshot.lastStandSeconds!==null)lastStand.textContent=`最后反击 ${snapshot.lastStandSeconds.toFixed(1)} 秒 · 长按空格奥特爆炸 · 先击败怪兽就赢！`;
    this.host.querySelectorAll<HTMLButtonElement>('[data-action="transform"]').forEach(button => { button.hidden = !snapshot.human; });
    this.host.querySelectorAll<HTMLButtonElement>('[data-action="human-form"]').forEach(button => { button.hidden = snapshot.human; });
    this.host.querySelectorAll<HTMLButtonElement>('[data-action="aircraft"]').forEach(button => { button.hidden = !snapshot.human; });
    this.setWidth('player-health', snapshot.playerHealth);
    this.setWidth('player-energy', snapshot.playerEnergy);
    const energyMeter = this.query<HTMLElement>('player-energy').closest('.meter');
    energyMeter?.classList.toggle('energy-warning', snapshot.energyPhase === 'warning');
    energyMeter?.classList.toggle('energy-critical', snapshot.energyPhase === 'critical');
    this.setText('energy-alert-text', snapshot.energyAlert);
    this.setWidth('light-meter', snapshot.lightMeter);
    this.setText('player-health-text', Math.ceil(snapshot.playerHealth));
    this.setText('player-energy-text', Math.ceil(snapshot.playerEnergy));
    this.setText('light-text', `${Math.floor(snapshot.lightMeter)}%`);
    this.setText('form', snapshot.human ? '人类 · 按 9 变身' : heroFormName(snapshot.hero,snapshot.form));
    this.query<HTMLElement>('illusion-forms').hidden=!(snapshot.hero==='zeta'&&snapshot.form==='sky');
    this.setText('monster-name', snapshot.monsterName);
    this.setText('monster-health-text', Math.ceil(snapshot.monsterHealth));
    this.setText('monster-count', `${snapshot.monsterCount} TARGET${snapshot.monsterCount === 1 ? '' : 'S'}`);
    this.setText('wave', snapshot.wave===54?'53':snapshot.wave > 52 ? '特别篇' : `${String(snapshot.wave).padStart(2,'0')}/52`);
    this.setText('move-hint', snapshot.moveHint);
    this.setText('view-mode', snapshot.viewMode === 'first' ? '第一视角' : '第二视角');
    this.setText('flight-mode', snapshot.earthView ? '地球观景' : snapshot.flying ? '空中飞行' : '地面');
    this.setText('message', snapshot.message);
    this.setWidth(
      'monster-health',
      snapshot.monsterMaxHealth > 0 ? (snapshot.monsterHealth / snapshot.monsterMaxHealth) * 100 : 0,
    );

    this.query<HTMLElement>('start-screen').hidden = snapshot.started;
    const tutorial = this.query<HTMLElement>('tutorial');
    tutorial.hidden = !snapshot.started || snapshot.tutorialStage === 'done';
    if (snapshot.tutorialStage !== 'done') {
      const instruction = getTutorialInstruction(snapshot.tutorialStage);
      this.setText('tutorial-label', instruction.label);
      this.setText('tutorial-title', instruction.title);
      this.setText('tutorial-copy', instruction.copy);
      this.setText('tutorial-key', instruction.key);
    }
    const energyAlert = this.query<HTMLElement>('energy-alert');
    energyAlert.hidden =
      !snapshot.started || snapshot.defeatReason !== null || snapshot.energyPhase !== 'critical';
    const energyHelp = energyAlert.querySelector<HTMLButtonElement>('[data-action="revive"]');
    if (energyHelp) {
      energyHelp.disabled =
        !snapshot.started || snapshot.defeatReason !== null || snapshot.recharging;
    }
    const reviveScreen = this.query<HTMLElement>('revive-screen');
    reviveScreen.hidden = snapshot.defeatReason === null;
    if (snapshot.defeatReason) {
      this.setText(
        'revive-kicker',
        snapshot.revivalMethod === 'belief'
          ? '奥特曼石像的信念之光'
          : snapshot.defeatReason === 'exhausted'
            ? '能量耗尽'
            : '生命归零',
      );
      this.setText(
        'revive-title',
        snapshot.revivalMethod === 'belief' ? '让奥特曼石像的光唤醒迪迦' : '迪迦变成了石像',
      );
      this.setText(
        'revive-action',
        snapshot.revivalMethod === 'belief' ? '汇聚奥特曼石像的信念之光' : '汇聚手电筒之光',
      );
      const reviveButton = reviveScreen.querySelector<HTMLButtonElement>('[data-action="revive"]');
      if (reviveButton) reviveButton.disabled = snapshot.reviving;
    }

    this.host.querySelectorAll<HTMLButtonElement>('[data-action^="form-"]').forEach((button) => {
      const form = button.dataset.action?.replace('form-', '') as TigaForm;
      button.setAttribute('aria-pressed', String(form === snapshot.form));
      button.disabled =
        !snapshot.started || snapshot.human ||
        (form === 'shining' && !bigShiningUnlocked(snapshot.totalDeaths));
    });

    this.host.querySelectorAll<HTMLButtonElement>('.action-button').forEach((button) => {
      const action = button.dataset.action as GameAction;
      if (action === 'transform' || action === 'human-form') {
        button.disabled = !snapshot.started || snapshot.defeatReason !== null;
        return;
      }
      const isDemogeaFinisher = action === 'demogea-finish';
      button.disabled =
        !snapshot.started ||
        snapshot.defeatReason !== null ||
        snapshot.recharging ||
        (isDemogeaFinisher
          ? !snapshot.demogeaBattle || !['shining','small-shining'].includes(snapshot.form) || snapshot.playerEnergy <= 1
          : false);
      if(!isDemogeaFinisher) button.title = snapshot.human ? '人类攻击：怪兽最大生命的 1%' :
        `${FORM_STATS[formForAbility(snapshot.form,action as Ability)].label}招式 · 点击自动切换所需形态并施放`;
    });
    const restartButton = this.host.querySelector<HTMLButtonElement>('[data-command="restart"]');
    if (restartButton) restartButton.hidden = !snapshot.started;
    const muteButton = this.host.querySelector<HTMLButtonElement>('[data-command="mute"]');
    if (muteButton) muteButton.hidden = !snapshot.started;
  }

  private bindControls() {
    this.host.querySelectorAll<HTMLSelectElement>('[data-hero]').forEach(select=>select.addEventListener('change',()=>{
      this.heroHandler?.(select.value as HeroId);
      // Return keyboard focus to the game so Delete and the other hotkeys work immediately.
      select.blur();
    }));
    this.host.querySelector<HTMLButtonElement>('[data-command="start"]')?.addEventListener('click', () => {
      this.startHandler?.();
      requestAnimationFrame(() => {
        this.host.querySelector<HTMLButtonElement>('[data-action="form-multi"]')?.focus();
      });
    });
    this.host.querySelector<HTMLButtonElement>('[data-command="restart"]')?.addEventListener('click', () => {
      window.location.reload();
    });
    this.host.querySelector<HTMLButtonElement>('[data-command="mute"]')?.addEventListener('click', () => {
      this.muted = !this.muted;
      this.muteHandler?.(this.muted);
      this.updateMuteButton();
    });
    this.host.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.dataset.action) this.actionHandler?.(button.dataset.action as GameAction, true);
      });
    });
    this.host.querySelectorAll<HTMLButtonElement>('[data-hold-action]').forEach((button) => {
      const action = button.dataset.holdAction as GameAction;
      const release = () => this.actionHandler?.(action, false);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.actionHandler?.(action, true);
      });
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
    });
  }

  private updateMuteButton() {
    const button = this.host.querySelector<HTMLButtonElement>('[data-command="mute"]');
    if (!button) return;
    button.setAttribute('aria-pressed', String(this.muted));
    button.setAttribute('aria-label', this.muted ? '取消静音' : '静音');
    button.innerHTML = `<i data-lucide="${this.muted ? 'volume-x' : 'volume-2'}" aria-hidden="true"></i>`;
    createIcons({ icons: { Volume2, VolumeX } });
  }

  private setText(name: string, value: string | number) {
    this.query<HTMLElement>(name).textContent = String(value);
  }

  private setWidth(name: string, value: number) {
    this.query<HTMLElement>(name).style.width = `${Math.max(0, Math.min(100, value))}%`;
  }

  private query<T extends HTMLElement>(name: string): T {
    const element = this.host.querySelector<T>(`[data-hud="${name}"]`);
    if (!element) throw new Error(`Missing HUD element: ${name}`);
    return element;
  }
}

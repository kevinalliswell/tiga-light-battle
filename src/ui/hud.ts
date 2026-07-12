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
  createIcons,
} from 'lucide';
import {
  FORM_STATS,
  canUseAbility,
  type Ability,
  type DefeatReason,
  type EnergyPhase,
  type RevivalMethod,
  type TigaForm,
} from '../game/rules';
import { getTutorialInstruction, type TutorialStage } from '../game/tutorial';

export type GameAction =
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
  | 'perspective-k'
  | 'perspective-n'
  | 'guard'
  | 'revive'
  | `form-${TigaForm}`;

export type PerspectiveMode = 'first' | 'second';

export interface HudSnapshot {
  started: boolean;
  form: TigaForm;
  playerHealth: number;
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
];

export class Hud {
  private readonly host: HTMLElement;
  private actionHandler: ((action: GameAction, pressed: boolean) => void) | null = null;
  private startHandler: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.host.innerHTML = `
      <div class="hud" aria-label="游戏状态">
        <header class="status-row">
          <section class="fighter-status fighter-status--player" aria-label="迪迦状态">
            <div class="status-heading">
              <span class="fighter-name">迪迦奥特曼</span>
              <span class="form-name" data-hud="form">复合型</span>
            </div>
            <div class="meter meter--health"><span data-hud="player-health"></span></div>
            <div class="meter-labels"><span>生命</span><strong data-hud="player-health-text">100</strong></div>
            <div class="meter meter--energy"><span data-hud="player-energy"></span></div>
            <div class="meter-labels"><span>能量</span><strong data-hud="player-energy-text">100</strong></div>
          </section>

          <div class="battle-mark" aria-label="当前波次">
            <span>WAVE</span><strong data-hud="wave">01</strong>
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
          ${(['power', 'multi', 'sky', 'shining'] as TigaForm[])
            .map(
              (form, index) => `
                <button class="form-button" type="button" data-action="form-${form}" aria-pressed="${form === 'multi'}">
                  <kbd>${index + 1}</kbd><span>${FORM_STATS[form].label}</span>
                </button>`,
            )
            .join('')}
        </section>

        <section class="action-dock" aria-label="战斗技能">
          ${ABILITY_KEYS.map(
            ({ key, action, label, icon }) => `
              <button class="action-button" type="button" data-action="${action}">
                <kbd>${key}</kbd><i data-lucide="${icon}" aria-hidden="true"></i><span>${label}</span>
              </button>`,
          ).join('')}
        </section>

        <section class="touch-movement" aria-label="移动控制">
          <button type="button" data-hold-action="move-left" aria-label="向左移动"><i data-lucide="chevron-left"></i></button>
          <button type="button" data-hold-action="guard" aria-label="防御"><i data-lucide="shield"></i></button>
          <button type="button" data-hold-action="jump" aria-label="连续按三次上键起飞，飞行时按住上键十秒观察地球"><i data-lucide="activity"></i></button>
          <button type="button" data-hold-action="move-right" aria-label="向右移动"><i data-lucide="chevron-right"></i></button>
        </section>

        <div class="start-screen" data-hud="start-screen">
          <div class="game-title">
            <span>ULTRAMAN TIGA</span>
            <h1>迪迦：光之决战</h1>
            <p>城市上空，怪兽反应出现。</p>
          </div>
          <button class="primary-command" type="button" data-command="start">
            <i data-lucide="play" aria-hidden="true"></i><span>进入战场</span>
          </button>
        </div>

        <div class="revive-screen" data-hud="revive-screen" hidden>
          <p class="revive-kicker" data-hud="revive-kicker">能量耗尽</p>
          <h2 data-hud="revive-title">迪迦变成了石像</h2>
          <button class="light-command" type="button" data-action="revive">
            <kbd>O</kbd><i data-lucide="sparkles" aria-hidden="true"></i><span data-hud="revive-action">汇聚手电筒之光</span>
          </button>
        </div>

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
      },
    });
    this.bindControls();
    this.host.querySelector<HTMLButtonElement>('[data-command="start"]')?.focus();
  }

  onAction(handler: (action: GameAction, pressed: boolean) => void) {
    this.actionHandler = handler;
  }

  onStart(handler: () => void) {
    this.startHandler = handler;
  }

  onTutorialSkip(handler: () => void) {
    this.host.querySelector<HTMLButtonElement>('[data-command="tutorial-skip"]')?.addEventListener('click', handler);
  }

  render(snapshot: HudSnapshot) {
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
    this.setText('form', FORM_STATS[snapshot.form].label);
    this.setText('monster-name', snapshot.monsterName);
    this.setText('monster-health-text', Math.ceil(snapshot.monsterHealth));
    this.setText('monster-count', `${snapshot.monsterCount} TARGET${snapshot.monsterCount === 1 ? '' : 'S'}`);
    this.setText('wave', String(snapshot.wave).padStart(2, '0'));
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
        !snapshot.started ||
        (form === 'shining' && (!snapshot.shiningUnlocked || snapshot.lightMeter < 100));
    });

    this.host.querySelectorAll<HTMLButtonElement>('.action-button').forEach((button) => {
      const action = button.dataset.action as GameAction;
      const isDemogeaFinisher = action === 'demogea-finish';
      button.disabled =
        !snapshot.started ||
        snapshot.defeatReason !== null ||
        snapshot.recharging ||
        (isDemogeaFinisher
          ? !snapshot.demogeaBattle || snapshot.form !== 'shining' || snapshot.playerEnergy <= 1
          : !canUseAbility(snapshot.form, action as Ability));
    });
    const restartButton = this.host.querySelector<HTMLButtonElement>('[data-command="restart"]');
    if (restartButton) restartButton.hidden = !snapshot.started;
  }

  private bindControls() {
    this.host.querySelector<HTMLButtonElement>('[data-command="start"]')?.addEventListener('click', () => {
      this.startHandler?.();
      requestAnimationFrame(() => {
        this.host.querySelector<HTMLButtonElement>('[data-action="form-multi"]')?.focus();
      });
    });
    this.host.querySelector<HTMLButtonElement>('[data-command="restart"]')?.addEventListener('click', () => {
      window.location.reload();
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

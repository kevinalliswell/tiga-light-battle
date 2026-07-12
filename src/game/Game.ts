import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameAction, Hud, HudSnapshot } from '../ui/hud';
import { BattleAudio } from './audio';
import { Effects } from './effects';
import {
  DEMOGEA_PROFILE,
  GATANOTHOR_PROFILE,
  MONSTER_PROFILES,
  applyTigaForm,
  createCity,
  createMonster,
  createTiga,
  type MonsterProfile,
} from './models';
import {
  FORM_STATS,
  canEnterFlight,
  canUseFlashlight,
  canTransform,
  canUseAbility,
  getEnergyPhase,
  hasInfiniteEnergy,
  hasInfiniteHealth,
  normalizeEnergy,
  requiresCloseRange,
  resolveDamage,
  resolveDemogeaFinisher,
  resolveRevival,
  type Ability,
  type DamageTarget,
  type DefeatReason,
  type EnergyPhase,
  type RevivalMethod,
  type TigaForm,
} from './rules';
import {
  advanceTutorial,
  getTutorialInstruction,
  type TutorialAction,
  type TutorialStage,
} from './tutorial';

interface MonsterState {
  profile: MonsterProfile;
  object: THREE.Group;
  health: number;
  attackCooldown: number;
  stunned: number;
  knockback: number;
  defeated: boolean;
}

const GATANOTHOR_WAVE = 5;
const DEMOGEA_WAVE = 6;
const FINAL_WAVE = DEMOGEA_WAVE;
const ENERGY_COST: Record<Ability, number> = {
  punch: 0,
  kick: 1,
  boomerang: 5,
  delacium: 18,
  zeperion: 20,
  runboldt: 16,
  'evolution-ray': 28,
  'super-lightning': 35,
};

const KEY_ACTIONS: Record<string, GameAction> = {
  arrowleft: 'move-left',
  arrowright: 'move-right',
  arrowup: 'jump',
  arrowdown: 'guard',
  q: 'punch',
  w: 'kick',
  e: 'boomerang',
  z: 'delacium',
  x: 'zeperion',
  c: 'runboldt',
  d: 'super-lightning',
  '1': 'form-power',
  '2': 'form-multi',
  '3': 'form-sky',
  '4': 'form-shining',
  '5': 'evolution-ray',
  '6': 'demogea-finish',
  o: 'revive',
};

export class TigaGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly ssaoPass: SSAOPass;
  private readonly clock = new THREE.Clock();
  private readonly effects: Effects;
  private readonly hud: Hud;
  private readonly tiga = createTiga();
  private readonly monsters: MonsterState[] = [];
  private readonly heldActions = new Set<GameAction>();
  private readonly originalMaterialState = new Map<
    THREE.Material,
    { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number }
  >();

  private audio: BattleAudio | null = null;
  private started = false;
  private form: TigaForm = 'multi';
  private health = 100;
  private energy = 100;
  private energyPhase: EnergyPhase = 'stable';
  private energyAlert = '能量状态稳定';
  private lightMeter = 0;
  private wave = 1;
  private message = '怪兽反应确认';
  private messageTimer = 0;
  private defeatReason: DefeatReason | null = null;
  private revivalMethod: RevivalMethod | null = null;
  private reviving = false;
  private recharging = false;
  private tutorialStage: TutorialStage = 'move';
  private reviveTimer = 0;
  private attackCooldown = 0;
  private attackPoseTimer = 0;
  private attackPose: Ability | 'demogea-finish' = 'punch';
  private jumpVelocity = 0;
  private jumpHoldTimer = 0;
  private flying = false;
  private shiningUnlocked = false;
  private spawnTimer = 0;
  private victory = false;

  constructor(container: HTMLElement, hud: Hud) {
    this.hud = hud;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.append(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.composer = new EffectComposer(this.renderer);
    this.ssaoPass = new SSAOPass(this.scene, this.camera, 1, 1);
    this.ssaoPass.kernelRadius = 10;
    this.ssaoPass.minDistance = 0.0015;
    this.ssaoPass.maxDistance = 0.12;
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.ssaoPass);
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.38, 0.84),
    );
    this.composer.addPass(new OutputPass());

    this.scene.background = new THREE.Color(0x071019);
    this.scene.fog = new THREE.FogExp2(0x111d25, 0.011);
    this.camera.position.set(0, 11.5, 30);
    this.camera.lookAt(0, 4.2, 0);
    this.setupWorld();
    this.effects = new Effects(this.scene);
    this.spawnWave();
    this.bindInput();
    this.hud.onStart(() => this.start());
    this.hud.onTutorialSkip(() => this.skipTutorial());
    this.hud.onAction((action, pressed) => this.handleAction(action, pressed));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.updateHud();
    this.animate();
  }

  private setupWorld() {
    this.createAtmosphere();
    const hemisphere = new THREE.HemisphereLight(0x9ecfe4, 0x111315, 1.3);
    this.scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xf4f7ef, 3.2);
    keyLight.position.set(-12, 24, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -30;
    keyLight.shadow.camera.right = 30;
    keyLight.shadow.camera.top = 25;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias = -0.00035;
    keyLight.shadow.normalBias = 0.035;
    this.scene.add(keyLight);

    const moonLight = new THREE.DirectionalLight(0x7895c5, 1.25);
    moonLight.position.set(16, 20, -24);
    moonLight.target.position.set(0, 3, 0);
    this.scene.add(moonLight, moonLight.target);

    const cityGlow = new THREE.PointLight(0x42bdd6, 34, 38, 1.7);
    cityGlow.position.set(-13, 8, 8);
    const dangerGlow = new THREE.PointLight(0xd84b3d, 32, 34, 1.8);
    dangerGlow.position.set(14, 7, 5);
    const rimLight = new THREE.DirectionalLight(0x8bdfff, 2.2);
    rimLight.position.set(4, 9, -18);
    this.scene.add(cityGlow, dangerGlow, rimLight, createCity());

    this.tiga.position.set(-9, 0, 0);
    this.tiga.rotation.y = Math.PI * 0.36;
    this.scene.add(this.tiga);
  }

  private createAtmosphere() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(110, 32, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x07111d) },
          horizonColor: { value: new THREE.Color(0x26343c) },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          varying vec3 vWorldPosition;
          void main() {
            float height = normalize(vWorldPosition).y;
            float mixValue = smoothstep(-0.08, 0.68, height);
            gl_FragColor = vec4(mix(horizonColor, topColor, mixValue), 1.0);
          }
        `,
      }),
    );
    this.scene.add(sky);

    const starPositions: number[] = [];
    for (let index = 0; index < 450; index += 1) {
      const seed = Math.sin(index * 91.731) * 43758.5453;
      const angle = (seed - Math.floor(seed)) * Math.PI * 2;
      const height = 18 + ((seed * 17.3) % 1 + 1) % 1 * 54;
      const radius = 78 + (((seed * 7.1) % 1 + 1) % 1) * 18;
      starPositions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0xc5e3ed, size: 0.16, transparent: true, opacity: 0.72 }),
    );
    this.scene.add(stars);
  }

  private start() {
    if (this.started) return;
    this.started = true;
    this.tutorialStage = 'move';
    this.audio = new BattleAudio();
    this.audio.start();
    this.audio.play('start');
    this.setMessage('教学开始：先按住 ← 或 → 让迪迦移动', 3.2);
    this.tone(220, 0.12, 'sawtooth');
    this.tone(440, 0.18, 'triangle', 0.1);
    this.updateHud();
  }

  private bindInput() {
    window.addEventListener('keydown', (event) => {
      const action = KEY_ACTIONS[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      if (event.repeat && !action.startsWith('move-') && action !== 'guard') return;
      this.handleAction(action, true);
    });
    window.addEventListener('keyup', (event) => {
      const action = KEY_ACTIONS[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      this.handleAction(action, false);
    });
    window.addEventListener('blur', () => this.heldActions.clear());
  }

  private handleAction(action: GameAction, pressed: boolean) {
    if (action === 'move-left' || action === 'move-right' || action === 'guard' || action === 'jump') {
      if (pressed) this.heldActions.add(action);
      else this.heldActions.delete(action);
      if (action === 'jump' && pressed) {
        if (this.flying) {
          this.flying = false;
          this.jumpHoldTimer = 0;
          this.jumpVelocity = -1.5;
          this.setMessage('迪迦返回地面', 1.2);
        } else {
          this.jumpHoldTimer = 0;
        }
      }
      if (action === 'jump' && !pressed && !this.flying && this.jumpHoldTimer < 3 && this.tiga.position.y <= 0.01) {
        this.jumpVelocity = 8.2;
      }
      if (pressed && (action === 'move-left' || action === 'move-right')) {
        this.completeTutorialAction('move');
      }
      return;
    }
    if (!pressed || !this.started) return;
    if (action === 'revive') {
      if (this.defeatReason) this.beginRevival();
      else this.beginFlashlightRecharge();
      return;
    }
    if (action.startsWith('form-')) {
      this.changeForm(action.replace('form-', '') as TigaForm);
      return;
    }
    if (action === 'demogea-finish') {
      this.demogeaFinisher();
      return;
    }
    this.attack(action as Ability);
  }

  private changeForm(nextForm: TigaForm) {
    if (this.defeatReason || this.victory || nextForm === this.form) return;
    if (nextForm === 'shining' && !this.shiningUnlocked) {
      this.setMessage('只有被加坦杰厄击败并接受信念之光后，才能变成闪耀型', 2.2);
      this.tone(90, 0.12, 'square');
      return;
    }
    if (!canTransform(nextForm, this.lightMeter, this.shiningUnlocked)) {
      this.setMessage('闪耀光能还没有集满', 1.4);
      this.tone(90, 0.12, 'square');
      return;
    }
    if (nextForm === 'shining') {
      this.lightMeter = 0;
      this.health = 100;
      this.energy = 100;
      this.energyPhase = 'stable';
      this.energyAlert = '闪耀型能量已充满，不会消耗';
      this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0, 4.6, 0)), 0xffd866, 4.2);
      this.audio?.play('transform');
      this.tone(640, 0.36, 'sine');
    }
    this.setForm(nextForm);
    this.setMessage(`切换为${FORM_STATS[nextForm].label}`, 1.2);
    if (nextForm === 'power') this.completeTutorialAction('form');
  }

  private setForm(nextForm: TigaForm) {
    this.form = nextForm;
    applyTigaForm(this.tiga, nextForm);
    const scale = nextForm === 'power' ? [1.03, 0.92, 0.98] : nextForm === 'sky' ? [0.84, 0.96, 0.86] : [0.92, 0.94, 0.92];
    this.tiga.scale.set(scale[0], scale[1], scale[2]);
  }

  private attack(ability: Ability) {
    if (this.defeatReason || this.victory || this.attackCooldown > 0) return;
    if (!canUseAbility(this.form, ability)) {
      this.setMessage(`${FORM_STATS[this.form].label}无法使用这个技能`, 1.25);
      this.tone(105, 0.1, 'square');
      return;
    }
    const cost = hasInfiniteEnergy(this.form) ? 0 : ENERGY_COST[ability];
    if (this.energy <= cost) {
      this.setMessage('能量不足', 1.2);
      return;
    }
    const targets = ability === 'super-lightning' ? this.livingMonsters() : [this.nearestMonster()].filter(Boolean) as MonsterState[];
    if (targets.length === 0) return;
    const nearest = targets[0];
    const distance = Math.abs(nearest.object.position.x - this.tiga.position.x);
    if (requiresCloseRange(ability) && distance > 4.7) {
      this.setMessage('距离太远', 0.8);
      return;
    }

    this.energy = normalizeEnergy(this.form, this.energy - cost);
    this.attackCooldown = ability === 'punch' ? 0.34 : ability === 'kick' ? 0.72 : 0.82;
    this.attackPoseTimer = this.attackCooldown;
    this.attackPose = ability;
    this.audio?.play(ability);
    const start = this.tiga.position.clone().add(new THREE.Vector3(1.25, 5.1, 0));

    targets.forEach((target) => {
      const end = target.object.position.clone().add(new THREE.Vector3(0, 4.8, 0));
      this.playAbilityEffect(ability, start, end);
      const targetKind: DamageTarget =
        target.profile.id === 'gatanothor'
          ? 'gatanothor'
          : target.profile.id === 'demogea'
            ? 'demogea'
            : 'ordinary';
      const damage = resolveDamage(this.form, ability, targetKind);
      if (damage === 0) {
        this.effects.shield(end);
        this.audio?.play('shield');
        this.setMessage(
          target.profile.id === 'demogea'
            ? '迪莫杰厄的防御挡住了所有攻击，只有 6 键体内爆破有效'
            : '攻击无效！加坦杰厄的防御无法被打破',
          1.8,
        );
        this.tone(80, 0.22, 'square');
        return;
      }
      target.health = Math.max(0, target.health - damage);
      target.knockback = Math.min(5, damage * 0.055);
      if (ability === 'boomerang') target.stunned = 1.4;
      if (target.profile.id !== 'gatanothor') {
        this.lightMeter = Math.min(100, this.lightMeter + damage * 0.11);
      }
      if (ability === 'punch' || ability === 'kick') this.completeTutorialAction('attack');
      if (ability === 'delacium') this.completeTutorialAction('light');
      this.audio?.play('monster-hit');
      if (target.health <= 0) this.defeatMonster(target);
    });
    this.updateHud();
  }

  private demogeaFinisher() {
    if (this.defeatReason || this.victory || this.attackCooldown > 0) return;
    const target = this.nearestMonster();
    if (!target || target.profile.id !== 'demogea') {
      this.setMessage('迪莫杰厄还没有出现，6键暂时无法使用', 1.5);
      return;
    }
    if (this.form !== 'shining') {
      this.setMessage('只有闪耀型才能穿入迪莫杰厄，先按 4 变身', 1.6);
      return;
    }
    const resolution = resolveDemogeaFinisher(this.form, 'demogea', this.energy);
    if (!resolution.canUse) {
      this.setMessage('体内爆破至少需要 2 点能量', 1.4);
      return;
    }

    this.energy = normalizeEnergy(this.form, resolution.remainingEnergy);
    this.energyPhase = getEnergyPhase(this.energy);
    this.energyAlert = '闪耀型能量保持充满，体内爆破完成';
    this.attackCooldown = 1.2;
    this.attackPoseTimer = this.attackCooldown;
    this.attackPose = 'demogea-finish';
    this.audio?.play('demogea-burst');
    const start = this.tiga.position.clone().add(new THREE.Vector3(1.25, 5.1, 0));
    const end = target.object.position.clone().add(new THREE.Vector3(0, 4.8, 0));
    this.effects.demogeaBurst(start, end);
    target.health = 0;
    target.knockback = 5;
    this.tone(920, 0.22, 'sawtooth');
    this.defeatMonster(target);
    this.updateHud();
  }

  private playAbilityEffect(ability: Ability, start: THREE.Vector3, end: THREE.Vector3) {
    if (ability === 'punch') {
      this.effects.impact(end, ability === 'punch' ? 0x9cefff : 0xffd36d, 1.15);
      return;
    }
    if (ability === 'kick') {
      this.effects.flyingKick(start, end);
      return;
    }
    if (ability === 'boomerang') {
      this.effects.boomerang(start, end);
      return;
    }
    if (ability === 'super-lightning') {
      this.effects.lightning(start.clone().add(new THREE.Vector3(0, 3, 0)), end);
      return;
    }
    if (ability === 'evolution-ray') {
      this.effects.beam(start, end, 0xffd866, 0.42);
      this.effects.impact(end, 0xffef9a, 2.5);
      return;
    }
    const colors: Record<'delacium' | 'zeperion' | 'runboldt', number> = {
      delacium: 0xff6d35,
      zeperion: 0xe9fbff,
      runboldt: 0x79a9ff,
    };
    this.effects.beam(start, end, colors[ability as keyof typeof colors], ability === 'zeperion' ? 0.28 : 0.22);
  }

  private defeatMonster(monster: MonsterState) {
    if (monster.defeated) return;
    monster.defeated = true;
    monster.stunned = 99;
    this.audio?.play(monster.profile.id === 'demogea' ? 'explosion' : 'defeat');
    this.effects.impact(monster.object.position.clone().add(new THREE.Vector3(0, 4, 0)), 0xff784c, 3.5);
    if (monster.profile.id === 'gatanothor') {
      this.spawnTimer = 2.8;
      this.setMessage('加坦杰厄倒下，黑暗后方的迪莫杰厄苏醒！', 3.2);
      this.tone(520, 0.3, 'triangle');
      this.tone(380, 0.42, 'sine', 0.22);
      return;
    }
    if (monster.profile.id === 'demogea') {
      this.victory = true;
      this.setMessage('迪迦穿过迪莫杰厄的身体，体内爆破成功！', 999);
      this.tone(780, 0.42, 'sine');
      this.tone(1040, 0.52, 'triangle', 0.18);
      return;
    }
    this.lightMeter = Math.min(100, this.lightMeter + 25);
    if (this.livingMonsters().length === 0) {
      this.spawnTimer = 2.4;
      this.setMessage(`${monster.profile.name}被击败，光能正在汇聚`, 2);
    }
  }

  private spawnWave() {
    this.monsters.splice(0).forEach((monster) => this.scene.remove(monster.object));
    const isGatanothor = this.wave === GATANOTHOR_WAVE;
    const isDemogea = this.wave === DEMOGEA_WAVE;
    const isBossWave = isGatanothor || isDemogea;
    const profile = isGatanothor
      ? GATANOTHOR_PROFILE
      : isDemogea
        ? DEMOGEA_PROFILE
        : MONSTER_PROFILES[Math.floor(Math.random() * MONSTER_PROFILES.length)];
    const count = isBossWave ? 1 : this.wave === 3 ? 2 : this.wave === 4 && Math.random() > 0.45 ? 3 : 1;
    for (let index = 0; index < count; index += 1) {
      const object = createMonster(profile);
      object.position.set(9 + index * 2.2, 0, (index - (count - 1) / 2) * 2.1);
      object.rotation.y = -Math.PI * 0.36;
      this.scene.add(object);
      this.monsters.push({
        profile,
        object,
        health: profile.maxHealth,
        attackCooldown: 1 + index * 0.35,
        stunned: 0,
        knockback: 0,
        defeated: false,
      });
    }
    if (isGatanothor) {
      this.lightMeter = 100;
      this.scene.background = new THREE.Color(0x050608);
      this.scene.fog = new THREE.FogExp2(0x080a0d, 0.026);
      this.setMessage('最终决战：哉佩利敖光线和闪耀型超级时空闪电能够击穿防御', 4.5);
    } else if (isDemogea) {
      this.lightMeter = 100;
      this.scene.background = new THREE.Color(0x160810);
      this.scene.fog = new THREE.FogExp2(0x1d0a16, 0.024);
      this.setMessage('第二场最终决战：按 6 穿梭迪莫杰厄体内并引爆', 4.5);
    } else if (count > 1) {
      this.setMessage(`${profile.name}发生克隆：${count}只怪兽同时出现`, 2.6);
    } else {
      this.setMessage(`第 ${this.wave} 波：${profile.name}出现`, 2.2);
    }
  }

  private update(delta: number) {
    this.effects.update(delta);
    this.animateCharacters(delta);
    if (!this.started || this.victory) return;
    if (this.messageTimer > 0) this.messageTimer -= delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.attackPoseTimer > 0) this.attackPoseTimer -= delta;

    if (this.defeatReason) {
      if (this.reviving) {
        this.reviveTimer -= delta;
        if (this.reviveTimer <= 0) this.finishRevival();
      }
      return;
    }

    if (this.recharging) {
      this.reviveTimer -= delta;
      if (this.reviveTimer <= 0) this.finishFlashlightRecharge();
      return;
    }

    this.updatePlayer(delta);
    if (this.tutorialStage !== 'done') return;
    this.updateMonsters(delta);
    const energyDrain = hasInfiniteEnergy(this.form) ? 0 : delta * 0.24;
    this.energy = normalizeEnergy(this.form, this.energy - energyDrain);
    if (hasInfiniteEnergy(this.form)) this.energyPhase = 'stable';
    this.updateEnergyPhase();
    if (this.health <= 0) this.turnToStone('defeated');
    else if (this.energy <= 0 && !this.isGatanothorBattle()) this.turnToStone('exhausted');

    if (this.spawnTimer > 0) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.wave = Math.min(FINAL_WAVE, this.wave + 1);
        this.spawnWave();
      }
    }
  }

  private updatePlayer(delta: number) {
    const direction = Number(this.heldActions.has('move-right')) - Number(this.heldActions.has('move-left'));
    const speed = 5.2 * FORM_STATS[this.form].speed;
    this.tiga.position.x = THREE.MathUtils.clamp(this.tiga.position.x + direction * speed * delta, -18, 17);
    if (this.flying) {
      this.tiga.position.y = THREE.MathUtils.lerp(
        this.tiga.position.y,
        9.1 + Math.sin(performance.now() * 0.002) * 0.35,
        delta * 3.2,
      );
      return;
    }
    if (this.started && this.tutorialStage === 'done' && this.heldActions.has('jump')) {
      this.jumpHoldTimer += delta;
      if (canEnterFlight(this.jumpHoldTimer)) this.enterFlightMode();
    }
    if (this.tiga.position.y > 0 || this.jumpVelocity > 0) {
      this.tiga.position.y += this.jumpVelocity * delta;
      this.jumpVelocity -= 20 * delta;
      if (this.tiga.position.y <= 0) {
        this.tiga.position.y = 0;
        this.jumpVelocity = 0;
      }
    }
  }

  private enterFlightMode() {
    if (this.flying || this.defeatReason) return;
    this.flying = true;
    this.jumpHoldTimer = 3;
    this.jumpVelocity = 0;
    this.tiga.position.y = Math.max(this.tiga.position.y, 6.2);
    this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0, 4.5, 0)), 0x8feaff, 2.2);
    this.audio?.play('transform');
    this.setMessage('空战开始：城市缩小，按 Q/W/Z/X/C/D 发起空中攻击', 2.6);
  }

  private updateMonsters(delta: number) {
    for (const monster of this.monsters) {
      if (monster.defeated) {
        monster.object.rotation.z = THREE.MathUtils.lerp(monster.object.rotation.z, -1.38, delta * 2.2);
        monster.object.position.y = Math.max(-1.5, monster.object.position.y - delta * 0.7);
        continue;
      }
      if (monster.stunned > 0) {
        monster.stunned -= delta;
        monster.object.rotation.z = Math.sin(performance.now() * 0.025) * 0.08;
        continue;
      }
      if (this.flying && !monster.profile.canFly && !monster.profile.rangedAttack) continue;
      monster.object.rotation.z = THREE.MathUtils.lerp(monster.object.rotation.z, 0, delta * 5);
      monster.attackCooldown -= delta;
      if (monster.knockback > 0) {
        monster.object.position.x += monster.knockback * delta;
        monster.knockback = Math.max(0, monster.knockback - delta * 8);
      }
      const distance = monster.object.position.x - this.tiga.position.x;
      const horizontalDistance = Math.abs(distance);
      const inRange = monster.profile.rangedAttack
        ? horizontalDistance <= monster.profile.attackRange
        : distance <= monster.profile.attackRange;
      if (!inRange) {
        monster.object.position.x -= monster.profile.speed * delta;
      } else if (monster.attackCooldown <= 0) {
        const guarding = this.heldActions.has('guard');
        const damage = monster.profile.power * (guarding ? 0.28 : 1);
        const invulnerable = hasInfiniteHealth(this.form);
        if (!invulnerable) this.health = Math.max(0, this.health - damage);
        monster.attackCooldown = monster.profile.id === 'melba' ? 1.05 : 1.55;
        const hitPosition = this.tiga.position.clone().add(new THREE.Vector3(0, 4.5, 0));
        if (monster.profile.rangedAttack) {
          const beamStart = monster.object.position.clone().add(new THREE.Vector3(0, 5.4, 0));
          this.effects.beam(beamStart, hitPosition, 0xc95edb, 0.26);
        }
        this.effects.impact(hitPosition, invulnerable ? 0xffd866 : 0xff5d42, 1.15);
        this.audio?.play('monster-attack');
        if (invulnerable) {
          this.effects.shield(hitPosition);
          this.audio?.play('shield');
          this.setMessage('闪耀型光之铠甲挡住攻击，生命不会下降', 0.95);
        } else {
          this.setMessage(guarding ? '防御成功，伤害降低' : `${monster.profile.name}发动攻击`, 0.85);
        }
      }
      monster.object.position.x = THREE.MathUtils.clamp(monster.object.position.x, -15, 20);
    }
  }

  private animateCharacters(delta: number) {
    const time = performance.now() * 0.001;
    if (!this.defeatReason) {
      const idle = Math.sin(time * 2.4) * 0.035;
      this.tiga.rotation.z = idle;
      const rightArm = this.tiga.getObjectByName('right-arm');
      const leftArm = this.tiga.getObjectByName('left-arm');
      const rightHand = this.tiga.getObjectByName('right-hand');
      const leftHand = this.tiga.getObjectByName('left-hand');
      const rightLeg = this.tiga.getObjectByName('right-leg');
      const leftLeg = this.tiga.getObjectByName('left-leg');
      const poseProgress = this.attackPoseTimer > 0
        ? Math.sin((this.attackPoseTimer / Math.max(0.01, this.attackCooldown)) * Math.PI)
        : 0;
      const isKick = this.attackPose === 'kick';
      const isPunch = this.attackPose === 'punch';
      if (rightArm && leftArm) {
        const rightArmTarget = isKick ? -0.26 * poseProgress : isPunch ? -1.3 * poseProgress : 0;
        const leftArmTarget = isKick ? 0.45 * poseProgress : this.attackPose.includes('lightning') ? -1.1 * poseProgress : 0;
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, rightArmTarget, delta * 18);
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, leftArmTarget, delta * 18);
        rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, isKick ? -0.18 * poseProgress : 0, delta * 18);
        leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, isKick ? 0.22 * poseProgress : 0, delta * 18);
      }
      if (rightHand && leftHand) {
        rightHand.rotation.z = THREE.MathUtils.lerp(rightHand.rotation.z, isPunch ? -0.24 * poseProgress : isKick ? -0.08 * poseProgress : 0, delta * 20);
        leftHand.rotation.z = THREE.MathUtils.lerp(leftHand.rotation.z, isKick ? 0.16 * poseProgress : 0, delta * 20);
        rightHand.scale.x = THREE.MathUtils.lerp(rightHand.scale.x, 0.82 * (1 + (isPunch ? 0.14 : 0)), delta * 20);
        leftHand.scale.x = THREE.MathUtils.lerp(leftHand.scale.x, 0.82 * (isKick ? 1.06 : 1), delta * 20);
      }
      if (rightLeg && leftLeg) {
        rightLeg.rotation.z = THREE.MathUtils.lerp(rightLeg.rotation.z, isKick ? -1.02 * poseProgress : 0, delta * 16);
        leftLeg.rotation.z = THREE.MathUtils.lerp(leftLeg.rotation.z, isKick ? 0.18 * poseProgress : 0, delta * 16);
        rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, isKick ? -0.16 * poseProgress : 0, delta * 16);
        leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, isKick ? 0.08 * poseProgress : 0, delta * 16);
      }
      this.tiga.rotation.x = THREE.MathUtils.lerp(
        this.tiga.rotation.x,
        isKick ? -0.16 * poseProgress : isPunch ? 0.06 * poseProgress : this.flying ? -0.28 : 0,
        delta * 14,
      );
    }
    this.monsters.forEach((monster, monsterIndex) => {
      if (!monster.defeated) {
        if (this.flying && monster.profile.canFly) {
          monster.object.position.y = THREE.MathUtils.lerp(
            monster.object.position.y,
            this.tiga.position.y - 0.8 + Math.sin(time * 2.8 + monsterIndex) * 0.35,
            delta * 2.4,
          );
        } else if (!this.flying) {
          monster.object.position.y = monster.profile.id === 'melba'
            ? 1.2 + Math.sin(time * 3 + monsterIndex) * 0.45
            : Math.sin(time * 2 + monsterIndex) * 0.04;
        }
        monster.object.children.forEach((child) => {
          if (child.name.startsWith('tentacle-')) child.rotation.z += Math.sin(time * 1.7 + monsterIndex) * delta * 0.08;
        });
      }
    });
    const timer = this.tiga.getObjectByName('color-timer');
    if (timer instanceof THREE.Mesh && !this.defeatReason) {
      const timerMaterial = timer.material as THREE.MeshStandardMaterial;
      const lowEnergy = this.energy < 25;
      timerMaterial.color.setHex(lowEnergy ? 0xff4238 : 0x8ff5ff);
      timerMaterial.emissive.setHex(lowEnergy ? 0xe11812 : 0x2bbfd6);
      timerMaterial.emissiveIntensity = lowEnergy ? 2 + Math.sin(time * 12) * 1.6 : 4;
    }
  }

  private completeTutorialAction(action: TutorialAction) {
    if (!this.started || this.tutorialStage === 'done') return;
    const nextStage = advanceTutorial(this.tutorialStage, action);
    if (nextStage === this.tutorialStage) return;
    this.tutorialStage = nextStage;
    if (nextStage === 'done') {
      this.setMessage(`教学完成，第 ${this.wave} 波：${this.currentMonsterName()}出现`, 2.8);
    } else {
      this.setMessage(getTutorialInstruction(nextStage).title, 1.8);
    }
  }

  private skipTutorial() {
    if (!this.started || this.tutorialStage === 'done') return;
    this.tutorialStage = 'done';
    this.setMessage(`教学已跳过，第 ${this.wave} 波：${this.currentMonsterName()}出现`, 2.4);
  }

  private updateEnergyPhase() {
    const nextPhase = getEnergyPhase(this.energy);
    if (nextPhase === this.energyPhase) return;
    this.energyPhase = nextPhase;
    if (nextPhase === 'warning') {
      this.energyAlert = '能量降到一半，计时器开始闪红';
      this.setMessage('能量降到一半，计时器开始闪红', 2.2);
    } else if (nextPhase === 'critical') {
      if (this.isGatanothorBattle()) {
        this.energyAlert = '加坦杰厄的黑暗会让手电筒失效';
        this.setMessage('手电筒对加坦杰厄无效，坚持到生命值归零', 2.8);
      } else {
        this.energyAlert = '能量很低，按 O 让人们用手电筒补充';
        this.setMessage('能量很低，按 O 使用手电筒补充', 2.8);
      }
    } else {
      this.energyAlert = '能量状态稳定';
    }
  }

  private isGatanothorBattle() {
    return this.livingMonsters().some((monster) => monster.profile.id === 'gatanothor');
  }

  private isDemogeaBattle() {
    return this.livingMonsters().some((monster) => monster.profile.id === 'demogea');
  }

  private turnToStone(reason: DefeatReason) {
    if (this.defeatReason) return;
    this.defeatReason = reason;
    this.revivalMethod = this.isGatanothorBattle() ? 'belief' : 'flashlight';
    this.health = reason === 'defeated' ? 0 : this.health;
    this.energy = normalizeEnergy(this.form, 0);
    this.energyPhase = 'critical';
    this.heldActions.clear();
    this.setStatueMaterial(true);
    this.setMessage(
      this.revivalMethod === 'belief' ? '加坦杰厄击碎了迪迦，奥特曼石像等待信念之光' : '迪迦变成了石像',
      999,
    );
    this.tone(55, 0.7, 'sawtooth');
    this.audio?.play('stone');
    this.updateHud();
  }

  private beginRevival() {
    if (!this.defeatReason || this.reviving || !this.revivalMethod) return;
    this.reviving = true;
    this.reviveTimer = 2.4;
    const target = this.tiga.position.clone().add(new THREE.Vector3(0, 4.5, 0));
    this.effects.revival(target, this.revivalMethod === 'belief' ? 'statues' : 'people');
    this.setMessage(
      this.revivalMethod === 'belief' ? '奥特曼石像的信念之光正在汇入迪迦' : '画面中的人们打开了手电筒',
      2.4,
    );
    this.tone(320, 1.6, 'sine');
    this.audio?.play('revive');
    this.updateHud();
  }

  private finishRevival() {
    if (!this.defeatReason || !this.revivalMethod) return;
    const revival = resolveRevival(this.revivalMethod);
    const usedBelief = this.revivalMethod === 'belief';
    if (usedBelief) this.shiningUnlocked = true;
    this.setStatueMaterial(false);
    this.setForm(revival.form);
    this.health = revival.healthRatio * 100;
    this.energy = normalizeEnergy(this.form, revival.energyRatio * 100);
    this.energyPhase = 'stable';
    this.energyAlert = '能量状态稳定';
    this.defeatReason = null;
    this.revivalMethod = null;
    this.reviving = false;
    this.setMessage(usedBelief ? '奥特曼石像的信念之光让闪耀迪迦复活！' : '手电筒之光补充了迪迦的能量', 2.5);
    this.tone(720, 0.5, 'sine');
  }

  private beginFlashlightRecharge() {
    if (this.energyPhase !== 'critical' || this.recharging) return;
    if (!canUseFlashlight(this.isGatanothorBattle() ? 'gatanothor' : 'ordinary')) {
      this.setMessage('加坦杰厄的黑暗让手电筒失效', 2.1);
      this.tone(80, 0.18, 'square');
      return;
    }
    this.recharging = true;
    this.reviveTimer = 1.3;
    const target = this.tiga.position.clone().add(new THREE.Vector3(0, 4.5, 0));
    this.effects.revival(target, 'people');
    this.setMessage('人们打开手电筒，为迪迦补充能量', 1.5);
    this.tone(320, 1, 'sine');
    this.audio?.play('flashlight');
  }

  private finishFlashlightRecharge() {
    this.recharging = false;
    this.energy = normalizeEnergy(this.form, 65);
    this.energyPhase = 'warning';
    this.energyAlert = '能量已补充，继续战斗';
    this.setMessage('手电筒之光补充完成，继续战斗！', 2.2);
    this.tone(520, 0.35, 'sine');
  }

  private setStatueMaterial(stone: boolean) {
    this.tiga.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((item) => {
        const standard = item as THREE.MeshStandardMaterial;
        if (stone) {
          if (!this.originalMaterialState.has(item)) {
            this.originalMaterialState.set(item, {
              color: standard.color?.clone(),
              emissive: standard.emissive?.clone(),
              emissiveIntensity: standard.emissiveIntensity,
            });
          }
          standard.color?.setHex(0x777b7d);
          standard.emissive?.setHex(0x000000);
          standard.emissiveIntensity = 0;
        } else {
          const original = this.originalMaterialState.get(item);
          if (original?.color) standard.color.copy(original.color);
          if (original?.emissive) standard.emissive.copy(original.emissive);
          if (original?.emissiveIntensity !== undefined) standard.emissiveIntensity = original.emissiveIntensity;
        }
      });
    });
  }

  private nearestMonster(): MonsterState | undefined {
    return this.livingMonsters().sort(
      (first, second) =>
        Math.abs(first.object.position.x - this.tiga.position.x) -
        Math.abs(second.object.position.x - this.tiga.position.x),
    )[0];
  }

  private livingMonsters() {
    return this.monsters.filter((monster) => !monster.defeated);
  }

  private currentMonsterName() {
    const living = this.livingMonsters();
    if (living.length === 0) return '目标清除';
    return living.length > 1 ? `${living[0].profile.name} × ${living.length}` : living[0].profile.name;
  }

  private setMessage(message: string, duration: number) {
    this.message = message;
    this.messageTimer = duration;
  }

  private updateHud() {
    const living = this.livingMonsters();
    const monsterHealth = living.reduce((total, monster) => total + monster.health, 0);
    const monsterMaxHealth = living.reduce((total, monster) => total + monster.profile.maxHealth, 0);
    const snapshot: HudSnapshot = {
      started: this.started,
      form: this.form,
      playerHealth: this.health,
      playerEnergy: this.energy,
      energyPhase: this.energyPhase,
      energyAlert: this.energyAlert,
      lightMeter: this.lightMeter,
      monsterName: this.currentMonsterName(),
      monsterHealth,
      monsterMaxHealth,
      monsterCount: living.length,
      demogeaBattle: this.isDemogeaBattle(),
      wave: this.wave,
      message: this.messageTimer > 0 ? this.message : '',
      defeatReason: this.defeatReason,
      revivalMethod: this.revivalMethod,
      reviving: this.reviving,
      recharging: this.recharging,
      tutorialStage: this.tutorialStage,
    };
    this.hud.render(snapshot);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, delay = 0) {
    this.audio?.tone(frequency, duration, type, delay);
  }

  private resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, width <= 760 ? 1.25 : 1.6);
    this.renderer.setPixelRatio(pixelRatio);
    this.composer.setPixelRatio(pixelRatio);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.position.z = this.camera.aspect < 0.65 ? 58 : this.camera.aspect < 0.9 ? 44 : 30;
    this.camera.position.y = this.camera.aspect < 0.65 ? 15 : this.camera.aspect < 0.9 ? 13 : 11.5;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.04, this.clock.getDelta());
    this.update(delta);
    const targetX = THREE.MathUtils.clamp(
      (this.tiga.position.x + (this.nearestMonster()?.object.position.x ?? 8)) * 0.5,
      -4,
      5,
    );
    const restCameraZ = this.camera.aspect < 0.65 ? 58 : this.camera.aspect < 0.9 ? 44 : 30;
    const restCameraY = this.camera.aspect < 0.65 ? 15 : this.camera.aspect < 0.9 ? 13 : 11.5;
    const cameraScale = this.flying ? 1.46 : 1;
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, restCameraZ * cameraScale, delta * 2.4);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, restCameraY + (this.flying ? 5.2 : 0), delta * 2.4);
    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetX, delta * 1.4);
    this.camera.lookAt(targetX, this.flying ? 7.5 : 4.15, 0);
    this.updateHud();
    this.composer.render();
  };
}

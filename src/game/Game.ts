import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GameAction, Hud, HudSnapshot, PerspectiveMode } from '../ui/hud';
import { BattleAudio } from './audio';
import { disposeObject } from './disposal';
import { Effects } from './effects';
import { LEVELS, canHumanClimb, humanAttackDamage } from './campaign';
import { EPISODES, episodeAt, shiningDeathThreshold, RAY_CHARGE_SECONDS, RAY_POSE_SECONDS, rayPhase } from './episodes';
import { StoryScreen, type StoryMode } from '../ui/story';
import { animateRayPose } from './rayPose';
import { canFireStoryRay, ESCAPE_SECONDS, shouldRescueWithLight, skipReturnEpisode, MOVE_NAMES, storyMoveDamage } from './storyRules';
import { createLevelBackground } from './levelBackground';
import { ExplorationWorld, groundDistance, flightSpeed, altitudeLabel } from './exploration';
import { INTRO_SECONDS, OUTRO_SECONDS, TRANSFORM_SECONDS, episodeScene, remainingOutro, formatTime, canUltraExplode, giantSize, SpaceGesture } from './episodeTimeline';
import { VictoryFlight, pilotActionsForKey } from './victoryFlight';
import { LastStand } from './lastStand';
import { DeepSpaceSlam, slamPhase } from './deepSpaceSlam';
import { HEROES, applyHeroIdentity, heroEpisode, heroSkillTraits, createHeroStage, zeroVariantForm, heroFormName, heroFormColors, type HeroId } from './heroes';
import { CosmosTeleport } from './cosmosTeleport';
import { shrinkScale, sizeDescription } from './sizeRules';
import { bigShiningUnlocked, jumpHeightLabel, jumpWorldHeight, SMALL_SHINING_SECONDS, NORMAL_FORM_SECONDS, GALAXY_EXIT_SECONDS } from './progression';
import {
  createHuman,
  applyTigaForm,
  createEarth,
  createMonster,
  createTiga,
  type MonsterProfile,
} from './models';
import {
  FORM_STATS,
  canEnterFlight,
  canEnterFlightFromTaps,
  canEnterEarthView,
  FLIGHT_TAP_WINDOW_SECONDS,
  canUseFlashlight,
  canTransform,
  canUseAbility,
  formForAbility,
  getEnergyPhase,
  hasInfiniteEnergy,
  hasInfiniteHealth,
  normalizeEnergy,
  canTogglePerspective,
  PERSPECTIVE_SWITCH_WINDOW_SECONDS,
  requiresCloseRange,
  resolveDamage,
  resolveBelialDamage,
  isOrdinaryRay,
  belialAttackDamage,
  resolveDemogeaFinisher,
  resolveRevival,
  type Ability,
  type DamageTarget,
  type DefeatReason,
  type EnergyPhase,
  type PerspectiveKey,
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
  rayDamageTaken: number;
  escapeTimer: number;
}

const FINAL_WAVE = EPISODES.length + 2;
const ENERGY_COST: Record<Ability, number> = {
  punch: 0,
  kick: 1,
  boomerang: 5,
  delacium: 18,
  zeperion: 20,
  runboldt: 16,
  'evolution-ray': 28,
  'super-lightning': 35,
  'tiga-freeze': 8,
  'tiga-slash': 12,
  'flying-charge': 10,
};

const KEY_ACTIONS: Record<string, GameAction> = {
  '8': 'human-form',
  '9': 'transform',
  arrowleft: 'move-left',
  arrowright: 'move-right',
  arrowup: 'jump',
  arrowdown: 'move-down',
  f: 'move-forward',
  j: 'move-back',
  y: 'guard',
  b: 'space-flight',
  l: 'perspective-l',
  n: 'perspective-n',
  q: 'punch',
  w: 'kick',
  e: 'boomerang',
  z: 'delacium',
  x: 'zeperion',
  c: 'runboldt',
  d: 'super-lightning',
  a: 'tiga-freeze',s: 'tiga-slash',v: 'flying-charge',
  '1': 'form-power',
  '2': 'form-multi',
  '3': 'form-sky',
  '4': 'form-shining',
  '0': 'form-small-shining',
  p: 'eject',
  '5': 'evolution-ray',
  '6': 'demogea-finish',
  '7': 'land',
  o: 'revive',
  g: 'shrink',
  h: 'enlarge',
  delete: 'cosmos-teleport',
};

export class TigaGame {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly ssaoPass: SSAOPass;
  private readonly clock = new THREE.Clock();
  private readonly effects: Effects;
  private readonly hud: Hud;
  private readonly tiga = createTiga();
  private readonly humanModel = createHuman();
  private human = true;
  private climbedMonster: MonsterState | null = null;
  private climbTaps = 0;
  private climbWindow = 0;
  private readonly levelScenery = new THREE.Group();
  private readonly levelGround = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x777b86 }));
  private readonly exploration = new ExplorationWorld();
  private readonly cast = new THREE.Group();
  private playMode:'story'|'manual'|'explore'='manual';
  private previousPlayMode:'story'|'manual'='manual';
  private episodeElapsed=0;
  private outroDuration=OUTRO_SECONDS;
  private readonly victoryFlight=new VictoryFlight();
  private cinematicCooldown=0;
  private pilotRewarded=false;
  private readonly spaceGesture=new SpaceGesture();
  private growthLevel=0;
  private renderedGrowth=1;
  private explosionTimer:number|null=null;
  private explosionCooldown=0;
  private readonly lastStand = new LastStand();
  private readonly deepSpaceSlam = new DeepSpaceSlam();
  private slamTarget: MonsterState | null = null;
  private battleTime=0;
  private assistTimer=0;
  private assistStep=0;
  private transformTime:number|null=null;
  private orbitYaw=0;
  private orbitPitch=.26;
  private orbitDistance=30;
  private dragging=false;
  private readonly groundCity={value:1};
  private readonly monsters: MonsterState[] = [];
  private pendingMonsters: MonsterProfile[] = [];
  private readonly earth = createEarth();
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
  private demogeaFinisherPhase: 'entry' | 'exit' | null = null;
  private demogeaFinisherTimer = 0;
  private demogeaFinisherTarget: MonsterState | null = null;
  private demogeaFinisherStart = new THREE.Vector3();
  private demogeaFinisherEnd = new THREE.Vector3();
  private demogeaBall: THREE.Mesh | null = null;
  private jumpVelocity = 0;
  private jumpHoldTimer = 0;
  private flightTapCount = 0;
  private flightTapWindow = 0;
  private flying = false;
  private spaceFlying = false;
  private flightUpHoldTimer = 0;
  private earthView = false;
  private perspective: PerspectiveMode = 'second';
  private perspectiveKey: PerspectiveKey | null = null;
  private perspectiveKeyWindow = 0;
  private shiningUnlocked = false;
  private spawnTimer = 0;
  private victory = false;
  private readonly story = new StoryScreen(EPISODES);
  private storyMode: StoryMode = 'watch';
  private storyTime = 0;
  private deaths = 0;
  private totalDeaths = 0;
  private hero: HeroId = 'tiga';
  private zeroUltimate=false;
  private smallShiningRemaining=SMALL_SHINING_SECONDS;
  private formRemaining=NORMAL_FORM_SECONDS;
  private glideUnlocked=false;
  private gliding=false;
  private parachuting=false;
  private parachuteTime=0;
  private flightExplosion=false;
  private chainPulse=0;
  private windWallRemaining=0;
  private readonly parachute=new THREE.Group();
  private pendingRay: { ability: Ability; timer: number; target: MonsterState } | null = null;
  private attackPoseDuration = 0.34;
  private climaxHold = 0;
  private golzaDefeatedEarly = false;
  private introLaserPlayed = false;
  private rescueTime: number | null = null;
  private rescueUsed = false;
  private autoRescueRay = false;
  private submarineMode = false;
  private combatAircraft = false;
  private readonly submarine = new THREE.Group();
  private readonly sea = new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshStandardMaterial({color:0x176b93,roughness:.25,metalness:.1,transparent:true,opacity:.92}));
  private readonly cosmosTeleport = new CosmosTeleport();
  private shrinkPresses = 0;
  private gammaActive = false;
  private gammaTimer = 0;
  private gammaAttackCooldown = 0;
  private gammaSelected: 'core'|'tiga'|'dyna'|'gaia' = 'core';

  constructor(container: HTMLElement, hud: Hud) {
    this.hud = hud;
    try{this.totalDeaths=Math.max(0,Number(localStorage.getItem('tiga-total-deaths'))||0);}catch{this.totalDeaths=0;}
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
    this.renderer.toneMappingExposure = 0.96;
    container.append(this.renderer.domElement);
    this.levelGround.material.onBeforeCompile=shader=>{
      shader.uniforms.cityGround=this.groundCity;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundWorld;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\ngroundWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 groundWorld;uniform float cityGround;').replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=groundWorld.xz;
        float grain=fract(sin(dot(floor(p*90.0),vec2(12.9898,78.233)))*43758.5453);
        float district=min(abs(mod(p.x+32.0,64.0)-32.0),abs(mod(p.y+32.0,64.0)-32.0));
        float road=1.0-smoothstep(5.0,6.0,district);
        diffuseColor.rgb*=mix(.84,1.12,grain);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.48,road*cityGround);
        float lane=(1.0-smoothstep(.08,.18,district))*step(2.0,mod(p.x+p.y,5.0));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.65,.55),lane*cityGround*.65);
      `);
    };
    this.scene.add(this.exploration,this.cast,this.victoryFlight,this.submarine,this.sea);
    this.sea.rotation.x=-Math.PI/2;this.sea.position.set(0,-.35,-10000);this.sea.name='ocean';
    const subHull=new THREE.Mesh(new THREE.CapsuleGeometry(.8,3.2,5,10),new THREE.MeshStandardMaterial({color:0xd6a74d,metalness:.65,roughness:.3}));
    subHull.rotation.z=Math.PI/2;this.submarine.add(subHull);
    const subWindow=new THREE.Mesh(new THREE.SphereGeometry(.58,12,8),new THREE.MeshPhysicalMaterial({color:0x65c9e8,metalness:.35,roughness:.15,clearcoat:1}));
    subWindow.position.x=1.15;subWindow.scale.set(1,.7,.8);this.submarine.add(subWindow);this.submarine.visible=false;
    for(let i=0;i<5;i++) {
      const person=createHuman(i+1);
      person.position.set(-11+i*1.3,0,6+(i%2)*1.2);
      this.cast.add(person);
    }
    this.story.onMode(mode=>this.setPlayMode(mode));
    this.story.onPilotAction((action,pressed)=>this.handleAction(action as GameAction,pressed));
    this.story.onReturn(()=>{
      this.setPlayMode(this.previousPlayMode);
      this.tiga.position.set(-9,0,0);this.humanModel.position.copy(this.tiga.position);
      this.flying=false;this.spaceFlying=false;this.setEarthView(false);this.jumpVelocity=0;
      this.heldActions.clear();this.orbitYaw=0;this.orbitPitch=.26;
      this.camera.position.copy(this.tiga.position).add(new THREE.Vector3(0,8,30));
    });
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',event=>{this.dragging=true;canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener('pointerup',()=>{this.dragging=false;});
    canvas.addEventListener('pointercancel',()=>{this.dragging=false;});
    canvas.addEventListener('pointermove',event=>{
      if(!this.dragging)return;
      this.orbitYaw-=event.movementX*.006;
      this.orbitPitch=THREE.MathUtils.clamp(this.orbitPitch+event.movementY*.005,-.25,1.2);
    });
    canvas.addEventListener('wheel',event=>{
      event.preventDefault();this.orbitDistance=THREE.MathUtils.clamp(this.orbitDistance+event.deltaY*.025,10,65);
    },{passive:false});

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmremGenerator.dispose();

    this.composer = new EffectComposer(this.renderer);
    this.ssaoPass = new SSAOPass(this.scene, this.camera, 1, 1);
    this.ssaoPass.kernelRadius = 10;
    this.ssaoPass.minDistance = 0.0015;
    this.ssaoPass.maxDistance = 0.12;
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.ssaoPass);
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.32, 1.05),
    );
    this.composer.addPass(new OutputPass());

    this.scene.background = new THREE.Color(0x071019);
    this.scene.fog = new THREE.FogExp2(0x111d25, 0.011);
    this.camera.position.set(0, 11.5, 30);
    this.camera.lookAt(0, 4.2, 0);
    this.setupWorld();
    this.tiga.visible = false;
    this.scene.add(this.humanModel, this.levelScenery);
    this.levelGround.rotation.x = -Math.PI / 2;
    this.levelGround.receiveShadow = true;
    this.scene.add(this.levelGround);
    this.humanModel.position.copy(this.tiga.position);
    this.effects = new Effects(this.scene);
    this.scene.add(this.deepSpaceSlam);
    const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.5,20,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xe7b84f,side:THREE.DoubleSide}));
    this.parachute.add(canopy);
    for(const side of [-1,1]){const rope=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,3,5),new THREE.MeshBasicMaterial({color:0xe7edf1}));rope.position.set(side*1,-1.3,0);rope.rotation.z=side*.5;this.parachute.add(rope);}
    this.parachute.visible=false;this.scene.add(this.parachute);
    this.story.onSkip(() => {
      if (this.storyMode === 'watch') {
        if (episodeScene(this.storyTime).pilot) {
          this.storyTime = 300; this.playMode = 'manual'; this.victoryFlight.reset();
          this.victoryFlight.visible = true; this.story.setPlayMode('manual');
        } else this.beginCombat();
      }
      else if (this.storyMode === 'outro') this.nextEpisode();
    });
    this.story.onMusic(file => this.audio?.setSong(file));
    this.story.onJump(episode => {
      this.wave = episode;
      this.defeatReason = null; this.reviving = false;
      this.setStatueMaterial(false); this.victory = false;
      this.spawnWave();
    });
    this.spawnWave();
    this.bindInput();
    this.hud.onStart(() => this.start());
    this.hud.onHeroChange(hero=>this.selectHero(hero));
    this.hud.onTutorialSkip(() => this.skipTutorial());
    this.hud.onToggleMute((muted) => {this.audio?.setMuted(muted);this.story.setMuted(muted);});
    this.hud.onAction((action, pressed) => this.handleAction(action, pressed));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.updateHud();
    this.animate();
  }

  private setupWorld() {
    this.createAtmosphere();
    const hemisphere = new THREE.HemisphereLight(0xb9d4e4, 0x29232a, 0.9);
    this.scene.add(hemisphere);

    const keyLight = new THREE.DirectionalLight(0xffebd6, 2.05);
    keyLight.position.set(-12, 24, 14);
    keyLight.name='follow-key-light';
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.left = -30;
    keyLight.shadow.camera.right = 30;
    keyLight.shadow.camera.top = 25;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias = -0.00035;
    keyLight.shadow.normalBias = 0.035;
    this.scene.add(keyLight,keyLight.target);

    const moonLight = new THREE.DirectionalLight(0x7895c5, 1.25);
    moonLight.position.set(16, 20, -24);
    moonLight.target.position.set(0, 3, 0);
    this.scene.add(moonLight, moonLight.target);

    const cityGlow = new THREE.PointLight(0x62b9cf, 18, 30, 1.7);
    cityGlow.position.set(-13, 8, 8);
    const dangerGlow = new THREE.PointLight(0xd84b3d, 17, 28, 1.8);
    dangerGlow.position.set(14, 7, 5);
    const rimLight = new THREE.DirectionalLight(0x8bdfff, 2.2);
    rimLight.position.set(4, 9, -18);
    this.scene.add(cityGlow, dangerGlow, rimLight);

    this.tiga.position.set(-9, 0, 0);
    this.tiga.rotation.y = Math.PI * 0.26;
    this.earth.position.set(0, 13, -8);
    this.scene.add(this.tiga, this.earth);
  }

  private createAtmosphere() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x07111d) },
          horizonColor: { value: new THREE.Color(0x26343c) },
        },
        vertexShader: `
          varying vec3 vSkyDirection;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vSkyDirection = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 topColor;
          uniform vec3 horizonColor;
          varying vec3 vSkyDirection;
          float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float smoothNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(noise(i),noise(i+vec2(1.,0.)),f.x),mix(noise(i+vec2(0.,1.)),noise(i+vec2(1.)),f.x),f.y);}
          void main() {
            vec3 direction=normalize(vSkyDirection);
            float height = direction.y;
            float mixValue = smoothstep(-0.16, 0.36, height);
            vec3 color=mix(horizonColor, topColor, mixValue);
            vec2 uv=direction.xz/max(.14,direction.y)*3.;
            float cloud=smoothNoise(uv)*.55+smoothNoise(uv*2.1)*.28+smoothNoise(uv*4.3)*.17;
            float daylight=smoothstep(.05,.2,length(topColor));
            color=mix(color,vec3(.88,.92,.95),smoothstep(.57,.78,cloud)*smoothstep(.06,.3,height)*daylight*.65);
            float sun=pow(max(0.,dot(direction,normalize(vec3(-.5,.65,.6)))),180.);
            color+=vec3(1.,.8,.52)*sun*daylight;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    );
    sky.name = 'earth-sky';
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
    stars.name='exploration-stars';
    this.scene.add(stars);
  }

  private start() {
    if (this.started) return;
    this.started = true;
    this.tutorialStage = 'done';
    this.audio = new BattleAudio();
    this.audio.start();
    this.audio.play('start');
    this.setMessage('你是人类：方向键移动，怪兽旁连跳三次攀爬；按 9 变身奥特曼', 8);
    this.tone(220, 0.12, 'sawtooth');
    this.tone(440, 0.18, 'triangle', 0.1);
    this.updateHud();
  }

  private currentEpisode(){return heroEpisode(episodeAt(this.wave),this.hero,this.wave);}
  private skillName(ability:Ability){
    if(this.hero==='zero'&&this.zeroUltimate){
      if(ability==='tiga-slash')return '究极赛罗之剑';
      if(ability==='zeperion')return this.form==='shining'?'光辉究极赛罗射线':'究极赛罗射线';
      if(ability==='flying-charge')return '终极铠甲俯冲';
    }
    return HEROES[this.hero].skills[ability];
  }

  private selectHero(hero:HeroId){
    if(this.deepSpaceSlam.active||this.pendingRay||this.explosionTimer!==null||this.defeatReason||this.transformTime!==null||this.parachuting){this.setMessage('动作结束后再切换角色',2);return;}
    this.hero=hero;this.zeroUltimate=false;applyHeroIdentity(this.tiga,hero);this.setForm(this.form);
    this.spawnWave();this.setMessage(`${HEROES[hero].name} · ${HEROES[hero].scene} · 专属技能已装载`,5);
  }

  private eject(){
    if(!this.started||this.storyMode!=='watch'||!episodeScene(this.storyTime).pilot||this.victoryFlight.ejected)return;
    const position=this.victoryFlight.lead.position.clone();
    this.victoryFlight.eject();this.beginCombat();
    this.tiga.position.copy(position);this.humanModel.position.copy(position);
    this.human=true;this.tiga.visible=false;this.humanModel.visible=true;
    this.parachuting=true;this.parachuteTime=0;this.parachute.visible=true;
    this.heldActions.clear();this.setMessage('跳伞成功！空中变身，解锁滑行和高跳',5);
  }

  private launchAircraftFromBattle(){
    if(!this.started||!this.human||this.storyMode!=='combat'||this.defeatReason||this.victory)return;
    this.combatAircraft=true;this.submarineMode=false;this.victoryFlight.reset();
    this.victoryFlight.lead.position.copy(this.tiga.position).add(new THREE.Vector3(0,20,0));
    this.victoryFlight.reset();this.victoryFlight.visible=true;this.humanModel.visible=true;
    this.heldActions.clear();this.setMessage('胜利飞跃号出动 · 50 点生命 · A/←左移 · D/→右移 · D 左激光 · K 右激光',5);
  }

  private fireAircraftLaser(side:'left'|'right'){
    if(!this.started||(!this.combatAircraft&&!(this.storyMode==='watch'&&episodeScene(this.storyTime).pilot)))return;
    const fighter=this.victoryFlight.lead;
    const color=side==='left'?0x55ff78:0x38e969;
    const muzzle=fighter.position.clone().add(new THREE.Vector3(side==='left'?-1.1:1.1,0,.2).applyQuaternion(fighter.quaternion));
    const direction=new THREE.Vector3(0,0,-1).applyQuaternion(fighter.quaternion).normalize();
    const raycaster=new THREE.Raycaster(muzzle,direction,0,1200);
    const hits=this.livingMonsters().flatMap(monster=>raycaster.intersectObject(monster.object,true).map(hit=>({monster,hit}))).sort((a,b)=>a.hit.distance-b.hit.distance);
    const hit=hits[0];
    const end=hit?.hit.point??muzzle.clone().addScaledVector(direction,1200);
    this.effects.beam(muzzle,end,color,.3);
    if(hit){const target=hit.monster;target.health=Math.max(0,target.health-target.profile.maxHealth*.025);this.effects.impact(end,color,1.3);if(target.health<=0)this.defeatMonster(target);this.setMessage(`${side==='left'?'左侧':'右侧'}绿色激光命中 ${target.profile.name}`,1.1);}
    else this.setMessage(`${side==='left'?'左侧':'右侧'}绿色激光射偏 · 未命中`,1.1);
  }

  private startFlightExplosion(){
    if(!this.started||this.human||this.parachuting||this.transformTime!==null||this.defeatReason||this.pendingRay||this.deepSpaceSlam.active||this.explosionTimer!==null||this.storyMode!=='combat')return;
    const target=this.nearestMonster();if(!target)return;
    this.flightExplosion=true;this.chainPulse=0;this.spaceGesture.consume();
    this.startDeepSpaceSlam(target);
    if(this.lastStand.remaining!==null)this.lastStand.remaining=30;
    this.setMessage('飞行爆炸 ★★★★ · 20 秒飞出银河系 · 连续爆炸后俯冲 · 动作保护 30 秒',30);
  }

  private bindInput() {
    window.addEventListener('keydown', (event) => {
      // A focused hero selector used to swallow Delete, making 高斯的瞬移看起来失效。
      // Keep text inputs isolated, but allow the gameplay hotkeys through a focused select.
      if (event.target instanceof HTMLInputElement) return;
      if(event.code==='Space') {event.preventDefault();if(!event.repeat&&this.started){this.spaceGesture.down(performance.now()/1000);if(this.flying)this.startFlightExplosion();}return;}
      if (this.started && this.storyMode === 'watch' && episodeScene(this.storyTime).pilot) {
        const pilotActions = pilotActionsForKey(event.key);
        if (pilotActions.length) { event.preventDefault(); if (!event.repeat) pilotActions.forEach(action => this.handleAction(action as GameAction, true)); return; }
      }
      if(this.started&&this.storyMode==='combat'&&(this.combatAircraft||this.submarineMode)){
        const pilotActions=pilotActionsForKey(event.key);
        if(pilotActions.length){event.preventDefault();if(!event.repeat)pilotActions.forEach(a=>this.handleAction(a as GameAction,true));return;}
      }
      const rawKey=event.key.toLowerCase();
      const key=event.code==='Delete'||rawKey==='del'||rawKey==='backspace'?'delete':rawKey;
      const action=this.storyMode==='combat'&&key==='o'?'sea-teleport':this.storyMode==='combat'&&key==='u'?'aircraft':this.storyMode==='combat'&&key==='p'?'submarine':KEY_ACTIONS[key];
      if (!action) return;
      event.preventDefault();
      if (event.repeat && !action.startsWith('move-') && action !== 'guard') return;
      if(['punch','kick','boomerang'].includes(action))this.heldActions.add(action);
      this.handleAction(action, true);
    });
    window.addEventListener('keyup', (event) => {
      if(event.code==='Space') {event.preventDefault();if(this.spaceGesture.release(performance.now()/1000)==='grow')this.growGiant();return;}
      if (this.started && this.storyMode === 'watch' && episodeScene(this.storyTime).pilot) {
        const pilotActions = pilotActionsForKey(event.key);
        if (pilotActions.length) { event.preventDefault(); pilotActions.forEach(action => this.handleAction(action as GameAction, false)); return; }
      }
      if(this.started&&this.storyMode==='combat'&&(this.combatAircraft||this.submarineMode)){
        const pilotActions=pilotActionsForKey(event.key);
        if(pilotActions.length){event.preventDefault();pilotActions.forEach(a=>this.handleAction(a as GameAction,false));return;}
      }
      const rawKey=event.key.toLowerCase();
      const key=event.code==='Delete'||rawKey==='del'||rawKey==='backspace'?'delete':rawKey;
      const action=this.storyMode==='combat'&&key==='o'?'sea-teleport':this.storyMode==='combat'&&key==='u'?'aircraft':this.storyMode==='combat'&&key==='p'?'submarine':KEY_ACTIONS[key];
      if (!action) return;
      event.preventDefault();
      this.heldActions.delete(action);
      this.handleAction(action, false);
    });
    window.addEventListener('blur', () => {this.heldActions.clear();this.spaceGesture.reset();});
  }

  private setPlayMode(mode:'story'|'manual'|'explore'){
    if(this.deepSpaceSlam.active || this.explosionTimer!==null || (mode==='explore' && this.lastStand.remaining!==null)) {
      this.story.setPlayMode(this.playMode);
      this.setMessage('最后反击期间请留在战场，击败怪兽即可获胜',3);return;
    }
    if(mode==='explore'&&this.playMode!=='explore')this.previousPlayMode=this.playMode;
    if(mode!=='explore'){
      this.previousPlayMode=mode;
      if(this.playMode==='explore'){
        this.growthLevel=0;this.renderedGrowth=1;this.setForm(this.form);this.earth.scale.setScalar(1);
        this.tiga.position.set(-9,0,0);this.humanModel.position.copy(this.tiga.position);
        this.flying=false;this.spaceFlying=false;this.setEarthView(false);this.jumpVelocity=0;
        this.camera.position.set(-9,8,30);
        this.camera.far=2000;this.camera.updateProjectionMatrix();
        this.scene.getObjectByName('earth-sky')?.scale.setScalar(1);this.scene.getObjectByName('exploration-stars')?.scale.setScalar(1);
        this.levelGround.visible=true;this.levelScenery.visible=true;this.scene.fog=new THREE.FogExp2(0xa5c9e5,.004);
      }
    }
    this.playMode=mode;this.story.setPlayMode(mode);this.heldActions.clear();
    this.setMessage(mode==='story'?'自动战斗：自动走位与连招':mode==='explore'?'自由探索 · 剧情暂停 · 双击空格变大 · 返回按钮继续剧情':'手动战斗 · 点击招式智能瞄准和近身',5);
  }

  private growGiant(){
    if(!this.started||this.human||this.defeatReason||this.victory){this.setMessage('先按 9 变身迪迦，再双击空格变大',3);return;}
    if(this.explosionTimer!==null||this.pendingRay||this.deepSpaceSlam.active||this.lastStand.remaining!==null)return;
    this.setPlayMode('explore');this.growthLevel+=2;
    this.setTigaVisibility(this.perspective!=='first');
    this.setMessage(`光之巨人继续成长 · 身高 ${giantSize(this.growthLevel).height}`,4);
    this.audio?.play('transform');
  }

  private startUltraExplosion(){
    if(this.playMode==='explore'||this.storyMode!=='combat'||this.transformTime!==null||this.explosionTimer!==null||this.deepSpaceSlam.active||this.pendingRay||this.defeatReason)return;
    if(!canUltraExplode(this.human,this.health)){this.setMessage('奥特爆炸：奥特曼生命 0～30 点可用，零血后有 30 秒最后反击',3);return;}
    if(this.explosionCooldown>0){this.setMessage(`奥特爆炸冷却 ${Math.ceil(this.explosionCooldown)} 秒`,2);return;}
    this.explosionTimer=0;this.heldActions.clear();this.climaxHold=6;
    this.effects.charge(this.tiga,2.2);this.audio?.play('transform');
  }

  private updateUltraExplosion(delta:number){
    if(this.explosionTimer===null)return;
    this.explosionTimer+=delta;
    for(const side of ['left','right']){const arm=this.tiga.getObjectByName(`${side}-arm`);if(arm){arm.rotation.x=-.8;arm.rotation.z=(side==='left'?1:-1)*1.25;}}
    if(this.explosionTimer<2.2)return;
    this.explosionTimer=null;this.explosionCooldown=this.form==='shining'?0:20;
    if(!canUltraExplode(this.human,this.health))return;
    this.effects.ultraExplosion(this.tiga.position.clone().add(new THREE.Vector3(0,4,0)));this.audio?.play('explosion');
    for(const target of this.livingMonsters()){
      if(target.object.position.distanceTo(this.tiga.position)>40)continue;
      target.health=0;target.stunned=3;
      if(target.health<=0)this.defeatMonster(target);
    }
    this.health=this.health>0?1:0;this.energy=Math.max(1,this.energy-15);
    if(this.storyMode==='combat')this.setMessage('奥特爆炸 ★★★★ · 范围终结冲击！',5);
  }

  private updateLastStand(delta:number) {
    const previous=this.lastStand.remaining;
    const state=this.lastStand.update(this.health,this.human,this.livingMonsters().length===0,delta);
    if(state==='defeated') {if(this.flightExplosion&&this.deepSpaceSlam.active)return false;this.turnToStone('defeated');return true;}
    if(state==='active'&&previous===null) {
      this.climaxHold=10;
      this.setMessage('零血最后 30 秒！长按空格奥特爆炸，或空格＋飞释放连续飞行爆炸！',30);
    }
    return false;
  }

  private startDeepSpaceSlam(target:MonsterState) {
    this.attackCooldown=8.5;this.attackPoseTimer=0;
    this.heldActions.clear();this.flying=false;this.gliding=false;this.jumpVelocity=0;
    this.pendingRay=null;this.slamTarget=target;this.climaxHold=10;
    this.setTigaVisibility(true);
    this.deepSpaceSlam.begin(this.scene,this.tiga,this.camera,target.object.position,this.flightExplosion);
    this.setMessage('深空重砸 ★★★★ · 突破大气层，飞出太阳系！',8);
    this.audio?.play('transform');
  }

  private updateDeepSpaceSlam(delta:number) {
    const impactReady=this.deepSpaceSlam.update(delta);
    if(this.flightExplosion){
      this.chainPulse-=delta;
      if(this.chainPulse<=0){
        this.chainPulse=.9;
        this.effects.ultraExplosion(this.tiga.position.clone());this.audio?.play('explosion');
        for(const monster of this.livingMonsters()){monster.health=Math.max(1,monster.health-monster.profile.maxHealth*.06);monster.stunned=2;}
      }
    }
    if(!impactReady)return;
    const chain=this.flightExplosion;this.flightExplosion=false;
    if(chain)this.pendingMonsters=[];
    const target=this.slamTarget;this.slamTarget=null;
    this.deepSpaceSlam.finish();
    this.attackCooldown=0;
    const impact=this.tiga.position.clone().add(new THREE.Vector3(0,1,0));
    this.effects.ultraExplosion(impact);this.audio?.play('explosion');
    const targets=chain?this.livingMonsters():target?[target]:[];
    for(const monster of targets)if(!monster.defeated){monster.health=0;this.defeatMonster(monster);}
    if(this.storyMode==='combat')this.setMessage('深空重砸 ★★★★ · 从宇宙返回战场，重击命中！',4);
    this.setTigaVisibility(this.perspective!=='first');
  }

  private handleAction(action: GameAction, pressed: boolean) {
    if(this.parachuting)return;
    if(action.startsWith('zero-')&&pressed&&this.hero==='zero'){
      if(!this.started||this.victory||this.defeatReason||this.pendingRay||this.deepSpaceSlam.active||this.transformTime!==null||this.explosionTimer!==null||this.human)return;
      if(action==='zero-shining-ultimate'&&!bigShiningUnlocked(this.totalDeaths)){this.setMessage(`光辉终极铠甲需要累计死亡 10 次：${this.totalDeaths}/10`,3);return;}
      if(action==='zero-shining'&&this.smallShiningRemaining<=0){this.setMessage('本集光辉型时间已用完，下一集恢复',3);return;}
      this.zeroUltimate=action!=='zero-shining';
      this.changeForm(zeroVariantForm(action));
      applyHeroIdentity(this.tiga,this.hero,this.zeroUltimate);
      this.setMessage(action==='zero-ultimate'?'终极铠甲装着 · 究极赛罗之剑':action==='zero-shining'?'光辉赛罗 · 专属光辉技能':'光辉终极铠甲 · 光辉与究极之力',4);return;
    }
    if(action==='eject'){if(pressed)this.eject();return;}
    if(action==='aircraft'){if(pressed)this.launchAircraftFromBattle();return;}
    if(action==='submarine'){if(pressed&&this.storyMode==='combat'){this.combatAircraft=false;this.victoryFlight.visible=false;this.submarineMode=!this.submarineMode;this.tiga.position.y=this.submarineMode?-12:0;this.submarine.visible=this.submarineMode;this.setMessage(this.submarineMode?'潜艇已下潜 · 水下速度提升，怪兽移动减慢':'已离开潜艇 · 返回地面',3);}return;}
    if(action==='sea-teleport'){if(pressed&&this.storyMode==='combat'){this.combatAircraft=false;this.submarineMode=false;this.victoryFlight.visible=false;this.submarine.visible=false;this.human=true;this.humanModel.visible=true;this.levelGround.visible=false;this.levelScenery.visible=false;this.sea.visible=true;this.tiga.position.set(0,0,-9700);this.humanModel.position.copy(this.tiga.position);this.setMessage('已瞬移到海边 · 海域边界 1 万米',3);}return;}
    if(action==='shrink'||action==='enlarge'){
      if(!pressed||this.human||this.storyMode!=='combat')return;
      this.shrinkPresses=action==='shrink'?this.shrinkPresses+1:Math.max(0,this.shrinkPresses-1);
      const base=this.form==='power'?[1.03,.92,.98]:this.form==='sky'?[.84,.96,.86]:[.92,.94,.92];
      this.renderedGrowth=shrinkScale(this.shrinkPresses);
      this.tiga.scale.set(base[0],base[1],base[2]).multiplyScalar(this.renderedGrowth);
      this.setMessage(`体型：${sizeDescription(this.shrinkPresses)} · 攻击力不变`,1.6);return;
    }
    if(action==='cosmos-teleport'){
      if(!pressed||this.hero!=='cosmos'||this.human||this.storyMode!=='combat'){if(pressed)this.setMessage('只有高斯奥特曼可以使用 Delete 瞬移',2);return;}
      const destination=this.cosmosTeleport.press(this.tiga.position);
      if(!destination){this.setMessage('本局高斯瞬移已用完，或 10 次瞬移次数已用尽',2);return;}
      this.tiga.position.copy(destination);this.effects.impact(destination.clone().add(new THREE.Vector3(0,4,0)),0xb8edff,2.2);
      this.setMessage(`高斯瞬间移动 ${this.cosmosTeleport.jumps}/10 · 附近怪兽失明并受到 25 伤害`,1.5);
      for(const monster of this.livingMonsters())if(monster.object.position.distanceTo(this.tiga.position)<30){monster.health=Math.max(0,monster.health-25);monster.stunned=2.5;if(monster.health<=0)this.defeatMonster(monster);}
      return;
    }
    if(action.startsWith('illusion-')){if(pressed&&this.hero==='zeta'&&this.form==='sky'){this.gammaSelected=action==='illusion-core'?'core':action.replace('illusion-','') as 'tiga'|'dyna'|'gaia';this.setMessage(`已控制${this.gammaSelected==='core'?'泽塔本体':this.gammaSelected+'幻象'}`,1.5);}return;}
    if(action==='pilot-fire-left'||action==='pilot-fire-right'){
      if(pressed)this.fireAircraftLaser(action==='pilot-fire-left'?'left':'right');
      if(this.combatAircraft){this.heldActions.delete(action);return;}
    }
    if(action==='pilot-fire-left'||action==='pilot-fire-right'){
      return;
    }
    if(action==='flight-explosion'){if(pressed)this.startFlightExplosion();return;}
    if(action==='glide'){if(pressed&&!this.human&&this.glideUnlocked){this.gliding=!this.gliding;this.flying=false;this.setMessage(this.gliding?'滑行展开 · ↑ 高跳，B 飞行':'滑行结束',2);}return;}
    if(action==='space-flight'&&pressed&&this.spaceGesture.pressed){this.startFlightExplosion();return;}
    if(action==='explore'){if(pressed)this.setPlayMode('explore');return;}
    if(action==='grow'){if(pressed)this.growGiant();return;}
    if(action==='ultra-explosion'){if(pressed)this.spaceGesture.down(performance.now()/1000);else this.spaceGesture.reset();return;}
    if(this.started&&this.playMode!=='explore'&&this.storyMode==='watch'&&episodeScene(this.storyTime).pilot){
      if(pressed)this.heldActions.add(action);else this.heldActions.delete(action);return;
    }
    if ((this.storyMode !== 'combat'&&this.playMode!=='explore') || this.rescueTime !== null || this.autoRescueRay || this.transformTime!==null || this.explosionTimer!==null || this.deepSpaceSlam.active) return;
    if (action === 'human-form') {
      if (!pressed || !this.started || this.human || this.defeatReason || this.victory || this.recharging) return;
      this.human = true;
      this.growthLevel=0;this.renderedGrowth=1;this.setForm(this.form);this.earth.scale.setScalar(1);
      this.flying = false;
      this.spaceFlying = false;
      this.setEarthView(false);
      this.setSpaceGroundLighting(false);
      this.climbedMonster = null;
      this.climbTaps = 0;
      this.climbWindow = 0;
      this.flightTapCount = 0;
      this.flightTapWindow = 0;
      this.jumpHoldTimer = 0;
      this.flightUpHoldTimer = 0;
      this.jumpVelocity = 0;
      this.attackCooldown = 0;
      this.attackPoseTimer = 0;
      this.pendingRay = null;
      this.heldActions.clear();
      this.tiga.position.y = 0;
      this.tiga.position.z = 0;
      this.humanModel.position.copy(this.tiga.position);
      this.setTigaVisibility(false);
      this.setMessage('已变回人类：可以攻击、切换视角和攀爬，按 9 再次变身', 3);
      this.updateHud();
      return;
    }
    if (action === 'transform' && pressed && this.started && !this.defeatReason && !this.victory) {
      if (this.human) {
        this.transformTime=0;this.climaxHold=TRANSFORM_SECONDS;
        this.human = false;
        this.climbedMonster = null;
        this.tiga.position.y = 0;
        this.jumpVelocity = 0;
        this.flightTapCount = 0;
        this.flightTapWindow = 0;
        this.humanModel.visible = false;
        this.setTigaVisibility(this.perspective !== 'first');
        this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0, 3, 0)), 0x8feaff, 4);
        this.audio?.play('transform');
        this.setMessage('举起神光棒 · 光的继承者', 3);
      }
      return;
    }
    if (this.human && action === 'jump') {
      if (!pressed || !this.started || this.defeatReason || this.victory) return;
      const target = this.nearestMonster();
      this.climbTaps = this.climbWindow > 0 ? this.climbTaps + 1 : 1;
      this.climbWindow = 1.8;
      if (target && canHumanClimb(groundDistance(target.object.position,this.tiga.position), this.climbTaps)) {
        this.climbedMonster = target;
        this.jumpVelocity = 0;
        this.setMessage('爬上怪兽了！你太小，怪兽无法瞄准你。按 9 变身，或左右移动跳下', 4);
      } else if (this.tiga.position.y <= 0.01) this.jumpVelocity = 5;
      return;
    }
    if (this.human && (action.startsWith('form-') || ['space-flight', 'land', 'demogea-finish', 'move-down'].includes(action))) {
      if (pressed && this.started) this.setMessage('人类不能飞行或使用奥特曼技能，按 9 变身', 1.5);
      return;
    }
    if (
      action === 'move-left' ||
      action === 'move-right' ||
      action === 'move-down' ||
      action === 'move-forward' ||
      action === 'move-back' ||
      action === 'guard' ||
      action === 'jump'
    ) {
      if (pressed) this.heldActions.add(action);
      else this.heldActions.delete(action);
      if (action === 'jump' && pressed) {
        if (!this.flying) {
          if(this.tiga.position.y<=.01||this.gliding){this.gliding=false;this.jumpVelocity=Math.sqrt(40*jumpWorldHeight(this.form));this.setMessage(`${FORM_STATS[this.form].label}高跳 · ${jumpHeightLabel(this.form)}`,3);}
          this.jumpHoldTimer = 0;
          if (this.flightTapWindow <= 0) this.flightTapCount = 0;
          this.flightTapCount += 1;
          this.flightTapWindow = FLIGHT_TAP_WINDOW_SECONDS;
          if (canEnterFlightFromTaps(this.flightTapCount)) this.enterFlightMode();
        }
      }
      if (action === 'jump' && !pressed && this.earthView) this.setEarthView(false);
      if (pressed && (action === 'move-left' || action === 'move-right')) {
        this.completeTutorialAction('move');
      }
      return;
    }
    if (!pressed || !this.started) return;
    if (action === 'space-flight') {
      this.enterSpaceFlightMode();
      return;
    }
    if (action === 'perspective-l' || action === 'perspective-n') {
      this.handlePerspectiveKey(action === 'perspective-l' ? 'l' : 'n');
      return;
    }
    if (action === 'land') {
      this.landFromFlight();
      return;
    }
    if (action === 'revive') {
      if(this.human&&this.storyMode==='combat'){this.launchAircraftFromBattle();return;}
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
    if (this.pendingRay) { this.setMessage('招式动作进行中，请等施放结束后切换形态', 1.5);return; }
    if (nextForm === 'shining' && !bigShiningUnlocked(this.totalDeaths)) {
      this.setMessage(`大闪耀：累计死亡 ${this.totalDeaths}/10 次解锁`, 2.2);
      this.tone(90, 0.12, 'square');
      return;
    }
    if (nextForm==='small-shining'&&this.smallShiningRemaining<=0) {
      this.setMessage('本集小闪耀的 1 分钟已用完，下一集重新恢复', 2);return;
    }
    if (!canTransform(nextForm, nextForm==='shining'?100:this.lightMeter, bigShiningUnlocked(this.totalDeaths))) {
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
    if(this.hero==='zero'&&nextForm==='shining')this.zeroUltimate=true;
    applyHeroIdentity(this.tiga,this.hero,this.zeroUltimate);
    applyTigaForm(this.tiga, nextForm);
    if(this.hero!=='tiga'&&this.hero!=='trigger'&&nextForm!=='shining'&&nextForm!=='small-shining')this.tiga.traverse(object=>{
      if(object instanceof THREE.Mesh&&object.material instanceof THREE.MeshStandardMaterial){
        const [color,accent]=heroFormColors(this.hero,nextForm);
        if(object.name==='form-color')object.material.color.setHex(color);
        if(object.name==='form-accent')object.material.color.setHex(accent);
      }
    });
    const scale = nextForm === 'power' ? [1.03, 0.92, 0.98] : nextForm === 'sky' ? [0.84, 0.96, 0.86] : [0.92, 0.94, 0.92];
    this.tiga.scale.set(scale[0], scale[1], scale[2]).multiplyScalar(this.renderedGrowth);
    if(this.hero==='zeta'&&nextForm==='sky'){this.gammaActive=true;this.gammaTimer=10;this.gammaSelected='core';this.setMessage('伽马未来：迪迦、戴拿、盖亚幻象已出现 · 未选中的幻象会自动攻击',4);}
  }

  private attack(ability: Ability, released = false, lockedTarget?: MonsterState) {
    if (this.defeatReason || this.victory || this.deepSpaceSlam.active || (!released && (this.pendingRay || (this.form!=='shining'&&this.attackCooldown > 0)))) return;
    if(this.hero==='zeta'&&this.form==='sky'&&ability==='runboldt'&&!released){
      this.gammaActive=true;this.gammaTimer=10;this.attackCooldown=.8;this.attackPose='runboldt';this.attackPoseTimer=.8;
      this.setMessage('正在召唤伽马未来幻象：三位奥特曼协同出击',2.5);return;
    }
    if (!this.human && !canUseAbility(this.form, ability)) {
      const requiredForm = formForAbility(this.form, ability);
      if (requiredForm === 'shining' && !bigShiningUnlocked(this.totalDeaths)) {
        if(this.smallShiningRemaining<=0){this.setMessage('小闪耀时间已用尽，大闪耀需要累计死亡 10 次',2);return;}
        this.setForm('small-shining');
      }else{
        this.setForm(requiredForm);
      }
      this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0,4.5,0)), FORM_STATS[requiredForm].color, 1.5);
    }
    const cost = released || this.human || hasInfiniteEnergy(this.form) ? 0 : ENERGY_COST[ability];
    if (this.energy <= cost) {
      this.setMessage('能量不足', 1.2);
      return;
    }
    const traits=heroSkillTraits(this.hero,ability);
    const nearestTarget=this.nearestMonster();
    const targets = lockedTarget ? [lockedTarget].filter(m => !m.defeated) : !this.human && ability === 'super-lightning' ? this.livingMonsters() :
      !this.human&&traits.area&&nearestTarget?this.livingMonsters().filter(m=>groundDistance(m.object.position,nearestTarget.object.position)<=traits.area):[nearestTarget].filter(Boolean) as MonsterState[];
    if (targets.length === 0) {if(released)this.autoRescueRay=false;return;}
    const nearest = targets[0];
    let distance = nearest.object.position.distanceTo(this.tiga.position);
    if(!released&&!this.human&&this.playMode==='manual'&&requiresCloseRange(ability)&&distance>4.7&&distance<18&&!this.flying){
      const offset=nearest.object.position.clone().sub(this.tiga.position);offset.y=0;
      this.tiga.position.addScaledVector(offset.normalize(),Math.max(0,groundDistance(this.tiga.position,nearest.object.position)-4.2));
      distance=nearest.object.position.distanceTo(this.tiga.position);
    }
    if(!this.human)this.tiga.rotation.y=Math.atan2(nearest.object.position.x-this.tiga.position.x,nearest.object.position.z-this.tiga.position.z);
    if(distance>(this.form==='small-shining'?200:this.form==='shining'?Infinity:65)&&!released){this.setMessage('目标在远处，靠近怪兽或点击「返回战场」',2);return;}
    if (requiresCloseRange(ability) && distance > 4.7) {
      this.setMessage('距离太远', 0.8);
      return;
    }

    const isRay = !this.human && !['punch', 'kick', 'boomerang'].includes(ability);
    if (isRay && !released && this.form!=='shining' && !this.autoRescueRay && !(ability==='flying-charge'&&this.lastStand.remaining!==null) && !canFireStoryRay(this.currentEpisode(), nearest.health, nearest.profile.maxHealth, nearest.escapeTimer > 0, this.shiningUnlocked)) {
      this.setMessage('先用拳、踢和飞镖战斗 · 怪兽生命低于 35% 后开放终结招式', 3);
      return;
    }
    this.energy = normalizeEnergy(this.form, this.energy - cost);
    if(!this.human&&ability==='flying-charge'&&!released){this.startDeepSpaceSlam(nearest);return;}
    if (isRay && !released) {
      this.attackCooldown = RAY_POSE_SECONDS;
      this.attackPoseDuration = RAY_POSE_SECONDS;
      this.attackPoseTimer = RAY_POSE_SECONDS;
      this.attackPose = ability;
      this.pendingRay = { ability, timer: RAY_CHARGE_SECONDS, target: nearest };
      this.effects.charge(this.tiga, RAY_CHARGE_SECONDS);
      this.setMessage('交叉 · 展臂 · 汇聚光芒', RAY_CHARGE_SECONDS);
      return;
    }
    if (!released) {
      this.attackCooldown = ability === 'punch' ? 0.4 : ability === 'kick' ? 0.8 : 0.8;
      this.attackPoseDuration = this.attackCooldown;
      this.attackPoseTimer = this.attackCooldown;
      this.attackPose = ability;
    }
    this.audio?.play(ability);
    this.tiga.updateMatrixWorld(true);
    const start = this.human ? this.tiga.position.clone().add(new THREE.Vector3(.25,.9,0))
      : this.tiga.getObjectByName('right-hand')!.getWorldPosition(new THREE.Vector3());
    if (released) this.climaxHold = 5;

    targets.forEach((target) => {
      const end = target.object.position.clone().add(new THREE.Vector3(0, 4.8, 0));
      if (this.human) {
        this.effects.beam(start, end, 0xffd68a, 0.035);
        this.effects.impact(end, 0xffd68a, 0.2);
      } else this.playAbilityEffect(ability, start, end);
      const targetKind: DamageTarget =
        target.profile.id === 'gatanothor'
          ? 'gatanothor'
          : target.profile.id === 'demogea'
            ? 'demogea'
            : 'ordinary';
      const storyFinisher = released && (this.autoRescueRay || target.escapeTimer > 0);
      const rawDamage = resolveDamage(this.form, ability, targetKind)*traits.hits*(this.hero==='zero'&&this.zeroUltimate?1.3:1);
      const assistedDamage=this.playMode==='story'&&!this.human&&rawDamage>0&&target.profile.id!=='demogea'
        ? Math.max(rawDamage,target.profile.maxHealth*(released ? .55 : .12)) : rawDamage;
      const rankedDamage = storyMoveDamage(assistedDamage, ability, target.health, target.profile.tier ?? 1, target.profile.requiredFinisher);
      const baseDamage = this.human ? humanAttackDamage(target.profile.maxHealth) : storyFinisher ? target.health :
        this.wave === 25 && !this.rescueUsed ? Math.min(rankedDamage, Math.max(0,target.health-1)) : rankedDamage;
      const damage = target.profile.id === 'belial' && !this.human
        ? resolveBelialDamage(baseDamage, ability, target.rayDamageTaken, target.health)
        : baseDamage;
      if (target.profile.id === 'belial' && !this.human && isOrdinaryRay(ability)) {
        target.rayDamageTaken += damage;
      }
      if (damage === 0) {
        if (target.profile.id === 'belial') {
          this.effects.shield(end);
          this.setMessage('贝利亚抵挡普通光线！光线累计只能打掉400血，请用拳、踢或飞镖继续攻击', 3);
          return;
        }
        this.effects.shield(end);
        this.audio?.play('shield');
        this.setMessage(
          target.profile.id === 'demogea'
            ? '梅加洛杰厄的黑暗铠甲挡住攻击 · 闪耀后点击最终爆破'
            : '攻击无效！加坦杰厄的防御无法被打破',
          1.8,
        );
        this.tone(80, 0.22, 'square');
        return;
      }
      target.health = Math.max(0, target.health - damage);
      target.knockback = Math.min(5, damage * 0.055);
      if (!this.human && ability === 'boomerang') target.stunned = 1.4;
      if (!this.human && ability === 'tiga-freeze') target.stunned = 4;
      if(!this.human&&traits.pull){target.object.position.lerp(this.tiga.position,.55);target.stunned=3;}
      if(!this.human&&traits.windWall)this.windWallRemaining=4;
      if(!this.human&&traits.dash){const direction=target.object.position.clone().sub(this.tiga.position).setY(0).normalize();this.tiga.position.copy(target.object.position).addScaledVector(direction,-4);}
      if (target.health === 1 && target.profile.requiredFinisher?.length) this.setMessage(`需要特定终结招式：${target.profile.requiredFinisher.map(a=>MOVE_NAMES[a]).join(' / ')} · 点击下方招式施放`, 4);
      if (target.profile.id !== 'gatanothor') {
        this.lightMeter = Math.min(100, this.lightMeter + damage * 0.11);
      }
      if (ability === 'punch' || ability === 'kick') this.completeTutorialAction('attack');
      if (ability === 'delacium') this.completeTutorialAction('light');
      this.audio?.play('monster-hit');
      if (target.health <= 0) this.defeatMonster(target);
    });
    if (released) this.autoRescueRay = false;
    this.updateHud();
  }

  private demogeaFinisher() {
    if (this.defeatReason || this.victory || this.attackCooldown > 0) return;
    const target = this.nearestMonster();
    if (!target || target.profile.id !== 'demogea') {
      this.setMessage('迪莫杰厄还没有出现，6键暂时无法使用', 1.5);
      return;
    }
    if (this.form !== 'shining'&&this.form!=='small-shining') {
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
    this.demogeaFinisherPhase = 'entry';
    this.demogeaFinisherTimer = 0;
    this.demogeaFinisherTarget = target;
    this.demogeaFinisherStart.copy(this.tiga.position).add(new THREE.Vector3(1.25, 5.1, 0));
    this.demogeaFinisherEnd.copy(target.object.position).add(new THREE.Vector3(0, 4.8, 0));
    this.demogeaBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 24, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0xffe58c,
        emissive: 0xff9c3f,
        emissiveIntensity: 4.2,
        roughness: 0.18,
        clearcoat: 0.8,
      }),
    );
    this.demogeaBall.position.copy(this.demogeaFinisherStart);
    this.demogeaBall.castShadow = true;
    this.scene.add(this.demogeaBall);
    this.setTigaVisibility(false);
    this.audio?.play('transform');
    this.setMessage('6：闪耀迪迦化作光球，钻入迪莫杰厄体内', 2.2);
    this.updateHud();
  }

  private updateDemogeaFinisher(delta: number) {
    const target = this.demogeaFinisherTarget;
    const ball = this.demogeaBall;
    if (!target || !ball || !this.demogeaFinisherPhase) return;
    this.demogeaFinisherTimer += delta;
    if (this.demogeaFinisherPhase === 'entry') {
      const progress = Math.min(1, this.demogeaFinisherTimer / 0.82);
      const eased = 1 - (1 - progress) ** 3;
      ball.position.lerpVectors(this.demogeaFinisherStart, this.demogeaFinisherEnd, eased);
      ball.position.y += Math.sin(progress * Math.PI) * 1.4;
      ball.rotation.x += delta * 13;
      ball.rotation.y += delta * 17;
      if (progress >= 1) {
        this.effects.demogeaBurst(ball.position.clone(), this.demogeaFinisherEnd);
        target.health = 0;
        target.knockback = 5;
        this.audio?.play('demogea-burst');
        this.tone(920, 0.22, 'sawtooth');
        ball.visible = false;
        this.demogeaFinisherPhase = 'exit';
        this.demogeaFinisherTimer = 0;
        this.tiga.position.x = target.object.position.x - 1.25;
        this.tiga.position.y = 0;
        this.setTigaVisibility(this.perspective !== 'first');
        this.setMessage('体内爆破成功！迪迦从迪莫杰厄体内跳出', 1.8);
      }
      return;
    }

    const progress = Math.min(1, this.demogeaFinisherTimer / 0.78);
    this.tiga.position.x = target.object.position.x - 1.25 - (1 - progress) * 0.85;
    this.tiga.position.y = Math.sin(progress * Math.PI) * 4.3;
    this.tiga.rotation.x = -0.35 + progress * 0.35;
    if (progress >= 1) {
      this.tiga.position.y = 0;
      this.tiga.rotation.x = 0;
      this.demogeaFinisherPhase = null;
      this.demogeaFinisherTarget = null;
      this.setTigaVisibility(this.perspective !== 'first');
      this.defeatMonster(target);
      this.disposeDemogeaBall();
    }
  }

  private disposeDemogeaBall() {
    if (!this.demogeaBall) return;
    this.scene.remove(this.demogeaBall);
    this.demogeaBall.geometry.dispose();
    const materials = Array.isArray(this.demogeaBall.material)
      ? this.demogeaBall.material
      : [this.demogeaBall.material];
    materials.forEach((material) => material.dispose());
    this.demogeaBall = null;
  }

  private playAbilityEffect(ability: Ability, start: THREE.Vector3, end: THREE.Vector3) {
    const traits=heroSkillTraits(this.hero,ability),color=HEROES[this.hero].accent;
    if(this.hero==='zero'&&ability==='boomerang'){
      for(const side of [-1,1])this.effects.boomerang(start.clone().add(new THREE.Vector3(side*.65,.7,0)),end.clone().add(new THREE.Vector3(side*.3,0,0)));return;
    }
    if(this.hero==='zero'&&this.zeroUltimate&&ability==='tiga-slash'){
      this.effects.slash(start,end);this.effects.beam(start,end,0x6fd9ff,.45);return;
    }
    if(traits.pull){this.effects.freeze(start,end);this.effects.impact(end,0xa89bff,4);return;}
    if(traits.area){for(let i=0;i<8;i++){const angle=i*Math.PI/4;this.effects.beam(end,end.clone().add(new THREE.Vector3(Math.cos(angle)*traits.area,-4.5,Math.sin(angle)*traits.area)),color,.18);}this.effects.impact(end,color,4);return;}
    if(traits.hits===3){for(let i=-1;i<=1;i++)this.effects.beam(start.clone().add(new THREE.Vector3(i*2,0,0)),end,color,.18);return;}
    if(traits.windWall){this.effects.windWall(this.tiga.position,this.tiga.rotation.y);return;}
    if(this.hero==='yasuo'&&!['punch','kick'].includes(ability)){this.effects.slash(start,end);if(ability==='super-lightning'||ability==='evolution-ray')this.effects.lightning(start,end);return;}
    if(this.hero!=='tiga'&&['zeperion','evolution-ray','delacium','runboldt'].includes(ability)){this.effects.beam(start,end,ability==='evolution-ray'?0xffdb80:color,ability==='evolution-ray'?.45:.3);return;}
    if (ability === 'tiga-freeze') {this.effects.freeze(start,end);return;}
    if (ability === 'tiga-slash') {this.effects.slash(start,end);return;}
    if (ability === 'flying-charge') {this.effects.flyingKick(start,end);return;}
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
    monster.stunned = 99;monster.object.position.y = Math.max(-1,monster.object.position.y);
    if(this.wave===1 && monster.profile.id==='golza') this.golzaDefeatedEarly = true;
    this.audio?.play(monster.profile.id === 'demogea' ? 'explosion' : 'defeat');
    this.effects.impact(monster.object.position.clone().add(new THREE.Vector3(0, 4, 0)), 0xff784c, 3.5);
    this.lightMeter = Math.min(100, this.lightMeter + 25);
    if(this.pendingMonsters?.length){
      this.scene.remove(monster.object);disposeObject(monster.object);
      this.monsters.splice(this.monsters.indexOf(monster),1);
      this.spawnMonster(this.pendingMonsters.shift()!,this.monsters.length,6);
    }
    if (this.livingMonsters().length === 0 && !this.pendingMonsters?.length) {
      this.pendingRay = null;
      this.beginOutro();
    }
  }

  private beginOutro(){
    const zeroHealthWin=this.health<=0;
    this.lastStand.reset();this.explosionTimer=null;
    this.deepSpaceSlam.cancel();this.slamTarget=null;this.flightExplosion=false;
    this.storyMode='outro';this.storyTime=0;this.outroDuration=remainingOutro(this.episodeElapsed);
    this.heldActions.clear();this.victoryFlight.reset();
    this.setMessage(zeroHealthWin?'胜利！零血最后反击成功，怪兽先倒下，本集获胜！':'胜利！本集怪兽已被击败',8);
  }

  private beginCombat() {
    if(skipReturnEpisode(this.wave, this.golzaDefeatedEarly)){
      this.monsters.forEach(m=>{m.defeated=true;m.object.visible=false;});
      this.beginOutro();
      this.setMessage('哥尔赞已在第一集被击败，逆袭事件没有发生。',6);return;
    }
    this.storyMode = 'combat';this.storyTime = 0;this.battleTime=0;this.assistTimer=0;this.assistStep=0;
    this.victoryFlight.visible=false;this.story.showMission('',false);
    this.tiga.position.set(-9,0,0);this.humanModel.position.copy(this.tiga.position);
    this.tutorialStage = 'done';
    this.heldActions.clear();
    this.setMessage(this.playMode==='story'?'自动战斗演出中 · 可以在上方切换手动或自由探索':'方向键移动 · F/J 前后 · 拖动旋转镜头 · 9 变身', 6);
  }

  private nextEpisode() {
    this.heldActions.clear();this.audio?.setClimax(false);
    if(this.wave===FINAL_WAVE){this.storyMode='ending';this.storyTime=0;this.victory=true;return;}
    if (this.wave === 52) { this.storyMode = 'timeskip';this.storyTime = 0;return; }
    this.wave = Math.min(FINAL_WAVE, this.wave + 1);this.spawnWave();
  }

  private spawnWave() {
    this.deepSpaceSlam.cancel();this.slamTarget=null;this.lastStand.reset();this.flightExplosion=false;
    this.monsters.splice(0).forEach((monster) => {
      this.scene.remove(monster.object);
      disposeObject(monster.object);
    });
    const episode = this.currentEpisode();
    const count = episode.enemies.length;
    this.pendingMonsters=episode.enemies.slice(6);
    this.deaths = 0;this.shiningUnlocked = false;this.lightMeter = 0;
    this.smallShiningRemaining=SMALL_SHINING_SECONDS;this.formRemaining=NORMAL_FORM_SECONDS;
    this.parachuting=false;this.parachute.visible=false;this.gliding=false;this.windWallRemaining=0;
    this.defeatReason = null;this.reviving = false;this.revivalMethod = null;this.recharging = false;
    this.rescueTime = null;this.rescueUsed = false;this.autoRescueRay = false;
    this.demogeaFinisherPhase = null;this.demogeaFinisherTarget = null;this.disposeDemogeaBall();
    this.victory = false;this.jumpVelocity = 0;this.setStatueMaterial(false);
    this.pendingRay = null;this.attackCooldown = 0;this.attackPoseTimer = 0;this.transformTime=null;
    this.episodeElapsed=0;this.outroDuration=OUTRO_SECONDS;this.cinematicCooldown=0;this.pilotRewarded=false;
    this.growthLevel=0;this.renderedGrowth=1;this.explosionTimer=null;this.explosionCooldown=0;
    this.shrinkPresses=0;this.cosmosTeleport.reset();this.gammaActive=false;this.gammaTimer=0;this.gammaAttackCooldown=0;
    this.spaceGesture.reset();this.victoryFlight.reset();this.earth.scale.setScalar(1);
    this.spawnTimer = 0;this.storyMode = 'watch';this.storyTime = 0;
    this.introLaserPlayed = false;
    this.heldActions.clear();this.climaxHold = 0;
    this.human = true;this.tiga.visible = false;this.humanModel.visible = true;
    this.setForm('multi');
    this.applyLevelEnvironment();
    this.climbedMonster = null;
    this.tiga.position.set(-9, 0, 0);
    this.flying = false;
    this.spaceFlying = false;
    this.earthView = false;
    this.earth.visible=false;
    this.camera.position.set(-12,6,24);
    this.health = 100;
    this.energy = 100;
    for (let index = 0; index < Math.min(count,6); index += 1) {
      this.spawnMonster(episode.enemies[index],index,Math.min(count,6));
    }
    this.humanModel.position.copy(this.tiga.position);
    this.exploration.update(this.tiga.position,episode.region);
    this.setMessage(episode.title, 4);
  }

  private spawnMonster(profile:MonsterProfile,index:number,count:number){
      const object = createMonster(profile);
      if(count>=6){const angle=index/count*Math.PI*2;object.position.set(Math.sin(angle)*(35+index%3*10),0,Math.cos(angle)*(35+index%3*10));}
      else object.position.set(9 + index * 2.2, 0, (index - (count - 1) / 2) * 2.1);
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
        rayDamageTaken: 0,
        escapeTimer: 0,
      });
  }

  private applyLevelEnvironment() {
    const region = this.currentEpisode().region;
    const level = LEVELS[region - 1];
    this.groundCity.value=region===1?1:0;
    const sky = this.scene.getObjectByName('earth-sky');
    if (sky) sky.visible = true;
    if (sky instanceof THREE.Mesh && sky.material instanceof THREE.ShaderMaterial) {
      const palettes = [[0x2564b0,0xb9d8ee],[0x101c43,0x697eac],[0x77364f,0xedb07e],[0x0d1040,0x53468d],[0x236675,0xb6f8dc]];
      sky.material.uniforms.topColor.value.setHex(palettes[region-1][0]);
      sky.material.uniforms.horizonColor.value.setHex(palettes[region-1][1]);
    }
    const city = this.scene.getObjectByName('earth-city');
    if (city) city.visible = false;
    this.levelGround.visible = true;
    this.levelGround.material.transparent = region === 4;
    this.levelGround.material.opacity = region === 4 ? 0.24 : 1;
    this.levelGround.material.color.setHex(region === 1 ? 0x4d6675 : level.ground);
    this.scene.background = new THREE.Color(level.color);
    this.scene.fog = new THREE.FogExp2(region === 1 ? 0xa5c9e5 : level.color, 0.004);
    const ground = this.scene.getObjectByName('city-ground');
    if (ground instanceof THREE.Mesh) (ground.material as THREE.MeshStandardMaterial).color.setHex(level.ground);
    this.levelScenery.children.slice().forEach(child => { this.levelScenery.remove(child); disposeObject(child); });
    this.levelScenery.add(createLevelBackground(region));
    this.levelScenery.add(createHeroStage(this.hero));
  }

  private update(delta: number, realDelta=delta) {
    this.cosmosTeleport.update(realDelta);
    if(this.gammaActive){
      this.gammaTimer=Math.max(0,this.gammaTimer-realDelta);this.gammaAttackCooldown-=realDelta;
      if(this.gammaTimer<=0){this.gammaActive=false;this.setMessage('伽马未来结束，幻象返回泽塔',2);}
      else if(this.gammaAttackCooldown<=0&&this.storyMode==='combat'&&this.livingMonsters().length){
        this.gammaAttackCooldown=1.15;const target=this.nearestMonster()!;const damage=18;
        target.health=Math.max(0,target.health-damage);target.stunned=.35;
        this.effects.beam(target.object.position.clone().add(new THREE.Vector3(8,6,0)),target.object.position.clone().add(new THREE.Vector3(0,4,0)),0x8feaff,.18);
        if(target.health<=0)this.defeatMonster(target);
      }
    }
    const gesture=this.spaceGesture.update(performance.now()/1000);
    if(gesture==='explore'&&this.started)this.setPlayMode('explore');
    if(gesture==='hold'&&!this.flightExplosion)this.startUltraExplosion();
    if(this.started&&!this.human&&!this.defeatReason&&!['watch','outro','timeskip','ending'].includes(this.storyMode)){
      if(this.form==='small-shining'){
        this.smallShiningRemaining=Math.max(0,this.smallShiningRemaining-realDelta);
        if(this.smallShiningRemaining===0&&!this.deepSpaceSlam.active&&!this.pendingRay){this.setForm('multi');this.setMessage('小闪耀的一分钟结束，恢复普通形态',4);}
      }else if(this.form!=='shining'&&!this.parachuting){
        this.formRemaining=Math.max(0,this.formRemaining-realDelta);
        if(this.formRemaining===0&&this.health>0&&!this.deepSpaceSlam.active&&!this.pendingRay){this.handleAction('human-form',true);this.formRemaining=NORMAL_FORM_SECONDS;}
      }
    }
    if(this.started&&this.playMode!=='explore'&&!['timeskip','ending'].includes(this.storyMode))this.episodeElapsed+=delta;
    this.explosionCooldown=Math.max(0,this.explosionCooldown-delta);
    this.windWallRemaining=Math.max(0,this.windWallRemaining-delta);
    document.body.dataset.play=this.playMode;
    this.exploration.update(this.tiga.position,this.currentEpisode().region);
    this.levelGround.position.x=this.tiga.position.x;
    this.levelGround.position.z=this.tiga.position.z;
    const key=this.scene.getObjectByName('follow-key-light');
    if(key instanceof THREE.DirectionalLight) {
      key.position.copy(this.tiga.position).add(new THREE.Vector3(-12,24,14));
      key.target.position.copy(this.tiga.position);
    }
    const sky=this.scene.getObjectByName('earth-sky');
    sky?.position.copy(this.tiga.position);
    const stars=this.scene.getObjectByName('exploration-stars');
    stars?.position.copy(this.tiga.position);
    if(stars)stars.visible=this.tiga.position.y>70||this.currentEpisode().region!==1||this.growthLevel>=6;
    if(sky instanceof THREE.Mesh&&sky.material instanceof THREE.ShaderMaterial&&this.storyMode==='combat') {
      const high=THREE.MathUtils.smoothstep(this.tiga.position.y,60,500);
      if(this.currentEpisode().region===1) {
        sky.material.uniforms.topColor.value.setHex(0x2564b0).lerp(new THREE.Color(0x01030c),high);
        sky.material.uniforms.horizonColor.value.setHex(0xb9d8ee).lerp(new THREE.Color(0x111a36),high);
      }
    }
    if(this.scene.fog instanceof THREE.FogExp2)this.scene.fog.density=this.tiga.position.y>150?0:.004;
    const cinema=this.started&&this.playMode!=='explore'&&(this.storyMode==='watch'||this.storyMode==='outro');
    const currentScene=episodeScene(this.storyTime);
    this.cast.visible=cinema&&(!['launch','pilot','monster','counterattack'].includes(currentScene.kind)||this.storyMode==='outro');
    this.victoryFlight.visible=cinema;
    this.cast.children.forEach((person,index)=>{
      const walking=this.storyMode==='watch'&&(currentScene.kind==='rescue'||currentScene.kind==='resolve');
      person.position.x=-11+index*1.3+(walking?Math.sin(currentScene.local*.14+index)*5:0);
      const mouth=person.getObjectByName('mouth');
      if(mouth)mouth.scale.y=.18+Math.abs(Math.sin(this.storyTime*10+index))*.3;
      for(const side of ['left','right']) {
        const arm=person.getObjectByName(`${side}-arm`),leg=person.getObjectByName(`${side}-leg`);
        const phase=side==='left'?1:-1;
        if(arm)arm.rotation.x=walking?Math.sin(this.storyTime*7+index)*.4*phase:Math.sin(this.storyTime*1.5+index)*.08;
        if(leg)leg.rotation.x=walking?-Math.sin(this.storyTime*7+index)*.4*phase:0;
      }
    });
    const size=giantSize(this.growthLevel);
    this.story.showTravel(this.started&&this.playMode==='explore'
      ? `${this.human?'人类 · 地面探索':altitudeLabel(this.tiga.position.y)}${!this.human?`\n身高 ${size.height}${size.largerThanEarth?' · 已大于地球直径':''}`:''}\n高度 ${Math.round(this.tiga.position.y)} · 坐标 ${Math.round(this.tiga.position.x)}, ${Math.round(this.tiga.position.z)}\n←→ 横移 · F/J 前后 · ↑ 跳跃或上升\n9 变身 · B 飞行 · ↓ 下降 · 7 降落\n双击空格继续长大 · 返回剧情按钮继续`
      :'');
    this.effects.update(delta);
    this.animateCharacters(delta);
    const elapsed = this.attackPoseDuration - this.attackPoseTimer;
    const rayActive = !this.human && this.attackPoseTimer>0 &&
      !['punch','kick','boomerang','demogea-finish'].includes(this.attackPose);
    const skillColors:Partial<Record<Ability,string>>={delacium:'#ff985d',zeperion:'#b7eeff',runboldt:'#9eabff','evolution-ray':'#ffe49d','super-lightning':'#ffe49d','tiga-freeze':'#8bdeff','tiga-slash':'#c7faff','flying-charge':'#ffce82'};
    const phaseLabel = this.attackPose==='tiga-slash' ? (elapsed<RAY_CHARGE_SECONDS?'举臂 · 凝聚光刃':'正在挥出') :
      this.attackPose==='flying-charge' ? (elapsed<RAY_CHARGE_SECONDS?'跃起 · 蓄势':'正在冲击') :
      this.attackPose==='tiga-freeze' ? (elapsed<RAY_CHARGE_SECONDS?'双掌前推 · 凝聚寒气':'正在发射') :
      {cross:'双手交叉',spread:'展开双臂',aim:'瞄准 · 汇聚光芒',fire:'正在发射'}[rayPhase(elapsed)];
    const slamCaption={ascent:'飞向宇宙 · 突破太阳系','solar-system':'太阳系全景 · 迪迦远去缩小',descent:'锁定战场 · 宇宙俯冲',impact:'落地重击'}[slamPhase(this.deepSpaceSlam.time)];
    this.story.showSkill(this.deepSpaceSlam.active?(this.flightExplosion?`飞行爆炸 ★★★★ · ${this.deepSpaceSlam.time<GALAXY_EXIT_SECONDS?`连续飞行连爆 · 飞出银河系 ${Math.ceil(GALAXY_EXIT_SECONDS-this.deepSpaceSlam.time)} 秒`:'已飞出银河系 · 连爆结束，俯冲飞回战场'} · 保护 ${Math.ceil(30-this.deepSpaceSlam.time)} 秒`:`${slamCaption} · ${this.skillName('flying-charge')} ★★★★`):this.explosionTimer!==null?'正在蓄力 · 奥特爆炸 ★★★★':rayActive?`${phaseLabel} · ${this.skillName(this.attackPose as Ability)}`:'',this.explosionTimer!==null||this.deepSpaceSlam.active?'#ffcc78':skillColors[this.attackPose as Ability]??'#b7eeff');
    this.story.showKo(this.defeatReason === 'defeated', this.rescueTime !== null);
    if (this.attackPoseTimer > 0) this.attackPoseTimer = Math.max(0,this.attackPoseTimer-delta);
    this.story.render(this.started, this.storyMode, this.currentEpisode(), this.wave, this.storyTime, this.deaths,this.episodeElapsed,this.playMode==='explore');
    this.audio?.setClimax(this.started && this.playMode!=='explore' && ((this.storyMode==='watch'&&['counterattack','resolve'].includes(currentScene.kind)) || (this.storyMode === 'combat' &&
      (this.reviving || this.rescueTime !== null || this.climaxHold > 0 || this.health <= 25 || this.livingMonsters().some(m=>m.health/m.profile.maxHealth < .3)))));
    if (this.climaxHold > 0) this.climaxHold -= delta;
    if(this.started&&this.playMode==='explore'){
      if(this.transformTime===null){
        this.renderedGrowth=THREE.MathUtils.lerp(this.renderedGrowth,size.visual,Math.min(1,delta*.65));
        const proportions=this.form==='power'?[1.03,.92,.98]:this.form==='sky'?[.84,.96,.86]:[.92,.94,.92];
        this.tiga.scale.set(...proportions as [number,number,number]).multiplyScalar(this.renderedGrowth);
        if(this.growthLevel>0){
          const factor=this.renderedGrowth;this.camera.far=2000*factor;this.camera.updateProjectionMatrix();
          sky?.scale.setScalar(factor);stars?.scale.setScalar(factor);
          if(this.growthLevel>=6){
            this.earth.visible=true;this.earthView=true;this.earth.scale.setScalar(Math.min(1500,size.earthScale*factor/size.visual));this.levelGround.visible=false;this.levelScenery.visible=false;this.exploration.visible=false;this.scene.fog=null;
            if(sky instanceof THREE.Mesh&&sky.material instanceof THREE.ShaderMaterial){sky.material.uniforms.topColor.value.setHex(0x01030c);sky.material.uniforms.horizonColor.value.setHex(0x111a36);}
          }
        }
        this.updatePlayer(delta);
      }
      this.story.showMission('',false);
      if(this.transformTime===null)return;
    }
    if (this.started && this.storyMode !== 'combat'&&this.playMode!=='explore') {
      this.storyTime += delta;
      this.updateCinematic(delta);
      if(this.wave===1 && this.storyMode==='watch' && this.storyTime>724 && !this.introLaserPlayed){
        this.introLaserPlayed=true;
        const golza=this.monsters.find(m=>m.profile.id==='golza');
        const pyramid=this.levelScenery.getObjectByName('ancient-pyramid');
        if(golza&&pyramid){
          const start=golza.object.localToWorld(new THREE.Vector3(0,8.2,.5));
          const end=pyramid.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,2,0));
          this.effects.beam(start,end,0xb969ff,.3);this.effects.impact(end,0xffc47d,4);
          this.audio?.play('explosion');
        }
      }
      if(this.wave===1 && this.introLaserPlayed && this.storyTime>724.5){const pyramid=this.levelScenery.getObjectByName('ancient-pyramid');if(pyramid)pyramid.scale.y=THREE.MathUtils.lerp(pyramid.scale.y,.08,delta*3);}
      if (this.storyMode === 'watch' && this.storyTime >= INTRO_SECONDS) this.beginCombat();
      else if (this.storyMode === 'outro' && this.storyTime >= this.outroDuration) this.nextEpisode();
      else if (this.storyMode === 'timeskip' && this.storyTime >= 5) {this.wave=53;this.spawnWave();}
      return;
    }
    if(this.combatAircraft){
      this.victoryFlight.visible=true;
      this.victoryFlight.update(300,delta,this.heldActions,false,(a,b,color)=>this.effects.beam(a,b,color,.13));
      this.humanModel.visible=true;this.humanModel.position.copy(this.victoryFlight.lead.position).add(new THREE.Vector3(0,-.7,0));
      this.submarine.visible=false;
      if(this.victoryFlight.crashed){this.combatAircraft=false;this.victoryFlight.visible=false;this.human=true;this.humanModel.visible=true;this.setMessage('战机被击落，返回人类战斗',3);}
      return;
    }
    this.submarine.visible=this.submarineMode;
    if(this.submarineMode){
      const right=Number(this.heldActions.has('move-right'))-Number(this.heldActions.has('move-left'));
      const forward=Number(this.heldActions.has('move-forward'))-Number(this.heldActions.has('move-back'));
      const vertical=Number(this.heldActions.has('jump'))-Number(this.heldActions.has('move-down'));
      this.tiga.position.x+=right*flightSpeed(0)*1.6*delta;this.tiga.position.z-=forward*flightSpeed(0)*1.6*delta;
      this.tiga.position.y=THREE.MathUtils.clamp(this.tiga.position.y+vertical*flightSpeed(0)*delta,-80,-4);
      this.submarine.position.copy(this.tiga.position);this.submarine.rotation.y=Math.atan2(right,forward||1);
      this.humanModel.visible=true;this.humanModel.position.copy(this.tiga.position).add(new THREE.Vector3(0,1.2,0));
    }
    if (!this.started || this.victory) return;
    if(this.parachuting){
      this.parachuteTime+=realDelta;
      this.tiga.position.y=Math.max(8,this.tiga.position.y-realDelta*2);
      this.humanModel.position.copy(this.tiga.position);this.parachute.position.copy(this.tiga.position).add(new THREE.Vector3(0,4,0));
      if(this.parachuteTime>2){this.human=false;this.humanModel.visible=false;this.tiga.visible=true;this.parachute.visible=false;this.tiga.scale.setScalar(.08+.92*Math.min(1,(this.parachuteTime-2)/4));}
      if(this.parachuteTime>=6){this.parachuting=false;this.glideUnlocked=true;this.gliding=true;this.setForm(this.form);this.setMessage(`空中变身完成！滑行已解锁 · ↑ 高跳 ${jumpHeightLabel(this.form)}`,5);}
      return;
    }
    if(!this.defeatReason&&this.updateLastStand(realDelta))return;
    if(this.transformTime!==null) {
      this.transformTime+=delta;
      const progress=THREE.MathUtils.smoothstep(this.transformTime,.5,TRANSFORM_SECONDS-1);
      this.tiga.scale.set(.92,.94,.92).multiplyScalar((.08+.92*progress)*this.renderedGrowth);
      this.tiga.position.y=Math.sin(progress*Math.PI)*1.2;
      const right=this.tiga.getObjectByName('right-arm');
      if(right)right.rotation.x=-Math.PI*.9;
      if(this.transformTime>=TRANSFORM_SECONDS){this.transformTime=null;this.setForm(this.form);this.tiga.position.y=0;this.setMessage('迪迦，登场！双击空格继续变大',3);}
      return;
    }
    if(this.explosionTimer!==null){this.updateUltraExplosion(delta);return;}
    if(this.deepSpaceSlam.active){this.updateDeepSpaceSlam(realDelta);return;}
    if (this.rescueTime !== null) {
      this.rescueTime += delta;
      this.tiga.rotation.z = THREE.MathUtils.lerp(this.tiga.rotation.z, this.rescueTime < 4 ? -1.3 : 0, delta * 2);
      if (this.rescueTime >= 6) {
        this.rescueTime = null;this.health = 100;this.energy = 100;
        this.setStatueMaterial(false);this.setForm('multi');this.attackCooldown = 0;
        this.autoRescueRay = true;this.attack('zeperion');
      }
      return;
    }
    if (this.messageTimer > 0) this.messageTimer -= delta;
    if (this.attackCooldown > 0) this.attackCooldown -= delta;
    if (this.pendingRay && !this.defeatReason) {
      this.pendingRay.timer -= delta;
      if (this.pendingRay.timer <= 0) {
        const { ability, target } = this.pendingRay;this.pendingRay = null;
        this.attack(ability, true, target);
      }
    }
    if(this.storyMode!=='combat')return;
    if (this.flightTapWindow > 0) {
      this.flightTapWindow -= delta;
      if (this.flightTapWindow <= 0) this.flightTapCount = 0;
    }
    if (this.perspectiveKeyWindow > 0) {
      this.perspectiveKeyWindow -= delta;
      if (this.perspectiveKeyWindow <= 0) this.perspectiveKey = null;
    }

    if (this.demogeaFinisherPhase) {
      this.updateDemogeaFinisher(delta);
      return;
    }

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

    if(this.playMode==='story')this.updateAssistedBattle(delta);
    if(this.playMode==='manual'&&this.attackCooldown<=0){
      const held=['punch','kick','boomerang'].find(a=>this.heldActions.has(a as GameAction));
      if(held)this.attack(held as Ability);
    }
    if(this.transformTime!==null||this.deepSpaceSlam.active||this.storyMode!=='combat')return;
    this.updatePlayer(delta);
    if (this.tutorialStage !== 'done') return;
    if(this.playMode!=='explore')this.updateMonsters(delta);
    if(this.storyMode!=='combat')return;
    if (shouldRescueWithLight(this.wave, this.rescueUsed, this.health, this.energy) ||
      (this.wave === 25 && !this.rescueUsed && this.monsters.some(m=>m.health/m.profile.maxHealth<=.2))) {
      this.beginLightRescue();return;
    }
    const energyDrain = this.human || this.playMode==='explore' || hasInfiniteEnergy(this.form) ? 0 : delta * 0.24;
    this.energy = normalizeEnergy(this.form, this.energy - energyDrain);
    if (hasInfiniteEnergy(this.form)) this.energyPhase = 'stable';
    this.updateEnergyPhase();
    if (this.health <= 0) this.updateLastStand(0);
    else if (this.energy <= 0 && !this.isGatanothorBattle()) this.turnToStone('exhausted');

    if (this.spawnTimer > 0) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        this.nextEpisode();
      }
    }
  }

  private updateCinematic(delta:number){
    if(!['watch','outro'].includes(this.storyMode)){this.story.showMission('',false);return;}
    const scene=episodeScene(this.storyTime);
    const flightTime=this.storyMode==='outro'?180+this.storyTime:this.storyTime;
    const result=this.victoryFlight.update(flightTime,delta,this.heldActions,false,(a,b,color)=>this.effects.beam(a,b,color,.13));
    if(result.pilot&&this.storyMode==='watch'){
      const position=this.victoryFlight.lead.position;
      this.exploration.update(position,this.currentEpisode().region);
      this.levelGround.position.set(position.x,0,position.z);
      this.scene.getObjectByName('earth-sky')?.position.copy(position);
      this.scene.getObjectByName('exploration-stars')?.position.copy(position);
      this.story.showMission(`胜利飞跃号 · 剩余 ${formatTime(result.remaining)}\n生命 ${Math.round(this.victoryFlight.shield)}/50 · 命中 ${this.victoryFlight.hits} · 航路环 ${this.victoryFlight.gates}\nA/←左移 · D/→右移 · ↑/↓升降 · F/J前后\nD 左激光 · K 右激光 · P 跳伞\n${this.victoryFlight.crashed?'战机被击落！按 P 或点击跳伞，空中变身':this.victoryFlight.targetLocked?'已锁定目标 · 可发射':'瞄准能量目标 · 转向躲避紫色光线'}`,this.victoryFlight.targetLocked);
    }else{
      this.story.showMission('',false);
      if(this.storyTime>=540&&!this.pilotRewarded&&this.storyMode==='watch'){
        this.pilotRewarded=true;this.heldActions.clear();
        const suppression=Math.min(.15,this.victoryFlight.hits*.003+this.victoryFlight.gates*.005);
        for(const target of this.monsters)target.health=Math.max(target.profile.maxHealth*.85,target.health-target.profile.maxHealth*suppression);
        this.setMessage(`掩护完成 · 命中 ${this.victoryFlight.hits} · 战机压制削弱怪兽 ${Math.round(suppression*100)}%`,6);
      }
    }
    if(this.storyMode==='watch'&&this.storyTime>=540){this.beginCombat();return;}
    if(this.storyMode==='outro')return;
    this.cinematicCooldown-=delta;
    const action=['monster','counterattack'].includes(scene.kind);
    this.monsters.forEach((monster,index)=>{
      monster.object.position.set(9+index*5+Math.sin(scene.local*.06)*3,0,Math.sin(scene.local*.04+index)*4);
      monster.object.rotation.y=Math.atan2(-20-monster.object.position.x,10-monster.object.position.z);
      for(const side of ['left','right']){
        const arm=monster.object.getObjectByName(`${side}-arm`);
        if(arm)arm.rotation.x=-.3+Math.sin(scene.local*2+index)*.4;
      }
    });
    if(action&&this.cinematicCooldown<=0){
      this.cinematicCooldown=scene.kind==='counterattack'?3:5;
      const monster=this.monsters[Math.floor(scene.local/5)%this.monsters.length];
      if(monster){
        const head=monster.object.localToWorld(new THREE.Vector3(0,7.8,.5));
        const street=new THREE.Vector3(-20+Math.sin(scene.local)*18,.4,12+Math.cos(scene.local*.7)*18);
        this.effects.beam(head,street,0xbc70ed,.3);this.effects.impact(street,0xff9863,3);this.audio?.play('explosion');
        if(scene.kind==='counterattack'){
          this.effects.beam(this.victoryFlight.lead.position.clone(),head,0x7ce9ff,.14);this.effects.impact(head,0xffd18d,1.2);
        }
      }
    }
  }

  private updateAssistedBattle(delta:number) {
    this.battleTime+=delta;this.assistTimer-=delta;
    if(this.human){if(this.battleTime>1.8)this.handleAction('transform',true);return;}
    const target=this.nearestMonster();
    if(!target||this.pendingRay||this.attackPoseTimer>0||this.assistTimer>0)return;
    if((this.isGatanothorBattle()||this.isDemogeaBattle())&&!this.shiningUnlocked&&this.battleTime>16&&this.health>0){
      this.health=0;this.updateLastStand(0);return;
    }
    const offset=target.object.position.clone().sub(this.tiga.position);offset.y=0;
    const distance=offset.length();
    if(distance>4){this.tiga.position.addScaledVector(offset.normalize(),Math.min(distance-3.8,delta*10));return;}
    this.energy=Math.max(55,this.energy);
    if(this.isDemogeaBattle()&&this.shiningUnlocked){this.demogeaFinisher();return;}
    const ready=canFireStoryRay(episodeAt(this.wave),target.health,target.profile.maxHealth,target.escapeTimer>0,this.shiningUnlocked);
    const finisher=target.profile.requiredFinisher?.[0]??(this.isGatanothorBattle()?'super-lightning':'zeperion');
    this.attack(ready?finisher:(this.assistStep++%3===0?'kick':'punch'));
    this.assistTimer=ready?2.5:.85;
  }

  private updatePlayer(delta: number) {
    if(!this.human&&this.gliding){
      const forward=Number(this.heldActions.has('move-forward'))-Number(this.heldActions.has('move-back'));
      const turn=Number(this.heldActions.has('move-right'))-Number(this.heldActions.has('move-left'));
      this.tiga.position.x+=turn*18*delta;this.tiga.position.z-=(forward||.6)*18*delta;
      this.tiga.position.y=Math.max(0,this.tiga.position.y-delta*2);
      if(this.tiga.position.y===0)this.gliding=false;return;
    }
    if (this.climbWindow > 0) this.climbWindow -= delta;
    if (this.human) {
      const direction = Number(this.heldActions.has('move-right')) - Number(this.heldActions.has('move-left'));
      const depth=Number(this.heldActions.has('move-forward'))-Number(this.heldActions.has('move-back'));
      if (direction !== 0||depth!==0) this.climbedMonster = null;
      if (this.climbedMonster && !this.climbedMonster.defeated) {
        this.tiga.position.copy(this.climbedMonster.object.position).add(new THREE.Vector3(0, 6.5, 0.7));
      } else {
        this.tiga.position.x += direction * 4 * delta;
        this.tiga.position.z -= depth * 4 * delta;
        this.tiga.position.y = Math.max(0, this.tiga.position.y + this.jumpVelocity * delta);
        this.jumpVelocity = this.tiga.position.y > 0 ? this.jumpVelocity - 12 * delta : 0;
      }
      this.humanModel.position.copy(this.tiga.position);
      return;
    }
    const direction = Number(this.heldActions.has('move-right')) - Number(this.heldActions.has('move-left'));
    const speed = 7.4 * FORM_STATS[this.form].speed * (this.pendingRay ? .25 : 1);
    const depth=Number(this.heldActions.has('move-forward'))-Number(this.heldActions.has('move-back'));
    this.tiga.position.x += direction * (this.flying?flightSpeed(this.tiga.position.y):speed) * delta;
    this.tiga.position.z -= depth * (this.flying?flightSpeed(this.tiga.position.y):speed) * delta;
    if (this.flying) {
      const vertical = Number(this.heldActions.has('jump')) - Number(this.heldActions.has('move-down'));
      this.tiga.position.y = Math.max(1,this.tiga.position.y + vertical * flightSpeed(this.tiga.position.y) * delta);
      if (this.heldActions.has('jump')) {
        this.flightUpHoldTimer += delta;
        if (canEnterEarthView(this.flightUpHoldTimer)&&this.tiga.position.y>500&&!this.earthView)this.setEarthView(true);
      } else {
        this.flightUpHoldTimer = 0;
      }
      this.tiga.position.y = THREE.MathUtils.lerp(
        this.tiga.position.y,
        this.tiga.position.y + Math.sin(performance.now() * 0.002) * (this.spaceFlying ? 0.12 : 0.08),
        delta * 2.1,
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
    if (this.human || this.flying || this.defeatReason) return;
    this.flying = true;
    this.gliding=false;
    this.spaceFlying = false;
    this.flightUpHoldTimer = 0;
    this.setEarthView(false);
    this.setSpaceGroundLighting(false);
    this.jumpHoldTimer = 3;
    this.jumpVelocity = 0;
    this.tiga.position.y = Math.max(this.tiga.position.y, 6.2);
    this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0, 4.5, 0)), 0x8feaff, 2.2);
    this.audio?.play('transform');
    this.setMessage('空战开始：←→横移，↑↓升降，F/J前后，Y防御，7落地', 3.2);
  }

  private enterSpaceFlightMode() {
    if (this.human || this.defeatReason || this.victory) return;
    if (this.spaceFlying) {
      this.setMessage('迪迦已经在宇宙空战层', 1.2);
      return;
    }
    this.flying = true;
    this.gliding=false;
    this.spaceFlying = true;
    this.flightUpHoldTimer = 0;
    this.setEarthView(false);
    this.setSpaceGroundLighting(true);
    this.flightTapCount = 0;
    this.flightTapWindow = 0;
    this.jumpHoldTimer = 0;
    this.jumpVelocity = 0;
    this.tiga.position.y = Math.max(this.tiga.position.y, 12.5);
    this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0, 4.8, 0)), 0xa9c7ff, 3.1);
    this.audio?.play('transform');
    this.setMessage('B：进入宇宙空战，↑↓调整高度，F/J前后移动，Y防御', 3.2);
  }

  private setEarthView(enabled: boolean) {
    if (this.earthView === enabled) return;
    this.earthView = enabled;
    this.earth.visible = enabled;
    if (enabled) {
      this.tiga.position.y = Math.max(this.tiga.position.y, 31);
      this.effects.impact(this.tiga.position.clone().add(new THREE.Vector3(0, 3.8, 0)), 0x78d9ff, 3.4);
      this.audio?.play('transform');
      this.setMessage('地球观景：持续按住↑可从高空看见旋转的地球', 3.2);
    } else if (this.flying) {
      this.setMessage('返回飞行战场：↑↓调整高度，F/J前后移动', 2.2);
    }
  }

  private handlePerspectiveKey(key: PerspectiveKey) {
    if (this.defeatReason || this.victory) return;
    if (canTogglePerspective(this.perspectiveKey, key, this.perspectiveKeyWindow)) {
      this.perspective = this.perspective === 'first' ? 'second' : 'first';
      this.perspectiveKey = null;
      this.perspectiveKeyWindow = 0;
      this.setTigaVisibility(this.perspective !== 'first');
      this.audio?.play('transform');
      this.setMessage(
        `${this.perspective === 'first' ? '第一视角' : '第二视角'}已开启`,
        1.8,
      );
      return;
    }
    this.perspectiveKey = key;
    this.perspectiveKeyWindow = PERSPECTIVE_SWITCH_WINDOW_SECONDS;
    this.setMessage(`已按 ${key.toUpperCase()}，10秒内再按另一个键切换视角`, 2.2);
  }

  private landFromFlight() {
    if (!this.flying || this.defeatReason) return;
    this.flying = false;
    this.spaceFlying = false;
    this.flightUpHoldTimer = 0;
    this.setEarthView(false);
    this.setSpaceGroundLighting(false);
    this.flightTapCount = 0;
    this.flightTapWindow = 0;
    this.jumpHoldTimer = 0;
    this.jumpVelocity = -3.8;
    // Descend where the player is, without snapping back to the original lane.
    this.setMessage('7：迪迦返回地面', 1.2);
  }

  private updateMonsters(delta: number) {
    for (const monster of this.monsters) {
      if (monster.defeated) {
        monster.object.rotation.z = THREE.MathUtils.lerp(monster.object.rotation.z, -1.38, delta * 2.2);
        monster.object.position.y = Math.max(-1.5, monster.object.position.y - delta * 0.7);
        continue;
      }
      if (this.wave === 1 && monster.profile.id === 'golza' && monster.health <= monster.profile.maxHealth * .3 && monster.escapeTimer === 0) {
        monster.escapeTimer = ESCAPE_SECONDS;
        this.setMessage('哥尔赞正在钻地！现在发射光线可锁定；完全潜入后将逃走。', ESCAPE_SECONDS);
      }
      if (monster.escapeTimer > 0) {
        monster.escapeTimer = Math.max(.001, monster.escapeTimer - delta);
        const progress = 1 - monster.escapeTimer / ESCAPE_SECONDS;
        monster.object.position.y = -progress * 8.8;
        monster.object.rotation.x = Math.sin(progress * Math.PI) * .4;
        if (monster.escapeTimer <= .001 && this.pendingRay?.target !== monster) {
          monster.defeated = true;monster.object.visible = false;
          this.setMessage('哥尔赞潜入地下逃走了 · 它将在第 18 集卷土重来', 5);
          if (!this.livingMonsters().length) this.beginOutro();
        }
        continue;
      }
      if (monster.stunned > 0) {
        monster.stunned -= delta;
        monster.object.rotation.z = Math.sin(performance.now() * 0.025) * 0.08;
        continue;
      }
      const rangedAttackAllowed = monster.profile.rangedAttack === true &&
        (!this.spaceFlying || monster.profile.rangedAttackInSpace === true);
      const cannotReachFlightLevel = this.flying &&
        (!monster.profile.canFly || (this.spaceFlying && !monster.profile.canSpaceFly));
      if (cannotReachFlightLevel && !rangedAttackAllowed) continue;
      monster.object.rotation.z = THREE.MathUtils.lerp(monster.object.rotation.z, 0, delta * 5);
      monster.attackCooldown -= delta;
      if (monster.knockback > 0) {
        monster.object.position.x += monster.knockback * delta;
        monster.knockback = Math.max(0, monster.knockback - delta * 8);
      }
      const offset=this.tiga.position.clone().sub(monster.object.position);
      const horizontalDistance = groundDistance(monster.object.position,this.tiga.position);
      monster.object.rotation.y=Math.atan2(offset.x,offset.z);
      const inRange = horizontalDistance <= monster.profile.attackRange && Math.abs(offset.y)<(rangedAttackAllowed?35:9);
      if (!inRange) {
        offset.y=0;
        if(horizontalDistance>monster.profile.attackRange)monster.object.position.addScaledVector(offset.normalize(),monster.profile.speed*(this.submarineMode?.35:1)*delta);
      } else if (monster.attackCooldown <= 0) {
        if (this.human && this.climbedMonster) {
          monster.attackCooldown = 1.55;
          const miss = this.humanModel.position.clone().add(new THREE.Vector3(3, 2, 0));
          this.effects.beam(monster.object.position.clone().add(new THREE.Vector3(0, 4, 0)), miss, 0xff6347, 0.15);
          continue;
        }
        const guarding = this.heldActions.has('guard');
        const closeRange = horizontalDistance <= 3.5;
        const attackPower = monster.profile.id === 'belial' ? belialAttackDamage(closeRange) : monster.profile.power;
        const damage = attackPower * (guarding ? 0.28 : this.playMode==='story' ? .22 : 1);
        const blockedByWind=!this.human&&this.windWallRemaining>0&&rangedAttackAllowed&&!closeRange;
        const invulnerable = !this.human && (hasInfiniteHealth(this.form)||blockedByWind||this.cosmosTeleport.protected);
        if (!invulnerable) this.health = Math.max(0, this.health - damage);
        monster.attackCooldown = monster.profile.id === 'melba' ? 1.05 : 1.55;
        const hitPosition = this.tiga.position.clone().add(new THREE.Vector3(0, 4.5, 0));
        if (rangedAttackAllowed && !(monster.profile.id === 'belial' && closeRange)) {
          const beamStart = monster.profile.id === 'golza'
            ? monster.object.localToWorld(new THREE.Vector3(0, 8.2, .7))
            : monster.object.position.clone().add(new THREE.Vector3(0, 5.4, 0));
          if (monster.profile.id === 'demogea') {
            this.effects.demogeaVolley(beamStart, hitPosition, monster.profile.rangedBeamCount ?? 7);
          } else {
            this.effects.beam(beamStart, hitPosition, 0xc95edb, 0.26);
          }
        }
        this.effects.impact(hitPosition, invulnerable ? 0xffd866 : 0xff5d42, 1.15);
        this.audio?.play('monster-attack');
        if (invulnerable) {
          this.effects.shield(hitPosition);
          this.audio?.play('shield');
          this.setMessage(this.cosmosTeleport.protected?'高斯瞬移保护中 · 怪兽无法命中':blockedByWind?'风之壁障挡住远程攻击':'闪耀型光之铠甲挡住攻击，生命不会下降', 0.95);
        } else {
          this.setMessage(guarding ? '防御成功，伤害降低' : monster.profile.id === 'belial'
            ? `贝利亚${closeRange ? '重拳 · 70伤害' : '黑暗光线 · 85伤害'}`
            : `${monster.profile.name}发动攻击`, 0.85);
        }
      }
    }
  }

  private animateCharacters(delta: number) {
    const time = performance.now() * 0.001;
    if (!this.defeatReason) {
      const idle = Math.sin(time * 2.4) * 0.035;
      const lateralInput = Number(this.heldActions.has('move-right')) - Number(this.heldActions.has('move-left'));
      const depthInput = Number(this.heldActions.has('move-forward')) - Number(this.heldActions.has('move-back'));
      const verticalInput = Number(this.heldActions.has('jump')) - Number(this.heldActions.has('move-down'));
      const flightRoll = this.flying ? -lateralInput * 0.24 : idle;
      const flightPitch = this.flying ? -0.28 - verticalInput * 0.12 + depthInput * 0.08 : 0;
      this.tiga.rotation.z = THREE.MathUtils.lerp(this.tiga.rotation.z, flightRoll, delta * 10);
      this.tiga.rotation.y = THREE.MathUtils.lerp(
        this.tiga.rotation.y,
        lateralInput||depthInput ? Math.atan2(lateralInput,-depthInput) :
          this.playMode==='story'&&this.nearestMonster() ? Math.atan2(this.nearestMonster()!.object.position.x-this.tiga.position.x,this.nearestMonster()!.object.position.z-this.tiga.position.z) : this.tiga.rotation.y,
        delta * 8,
      );
      const rightArm = this.tiga.getObjectByName('right-arm');
      const leftArm = this.tiga.getObjectByName('left-arm');
      const rightHand = this.tiga.getObjectByName('right-hand');
      const leftHand = this.tiga.getObjectByName('left-hand');
      const rightLeg = this.tiga.getObjectByName('right-leg');
      const leftLeg = this.tiga.getObjectByName('left-leg');
      const walking = (lateralInput !== 0 || depthInput!==0 || (this.playMode==='story'&&this.storyMode==='combat'&&this.attackPoseTimer===0)) && !this.flying && !this.human;
      const stride = walking ? Math.sin(time * 8) * 0.33 : 0;
      const breathing = Math.sin(time * 2.1) * 0.012;
      const torso = this.tiga.getObjectByName('torso');
      if (torso) torso.scale.z = 1 + breathing;
      const poseProgress = this.attackPoseTimer > 0
        ? Math.sin((this.attackPoseTimer / this.attackPoseDuration) * Math.PI)
        : 0;
      const isKick = this.attackPose === 'kick';
      const isPunch = this.attackPose === 'punch';
      const isBeam = ['delacium', 'zeperion', 'runboldt', 'evolution-ray', 'super-lightning', 'tiga-freeze', 'tiga-slash', 'flying-charge'].includes(this.attackPose);
      const gestureWave = Math.sin(time * 18) * poseProgress * 0.06;
      if (rightArm && leftArm) {
        const rightArmTarget = isKick
          ? -0.26 * poseProgress
          : isPunch
            ? -1.3 * poseProgress
            : isBeam
              ? -(this.attackPose === 'runboldt' ? 0.78 : 1.02) * poseProgress
              : 0;
        const leftArmTarget = isKick
          ? 0.45 * poseProgress
          : isBeam
            ? -(this.attackPose === 'delacium' ? 0.34 : this.attackPose === 'super-lightning' ? 1.18 : 0.92) * poseProgress
            : 0;
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, rightArmTarget - 0.16 - stride * 0.7, delta * 18);
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, leftArmTarget - 0.25 + stride * 0.7, delta * 18);
        rightArm.rotation.z = THREE.MathUtils.lerp(
          rightArm.rotation.z,
          isKick ? -0.18 * poseProgress : isBeam ? -0.12 * poseProgress + gestureWave : -0.13,
          delta * 18,
        );
        leftArm.rotation.z = THREE.MathUtils.lerp(
          leftArm.rotation.z,
          isKick ? 0.22 * poseProgress : isBeam ? 0.16 * poseProgress - gestureWave : 0.16,
          delta * 18,
        );
      }
      for (const side of ['left', 'right']) {
        const elbow = this.tiga.getObjectByName(`${side}-elbow`);
        if (elbow) elbow.rotation.x = THREE.MathUtils.lerp(elbow.rotation.x,
          -0.32 - (side === 'left' ? 0.13 : 0) + (isPunch ? 0.28 : isBeam ? -0.42 : 0) * poseProgress, delta * 12);
        const knee = this.tiga.getObjectByName(`${side}-knee`);
        const bend = walking ? Math.max(0, stride * (side === 'left' ? 1 : -1)) * 1.5 : 0.045;
        if (knee) knee.rotation.x = THREE.MathUtils.lerp(knee.rotation.x, bend, delta * 12);
      }
      if (rightHand && leftHand) {
        rightHand.rotation.z = THREE.MathUtils.lerp(
          rightHand.rotation.z,
          isPunch ? -0.24 * poseProgress : isKick ? -0.08 * poseProgress : isBeam ? -0.18 * poseProgress : 0,
          delta * 20,
        );
        leftHand.rotation.z = THREE.MathUtils.lerp(
          leftHand.rotation.z,
          isKick ? 0.16 * poseProgress : isBeam ? 0.14 * poseProgress : 0,
          delta * 20,
        );
        rightHand.scale.x = THREE.MathUtils.lerp(rightHand.scale.x, 0.82 * (1 + (isPunch || isBeam ? 0.14 : 0)), delta * 20);
        leftHand.scale.x = THREE.MathUtils.lerp(leftHand.scale.x, 0.82 * (isKick || isBeam ? 1.06 : 1), delta * 20);
      }
      if (rightLeg && leftLeg) {
        rightLeg.rotation.z = THREE.MathUtils.lerp(rightLeg.rotation.z, isKick ? -1.02 * poseProgress : 0, delta * 16);
        leftLeg.rotation.z = THREE.MathUtils.lerp(leftLeg.rotation.z, isKick ? 0.18 * poseProgress : 0, delta * 16);
        rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, isKick ? -0.9 * poseProgress : stride, delta * 16);
        leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, isKick ? 0.08 * poseProgress : -stride, delta * 16);
      }
      this.tiga.rotation.x = THREE.MathUtils.lerp(
        this.tiga.rotation.x,
        this.attackPose==='flying-charge' && this.attackPoseTimer>0 ? -1.05*poseProgress : isKick ? -0.16 * poseProgress : isPunch ? 0.06 * poseProgress : isBeam ? -0.1 * poseProgress : flightPitch,
        delta * 14,
      );
      for(const side of ['left','right']){
        const arm=this.tiga.getObjectByName(`${side}-arm`),elbow=this.tiga.getObjectByName(`${side}-elbow`);
        if(arm)arm.rotation.y=THREE.MathUtils.lerp(arm.rotation.y,0,delta*14);
        if(elbow){elbow.rotation.y=THREE.MathUtils.lerp(elbow.rotation.y,0,delta*14);elbow.rotation.z=THREE.MathUtils.lerp(elbow.rotation.z,0,delta*14);}
      }
      if(isBeam&&this.attackPoseTimer>0) animateRayPose(this.tiga,this.attackPoseDuration-this.attackPoseTimer,delta,this.attackPose as Ability);
    }
    this.monsters.forEach((monster, monsterIndex) => {
      if (!monster.defeated && monster.escapeTimer === 0) {
        const canMatchFlightLevel = monster.profile.canFly && (!this.spaceFlying || monster.profile.canSpaceFly);
        if (this.flying && canMatchFlightLevel) {
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
        const approaching = this.started && !this.defeatReason && !monster.stunned &&
          Math.abs(monster.object.position.x - this.tiga.position.x) > monster.profile.attackRange;
        const gait = approaching ? Math.sin(time * (monster.profile.id === 'golza' ? 4 : 6)) * 0.24 : 0;
        const striking = monster.attackCooldown > 1.25 && monster.attackCooldown < 1.6 && this.started;
        for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
          const leg = monster.object.getObjectByName(`monster-${side}-leg`) ?? monster.object.getObjectByName(`${side}-leg`);
          const arm = monster.object.getObjectByName(`monster-${side}-arm`) ?? monster.object.getObjectByName(`${side}-arm`);
          if (leg) leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, gait * sign, delta * 7);
          if (arm) arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x,
            -0.2 - gait * sign * 0.65 - (striking ? 0.85 : 0), delta * 7);
          const wing = monster.object.getObjectByName(`${side}-wing`);
          if (wing) {
            wing.rotation.y = sign * (0.15 + Math.sin(time * (this.flying ? 6 : 3)) * 0.2);
            wing.rotation.z = sign * Math.sin(time * 3) * 0.06;
          }
        }
        const tail = monster.object.getObjectByName('monster-tail');
        if (tail) tail.rotation.y = Math.sin(time * 1.7) * 0.12;
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

  private beginLightRescue() {
    this.rescueUsed = true;this.rescueTime = 0;
    this.pendingRay = null;this.attackPoseTimer = 0;this.autoRescueRay = false;
    this.health = 1;this.energy = 1;this.human = false;
    this.humanModel.visible = false;this.setTigaVisibility(true);
    this.heldActions.clear();this.flying = false;this.tiga.position.y = 0;
    this.setStatueMaterial(true);
    this.effects.rescueLights(this.tiga.position.clone().add(new THREE.Vector3(0,4.5,0)));
    this.setMessage('众人举起光芒 · 信念救援演出中 · 迪迦将自动发射哉佩利敖光线', 9);
    this.audio?.play('revive');
  }

  private turnToStone(reason: DefeatReason) {
    if (this.defeatReason || this.storyMode!=='combat' || this.livingMonsters().length===0) return;
    this.deepSpaceSlam.cancel();this.slamTarget=null;this.explosionTimer=null;this.lastStand.reset();
    this.defeatReason = reason;
    this.flying = false;
    this.spaceFlying = false;
    this.setSpaceGroundLighting(false);
    this.jumpHoldTimer = 0;
    this.jumpVelocity = 0;
    this.tiga.position.y = 0;
    if (reason === 'defeated') {this.deaths += 1;this.totalDeaths+=1;try{localStorage.setItem('tiga-total-deaths',String(this.totalDeaths));}catch{/* In-memory progress remains available. */}}
    const awaken = this.deaths >= shiningDeathThreshold(this.currentEpisode().enemies);
    this.revivalMethod = awaken ? 'belief' : 'flashlight';
    this.pendingRay = null;this.attackPoseTimer = 0;this.autoRescueRay = false;
    this.human = false;this.humanModel.visible = false;this.setTigaVisibility(true);
    this.health = reason === 'defeated' ? 0 : this.health;
    this.energy = normalizeEnergy(this.form, 0);
    this.energyPhase = 'critical';
    this.heldActions.clear();
    this.setStatueMaterial(true);
    this.setMessage(
      awaken ? 'KO · 人们的信念正在唤醒闪耀迪迦' : `KO · 本集倒下 ${this.deaths} 次，光正在重新汇聚`,
      999,
    );
    this.tone(55, 0.7, 'sawtooth');
    this.audio?.play('stone');
    this.updateHud();
    this.beginRevival();
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
    if (usedBelief) {this.shiningUnlocked = true;this.lightMeter = 100;this.climaxHold = 10;}
    this.setStatueMaterial(false);
    this.setForm(usedBelief?(bigShiningUnlocked(this.totalDeaths)?'shining':this.smallShiningRemaining>0?'small-shining':'multi'):revival.form);
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

  private setSpaceGroundLighting(space: boolean) {
    const ground = this.scene.getObjectByName('city-ground');
    if (ground instanceof THREE.Mesh) ground.receiveShadow = !space;
    this.renderer.shadowMap.enabled = !space;
  }

  private setTigaVisibility(visible: boolean) {
    this.humanModel.visible = this.human && this.perspective !== 'first';
    visible = visible && !this.human;
    this.tiga.visible = visible;
    this.tiga.traverse((object) => {
      object.visible = visible;
    });
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
        first.object.position.distanceToSquared(this.tiga.position) -
        second.object.position.distanceToSquared(this.tiga.position),
    )[0];
  }

  private livingMonsters() {
    return this.monsters.filter((monster) => !monster.defeated);
  }

  private currentMonsterName() {
    const living = this.livingMonsters();
    if (living.length === 0) return '目标清除';
    const remaining=living.length+this.pendingMonsters.length;
    return remaining > 1 ? `${living[0].profile.name} · 剩余 ${remaining}${this.pendingMonsters.length?' · 增援接近中':''}` : living[0].profile.name;
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
      human: this.human,
      levelName: this.currentEpisode().title,
      started: this.started,
      form: this.form,
      hero:this.hero,
      totalDeaths:this.totalDeaths,
      formSeconds:this.form==='shining'?null:this.form==='small-shining'?this.smallShiningRemaining:this.formRemaining,
      glideUnlocked:this.glideUnlocked,
      zeroUltimate:this.zeroUltimate,
      playerHealth: this.health,
      lastStandSeconds: this.lastStand.remaining,
      playerEnergy: this.energy,
      energyPhase: this.energyPhase,
      energyAlert: this.energyAlert,
      lightMeter: this.lightMeter,
      shiningUnlocked: this.shiningUnlocked,
      monsterName: this.currentMonsterName(),
      monsterHealth,
      monsterMaxHealth,
      monsterCount: living.length+this.pendingMonsters.length,
      demogeaBattle: this.isDemogeaBattle(),
      moveHint: this.human ? '人类攻击造成 1% 伤害 · 点击「变身奥特曼」开始迎战' : this.wave===25&&!this.rescueUsed ? '二代熔岩装甲 · 战至危急时，将触发众人举光的自动反击' :
        this.nearestMonster()?.profile.requiredFinisher?.length ? `装甲弱点：${this.nearestMonster()!.profile.requiredFinisher!.map(a=>MOVE_NAMES[a]).join(' / ')}` :
        this.isDemogeaBattle() ? '一次倒下后唤醒闪耀 · 点击「体内爆破」终结黑暗' :
        this.isGatanothorBattle() ? '一次倒下后唤醒闪耀 · 用时空闪电突破黑暗' : '先用拳、踢、飞镖战斗 · 怪兽生命低于 35% 开放终结招式',
      wave: this.wave,
      message: this.messageTimer > 0 ? this.message : '',
      defeatReason: this.defeatReason,
      revivalMethod: this.revivalMethod,
      reviving: this.reviving,
      recharging: this.recharging,
      tutorialStage: this.tutorialStage,
      viewMode: this.perspective,
      flying: this.flying,
      earthView: this.earthView,
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
    const realDelta = this.clock.getDelta();
    const delta = Math.min(0.04, realDelta);
    this.update(delta,realDelta);
    const restCameraZ = this.camera.aspect < 0.65 ? 58 : this.camera.aspect < 0.9 ? 44 : 30;
    if(this.deepSpaceSlam.active) {
      this.deepSpaceSlam.updateCamera(this.camera);
    } else if (this.started && this.storyMode !== 'combat'&&this.playMode!=='explore') {
      const scene=episodeScene(this.storyTime),shot=scene.shot%4;
      const pyramid = this.levelScenery.getObjectByName('ancient-pyramid');
      const aircraftShot=['launch','pilot','counterattack'].includes(scene.kind)&&this.storyMode!=='outro';
      const peopleShot=['briefing','rescue','resolve'].includes(scene.kind)||this.storyMode==='outro';
      const person=this.cast.children[this.storyMode==='outro'?2:scene.kind==='resolve'?2:shot%5];
      const focus = aircraftShot?this.victoryFlight.lead.position.clone():peopleShot ? person.position.clone().add(new THREE.Vector3(0,1.1,0)) : this.wave === 1 && shot === 0 && pyramid
        ? pyramid.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,2,0))
        : this.nearestMonster()?.object.position.clone().add(new THREE.Vector3(0,4.8,0)) ?? new THREE.Vector3(0,4,0);
      const offset=aircraftShot?(scene.pilot?new THREE.Vector3(0,3.5,11):new THREE.Vector3(shot%2?-7:10,4,12)).applyQuaternion(this.victoryFlight.lead.quaternion):peopleShot?new THREE.Vector3(Math.sin(this.storyTime*.08)*1.2,.3,3.4):new THREE.Vector3(-14+Math.sin(this.storyTime*.1)*5,shot===1?18:5,24);
      const desired = focus.clone().add(offset.multiplyScalar(this.camera.aspect < .9 ? 1.6 : 1));
      this.camera.position.lerp(desired, Math.min(1,delta*(scene.pilot?8:2.4)));
      this.camera.lookAt(focus);
    } else if(this.transformTime!==null) {
      const progress=THREE.MathUtils.smoothstep(this.transformTime,.5,TRANSFORM_SECONDS-1);
      const focus=this.tiga.position.clone().add(new THREE.Vector3(0,Math.max(.8,3.8*progress),0));
      const angle=this.transformTime*.22;
      const distance=4+progress*11;
      this.camera.position.lerp(focus.clone().add(new THREE.Vector3(Math.sin(angle)*distance,1.5,Math.cos(angle)*distance)),delta*4);
      this.camera.lookAt(focus);
    } else if (this.perspective === 'first') {
      const eye=this.tiga.position.clone().add(new THREE.Vector3(0,this.human?1.25:7.45*this.renderedGrowth,0));
      this.camera.position.lerp(eye,Math.min(1,delta*12));
      this.camera.lookAt(eye.clone().add(new THREE.Vector3(Math.sin(this.orbitYaw)*20,Math.sin(-this.orbitPitch)*10,-Math.cos(this.orbitYaw)*20)));
    } else {
      const vehicleFocus=this.combatAircraft?this.victoryFlight.lead.position:this.submarineMode?this.submarine.position:null;
      const focus=vehicleFocus?vehicleFocus.clone().add(new THREE.Vector3(0,2,0)):this.tiga.position.clone().add(new THREE.Vector3(0,this.human?1.2:4*this.renderedGrowth,0));
      const target=this.nearestMonster();
      if(this.playMode==='story'&&target&&target.object.position.distanceTo(this.tiga.position)<40)focus.lerp(target.object.position.clone().add(new THREE.Vector3(0,4,0)),.35);
      const distance=this.orbitDistance*(restCameraZ/30)*(this.human?.3:this.renderedGrowth);
      const yaw=this.orbitYaw+(this.playMode==='story'?Math.sin(this.battleTime*.13)*.2:0);
      const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(this.orbitPitch)*distance,Math.sin(this.orbitPitch)*distance,Math.cos(yaw)*Math.cos(this.orbitPitch)*distance);
      this.camera.position.lerp(focus.clone().add(offset),Math.min(1,delta*(this.flying?12:4)));
      this.camera.lookAt(focus);
    }
    if (this.earthView) {
      const radius=5.6*this.earth.scale.x;
      this.earth.position.copy(this.tiga.position).add(this.growthLevel>=6?new THREE.Vector3(-radius*.7,-radius*.75,-radius*1.35-this.renderedGrowth*8):new THREE.Vector3(-18,-10,-28));
      this.earth.rotation.y += delta * 0.08;
    }
    this.updateHud();
    if (this.perspective === 'first') this.renderer.clear(true, true, true);
    this.composer.render();
  };
}

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LastStand } from './lastStand';
import { canUltraExplode } from './episodeTimeline';
import { MOVE_RANK, ULTRA_EXPLOSION_RANK } from './storyRules';
import { DeepSpaceSlam, SLAM_SECONDS } from './deepSpaceSlam';
import { disposeObject } from './disposal';
import { TigaGame } from './Game';

describe('zero health final counterattack', () => {
  it('allows exactly thirty seconds and further damage never restarts the timer', () => {
    const stand = new LastStand();
    expect(stand.update(0, false, false, 0)).toBe('active');
    expect(stand.remaining).toBe(30);
    expect(stand.update(0, false, false, 29)).toBe('active');
    expect(stand.remaining).toBe(1);
    expect(stand.update(0, false, false, 1)).toBe('defeated');
    expect(stand.update(0, false, false, .1)).toBe('defeated');
  });

  it('gives clearing the battlefield priority at zero health and resets for revival', () => {
    const stand = new LastStand();
    stand.update(0, false, false, 9.9);
    expect(stand.update(0, false, true, .1)).toBe('victory');
    expect(stand.remaining).toBeNull();
    stand.update(0, false, false, 5);
    expect(stand.update(45, false, false, 0)).toBe('normal');
    expect(stand.remaining).toBeNull();
    expect(stand.update(0, true, false, 0)).toBe('defeated');
  });

  it('permits explosion at zero and thirty health with both finishers rated above the normal ray', () => {
    for (const health of [0, 1, 29, 30]) expect(canUltraExplode(false, health)).toBe(true);
    for (const health of [-1, 30.1, 100]) expect(canUltraExplode(false, health)).toBe(false);
    expect(canUltraExplode(true, 0)).toBe(false);
    expect(ULTRA_EXPLOSION_RANK).toBe(4);
    expect(MOVE_RANK['flying-charge']).toBe(4);
    expect(MOVE_RANK.zeperion).toBeLessThan(ULTRA_EXPLOSION_RANK);
  });

  it('actually wins against an armored final monster with a zero-health explosion', () => {
    const monster = { profile: { id: 'demogea', maxHealth: 1500, requiredFinisher: ['evolution-ray'] }, object: new THREE.Group(), health: 1500, defeated: false, stunned: 0 };
    const stand = new LastStand();
    stand.update(0, false, false, 6);
    // Exercise the real explosion, defeatMonster and beginOutro chain without a WebGL renderer.
    const game = Object.assign(Object.create(TigaGame.prototype) as object, {
      explosionTimer: 0, explosionCooldown: 0, health: 0, energy: 0, human: false,
      tiga: new THREE.Group(), monsters: [monster], audio: null,
      effects: { ultraExplosion: vi.fn(), impact: vi.fn() },
      lastStand: stand, deepSpaceSlam: { cancel: vi.fn() }, slamTarget: null,
      wave: 53, lightMeter: 0, storyMode: 'combat', episodeElapsed: 1400,
      heldActions: new Set(), victoryFlight: { reset: vi.fn() },
      pendingRay: null, message: '', messageTimer: 0,
    }) as unknown as { updateUltraExplosion(delta: number): void; health: number; storyMode: string; message: string };
    game.updateUltraExplosion(2.2);
    expect(monster.health).toBe(0);
    expect(monster.defeated).toBe(true);
    expect(game.health).toBe(0);
    expect(game.storyMode).toBe('outro');
    expect(game.message).toContain('零血最后反击成功');
    expect(stand.remaining).toBeNull();
  });
});

describe('deep space slam cinematic', () => {
  it('shows the solar system, shrinks the actor and restores the battlefield only before impact', () => {
    const scene = new THREE.Scene(), actor = new THREE.Group(), city = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 2000);
    const fog = new THREE.FogExp2(0xaaaaaa, .004);
    scene.fog = fog;
    actor.position.set(-9, 0, 0); actor.scale.set(.92, .94, .92);
    const scale = actor.scale.clone();
    const slam = new DeepSpaceSlam();
    scene.add(actor, city, slam);
    slam.begin(scene, actor, camera, new THREE.Vector3(8, 0, 0));
    expect(slam.update(2)).toBe(false);
    const departureSize = actor.scale.y;
    expect(slam.update(2)).toBe(false);
    slam.updateCamera(camera);
    expect(slam.visible).toBe(true);
    expect(slam.getObjectByName('slam-sun')).toBeDefined();
    expect(slam.getObjectByName('slam-planet-7')).toBeDefined();
    expect(actor.scale.y).toBeLessThan(departureSize);
    expect(city.visible).toBe(false);
    expect(scene.fog).toBeNull();
    expect(slam.update(2)).toBe(false);
    expect(city.visible).toBe(true);
    expect(actor.position.y).toBeGreaterThan(0);
    expect(slam.update(SLAM_SECONDS - 6)).toBe(true);
    slam.finish();
    expect(actor.position.y).toBe(0);
    expect(actor.position.x).toBe(5);
    expect(actor.scale.equals(scale)).toBe(true);
    expect(scene.fog).toBe(fog);
    expect(slam.active).toBe(false);
    disposeObject(slam);
  });

  it('restores visibility, scale, camera and original position if the countdown expires in space', () => {
    const scene = new THREE.Scene(), actor = new THREE.Group(), hidden = new THREE.Group();
    hidden.visible = false;
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 1500);
    const slam = new DeepSpaceSlam();
    scene.add(actor, hidden, slam);
    slam.begin(scene, actor, camera, new THREE.Vector3(8, 0, 0));
    slam.update(3); slam.updateCamera(camera); slam.cancel();
    expect(actor.position.length()).toBe(0);
    expect(actor.scale.toArray()).toEqual([1, 1, 1]);
    expect(camera.far).toBe(1500);
    expect(hidden.visible).toBe(false);
    expect(slam.visible).toBe(false);
    disposeObject(slam);
  });
});

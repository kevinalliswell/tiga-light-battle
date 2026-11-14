import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TigaGame } from './Game';
import { DeepSpaceSlam } from './deepSpaceSlam';
import { HEROES, applyHeroIdentity, heroEpisode, heroSkillTraits } from './heroes';
import { EPISODES, MONSTER_SIEGE, episodeAt } from './episodes';
import { bigShiningUnlocked, jumpWorldHeight } from './progression';
import { canUseAbility, hasInfiniteEnergy, hasInfiniteHealth, FORM_STATS } from './rules';
import { VictoryFlight } from './victoryFlight';
import { disposeObject } from './disposal';
import { episodeDialogue } from './dialogue';

describe('hero progression and dedicated moves',()=>{
  it('keeps small shining stronger than ordinary forms without granting big shining immunity',()=>{
    expect(FORM_STATS['small-shining'].strength).toBeGreaterThan(FORM_STATS.power.strength);
    expect(hasInfiniteEnergy('small-shining')).toBe(true);
    expect(hasInfiniteHealth('small-shining')).toBe(false);
    expect(hasInfiniteHealth('shining')).toBe(true);
    expect(bigShiningUnlocked(9)).toBe(false);expect(bigShiningUnlocked(10)).toBe(true);
    for(const ability of ['tiga-freeze','tiga-slash','super-lightning'] as const)expect(canUseAbility('small-shining',ability)).toBe(true);
    expect(jumpWorldHeight('shining')).toBeGreaterThan(jumpWorldHeight('small-shining'));
  });

  it('prevents expired Zero radiance from equipping armor or reporting a successful switch',()=>{
    const game=Object.assign(Object.create(TigaGame.prototype) as object,{
      hero:'zero',started:true,human:false,form:'multi',totalDeaths:9,smallShiningRemaining:0,
      deepSpaceSlam:{active:false},pendingRay:null,transformTime:null,explosionTimer:null,
      zeroUltimate:false,setMessage:vi.fn(),changeForm:vi.fn(),
    }) as unknown as {handleAction(action:string,pressed:boolean):void;zeroUltimate:boolean;changeForm:ReturnType<typeof vi.fn>;setMessage:ReturnType<typeof vi.fn>};
    game.handleAction('zero-shining',true);
    game.handleAction('zero-shining-ultimate',true);
    expect(game.changeForm).not.toHaveBeenCalled();expect(game.zeroUltimate).toBe(false);
    expect(game.setMessage).toHaveBeenLastCalledWith(expect.stringContaining('10'),3);
  });

  it('uses distinct moves and cast while leaving the source Tiga episode intact',()=>{
    expect(heroSkillTraits('zero','boomerang').hits).toBe(2);
    expect(heroSkillTraits('zeta','runboldt').hits).toBe(3);
    expect(heroSkillTraits('dyna','runboldt').pull).toBe(true);
    expect(heroSkillTraits('yasuo','tiga-freeze').windWall).toBe(true);
    const trigger=heroEpisode(EPISODES[0],'trigger',1);
    expect(trigger.enemies[0].maxHealth).toBeGreaterThan(EPISODES[0].enemies[0].maxHealth);
    expect(heroEpisode(EPISODES[0],'dyna',1).region).toBe(3);
    const zero=heroEpisode(EPISODES[0],'zero',1);
    expect(episodeDialogue(zero,50).speaker).toBe('赛罗');
    expect(episodeDialogue(EPISODES[0],50).speaker).toBe('大古');
    expect(new Set(Object.values(HEROES).map(hero=>hero.skills.zeperion)).size).toBe(Object.keys(HEROES).length-1);
  });

  it('replaces Zero armor without stacking obsolete identity models',()=>{
    const actor=new THREE.Group();applyHeroIdentity(actor,'zero',true);
    const armored=actor.getObjectByName('hero-identity')!.children.length;
    applyHeroIdentity(actor,'zero',false);
    expect(actor.children).toHaveLength(1);
    expect(actor.getObjectByName('hero-identity')!.children.length).toBeLessThan(armored);
    disposeObject(actor);
  });

  it('keeps flight explosion active beyond galaxy departure and completes at thirty seconds',()=>{
    const scene=new THREE.Scene(),actor=new THREE.Group(),camera=new THREE.PerspectiveCamera();
    const flight=new DeepSpaceSlam();scene.add(actor,flight);
    flight.begin(scene,actor,camera,new THREE.Vector3(10,0,0),true);
    expect(flight.update(19.9)).toBe(false);
    expect(flight.getObjectByName('flight-milky-way')!.visible).toBe(true);
    expect(flight.update(.1)).toBe(false);
    expect(flight.update(9.9)).toBe(false);
    expect(flight.update(.1)).toBe(true);
    flight.finish();expect(actor.position.y).toBe(0);disposeObject(flight);
  });

  it('allows a shot-down 50 HP fighter to eject and starts a fresh mission with full HP',()=>{
    const flight=new VictoryFlight();expect(flight.shield).toBe(50);
    flight.shield=0;expect(flight.crashed).toBe(true);
    flight.eject();expect(flight.lead.visible).toBe(false);
    flight.reset();expect(flight.ejected).toBe(false);expect(flight.shield).toBe(50);
    disposeObject(flight);
  });

  it('puts the all-monster siege with Belial after the special episode',()=>{
    expect(episodeAt(53)).not.toBe(MONSTER_SIEGE);expect(episodeAt(54)).toBe(MONSTER_SIEGE);
    expect(MONSTER_SIEGE.enemies.length).toBeGreaterThan(40);
    expect(MONSTER_SIEGE.enemies.find(enemy=>enemy.id==='belial')?.maxHealth).toBe(1000);
  });
});

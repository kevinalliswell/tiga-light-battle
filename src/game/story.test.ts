import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AFTER_STORY, EPISODES, episodeAt, rayPhase, shiningDeathThreshold } from './episodes';
import { canFireStoryRay, shouldRescueWithLight, skipReturnEpisode, storyMoveDamage } from './storyRules';
import { animateRayPose, rayHandTargets } from './rayPose';
import { createTiga, createMonster } from './models';
import { createLevelBackground } from './levelBackground';
import { disposeObject } from './disposal';
import { canUseAbility, formForAbility, type Ability, type TigaForm } from './rules';
import { contourGeometry } from './sculpting';

describe('episode campaign and story combat',()=>{
  it('contains 52 episodes, the first pair, upgraded return encounters and a separate final special',()=>{
    expect(EPISODES).toHaveLength(52);
    expect(episodeAt(1).enemies.map(m=>m.id)).toEqual(['golza','melba']);
    expect(EPISODES.flatMap(e=>e.enemies).some(m=>m.id==='belial')).toBe(false);
    expect(episodeAt(18).enemies[0].variant).toBe('enhanced');
    expect(episodeAt(25).enemies[0].variant).toBe('enhanced');
    expect(episodeAt(3).enemies[0].variant).toBeUndefined();
    expect(episodeAt(51).enemies[0].id).toBe('gatanothor');
    expect(episodeAt(52).enemies[0].id).toBe('gatanothor');
    expect(episodeAt(53)).toBe(AFTER_STORY);
  });
  it('requires three ordinary deaths and one death against either final boss',()=>{
    expect(shiningDeathThreshold(episodeAt(1).enemies)).toBe(3);
    expect(shiningDeathThreshold(episodeAt(52).enemies)).toBe(1);
    expect(shiningDeathThreshold(AFTER_STORY.enemies)).toBe(1);
  });
  it('locks opening rays, permits finishers and digging shots, and unlocks shining boss rays',()=>{
    const episode=episodeAt(1);
    expect(canFireStoryRay(episode,100,100,false,false)).toBe(false);
    expect(canFireStoryRay(episode,36,100,false,false)).toBe(false);
    expect(canFireStoryRay(episode,35,100,false,false)).toBe(true);
    expect(canFireStoryRay(episode,90,100,true,false)).toBe(true);
    expect(canFireStoryRay({...episode,openingRay:true},100,100,false,false)).toBe(true);
    expect(canFireStoryRay(episodeAt(52),1200,1200,false,true)).toBe(true);
  });
  it('only shortens the Golza return branch, keeping upgraded Kyrieloid independent',()=>{
    expect(skipReturnEpisode(18,true)).toBe(true);
    expect(skipReturnEpisode(18,false)).toBe(false);
    expect(skipReturnEpisode(25,true)).toBe(false);
    expect(shouldRescueWithLight(25,false,20,80)).toBe(true);
    expect(shouldRescueWithLight(25,true,1,1)).toBe(false);
    expect(shouldRescueWithLight(27,false,1,1)).toBe(false);
  });
  it('lets weak enemies fall to ordinary blows but preserves stronger or protected enemies for the correct move',()=>{
    expect(storyMoveDamage(15,'punch',10,1)).toBe(15);
    expect(storyMoveDamage(15,'punch',10,2)).toBe(9);
    expect(storyMoveDamage(999,'zeperion',80,2,['delacium'])).toBe(79);
    expect(storyMoveDamage(999,'delacium',80,2,['delacium'])).toBe(999);
  });
  it('selects a compatible form for a clicked move without granting shining prematurely',()=>{
    const moves:Ability[]=['punch','kick','boomerang','zeperion','delacium','runboldt','tiga-freeze','tiga-slash','flying-charge','evolution-ray','super-lightning'];
    for(const form of ['multi','sky','power','shining'] as TigaForm[]){
      for(const move of moves)expect(canUseAbility(formForAbility(form,move),move)).toBe(true);
    }
    expect(formForAbility('multi','delacium')).toBe('power');
    expect(formForAbility('multi','super-lightning')).toBe('shining');
  });
});

describe('animated stage assets',()=>{
  it('keeps the skin facing outward for either direction of a sculpted profile',()=>{
    const profile:Array<[number,number]>=[[0,.2],[.4,0],[.3,-1],[0,-1.4]];
    for(const points of [profile,profile.slice().reverse()]){
      const geometry=contourGeometry(points);
      const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
      let outward=0;
      for(let i=0;i<position.count;i++)outward+=position.getX(i)*normal.getX(i)+position.getZ(i)*normal.getZ(i);
      expect(outward/position.count).toBeGreaterThan(.1);
      geometry.dispose();
    }
  });
  it('moves the hands through crossing, spreading and aiming before firing',()=>{
    expect(rayPhase(.2)).toBe('cross');expect(rayPhase(.8)).toBe('spread');expect(rayPhase(1.2)).toBe('aim');expect(rayPhase(1.65)).toBe('fire');
    expect(rayHandTargets(.42).right.x).toBeLessThan(0);
    expect(rayHandTargets(1.02).right.x).toBeGreaterThan(3);
    const tiga=createTiga();
    for(let i=0;i<80;i++)animateRayPose(tiga,i*.03,.03);
    tiga.updateMatrixWorld(true);
    for(const side of ['left','right']){
      const hand=tiga.getObjectByName(`${side}-hand`)!;
      expect(hand.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite)).toBe(true);
    }
    disposeObject(tiga);
  });
  it('provides a destructible pyramid, glass city and distinct upgraded rigs',()=>{
    const earth=createLevelBackground(1),light=createLevelBackground(5);
    expect(earth.getObjectByName('ancient-pyramid')).toBeDefined();
    let glassCount=0;light.traverse(o=>{if(o instanceof THREE.Mesh&&o.material instanceof THREE.MeshPhysicalMaterial&&o.material.transmission>.5)glassCount++;});
    expect(glassCount).toBeGreaterThan(20);
    const enhanced=createMonster(episodeAt(25).enemies[0]);
    expect(enhanced.userData.variant).toBe('enhanced');
    [earth,light,enhanced].forEach(disposeObject);
  });
});

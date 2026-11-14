import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ExplorationWorld, groundDistance, flightSpeed, altitudeLabel, INTRO_SECONDS, OUTRO_SECONDS } from './exploration';
import { episodeDialogue } from './dialogue';
import { episodeAt } from './episodes';
import { EPISODE_SECONDS } from './episodeTimeline';

describe('story and exploration',()=>{
  it('uses depth when measuring ground attack distance',()=>{
    expect(groundDistance(new Vector3(0,100,0),new Vector3(3,0,4))).toBe(5);
  });
  it('recycles a bounded set of districts at distant coordinates',()=>{
    const world=new ExplorationWorld();
    const children=[...world.children];
    world.update(new Vector3(1e7,0,-1e7),1);
    expect(world.children).toHaveLength(25);
    expect(world.children).toEqual(children);
    expect(Math.abs(world.children[12].position.x-1e7)).toBeLessThan(64);
    world.update(new Vector3(1e7,1000,-1e7),1);
    expect(world.visible).toBe(false);
  });
  it('keeps deep flight speed finite without imposing an altitude ceiling',()=>{
    expect(flightSpeed(1000)).toBeGreaterThan(flightSpeed(10));
    expect(flightSpeed(1e10)).toBe(500);
    expect(altitudeLabel(1e10)).toBe('深空探索');
  });
  it('gives characters dialogue throughout longer quiet scenes',()=>{
    expect(EPISODE_SECONDS).toBe(24*60);
    expect(INTRO_SECONDS+OUTRO_SECONDS).toBe(20*60);
    const speakers=new Set(Array.from({length:7},(_,i)=>episodeDialogue(episodeAt(1),i*6).speaker));
    expect(speakers.size).toBeGreaterThanOrEqual(4);
    expect(episodeDialogue(episodeAt(1),50,true).speaker).toBe('大古');
  });
});

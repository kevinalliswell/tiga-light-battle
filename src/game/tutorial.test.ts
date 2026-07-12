import { describe, expect, it } from 'vitest';
import { advanceTutorial, getTutorialInstruction, type TutorialStage } from './tutorial';

describe('child-friendly tutorial', () => {
  it('starts with movement and ends after the four core lessons', () => {
    let stage: TutorialStage = 'move';
    stage = advanceTutorial(stage, 'move');
    stage = advanceTutorial(stage, 'attack');
    stage = advanceTutorial(stage, 'form');
    stage = advanceTutorial(stage, 'light');
    expect(stage).toBe('done');
  });

  it('does not skip a lesson when the child presses another action', () => {
    expect(advanceTutorial('move', 'attack')).toBe('move');
    expect(advanceTutorial('form', 'light')).toBe('form');
  });

  it('provides a clear key prompt for every lesson', () => {
    for (const stage of ['move', 'attack', 'form', 'light'] as const) {
      expect(getTutorialInstruction(stage).key.length).toBeGreaterThan(0);
      expect(getTutorialInstruction(stage).copy.length).toBeGreaterThan(0);
    }
  });
});

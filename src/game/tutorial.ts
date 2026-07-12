export type TutorialStage = 'move' | 'attack' | 'form' | 'light' | 'done';
export type TutorialAction = 'move' | 'attack' | 'form' | 'light';

export interface TutorialInstruction {
  label: string;
  title: string;
  copy: string;
  key: string;
}

const INSTRUCTIONS: Record<Exclude<TutorialStage, 'done'>, TutorialInstruction> = {
  move: {
    label: '教学 1 / 4',
    title: '先让迪迦移动起来',
    copy: '按住左箭头或右箭头，走近前面的怪兽。',
    key: '←  →',
  },
  attack: {
    label: '教学 2 / 4',
    title: '用光拳打中怪兽',
    copy: '靠近以后按 Q，迪迦会使用光拳。',
    key: 'Q',
  },
  form: {
    label: '教学 3 / 4',
    title: '切换成强力型',
    copy: '按 1 变成强力型，力量更大但速度会变慢。',
    key: '1',
  },
  light: {
    label: '教学 4 / 4',
    title: '发射迪拉修姆光流',
    copy: '按 Z 发射必杀光流，普通怪兽会被一击击败。',
    key: 'Z',
  },
};

export function getTutorialInstruction(stage: Exclude<TutorialStage, 'done'>) {
  return INSTRUCTIONS[stage];
}

export function advanceTutorial(stage: TutorialStage, action: TutorialAction): TutorialStage {
  if (stage === 'move' && action === 'move') return 'attack';
  if (stage === 'attack' && action === 'attack') return 'form';
  if (stage === 'form' && action === 'form') return 'light';
  if (stage === 'light' && action === 'light') return 'done';
  return stage;
}

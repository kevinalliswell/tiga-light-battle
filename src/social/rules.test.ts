import { describe, expect, it } from 'vitest';
import { ROLE_COUNTS, roleOptions, SocialMatch, winnerFor, type Role } from './rules';
import { distance, PHONE, route, VENTS, visible, walkable } from './world';

function nearby(m: SocialMatch, role: Role = 'civilian') {
  const target = m.people.find(p => p.id !== 0 && p.role === role)!;
  Object.assign(m.player, { x: 700, y: 530 });
  Object.assign(target, { x: 740, y: 530 });
  m.selected = target.id;
  return target;
}
function meeting(m: SocialMatch) { Object.assign(m.player, PHONE); expect(m.report(0, true)).toBe(true); m.startVote(); }
describe('20 人太空身份局', () => {
  it.each<Role>(['alien', 'seer', 'police', 'civilian'])('选择 %s 仍保持准确角色总数', role => {
    const m = new SocialMatch(role);
    expect(m.player.role).toBe(role); expect(m.people).toHaveLength(20);
    for (const [r, n] of Object.entries(ROLE_COUNTS)) expect(m.people.filter(p => p.role === r)).toHaveLength(n);
    expect(m.people.every(p => p.alive && walkable(p, 15))).toBe(true);
  });
  it('手速挑战给出三个不同身份，连点提升抽到外星人的机会', () => {
    for (const clicks of [0, 10, 40]) {
      const options = roleOptions(clicks, () => 0.5);
      expect(options).toHaveLength(3);
      expect(new Set(options).size).toBe(3);
      expect(options.every(role => role in ROLE_COUNTS)).toBe(true);
    }
    // The same random draws produce an alien option only with the higher weight.
    expect(roleOptions(0, () => 0.9)).not.toContain('alien');
    expect(roleOptions(40, () => 0.9)).toContain('alien');
  });
  it('随机身份不会固定为某一种，身份总数保持不变', () => {
    const roles = new Set(Array.from({ length: 100 }, () => new SocialMatch().player.role));
    expect(roles.size).toBe(4);
  });
  it('开局保护玩家，灵魂可以移动但不能使用技能', () => {
    const m = new SocialMatch('civilian', () => 0.5);
    const alien = m.people.find(p => p.role === 'alien')!;
    Object.assign(m.player, { x: 700, y: 530 });
    Object.assign(alien, { x: 730, y: 530, cooldown: 0, think: 100, goal: { x: 730, y: 530 }, waypoint: { x: 730, y: 530 } });
    m.people.filter(p => p.id !== 0 && p.id !== alien.id).forEach(p => { p.cooldown = 999; });
    m.elapsed = 44;
    m.tick(13);
    expect(m.player.alive).toBe(false);
    const protectedMatch = new SocialMatch('civilian', () => 0.5);
    const protectedAlien = protectedMatch.people.find(p => p.role === 'alien')!;
    Object.assign(protectedAlien, { x: 730, y: 530, cooldown: 0, think: 100 });
    protectedMatch.elapsed = 30;
    protectedMatch.tick(13);
    expect(protectedMatch.player.alive).toBe(true);
    m.phase = 'roam';
    const x = m.player.x;
    m.tick(0.1, { x: 1, y: 0 });
    expect(m.player.x).toBeGreaterThan(x);
    expect(m.report()).toBe(false);
  });
  it('预言只用一次，超出视野不消耗机会', () => {
    const m = new SocialMatch('seer'); const t = nearby(m, 'alien');
    t.x = 1200; m.skill(); expect(m.player.used).toBe(false);
    t.x = 740; m.skill(); expect(m.player.knowledge.get(t.id)).toBe('alien'); expect(t.alive).toBe(true);
    const other = nearby(m); m.skill(); expect(m.player.knowledge.has(other.id)).toBe(false);
  });
  it('警察只有一发，不能重复或远距离攻击', () => {
    const m = new SocialMatch('police'); const t = nearby(m); t.x = 900;
    m.skill(); expect(m.player.used).toBe(false);
    t.x = 740; m.skill(); expect(t.alive).toBe(false); expect(m.bodies[0].id).toBe(t.id);
    const next = m.people.find(p => p.id !== 0 && p.alive && p.role === 'civilian')!;
    Object.assign(next, { x: 730, y: 530 }); m.selected = next.id; m.skill(); expect(next.alive).toBe(true);
  });
  it('外星人可在冷却后继续淘汰，不能攻击同伴', () => {
    const m = new SocialMatch('alien'); const t = nearby(m); m.skill(); expect(t.alive).toBe(false);
    const next = m.people.find(p => p.alive && p.role === 'civilian')!;
    Object.assign(next, { x: 740, y: 530 }); m.selected = next.id;
    m.skill(); expect(next.alive).toBe(true);
    m.player.cooldown = 0; m.skill(); expect(next.alive).toBe(false);
    const ally = nearby(m, 'alien'); m.player.cooldown = 0; m.skill(); expect(ally.alive).toBe(true);
  });
  it('只有外星人可用管道，管道内不能报告，出局不能用技能', () => {
    const m = new SocialMatch('alien'); Object.assign(m.player, VENTS[0]); m.skill();
    expect(m.inVent).toBe(0); expect(m.report(0, true)).toBe(false);
    m.exitVent(3); expect(distance(m.player, VENTS[3])).toBe(0); expect(m.inVent).toBeNull();
    m.eliminate(0, true); m.skill(); expect(m.inVent).toBeNull(); expect(m.report()).toBe(false);
    const crew = new SocialMatch('civilian'); Object.assign(crew.player, VENTS[0]); crew.skill(); expect(crew.inVent).toBeNull();
  });
  it('N 需要可见倒地者，电话需要距离，会议暂停移动与冷却', () => {
    const m = new SocialMatch('seer'); expect(m.report()).toBe(false);
    Object.assign(m.player, { x: 150, y: 180 }); expect(m.report(0, true)).toBe(false);
    const t = nearby(m); m.eliminate(t.id, true); expect(m.report()).toBe(true);
    expect(m.bodies.every(b => b.reported)).toBe(true);
    const before = { x: m.player.x, y: m.player.y }; m.player.cooldown = 5;
    m.tick(1, { x: 1, y: 1 }); expect(m.player.x).toBe(before.x); expect(m.player.cooldown).toBe(5);
  });
  it('唯一最高票者放飞公开身份；每人一票，出局者不能投票', () => {
    const m = new SocialMatch(); meeting(m);
    const victim = m.people[1];
    for (const p of m.people) expect(m.vote(p.id, p.id === victim.id ? null : victim.id)).toBe(true);
    expect(victim.alive).toBe(false); expect(m.reveal).toContain(`${victim.id + 1} 号`);
    expect(m.phase).toBe('reveal'); m.resume(); meeting(m);
    expect(m.vote(victim.id, 3)).toBe(false);
    expect(m.vote(0, 3)).toBe(true); expect(m.vote(0, 4)).toBe(false);
    expect(m.vote(2, victim.id)).toBe(false); expect(m.vote(2, 2)).toBe(false);
  });
  it('平票、跳过最多或超时均不误放飞', () => {
    const m = new SocialMatch(); meeting(m);
    m.people.forEach(p => m.vote(p.id, p.id < 10 ? 15 : 1));
    expect(m.phase).toBe('reveal'); expect(m.living).toHaveLength(20);
    m.resume(); meeting(m); m.vote(0, 1); m.finishVote();
    expect(m.lastCounts.get(null)).toBe(19); expect(m.living).toHaveLength(20);
  });
  it('最后一个外星人放飞后立即结束，保留身份公布', () => {
    const m = new SocialMatch('civilian'); const aliens = m.people.filter(p => p.role === 'alien');
    aliens.slice(1).forEach(p => m.eliminate(p.id, false)); meeting(m);
    m.living.forEach(p => m.vote(p.id, p.id === aliens[0].id ? null : aliens[0].id));
    expect(m.winner).toBe('crew'); expect(m.phase).toBe('ended'); expect(m.reveal).toContain('外星人');
  });
  it('严格大于船员总数才赢；任意船员角色均计数', () => {
    const a = { alive: true, role: 'alien' as const };
    for (const role of ['civilian', 'seer', 'police'] as Role[]) {
      const c = { alive: true, role };
      expect(winnerFor([a, c])).toBeNull(); expect(winnerFor([a, a, c])).toBe('aliens');
      expect(winnerFor([{ ...a, alive: false }, c])).toBe('crew');
    }
    expect(winnerFor([a, a, { alive: true, role: 'police' }, { alive: true, role: 'seer' }])).toBeNull();
  });
  it('视野不能穿墙，导航能连通不同舱室', () => {
    expect(visible({ x: 380, y: 180 }, { x: 550, y: 180 })).toBe(false);
    const start = { x: 150, y: 180 }, goal = { x: 1200, y: 700 };
    const next = route(start, goal); expect(next).not.toEqual(start); expect(walkable(next, 15)).toBe(true);
  });
  it('电脑能自主移动、报告并完成讨论投票，不会走出地图', () => {
    let seed = 4321;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const m = new SocialMatch('civilian', random);
    const start = m.people.map(p => ({ x: p.x, y: p.y }));
    let sawMeeting = false, sawVote = false;
    for (let i = 0; i < 1600 && m.phase !== 'ended'; i++) {
      m.tick(0.1);
      if (m.phase === 'discussion') sawMeeting = true;
      if (m.phase === 'vote') sawVote = true;
      expect(m.people.every(p => walkable(p, 14))).toBe(true);
    }
    expect(m.people.some((p, i) => i > 0 && distance(p, start[i]) > 30)).toBe(true);
    expect(sawMeeting).toBe(true); expect(sawVote).toBe(true);
  }, 20000);
});

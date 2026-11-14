import { distance, move, MOUSE_HOLE, PHONE, ROOMS, route, TASK_STATIONS, VENTS, visible, WAREHOUSE, type Point } from './world';

export type Role = 'alien' | 'seer' | 'police' | 'witch' | 'civilian';
export type Phase = 'roam' | 'discussion' | 'vote' | 'reveal' | 'ended';
export const ROLE_NAMES: Record<Role, string> = { alien: '外星人', seer: '预言家', police: '警察', witch: '女巫', civilian: '平民' };
export const PLAYER_PROTECTION_SECONDS = 45;
export const TASK_SECONDS = 4;
export const FOOD_TO_WIN = 12;
export const MOUSE_HOLE_MAX_HEALTH = 100;
export interface CrewTask { station: number; progress: number; done: boolean; clue: string }
export const ROLE_COUNTS: Record<Role, number> = { alien: 3, seer: 3, police: 2, witch: 1, civilian: 14 };
export const ROLE_HELP: Record<Role, string> = {
  alien: '靠近鼠群按 B 袭击；走到鼠洞旁按 E 破坏。可以在粮食答题台假装做任务。',
  seer: '选择视野内的一人，按 B 预言身份。整局只有一次机会。答题能找粮并获得模糊线索。',
  police: '靠近并选择一人，按 B 开枪。整局只有一发；答题能找粮并获得模糊线索。',
  witch: '靠近倒地者，选择目标后按 B 复活。整局只能救一人；答题能找粮。',
  civilian: '在答题台完成连线找粮，按 E 把粮运进仓库。发现倒地者按 N 召集投票。',
};
// Draw three different role options. Faster tapping increases the alien weight.
export function roleOptions(clicks: number, random: () => number = Math.random): Role[] {
  const pool: { role: Role; weight: number }[] = [
    { role: 'civilian', weight: 5 }, { role: 'seer', weight: 3 },
    { role: 'police', weight: 2 }, { role: 'witch', weight: 2 }, { role: 'alien', weight: 0.4 + Math.min(Math.max(0, clicks), 40) * 0.2 },
  ];
  const result: Role[] = [];
  while (result.length < 3) {
    let choice = random() * pool.reduce((sum, item) => sum + item.weight, 0);
    let index = pool.findIndex(item => (choice -= item.weight) < 0);
    if (index < 0) index = pool.length - 1;
    result.push(pool.splice(index, 1)[0].role);
  }
  return result;
}
export interface Person extends Point {
  id: number; role: Role; alive: boolean; used: boolean; cooldown: number;
  goal: Point; think: number; waypoint: Point; navigate: number; knowledge: Map<number, Role>; suspects: Map<number, number>;
  tasks: CrewTask[]; taskClues: Map<number, 'irregular' | 'routine'>;
  carriedFood: number; ghostKiller: number | null;
}
export interface Body extends Point { id: number; reported: boolean }
export interface Statement { speaker: number; text: string }
export type Winner = 'crew' | 'aliens' | null;
export type WinReason = 'food' | 'hole' | 'all-aliens-ejected' | 'alien-majority' | null;
export function winnerFor(people: Pick<Person, 'alive' | 'role'>[]): Winner {
  const aliens = people.filter(p => p.alive && p.role === 'alien').length;
  const crew = people.filter(p => p.alive && p.role !== 'alien').length;
  if (aliens === 0) return 'crew';
  if (aliens > crew) return 'aliens';
  return null;
}

export class SocialMatch {
  people: Person[] = [];
  bodies: Body[] = [];
  phase: Phase = 'roam';
  winner: Winner = null;
  winReason: WinReason = null;
  remaining = 0;
  elapsed = 0;
  round = 0;
  votes = new Map<number, number | null>();
  statements: Statement[] = [];
  notice = '身份已分配。保持警觉，留意身边的人。';
  reveal = '';
  reportReason = '';
  selected: number | null = null;
  inVent: number | null = null;
  lastCounts = new Map<number | null, number>();
  foodDelivered = 0;
  mouseHoleHealth = MOUSE_HOLE_MAX_HEALTH;
  private quiet = 12;
  private botVoteAt = new Map<number, number>();
  constructor(role?: Role, private random: () => number = Math.random) {
    const deck = Object.entries(ROLE_COUNTS).flatMap(([r, n]) => Array<Role>(n).fill(r as Role));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (role) { const i = deck.indexOf(role); [deck[0], deck[i]] = [deck[i], deck[0]]; }
    this.people = deck.map((r, id) => {
      const room = ROOMS[id % ROOMS.length];
      const p = { x: room.x + 90 + random() * (room.w - 180), y: room.y + 80 + random() * (room.h - 160) };
      return { ...p, id, role: r, alive: true, used: false, cooldown: id === 0 ? 0 : 8 + random() * 12, goal: this.randomGoal(), think: random() * 4, waypoint: p, navigate: random(), knowledge: new Map(), suspects: new Map(), tasks: [], taskClues: new Map(), carriedFood: 0, ghostKiller: null };
    });
    for (const p of this.people) {
      if (p.role === 'alien') continue;
      // Every crew member has a private assignment. The first player task is nearby.
      const stations = p.id === 0 ? [4, 1, 7] : [p.id % 9, (p.id + 2) % 9, (p.id + 4) % 9];
      p.tasks = stations.map(station => ({ station, progress: 0, done: false, clue: '' }));
    }
    Object.assign(this.player, { x: WAREHOUSE.x, y: WAREHOUSE.y });
  }
  get player(): Person { return this.people[0]; }
  get living(): Person[] { return this.people.filter(p => p.alive); }
  nearbyTask(actor = this.player): CrewTask | undefined {
    if (!actor.alive || actor.role === 'alien' || this.phase !== 'roam' || (actor.id === 0 && this.inVent !== null)) return;
    return actor.tasks.find(task => !task.done && visible(actor, TASK_STATIONS[task.station], 65));
  }
  nearTaskStation(actor = this.player): number | null {
    if (!actor.alive || this.phase !== 'roam' || (actor.id === 0 && this.inVent !== null)) return null;
    const station = TASK_STATIONS.findIndex(s => visible(actor, s, 72));
    return station < 0 ? null : station;
  }
  completeTask(station: number): boolean {
    const actor = this.player;
    if (!TASK_STATIONS[station] || !actor.alive || actor.role === 'alien' || this.phase !== 'roam' || this.inVent !== null || !visible(actor, TASK_STATIONS[station], 72)) return false;
    const task = actor.tasks.find(t => t.station === station && !t.done);
    if (!task) return false;
    task.done = true;
    task.progress = TASK_SECONDS;
    actor.carriedFood++;
    this.recordTaskClue(actor, task);
    this.notice = `答题正确，找到 1 份粮食。背包 ${actor.carriedFood} 份。线索：${task.clue}`;
    return true;
  }
  private recordTaskClue(actor: Person, task: CrewTask): void {
    const candidates = this.living.filter(p => p.id !== actor.id && !actor.knowledge.has(p.id) && !actor.taskClues.has(p.id));
    const target = candidates[Math.floor(this.random() * candidates.length)];
    if (!target) { task.clue = '这次没有新的身份线索。'; return; }
    const irregular = this.random() < (target.role === 'alien' ? 0.68 : 0.32);
    const clue = irregular ? 'irregular' : 'routine';
    actor.taskClues.set(target.id, clue);
    if (irregular) actor.suspects.set(target.id, Math.max(actor.suspects.get(target.id) ?? 0, 1.5));
    task.clue = irregular
      ? `第 ${target.id + 1} 号附近出现短暂异常，也可能是误报。`
      : `第 ${target.id + 1} 号的行动看起来正常，但不能证明身份。`;
  }
  alienHint(): string {
    const ids = this.people.filter(p => p.role === 'alien').map(p => p.id + 1);
    const facts = [
      { ok: ids.some(id => id < 15), text: '至少有一只外星鼠的编号小于 15。' },
      { ok: ids.some(id => id > 10), text: '至少有一只外星鼠的编号大于 10。' },
      { ok: ids.some(id => id % 2 === 0), text: '至少有一只外星鼠的编号是偶数。' },
      { ok: ids.some(id => id % 2 === 1), text: '至少有一只外星鼠的编号是奇数。' },
      { ok: ids.some(id => id <= 10), text: '至少有一只外星鼠在前十号里。' },
    ].filter(fact => fact.ok);
    return facts[Math.floor(this.random() * facts.length)].text;
  }
  atWarehouse(actor = this.player): boolean { return distance(actor, WAREHOUSE) < 120; }
  deliverFood(): boolean {
    const actor = this.player;
    if (!actor.alive || actor.role === 'alien' || !this.atWarehouse(actor) || actor.carriedFood === 0) return false;
    this.foodDelivered += actor.carriedFood; actor.carriedFood = 0;
    this.notice = `粮食已入仓！累计 ${this.foodDelivered} / ${FOOD_TO_WIN} 份。`;
    if (this.foodDelivered >= FOOD_TO_WIN) { this.winner = 'crew'; this.winReason = 'food'; this.phase = 'ended'; }
    return true;
  }
  sabotageMouseHole(actor = this.player): boolean {
    if (!actor.alive || actor.role !== 'alien' || this.phase !== 'roam' || distance(actor, MOUSE_HOLE) > 105) return false;
    this.mouseHoleHealth = Math.max(0, this.mouseHoleHealth - 20);
    this.notice = `鼠洞遭到破坏！结构 ${this.mouseHoleHealth}%。`;
    if (this.mouseHoleHealth === 0) { this.winner = 'aliens'; this.winReason = 'hole'; this.phase = 'ended'; }
    return true;
  }
  private advanceTask(actor: Person, dt: number, working: boolean): boolean {
    const task = working ? this.nearbyTask(actor) : undefined;
    for (const other of actor.tasks) if (other !== task && !other.done) other.progress = 0;
    if (!task) return false;
    task.progress = Math.min(TASK_SECONDS, task.progress + dt);
    if (task.progress < TASK_SECONDS) return true;
    task.done = true;
    actor.carriedFood++;
    this.recordTaskClue(actor, task);
    if (actor.id === 0) this.notice = `搬到 1 份粮食。背包 ${actor.carriedFood} 份。线索：${task.clue}`;
    return true;
  }
  private randomGoal(): Point {
    const room = ROOMS[Math.floor(this.random() * ROOMS.length)];
    return { x: room.x + 40 + this.random() * (room.w - 80), y: room.y + 40 + this.random() * (room.h - 80) };
  }
  targetFor(actor: Person): Person | undefined {
    if (actor.role === 'witch') {
      const candidates = this.people.filter(p => !p.alive && this.bodies.some(body => body.id === p.id) && visible(actor, p, 180));
      if (actor.id === 0 && this.selected !== null) return candidates.find(p => p.id === this.selected);
      return candidates.sort((a, b) => distance(actor, a) - distance(actor, b))[0];
    }
    const range = actor.role === 'seer' ? 240 : 78;
    const candidates = this.living.filter(p => p.id !== actor.id && visible(actor, p, range) && !(actor.role === 'alien' && p.role === 'alien'));
    if (actor.id === 0 && this.selected !== null) return candidates.find(p => p.id === this.selected);
    return candidates.sort((a, b) => distance(actor, a) - distance(actor, b))[0];
  }
  skill(): void {
    if (this.phase !== 'roam' || !this.player.alive) return;
    const p = this.player;
    if (this.inVent !== null) { this.exitVent(); return; }
    if (p.role === 'alien') {
      const vent = VENTS.findIndex(v => distance(p, v) < 48);
      if (vent >= 0) {
        for (const witness of this.living) if (witness.role !== 'alien' && visible(witness, p)) witness.suspects.set(0, 4);
        this.inVent = vent; this.notice = '已钻入管道。选择出口，或按 B 从当前管道出来。'; return;
      }
    }
    this.useSkill(p, this.targetFor(p));
  }
  killTarget(targetId: number, killerId: number): void { this.eliminate(targetId, true, killerId); }
  private useSkill(actor: Person, target?: Person): void {
    const tell = (s: string) => { if (actor.id === 0) this.notice = s; };
    if (actor.role === 'civilian') { tell('平民没有主动技能。发现倒地者按 N，或使用中央电话。'); return; }
    if (actor.role !== 'alien' && actor.used) { tell('本局技能已经使用过了。'); return; }
    if (actor.cooldown > 0) { tell(`技能冷却中，还需 ${Math.ceil(actor.cooldown)} 秒。`); return; }
    if (actor.role === 'witch') {
      if (!target || target.alive || !this.bodies.some(body => body.id === target.id) || !visible(actor, target, 180)) { tell('靠近一名倒地者，选择他后按 B 复活。'); return; }
      const corpse = this.bodies.find(body => body.id === target.id)!;
      target.alive = true; target.x = corpse.x; target.y = corpse.y; target.cooldown = Math.max(target.cooldown, 3);
      this.bodies = this.bodies.filter(body => body.id !== target.id);
      actor.used = true;
      tell(`${target.id + 1} 号被女巫救回。女巫的复活机会已用完。`);
      this.checkWinner();
      return;
    }
    if (!target || !target.alive || target.id === actor.id || !visible(actor, target, actor.role === 'seer' ? 240 : 78)) { tell('目标不在技能范围内。靠近其他人后再按 B。'); return; }
    if (actor.role === 'seer') {
      actor.used = true; actor.knowledge.set(target.id, target.role);
      if (target.role === 'alien') actor.suspects.set(target.id, 5);
      tell(`预言结果：${target.id + 1} 号是${ROLE_NAMES[target.role]}。本局预言机会已用完。`);
      return;
    }
    if (actor.role === 'alien' && target.role === 'alien') return;
    if (actor.role === 'police') actor.used = true;
    actor.cooldown = 9;
    for (const witness of this.living) {
      if (witness.id !== actor.id && witness.id !== target.id && visible(witness, actor) && visible(witness, target)) witness.suspects.set(actor.id, 4);
    }
    this.eliminate(target.id, true, actor.id);
    tell(`${target.id + 1} 号已倒地。${actor.role === 'alien' ? '9 秒后可以再次行动。' : '本局唯一一发子弹已使用。'}`);
  }
  eliminate(id: number, body: boolean, killerId: number | null = null): void {
    const target = this.people[id];
    if (!target?.alive) return;
    target.alive = false;
    target.ghostKiller = killerId;
    target.carriedFood = 0;
    for (const task of target.tasks) if (!task.done) task.progress = 0;
    if (body) this.bodies.push({ x: target.x, y: target.y, id, reported: false });
    if (id === 0) { this.inVent = null; this.notice = killerId === null ? '你变成了幽灵，只能观战；不能说话、投票或搬粮。' : `你看清了凶手：${killerId + 1} 号。你变成幽灵，只能观战。`; }
    this.checkWinner();
  }
  private checkWinner(): void {
    this.winner = winnerFor(this.people);
    if (this.winner === 'aliens' && this.living.some(p => p.role === 'witch' && !p.used) && this.bodies.some(body => !this.people[body.id].alive)) this.winner = null;
    this.winReason = this.winner === 'crew' ? 'all-aliens-ejected' : this.winner === 'aliens' ? 'alien-majority' : null;
    if (this.winner) { this.phase = 'ended'; this.inVent = null; }
  }
  report(reporter = 0, phone = false): boolean {
    const person = this.people[reporter];
    if (this.phase !== 'roam' || !person?.alive || (reporter === 0 && this.inVent !== null)) return false;
    if (phone && distance(person, PHONE) > 90) { this.notice = '请先走到中央大厅的电话旁。'; return false; }
    const body = this.bodies.find(b => !b.reported && visible(person, b, 210));
    if (!phone && !body) { if (reporter === 0) this.notice = '视野内没有尚未报告的倒地者。'; return false; }
    this.round++; this.phase = 'discussion'; this.remaining = 22; this.selected = null;
    for (const p of this.people) for (const task of p.tasks) if (!task.done) task.progress = 0;
    this.reportReason = phone ? `${reporter + 1} 号使用电话召开紧急会议` : `${reporter + 1} 号发现了${body!.id + 1} 号的倒地现场`;
    this.bodies.forEach(b => b.reported = true);
    this.votes.clear(); this.lastCounts.clear(); this.statements = []; this.botVoteAt.clear();
    for (const p of this.living.filter(p => p.id !== 0)) {
      const known = [...p.knowledge].find(([id, role]) => role === 'alien' && this.people[id].alive);
      const taskKnown = [...p.taskClues].find(([id, clue]) => clue === 'irregular' && this.people[id].alive);
      const taskRoutine = [...p.taskClues].find(([id, clue]) => clue === 'routine' && this.people[id].alive);
      const suspect = [...p.suspects].filter(([id]) => this.people[id].alive).sort((a, b) => b[1] - a[1])[0];
      let line = this.idleMeetingLine(p);
      if (known) {
        line = this.pick([
          `我预言过 ${known[0] + 1} 号，结果是外星人。`,
          `我有明确结果：${known[0] + 1} 号是外星人。`,
          `这不是猜的，我预言过 ${known[0] + 1} 号。`
        ]);
      } else if (taskKnown) {
        line = this.pick([
          `任务台在 ${taskKnown[0] + 1} 号附近记到一段异常波形，但也可能是误报。`,
          `${taskKnown[0] + 1} 号经过设备时亮过警示灯，原因还不清楚。`,
          `我手上的任务记录对 ${taskKnown[0] + 1} 号有点反常，先当线索看。`
        ]);
      } else if (taskRoutine) {
        line = this.pick([
          `${taskRoutine[0] + 1} 号的操作记录看着正常，不过不能说明身份。`,
          `设备没在 ${taskRoutine[0] + 1} 号那里报异常，这不算证明。`
        ]);
      } else if (suspect) {
        line = this.pick([
          `我看到 ${suspect[0] + 1} 号有个动作不太对，想听听解释。`,
          `${suspect[0] + 1} 号刚才的行动让我有点在意，但我还不确定。`,
          `先留意一下 ${suspect[0] + 1} 号，我看到了一处可疑动作。`
        ]);
      } else if (p.role === 'alien' && this.random() < 0.55) {
        const candidates = this.living.filter(t => t.role !== 'alien' && t.id !== p.id && !(t.id === 0 && this.elapsed < PLAYER_PROTECTION_SECONDS));
        const victim = candidates[Math.floor(this.random() * candidates.length)];
        if (victim) line = this.pick([
          `我觉得 ${victim.id + 1} 号有点可疑，有人也注意到了吗？`,
          `要不先问问 ${victim.id + 1} 号刚才在做什么？`,
          `我没证据，不过 ${victim.id + 1} 号的行动值得问一下。`
        ]);
      }
      this.statements.push({ speaker: p.id, text: line });
      this.botVoteAt.set(p.id, 3 + this.random() * 12);
    }
    return true;
  }
  private pick(lines: string[]): string { return lines[Math.floor(this.random() * lines.length)]; }
  private idleMeetingLine(p: Person): string {
    const room = ROOMS.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)?.name ?? '走廊';
    const lines = [
      `我刚从${room}过来，没看清现场。`,
      '先听听发现现场的人怎么说，别急着投。',
      '有人记得刚才谁离开了现场吗？',
      '我暂时没有把握，想先听听其他线索。',
      '这条线索还不够，我建议把时间线对一下。',
      '刚才有没有人看到异常？我可能错过了。',
      '先说清楚发现现场的时间和位置吧。',
      '我不想只凭感觉放飞谁，大家还有别的发现吗？',
      '我刚在做自己的事，附近的动静没注意到。',
      '目前听起来都只是猜测，谁有亲眼看到的情况？'
    ];
    if (p.role === 'police') lines.push('大家把看到的经过说具体一点，我会认真核对。', '没有证据之前，先别把怀疑当结论。');
    if (p.role === 'seer') lines.push('我会继续留意大家的身份线索，现在先听你们说。', '有些事我还不能确定，先不急着下判断。');
    if (p.role === 'alien') lines.push('我刚也在忙任务，怎么突然就开会了？', '要不先聊聊谁最先发现现场的？');
    return this.pick(lines);
  }
  accuse(id: number): void {
    if (this.phase !== 'discussion' || !this.player.alive || !this.people[id]?.alive || id === 0) return;
    this.statements.unshift({ speaker: 0, text: `我怀疑${id + 1} 号，请大家留意。` });
  }
  say(message: string): void {
    const clean = message.trim().slice(0, 120);
    if (this.phase === 'discussion' && this.player.alive && clean) this.statements.unshift({ speaker: 0, text: clean });
  }
  startVote(): void { if (this.phase === 'discussion') { this.phase = 'vote'; this.remaining = 20; } }
  vote(voter: number, target: number | null): boolean {
    if (this.phase !== 'vote' || !this.people[voter]?.alive || this.votes.has(voter) || (target !== null && (!this.people[target]?.alive || target === voter))) return false;
    this.votes.set(voter, target);
    if (this.votes.size === this.living.length) this.finishVote();
    return true;
  }
  finishVote(): void {
    if (this.phase !== 'vote') return;
    // Abstentions and timed-out ballots count as skip votes.
    for (const p of this.living) if (!this.votes.has(p.id)) this.votes.set(p.id, null);
    const counts = new Map<number | null, number>();
    this.votes.forEach(target => counts.set(target, (counts.get(target) ?? 0) + 1));
    this.lastCounts = counts;
    const ranking = [...counts].sort((a, b) => b[1] - a[1]);
    const top = ranking[0];
    this.phase = 'reveal'; this.remaining = 7;
    if (!top || top[0] === null || ranking[1]?.[1] === top[1]) this.reveal = '本轮无人放飞。平票或跳过票最多，所有人返回飞船。';
    else {
      const out = this.people[top[0]];
      this.reveal = `${out.id + 1} 号获得 ${top[1]} 票，被放飞。身份公布：${ROLE_NAMES[out.role]}。`;
      this.eliminate(out.id, false);
    }
  }
  resume(): void {
    if (this.phase !== 'reveal') return;
    this.phase = 'roam'; this.quiet = 12; this.bodies = []; this.selected = null;
    for (const p of this.living) { p.cooldown = Math.max(6, p.cooldown); p.suspects.clear(); }
    this.notice = this.player.alive ? '会议结束。继续寻找线索。' : '你已出局，正在旁观。';
  }
  exitVent(index = this.inVent): void {
    if (this.phase !== 'roam' || this.inVent === null || index === null || !VENTS[index]) return;
    Object.assign(this.player, VENTS[index]); this.inVent = null;
    for (const witness of this.living) if (witness.role !== 'alien' && visible(witness, this.player)) witness.suspects.set(0, 4);
    this.notice = '已从管道出来。留意附近是否有人看见。';
  }
  private botChoice(p: Person): number | null {
    const others = this.living.filter(t => t.id !== p.id && !(t.id === 0 && this.elapsed < PLAYER_PROTECTION_SECONDS) && (p.role !== 'alien' || t.role !== 'alien'));
    const scored = others.map(t => {
      const direct = p.suspects.get(t.id) ?? 0;
      const knowledge = p.knowledge.get(t.id);
      const clue = p.taskClues.get(t.id);
      const claims = this.statements.filter(s => s.speaker !== t.id && new RegExp(`(?<!\\d)${t.id + 1} 号`).test(s.text) && /怀疑|可疑|外星人/.test(s.text)).length;
      return { id: t.id, score: knowledge === 'alien' ? 10 : knowledge ? -10 : direct + (clue === 'irregular' ? 1.5 : clue === 'routine' ? -0.35 : 0) + claims * 0.65 };
    }).sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0) return scored[0].id;
    if (p.role === 'alien' && others.length && this.random() < 0.7) return others[Math.floor(this.random() * others.length)].id;
    return null;
  }
  tick(dt: number, input: Point = { x: 0, y: 0 }, working = false): void {
    if (this.phase === 'ended') return;
    if (this.phase !== 'roam') {
      this.remaining -= dt;
      if (this.phase === 'discussion' && this.remaining <= 0) this.startVote();
      else if (this.phase === 'vote') {
        for (const p of this.living.filter(p => p.id !== 0)) if (!this.votes.has(p.id) && 20 - this.remaining >= (this.botVoteAt.get(p.id) ?? 4)) { this.vote(p.id, this.botChoice(p)); if (this.phase !== 'vote') break; }
        if (this.phase === 'vote' && this.remaining <= 0) this.finishVote();
      } else if (this.phase === 'reveal' && this.remaining <= 0) this.resume();
      return;
    }
    this.elapsed += dt; this.quiet = Math.max(0, this.quiet - dt);
    for (const p of this.living) p.cooldown = Math.max(0, p.cooldown - dt);
    if (this.inVent === null) {
      const length = Math.hypot(input.x, input.y) || 1;
      move(this.player, input.x / length * 155 * dt, input.y / length * 155 * dt);
    }
    for (const p of this.living.filter(p => p.id !== 0)) {
      if (this.phase !== 'roam') break;
      p.think -= dt;
      if (this.quiet <= 0) {
        // Bots only act on things they can see; they never target a hidden player.
        const nearby = this.targetFor(p);
        if (nearby && !(nearby.id === 0 && (this.inVent !== null || this.elapsed < PLAYER_PROTECTION_SECONDS)) && p.cooldown === 0) {
          if (p.role === 'alien') this.useSkill(p, nearby);
          if (p.role === 'seer' && !p.used) this.useSkill(p, nearby);
          if (p.role === 'police' && !p.used && (p.suspects.get(nearby.id) ?? 0) >= 3) this.useSkill(p, nearby);
        if (p.role === 'witch' && !p.used) this.useSkill(p, nearby);
        }
        if (this.phase !== 'roam') break;
        if (p.think <= 0 && this.bodies.some(b => !b.reported && visible(p, b, 210))) { this.report(p.id); break; }
        if (p.think <= 0 && p.role === 'seer' && [...p.knowledge].some(([id, r]) => r === 'alien' && this.people[id].alive) && distance(p, PHONE) < 90) { this.report(p.id, true); break; }
      }
      if (p.role === 'alien' && distance(p, MOUSE_HOLE) < 110) {
        p.navigate -= dt;
        if (p.navigate <= 0) { this.sabotageMouseHole(p); p.navigate = 3 + this.random() * 2; }
      }
      if (this.advanceTask(p, dt, true)) continue;
      const assignment = p.tasks.find(task => !task.done);
      if (assignment) {
        const station = TASK_STATIONS[assignment.station];
        if (distance(p.goal, station) > 1) { p.goal = station; p.navigate = 0; }
        if (p.think < -2) p.think = 4 + this.random() * 6;
      } else if (p.role === 'alien') {
        p.goal = MOUSE_HOLE;
      } else if (p.carriedFood > 0) {
        p.goal = WAREHOUSE;
        if (distance(p, WAREHOUSE) < 110) {
          this.foodDelivered += p.carriedFood; p.carriedFood = 0;
          if (this.foodDelivered >= FOOD_TO_WIN) { this.winner = 'crew'; this.winReason = 'food'; this.phase = 'ended'; break; }
        }
      } else if (distance(p, p.goal) < 22 || p.think < -2) { p.goal = this.randomGoal(); p.think = 4 + this.random() * 6; p.navigate = 0; }
      p.navigate -= dt;
      if (p.navigate <= 0 || distance(p, p.waypoint) < 5) { p.waypoint = route(p, p.goal); p.navigate = 0.8; }
      const dest = p.waypoint, d = distance(p, dest);
      if (d > 2) { const speed = Math.min(d, 80 * dt); move(p, (dest.x - p.x) / d * speed, (dest.y - p.y) / d * speed); }
    }
  }
}

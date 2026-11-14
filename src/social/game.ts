import './social.css';
import { FOOD_TO_WIN, MOUSE_HOLE_MAX_HEALTH, PLAYER_PROTECTION_SECONDS, ROLE_HELP, ROLE_NAMES, roleOptions, SocialMatch, type Role } from './rules';
import { distance, MOUSE_HOLE, ROOMS, TASK_STATIONS, VENTS, visible } from './world';
import { SpaceScene } from './scene';

const COLORS = ['#75e2c0', '#ef9e82', '#8cb5f5', '#d5a1e8', '#e9cd79', '#75cbd5', '#e38296', '#9fc787', '#b7a4f3', '#e4aa66', '#83a4b4', '#ddafba', '#acbeb0', '#b9cfe9', '#af8e73', '#c6cc81', '#ad93b2', '#72928d', '#cdbda3', '#92a6d4'];
const roleIcon: Record<Role, string> = { alien: '◈', seer: '◎', police: '✧', witch: '☾', civilian: '◇' };
const icon = (kind: 'phone' | 'skill' | 'report') => kind === 'phone' ? '☎' : kind === 'skill' ? '✦' : '⚑';
const app = document.querySelector<HTMLDivElement>('#app')!;
document.title = '鼠洞身份局 · 运粮行动';
app.innerHTML = `
  <main class="orbit-app">
    <header class="orbit-header"><a class="orbit-brand" href="?">🐭 <span>鼠洞身份局<small>MEADOW BURROW / 运粮行动</small></span></a><div class="orbit-status"><i></i><span data-status>等待出发</span></div><button class="orbit-quiet" data-help>玩法说明</button><a class="orbit-quiet old-game" href="?game=tiga">奥特曼战斗 ↗</a></header>
    <div class="orbit-layout">
        <aside class="orbit-sidebar"><div class="orbit-overline">YOUR IDENTITY / 你的身份</div><section class="identity-card"><span class="identity-icon" data-role-icon>◇</span><span class="orbit-overline" data-number>01 号船员 · 你</span><h1 data-role>尚未登船</h1><p data-role-help>23 只老鼠。外星鼠混在鼠群里。</p><span class="orbit-badge" data-life>等待开始</span></section>
        <div class="orbit-side-title">行动记录 <span>PRIVATE LOG</span></div><div class="orbit-log" data-log aria-live="polite">准备好进入轨道了吗？</div>
        <section class="orbit-tasks"><div class="orbit-side-title">搬运任务 <span data-task-total>0 / 0</span></div><div data-task-list>登船后查看任务</div><p class="food-status" data-food-status>背粮 0 · 仓库 0 / ${FOOD_TO_WIN}</p></section>
        <section class="orbit-intel"><div class="orbit-side-title">身份线索 <span data-intel-count>0</span></div><div data-intel>预言结果只会显示给预言者。<br>投票放飞后会向所有人公开身份。</div></section>
        <footer class="orbit-side-footer"><span>鼠群 20 <b>·</b> 外星鼠 3</span><p>答题找粮，运进仓库保护鼠洞</p><button class="orbit-quiet" data-restart>重新开局 ↗</button></footer>
      </aside>
      <section class="orbit-stage"><div class="orbit-map-header"><span><i class="orbit-live"></i> 鼠洞与粮道 <small>林地 01</small></span><span data-clock>00:00</span><span data-hole-status>鼠洞结构 100%</span></div>
        <div class="orbit-map" data-map><canvas aria-label="三维鼠洞地图，使用 WASD 移动，寻找答题粮食并运往仓库" tabindex="0"></canvas><div class="map-caption"><span>🐭 林地鼠道</span><span>答题找粮 · 仓库交粮 · 留意鼠洞</span></div><div class="spectator-banner" data-spectator hidden>你已变成幽灵 · 可以观战</div></div>
        <div class="orbit-context"><span data-context>运输仓库 / 开始寻找粮食</span><span class="orbit-key-guide">W A S D 移动 · E 互动 · B 技能</span></div>
        <div class="orbit-actions"><button data-skill><kbd>B</kbd><span><strong data-skill-title>身份技能</strong><small data-skill-detail>等待分配身份</small></span><span>${icon('skill')}</span></button><button data-report><kbd>N</kbd><span><strong>发现现场</strong><small>召集鼠群投票</small></span><span>${icon('report')}</span></button><button data-phone><kbd>☎</kbd><span><strong>鼠洞警报</strong><small>靠近树洞广场召集投票</small></span><span>↗</span></button></div>
        <div class="orbit-touch" aria-label="触屏移动"><button data-move="up" aria-label="向上">↑</button><button data-move="left" aria-label="向左">←</button><button data-move="down" aria-label="向下">↓</button><button data-move="right" aria-label="向右">→</button></div>
        <section class="task-panel" data-task-panel hidden aria-label="答题运粮"><header><div><span class="orbit-overline">粮食答题</span><h2 data-task-title>动物连线</h2></div><button class="orbit-quiet" data-task-close aria-label="关闭任务">关闭</button></header><p>按住左边的图案，拖到对应名字上再松开。答对后得到一份粮食。</p><div class="match-board" data-match-board><svg data-match-lines aria-hidden="true"></svg><div class="match-side" data-animal-side></div><div class="match-side" data-name-side></div></div><div class="grain-hint" data-alien-hint></div><div class="task-feedback" data-task-feedback>完成全部连线即可交卷。</div></section>
      </section>
    </div>
    <div class="orbit-overlay" data-modal></div>
  </main>`;

const get = <T extends Element = HTMLElement>(q: string) => app.querySelector<T>(q)!;
const canvas = get<HTMLCanvasElement>('canvas');
const scene = new SpaceScene(canvas, COLORS);
const modal = get('[data-modal]'), map = get('[data-map]');
let match: SocialMatch | null = null, menu = true, showingHelp = false, modalKey = '', lastNotice = '', logEntries: string[] = [];
let tapCount = 0, tapEnd = 0, tapRunning = false, availableRoles: Role[] = [];
const keys = new Set<string>();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const text = (q: string, value: string) => { const el = get(q); if (el.textContent !== value) el.textContent = value; };
function clearInput() { keys.clear(); }
function openMenu() {
  menu = true; modal.hidden = false; clearInput(); tapCount = 0; tapEnd = 0; tapRunning = false; availableRoles = [];
  modal.innerHTML = `<section class="orbit-welcome"><span class="orbit-overline">A SOCIAL DEDUCTION GAME</span><div class="welcome-orbit">🐭<span>23</span></div><h2>守住鼠洞。<br>把粮食运回来。</h2><p>20 只鼠群对抗 3 只外星鼠。<br>答题运粮，投票找出伪装者。</p><div class="role-distribution"><span>◈ <b>3</b> 外星鼠</span><span>◎ <b>3</b> 预言家</span><span>✧ <b>2</b> 警察</span><span>☾ <b>1</b> 女巫</span><span>◇ <b>14</b> 平民</span></div><div class="tap-challenge"><p data-tap-status>准备好后开始，5 秒内尽量多点。点得越快，越有机会抽到外星人。</p><button class="orbit-quiet" data-tap>开始手速挑战</button></div><label class="orbit-role-picker">本局身份<select data-role-select aria-label="选择本局身份" disabled><option>完成挑战后选择</option></select></label><button class="orbit-primary" data-start disabled>进入林地 <span>→</span></button><div class="welcome-keys"><span><kbd>WASD</kbd> 移动</span><span><kbd>E</kbd> 答题 / 运粮</span><span><kbd>N</kbd> 投票</span></div><p class="welcome-note">单人游玩 · 其余 22 只老鼠由电脑控制</p></section>`;
}
function start() {
  const role = get<HTMLSelectElement>('[data-role-select]').value as Role;
  if (!availableRoles.includes(role)) return;
  match = new SocialMatch(role);
  menu = false; showingHelp = false; modal.hidden = true; modalKey = ''; lastNotice = ''; logEntries = []; clearInput(); update(); canvas.focus();
}
function showHelp() {
  if (menu) return;
  showingHelp = true; modal.hidden = false; clearInput();
  modal.innerHTML = `<section class="orbit-dialog"><span class="orbit-overline">MEADOW FIELD MANUAL</span><h2>林地行动须知</h2><p>WASD / 方向键移动；点击可见角色选择目标。走到自己的答题台附近按 E，完成动物连线后拿到一份粮食；走到运输仓库按 E 入库。</p><div class="help-roles">${(Object.keys(ROLE_NAMES) as Role[]).map(r => `<p><strong>${roleIcon[r]} ${ROLE_NAMES[r]}</strong><br>${ROLE_HELP[r]}</p>`).join('')}</div><p>答题时会出现一条外星鼠编号线索，线索不会直接指出是谁。仓库累计收到 ${FOOD_TO_WIN} 份粮食，鼠群获胜。外星鼠在鼠洞边按 E 破坏鼠洞，结构降到 0 时外星鼠获胜。</p><p>发现倒地者按 N 投票找出外星鼠。被袭击的老鼠只会自己知道袭击者是谁；幽灵可以移动观战，不能说话、投票、答题或搬粮。</p><button class="orbit-primary" data-close-help>返回林地 →</button></section>`;
}
function selectedOrNearest() { return match?.targetFor(match.player); }
function update() {
  if (!match) return;
  const m = match, p = m.player;
  if (!p.alive) get('[data-task-panel]').hidden = true;
  text('[data-status]', `${m.phase === 'ended' ? '航程结束' : m.phase === 'roam' ? '自由行动' : '会议进行中'} · ${m.living.length} / ${m.people.length} 只存活`);
  text('[data-role-icon]', roleIcon[p.role]); text('[data-role]', ROLE_NAMES[p.role]); text('[data-role-help]', ROLE_HELP[p.role]);
  text('[data-life]', p.alive ? m.inVent !== null ? '树根洞中 · 隐藏' : m.elapsed < PLAYER_PROTECTION_SECONDS ? `开局保护 ${Math.ceil(PLAYER_PROTECTION_SECONDS - m.elapsed)} 秒` : '身份保密中' : '幽灵 · 移动观战');
  get('.identity-card').dataset.identity = p.role;
  text('[data-clock]', `${String(Math.floor(m.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(m.elapsed % 60)).padStart(2, '0')}`);
  if (m.notice !== lastNotice) {
    lastNotice = m.notice; logEntries.unshift(m.notice); logEntries = logEntries.slice(0, 5);
    const log = get('[data-log]'); log.replaceChildren(...logEntries.map((s, i) => { const div = document.createElement('p'); div.textContent = s; if (i === 0) div.className = 'recent'; return div; }));
  }
  const known = [...p.knowledge];
  text('[data-intel-count]', String(known.length));
  const intel = known.map(([id, r]) => `${String(id + 1).padStart(2, '0')} 号 · ${ROLE_NAMES[r]}${m.people[id].alive ? '' : '（已出局）'}`);
  intel.unshift(`${ROLE_NAMES[p.role]}同伴：${m.people.filter(t => t.role === p.role && t.id !== 0).map(t => `${t.id + 1} 号${t.alive ? ' ' : '（出局）'}`).join('、') || '无'}`);
  if (!p.alive && p.ghostKiller !== null) intel.unshift(`你被 ${p.ghostKiller + 1} 号袭击。只有你知道这个秘密。`);
  text('[data-intel]', intel.join('\n') || '暂无身份线索。放飞后公开身份，预言结果仅自己可见。');
  const target = selectedOrNearest();
  const tasksDone = m.people.flatMap(person => person.tasks).filter(task => task.done).length;
  const tasksAll = m.people.flatMap(person => person.tasks).length;
  text('[data-task-total]', `${tasksDone} / ${tasksAll}`);
  const taskList = get('[data-task-list]');
  taskList.innerHTML = p.role === 'alien' ? '<p>没有运粮任务。可以在答题台旁伪装。</p>' : p.tasks.map(task => `<p class="${task.done ? 'task-done' : ''}">${task.done ? '✓' : '○'} ${TASK_STATIONS[task.station].name}</p>`).join('');
  text('[data-food-status]', `背粮 ${p.alive && p.role !== 'alien' ? p.carriedFood : 0} · 仓库 ${m.foodDelivered} / ${FOOD_TO_WIN}`);
  text('[data-hole-status]', `鼠洞结构 ${m.mouseHoleHealth} / ${MOUSE_HOLE_MAX_HEALTH}`);
  const nearTask = m.nearTaskStation();
  const room = ROOMS.find(r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
  const atWarehouse = m.atWarehouse();
  const nearHole = distance(p, MOUSE_HOLE) < 110;
  text('[data-context]', !p.alive ? '幽灵观战 / 不能说话、投票或搬粮' : m.inVent !== null ? '树根隧道 / 选择出口后离开' : atWarehouse ? `运输仓库 · ${p.carriedFood ? '按 E 把粮食存入仓库' : `鼠群已运入 ${m.foodDelivered} / ${FOOD_TO_WIN} 份`}` : p.role === 'alien' && nearHole ? '鼠洞边缘 · 按 E 破坏鼠洞' : nearTask !== null ? `${TASK_STATIONS[nearTask].room} · 按 E ${p.role === 'alien' ? '假装答题' : p.tasks.some(t => t.station === nearTask && !t.done) ? '寻找粮食答题' : '这不是你的任务'}` : `${room?.name ?? '林间鼠道'} / ${target ? `当前目标：${target.id + 1} 号 · 点击空地取消选择` : m.selected !== null ? `已选择 ${m.selected + 1} 号 · 请靠近目标` : '寻找答题台或仓库'}`);
  const nearVent = VENTS.some(v => distance(p, v) < 48);
  text('[data-skill-title]', p.role === 'alien' && (nearVent || m.inVent !== null) ? m.inVent !== null ? '离开管道' : '钻入管道' : { alien: '淘汰目标', seer: '预言身份', police: '开枪', witch: '复活队友', civilian: '平民身份' }[p.role]);
  text('[data-skill-detail]', p.role === 'civilian' ? '收集线索，参与讨论' : p.role !== 'alien' && p.used ? '本局机会已用完' : p.cooldown > 0 && !(p.role === 'alien' && nearVent) ? `冷却 ${Math.ceil(p.cooldown)} 秒` : p.role === 'alien' ? '次数不限 · 管道优先' : p.role === 'witch' ? '选择一名倒地者 · 限一次' : '整局仅可使用一次');
  get<HTMLButtonElement>('[data-skill]').disabled = !p.alive || m.phase !== 'roam' || (p.role !== 'alien' && p.used);
  get<HTMLButtonElement>('[data-report]').disabled = !p.alive || m.phase !== 'roam' || m.inVent !== null;
  get<HTMLButtonElement>('[data-phone]').disabled = !p.alive || m.phase !== 'roam' || m.inVent !== null;
  get('[data-spectator]').hidden = p.alive || m.phase === 'ended';
  renderModal();
}
function renderModal() {
  if (menu || showingHelp || !match) return;
  const m = match;
  const key = `${m.phase}:${m.round}:${m.selected}:${m.votes.size}:${m.inVent}:${m.statements.length}`;
  if (key === modalKey) { const timer = modal.querySelector<HTMLElement>('.meeting-timer b'); if (timer) timer.textContent = String(Math.max(0, Math.ceil(m.remaining))); return; }
  modalKey = key;
  if (m.phase === 'roam') {
    modal.hidden = m.inVent === null;
    if (m.inVent !== null) modal.innerHTML = `<section class="orbit-dialog vent-dialog"><span class="orbit-overline">UNDER THE FLOOR</span><h2>管道网络</h2><p>船员无法看见管道中的你。选择一个出口。</p><div class="vent-options">${VENTS.map((_, i) => `<button data-vent="${i}">${['动力舱', '医疗室', '导航室', '通讯室', '货物舱'][i]} ${m.inVent === i ? '· 当前' : '↗'}</button>`).join('')}</div><button class="orbit-quiet" data-exit-vent>B · 原地离开管道</button></section>`;
    return;
  }
  clearInput(); modal.hidden = false;
  if (m.phase === 'ended') {
    const crew = m.living.filter(p => p.role !== 'alien').length, aliens = m.living.length - crew;
    const reason = m.winReason === 'hole'
      ? '外星鼠连续破坏鼠洞，把鼠洞结构降到了 0。'
      : m.winReason === 'alien-majority'
        ? `外星鼠存活 ${aliens} 只，超过鼠群存活的 ${crew} 只。`
        : m.winReason === 'food'
          ? `鼠群把 ${FOOD_TO_WIN} 份粮食运进仓库，成功保住粮道。`
          : m.winReason === 'all-aliens-ejected'
            ? '投票已经找出并放飞所有外星鼠。'
            : '鼠群成功守住了林地。';
    modal.innerHTML = `<section class="orbit-dialog end-dialog"><div class="end-symbol">${m.winner === 'crew' ? '✧' : '◈'}</div><span class="orbit-overline">MISSION COMPLETE</span><h2>${m.winner === 'crew' ? '鼠群获胜' : '外星鼠获胜'}</h2><p>${reason}</p>${m.reveal ? `<p>${m.reveal}</p>` : ''}<div class="end-counts"><span><b>${crew}</b>存活鼠群</span><span><b>${aliens}</b>存活外星鼠</span></div><div class="end-roster">${m.people.map(p => `<span class="${p.alive ? '' : 'out'}">${p.id + 1} 号 ${ROLE_NAMES[p.role]}${p.id === 0 ? ' · 你' : ''}</span>`).join('')}</div><button class="orbit-primary" data-restart>再来一局 →</button></section>`;
    return;
  }
  if (m.phase === 'reveal') {
    modal.innerHTML = `<section class="orbit-dialog reveal-dialog"><span class="orbit-overline">AIRLOCK / 投票结果</span><div class="eject-symbol">✧</div><h2>${m.reveal.includes('无人') ? '无人放飞' : '身份已揭晓'}</h2><p>${m.reveal}</p><div class="vote-tally">${[...m.lastCounts].sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span>${id === null ? '跳过' : `${id + 1} 号`} <b>${n} 票</b></span>`).join('')}</div><button class="orbit-primary" data-resume>返回飞船 · ${Math.ceil(m.remaining)}s →</button></section>`;
    return;
  }
  const voted = m.votes.has(0), discussion = m.phase === 'discussion';
  modal.innerHTML = `<section class="orbit-meeting" role="dialog" aria-modal="true" aria-label="讨论与投票"><header><div><span class="orbit-overline">EMERGENCY MEETING / 第 ${String(m.round).padStart(2, '0')} 次会议</span><h2>${discussion ? '有人打破了沉默。' : '谁该离开飞船？'}</h2><p>${m.reportReason}</p></div><div class="meeting-timer"><b>${Math.max(0, Math.ceil(m.remaining))}</b><span>${discussion ? '讨论' : '投票'}剩余秒数</span></div></header><div class="meeting-body"><section class="meeting-people"><div class="orbit-side-title">${discussion ? '选择一人，提出怀疑' : '选择一人，确认放飞'}<span>${m.living.length} 人存活</span></div><div class="crew-grid">${m.people.map(p => `<button data-person="${p.id}" style="--crew-color:${COLORS[p.id % COLORS.length]}" ${!p.alive || p.id === 0 || !m.player.alive || (!discussion && voted) ? 'disabled' : ''} class="${p.alive ? '' : 'out'} ${m.selected === p.id ? 'selected' : ''}" aria-pressed="${m.selected === p.id}"><span class="crew-avatar">◉</span><strong>${String(p.id + 1).padStart(2, '0')} 号${p.id === 0 ? ' · 你' : ''}</strong><small>${!p.alive ? '已出局' : p.id !== 0 && m.player.role === p.role ? `${ROLE_NAMES[p.role]}同伴` : p.id === 0 ? ROLE_NAMES[p.role] : m.player.knowledge.has(p.id) ? ROLE_NAMES[m.player.knowledge.get(p.id)!] : '身份未知'}</small></button>`).join('')}</div></section><section class="meeting-chat"><div class="orbit-side-title">会议记录 <span>目击 / 推理</span></div><p class="chat-note">电脑根据自己的视野和线索发言；发言也可能有误。</p><div class="chat-scroll">${m.statements.map(s => `<div class="chat-line"><b style="color:${COLORS[s.speaker % COLORS.length]}">${String(s.speaker + 1).padStart(2, '0')} 号${s.speaker === 0 ? ' · 你' : ''}</b><p>${escapeHtml(s.text)}</p></div>`).join('')}</div>${discussion && m.player.alive ? `<div class="meeting-compose"><label>我怀疑 <input data-suspect-number type="number" min="1" max="${m.people.length}" placeholder="号码"> 号</label><button data-send-suspect>发送怀疑</button><label>自由发言 <input data-message maxlength="120" placeholder="输入你想说的话"></label><button data-send-message>发送</button></div>` : ''}</section></div><footer><span>${!m.player.alive ? '你已出局，仅可旁观。' : discussion ? '先观察，再做出判断。可以多次发言，也可以填写号码提出怀疑。' : voted ? `已${m.votes.get(0) === null ? '跳过投票' : `投给 ${m.votes.get(0)! + 1} 号`} · 等待其他人` : `已投票 ${m.votes.size} / ${m.living.length} · 平票不放飞`}</span><div>${discussion ? `<button class="orbit-quiet" data-accuse ${!m.player.alive || m.selected === null ? 'disabled' : ''}>提出怀疑</button><button class="orbit-primary" data-start-vote>进入投票 →</button>` : `<button class="orbit-quiet" data-skip-vote ${voted || !m.player.alive ? 'disabled' : ''}>跳过本轮</button><button class="orbit-primary" data-confirm-vote ${m.selected === null || voted || !m.player.alive ? 'disabled' : ''}>确认投给 ${m.selected === null ? '…' : `${m.selected + 1} 号`} →</button>`}</div></footer></section>`;
}

let activeTaskAnimal: number | null = null;
let taskMatches = new Map<number, number>();
let taskOrder = [0, 1, 2];
const animalNames = ['熊猫', '狐狸', '企鹅'];
const animalIcons = ['🐼', '🦊', '🐧'];
function openTask() {
  if (!match || match.phase !== 'roam') return;
  const station = match.nearTaskStation();
  if (station === null) return;
  const task = match.player.tasks.find(t => t.station === station && !t.done);
  if (match.player.role !== 'alien' && !task) { match.notice = '这不是分配给你的任务。'; update(); return; }
  taskMatches = new Map(); taskOrder = [0, 1, 2].sort(() => Math.random() - .5);
  get('[data-task-title]').textContent = `${TASK_STATIONS[station].name} · 运粮答题`;
  get('[data-alien-hint]').textContent = `身份线索：${match.alienHint()} 这是线索，不是完整答案。`;
  get('[data-task-feedback]').textContent = '按住左边的图案，拖到对应名字上再松开。';
  get('[data-task-panel]').hidden = false;
  const animals = get('[data-animal-side]'), names = get('[data-name-side]');
  animals.innerHTML = animalNames.map((name, i) => `<button class="match-node animal-node" data-animal="${i}" aria-label="${name}"><span>${animalIcons[i]}</span><small>图案 ${i + 1}</small></button>`).join('');
  names.innerHTML = taskOrder.map((id, row) => `<button class="match-node name-node" data-name="${id}" data-row="${row}">${animalNames[id]}</button>`).join('');
  drawTaskLines();
}
function drawTaskLines(end?: { x: number; y: number }) {
  const board = get('[data-match-board]'), svg = get<SVGSVGElement>('[data-match-lines]');
  const rect = board.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`); svg.replaceChildren();
  const line = (x1: number, y1: number, x2: number, y2: number, temporary = false) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path.setAttribute('x1', String(x1)); path.setAttribute('y1', String(y1)); path.setAttribute('x2', String(x2)); path.setAttribute('y2', String(y2));
    path.setAttribute('stroke', temporary ? '#f1cf83' : '#8ee2be'); path.setAttribute('stroke-width', '3'); path.setAttribute('stroke-linecap', 'round'); if (temporary) path.setAttribute('stroke-dasharray', '5 5'); svg.append(path);
  };
  for (const [animal, name] of taskMatches) {
    const a = board.querySelector<HTMLElement>(`[data-animal="${animal}"]`)!.getBoundingClientRect();
    const n = board.querySelector<HTMLElement>(`[data-name="${name}"]`)!.getBoundingClientRect();
    line(a.right - rect.left, a.top + a.height / 2 - rect.top, n.left - rect.left, n.top + n.height / 2 - rect.top);
  }
  if (end && activeTaskAnimal !== null) {
    const a = board.querySelector<HTMLElement>(`[data-animal="${activeTaskAnimal}"]`)!.getBoundingClientRect();
    line(a.right - rect.left, a.top + a.height / 2 - rect.top, end.x - rect.left, end.y - rect.top, true);
  }
}
function finishTaskPuzzle() {
  if (!match) return;
  const station = match.nearTaskStation(); if (station === null) return;
  if (match.player.role === 'alien') {
    get('[data-task-feedback]').textContent = '假装答题完成。没有粮食进入你的背包。';
  } else if (match.completeTask(station)) {
    get('[data-task-feedback]').textContent = `答对了，拿到 1 份粮食！背包共 ${match.player.carriedFood} 份。`;
    update();
  }
}
const taskBoard = get('[data-match-board]');
taskBoard.addEventListener('pointerdown', event => {
  const node = (event.target as HTMLElement).closest<HTMLElement>('[data-animal]');
  if (!node || !match || match.nearTaskStation() === null) return;
  activeTaskAnimal = Number(node.dataset.animal); node.setPointerCapture(event.pointerId);
});
taskBoard.addEventListener('pointermove', event => {
  if (activeTaskAnimal !== null) drawTaskLines({ x: event.clientX, y: event.clientY });
});
taskBoard.addEventListener('pointerup', event => {
  if (activeTaskAnimal === null) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-name]');
  const animal = activeTaskAnimal; activeTaskAnimal = null;
  if (target && Number(target.dataset.name) === animal) {
    for (const [from, to] of taskMatches) if (from === animal || to === animal) taskMatches.delete(from);
    taskMatches.set(animal, animal);
    get('[data-task-feedback]').textContent = `连线 ${taskMatches.size} / 3`;
    drawTaskLines();
    if (taskMatches.size === 3) finishTaskPuzzle();
  } else drawTaskLines();
});
get('[data-task-close]').addEventListener('click', () => { get('[data-task-panel]').hidden = true; activeTaskAnimal = null; });

app.addEventListener('click', event => {
  const b = (event.target as HTMLElement).closest<HTMLElement>('button');
  if (!b || b.hasAttribute('disabled')) return;
  if (b.hasAttribute('data-tap')) { if (!tapRunning && !availableRoles.length) { tapRunning = true; tapEnd = performance.now() + 5000; b.textContent = '快点我！'; } else if (tapRunning && performance.now() < tapEnd) { tapCount++; } return; }
  if (b.hasAttribute('data-start')) { start(); return; }
  if (b.hasAttribute('data-restart')) { openMenu(); return; }
  if (b.hasAttribute('data-help')) { showHelp(); return; }
  if (b.hasAttribute('data-close-help')) { showingHelp = false; modalKey = ''; renderModal(); canvas.focus(); return; }
  if (!match || menu || showingHelp) return;
  if (b.hasAttribute('data-skill')) match.skill();
  if (b.hasAttribute('data-report')) match.report();
  if (b.hasAttribute('data-phone')) match.report(0, true);
  if (b.dataset.person !== undefined) match.selected = Number(b.dataset.person);
  if (b.hasAttribute('data-accuse') && match.selected !== null) match.accuse(match.selected);
  if (b.hasAttribute('data-send-suspect')) { const n = Number(get<HTMLInputElement>('[data-suspect-number]').value); if (Number.isInteger(n) && n >= 1 && n <= match.people.length) match.accuse(n - 1); }
  if (b.hasAttribute('data-send-message')) match.say(get<HTMLInputElement>('[data-message]').value);
  if (b.hasAttribute('data-start-vote')) match.startVote();
  if (b.hasAttribute('data-confirm-vote') && match.selected !== null) match.vote(0, match.selected);
  if (b.hasAttribute('data-skip-vote')) match.vote(0, null);
  if (b.hasAttribute('data-resume')) match.resume();
  if (b.dataset.vent !== undefined) match.exitVent(Number(b.dataset.vent));
  if (b.hasAttribute('data-exit-vent')) match.exitVent();
  update();
});
canvas.addEventListener('click', event => {
  if (!match || match.phase !== 'roam' || menu || showingHelp || !match.player.alive) return;
  const p = scene.pointAt(event.clientX, event.clientY);
  if (!p) return;
  const candidates = match.player.role === 'witch'
    ? match.people.filter(t => !t.alive && match!.bodies.some(body => body.id === t.id) && visible(match!.player, t, 180))
    : match.living.filter(t => t.id !== 0 && visible(match!.player, t));
  const candidate = candidates.sort((a, b) => distance(a, p) - distance(b, p))[0];
  match.selected = candidate && distance(candidate, p) < 38 ? candidate.id : null; update();
});
window.addEventListener('keydown', event => {
  if (menu || showingHelp || !match || (event.target as HTMLElement).matches('select,input,textarea')) return;
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', 'b', 'n', 'e'].includes(key)) event.preventDefault();
  keys.add(key);
  if (event.repeat) return;
  if (key === 'b') match.skill();
  if (key === 'n') match.report();
  if (key === 'e' && !get('[data-task-panel]').hidden) get('[data-task-panel]').hidden = true;
  else if (key === 'e' && match.atWarehouse()) { if (!match.deliverFood()) match.notice = '仓库里没有可入库的粮食。'; }
  else if (key === 'e' && match.player.role === 'alien' && distance(match.player, MOUSE_HOLE) < 110) match.sabotageMouseHole();
  else if (key === 'e') openTask();
  update();
});
window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
get('.orbit-touch').querySelectorAll<HTMLButtonElement>('button').forEach(b => {
  const key = { up: 'w', left: 'a', down: 's', right: 'd' }[b.dataset.move!]!;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys.add(key); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(name, () => keys.delete(key));
});
let previous = performance.now(), uiElapsed = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - previous) / 1000); previous = now;
  if (menu && tapRunning) {
    const left = Math.max(0, tapEnd - now);
    text('[data-tap-status]', `剩余 ${(left / 1000).toFixed(1)} 秒 · 已点击 ${tapCount} 次`);
    if (left === 0) {
      tapRunning = false; availableRoles = roleOptions(tapCount);
      const select = get<HTMLSelectElement>('[data-role-select]');
      select.replaceChildren(...availableRoles.map(role => { const option = document.createElement('option'); option.value = role; option.textContent = ROLE_NAMES[role]; return option; }));
      select.disabled = false; get<HTMLButtonElement>('[data-start]').disabled = false;
      get<HTMLButtonElement>('[data-tap]').disabled = true;
      text('[data-tap-status]', `挑战完成：点击 ${tapCount} 次，请从抽到的 3 种身份中选择。`);
    }
  }
  if (match && !menu && !showingHelp && !document.hidden) match.tick(dt, { x: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y: Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')) });
  uiElapsed += dt; if (uiElapsed > 0.1) { update(); uiElapsed = 0; }
  scene.draw(match); requestAnimationFrame(frame);
}
openMenu(); requestAnimationFrame(frame);

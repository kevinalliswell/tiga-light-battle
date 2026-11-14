export interface Point { x: number; y: number }
export interface Room extends Point { w: number; h: number; name: string; color: string }
export const WORLD = { w: 2600, h: 1650 };
export const ROOMS: Room[] = [
  { x: 110, y: 110, w: 500, h: 300, name: '蘑菇林', color: '#75b982' },
  { x: 1050, y: 110, w: 500, h: 300, name: '奶酪工坊', color: '#d5ad57' },
  { x: 1990, y: 110, w: 500, h: 300, name: '浆果园', color: '#c77a88' },
  { x: 110, y: 650, w: 500, h: 300, name: '树根隧道', color: '#a67f5d' },
  { x: 1050, y: 650, w: 500, h: 300, name: '鼠洞广场', color: '#78bca9' },
  { x: 1990, y: 650, w: 500, h: 300, name: '水滴泉', color: '#6baec3' },
  { x: 110, y: 1190, w: 500, h: 300, name: '种子库', color: '#c5a35c' },
  { x: 1050, y: 1190, w: 500, h: 300, name: '运输仓库', color: '#d3a85f' },
  { x: 1990, y: 1190, w: 500, h: 300, name: '树洞工地', color: '#9e835d' },
];
export const CORRIDORS = [
  { x: 600, y: 205, w: 460, h: 150 }, { x: 1540, y: 205, w: 460, h: 150 },
  { x: 600, y: 745, w: 460, h: 150 }, { x: 1540, y: 745, w: 460, h: 150 },
  { x: 600, y: 1285, w: 460, h: 150 }, { x: 1540, y: 1285, w: 460, h: 150 },
  { x: 290, y: 400, w: 140, h: 250 }, { x: 290, y: 950, w: 140, h: 240 },
  { x: 1230, y: 400, w: 140, h: 250 }, { x: 1230, y: 950, w: 140, h: 240 },
  { x: 2170, y: 400, w: 140, h: 250 }, { x: 2170, y: 950, w: 140, h: 240 },
];
const FLOOR = [...ROOMS, ...CORRIDORS];
export const VENTS: Point[] = [{ x: 190, y: 330 }, { x: 2400, y: 330 }, { x: 190, y: 1330 }, { x: 2400, y: 1330 }, { x: 1300, y: 850 }];
export const MOUSE_HOLE: Point = { x: 1300, y: 800 };
export const WAREHOUSE: Point = { x: 1300, y: 1350 };
export const PHONE: Point = MOUSE_HOLE;
export const TASK_STATIONS = ROOMS.map((room, id) => ({
  id, x: room.x + 110, y: room.y + room.h - 80, room: room.name,
  name: ['找松果粮', '整理奶酪', '采集浆果', '搬运树枝', '清点粮袋', '找水滴', '分拣种子', '送粮入库', '修补树洞'][id],
}));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function walkable(p: Point, radius = 0): boolean {
  const inside = (x: number, y: number) => FLOOR.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  return [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]].every(([x, y]) => inside(p.x + x, p.y + y));
}
export function visible(a: Point, b: Point, range = 360): boolean {
  const d = distance(a, b);
  if (d > range) return false;
  for (let i = 0; i <= d; i += 8) {
    const t = d ? i / d : 0;
    if (!walkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}
export function move(p: Point, dx: number, dy: number): void {
  if (walkable({ x: p.x + dx, y: p.y }, 15)) p.x += dx;
  if (walkable({ x: p.x, y: p.y + dy }, 15)) p.y += dy;
}
export function route(a: Point, b: Point): Point {
  if (visible(a, b, 4000)) return b;
  const nodes: Point[] = [a, b,
    { x: 370, y: 330 }, { x: 370, y: 770 }, { x: 370, y: 1330 },
    { x: 1310, y: 330 }, { x: 1310, y: 770 }, { x: 1310, y: 1330 },
    { x: 2210, y: 330 }, { x: 2210, y: 770 }, { x: 2210, y: 1330 },
  ];
  const costs = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = new Set<number>();
  costs[0] = 0;
  for (let pass = 0; pass < nodes.length; pass++) {
    let u = -1;
    nodes.forEach((_, i) => { if (!done.has(i) && (u < 0 || costs[i] < costs[u])) u = i; });
    if (u < 0 || !Number.isFinite(costs[u])) break;
    if (u === 1) break;
    done.add(u);
    nodes.forEach((n, v) => {
      if (!done.has(v) && visible(nodes[u], n, 4000)) {
        const next = costs[u] + distance(nodes[u], n);
        if (next < costs[v]) { costs[v] = next; prev[v] = u; }
      }
    });
  }
  let step = 1;
  while (prev[step] > 0) step = prev[step];
  return prev[step] < 0 ? a : nodes[step];
}

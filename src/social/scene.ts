import * as THREE from 'three';
import { CORRIDORS, MOUSE_HOLE, PHONE, ROOMS, TASK_STATIONS, VENTS, visible, WAREHOUSE, type Point } from './world';
import { MOUSE_HOLE_MAX_HEALTH, type SocialMatch } from './rules';

export class SpaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 1, 4000);
  private characters: THREE.Group[] = [];
  private bodies: THREE.Group[] = [];
  private ray = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private holeShell!: THREE.Mesh;
  constructor(private canvas: HTMLCanvasElement, colors: string[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.background = new THREE.Color('#091321');
    this.scene.add(new THREE.HemisphereLight(0xd2f5ff, 0x263047, 2));
    const light = new THREE.DirectionalLight(0xffffff, 1.5); light.position.set(200, 600, 300); this.scene.add(light);
    const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .8 })); m.position.set(x, y, z); this.scene.add(m); return m;
    };
    for (const r of [...CORRIDORS, ...ROOMS]) {
      box(r.w + 12, 12, r.h + 12, '#405969', r.x + r.w/2, -10, r.y + r.h/2);
      box(r.w, 4, r.h, '#243b4a', r.x + r.w/2, -2, r.y + r.h/2);
    }
    const wall = (length: number, x: number, z: number, horizontal: boolean, tint = '#547181') => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? length : 14, 118, horizontal ? 14 : length), new THREE.MeshStandardMaterial({ color: tint, roughness: .62, metalness: .12 }));
      mesh.position.set(x, 54, z); this.scene.add(mesh);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? length : 4, 4, horizontal ? 4 : length), new THREE.MeshStandardMaterial({ color: '#8bd5cf', emissive: '#28635e', emissiveIntensity: .45 }));
      strip.position.set(x, 106, z); this.scene.add(strip);
    };
    const edge = (start: number, end: number, openings: Array<[number, number]>, put: (a: number, b: number) => void) => {
      let cursor = start;
      for (const [a, b] of openings.sort((x, y) => x[0] - y[0])) { if (a > cursor) put(cursor, a); cursor = Math.max(cursor, b); }
      if (cursor < end) put(cursor, end);
    };
    for (const r of ROOMS) {
      const midX = r.x + r.w / 2, midZ = r.y + r.h / 2;
      const row = Math.round((r.y - 110) / 540), col = Math.round((r.x - 110) / 940);
      const openX: Array<[number, number]> = row === 1 ? [[midX - 70, midX + 70]] : row === 2 ? [[midX - 70, midX + 70]] : [];
      const openZ: Array<[number, number]> = [[midZ - 75, midZ + 75]];
      edge(r.x, r.x + r.w, openX, (a, b) => wall(b-a, (a+b)/2, r.y, true));
      edge(r.x, r.x + r.w, openX, (a, b) => wall(b-a, (a+b)/2, r.y+r.h, true));
      edge(r.y, r.y + r.h, openZ, (a, b) => wall(b-a, r.x, (a+b)/2, false));
      edge(r.y, r.y + r.h, openZ, (a, b) => wall(b-a, r.x+r.w, (a+b)/2, false));
      for (let i = -1; i <= 1; i++) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(5, 35, 52), new THREE.MeshStandardMaterial({ color: '#6ed8ee', emissive: '#25758c', emissiveIntensity: .4, metalness: .3 }));
        window.position.set(r.x + r.w / 2 + i * 68, 72, r.y + 5); this.scene.add(window);
      }
    }
    for (const r of ROOMS) {
      box(r.w - 50, 3, 8, r.color, r.x + r.w/2, 2, r.y + 22);
      if (r.name !== '中央大厅') {
        box(75, 28, 38, '#42606b', r.x + r.w/2, 14, r.y + r.h/2);
        box(50, 3, 25, r.color, r.x + r.w/2, 30, r.y + r.h/2);
      }
      const label = this.label(r.name, '#c5e7de'); label.position.set(r.x+r.w/2, 5, r.y+45); label.scale.set(175, 38, 1); this.scene.add(label);
    }
    for (const v of VENTS) {
      box(46, 5, 28, '#758c94', v.x, 3, v.y);
      for (let i=0;i<5;i++) box(3, 2, 20, '#172c38', v.x-16+i*8, 7, v.y);
    }
    for (const station of TASK_STATIONS) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(44, 24, 34), new THREE.MeshStandardMaterial({ color: '#476871', metalness: .24, roughness: .42 }));
      base.position.set(station.x, 12, station.y); this.scene.add(base);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(33, 23, 3), new THREE.MeshStandardMaterial({ color: '#99f1d0', emissive: '#3a9c79', emissiveIntensity: .8 }));
      screen.position.set(station.x, 35, station.y - 8); screen.rotation.x = -.2; this.scene.add(screen);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(33, 1.5, 8, 32), new THREE.MeshBasicMaterial({ color: '#9cf0ce', transparent: true, opacity: .6 }));
      ring.rotation.x = Math.PI / 2; ring.position.set(station.x, 3, station.y); this.scene.add(ring);
    }
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(105, 130, 105, 12), new THREE.MeshStandardMaterial({ color: '#8b684b', roughness: .9 }));
    stump.position.set(MOUSE_HOLE.x, 52, MOUSE_HOLE.y); this.scene.add(stump);
    this.holeShell = new THREE.Mesh(new THREE.TorusGeometry(67, 19, 10, 24), new THREE.MeshStandardMaterial({ color: '#39261f', roughness: 1 }));
    this.holeShell.position.set(MOUSE_HOLE.x, 64, MOUSE_HOLE.y); this.scene.add(this.holeShell);
    const holeLabel = this.label('鼠 洞 · 警报', '#f1cda0'); holeLabel.position.set(MOUSE_HOLE.x, 155, MOUSE_HOLE.y); holeLabel.scale.set(170, 36, 1); this.scene.add(holeLabel);
    for (let i = 0; i < 8; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(82, 60, 75), new THREE.MeshStandardMaterial({ color: i % 2 ? '#b6874d' : '#c89d5c', roughness: .92 }));
      crate.position.set(WAREHOUSE.x + (i % 4 - 1.5) * 115, 30, WAREHOUSE.y + (Math.floor(i / 4) - .5) * 125); this.scene.add(crate);
      const grain = new THREE.Mesh(new THREE.SphereGeometry(13, 8, 6), new THREE.MeshStandardMaterial({ color: '#e7d18c', roughness: .95 }));
      grain.position.set(crate.position.x, 66, crate.position.z); this.scene.add(grain);
    }
    const storeLabel = this.label('糧 食 仓 库', '#f5d99d'); storeLabel.position.set(WAREHOUSE.x, 140, WAREHOUSE.y - 180); storeLabel.scale.set(210, 42, 1); this.scene.add(storeLabel);
    for (let i=0;i<20;i++) {
      const character = this.astronaut(colors[i], i); this.characters.push(character); this.scene.add(character);
      const body = this.astronaut(colors[i], i); body.rotation.z = Math.PI / 2; this.bodies.push(body); this.scene.add(body);
    }
  }
  private label(value: string, color: string): THREE.Sprite {
    const c = document.createElement('canvas'); c.width=256; c.height=64;
    const ctx=c.getContext('2d')!; ctx.font='bold 28px Microsoft YaHei'; ctx.textAlign='center'; ctx.fillStyle=color; ctx.fillText(value,128,43);
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent:true, depthTest:false }));
  }
  private astronaut(color: string, id: number): THREE.Group {
    const group=new THREE.Group(); group.scale.setScalar(.75);
    const material=new THREE.MeshStandardMaterial({ color, roughness:.55 });
    const part=(geometry: THREE.BufferGeometry, mat: THREE.Material, x:number,y:number,z:number) => { const mesh=new THREE.Mesh(geometry,mat); mesh.position.set(x,y,z); group.add(mesh); };
    const fur = new THREE.MeshStandardMaterial({ color, roughness: .9 });
    const pink = new THREE.MeshStandardMaterial({ color: '#e99a9a', roughness: .9 });
    const cream = new THREE.MeshStandardMaterial({ color: '#f2e7ca', roughness: .9 });
    part(new THREE.SphereGeometry(19, 16, 12), fur, 0, 24, -2);
    part(new THREE.SphereGeometry(14, 16, 12), fur, 0, 43, 8);
    part(new THREE.SphereGeometry(7, 12, 8), cream, 0, 38, 21);
    for (const side of [-1, 1]) {
      part(new THREE.SphereGeometry(7, 12, 8), fur, side * 11, 55, 5);
      part(new THREE.SphereGeometry(4, 12, 8), pink, side * 12, 57, 7);
      part(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshStandardMaterial({ color: '#22272b' }), side * 6, 46, 19);
      part(new THREE.SphereGeometry(1.8, 8, 6), new THREE.MeshStandardMaterial({ color: '#d28a78' }), side * 3, 40, 26);
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,17,5), cream); whisker.position.set(side*8,39,24); whisker.rotation.z=side*.35; whisker.rotation.x=.3; group.add(whisker);
      part(new THREE.SphereGeometry(4, 10, 8), fur, side * 9, 8, 1);
    }
    const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0,19,-17),new THREE.Vector3(0,22,-30),new THREE.Vector3(6,30,-39),new THREE.Vector3(12,26,-45)]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 16, 2.3, 6, false), fur));
    part(new THREE.BoxGeometry(14, 12, 12), new THREE.MeshStandardMaterial({ color: '#8b6a44' }), 0, 27, -17);
    part(new THREE.SphereGeometry(5, 8, 6), new THREE.MeshStandardMaterial({ color: '#e7d18c' }), 0, 35, -17);
    const label=this.label(`${String(id+1).padStart(2,'0')}${id===0?' · 你':''}`, '#fff7e8'); label.position.set(0,70,0); label.scale.set(88,22,1); group.add(label);
    return group;
  }
  pointAt(x:number,y:number): Point | null {
    const rect=this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1),this.camera);
    const p=new THREE.Vector3(); return this.ray.ray.intersectPlane(this.ground,p) ? {x:p.x,y:p.z}:null;
  }
  draw(match: SocialMatch | null): void {
    const rect=this.canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width,rect.height,false);
    const aspect=rect.width/rect.height;
    this.camera.aspect=aspect; this.camera.fov=aspect < 1 ? 68 : 55; this.camera.updateProjectionMatrix();
    const player=match?.player; const x=player?.x ?? 700, z=player?.y ?? 450;
    this.camera.position.set(x, 470, z + 520); this.camera.lookAt(x, 0, z - 120);
    if (match) {
      const wear = 1 - match.mouseHoleHealth / MOUSE_HOLE_MAX_HEALTH;
      (this.holeShell.material as THREE.MeshStandardMaterial).color.setRGB(.22 + wear*.5,.13 + wear*.18,.1 + wear*.1);
      this.holeShell.scale.setScalar(1 - wear * .38);
    }
    for(let i=0;i<20;i++) {
      const model=this.characters[i], p=match?.people[i], body=match?.bodies.find(b=>b.id===i);
      const canSee=!!p && (!player?.alive || match?.phase==='ended' || (match?.inVent===null && visible(player,p)));
      model.visible=!!match && !!p && (p.alive || i===0) && canSee && !(i===0 && match.inVent!==null);
      if (p) { model.position.set(p.x, !p.alive && i===0 ? 15+Math.sin(performance.now()/400)*4 : 0,p.y); model.traverse(obj=>{ if(obj instanceof THREE.Mesh) { const material=obj.material as THREE.MeshStandardMaterial; material.transparent=!p.alive && i===0; material.opacity=material.transparent?.42:1; } }); }
      this.bodies[i].visible=!!body && (!!player && (!player.alive || visible(player,body)));
      if(body) this.bodies[i].position.set(body.x,16,body.y);
    }
    this.renderer.render(this.scene,this.camera);
  }
}

import * as THREE from 'three';
import { disposeObject } from './disposal';

interface ActiveEffect {
  object: THREE.Object3D;
  age: number;
  duration: number;
  update?: (progress: number, delta: number) => void;
}

export type RevivalSource = 'people' | 'statues';

function alignCylinder(object: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3) {
  const direction = new THREE.Vector3().subVectors(end, start);
  object.position.copy(start).add(end).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
}

export class Effects {
  private readonly scene: THREE.Scene;
  private readonly effects: ActiveEffect[] = [];
  private readonly crowdPositions: THREE.Vector3[] = [];
  private readonly statuePositions: THREE.Vector3[] = [];

  windWall(position: THREE.Vector3, heading: number) {
    const group=new THREE.Group();group.name='yasuo-wind-wall';
    group.position.copy(position);group.rotation.y=heading;
    const sheets:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>[]=[];
    for(let i=0;i<7;i++){
      const sheet=new THREE.Mesh(new THREE.PlaneGeometry(12,.4),new THREE.MeshBasicMaterial({color:0xacefe6,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));
      sheet.position.set(0,1+i*.9,3);group.add(sheet);sheets.push(sheet);
    }
    this.scene.add(group);
    this.effects.push({object:group,age:0,duration:4,update:p=>sheets.forEach((sheet,i)=>{
      sheet.position.x=Math.sin(p*28+i)*.7;sheet.material.opacity=Math.sin(Math.min(1,p*8)*Math.PI/2)*(1-p)*.65;
    })});
  }

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createCrowd();
    this.createUltramanStatues();
  }

  update(delta: number) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += delta;
      const progress = Math.min(1, effect.age / effect.duration);
      effect.update?.(progress, delta);
      if (progress < 1) continue;
      this.scene.remove(effect.object);
      disposeObject(effect.object);
      this.effects.splice(index, 1);
    }
    const spectators = this.scene.getObjectByName('rescue-spectators');
    if (spectators) spectators.visible = this.effects.some(effect => ['crowd-light-rescue','revival-lights'].includes(effect.object.name));
  }

  charge(root: THREE.Group, duration: number) {
    const group = new THREE.Group();group.name = 'ray-charge';
    const material = new THREE.MeshBasicMaterial({color:0xc1eeff,transparent:true,opacity:.7,depthWrite:false});
    const sparks = Array.from({length:24},()=>new THREE.Mesh(new THREE.SphereGeometry(.065,6,4),material));
    group.add(...sparks);this.scene.add(group);
    this.effects.push({object:group,age:0,duration,update:progress=>{
      root.updateMatrixWorld(true);
      sparks.forEach((spark,index)=>{
        const hand=root.getObjectByName(index%2?'right-hand':'left-hand');
        const origin=hand?.getWorldPosition(new THREE.Vector3())??root.position;
        const angle=progress*18+index*2.4,radius=(1-progress)*1.2+.12;
        spark.position.copy(origin).add(new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,Math.cos(angle*1.4)*radius));
        spark.scale.setScalar(.5+progress*1.4);
      });
    }});
  }

  ultraExplosion(position:THREE.Vector3){
    const group=new THREE.Group();group.name='ultra-explosion';group.position.copy(position);
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshBasicMaterial({color:0xffdf9b,transparent:true,opacity:.8,depthWrite:false}));
    const rings=[0,1,2].map(i=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.035,8,64),new THREE.MeshBasicMaterial({color:i%2?0xffd56b:0xd8f5ff,transparent:true,opacity:.9,depthWrite:false}));
      ring.rotation.x=Math.PI/2+i*.45;group.add(ring);return ring;
    });
    group.add(sphere);this.scene.add(group);
    this.effects.push({object:group,age:0,duration:2.5,update:progress=>{
      const radius=1+Math.pow(progress,.55)*40;sphere.scale.setScalar(radius);sphere.material.opacity=.65*(1-progress)**2;
      rings.forEach((ring,i)=>{ring.scale.setScalar(radius*(1-i*.12));ring.material.opacity=(1-progress)*.9;});
    }});
  }

  freeze(start: THREE.Vector3, end: THREE.Vector3) {
    this.beam(start,end,0x71caff,.18);
    const group=new THREE.Group();group.name='ice-crystals';group.position.copy(end);
    for(let i=0;i<12;i++){
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.55,0),new THREE.MeshBasicMaterial({color:i%2?0x9deaff:0xe2faff,transparent:true,opacity:.6,wireframe:i%3===0}));
      crystal.position.set(Math.sin(i*2.4)*1.3,Math.cos(i*1.7)*2,Math.cos(i*2.4)*.9);crystal.scale.set(.6,1.8,.6);group.add(crystal);
    }
    this.scene.add(group);this.effects.push({object:group,age:0,duration:4,update:p=>{group.rotation.y=p*.6;group.scale.setScalar(1+Math.sin(p*3)*.1);group.children.forEach(c=>{((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=Math.min(.6,(1-p)*3);});}});
  }

  slash(start: THREE.Vector3,end: THREE.Vector3) {
    const blade=new THREE.Mesh(new THREE.TorusGeometry(1.5,.12,6,32,Math.PI*1.1),new THREE.MeshBasicMaterial({color:0xbdefff,transparent:true,opacity:1,side:THREE.DoubleSide}));
    blade.position.copy(start);blade.rotation.z=-.8;this.scene.add(blade);
    this.effects.push({object:blade,age:0,duration:.65,update:p=>{blade.position.lerpVectors(start,end,p);blade.rotation.z=-.8+p*2;blade.scale.setScalar(1+p);blade.material.opacity=1-p;}});
    this.impact(end,0xa7eeff,2);
  }

  rescueLights(target: THREE.Vector3) {
    const group = new THREE.Group();group.name='crowd-light-rescue';
    const beams:THREE.Mesh<THREE.CylinderGeometry,THREE.MeshBasicMaterial>[]=[];
    for(let index=0;index<100;index++){
      const angle=index*2.39996;
      const origin=new THREE.Vector3(Math.cos(angle)*(15+index%8),.6,Math.sin(angle)*(8+index%6));
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.012,.045,origin.distanceTo(target),5),new THREE.MeshBasicMaterial({color:index%3?0xd8f8ff:0xffe2a4,transparent:true,opacity:0,depthWrite:false}));
      alignCylinder(beam,origin,target);group.add(beam);beams.push(beam);
    }
    this.scene.add(group);
    this.effects.push({object:group,age:0,duration:6,update:progress=>{
      beams.forEach((beam,index)=>{beam.material.opacity=Math.max(0,Math.sin(progress*Math.PI))*(.35+Math.sin(index+progress*12)*.2);});
    }});
    this.impact(target,0xffefbd,5);
  }

  beam(start: THREE.Vector3, end: THREE.Vector3, color: number, width = 0.2) {
    const group = new THREE.Group();
    group.name='skill-beam';
    const length = start.distanceTo(end);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 2.1, width * 2.1, length, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(width, width, length, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }),
    );
    group.add(glow, core);
    alignCylinder(group, start, end);
    this.scene.add(group);
    this.effects.push({
      object: group,
      age: 0,
      duration: 0.8,
      update: (progress) => {
        const pulse=1+Math.sin(progress*65)*.13;
        group.scale.set(pulse, 1, pulse);
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.min(1,(1-progress)*5);
        (core.material as THREE.MeshBasicMaterial).opacity = Math.min(1,(1-progress)*5);
      },
    });
    this.impact(end, color, 1.6);
  }

  demogeaVolley(start: THREE.Vector3, end: THREE.Vector3, smallBeamCount = 7) {
    this.beam(start, end, 0xe66bff, 0.48);
    const center = (smallBeamCount - 1) / 2;
    for (let index = 0; index < smallBeamCount; index += 1) {
      const offset = new THREE.Vector3(
        0,
        (index - center) * 0.34,
        Math.sin(index * 1.7) * 0.32,
      );
      this.beam(
        start.clone().add(offset),
        end.clone().addScaledVector(offset, 0.72),
        index % 2 === 0 ? 0xb96bff : 0x8d9dff,
        0.075,
      );
    }
  }

  boomerang(start: THREE.Vector3, end: THREE.Vector3) {
    const disc = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.13, 8, 24, Math.PI * 1.35),
      new THREE.MeshBasicMaterial({ color: 0xeefcff, side: THREE.DoubleSide }),
    );
    disc.position.copy(start);
    this.scene.add(disc);
    const arcHeight = Math.min(4, start.distanceTo(end) * 0.18);
    this.effects.push({
      object: disc,
      age: 0,
      duration: 0.55,
      update: (progress, delta) => {
        disc.position.lerpVectors(start, end, progress);
        disc.position.y += Math.sin(progress * Math.PI) * arcHeight;
        disc.rotation.z += delta * 18;
      },
    });
    this.impact(end, 0xcffaff, 0.9);
  }

  flyingKick(start: THREE.Vector3, end: THREE.Vector3) {
    const group = new THREE.Group();
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const kickStart = start.clone().add(new THREE.Vector3(0.5, -1.25, 0));
    const core = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 0.85, 8, 14),
      new THREE.MeshBasicMaterial({ color: 0xfff4c2, transparent: true, opacity: 0.98 }),
    );
    core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    core.position.copy(kickStart);
    group.add(core);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb84f, transparent: true, opacity: 0.32, depthWrite: false }),
    );
    glow.position.copy(kickStart);
    group.add(glow);

    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.34, 2.8, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd36d, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    alignCylinder(trail, kickStart.clone().addScaledVector(direction, -1.4), kickStart);
    group.add(trail);
    this.scene.add(group);
    const position = new THREE.Vector3();
    this.effects.push({
      object: group,
      age: 0,
      duration: 0.72,
      update: (progress) => {
        const eased = 1 - (1 - progress) ** 3;
        position.lerpVectors(kickStart, end, eased);
        position.y += Math.sin(progress * Math.PI) * 1.4;
        core.position.copy(position);
        glow.position.copy(position);
        trail.position.copy(position).addScaledVector(direction, -0.9);
        trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        core.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.28);
        glow.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.9);
        (core.material as THREE.MeshBasicMaterial).opacity = 1 - progress * 0.35;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - progress);
        (trail.material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - progress);
      },
    });
    this.impact(end, 0xffd36d, 1.5);
  }

  lightning(start: THREE.Vector3, end: THREE.Vector3) {
    const group = new THREE.Group();
    for (let branch = 0; branch < 5; branch += 1) {
      const points: THREE.Vector3[] = [];
      const segments = 16;
      for (let index = 0; index <= segments; index += 1) {
        const progress = index / segments;
        const point = new THREE.Vector3().lerpVectors(start, end, progress);
        if (index > 0 && index < segments) {
          point.x += (Math.random() - 0.5) * (1.2 + branch * 0.12);
          point.y += (Math.random() - 0.5) * 1.15;
          point.z += (Math.random() - 0.5) * 0.9;
        }
        points.push(point);
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: branch % 2 === 0 ? 0xfff0a8 : 0x9cecff,
          transparent: true,
          opacity: 1,
        }),
      );
      group.add(line);
    }
    this.scene.add(group);
    this.effects.push({
      object: group,
      age: 0,
      duration: 0.9,
      update: (progress) => {
        group.children.forEach((line) => {
          ((line as THREE.Line).material as THREE.LineBasicMaterial).opacity = 1 - progress;
        });
      },
    });
    this.impact(end, 0xffd85e, 3.8);
  }

  demogeaBurst(start: THREE.Vector3, end: THREE.Vector3) {
    const group = new THREE.Group();
    const tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.58, start.distanceTo(end), 12),
      new THREE.MeshBasicMaterial({
        color: 0xffe58c,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    alignCylinder(tunnel, start, end);
    group.add(tunnel);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.98 }),
    );
    core.position.copy(start);
    group.add(core);

    const rings: THREE.Mesh[] = [];
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62 + index * 0.24, 0.08, 8, 24),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0xffef9f : 0xff8d63,
          transparent: true,
          opacity: 0.9,
        }),
      );
      ring.position.copy(end);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      rings.push(ring);
    }

    this.scene.add(group);
    this.effects.push({
      object: group,
      age: 0,
      duration: 1.15,
      update: (progress) => {
        core.position.lerpVectors(start, end, Math.min(1, progress * 1.25));
        core.scale.setScalar(1 + progress * 1.1);
        tunnel.scale.set(1 + progress * 0.28, 1, 1 + progress * 0.28);
        rings.forEach((ring, index) => {
          ring.scale.setScalar(0.35 + progress * (1.8 + index * 0.28));
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - progress);
        });
        (tunnel.material as THREE.MeshBasicMaterial).opacity = 0.58 * (1 - progress);
        (core.material as THREE.MeshBasicMaterial).opacity = 1 - progress * 0.55;
      },
    });
    this.impact(end, 0xff895e, 5.8);
  }

  shield(position: THREE.Vector3) {
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 18, 12),
      new THREE.MeshBasicMaterial({
        color: 0x8192a0,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      }),
    );
    shield.position.copy(position);
    this.scene.add(shield);
    this.effects.push({
      object: shield,
      age: 0,
      duration: 0.55,
      update: (progress) => {
        shield.scale.setScalar(0.8 + progress * 0.42);
        (shield.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - progress);
      },
    });
  }

  impact(position: THREE.Vector3, color: number, scale = 1) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.6 * scale, 0.08 * scale, 6, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const sparkGeometry = new THREE.SphereGeometry(0.07 * scale, 5, 4);
    const sparkMaterial = new THREE.MeshBasicMaterial({ color });
    const sparks: THREE.Mesh[] = [];
    for (let index = 0; index < 10; index += 1) {
      const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
      const angle = (index / 10) * Math.PI * 2;
      spark.userData.velocity = new THREE.Vector3(Math.cos(angle), Math.random() * 0.8, Math.sin(angle))
        .multiplyScalar(2.4 * scale);
      group.add(spark);
      sparks.push(spark);
    }
    group.position.copy(position);
    this.scene.add(group);
    this.effects.push({
      object: group,
      age: 0,
      duration: 0.62,
      update: (progress, delta) => {
        ring.scale.setScalar(1 + progress * 1.8);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - progress);
        for (const spark of sparks) {
          spark.position.addScaledVector(spark.userData.velocity as THREE.Vector3, delta);
          spark.scale.setScalar(1 - progress * 0.8);
        }
      },
    });
  }

  revival(target: THREE.Vector3, source: RevivalSource) {
    const group = new THREE.Group();
    group.name = 'revival-lights';
    const fromStatues = source === 'statues';
    const chosen = fromStatues ? this.statuePositions : this.crowdPositions.filter((_, index) => index % 3 === 0);
    chosen.forEach((origin, index) => {
      const length = origin.distanceTo(target);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.09, length, 6),
        new THREE.MeshBasicMaterial({
          color: fromStatues
            ? index % 2 === 0
              ? 0xffdf78
              : 0xb9f5ff
            : index % 2 === 0
              ? 0xffefae
              : 0xc8f7ff,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
        }),
      );
      alignCylinder(beam, origin, target);
      group.add(beam);
    });
    this.scene.add(group);
    this.effects.push({
      object: group,
      age: 0,
      duration: 2.4,
      update: (progress) => {
        group.children.forEach((beam, index) => {
          (beam as THREE.Mesh).scale.x = 0.75 + Math.sin(progress * 30 + index) * 0.25;
          (beam as THREE.Mesh).scale.z = (beam as THREE.Mesh).scale.x;
          ((beam as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
            Math.sin(progress * Math.PI) * 0.86;
        });
      },
    });
    this.impact(target, fromStatues ? 0xffdd70 : 0xbef7ff, fromStatues ? 4.5 : 2.4);
  }

  private createCrowd() {
    const crowd = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x33434b, roughness: 0.9 });
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffed9f });
    for (let index = 0; index < 24; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = -19 + (index % 12) * 3.4;
      const z = side * 6.5;
      const person = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 3, 5), bodyMaterial);
      body.position.y = 0.4;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), bodyMaterial);
      head.position.y = 0.84;
      const flashlight = new THREE.Mesh(new THREE.SphereGeometry(0.045, 5, 4), lightMaterial);
      flashlight.position.set(0, 0.68, -side * 0.15);
      person.add(body, head, flashlight);
      person.position.set(x, 0, z);
      crowd.add(person);
      this.crowdPositions.push(new THREE.Vector3(x, 0.68, z - side * 0.15));
    }
    // Keep spectators at the edge of the scene, visible during light rescues.
    crowd.name = 'rescue-spectators';
    crowd.visible = false;
    this.scene.add(crowd);
  }

  private createUltramanStatues() {
    const statues = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x68757a, roughness: 0.96, metalness: 0.04 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x414b50, roughness: 0.98, metalness: 0.02 });
    const statueXs = [-18, -9, 9, 18];
    statueXs.forEach((x, index) => {
      const statue = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.2, 5, 9), stone);
      torso.position.y = 1.1;
      const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), stone);
      pelvis.position.y = 0.48;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), stone);
      head.position.y = 2.15;
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.46, 6), stone);
      crest.position.y = 2.58;
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), stoneDark);
      core.position.set(0, 1.4, 0.34);
      const armLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.7, 4, 7), stone);
      armLeft.position.set(-0.52, 1.25, 0);
      armLeft.rotation.z = -0.16;
      const armRight = armLeft.clone();
      armRight.position.x = 0.52;
      armRight.rotation.z = 0.16;
      const legLeft = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.72, 4, 7), stoneDark);
      legLeft.position.set(-0.2, -0.08, 0);
      const legRight = legLeft.clone();
      legRight.position.x = 0.2;
      statue.add(torso, pelvis, head, crest, core, armLeft, armRight, legLeft, legRight);
      statue.scale.setScalar(1.38);
      statue.position.set(x, 0, -8.2);
      statue.rotation.y = index % 2 === 0 ? 0.16 : -0.16;
      statue.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      statues.add(statue);
      this.statuePositions.push(new THREE.Vector3(x, 2.55, -8.2));
    });
    // These positions supply the revival lights without toy statues in every region.
    statues.visible = false;
    this.scene.add(statues);
  }
}

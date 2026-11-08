import * as THREE from 'three';
import { createEarth } from './models';
import { FLIGHT_EXPLOSION_SECONDS, GALAXY_EXIT_SECONDS } from './progression';

export const SLAM_SECONDS = 8;
export function slamPhase(time: number) {
  return time < 2 ? 'ascent' : time < 5 ? 'solar-system' : time < SLAM_SECONDS ? 'descent' : 'impact';
}

/** A compressed solar-system shot keeps the flight readable without huge coordinates. */
export class DeepSpaceSlam extends THREE.Group {
  active = false;
  time = 0;
  private readonly solar = new THREE.Group();
  private readonly starfield: THREE.Points;
  private readonly reentry = new THREE.Mesh(new THREE.ConeGeometry(1.8, 22, 16), new THREE.MeshBasicMaterial({ color: 0xffc17a, transparent: true, opacity: .65, depthWrite: false }));
  private readonly origin = new THREE.Vector3();
  private readonly landing = new THREE.Vector3();
  private readonly savedScale = new THREE.Vector3();
  private readonly savedRotation = new THREE.Euler();
  private readonly visibility = new Map<THREE.Object3D, boolean>();
  private savedFog: THREE.Scene['fog'] = null;
  private savedBackground: THREE.Scene['background'] = null;
  private savedFar = 2000;
  private sceneRef: THREE.Scene | null = null;
  private actor: THREE.Group | null = null;
  private cameraRef: THREE.PerspectiveCamera | null = null;
  private spaceShot = false;
  chainFlight = false;
  private readonly galaxy = new THREE.Group();
  private get shotTime(){return this.chainFlight ? this.time<GALAXY_EXIT_SECONDS ? this.time/GALAXY_EXIT_SECONDS*5 : 5+(this.time-GALAXY_EXIT_SECONDS)/10*3 : this.time;}

  constructor() {
    super();
    this.name = 'deep-space-slam';
    this.visible = false;
    this.add(this.solar);
    const spiral:number[]=[];
    for(let i=0;i<2400;i++){
      const radius=Math.sqrt(i/2400)*170,angle=radius*.055+(i%4)*Math.PI/2;
      spiral.push(Math.cos(angle)*radius,Math.sin(i*7.31)*3,Math.sin(angle)*radius);
    }
    const galaxyGeometry=new THREE.BufferGeometry();galaxyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(spiral,3));
    this.galaxy.add(new THREE.Points(galaxyGeometry,new THREE.PointsMaterial({color:0xb7acff,size:1.3,transparent:true,opacity:.85})));
    this.galaxy.name='flight-milky-way';this.add(this.galaxy);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 24), new THREE.MeshBasicMaterial({ color: 0xffd080 }));
    sun.name = 'slam-sun';
    this.solar.add(sun);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 24), new THREE.MeshBasicMaterial({ color: 0xff9b36, transparent: true, opacity: .13, side: THREE.BackSide }));
    this.solar.add(halo);
    const colors = [0xb7a391, 0xe8c187, 0x5baee8, 0xd56a44, 0xcbb28c, 0xe9d09d, 0x8fd9e8, 0x486cde];
    const radii = [13, 18, 24, 30, 41, 52, 64, 76];
    radii.forEach((radius, i) => {
      const orbit = new THREE.Mesh(new THREE.TorusGeometry(radius, .055, 4, 160), new THREE.MeshBasicMaterial({ color: 0x658ba9, transparent: true, opacity: .35 }));
      orbit.rotation.x = -Math.PI / 2;
      this.solar.add(orbit);
      const planet = i === 2 ? createEarth() : new THREE.Mesh(new THREE.SphereGeometry(i < 4 ? 1 : i < 6 ? 3 : 2, 24, 16), new THREE.MeshBasicMaterial({ color: colors[i] }));
      if (i === 2) planet.scale.setScalar(.3);
      planet.name = `slam-planet-${i}`;
      const angle = i * 2.35;
      planet.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.solar.add(planet);
      if (i === 5) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(3.8, 5.5, 48), new THREE.MeshBasicMaterial({ color: 0xc6b28b, side: THREE.DoubleSide, transparent: true, opacity: .7 }));
        ring.rotation.x = Math.PI / 2.5;
        planet.add(ring);
      }
    });
    const vertices = [];
    for (let i = 0; i < 700; i++) {
      const angle = i * 2.399963;
      const y = 1 - 2 * (i + .5) / 700;
      const r = Math.sqrt(1 - y * y) * 500;
      vertices.push(Math.cos(angle) * r, y * 500, Math.sin(angle) * r);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.starfield = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xc7e4ff, size: .8, sizeAttenuation: true }));
    this.add(this.starfield,this.reentry);
    this.reentry.rotation.z=Math.PI;
  }

  begin(scene: THREE.Scene, actor: THREE.Group, camera: THREE.PerspectiveCamera, target: THREE.Vector3, chainFlight=false) {
    this.cancel();
    this.chainFlight=chainFlight;
    this.sceneRef = scene; this.actor = actor; this.cameraRef = camera;
    this.origin.copy(actor.position); this.landing.copy(target).add(new THREE.Vector3(-3, 0, 2)); this.landing.y = 0;
    this.savedScale.copy(actor.scale); this.savedRotation.copy(actor.rotation);
    this.savedFog = scene.fog; this.savedBackground = scene.background; this.savedFar = camera.far;
    this.visibility.clear();
    scene.children.forEach(child => {
      if (child !== actor && child !== this && !(child instanceof THREE.Light)) this.visibility.set(child, child.visible);
    });
    this.position.copy(this.origin).add(new THREE.Vector3(0, 200, -65));
    actor.visible = true;
    this.time = 0; this.active = true;
  }

  update(delta: number) {
    if (!this.active || !this.actor || !this.sceneRef) return false;
    this.time = Math.min(this.chainFlight?FLIGHT_EXPLOSION_SECONDS:SLAM_SECONDS, this.time + delta);
    const time=this.shotTime;
    const phase = slamPhase(time);
    const space = time >= 1.7 && time < 5.3;
    this.spaceShot = space; this.visible = true;
    this.solar.visible=space;this.starfield.visible=space;
    this.galaxy.visible=space&&this.chainFlight;
    this.solar.scale.setScalar(this.chainFlight?.25:1);
    this.galaxy.rotation.y+=delta*.025;
    this.reentry.visible=phase==='descent';
    this.visibility.forEach((visible, object) => { object.visible = space ? false : visible; });
    this.sceneRef.fog = space ? null : this.savedFog;
    this.sceneRef.background = space ? new THREE.Color(0x02040e) : this.savedBackground;
    const actor = this.actor;
    if (phase === 'ascent') {
      const p = time / 2;
      actor.position.copy(this.origin).add(new THREE.Vector3(0, p * p * 240, 0));
      actor.scale.copy(this.savedScale).multiplyScalar(1 - .8 * p);
      actor.rotation.set(-.3, this.savedRotation.y, 0);
    } else if (phase === 'solar-system') {
      const p = (time - 2) / 3;
      actor.position.copy(this.position).add(new THREE.Vector3(90 + p * 22, 35 + p * 10, 45));
      actor.scale.copy(this.savedScale).multiplyScalar(.2 - p * .13);
      actor.rotation.set(-Math.PI / 2, -.7, 0);
      this.solar.rotation.y += delta * .035;
    } else {
      const p = Math.min(1, (time - 5) / 3);
      actor.position.lerpVectors(this.origin, this.landing, p).add(new THREE.Vector3(0, 260 * (1 - p * p), 0));
      actor.scale.copy(this.savedScale).multiplyScalar(.07 + .93 * p * p);
      actor.rotation.set(Math.PI * .85 * (1 - p), this.savedRotation.y, 0);
    }
    for (const side of ['left', 'right']) {
      const arm = actor.getObjectByName(`${side}-arm`);
      if (arm) { arm.rotation.x = -Math.PI * .95; arm.rotation.z = (side === 'left' ? 1 : -1) * .12; }
    }
    this.reentry.position.copy(actor.position).sub(this.position).add(new THREE.Vector3(0,14,0));
    this.reentry.scale.setScalar(.8+Math.sin(this.time*40)*.15);
    return phase === 'impact';
  }

  updateCamera(camera: THREE.PerspectiveCamera) {
    if (!this.active || !this.actor) return;
    camera.far = Math.max(2000, this.savedFar); camera.updateProjectionMatrix();
    if (this.spaceShot) {
      camera.position.copy(this.position).add(new THREE.Vector3(135, 110, 165));
      camera.lookAt(this.position.clone().add(new THREE.Vector3(16, 8, 8)));
    } else if (this.shotTime < 2) {
      const focus = this.origin.clone().lerp(this.actor.position, .45).add(new THREE.Vector3(0, 4, 0));
      camera.position.copy(focus).add(new THREE.Vector3(28, 12, 55 + this.shotTime * 25)); camera.lookAt(focus);
    } else {
      const p = Math.min(1, (this.shotTime - 5) / 3);
      const focus = this.landing.clone().lerp(this.actor.position, .45).add(new THREE.Vector3(0, 4, 0));
      camera.position.copy(focus).add(new THREE.Vector3(24 * (1 - p) + 12, 12, 55 - p * 24)); camera.lookAt(focus);
    }
  }

  finish() {
    const actor = this.actor, landing = this.landing.clone();
    this.cancel();
    actor?.position.copy(landing);
  }

  cancel() {
    if (this.active) {
      this.visibility.forEach((visible, object) => { object.visible = visible; });
      if (this.sceneRef) { this.sceneRef.fog = this.savedFog; this.sceneRef.background = this.savedBackground; }
      if (this.actor) { this.actor.position.copy(this.origin); this.actor.scale.copy(this.savedScale); this.actor.rotation.copy(this.savedRotation); }
      if (this.cameraRef) { this.cameraRef.far = this.savedFar; this.cameraRef.updateProjectionMatrix(); }
    }
    this.visible = false; this.active = false; this.visibility.clear();
  }
}

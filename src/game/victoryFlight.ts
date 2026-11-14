import * as THREE from 'three';
import { episodeScene, PILOT_SECONDS } from './episodeTimeline';

/** Keyboard mapping used only while the player is piloting the Victory Flyer. */
export function pilotActionsForKey(key: string): string[] {
  switch (key.toLowerCase()) {
    case 'arrowleft': case 'a': return ['move-left'];
    case 'arrowright': return ['move-right'];
    case 'd': return ['move-right', 'pilot-fire-left'];
    case 'arrowup': return ['jump'];
    case 'arrowdown': return ['move-down'];
    case 'f': return ['move-forward'];
    case 'j': return ['move-back'];
    case 'k': return ['pilot-fire-right'];
    case 'p': return ['eject'];
    default: return [];
  }
}

export function createVictoryFighter(variant=0){
  const root=new THREE.Group();root.name='victory-fighter';
  const hull=new THREE.MeshStandardMaterial({color:variant?0xc6d5df:0xf0c448,metalness:.65,roughness:.32});
  const trim=new THREE.MeshStandardMaterial({color:0xa43137,metalness:.5,roughness:.4});
  const glass=new THREE.MeshPhysicalMaterial({color:0x254c75,metalness:.6,roughness:.12,clearcoat:1});
  const fuselage=new THREE.Mesh(new THREE.ConeGeometry(.5,3.6,8),hull);fuselage.rotation.x=-Math.PI/2;root.add(fuselage);
  const wingGeometry=new THREE.BufferGeometry();
  wingGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-2.7,0,.8,0,0,-1.2,2.7,0,.8,-2.7,0,.8,2.7,0,.8,0,0,1.4],3));wingGeometry.computeVertexNormals();
  const wings=new THREE.Mesh(wingGeometry,hull.clone());(wings.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;root.add(wings);
  for(const side of [-1,1]){
    const pod=new THREE.Mesh(new THREE.CylinderGeometry(.23,.3,2,10),trim);pod.rotation.x=Math.PI/2;pod.position.set(side*1.1,0,.4);root.add(pod);
    const engine=new THREE.Mesh(new THREE.ConeGeometry(.22,1.2,10),new THREE.MeshBasicMaterial({color:0x67ceff,transparent:true,opacity:.8}));engine.rotation.x=Math.PI/2;engine.position.set(side*1.1,0,1.8);engine.name='engine';root.add(engine);
    const fin=new THREE.Mesh(new THREE.BoxGeometry(.09,.8,.9),trim);fin.position.set(side*.7,.4,1);fin.rotation.z=side*-.3;root.add(fin);
  }
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(.38,16,10),glass);canopy.scale.set(.8,.65,1.9);canopy.position.set(0,.3,-.4);root.add(canopy);
  root.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});
  return root;
}

export class VictoryFlight extends THREE.Group {
  readonly lead=createVictoryFighter();
  readonly wingman=createVictoryFighter(1);
  readonly base=new THREE.Group();
  readonly rings:THREE.Mesh[]=[];
  readonly threats:THREE.Mesh[]=[];
  private progress=0;
  private fireCooldown=0;
  private incomingCooldown=0;
  private missionStarted=false;
  shots=0;hits=0;gates=0;shield=50;
  ejected=false;
  get crashed(){return this.shield<=0;}
  eject(){this.ejected=true;this.lead.visible=false;}
  yaw=0;pitch=0;
  targetLocked=false;
  constructor(){
    super();this.name='victory-team';this.add(this.lead,this.wingman,this.base);
    const metal=new THREE.MeshStandardMaterial({color:0x394d65,roughness:.5,metalness:.5});
    const hangar=new THREE.Mesh(new THREE.BoxGeometry(22,7,18),metal);hangar.position.set(-25,3.5,-25);this.base.add(hangar);
    const door=new THREE.Mesh(new THREE.PlaneGeometry(15,5),new THREE.MeshBasicMaterial({color:0x8ac9dd}));door.position.set(-25,2.5,-15.95);this.base.add(door);
    const runway=new THREE.Mesh(new THREE.BoxGeometry(14,.12,55),metal);runway.position.set(-25,.1,2);this.base.add(runway);
    for(let i=0;i<18;i++){
      const lamp=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,1.5),new THREE.MeshBasicMaterial({color:0x9aeaff}));lamp.position.set(-25+(i%2?6:-6),.25,-17+Math.floor(i/2)*5);this.base.add(lamp);
    }
    const screen=new THREE.Mesh(new THREE.BoxGeometry(6,2.7,.15),new THREE.MeshBasicMaterial({color:0x124e65,wireframe:true}));screen.position.set(-9,2.4,3.5);this.base.add(screen);
    for(let i=0;i<7;i++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.1,6,36),new THREE.MeshBasicMaterial({color:0x79e5e9,transparent:true,opacity:.65}));this.rings.push(ring);this.add(ring);
    }
    for(let i=0;i<5;i++){
      const threat=new THREE.Mesh(new THREE.OctahedronGeometry(.7),new THREE.MeshStandardMaterial({color:0xc76880,emissive:0x7d1839,emissiveIntensity:.6}));this.threats.push(threat);this.add(threat);
    }
    this.visible=false;
  }
  reset(){this.progress=0;this.missionStarted=false;this.yaw=0;this.pitch=0;this.shots=0;this.hits=0;this.gates=0;this.shield=50;this.ejected=false;this.lead.visible=true;this.fireCooldown=0;this.incomingCooldown=0;[...this.rings,...this.threats].forEach(o=>{o.userData.initialized=false;});}
  update(time:number,delta:number,held:Set<string>,_automatic:boolean,beam:(a:THREE.Vector3,b:THREE.Vector3,color:number)=>void){
    const scene=episodeScene(time),pilot=scene.pilot;
    this.base.visible=scene.kind==='briefing'||scene.kind==='launch';
    if(this.ejected)return {pilot:false,remaining:0,distance:this.progress};
    if(pilot&&this.crashed){this.lead.position.y=Math.max(8,this.lead.position.y-delta*5);this.lead.rotation.z+=delta;return {pilot:true,remaining:Math.max(0,PILOT_SECONDS-scene.local),distance:this.progress};}
    this.rings.forEach(r=>r.visible=pilot);if(!pilot)this.threats.forEach(r=>r.visible=false);
    if(pilot){
      if(!this.missionStarted){this.missionStarted=true;this.lead.position.set(0,22,35);}
      const turn=Number(held.has('move-right'))-Number(held.has('move-left'));
      const climb=Number(held.has('jump'))-Number(held.has('move-down'));
      const speed=held.has('move-forward')?42:held.has('move-back')?12:25;
      this.yaw-=turn*delta*.95;this.pitch=THREE.MathUtils.clamp(this.pitch+climb*delta*.5,-.65,.65);
      const forward=new THREE.Vector3(-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
      this.lead.position.addScaledVector(forward,delta*speed);this.lead.position.y=Math.max(8,this.lead.position.y);
      this.lead.rotation.set(this.pitch,this.yaw,-turn*.5);
      this.progress+=speed*delta;
      this.rings.forEach((ring,i)=>{
        if(!ring.userData.initialized||ring.position.distanceTo(this.lead.position)>450||ring.position.clone().sub(this.lead.position).dot(forward)<-8){
          ring.position.copy(this.lead.position).addScaledVector(forward,60+i*32);ring.position.y+=Math.sin(i*2)*2;ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),forward);ring.userData.initialized=true;ring.userData.passed=false;
        }
        if(!ring.userData.passed&&ring.position.distanceTo(this.lead.position)<6){this.gates++;ring.userData.passed=true;}
      });
      this.threats.forEach((threat,i)=>{
        if(!threat.userData.initialized||threat.position.distanceTo(this.lead.position)>450||threat.position.clone().sub(this.lead.position).dot(forward)<-10){threat.position.copy(this.lead.position).addScaledVector(forward,75+i*24).add(new THREE.Vector3(Math.sin(i*3)*8,Math.cos(i*4)*4,0));threat.userData.initialized=true;threat.visible=true;}
        threat.rotation.y+=delta;
      });
      const target=this.threats.filter(t=>t.visible).sort((a,b)=>a.position.distanceToSquared(this.lead.position)-b.position.distanceToSquared(this.lead.position))[0];
      this.targetLocked=!!target&&target.position.clone().sub(this.lead.position).normalize().dot(forward)>.93;
      this.fireCooldown-=delta;this.incomingCooldown-=delta;
      if(this.fireCooldown<=0&&(held.has('pilot-fire-left')||held.has('pilot-fire-right'))){
        this.fireCooldown=.35;this.shots++;
        const end=this.targetLocked&&target?target.position.clone():this.lead.position.clone().addScaledVector(forward,110);
        const left=held.has('pilot-fire-left');
        const muzzle=this.lead.position.clone().add(new THREE.Vector3(left?-1.1:1.1,0,.2).applyQuaternion(this.lead.quaternion));
        beam(muzzle,end,left?0x77ddff:0xffd36b);
        if(this.targetLocked&&target){this.hits++;target.visible=false;target.position.addScaledVector(forward,500);}
      }
      if(this.incomingCooldown<=0){
        this.incomingCooldown=5;
        const aim=this.lead.position.clone().add(new THREE.Vector3(turn?turn*-14:0,climb?climb*-10:0,0));
        beam(aim.clone().add(new THREE.Vector3(15,-12,-70)),aim,0xe961ba);
        if(!turn&&!climb)this.shield=Math.max(0,this.shield-8);
      }
    }else if(scene.kind==='launch'){
      const p=scene.local%45;
      this.lead.position.set(-25+Math.max(0,p-15)*1.5,Math.max(1,(p-15)*1.4),-12+p*2);this.lead.rotation.set(-.2,Math.PI,Math.sin(time)*.04);
    }else{
      const attack=scene.kind==='counterattack'||scene.kind==='monster';
      const angle=time*(attack ? .14 : .045);
      this.lead.position.set(Math.sin(angle)*35,14+Math.sin(angle*2)*8,Math.cos(angle)*35);this.lead.rotation.set(.12,-angle-Math.PI/2,attack?-.4:-.15);
    }
    this.wingman.position.copy(this.lead.position).add(new THREE.Vector3(7,2,6));this.wingman.rotation.copy(this.lead.rotation);
    return {pilot,remaining:Math.max(0,PILOT_SECONDS-scene.local),distance:this.progress};
  }
}

import * as THREE from 'three';

export { INTRO_SECONDS, OUTRO_SECONDS } from './episodeTimeline';
export function groundDistance(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
export function flightSpeed(altitude: number) {
  return Math.min(500, 12 + Math.max(0, altitude) * 0.035);
}
export function altitudeLabel(altitude: number) {
  if (altitude < 70) return '城市上空';
  if (altitude < 500) return '云层之上';
  if (altitude < 5000) return '近地太空';
  if (altitude < 30000) return '太阳系远航';
  return '深空探索';
}

/** Recycle districts to keep memory bounded while travelling. */
export class ExplorationWorld extends THREE.Group {
  private readonly districts: THREE.Group[] = [];
  private cellX = Infinity;
  private cellZ = Infinity;
  constructor() {
    super();
    const stone = new THREE.MeshStandardMaterial({color:0x77909b, roughness:.8});
    const glass = new THREE.MeshStandardMaterial({color:0x587d90, metalness:.45, roughness:.25});
    const window = new THREE.MeshStandardMaterial({color:0xffdeb1, emissive:0xd69a51, emissiveIntensity:.45});
    const box = new THREE.BoxGeometry(1,1,1);
    for (let i=0;i<25;i++) {
      const district = new THREE.Group();
      for(let j=0;j<10;j++) {
        const height=3+((i*13+j*7)%19);
        const tower=new THREE.Mesh(box,j%3?stone:glass);
        tower.scale.set(3+j%3,height,3+j%2);
        tower.position.set(-22+(j%5)*11,height/2,-18+Math.floor(j/5)*36);
        tower.castShadow=true;tower.receiveShadow=true;district.add(tower);
        const windows=new THREE.InstancedMesh(box,window,Math.floor(height/2)*3);
        let index=0;
        for(let y=1;y<Math.floor(height/2)+1;y++)for(let x=0;x<3;x++) {
          const matrix=new THREE.Matrix4().compose(new THREE.Vector3(tower.position.x+(x-1)*.8,y*1.7,tower.position.z+tower.scale.z/2+.02),new THREE.Quaternion(),new THREE.Vector3(.3,.5,.035));
          windows.setMatrixAt(index++,matrix);
        }
        district.add(windows);
      }
      this.districts.push(district);this.add(district);
    }
  }
  update(position: THREE.Vector3, region:number) {
    this.visible=region===1 && position.y<150;
    const x=Math.floor(position.x/64),z=Math.floor(position.z/64);
    if(x===this.cellX&&z===this.cellZ)return;
    this.cellX=x;this.cellZ=z;
    let index=0;
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++) {
      const district=this.districts[index++];
      district.position.set((x+dx)*64,0,(z+dz)*64);
      district.visible=Math.abs(x+dx)>0||Math.abs(z+dz)>0;
    }
  }
}

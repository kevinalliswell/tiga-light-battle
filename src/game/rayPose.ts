import * as THREE from 'three';
import { RAY_CHARGE_SECONDS } from './episodes';
import type { Ability } from './rules';

const frames = [
  { t:0, right:[1.45,3.5,.4], left:[-1.45,3.5,.4] },
  { t:.42, right:[-.55,6.05,1.05], left:[.55,6.05,1.3] },
  { t:1.02, right:[3.65,6.15,.2], left:[-3.65,6.15,.2] },
  { t:RAY_CHARGE_SECONDS, right:[.55,6.95,2.1], left:[.35,5.75,2.05] },
];

export function rayHandTargets(elapsed:number) {
  let next=frames.findIndex(f=>f.t>=elapsed);if(next<0)next=frames.length-1;
  const previous=frames[Math.max(0,next-1)], end=frames[next];
  const fraction=THREE.MathUtils.smoothstep(elapsed,previous.t,end.t||.001);
  return {
    right:new THREE.Vector3(...previous.right as [number,number,number]).lerp(new THREE.Vector3(...end.right as [number,number,number]),fraction),
    left:new THREE.Vector3(...previous.left as [number,number,number]).lerp(new THREE.Vector3(...end.left as [number,number,number]),fraction),
  };
}

function solveArm(arm:THREE.Object3D, elbow:THREE.Object3D, target:THREE.Vector3, side:number, blend:number){
  const upper=1.31, lower=1.43;
  const direction=target.clone().sub(arm.position);const distance=THREE.MathUtils.clamp(direction.length(),.3,upper+lower-.025);
  direction.normalize();
  const projected=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,upper*upper-projected*projected));
  const pole=new THREE.Vector3(side*.8,-.8,-.4);
  pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const bend=direction.clone().multiplyScalar(projected).addScaledVector(pole,height);
  const upperRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),bend.clone().normalize());
  const forearm=direction.clone().multiplyScalar(distance).sub(bend).normalize().applyQuaternion(upperRotation.clone().invert());
  const lowerRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),forearm);
  arm.quaternion.slerp(upperRotation,blend);elbow.quaternion.slerp(lowerRotation,blend);
}

export function animateRayPose(root:THREE.Group,elapsed:number,delta:number,ability:Ability='zeperion'){
  const targets=rayHandTargets(elapsed);
  const progress=THREE.MathUtils.smoothstep(elapsed,0,RAY_CHARGE_SECONDS);
  if(ability==='tiga-freeze'){
    targets.right.set(.65,5.8,2.4*progress+.2);targets.left.set(-.65,5.8,2.4*progress+.2);
  }else if(ability==='tiga-slash'){
    const swing=THREE.MathUtils.smoothstep(elapsed,1.25,1.9);
    targets.right.set(2.4-swing*4.3,7.1-swing*1.8,.8+swing*1.3);targets.left.set(-1.8,4.8,.4);
  }else if(ability==='flying-charge'){
    targets.right.set(.6,6.5,2.5);targets.left.set(-.6,6.5,2.5);
  }
  for(const [side,sign] of [['left',-1],['right',1]] as const){
    const arm=root.getObjectByName(`${side}-arm`),elbow=root.getObjectByName(`${side}-elbow`);
    if(arm&&elbow)solveArm(arm,elbow,targets[side],sign,Math.min(1,delta*22));
  }
}

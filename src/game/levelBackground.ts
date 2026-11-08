import * as THREE from 'three';

/** Establishing scenery around the episode's original encounter. */
export function createLevelBackground(level: number): THREE.Group {
  const group = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number, glow = false) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color, roughness: glow ? 0.2 : 0.95, metalness: glow ? 0.35 : 0,
      emissive: glow ? color : 0, emissiveIntensity: glow ? 0.65 : 0,
    }));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  if (level === 1) {
    // Layered silhouettes, warm windows and cool shadows form a painted city horizon.
    for (let layer=0;layer<3;layer++) {
      for (let i=0;i<15;i++) {
        const height=3+((i*7+layer*11)%13)*(layer===0?.5:.8);
        const width=2.1+(i*3%4)*.6;
        const x=-47+i*6.7+layer*1.8,z=-25-layer*14;
        add(new THREE.BoxGeometry(width,height,2.5),[0x526e8c,0x7496b3,0x9ab9d0][layer],x,height/2,z);
        if(layer===0){
          add(new THREE.BoxGeometry(width+.2,.18,2.7),0x9db8ca,x,height+.1,z);
          add(new THREE.BoxGeometry(.7,.6,.8),0x576b8b,x+.3,height+.4,z);
          for(let row=0;row<Math.floor(height/1.2);row++)for(let col=0;col<2;col++)
            add(new THREE.PlaneGeometry(.32,.48),(row+col+i)%3?0xe6cfb1:0x52637f,x+(col-.5)*.9,.9+row*1.2,z+1.26);
        }
      }
    }
    for(let i=0;i<10;i++){
      const mountain=add(new THREE.ConeGeometry(9+i%3*3,10+i%4*2,5),0x86a8c0,-60+i*13,2,-72);
      mountain.scale.z=.4;mountain.rotation.y=i;
    }
    const pyramid = new THREE.Group();pyramid.name='ancient-pyramid';pyramid.position.set(-2,0,-12);
    const stone = new THREE.MeshToonMaterial({color:0xe8c785});
    const pyramidBody=new THREE.Mesh(new THREE.ConeGeometry(5.4,7,4),stone);pyramidBody.position.y=3.5;pyramidBody.rotation.y=Math.PI/4;pyramid.add(pyramidBody);
    for(let i=0;i<5;i++){
      const step=new THREE.Mesh(new THREE.BoxGeometry(8-i*.2,.13,8-i*.2),stone);step.position.y=.08+i*.15;pyramid.add(step);
    }
    const gate=new THREE.Mesh(new THREE.PlaneGeometry(1.1,2.5),new THREE.MeshBasicMaterial({color:0x716177}));gate.position.set(0,1.3,3.5);pyramid.add(gate);
    group.add(pyramid);
    for(let i=0;i<25;i++){
      const treeX=-43+i*3.6,z=-17-i%3;
      add(new THREE.CylinderGeometry(.12,.2,1.5,8),0x4d5e5c,treeX,.75,z);
      for(let cluster=0;cluster<3;cluster++){
        const crown=add(new THREE.IcosahedronGeometry(.8,1),i%2?0x3b7369:0x527e6c,treeX+(cluster-1)*.45,1.8+(cluster===1?.5:0),z+cluster%2*.3);
        crown.scale.set(1,.85,.85);
      }
    }
    for(let i=0;i<20;i++) {const stripe=add(new THREE.PlaneGeometry(2,.12),0xd7d0c1,-38+i*4,.025,4.5);stripe.rotation.x=-Math.PI/2;}
  } else if (level === 2 || level === 3) {
    const moon = level === 2;
    for (let i = 0; i < 18; i++) {
      const x = -38 + i * 4.5;
      const z = -9 - (i % 4) * 3;
      const radius = 1.4 + (i % 3) * 0.7;
      if (moon) {
        const rim = add(new THREE.TorusGeometry(radius, 0.22, 8, 32), 0x8b8a89, x, 0.15, z);
        rim.rotation.x = Math.PI / 2;
        const pit = add(new THREE.CircleGeometry(radius, 32), 0x3d3f47, x, 0.025, z);
        pit.rotation.x = -Math.PI / 2;
      } else {
        const mesa = add(new THREE.CylinderGeometry(radius * 0.7, radius * 1.6, 3 + i % 4, 6), 0xa34424, x, 1.5 + (i % 4) / 2, z);
        mesa.rotation.y = i * 0.7;
      }
      add(new THREE.DodecahedronGeometry(0.5 + i % 2, 0), moon ? 0x92959a : 0xc96c3c, x + 1, 0.45, z + 3);
    }
    const planet = level === 2
      ? add(new THREE.SphereGeometry(5, 32, 24), 0x2588c9, -16, 20, -38, true)
      : add(new THREE.SphereGeometry(2, 24, 16), 0xdcb897, 20, 20, -35);
    if (moon) {
      for (let i = 0; i < 7; i++) {
        const land = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4f9960 }));
        land.position.set(Math.sin(i * 2) * 3, Math.cos(i * 2) * 3, 3.5);
        land.scale.set(1.4, 0.7, 0.5);
        planet.add(land);
      }
    }
  } else if (level === 4) {
    add(new THREE.SphereGeometry(9, 40, 24), 0x3c4bba, -22, 16, -48, true);
    const planet = add(new THREE.SphereGeometry(5, 32, 24), 0xd19961, 23, 14, -40);
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.5, 10, 64), new THREE.MeshBasicMaterial({ color: 0xcda8eb, side: THREE.DoubleSide, transparent: true, opacity: 0.65 }));
    ring.rotation.x = 1.1;
    planet.add(ring);
    for (let i = 0; i < 24; i++) {
      const asteroid = add(new THREE.IcosahedronGeometry(0.4 + i % 3 * 0.35, 0), 0x60667f, -40 + i * 3.5, 5 + i % 5 * 2.5, -20 - i % 4 * 4);
      asteroid.rotation.set(i, i * 0.3, i * 0.7);
    }
  } else if (level === 5) {
    const glass = new THREE.MeshPhysicalMaterial({color:0x9cebdc,transmission:.86,transparent:true,opacity:.55,roughness:.08,metalness:.05,ior:1.45,thickness:1.8,side:THREE.DoubleSide});
    const edges = new THREE.LineBasicMaterial({color:0xafffea,transparent:true,opacity:.75});
    for (let i = 0; i < 19; i++) {
      const height = 6 + i % 5 * 2;
      const geometry=new THREE.CylinderGeometry(.65,1.5,height,6);
      const tower=new THREE.Mesh(geometry,glass);tower.position.set(-38+i*4.2,height/2,-12-i%3*6);group.add(tower);
      tower.add(new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 6),glass));
      tower.children[0].position.y = height / 2 + 1.5;
      tower.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry),edges));
      const core=add(new THREE.CylinderGeometry(.06,.09,height*.8,8),0x72ffe1,tower.position.x,height/2,tower.position.z,true);core.material.transparent=true;core.material.opacity=.4;
    }
    add(new THREE.OctahedronGeometry(4), 0xc5ffbe, 0, 23, -34, true);
    const arch = add(new THREE.TorusGeometry(10, 0.45, 12, 64, Math.PI), 0x63ffcc, 0, 8, -26, true);
    arch.rotation.z = 0;
  }
  return group;
}

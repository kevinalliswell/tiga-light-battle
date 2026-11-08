import * as THREE from 'three';

export function inkCharacter(root: THREE.Group) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = .65;
        material.roughness = Math.max(.32,material.roughness);
      }
    }
  });
}


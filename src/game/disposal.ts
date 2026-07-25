import * as THREE from 'three';

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/**
 * Recursively releases the GPU resources (geometry, materials and any textures
 * referenced by those materials) held by an object graph. Call this after
 * removing an object from the scene so procedurally generated monsters and
 * effects do not leak memory across waves.
 */
export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach(disposeMaterial);
  });
}

import * as THREE from 'three';

export function sculptMesh(geometry: THREE.BufferGeometry, material: THREE.Material,
  position: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Spline cross sections give the body a continuous anatomical silhouette. */
export function contourGeometry(profile: Array<[number, number]>, depth = 1) {
  // Lathe profiles must run from bottom to top or their faces point inward.
  const ordered = profile[0][1] > profile[profile.length - 1][1] ? profile.slice().reverse() : profile;
  const curve = new THREE.SplineCurve(ordered.map(([radius, y]) => new THREE.Vector2(radius, y)));
  const points = curve.getPoints(profile.length * 4);
  points.forEach(point => { point.x = Math.max(0, point.x); });
  const geometry = new THREE.LatheGeometry(points, 40);
  geometry.scale(1, 1, depth);
  return geometry;
}

export function armorPanel(points: Array<[number, number]>, material: THREE.Material, z: number, bevel = 0.025) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => index === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  return sculptMesh(new THREE.ExtrudeGeometry(shape, {
    depth: 0.025, bevelEnabled: true, bevelSegments: 2, steps: 1,
    bevelSize: bevel, bevelThickness: 0.018,
  }), material, [0, 0, z]);
}

/** A tapered sweep, used for organic horns, fingers and tails. */
export function taperedCurve(points: Array<[number, number, number]>, radius: number, material: THREE.Material, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const frames = curve.computeFrenetFrames(segments, false);
  const vertices: number[] = [], indices: number[] = [], uv: number[] = [];
  const sides = 10;
  for (let ring = 0; ring <= segments; ring += 1) {
    const t = ring / segments;
    const center = curve.getPointAt(t);
    const width = radius * Math.pow(1 - t, 0.72) + 0.008;
    for (let side = 0; side <= sides; side += 1) {
      const angle = side / sides * Math.PI * 2;
      const point = center.clone().addScaledVector(frames.normals[ring], Math.cos(angle) * width)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * width);
      vertices.push(point.x, point.y, point.z);
      uv.push(side / sides, t);
      if (ring < segments && side < sides) {
        const a = ring * (sides + 1) + side, b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return sculptMesh(geometry, material);
}

import * as THREE from 'three';

interface ActiveEffect {
  object: THREE.Object3D;
  age: number;
  duration: number;
  update?: (progress: number, delta: number) => void;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((item) => item.dispose());
  });
}

function alignCylinder(object: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3) {
  const direction = new THREE.Vector3().subVectors(end, start);
  object.position.copy(start).add(end).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
}

export class Effects {
  private readonly scene: THREE.Scene;
  private readonly effects: ActiveEffect[] = [];
  private readonly crowdPositions: THREE.Vector3[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createCrowd();
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
  }

  beam(start: THREE.Vector3, end: THREE.Vector3, color: number, width = 0.2) {
    const group = new THREE.Group();
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
      duration: 0.48,
      update: (progress) => {
        group.scale.set(1 + progress * 0.5, 1, 1 + progress * 0.5);
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1 - progress);
        (core.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
      },
    });
    this.impact(end, color, 1.6);
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
    for (let index = 0; index < 10; index += 1) {
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.07 * scale, 5, 4),
        new THREE.MeshBasicMaterial({ color }),
      );
      const angle = (index / 10) * Math.PI * 2;
      spark.userData.velocity = new THREE.Vector3(Math.cos(angle), Math.random() * 0.8, Math.sin(angle))
        .multiplyScalar(2.4 * scale);
      group.add(spark);
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
        group.children.slice(1).forEach((child) => {
          child.position.addScaledVector(child.userData.velocity as THREE.Vector3, delta);
          child.scale.setScalar(1 - progress * 0.8);
        });
      },
    });
  }

  revival(target: THREE.Vector3, everyone: boolean) {
    const group = new THREE.Group();
    const chosen = everyone ? this.crowdPositions : this.crowdPositions.filter((_, index) => index % 3 === 0);
    chosen.forEach((origin, index) => {
      const length = origin.distanceTo(target);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.09, length, 6),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? 0xffefae : 0xc8f7ff,
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
    this.impact(target, everyone ? 0xffdd70 : 0xbef7ff, everyone ? 4.5 : 2.4);
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
    this.scene.add(crowd);
  }
}

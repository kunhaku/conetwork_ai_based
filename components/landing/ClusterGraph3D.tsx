import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

const CONFIG = {
  INITIAL_PARTICLES: 50,
  MAX_PARTICLES: 200,
  PARTICLE_BASE_SIZE: 0.2,
  CORE_NODE_SIZE: 4.0,
  SPHERE_RADIUS: 11.0,
  EXPLOSION_FORCE: 0.8,
  CONNECTION_DISTANCE: 6.0,
  IDEAL_LINK_LENGTH: 4.4,
  REPULSION_RADIUS: 2.3,
  BRIGHTNESS: 0.75,
};

interface SimulationState {
  positions: Float32Array;
  velocities: Float32Array;
  lifetimes: Float32Array;
  ages: Float32Array;
  sizes: Float32Array;
  count: number;
  connections: number[];
  phase: 'CORE' | 'EXPLOSION' | 'FORMATION' | 'GROWTH';
  lastGrowth: number;
}

const GraphScene: React.FC = () => {
  const { size, viewport } = useThree();

  const visualCenterOffsetY = useMemo(() => {
    const canvasHeight = size.height;
    const windowHeight = window.innerHeight;
    const pixelOffset = (canvasHeight / 2) - (windowHeight / 2);
    const unitRatio = viewport.height / size.height;
    return pixelOffset * unitRatio;
  }, [size.height, viewport.height]);

  const state = useRef<SimulationState>({
    positions: new Float32Array(CONFIG.MAX_PARTICLES * 3),
    velocities: new Float32Array(CONFIG.MAX_PARTICLES * 3),
    lifetimes: new Float32Array(CONFIG.MAX_PARTICLES),
    ages: new Float32Array(CONFIG.MAX_PARTICLES),
    sizes: new Float32Array(CONFIG.MAX_PARTICLES),
    count: CONFIG.INITIAL_PARTICLES,
    connections: [],
    phase: 'CORE',
    lastGrowth: 0,
  });

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const s = state.current;

    for (let i = 0; i < CONFIG.MAX_PARTICLES; i++) {
      const i3 = i * 3;

      s.positions[i3] = 0;
      s.positions[i3 + 1] = 0;
      s.positions[i3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      const speed = CONFIG.EXPLOSION_FORCE * (0.5 + Math.random() * 0.5);

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed;

      s.velocities[i3] = vx;
      s.velocities[i3 + 1] = vy;
      s.velocities[i3 + 2] = vz;

      s.lifetimes[i] = 5 + Math.random() * 15;
      s.ages[i] = 0;

      const r = Math.random();
      if (r > 0.9) s.sizes[i] = 1.5;
      else if (r < 0.2) s.sizes[i] = 0.7;
      else s.sizes[i] = 1.0 + (Math.random() - 0.5) * 0.2;
    }

    s.connections = [];

    if (groupRef.current) {
      groupRef.current.position.y = visualCenterOffsetY;
    }

    const t0 = setTimeout(() => { s.phase = 'EXPLOSION'; }, 1000);
    const t1 = setTimeout(() => { s.phase = 'FORMATION'; }, 2500);
    const t2 = setTimeout(() => { s.phase = 'GROWTH'; }, 4500);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visualCenterOffsetY]);

  const particleGeometry = useMemo(() => new THREE.SphereGeometry(CONFIG.PARTICLE_BASE_SIZE, 16, 16), []);
  const particleMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x444444,
    emissiveIntensity: CONFIG.BRIGHTNESS,
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((ctx, delta) => {
    const s = state.current;
    const time = ctx.clock.elapsedTime;

    if (groupRef.current) {
      if (s.phase === 'CORE' || s.phase === 'EXPLOSION') {
        groupRef.current.position.y = visualCenterOffsetY;
      } else {
        groupRef.current.position.y = 0;
      }

      groupRef.current.rotation.y = time * 0.15;
      groupRef.current.rotation.z = Math.sin(time * 0.1) * 0.05;
    }

    for (let i = 0; i < s.count; i++) {
      const i3 = i * 3;
      const pos = new THREE.Vector3(s.positions[i3], s.positions[i3 + 1], s.positions[i3 + 2]);
      const vel = new THREE.Vector3(s.velocities[i3], s.velocities[i3 + 1], s.velocities[i3 + 2]);

      s.ages[i] += delta;
      s.lifetimes[i] -= delta;

      if (s.phase === 'CORE') {
        pos.set(0, 0, 0);
        vel.set(0, 0, 0);
      } else if (s.phase === 'EXPLOSION') {
        vel.multiplyScalar(0.95);
      } else {
        const currentDist = pos.length();
        if (currentDist > 0.01) {
          const dir = pos.clone().normalize();
          const targetPos = dir.multiplyScalar(CONFIG.SPHERE_RADIUS);
          const force = targetPos.sub(pos).multiplyScalar(0.08);
          vel.add(force);
        }

        for (let j = 0; j < s.count; j++) {
          if (i === j) continue;
          const j3 = j * 3;
          const dx = pos.x - s.positions[j3];
          const dy = pos.y - s.positions[j3 + 1];
          const dz = pos.z - s.positions[j3 + 2];
          const dSq = dx * dx + dy * dy + dz * dz;

          const minDist = CONFIG.REPULSION_RADIUS * (s.sizes[i] + s.sizes[j]) * 0.5;

          if (dSq < minDist * minDist && dSq > 0.001) {
            const d = Math.sqrt(dSq);
            const force = (minDist - d) * 0.03;
            vel.x += (dx / d) * force;
            vel.y += (dy / d) * force;
            vel.z += (dz / d) * force;
          }
        }

        const noise = new THREE.Vector3(
          Math.sin(time * 1.5 + i) * 0.004,
          Math.cos(time * 1.2 + i * 2) * 0.004,
          Math.sin(time * 0.8 + i * 0.5) * 0.004
        );
        vel.add(noise);

        vel.multiplyScalar(0.92);
      }

      pos.add(vel);

      s.positions[i3] = pos.x;
      s.positions[i3 + 1] = pos.y;
      s.positions[i3 + 2] = pos.z;
      s.velocities[i3] = vel.x;
      s.velocities[i3 + 1] = vel.y;
      s.velocities[i3 + 2] = vel.z;

      dummy.position.copy(pos);

      let scale = s.sizes[i];

      if (s.phase === 'CORE') {
        if (i === 0) {
          scale = CONFIG.CORE_NODE_SIZE + Math.sin(time * 5) * 0.2;
        } else {
          scale = 0;
        }
      } else {
        const fadeIn = Math.min(s.ages[i] * 2, 1);
        const fadeOut = Math.min(s.lifetimes[i], 1);

        scale = scale * fadeIn * fadeOut;

        if (s.phase === 'EXPLOSION' && i === 0 && s.ages[i] < 1.0) {
          const t = s.ages[i];
          scale = THREE.MathUtils.lerp(CONFIG.CORE_NODE_SIZE, s.sizes[i], t);
        }
      }

      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      if (meshRef.current) {
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (ctx.gl.info.render.frame % 3 === 0) {
      const newConnections: number[] = [];
      const maxConn = 5;
      const connCounts = new Int32Array(s.count).fill(0);

      for (let i = 0; i < s.count; i++) {
        if (s.lifetimes[i] < 0.5) continue;
        if (connCounts[i] >= maxConn) continue;

        for (let j = i + 1; j < s.count; j++) {
          if (s.lifetimes[j] < 0.5) continue;
          if (connCounts[j] >= maxConn) continue;

          const dx = s.positions[i * 3] - s.positions[j * 3];
          const dy = s.positions[i * 3 + 1] - s.positions[j * 3 + 1];
          const dz = s.positions[i * 3 + 2] - s.positions[j * 3 + 2];
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < CONFIG.CONNECTION_DISTANCE * CONFIG.CONNECTION_DISTANCE) {
            newConnections.push(i, j);
            connCounts[i]++;
            connCounts[j]++;
            if (connCounts[i] >= maxConn) break;
          }
        }
      }
      s.connections = newConnections;
    }

    if (linesRef.current) {
      const positions = linesRef.current.geometry.attributes.position.array as Float32Array;
      let idx = 0;
      if (s.phase !== 'CORE') {
        for (let i = 0; i < s.connections.length; i += 2) {
          const a = s.connections[i];
          const b = s.connections[i + 1];

          if (a >= s.count || b >= s.count) continue;

          positions[idx++] = s.positions[a * 3];
          positions[idx++] = s.positions[a * 3 + 1];
          positions[idx++] = s.positions[a * 3 + 2];

          positions[idx++] = s.positions[b * 3];
          positions[idx++] = s.positions[b * 3 + 1];
          positions[idx++] = s.positions[b * 3 + 2];
        }
      }
      linesRef.current.geometry.setDrawRange(0, idx / 3);
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (s.phase === 'GROWTH') {
      for (let i = 0; i < s.count; i++) {
        if (s.lifetimes[i] <= 0) {
          const parentIdx = Math.floor(Math.random() * s.count);

          const p3 = parentIdx * 3;
          const parentPos = new THREE.Vector3(s.positions[p3], s.positions[p3 + 1], s.positions[p3 + 2]);
          const offset = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
            .normalize()
            .multiplyScalar(CONFIG.IDEAL_LINK_LENGTH);
          const newPos = parentPos.add(offset).normalize().multiplyScalar(CONFIG.SPHERE_RADIUS);

          const i3 = i * 3;
          s.positions[i3] = newPos.x;
          s.positions[i3 + 1] = newPos.y;
          s.positions[i3 + 2] = newPos.z;
          s.velocities[i3] = 0;

          s.ages[i] = 0;
          s.lifetimes[i] = 8 + Math.random() * 12;
        }
      }

      if (s.count < CONFIG.MAX_PARTICLES && time - s.lastGrowth > 0.05) {
        s.lastGrowth = time;
        const idx = s.count;
        const parentIdx = Math.floor(Math.random() * idx);
        const p3 = parentIdx * 3;
        const parentPos = new THREE.Vector3(s.positions[p3], s.positions[p3 + 1], s.positions[p3 + 2]);
        const offset = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(CONFIG.IDEAL_LINK_LENGTH);
        const newPos = parentPos.add(offset).normalize().multiplyScalar(CONFIG.SPHERE_RADIUS);

        const i3 = idx * 3;
        s.positions[i3] = newPos.x;
        s.positions[i3 + 1] = newPos.y;
        s.positions[i3 + 2] = newPos.z;
        s.velocities[i3] = 0;
        s.lifetimes[i3] = 10 + Math.random() * 10;
        s.ages[i3] = 0;
        s.sizes[i3] = 1.0 + (Math.random() - 0.5) * 0.2;

        s.count++;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[particleGeometry, particleMaterial, CONFIG.MAX_PARTICLES]} count={CONFIG.MAX_PARTICLES}>
      </instancedMesh>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={CONFIG.MAX_PARTICLES * 12}
            array={new Float32Array(CONFIG.MAX_PARTICLES * 12 * 3)}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0xffffff} transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
};

export const ClusterGraph3D: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 bg-black">
      <Canvas camera={{ position: [0, 0, 32], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={['#000000']} />

        <ambientLight intensity={0.2} />
        <pointLight position={[30, 20, 30]} intensity={2} color="#ffffff" />
        <pointLight position={[-30, -20, -10]} intensity={1} color="#44aadd" />
        <pointLight position={[0, -30, 10]} intensity={1} color="#ffaaee" />

        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
        <fog attach="fog" args={['#000000', 25, 60]} />

        <GraphScene />

        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
      </Canvas>
    </div>
  );
};

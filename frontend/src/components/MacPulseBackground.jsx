import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Procedural soft-glow circle texture for high-performance glowing points
function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Color palettes for themes
const THEME_PALETTES = {
  dark: {
    bg: 0x080f1e,
    fog: 0x080f1e,
    nodePrimary: 0x38bdf8,
    nodeSecondary: 0x60a5fa,
    nodeAccent: 0x2563eb,
    lines: 0x38bdf8,
    packets: 0xffffff,
    pulse: 0x38bdf8,
    lineOpacity: 0.22,
    packetOpacity: 0.95,
  },
  light: {
    bg: 0xdbeafe,
    fog: 0xdbeafe,
    nodePrimary: 0x1e3a8a,
    nodeSecondary: 0x2563eb,
    nodeAccent: 0x0284c7,
    lines: 0x2563eb,
    packets: 0x1e3a8a,
    pulse: 0x2563eb,
    lineOpacity: 0.18,
    packetOpacity: 0.85,
  },
};

export default function MacPulseBackground({ theme = 'dark' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const currentPalette = THEME_PALETTES[theme] || THEME_PALETTES.dark;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(currentPalette.fog, 0.009);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 75);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(currentPalette.bg, 1);
    container.appendChild(renderer.domElement);

    const glowTexture = createGlowTexture();

    // 3. Cluster Nodes (Mac fleet machines & storage volumes)
    const NODE_COUNT = 52;
    const nodes = [];
    const positions = new Float32Array(NODE_COUNT * 3);
    const colors = new Float32Array(NODE_COUNT * 3);

    const colorPrimary = new THREE.Color(currentPalette.nodePrimary);
    const colorSecondary = new THREE.Color(currentPalette.nodeSecondary);
    const colorAccent = new THREE.Color(currentPalette.nodeAccent);

    // Scatter nodes in an organic 3D cloud with center clearing for the login card
    for (let i = 0; i < NODE_COUNT; i++) {
      // Angle around perimeter with varying radius and depth
      const angle = (i / NODE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      // Elliptical distribution leaving middle card visible
      const radiusX = 22 + Math.random() * 38;
      const radiusY = 16 + Math.random() * 26;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      const z = (Math.random() - 0.5) * 35;

      nodes.push({
        baseX: x,
        baseY: y,
        baseZ: z,
        currentX: x,
        currentY: y,
        currentZ: z,
        driftSpeedX: 0.4 + Math.random() * 0.6,
        driftSpeedY: 0.4 + Math.random() * 0.6,
        driftSpeedZ: 0.3 + Math.random() * 0.5,
        driftRadiusX: 1.2 + Math.random() * 2.2,
        driftRadiusY: 1.0 + Math.random() * 1.8,
        driftRadiusZ: 0.8 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        isHost: i % 4 === 0, // 25% primary host beacons
      });

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = i % 3 === 0 ? colorPrimary : (i % 3 === 1 ? colorSecondary : colorAccent);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const nodeMaterial = new THREE.PointsMaterial({
      size: 5.5,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(nodePoints);

    // 4. Dynamic Telemetry Connection Lines
    const MAX_LINE_SEGMENTS = 140;
    const linePositions = new Float32Array(MAX_LINE_SEGMENTS * 2 * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      color: currentPalette.lines,
      transparent: true,
      opacity: currentPalette.lineOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSegments);

    // 5. I/O Telemetry Packets (Simulated filesystem packets travelling between nodes)
    const PACKET_COUNT = 16;
    const packets = [];
    const packetPositions = new Float32Array(PACKET_COUNT * 3);

    for (let i = 0; i < PACKET_COUNT; i++) {
      const sourceIdx = Math.floor(Math.random() * NODE_COUNT);
      let targetIdx = (sourceIdx + 1 + Math.floor(Math.random() * (NODE_COUNT - 1))) % NODE_COUNT;
      packets.push({
        sourceIdx,
        targetIdx,
        progress: Math.random(),
        speed: 0.006 + Math.random() * 0.008,
      });
      packetPositions[i * 3] = nodes[sourceIdx].currentX;
      packetPositions[i * 3 + 1] = nodes[sourceIdx].currentY;
      packetPositions[i * 3 + 2] = nodes[sourceIdx].currentZ;
    }

    const packetGeometry = new THREE.BufferGeometry();
    packetGeometry.setAttribute('position', new THREE.BufferAttribute(packetPositions, 3));

    const packetMaterial = new THREE.PointsMaterial({
      size: 3.2,
      color: currentPalette.packets,
      map: glowTexture,
      transparent: true,
      opacity: currentPalette.packetOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const packetPoints = new THREE.Points(packetGeometry, packetMaterial);
    scene.add(packetPoints);

    // 6. Concentric Heartbeat "Pulse" Rings (MacPulse Heartbeat wavefront)
    const PULSE_RING_COUNT = 3;
    const pulseRings = [];
    const pulseRingGroup = new THREE.Group();

    for (let i = 0; i < PULSE_RING_COUNT; i++) {
      const ringGeo = new THREE.RingGeometry(0.5, 0.9, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: currentPalette.pulse,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      // Slightly tilted for modern perspective
      ring.rotation.x = Math.PI * 0.18;
      ring.position.z = -10;
      pulseRings.push({
        mesh: ring,
        progress: i / PULSE_RING_COUNT,
        speed: 0.0028,
        maxRadius: 52,
      });
      pulseRingGroup.add(ring);
    }
    scene.add(pulseRingGroup);

    // 7. Subtle Observatory Background Coordinate Grid
    const gridHelper = new THREE.GridHelper(120, 24, currentPalette.nodeAccent, currentPalette.lines);
    gridHelper.position.y = -32;
    gridHelper.position.z = -15;
    if (gridHelper.material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = theme === 'dark' ? 0.08 : 0.05;
      gridHelper.material.blending = THREE.AdditiveBlending;
      gridHelper.material.depthWrite = false;
    }
    scene.add(gridHelper);

    // 8. Interactive Mouse Parallax
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handleMouseMove = (e) => {
      mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // 9. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 10. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth camera parallax
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      camera.position.x = mouse.x * 6 + Math.sin(elapsedTime * 0.15) * 1.5;
      camera.position.y = mouse.y * 4 + Math.cos(elapsedTime * 0.12) * 1.2;
      camera.lookAt(0, 0, 0);

      // A. Update Node Positions with organic breathing drift
      const posAttr = nodeGeometry.attributes.position;
      for (let i = 0; i < NODE_COUNT; i++) {
        const node = nodes[i];
        const t = elapsedTime + node.phase;
        node.currentX = node.baseX + Math.sin(t * node.driftSpeedX) * node.driftRadiusX;
        node.currentY = node.baseY + Math.cos(t * node.driftSpeedY) * node.driftRadiusY;
        node.currentZ = node.baseZ + Math.sin(t * node.driftSpeedZ) * node.driftRadiusZ;

        posAttr.setXYZ(i, node.currentX, node.currentY, node.currentZ);
      }
      posAttr.needsUpdate = true;

      // B. Update Telemetry Connection Lines (proximity-based)
      let lineIndex = 0;
      const linePosAttr = lineGeometry.attributes.position;
      const CONNECTION_DIST_SQ = 24 * 24;

      for (let i = 0; i < NODE_COUNT && lineIndex < MAX_LINE_SEGMENTS; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < NODE_COUNT && lineIndex < MAX_LINE_SEGMENTS; j++) {
          const n2 = nodes[j];
          const dx = n1.currentX - n2.currentX;
          const dy = n1.currentY - n2.currentY;
          const dz = n1.currentZ - n2.currentZ;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < CONNECTION_DIST_SQ) {
            linePosAttr.setXYZ(lineIndex * 2, n1.currentX, n1.currentY, n1.currentZ);
            linePosAttr.setXYZ(lineIndex * 2 + 1, n2.currentX, n2.currentY, n2.currentZ);
            lineIndex++;
          }
        }
      }
      // Zero out remaining line segments if fewer than max
      for (let k = lineIndex; k < MAX_LINE_SEGMENTS; k++) {
        linePosAttr.setXYZ(k * 2, 0, 0, 0);
        linePosAttr.setXYZ(k * 2 + 1, 0, 0, 0);
      }
      lineGeometry.setDrawRange(0, lineIndex * 2);
      linePosAttr.needsUpdate = true;

      // C. Update I/O Data Packets
      const packetPosAttr = packetGeometry.attributes.position;
      for (let i = 0; i < PACKET_COUNT; i++) {
        const p = packets[i];
        p.progress += p.speed;
        if (p.progress >= 1.0) {
          p.progress = 0;
          p.sourceIdx = p.targetIdx;
          p.targetIdx = (p.sourceIdx + 1 + Math.floor(Math.random() * (NODE_COUNT - 2))) % NODE_COUNT;
        }

        const src = nodes[p.sourceIdx];
        const tgt = nodes[p.targetIdx];
        const px = src.currentX + (tgt.currentX - src.currentX) * p.progress;
        const py = src.currentY + (tgt.currentY - src.currentY) * p.progress;
        const pz = src.currentZ + (tgt.currentZ - src.currentZ) * p.progress;

        packetPosAttr.setXYZ(i, px, py, pz);
      }
      packetPosAttr.needsUpdate = true;

      // D. Update Concentric MacPulse Heartbeat Rings
      for (let i = 0; i < PULSE_RING_COUNT; i++) {
        const ring = pulseRings[i];
        ring.progress = (ring.progress + ring.speed) % 1.0;

        // Exponential gentle expansion
        const currentRadius = 1 + ring.progress * ring.maxRadius;
        const scale = currentRadius;
        ring.mesh.scale.set(scale, scale, 1);

        // Alpha fades out as pulse expands
        const fade = Math.sin(ring.progress * Math.PI);
        ring.mesh.material.opacity = fade * (theme === 'dark' ? 0.35 : 0.22);
      }

      // Gentle continuous ambient drift on the pulse group
      pulseRingGroup.rotation.z = elapsedTime * 0.04;

      renderer.render(scene, camera);
    };

    animate();

    // 11. Cleanup on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      packetGeometry.dispose();
      packetMaterial.dispose();
      glowTexture.dispose();

      pulseRings.forEach((ring) => {
        ring.mesh.geometry.dispose();
        ring.mesh.material.dispose();
      });

      if (gridHelper.geometry) gridHelper.geometry.dispose();
      if (gridHelper.material) gridHelper.material.dispose();

      renderer.dispose();
    };
  }, [theme]);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}

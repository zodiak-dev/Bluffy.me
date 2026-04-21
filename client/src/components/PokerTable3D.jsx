import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OBJLoader, MTLLoader } from 'three-stdlib';
import * as THREE from 'three';

function TableModel() {
  const mtl = useLoader(MTLLoader, '/3D/chips/source/poker_chips_single/chips.mtl');
  const obj = useLoader(OBJLoader, '/3D/chips/source/poker_chips_single/chips.obj', (loader) => {
    mtl.preload();
    loader.setMaterials(mtl);
  });

  const materialsApplied = useMemo(() => {
    const model = obj.clone();
    
    model.traverse((child) => {
      if (child.isMesh) {
        // Force DoubleSide on MTL materials
        child.material.side = THREE.DoubleSide;
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    return model;
  }, [obj]);

  const groupRef = useRef();

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.02;
    }
  });

  return (
    <group ref={groupRef} scale={0.012}>
      <primitive object={materialsApplied} />
    </group>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '180px', height: '180px', margin: '0 auto 1rem auto', position: 'relative' }}>
          <style>{`
            @keyframes spin-table-y {
              from { transform: perspective(800px) rotateY(0deg); }
              to { transform: perspective(800px) rotateY(360deg); }
            }
          `}</style>
          <img 
            src="/images/poker_table.png" 
            alt="Table animée" 
            style={{ 
              width: '180px', 
              animation: 'spin-table-y 4s linear infinite',
              transformStyle: 'preserve-3d'
            }} 
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default function PokerTable3D() {
  return (
    <div style={{ width: '180px', height: '180px', margin: '0 auto 1rem auto' }}>
      <ErrorBoundary>
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
          <ambientLight intensity={1.5} />
          <pointLight position={[5, 10, 5]} intensity={2.5} />
          <Suspense fallback={null}>
            <TableModel />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

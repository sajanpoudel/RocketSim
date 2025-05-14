"use client"

import { Suspense, useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { useRocket } from '@/lib/store'

// Flame component for rocket engine
function RocketFlame({ isLaunched, throttle = 0 }: { isLaunched: boolean, throttle: number }) {
  const flameRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (flameRef.current && isLaunched) {
      // Animate flame size randomly for effect
      const scaleY = 0.8 + Math.random() * 0.4;
      flameRef.current.scale.y = scaleY * (0.5 + throttle * 1.5);
      flameRef.current.scale.x = 0.7 + Math.random() * 0.1;
      flameRef.current.scale.z = 0.7 + Math.random() * 0.1;
    }
  });

  if (!isLaunched) return null;
  
  return (
    <group ref={flameRef}>
      {/* Main flame */}
      <mesh>
        <coneGeometry args={[0.4, 2, 16]} />
        <meshBasicMaterial color="#FF7700" transparent opacity={0.9} />
      </mesh>
      
      {/* Inner flame */}
      <mesh position={[0, -0.3, 0]}>
        <coneGeometry args={[0.25, 1.4, 16]} />
        <meshBasicMaterial color="#FFDD00" transparent opacity={0.9} />
      </mesh>
      
      {/* Engine glow */}
      <pointLight color="#FF5500" intensity={5} distance={4} />
    </group>
  );
}

// Simple rocket model component
function RocketModel({ 
  selected, 
  isLaunched, 
  throttle
}: { 
  selected: boolean, 
  isLaunched: boolean,
  throttle: number
}) {
  const rocketRef = useRef<THREE.Group>(null)
  
  // Get rocket parts from the store
  const { parts } = useRocket(state => state.rocket)
  
  // Find parts by type
  const nosePart = parts.find(part => part.type === 'nose')
  const bodyPart = parts.find(part => part.type === 'body')
  const finParts = parts.filter(part => part.type === 'fin')
  
  // Get dimensions from the store or use defaults
  const bodyRadius = bodyPart?.Ø ? bodyPart.Ø / 10 : 0.5
  const bodyLength = bodyPart?.length ? bodyPart.length / 10 : 4
  const noseLength = nosePart?.length ? nosePart.length / 10 : 1.5
  const noseShape = nosePart?.shape || 'ogive'
  
  // Fin dimensions
  const finRoot = finParts[0]?.root ? finParts[0].root / 10 : 1
  const finSpan = finParts[0]?.span ? finParts[0].span / 10 : 0.8
  const finSweep = finParts[0]?.sweep ? finParts[0].sweep / 100 : 0
  
  // Rotate the rocket gently when not launched
  useFrame((state, delta) => {
    if (rocketRef.current && !selected && !isLaunched) {
      rocketRef.current.rotation.y += delta * 0.1
    }
  })
  
  return (
    <group ref={rocketRef}>
      {/* Rocket body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[bodyRadius, bodyRadius, bodyLength, 32]} />
        <meshStandardMaterial 
          color={bodyPart?.color || "#8C8D91"} 
          metalness={0.6} 
          roughness={0.2} 
          emissive={selected ? "#FFFFFF" : "#000000"}
          emissiveIntensity={selected ? 0.1 : 0}
        />
      </mesh>
      
      {/* White ring at top of cylinder for a seamless transition */}
      <mesh position={[0, bodyLength/2, 0]}>
        <torusGeometry args={[bodyRadius, 0.03, 16, 32]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      
      {/* Nose cone - dynamically positioned based on body length */}
      <mesh position={[0, bodyLength/2 + noseLength/2, 0]}>
        {noseShape === 'ogive' ? (
          <coneGeometry args={[bodyRadius, noseLength, 32]} />
        ) : (
          <coneGeometry args={[bodyRadius, noseLength, 32]} />
        )}
        <meshStandardMaterial 
          color={nosePart?.color || "#A0A7B8"} 
          metalness={0.7} 
          roughness={0.2} 
        />
      </mesh>
      
      {/* Fins - dynamically sized and positioned */}
      {[0, 1, 2, 3].map((i) => (
        <mesh 
          key={i}
          position={[
            Math.sin(i * Math.PI / 2) * (bodyRadius + finSpan/4),
            -bodyLength/2 + finRoot/2,
            Math.cos(i * Math.PI / 2) * (bodyRadius + finSpan/4)
          ]}
          rotation={[0, i * Math.PI / 2 + finSweep, 0]}
        >
          <boxGeometry args={[0.1, finRoot, finSpan]} />
          <meshStandardMaterial 
            color={finParts[0]?.color || "#A0A7B8"} 
            metalness={0.3} 
            roughness={0.3} 
            emissive="#FFFFFF"
            emissiveIntensity={0.05}
          />
        </mesh>
      ))}
      
      {/* Engine */}
      <mesh position={[0, -bodyLength/2 - 0.2, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 0.4, 32]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Rocket flame - positioned based on body length */}
      <group position={[0, -bodyLength/2 - 0.4, 0]}>
        <RocketFlame isLaunched={isLaunched} throttle={throttle} />
      </group>
    </group>
  )
}

// RocketSimulation component that includes physics and the rocket model
function RocketSimulation({
  selected,
  isLaunched, 
  throttle, 
  resetTrigger,
  setFlightData
}: {
  selected: boolean,
  isLaunched: boolean,
  throttle: number,
  resetTrigger: boolean,
  setFlightData: (position: [number, number, number], velocity: [number, number, number]) => void
}) {
  // State for position, velocity, acceleration
  const [position, setPosition] = useState<[number, number, number]>([0, -3, 0]);
  const [velocity, setVelocity] = useState<[number, number, number]>([0, 0, 0]);
  
  // Physics constants
  const gravity = -9.8; // m/s²
  const thrust = 20;    // Max thrust (m/s²)
  const drag = 0.1;     // Aerodynamic drag coefficient
  
  // Reset position when requested
  useEffect(() => {
    if (resetTrigger) {
      setPosition([0, -3, 0]);
      setVelocity([0, 0, 0]);
    }
  }, [resetTrigger]);
  
  // Update physics each frame
  useFrame((state, delta) => {
    if (!isLaunched) return;
    
    // Apply thrust based on throttle
    const currentThrust = isLaunched ? throttle * thrust : 0;
    
    // Calculate acceleration
    const dragForce = drag * velocity[1] * Math.abs(velocity[1]);
    const netAcceleration = currentThrust + gravity - dragForce;
    
    // Update velocity (only y-component for now)
    const newVelocity: [number, number, number] = [
      velocity[0],
      velocity[1] + netAcceleration * delta,
      velocity[2]
    ];
    
    // Update position
    const newPosition: [number, number, number] = [
      position[0],
      position[1] + newVelocity[1] * delta,
      position[2]
    ];
    
    // Add slight random movement for realism
    if (isLaunched && throttle > 0) {
      newPosition[0] += (Math.random() - 0.5) * 0.01;
      newPosition[2] += (Math.random() - 0.5) * 0.01;
    }
    
    // Update state
    setVelocity(newVelocity);
    setPosition(newPosition);
    
    // Pass flight data up to parent component
    setFlightData(newPosition, newVelocity);
  });
  
  return (
    <group position={position}>
      <RocketModel 
        selected={selected}
        isLaunched={isLaunched}
        throttle={throttle}
      />
    </group>
  );
}

// Floating controls component
function ViewportControls({ 
  view, 
  setView 
}: { 
  view: 'top' | 'side' | 'perspective', 
  setView: (view: 'top' | 'side' | 'perspective') => void 
}) {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 glass-panel rounded-full py-1 px-3 flex space-x-2 z-10 shadow-lg">
      <button 
        onClick={() => setView('top')}
        className={`px-3 py-1 rounded-full text-small transition-all ${
          view === 'top' ? 'neon-border-active bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10'
        }`}
      >
        Top
      </button>
      <button 
        onClick={() => setView('side')}
        className={`px-3 py-1 rounded-full text-small transition-all ${
          view === 'side' ? 'neon-border-active bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10'
        }`}
      >
        Side
      </button>
      <button 
        onClick={() => setView('perspective')}
        className={`px-3 py-1 rounded-full text-small transition-all ${
          view === 'perspective' ? 'neon-border-active bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10'
        }`}
      >
        3D
      </button>
    </div>
  );
}

// Launch control panel
function LaunchControls({ 
  isLaunched, 
  setIsLaunched, 
  throttle,
  setThrottle,
  resetRocket
}: { 
  isLaunched: boolean,
  setIsLaunched: (launched: boolean) => void,
  throttle: number,
  setThrottle: (throttle: number) => void,
  resetRocket: () => void
}) {
  return (
    <div className="absolute bottom-4 left-4 glass-panel rounded p-3 w-48 z-10 shadow-lg">
      <h3 className="text-small font-medium mb-2 text-white">Launch Controls</h3>
      
      {!isLaunched ? (
        <button 
          className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
          onClick={() => setIsLaunched(true)}
        >
          LAUNCH
        </button>
      ) : (
        <>
          <div className="mb-2">
            <label className="block text-small mb-1">Throttle: {Math.round(throttle * 100)}%</label>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={throttle}
              onChange={(e) => setThrottle(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <button 
            className="w-full py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-white text-small transition-colors"
            onClick={resetRocket}
          >
            Reset Rocket
          </button>
        </>
      )}
    </div>
  );
}

// Component tree panel
function ComponentTree({ selectedPart, setSelectedPart }: {
  selectedPart: string | null, 
  setSelectedPart: (part: string | null) => void
}) {
  const parts = [
    { id: 'nosecone', name: 'Nose Cone', icon: '▲' },
    { id: 'body', name: 'Main Body', icon: '■' },
    { id: 'fins', name: 'Fins (x4)', icon: '◆' },
    { id: 'engine', name: 'Engine', icon: '●' },
  ];

  return (
    <div className="absolute bottom-4 right-4 glass-panel rounded p-3 w-48 z-10 shadow-lg">
      <h3 className="text-small font-medium mb-2 text-white">Components</h3>
      <ul className="space-y-1">
        {parts.map(part => (
          <li 
            key={part.id}
            className={`flex items-center p-1.5 rounded cursor-pointer text-small ${
              selectedPart === part.id 
                ? 'neon-border-active bg-white bg-opacity-10' 
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
            onClick={() => setSelectedPart(part.id)}
          >
            <span className="mr-2 opacity-80">{part.icon}</span>
            <span>{part.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Flight data panel
function FlightData({ position, velocity }: { 
  position: [number, number, number], 
  velocity: [number, number, number] 
}) {
  const altitude = Math.max(0, position[1] + 3).toFixed(1);
  const speed = Math.abs(velocity[1]).toFixed(1);
  
  if (position[1] <= -3) return null;
  
  return (
    <div className="absolute top-4 right-4 glass-panel rounded p-3 w-48 z-10 shadow-lg">
      <h3 className="text-small font-medium mb-2 text-white">Flight Data</h3>
      <div className="space-y-1 text-small">
        <div className="flex justify-between">
          <span>Speed:</span>
          <span>{speed} m/s</span>
        </div>
        <div className="flex justify-between">
          <span>Altitude:</span>
          <span>{altitude} m</span>
        </div>
      </div>
    </div>
  );
}

export default function MiddlePanel() {
  const [view, setView] = useState<'top' | 'side' | 'perspective'>('perspective');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [isLaunched, setIsLaunched] = useState(false);
  const [throttle, setThrottle] = useState(0.8);
  const [resetTrigger, setResetTrigger] = useState(false);
  
  // Flight data state
  const [position, setPosition] = useState<[number, number, number]>([0, -3, 0]);
  const [velocity, setVelocity] = useState<[number, number, number]>([0, 0, 0]);
  
  // Update flight data
  const updateFlightData = (pos: [number, number, number], vel: [number, number, number]) => {
    setPosition(pos);
    setVelocity(vel);
  };
  
  // Reset rocket function
  const resetRocket = () => {
    setIsLaunched(false);
    setResetTrigger(true);
    setTimeout(() => setResetTrigger(false), 100);
  };
  
  // Camera positions for different views with explicit tuple types
  const cameraPositions: Record<string, [number, number, number]> = {
    top: [0, 10, 0],
    side: [10, 0, 0],
    perspective: [5, 5, 5],
  };

  return (
    <>
      <ViewportControls view={view} setView={setView} />
      <LaunchControls 
        isLaunched={isLaunched} 
        setIsLaunched={setIsLaunched}
        throttle={throttle}
        setThrottle={setThrottle}
        resetRocket={resetRocket}
      />
      <ComponentTree selectedPart={selectedPart} setSelectedPart={setSelectedPart} />
      <FlightData position={position} velocity={velocity} />
      
      <div className="w-full h-full">
        <Canvas shadows>
          <PerspectiveCamera 
            makeDefault 
            position={cameraPositions[view]} 
            fov={45} 
          />
          
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05} 
            minDistance={2} 
            maxDistance={20}
          />

          {/* Scene lighting */}
          <ambientLight intensity={0.2} />
          <directionalLight position={[5, 5, 5]} intensity={0.5} castShadow />
          <directionalLight position={[-5, 5, -5]} intensity={0.3} />
          
          {/* Environment & ground */}
          <Environment preset="city" />
          <ContactShadows 
            position={[0, -3, 0]} 
            opacity={0.4} 
            scale={10} 
            blur={2} 
            far={4} 
            resolution={256} 
          />
          
          {/* Grid */}
          <Grid 
            infiniteGrid 
            cellSize={0.5} 
            cellThickness={0.5} 
            sectionSize={2} 
            sectionThickness={1} 
            fadeDistance={30} 
            fadeStrength={1.5}
            cellColor="#A0A7B8" 
            sectionColor="#FFFFFF"
            position={[0, -3, 0]}
          />
          
          {/* Rocket model with physics */}
          <Suspense fallback={null}>
            <RocketSimulation 
              selected={!!selectedPart} 
              isLaunched={isLaunched} 
              throttle={throttle}
              resetTrigger={resetTrigger}
              setFlightData={updateFlightData}
            />
          </Suspense>
        </Canvas>
      </div>
    </>
  )
} 
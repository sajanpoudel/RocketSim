"use client"

import { useRef, useMemo, useState, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface RealisticRocketProps {
  rocketPath: THREE.CatmullRomCurve3
}

export function RealisticRocket({ rocketPath }: RealisticRocketProps) {
  const rocketRef = useRef<THREE.Group>(null)
  const engineGimbalRef = useRef<THREE.Group>(null)
  const timeRef = useRef<number>(0)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize after a delay to ensure Three.js objects are ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Advanced exhaust shader with realistic orange flame colors
  const exhaustShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          
          // Simulate fluid dynamics with vertex displacement
          vec3 pos = position;
          
          // Turbulent flow patterns
          float turbulence = sin(time * 15.0 + position.x * 8.0) * 0.02;
          turbulence += sin(time * 20.0 + position.x * 12.0 + position.y * 5.0) * 0.01;
          turbulence += sin(time * 30.0 + position.z * 10.0) * 0.005;
          
          // Apply turbulence based on distance from core (more at edges)
          float distFromCenter = length(vec2(position.y, position.z));
          float edgeFactor = smoothstep(0.0, 0.12, distFromCenter);
          
          pos.y += turbulence * edgeFactor;
          pos.z += turbulence * edgeFactor;
          
          // Expansion of gas as it exits nozzle
          float expansion = smoothstep(0.0, -1.5, position.x) * 0.1;
          pos.y *= 1.0 + expansion;
          pos.z *= 1.0 + expansion;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        uniform float intensity;
        uniform float mach;
        
        // Perlin noise function for realistic flame patterns
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          // First corner
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          // Other corners
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          // Permutations
          i = mod289(i);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
                  
          // Gradients: 7x7 points over a square, mapped onto an octahedron.
          float n_ = 0.142857142857; // 1.0/7.0
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          // Normalise gradients
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          // Mix final noise value
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        void main() {
          // Distance from center for radial gradient
          float dist = length(vec2(vPosition.y, vPosition.z));
          
          // Base flame shape
          float flame = 1.0 - smoothstep(0.0, 0.12, dist);
          
          // Realistic temperature gradient based on position in exhaust plume
          float temperature = smoothstep(-1.5, 0.0, vPosition.x); // Hotter near nozzle
          
          // Realistic orange flame colors
          vec3 coreColor = vec3(1.0, 0.9, 0.6);       // Bright yellow-orange core
          vec3 innerColor = vec3(1.0, 0.6, 0.2);      // Orange
          vec3 midColor = vec3(1.0, 0.4, 0.1);        // Deep orange
          vec3 outerColor = vec3(0.8, 0.2, 0.05);     // Red-orange
          vec3 edgeColor = vec3(0.4, 0.1, 0.02);      // Dark red
          
          // Noise for realistic flame patterns
          float noiseScale = 2.0;
          float noiseTime = time * 5.0;
          vec3 noiseCoord = vec3(vPosition.x * 2.0, vPosition.y * noiseScale, vPosition.z * noiseScale + noiseTime);
          float noise = snoise(noiseCoord) * 0.5 + 0.5;
          
          // Mach diamonds (shock diamonds) in supersonic exhaust
          float machPattern = 0.0;
          if (mach > 1.0) {
            float spacing = 0.3; // Distance between shock diamonds
            float diamonds = sin((vPosition.x + 0.5) / spacing * 3.14159) * 0.5 + 0.5;
            diamonds *= smoothstep(-1.5, -0.2, vPosition.x); // Only in certain part of exhaust
            diamonds *= smoothstep(0.12, 0.0, dist); // Only in center of exhaust
            machPattern = diamonds * mach * 0.3;
          }
          
          // Combine colors based on temperature and position
          vec3 color;
          if (temperature > 0.8) {
            color = mix(innerColor, coreColor, (temperature - 0.8) * 5.0);
          } else if (temperature > 0.5) {
            color = mix(midColor, innerColor, (temperature - 0.5) * 3.33);
          } else if (temperature > 0.2) {
            color = mix(outerColor, midColor, (temperature - 0.2) * 3.33);
          } else {
            color = mix(edgeColor, outerColor, temperature * 5.0);
          }
          
          // Add noise variation
          color = mix(color, color * 1.2, noise * 0.5);
          
          // Add mach diamonds (brighter orange regions)
          color = mix(color, vec3(1.0, 0.8, 0.4), machPattern);
          
          // Edge darkening for volume effect
          float edge = 1.0 - pow(1.0 - flame, 3.0);
          
          // Final color adjustments
          color *= 1.5; // Brightness boost
          
          // Opacity based on flame density and position
          float alpha = edge * intensity * (0.95 + noise * 0.05);
          alpha *= smoothstep(-3.0, 0.0, vPosition.x); // Fade out with distance
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
        intensity: { value: 1.0 },
        mach: { value: 2.5 }, // Supersonic exhaust
      },
    }
  }, [])

  // Realistic whitish-grey rocket materials with subtle 3D glow
  const rocketMaterials = useMemo(() => {
    return {
      // Main body - light grey with subtle glow
      hull: new THREE.MeshStandardMaterial({
        color: "#c0c0c0",
        roughness: 0.3,
        metalness: 0.6,
        envMapIntensity: 1.2,
        emissive: "#303030",
        emissiveIntensity: 0.02,
      }),

      // Nose cone - slightly lighter grey
      noseCone: new THREE.MeshStandardMaterial({
        color: "#c8c8c8",
        roughness: 0.25,
        metalness: 0.7,
        envMapIntensity: 1.3,
        emissive: "#353535",
        emissiveIntensity: 0.025,
      }),

      // Engine nozzles - dark metallic grey
      nozzle: new THREE.MeshStandardMaterial({
        color: "#606060",
        roughness: 0.2,
        metalness: 0.9,
        envMapIntensity: 1.0,
        emissive: "#1a1a1a",
        emissiveIntensity: 0.01,
      }),

      // Heat shield - charcoal with subtle glow
      heatShield: new THREE.MeshStandardMaterial({
        color: "#2a2a2a",
        roughness: 0.8,
        metalness: 0.2,
        emissive: "#0f0f0f",
        emissiveIntensity: 0.01,
      }),

      // Windows - blue tinted glass
      window: new THREE.MeshPhysicalMaterial({
        color: "#88ccff",
        roughness: 0.1,
        transmission: 0.9,
        thickness: 0.5,
        envMapIntensity: 1.5,
      }),

      // RCS thrusters - enhanced white with glow for post-processing
      rcs: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.25,
        metalness: 0.8,
        emissive: "#ffffff",
        emissiveIntensity: 0.08,
        envMapIntensity: 1.4,
      }),

      // Fuel tank panels - white with glow to match the rocket
      panels: new THREE.MeshStandardMaterial({
        color: "#d0d0d0",
        roughness: 0.3,
        metalness: 0.6,
        emissive: "#404040",
        emissiveIntensity: 0.02,
      }),

      // Grid fins - enhanced white with glow for post-processing
      fins: new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.25,
        metalness: 0.85,
        emissive: "#ffffff",
        emissiveIntensity: 0.1,
        envMapIntensity: 1.3,
      }),
    }
  }, [])

  useFrame((state) => {
    // Comprehensive safety checks
    try {
      if (!rocketRef.current || !rocketPath || !state || !isInitialized) return

      // Ensure all required state properties exist
      if (!state.clock || typeof state.clock.elapsedTime !== 'number') return

      timeRef.current += state.clock.elapsedTime - timeRef.current
      const time = timeRef.current

      const scrollProgress = typeof window !== 'undefined' 
        ? Math.min(window.scrollY / (document.body.scrollHeight - window.innerHeight), 1)
        : 0

      // Safety checks for rocketPath methods
      try {
        // Position rocket along path
        const position = rocketPath.getPoint(scrollProgress)
        if (!position) return

        const tangent = rocketPath.getTangent(scrollProgress)
        if (!tangent) return

        // Get next position for banking calculation
        const nextProgress = Math.min(scrollProgress + 0.01, 1)
        const nextPosition = rocketPath.getPoint(nextProgress)
        if (!nextPosition) return

        const direction = nextPosition.clone().sub(position).normalize()

        // Ensure rocketRef.current.position exists before copying
        if (rocketRef.current.position && typeof rocketRef.current.position.copy === 'function') {
          try {
            rocketRef.current.position.copy(position)
          } catch (copyError) {
            console.warn('Position copy error:', copyError)
          }
        }

        // Orient rocket to fly horizontally in direction of movement
        if (typeof rocketRef.current.lookAt === 'function') {
          try {
            rocketRef.current.lookAt(position.clone().add(direction))
          } catch (lookAtError) {
            console.warn('Rocket lookAt error:', lookAtError)
          }
        }

        // Add realistic banking for turns
        const nextTangent = rocketPath.getTangent(nextProgress)
        if (nextTangent && rocketRef.current.rotation) {
          try {
            const curvature = tangent.cross(nextTangent)
            const bankAngle = curvature.length() * 2
            if (typeof rocketRef.current.rotation.z === 'number') {
              rocketRef.current.rotation.z = bankAngle * Math.sign(curvature.y || 0)
            }
          } catch (bankingError) {
            console.warn('Banking error:', bankingError)
          }
        }

        // Add flight dynamics - pitch and yaw oscillations
        const pitchOsc = Math.sin(time * 0.5) * 0.01
        const yawOsc = Math.cos(time * 0.3) * 0.005
        
        if (rocketRef.current.rotation) {
          // Additional safety checks for rotation properties
          if (typeof rocketRef.current.rotation.x === 'number' && typeof rocketRef.current.rotation.y === 'number') {
            try {
              rocketRef.current.rotation.x += pitchOsc
              rocketRef.current.rotation.y += yawOsc
            } catch (rotationError) {
              console.warn('Rotation error:', rotationError)
            }
          }
        }

        // Engine gimbal for steering
        if (engineGimbalRef.current && engineGimbalRef.current.rotation) {
          // Additional safety checks for engine rotation properties
          if (typeof engineGimbalRef.current.rotation.x === 'number' && typeof engineGimbalRef.current.rotation.y === 'number') {
            try {
              // Counteract oscillations with engine steering
              engineGimbalRef.current.rotation.x = -pitchOsc * 3
              engineGimbalRef.current.rotation.y = -yawOsc * 3
            } catch (gimbalError) {
              console.warn('Gimbal error:', gimbalError)
            }
          }
        }

        // Update exhaust shader uniforms
        if (typeof rocketRef.current.traverse === 'function') {
          try {
            rocketRef.current.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material && child.material.type === "ShaderMaterial") {
                const material = child.material as THREE.ShaderMaterial
                if (material.uniforms) {
                  material.uniforms.time.value = time

                  // Vary exhaust intensity with acceleration
                  const acceleration =
                    scrollProgress > 0.01
                      ? (rocketPath.getPoint(scrollProgress + 0.01)?.distanceTo(position) || 0) -
                        (position.distanceTo(rocketPath.getPoint(scrollProgress - 0.01) || position)) *
                        100
                      : 0

                  const baseIntensity = 0.8 + Math.max(0, acceleration) * 0.5
                  material.uniforms.intensity.value = baseIntensity * (0.95 + Math.sin(time * 40) * 0.05)

                  // Mach number varies with speed
                  material.uniforms.mach.value = 1.5 + scrollProgress * 2.0
                }
              }
            })
          } catch (traverseError) {
            console.warn('Traverse error:', traverseError)
          }
        }
      } catch (animationError) {
        console.warn('Animation error:', animationError)
      }
    } catch (error) {
      console.warn('Error in rocket animation:', error)
    }
  })

  return (
    <group ref={rocketRef} scale={[1, 1, 1]}>
      {/* Subtle glow effect around entire rocket */}
      <pointLight position={[0, 0, 0]} intensity={0.1} color="#d0d0d0" distance={8} decay={2} />

      {/* Main fuselage - whitish grey with glow */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.18, 2.5, 32]} />
        <primitive object={rocketMaterials.hull} />
      </mesh>

      {/* Nose cone - lighter whitish grey */}
      <mesh position={[1.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.15, 0.5, 24]} />
        <primitive object={rocketMaterials.noseCone} />
      </mesh>

      {/* Crew capsule - light whitish grey */}
      <mesh position={[0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.17, 0.17, 0.6, 24]} />
        <primitive object={rocketMaterials.panels} />
      </mesh>

      {/* Windows */}
      {Array.from({ length: 4 }, (_, i) => {
        const angle = (i * Math.PI) / 2
        return (
          <mesh
            key={`window-${i}`}
            position={[0.8, Math.cos(angle) * 0.17, Math.sin(angle) * 0.17]}
            rotation={[0, angle, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.03, 0.03, 0.01, 12]} />
            <primitive object={rocketMaterials.window} />
          </mesh>
        )
      })}

      {/* Heat shield sections - dark with subtle glow */}
      <mesh position={[-0.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.3, 24]} />
        <primitive object={rocketMaterials.heatShield} />
      </mesh>

      {/* Fuel tanks with enhanced panel details - bright white with glow for post-processing */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4
        return (
          <mesh
            key={`panel-${i}`}
            position={[0, Math.cos(angle) * 0.16, Math.sin(angle) * 0.16]}
            rotation={[0, 0, angle]}
          >
            <planeGeometry args={[2.0, 0.1]} />
            <meshStandardMaterial 
              color="#ffffff"
              roughness={0.2}
              metalness={0.8}
              emissive="#ffffff"
              emissiveIntensity={0.15}
              envMapIntensity={1.5}
            />
          </mesh>
        )
      })}

      {/* Additional glowing accent lines for enhanced post-processing */}
      {Array.from({ length: 4 }, (_, i) => {
        const angle = (i * Math.PI) / 2
        return (
          <mesh
            key={`accent-${i}`}
            position={[0, Math.cos(angle) * 0.17, Math.sin(angle) * 0.17]}
            rotation={[0, 0, angle]}
          >
            <planeGeometry args={[2.2, 0.02]} />
            <meshStandardMaterial 
              color="#ffffff"
              roughness={0.1}
              metalness={0.9}
              emissive="#ffffff"
              emissiveIntensity={0.3}
              transparent
              opacity={0.8}
            />
          </mesh>
        )
      })}

      {/* Engine section with gimbals */}
      <group ref={engineGimbalRef} position={[-1.3, 0, 0]}>
        {/* Multiple engines with nozzles */}
        {Array.from({ length: 3 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 3
          const y = Math.cos(angle) * 0.08
          const z = Math.sin(angle) * 0.08

          return (
            <group key={`engine-${i}`}>
              {/* Engine bell - dark metallic */}
              <mesh position={[-0.1, y, z]} rotation={[0, 0, Math.PI / 2]}>
                <latheGeometry
                  args={[
                    [
                      new THREE.Vector2(0, 0),
                      new THREE.Vector2(0.04, 0),
                      new THREE.Vector2(0.06, 0.05),
                      new THREE.Vector2(0.08, 0.1),
                      new THREE.Vector2(0.1, 0.15),
                      new THREE.Vector2(0.12, 0.3),
                    ],
                    32,
                  ]}
                />
                <primitive object={rocketMaterials.nozzle} />
              </mesh>

              {/* Engine combustion chamber */}
              <mesh position={[-0.05, y, z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.06, 0.04, 0.1, 16]} />
                <primitive object={rocketMaterials.nozzle} />
              </mesh>

              {/* Fuel injectors */}
              <mesh position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.05, 0.06, 0.05, 16]} />
                <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.7} />
              </mesh>

              {/* Exhaust flames with orange colors */}
              <group>
                {/* Main exhaust plume - orange */}
                <mesh position={[-0.5, y, z]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[0.12, 2.5, 32, 1, true]} />
                  <shaderMaterial
                    vertexShader={exhaustShader.vertexShader}
                    fragmentShader={exhaustShader.fragmentShader}
                    uniforms={exhaustShader.uniforms}
                    transparent
                    side={THREE.DoubleSide}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                  />
                </mesh>

                {/* Inner core - bright orange */}
                <mesh position={[-0.3, y, z]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[0.04, 1.2, 16]} />
                  <meshBasicMaterial color="#ff6600" transparent opacity={0.9} />
                </mesh>

                {/* Mach diamonds - bright orange */}
                {Array.from({ length: 4 }, (_, j) => {
                  const distance = 0.3 + j * 0.3
                  return (
                    <mesh key={`diamond-${j}`} position={[-distance, y, z]} rotation={[0, 0, 0]}>
                      <sphereGeometry args={[0.05 - j * 0.01, 8, 8]} />
                      <meshBasicMaterial color="#ff8800" transparent opacity={0.8 - j * 0.15} />
                    </mesh>
                  )
                })}
              </group>
            </group>
          )
        })}
      </group>

      {/* Grid fins - medium whitish grey */}
      {Array.from({ length: 4 }, (_, i) => {
        const angle = (i * Math.PI) / 2
        const y = Math.cos(angle) * 0.2
        const z = Math.sin(angle) * 0.2

        return (
          <group key={`fin-${i}`}>
            <mesh position={[-0.5, y, z]} rotation={[0, 0, angle]}>
              <boxGeometry args={[0.05, 0.25, 0.01]} />
              <primitive object={rocketMaterials.fins} />
            </mesh>

            {/* Grid pattern */}
            {Array.from({ length: 3 }, (_, j) => (
              <mesh key={`grid-h-${j}`} position={[-0.5, y, z + (j - 1) * 0.05]} rotation={[0, 0, angle]}>
                <boxGeometry args={[0.05, 0.25, 0.01]} />
                <primitive object={rocketMaterials.fins} />
              </mesh>
            ))}

            {Array.from({ length: 3 }, (_, j) => (
              <mesh key={`grid-v-${j}`} position={[-0.5, y + (j - 1) * 0.05, z]} rotation={[0, 0, angle]}>
                <boxGeometry args={[0.05, 0.01, 0.25]} />
                <primitive object={rocketMaterials.fins} />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* RCS thrusters - medium grey with glow */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4
        const y = Math.cos(angle) * 0.16
        const z = Math.sin(angle) * 0.16

        return (
          <group key={`rcs-${i}`}>
            <mesh position={[0.5, y, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.01, 0.01, 0.05, 8]} />
              <primitive object={rocketMaterials.rcs} />
            </mesh>

            {/* RCS nozzle */}
            <mesh position={[0.5, y + 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.01, 0.02, 8]} />
              <primitive object={rocketMaterials.nozzle} />
            </mesh>

            {/* Occasional RCS firing effect - blue */}
            {Math.random() > 0.7 && (
              <mesh position={[0.5, y + 0.04, z]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.005, 0.03, 8]} />
                <meshBasicMaterial color="#88ccff" transparent opacity={0.7} />
              </mesh>
            )}
          </group>
        )
      })}

      {/* Exhaust trail particles with orange colors */}
      {Array.from({ length: 40 }, (_, i) => {
        const distance = i * 0.1
        const spread = i * 0.03
        const yOffset = Math.sin(i * 0.5) * spread * 0.5
        const zOffset = Math.cos(i * 0.7) * spread * 0.5

        return (
          <mesh key={`particle-${i}`} position={[-3.0 - distance, yOffset, zOffset]}>
            <sphereGeometry args={[0.02 + i * 0.001, 6, 6]} />
            <meshBasicMaterial
              color={i < 10 ? "#ff4400" : i < 20 ? "#ff6600" : i < 30 ? "#ff8800" : "#ffaa00"}
              transparent
              opacity={1.0 - i / 40}
            />
          </mesh>
        )
      })}

      {/* Heat distortion effect behind engines */}
      <mesh position={[-2.0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 1, 8, 8]} />
        <meshPhysicalMaterial
          transparent
          opacity={0.1}
          transmission={0.95}
          thickness={0.1}
          roughness={0.1}
          ior={1.5}
          
        />
      </mesh>
    </group>
  )
}

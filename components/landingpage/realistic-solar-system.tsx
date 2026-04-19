"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere } from "@react-three/drei"
import * as THREE from "three"

export function RealisticSolarSystem() {
  const earthRef = useRef<THREE.Group>(null)
  const marsRef = useRef<THREE.Group>(null)
  const jupiterRef = useRef<THREE.Group>(null)
  const saturnRef = useRef<THREE.Group>(null)
  const moonRef = useRef<THREE.Group>(null)
  const venusRef = useRef<THREE.Group>(null)
  const mercuryRef = useRef<THREE.Group>(null)
  const uranusRef = useRef<THREE.Group>(null)
  const neptuneRef = useRef<THREE.Group>(null)

  // Earth shader with realistic surface
  const earthShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        
        void main() {
          // Ocean color
          vec3 oceanColor = vec3(0.1, 0.3, 0.8);
          // Land color
          vec3 landColor = vec3(0.2, 0.6, 0.2);
          // Desert color
          vec3 desertColor = vec3(0.8, 0.7, 0.4);
          // Ice color
          vec3 iceColor = vec3(0.9, 0.9, 1.0);
          
          // Create continents using noise
          float continents = sin(vUv.x * 12.0) * sin(vUv.y * 8.0);
          continents += sin(vUv.x * 20.0 + 3.14) * sin(vUv.y * 15.0);
          continents = smoothstep(0.0, 0.3, continents);
          
          // Create ice caps
          float iceCaps = smoothstep(0.8, 1.0, abs(vUv.y - 0.5) * 2.0);
          
          // Mix colors
          vec3 color = mix(oceanColor, landColor, continents);
          color = mix(color, desertColor, continents * 0.3);
          color = mix(color, iceColor, iceCaps);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
    }
  }, [])

  // Mars shader with realistic surface features
  const marsShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Mars surface colors
          vec3 rustColor = vec3(0.8, 0.3, 0.2);
          vec3 darkColor = vec3(0.4, 0.2, 0.1);
          vec3 lightColor = vec3(0.9, 0.6, 0.4);
          vec3 poleColor = vec3(0.9, 0.9, 0.9);
          
          // Surface features
          float craters = sin(vUv.x * 25.0) * sin(vUv.y * 20.0);
          craters += sin(vUv.x * 40.0 + 1.57) * sin(vUv.y * 35.0);
          craters = smoothstep(-0.2, 0.2, craters);
          
          // Polar ice caps
          float poles = smoothstep(0.85, 1.0, abs(vUv.y - 0.5) * 2.0);
          
          // Valles Marineris (canyon system)
          float canyon = smoothstep(0.45, 0.55, vUv.y) * (1.0 - smoothstep(0.55, 0.65, vUv.y));
          canyon *= smoothstep(0.2, 0.8, vUv.x);
          
          vec3 color = mix(rustColor, darkColor, craters * 0.5);
          color = mix(color, lightColor, (1.0 - craters) * 0.3);
          color = mix(color, darkColor, canyon);
          color = mix(color, poleColor, poles);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    }
  }, [])

  // Jupiter shader with bands and Great Red Spot
  const jupiterShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        uniform float time;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        
        void main() {
          // Jupiter's atmospheric bands
          vec3 lightBand = vec3(0.9, 0.7, 0.5);
          vec3 darkBand = vec3(0.6, 0.4, 0.2);
          vec3 redSpot = vec3(0.8, 0.2, 0.1);
          
          // Create bands
          float bands = sin(vUv.y * 15.0 + time * 0.1) * 0.5 + 0.5;
          bands += sin(vUv.y * 25.0 + time * 0.15) * 0.3;
          
          // Great Red Spot
          vec2 spotCenter = vec2(0.3, 0.6);
          float spotDist = distance(vUv, spotCenter);
          float spot = 1.0 - smoothstep(0.05, 0.12, spotDist);
          
          // Atmospheric turbulence
          float turbulence = sin(vUv.x * 30.0 + time * 0.2) * sin(vUv.y * 20.0);
          turbulence *= 0.1;
          
          vec3 color = mix(darkBand, lightBand, bands + turbulence);
          color = mix(color, redSpot, spot);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
    }
  }, [])

  useFrame((state) => {
    const scrollProgress = typeof window !== 'undefined' 
      ? Math.min(window.scrollY / (document.body.scrollHeight - window.innerHeight), 1)
      : 0

    // Update shader uniforms
    if (earthRef.current) {
      const earthMesh = earthRef.current.children[0] as THREE.Mesh
      if (earthMesh?.material) {
        const material = earthMesh.material as THREE.ShaderMaterial
        if (material.uniforms) {
          material.uniforms.time.value = state.clock.elapsedTime
        }
      }
    }

    if (jupiterRef.current) {
      const jupiterMesh = jupiterRef.current.children[0] as THREE.Mesh
      if (jupiterMesh?.material) {
        const material = jupiterMesh.material as THREE.ShaderMaterial
        if (material.uniforms) {
          material.uniforms.time.value = state.clock.elapsedTime
        }
      }
    }

    // Planet rotations and positions
    if (earthRef.current) {
      const earthScale = 1.5 + scrollProgress * 0.8
      earthRef.current.scale.setScalar(earthScale)
      earthRef.current.position.set(150, -60, -800)
      earthRef.current.rotation.y += 0.004
    }

    if (marsRef.current) {
      marsRef.current.position.set(-200, 80, -1200)
      marsRef.current.rotation.y += 0.003
      marsRef.current.scale.setScalar(1.2)
    }

    if (jupiterRef.current) {
      jupiterRef.current.position.set(400, -100, -1800)
      jupiterRef.current.rotation.y += 0.002
      jupiterRef.current.scale.setScalar(2.0)
    }

    if (saturnRef.current) {
      saturnRef.current.position.set(-350, 150, -2200)
      saturnRef.current.rotation.y += 0.0015
      saturnRef.current.scale.setScalar(1.8)
    }

    if (moonRef.current) {
      const moonAngle = state.clock.elapsedTime * 0.5
      moonRef.current.position.set(
        150 + Math.cos(moonAngle) * 25,
        -60 + Math.sin(moonAngle) * 12,
        -800 + Math.sin(moonAngle) * 15,
      )
      moonRef.current.rotation.y += 0.002
    }

    if (venusRef.current) {
      venusRef.current.position.set(80, 40, -600)
      venusRef.current.rotation.y += 0.001
    }

    if (mercuryRef.current) {
      mercuryRef.current.position.set(50, 20, -400)
      mercuryRef.current.rotation.y += 0.008
    }

    if (uranusRef.current) {
      uranusRef.current.position.set(600, 200, -3000)
      uranusRef.current.rotation.y += 0.001
    }

    if (neptuneRef.current) {
      neptuneRef.current.position.set(-500, -200, -3500)
      neptuneRef.current.rotation.y += 0.0008
    }
  })

  return (
    <>
      {/* Mercury - realistic cratered surface */}
      <group ref={mercuryRef}>
        <Sphere args={[3, 32, 32]}>
          <meshStandardMaterial color="#8c7853" roughness={0.95} metalness={0.0} />
        </Sphere>
        {/* Mercury craters */}
        {Array.from({ length: 20 }, (_, i) => {
          const phi = Math.random() * Math.PI * 2
          const theta = Math.random() * Math.PI
          const radius = 3.05
          const x = radius * Math.sin(theta) * Math.cos(phi)
          const y = radius * Math.sin(theta) * Math.sin(phi)
          const z = radius * Math.cos(theta)

          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.1 + Math.random() * 0.3, 8, 8]} />
              <meshStandardMaterial color="#6a5d43" />
            </mesh>
          )
        })}
      </group>

      {/* Venus - thick atmosphere */}
      <group ref={venusRef}>
        <Sphere args={[4.5, 32, 32]}>
          <meshStandardMaterial color="#ffc649" roughness={0.6} metalness={0.0} />
        </Sphere>
        {/* Venus atmosphere layers */}
        <Sphere args={[4.7, 24, 24]}>
          <meshStandardMaterial color="#ffdd88" transparent opacity={0.4} />
        </Sphere>
        <Sphere args={[4.9, 20, 20]}>
          <meshStandardMaterial color="#ffee99" transparent opacity={0.2} />
        </Sphere>
      </group>

      {/* Earth - ultra-realistic */}
      <group ref={earthRef}>
        {/* Earth surface with continents */}
        <Sphere args={[5, 64, 64]}>
          <shaderMaterial
            vertexShader={earthShader.vertexShader}
            fragmentShader={earthShader.fragmentShader}
            uniforms={earthShader.uniforms}
          />
        </Sphere>

        {/* Cloud layer with realistic patterns */}
        <Sphere args={[5.2, 32, 32]}>
          <meshStandardMaterial color="#ffffff" transparent opacity={0.4} roughness={1.0} />
        </Sphere>

        {/* Atmosphere with Rayleigh scattering */}
        <Sphere args={[5.6, 32, 32]}>
          <meshBasicMaterial color="#87ceeb" transparent opacity={0.1} side={THREE.BackSide} />
        </Sphere>

        {/* City lights on night side */}
        <Sphere args={[5.05, 32, 32]}>
          <meshBasicMaterial color="#ffff88" transparent opacity={0.05} />
        </Sphere>

        {/* Aurora at poles */}
        <mesh position={[0, 5.8, 0]}>
          <torusGeometry args={[1, 0.2, 8, 16]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0, -5.8, 0]}>
          <torusGeometry args={[1, 0.2, 8, 16]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Moon - realistic with craters and maria */}
      <group ref={moonRef}>
        <Sphere args={[1.4, 32, 32]}>
          <meshStandardMaterial color="#c0c0c0" roughness={0.95} metalness={0.0} />
        </Sphere>
        {/* Lunar maria (dark patches) */}
        <Sphere args={[1.42, 20, 20]}>
          <meshStandardMaterial color="#888888" transparent opacity={0.3} />
        </Sphere>
        {/* Major craters */}
        {Array.from({ length: 15 }, (_, i) => {
          const phi = Math.random() * Math.PI * 2
          const theta = Math.random() * Math.PI
          const radius = 1.45
          const x = radius * Math.sin(theta) * Math.cos(phi)
          const y = radius * Math.sin(theta) * Math.sin(phi)
          const z = radius * Math.cos(theta)

          return (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[0.05 + Math.random() * 0.15, 8, 8]} />
              <meshStandardMaterial color="#999999" />
            </mesh>
          )
        })}
      </group>

      {/* Mars - ultra-realistic with surface features */}
      <group ref={marsRef}>
        <Sphere args={[4, 32, 32]}>
          <shaderMaterial vertexShader={marsShader.vertexShader} fragmentShader={marsShader.fragmentShader} />
        </Sphere>

        {/* Polar ice caps */}
        <mesh position={[0, 4.2, 0]}>
          <sphereGeometry args={[0.8, 12, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, -4.2, 0]}>
          <sphereGeometry args={[0.6, 12, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
        </mesh>

        {/* Olympus Mons (largest volcano) */}
        <mesh position={[2, 0, 2]}>
          <coneGeometry args={[0.5, 1, 12]} />
          <meshStandardMaterial color="#aa4444" />
        </mesh>

        {/* Thin atmosphere */}
        <Sphere args={[4.1, 20, 20]}>
          <meshBasicMaterial color="#ff6b47" transparent opacity={0.03} side={THREE.BackSide} />
        </Sphere>
      </group>

      {/* Jupiter - gas giant with realistic features */}
      <group ref={jupiterRef}>
        <Sphere args={[15, 64, 64]}>
          <shaderMaterial
            vertexShader={jupiterShader.vertexShader}
            fragmentShader={jupiterShader.fragmentShader}
            uniforms={jupiterShader.uniforms}
          />
        </Sphere>

        {/* Jupiter's moons */}
        {/* Io */}
        <mesh position={[20, 0, 0]}>
          <sphereGeometry args={[0.8, 12, 12]} />
          <meshStandardMaterial color="#ffff88" />
        </mesh>
        {/* Europa */}
        <mesh position={[-22, 5, 0]}>
          <sphereGeometry args={[0.7, 12, 12]} />
          <meshStandardMaterial color="#aaccff" />
        </mesh>
        {/* Ganymede */}
        <mesh position={[0, 25, 0]}>
          <sphereGeometry args={[1.2, 12, 12]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
        {/* Callisto */}
        <mesh position={[0, -28, 0]}>
          <sphereGeometry args={[1.1, 12, 12]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
      </group>

      {/* Saturn - realistic with complex ring system */}
      <group ref={saturnRef}>
        <Sphere args={[12, 48, 48]}>
          <meshStandardMaterial color="#fad5a5" roughness={0.8} metalness={0.0} />
        </Sphere>

        {/* Saturn's complex ring system */}
        {/* A Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[14, 18, 64]} />
          <meshBasicMaterial color="#c0c0c0" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        {/* Cassini Division */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[18.5, 19, 64]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* B Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[19.5, 24, 64]} />
          <meshBasicMaterial color="#d0d0d0" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* C Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[12, 14, 64]} />
          <meshBasicMaterial color="#a0a0a0" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
        {/* F Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[26, 26.5, 64]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* Titan (largest moon) */}
        <mesh position={[30, 0, 0]}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshStandardMaterial color="#cc8844" />
        </mesh>
      </group>

      {/* Uranus - ice giant with vertical rings */}
      <group ref={uranusRef}>
        <Sphere args={[8, 32, 32]}>
          <meshStandardMaterial color="#4fd0e3" roughness={0.6} metalness={0.0} />
        </Sphere>
        {/* Uranus rings - vertical orientation */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <ringGeometry args={[9, 11, 32]} />
          <meshBasicMaterial color="#666666" transparent opacity={0.4} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <ringGeometry args={[12, 13, 32]} />
          <meshBasicMaterial color="#555555" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Neptune - distant ice giant */}
      <group ref={neptuneRef}>
        <Sphere args={[7.5, 32, 32]}>
          <meshStandardMaterial color="#4169e1" roughness={0.6} metalness={0.0} />
        </Sphere>
        {/* Great Dark Spot */}
        <mesh position={[4, 0, 4]}>
          <sphereGeometry args={[1.5, 12, 12]} />
          <meshBasicMaterial color="#001144" transparent opacity={0.8} />
        </mesh>
        {/* Triton (largest moon) */}
        <mesh position={[15, 0, 0]}>
          <sphereGeometry args={[0.8, 12, 12]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      </group>
    </>
  )
}

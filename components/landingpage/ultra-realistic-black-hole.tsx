"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere } from "@react-three/drei"
import * as THREE from "three"

export function UltraRealisticBlackHole() {
  const blackHoleRef = useRef<THREE.Group>(null)
  const accretionDiskRef = useRef<THREE.Mesh>(null)
  const jetRef = useRef<THREE.Group>(null)
  const ergosphereRef = useRef<THREE.Mesh>(null)

  // Ultra-realistic accretion disk shader
  const accretionShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        uniform float time;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          
          vec3 pos = position;
          float radius = length(vec2(pos.x, pos.z));
          
          // Orbital motion - inner parts move faster
          float orbitalSpeed = 1.0 / (radius * 0.1 + 0.1);
          float angle = atan(pos.x, pos.z) + time * orbitalSpeed;
          
          // Vertical oscillation from magnetic fields
          pos.y += sin(angle * 8.0 + radius * 5.0) * 0.05 * radius;
          
          // Doppler shift effect
          float velocity = orbitalSpeed;
          pos += normal * sin(time * 10.0 + radius * 20.0) * 0.02;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        uniform float time;
        
        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center);
          float radius = dist * 2.0;
          
          // Temperature gradient (hotter closer to black hole)
          float temperature = 1.0 / (radius + 0.1);
          
          // Blackbody radiation colors
          vec3 coldColor = vec3(1.0, 0.2, 0.05);    // Red (cool)
          vec3 warmColor = vec3(1.0, 0.6, 0.1);     // Orange
          vec3 hotColor = vec3(1.0, 0.9, 0.4);      // Yellow
          vec3 veryHotColor = vec3(0.8, 0.9, 1.0);  // Blue-white (very hot)
          
          vec3 color;
          if (temperature < 0.3) {
            color = mix(coldColor, warmColor, temperature / 0.3);
          } else if (temperature < 0.6) {
            color = mix(warmColor, hotColor, (temperature - 0.3) / 0.3);
          } else {
            color = mix(hotColor, veryHotColor, (temperature - 0.6) / 0.4);
          }
          
          // Spiral structure
          float angle = atan(vUv.x - 0.5, vUv.y - 0.5);
          float spiral = sin(angle * 3.0 - radius * 15.0 + time * 2.0) * 0.5 + 0.5;
          
          // Turbulence
          float turbulence = sin(radius * 30.0 - time * 5.0) * 0.3 + 0.7;
          turbulence *= sin(angle * 8.0 + time * 3.0) * 0.2 + 0.8;
          
          // Disk structure
          float diskMask = smoothstep(0.15, 0.2, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
          
          // Relativistic beaming (matter moving toward us appears brighter)
          float beaming = sin(angle + time * 2.0) * 0.3 + 0.7;
          
          color *= spiral * turbulence * beaming;
          float alpha = diskMask * temperature * (0.7 + spiral * 0.3);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
    }
  }, [])

  // Relativistic jet shader
  const jetShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        
        void main() {
          vUv = uv;
          vPosition = position;
          
          vec3 pos = position;
          // Jet instabilities
          pos.x += sin(time * 3.0 + position.y * 0.1) * 0.5;
          pos.z += cos(time * 2.5 + position.y * 0.08) * 0.3;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float time;
        
        void main() {
          // Synchrotron radiation colors
          vec3 coreColor = vec3(0.8, 0.9, 1.0);     // Blue-white core
          vec3 edgeColor = vec3(0.2, 0.6, 1.0);     // Blue edge
          
          float dist = length(vUv - 0.5);
          float intensity = 1.0 - smoothstep(0.0, 0.5, dist);
          
          // Magnetic field structure
          float magnetic = sin(vPosition.y * 0.5 + time * 2.0) * 0.3 + 0.7;
          
          vec3 color = mix(edgeColor, coreColor, intensity);
          color *= magnetic;
          
          float alpha = intensity * 0.8;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
    }
  }, [])

  useFrame((state) => {
    if (blackHoleRef.current) {
      blackHoleRef.current.rotation.y += 0.01
    }

    if (accretionDiskRef.current) {
      const material = accretionDiskRef.current.material as THREE.ShaderMaterial
      if (material.uniforms) {
        material.uniforms.time.value = state.clock.elapsedTime
      }
    }

    if (jetRef.current) {
      jetRef.current.rotation.y += 0.005
      jetRef.current.children.forEach((jet, i) => {
        const material = (jet as THREE.Mesh).material as THREE.ShaderMaterial
        if (material.uniforms) {
          material.uniforms.time.value = state.clock.elapsedTime
        }
      })
    }

    if (ergosphereRef.current) {
      ergosphereRef.current.rotation.y += 0.02
    }
  })

  return (
    <group ref={blackHoleRef} position={[-600, 300, -1500]}>
      {/* Event Horizon - perfect black sphere */}
      <Sphere args={[20, 64, 64]}>
        <meshBasicMaterial color="#000000" />
      </Sphere>

      {/* Ergosphere - region where spacetime is dragged */}
      <Sphere ref={ergosphereRef} args={[22, 32, 32]}>
        <meshBasicMaterial color="#110011" transparent opacity={0.1} side={THREE.BackSide} />
      </Sphere>

      {/* Photon Sphere - unstable orbit for light */}
      <Sphere args={[30, 24, 24]}>
        <meshBasicMaterial color="#333333" transparent opacity={0.05} side={THREE.BackSide} />
      </Sphere>

      {/* Ultra-realistic Accretion Disk */}
      <mesh ref={accretionDiskRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[25, 120, 128]} />
        <shaderMaterial
          vertexShader={accretionShader.vertexShader}
          fragmentShader={accretionShader.fragmentShader}
          uniforms={accretionShader.uniforms}
          transparent
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner hot disk */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[22, 35, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Relativistic Jets */}
      <group ref={jetRef}>
        {/* North jet */}
        <mesh position={[0, 200, 0]}>
          <cylinderGeometry args={[3, 12, 300, 16]} />
          <shaderMaterial
            vertexShader={jetShader.vertexShader}
            fragmentShader={jetShader.fragmentShader}
            uniforms={jetShader.uniforms}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* South jet */}
        <mesh position={[0, -200, 0]}>
          <cylinderGeometry args={[3, 12, 300, 16]} />
          <shaderMaterial
            vertexShader={jetShader.vertexShader}
            fragmentShader={jetShader.fragmentShader}
            uniforms={jetShader.uniforms}
            transparent
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Gravitational Lensing Effect */}
      <pointLight intensity={8} color="#ff6600" distance={300} decay={1} />

      {/* X-ray emissions */}
      {Array.from({ length: 50 }, (_, i) => {
        const angle = (i / 50) * Math.PI * 2
        const radius = 40 + Math.random() * 60
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = (Math.random() - 0.5) * 10

        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.5, 6, 6]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.6} />
          </mesh>
        )
      })}

      {/* Hawking Radiation (theoretical) */}
      <Sphere args={[19.5, 16, 16]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.01} />
      </Sphere>
    </group>
  )
}

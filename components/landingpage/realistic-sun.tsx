"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere } from "@react-three/drei"
import * as THREE from "three"

export function RealisticSun() {
  const sunRef = useRef<THREE.Group>(null)
  const coronaRef = useRef<THREE.Mesh>(null)
  const solarFlareRef = useRef<THREE.Group>(null)

  // Enhanced sun surface shader
  const sunShader = useMemo(() => {
    return {
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normal;
          
          vec3 pos = position;
          // Solar surface granulation
          float noise1 = sin(time * 0.3 + position.y * 4.0) * 0.01;
          float noise2 = sin(time * 0.5 + position.x * 3.0) * 0.01;
          pos += normal * (noise1 + noise2);
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        varying vec3 vNormal;
        uniform float time;
        
        void main() {
          // Realistic solar surface colors
          vec3 coreColor = vec3(1.0, 1.0, 0.95);     // White hot center
          vec3 surfaceColor = vec3(1.0, 0.9, 0.4);   // Yellow surface
          vec3 spotColor = vec3(0.9, 0.5, 0.2);      // Sunspots
          vec3 flareColor = vec3(1.0, 0.7, 0.3);     // Solar flares
          
          // Surface granulation
          float noise1 = sin(time * 0.2 + vPosition.y * 5.0) * 0.5 + 0.5;
          float noise2 = sin(time * 0.3 + vPosition.x * 4.0) * 0.5 + 0.5;
          float noise3 = sin(time * 0.4 + vPosition.z * 3.0) * 0.5 + 0.5;
          
          // Sunspot patterns
          float spots = sin(vPosition.x * 8.0 + time * 0.1) * sin(vPosition.y * 6.0 + time * 0.15);
          spots = smoothstep(0.7, 1.0, spots);
          
          vec3 color = mix(surfaceColor, coreColor, noise1 * 0.8);
          color = mix(color, flareColor, noise2 * 0.3);
          color = mix(color, spotColor, spots * 0.4);
          
          // Add brightness variation
          color += vec3(noise3 * 0.1);
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        time: { value: 0 },
      },
    }
  }, [])

  useFrame((state) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.001
    }

    if (coronaRef.current) {
      coronaRef.current.rotation.y -= 0.0005
      coronaRef.current.rotation.x += 0.0002
    }

    if (solarFlareRef.current) {
      solarFlareRef.current.rotation.z += 0.002
    }

    // Update shader time
    const sunMesh = sunRef.current?.children[0] as THREE.Mesh
    if (sunMesh?.material) {
      const material = sunMesh.material as THREE.ShaderMaterial
      if (material.uniforms) {
        material.uniforms.time.value = state.clock.elapsedTime
      }
    }
  })

  return (
    <group ref={sunRef} position={[600, 300, -1000]}>
      {/* Sun core - smaller but still prominent */}
      <Sphere args={[25, 64, 64]}>
        <shaderMaterial
          vertexShader={sunShader.vertexShader}
          fragmentShader={sunShader.fragmentShader}
          uniforms={sunShader.uniforms}
        />
      </Sphere>

      {/* Solar corona - multiple layers */}
      <Sphere ref={coronaRef} args={[28, 32, 32]}>
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.15} side={THREE.BackSide} />
      </Sphere>

      <Sphere args={[32, 24, 24]}>
        <meshBasicMaterial color="#ff8800" transparent opacity={0.08} side={THREE.BackSide} />
      </Sphere>

      <Sphere args={[38, 16, 16]}>
        <meshBasicMaterial color="#ff6600" transparent opacity={0.04} side={THREE.BackSide} />
      </Sphere>

      {/* Sun as primary light source */}
      <pointLight intensity={8} color="#ffffff" distance={5000} decay={1} />

      {/* Solar flares - dynamic */}
      <group ref={solarFlareRef}>
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 12
          const distance = 30 + Math.sin(i) * 5
          const x = Math.cos(angle) * distance
          const y = Math.sin(angle) * distance

          return (
            <mesh key={i} position={[x, y, 0]}>
              <sphereGeometry args={[1 + Math.sin(i) * 0.5, 6, 6]} />
              <meshBasicMaterial color="#ffff00" transparent opacity={0.7} />
            </mesh>
          )
        })}
      </group>

      {/* Solar prominences */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i * Math.PI * 2) / 6
        const x = Math.cos(angle) * 26
        const y = Math.sin(angle) * 26
        const height = 8 + Math.sin(i * 2) * 4

        return (
          <mesh key={i} position={[x, y, 0]}>
            <cylinderGeometry args={[0.5, 1, height, 6]} />
            <meshBasicMaterial color="#ff4400" transparent opacity={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

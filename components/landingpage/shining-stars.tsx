"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

export function ShiningStars() {
  const starsRef = useRef<THREE.Points>(null)
  const brightStarsRef = useRef<THREE.Group>(null)

  // Generate shining stars
  const { positions, colors, sizes } = useMemo(() => {
    const count = 700 // Drastically reduced for performance
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Spherical distribution
      const radius = 200 + Math.random() * 2000
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)

      // Pure white shining stars with some variation
      const brightness = 0.8 + Math.random() * 0.2
      colors[i * 3] = brightness
      colors[i * 3 + 1] = brightness
      colors[i * 3 + 2] = brightness

      sizes[i] = 0.5 + Math.random() * 2
    }

    return { positions, colors, sizes }
  }, [])

  // Bright individual stars that twinkle - increased count
  const brightStars = useMemo(() => {
    const stars = []
    for (let i = 0; i < 30; i++) { // Reduced from 70 for performance
      const radius = 100 + Math.random() * 500
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      stars.push({
        position: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
        ],
        intensity: 0.5 + Math.random() * 1.5,
        twinkleSpeed: 1 + Math.random() * 3,
      })
    }
    return stars
  }, [])

  // Glowing star halos for depth
  const glowingStars = useMemo(() => {
    const stars = []
    for (let i = 0; i < 20; i++) { // Reduced from 45 for performance
      const radius = 150 + Math.random() * 800
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      stars.push({
        position: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
        ],
        size: 2 + Math.random() * 4,
        intensity: 0.3 + Math.random() * 0.7,
      })
    }
    return stars
  }, [])

  useFrame((state) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.00002
    }

    // Animate bright stars twinkling with safety checks
    if (brightStarsRef.current && brightStars && Array.isArray(brightStars) && brightStars.length > 0) {
      brightStarsRef.current.children.forEach((star, i) => {
        if (i < brightStars.length && brightStars[i]) {
          const brightStar = brightStars[i]
          if (brightStar && typeof brightStar.twinkleSpeed === 'number') {
            const twinkle = Math.sin(state.clock.elapsedTime * brightStar.twinkleSpeed) * 0.3 + 0.7
            if (star && star.scale && typeof star.scale.setScalar === 'function') {
              star.scale.setScalar(twinkle)
            }
          }
        }
      })
    }
  })

  // Safety check for arrays
  if (!positions || !colors || !sizes || positions.length === 0 || colors.length === 0 || sizes.length === 0) {
    return null
  }

  return (
    <>
      {/* Main starfield */}
      <points ref={starsRef}>
        <bufferGeometry>
          <bufferAttribute 
            attach="attributes-position" 
            count={Math.floor(positions.length / 3)} 
            array={positions} 
            itemSize={3} 
          />
          <bufferAttribute 
            attach="attributes-color" 
            count={Math.floor(colors.length / 3)} 
            array={colors} 
            itemSize={3} 
          />
          <bufferAttribute 
            attach="attributes-size" 
            count={sizes.length} 
            array={sizes} 
            itemSize={1} 
          />
        </bufferGeometry>
        <pointsMaterial
          size={1}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Bright twinkling stars */}
      <group ref={brightStarsRef}>
        {brightStars && Array.isArray(brightStars) && brightStars.map((star, i) => (
          star && star.position && Array.isArray(star.position) && star.position.length === 3 ? (
            <mesh key={i} position={star.position as [number, number, number]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial 
                color="#ffffff" 
                transparent 
                opacity={star.intensity || 0.5}
                emissive="#ffffff"
                emissiveIntensity={0.2}
                roughness={0}
                metalness={0}
              />
            </mesh>
          ) : null
        ))}
      </group>

      {/* Glowing star halos for enhanced depth */}
      <group>
        {glowingStars && Array.isArray(glowingStars) && glowingStars.map((star, i) => (
          star && star.position && Array.isArray(star.position) && star.position.length === 3 ? (
            <mesh key={`glow-${i}`} position={star.position as [number, number, number]}>
              <sphereGeometry args={[star.size || 2, 12, 12]} />
              <meshStandardMaterial 
                color="#ffffff" 
                transparent 
                opacity={star.intensity || 0.3}
                emissive="#ffffff"
                emissiveIntensity={0.1}
                roughness={0}
                metalness={0}
              />
            </mesh>
          ) : null
        ))}
      </group>
    </>
  )
}

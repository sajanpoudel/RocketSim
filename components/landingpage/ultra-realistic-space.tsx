"use client"

import { useRef, useMemo, useEffect, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"
import { RealisticRocket } from "./realistic-rocket"
import { ShiningStars } from "./shining-stars"
import { RealisticSolarSystem } from "./realistic-solar-system"
import { RealisticSun } from "./realistic-sun"
import { UltraRealisticBlackHole } from "./ultra-realistic-black-hole"

// Safe EffectComposer wrapper to prevent the undefined length error
function SafeEffectComposer() {
  const [isClient, setIsClient] = useState(false)
  const [effectsReady, setEffectsReady] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
    // Add extra delay to ensure everything is properly initialized
    const timer = setTimeout(() => {
      setEffectsReady(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Only render on client side and after delay
  if (!isClient || !effectsReady) {
    return null
  }

  try {
    // Dynamic import to avoid SSR issues
    const { EffectComposer, Bloom, ChromaticAberration, Vignette } = require('@react-three/postprocessing')
    
    return (
      <EffectComposer>
        <Bloom 
          intensity={3.0} 
          luminanceThreshold={0.15} 
          luminanceSmoothing={0.9} 
          height={300} 
        />
        <ChromaticAberration offset={[0.001, 0.001]} />
        <Vignette eskil={false} offset={0.05} darkness={0.2} />
      </EffectComposer>
    )
  } catch (error) {
    console.warn('EffectComposer failed to load:', error)
    return null
  }
}

export function UltraRealisticSpace() {
  const { camera, gl, scene } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize after a delay to ensure Three.js objects are ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Camera path following the rocket
  const cameraPath = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 3, 12), // Close behind rocket
      new THREE.Vector3(-8, 4, 25), // Follow left
      new THREE.Vector3(0, 6, 40), // Follow center
      new THREE.Vector3(12, 3, 60), // Follow right
      new THREE.Vector3(-5, 8, 85), // Follow left up
      new THREE.Vector3(0, 5, 110), // Final follow
    ]
    return new THREE.CatmullRomCurve3(points)
  }, [])

  const rocketPath = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 0, 0), // Start at origin
      new THREE.Vector3(-3, 2, 18), // Gentle arc
      new THREE.Vector3(0, 4, 35), // Rise
      new THREE.Vector3(5, 2, 55), // Right
      new THREE.Vector3(-2, 6, 80), // Left up
      new THREE.Vector3(0, 4, 105), // Final
    ]
    return new THREE.CatmullRomCurve3(points)
  }, [])

  useFrame((state) => {
    // Comprehensive safety checks
    try {
      // Safety checks for camera and state
      if (!camera || !camera.position || !state || !isInitialized) return

      // Ensure all required state properties exist
      if (!state.clock || typeof state.clock.elapsedTime !== 'number') return
      if (!state.mouse || typeof state.mouse.x !== 'number' || typeof state.mouse.y !== 'number') return

      const scrollProgress = typeof window !== 'undefined' 
        ? Math.min(window.scrollY / (document.body.scrollHeight - window.innerHeight), 1)
        : 0

      // Safety checks for path methods
      try {
        // Smooth camera movement
        const easedProgress = 1 - Math.pow(1 - scrollProgress, 2.5)
        const cameraPosition = cameraPath?.getPoint(easedProgress)
        const rocketPosition = rocketPath?.getPoint(easedProgress)

        if (!cameraPosition || !rocketPosition) return

        // Ensure camera position is valid before lerping
        if (camera.position && typeof camera.position.lerp === 'function') {
          try {
            camera.position.lerp(cameraPosition, 0.03)
          } catch (lerpError) {
            console.warn('Camera lerp error:', lerpError)
          }
        }

        // Look at rocket with slight mouse influence
        if (state.mouse && typeof state.mouse.x === 'number' && typeof state.mouse.y === 'number') {
          try {
            const mouseInfluence = new THREE.Vector3(state.mouse.x * 2, state.mouse.y * 1, 0)
            const lookTarget = rocketPosition.clone().add(mouseInfluence)
            if (typeof camera.lookAt === 'function') {
              camera.lookAt(lookTarget)
            }
          } catch (lookAtError) {
            console.warn('Camera lookAt error:', lookAtError)
          }
        }

        // Minimal camera shake
        if (camera.position && state.clock && typeof state.clock.elapsedTime === 'number') {
          // Additional safety checks for camera position properties
          if (typeof camera.position.x === 'number' && typeof camera.position.y === 'number') {
            try {
              camera.position.x += Math.sin(state.clock.elapsedTime * 0.3) * 0.02
              camera.position.y += Math.cos(state.clock.elapsedTime * 0.2) * 0.01
            } catch (shakeError) {
              console.warn('Camera shake error:', shakeError)
            }
          }
        }
      } catch (animationError) {
        console.warn('Animation error:', animationError)
      }
    } catch (error) {
      console.warn('Error in camera animation:', error)
    }
  })

  return (
    <>
      {/* Pure black space background */}
      <color attach="background" args={["#000000"]} />

      {/* Enhanced realistic lighting setup */}
      <ambientLight intensity={0.02} color="#ffffff" />

      {/* Sun as primary light source with enhanced intensity */}
      <directionalLight
        position={[1000, 500, 500]}
        intensity={4}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
      />

      {/* Enhanced secondary rim lighting */}
      <directionalLight position={[-500, 200, -300]} intensity={1} color="#4a90e2" />

      {/* Additional fill light for better visibility */}
      <directionalLight position={[0, -300, 200]} intensity={0.3} color="#ff6600" />

      {/* Pure black space with shining stars */}
      <ShiningStars />

      {/* Realistic Sun */}
      <RealisticSun />

      {/* Ultra-realistic Solar System */}
      <RealisticSolarSystem />

      {/* Ultra-realistic Black Hole */}
      <UltraRealisticBlackHole />

      {/* Bigger, more visible rocket */}
      <RealisticRocket rocketPath={rocketPath} />

      {/* Safe post-processing effects */}
      <SafeEffectComposer />
    </>
  )
}

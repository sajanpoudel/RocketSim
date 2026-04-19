"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Canvas } from "@react-three/fiber"
import { useAuth } from "@/lib/auth/AuthContext"
import { UltraRealisticSpace } from "@/components/landingpage/ultra-realistic-space"
import { ContentOverlay } from "@/components/landingpage/content-overlay"
import { LoadingScreen } from "@/components/landingpage/loading-screen"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Redirect authenticated users to simulator
  useEffect(() => {
    if (user && !loading) {
      router.push('/simulator')
    }
  }, [user, loading, router])

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-[600vh] bg-black overflow-hidden cosmic-glow">
      {/* Enhanced star field background */}
      <div className="star-field"></div>
      
      {/* Ultra-realistic 3D Space Environment with cosmic glow */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{
            fov: 45,
            near: 0.1,
            far: 100000,
            position: [0, 10, 30],
          }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: true,
          }}
          dpr={[1, 2]}
        >
          <Suspense fallback={<LoadingScreen />}>
            <UltraRealisticSpace />
          </Suspense>
        </Canvas>
      </div>

      {/* Content Overlay */}
      <ContentOverlay />
    </div>
  )
} 
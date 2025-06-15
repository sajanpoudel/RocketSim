"use client"

export function LoadingScreen() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-center">
        <div className="w-20 h-20 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-white font-sans font-light text-xl">Initializing rocket systems...</p>
      </div>
    </div>
  )
}

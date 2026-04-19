import './globals.css'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rocketez - AI-Powered Rocket Engineering Platform',
  description: 'Design, simulate, and optimize rockets with AI assistance. Professional-grade rocket engineering platform with real-time 3D visualization and advanced physics simulation.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="noise-bg font-sans min-h-screen bg-black text-white">
        <AuthProvider>
          {children}
          <Toaster 
            position="top-right"
            theme="dark"
            richColors
            closeButton
          />
        </AuthProvider>
      </body>
    </html>
  )
} 
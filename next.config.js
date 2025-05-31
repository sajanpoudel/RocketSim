/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Ensure transpilation of @react-three packages
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  output: 'standalone',
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  env: {
    AGENT_URL: process.env.AGENT_URL || 'http://localhost:8002',
    ROCKETPY_URL: process.env.ROCKETPY_URL || 'http://localhost:8000',
  },
  async rewrites() {
    return [
      {
        source: '/api/agent/:path*',
        destination: '/api/agent/:path*',
      },
    ]
  }
}

module.exports = nextConfig 
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  async rewrites() {
    const backendUrl = process.env.USE_LOCAL_BACKEND === 'true'
      ? 'http://localhost:8080'
      : 'https://pepzi-backend-1029121217006.europe-west1.run.app';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/login',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/signup',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        source: '/onboarding',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;

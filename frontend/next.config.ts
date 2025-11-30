import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Default to production backend, only use localhost for explicit local dev
    const backendUrl = process.env.USE_LOCAL_BACKEND === 'true'
      ? 'http://localhost:8080'
      : 'https://pepzi-backend-1029121217006.europe-west2.run.app';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

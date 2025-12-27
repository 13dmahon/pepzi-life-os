import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  async rewrites() {
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

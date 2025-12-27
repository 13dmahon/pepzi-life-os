import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Pepzi - AI Life OS';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #e2e8f0 0%, #f8fafc 50%, #e2e8f0 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Mountain silhouette background */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: 'absolute', bottom: 0, left: 0, opacity: 0.15 }}
        >
          <polygon
            points="0,630 200,350 400,450 600,250 800,400 1000,300 1200,500 1200,630"
            fill="#334155"
          />
          <polygon
            points="0,630 150,400 350,500 550,320 750,450 950,350 1200,550 1200,630"
            fill="#475569"
          />
        </svg>

        {/* Logo/Icon */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 19h20L12 2z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 10v4M12 18h.01"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          Pepzi
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: '#64748b',
            marginBottom: 40,
          }}
        >
          Your AI-powered life operating system
        </div>

        {/* Features row */}
        <div
          style={{
            display: 'flex',
            gap: 24,
          }}
        >
          {['Set Goals', 'AI Plans', 'Track Progress'].map((feature) => (
            <div
              key={feature}
              style={{
                padding: '12px 24px',
                background: 'rgba(255, 255, 255, 0.7)',
                borderRadius: 100,
                fontSize: 20,
                color: '#475569',
                border: '1px solid rgba(255, 255, 255, 0.8)',
              }}
            >
              {feature}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 24,
            color: '#94a3b8',
          }}
        >
          pepzi.io
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
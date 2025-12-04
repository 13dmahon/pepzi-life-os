import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import { AuthProvider } from '@/lib/auth-context';
import TopNav from '@/components/TopNav';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Pepzi - AI Life OS',
  description: 'Your AI-powered life operating system',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pepzi',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="font-sans antialiased min-h-screen bg-gray-50">
        <Providers>
          <AuthProvider>
            <TopNav />
            {children}
            <BottomNav />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
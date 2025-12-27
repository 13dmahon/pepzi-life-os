import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import { AuthProvider } from '@/lib/auth-context';
import TopNav from '@/components/TopNav';
import BottomNav from '@/components/BottomNav';
import { NavigationProvider } from '@/components/NavigationContext';

export const metadata: Metadata = {
  title: 'Pepzi - AI Life OS',
  description: 'Your AI-powered life operating system. Set goals, get personalized AI plans, and track your progress to reach any summit.',
  metadataBase: new URL('https://www.pepzi.io'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Pepzi',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'Pepzi - AI Life OS',
    description: 'Your AI-powered life operating system. Transform your goals into reality.',
    url: 'https://www.pepzi.io',
    siteName: 'Pepzi',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pepzi - AI Life OS',
    description: 'Your AI-powered life operating system. Transform your goals into reality.',
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
            <NavigationProvider>
              <TopNav />
              {children}
              <BottomNav />
            </NavigationProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
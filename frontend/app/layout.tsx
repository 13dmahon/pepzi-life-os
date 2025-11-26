import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Pepzi - AI Life OS',
  description: 'Your AI-powered life operating system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
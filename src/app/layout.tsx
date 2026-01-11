import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ŠkolaWeb',
  description: 'Informační systém pro český školní systém',
  manifest: '/manifest.webmanifest',
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#facc15',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={`${inter.variable} font-body antialiased`}>
        <FirebaseClientProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}

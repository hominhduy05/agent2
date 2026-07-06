import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/context/ThemeContext';
import { SidebarProvider } from '@/components/context/SidebarContext';
import { AuthProvider } from '@/components/dashboard/AuthProvider';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Pione Trace — Smart Agriculture',
  description:
    'AI-powered durian ripeness detection and quality inspection dashboard',
  icons: {
    icon: '/pione_trace.svg',
    shortcut: '/pione_trace.svg',
    apple: '/pione_trace.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <SidebarProvider>
            <AuthProvider>
              <Toaster position="top-right" />
              {children}
              </AuthProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'WealthFlow',
  description: '포트폴리오 모바일 대시보드',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WealthFlow',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="white" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body style={{ margin: 0, padding: 0, background: 'white' }}>
        {children}
      </body>
    </html>
  );
}

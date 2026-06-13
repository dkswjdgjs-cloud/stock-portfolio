import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GLOW | Portfolio Analytics',
  description: '주식 포트폴리오 관리 대시보드',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  appleWebApp: {
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

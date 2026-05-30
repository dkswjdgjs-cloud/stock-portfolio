import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WEALTHFLOW | Portfolio Analytics',
  description: '주식 포트폴리오 관리 대시보드',
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

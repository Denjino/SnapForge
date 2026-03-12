import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapForge — Bulk URL Screenshots',
  description: 'Capture screenshots of multiple URLs with viewport presets',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        className="min-h-screen bg-surface-0 text-gray-200 antialiased"
      >
        {children}
      </body>
    </html>
  );
}

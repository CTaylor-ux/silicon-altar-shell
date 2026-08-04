import type { Metadata } from 'next';
import { SessionProvider } from '@/lib/session';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'The Silicon Altar',
  description: 'A forensic audit of the American Levant, in seven windows.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same two families the Window documents load, requested the same way,
            so shell and timeline never disagree about type. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* Browser extensions inject attributes into <body> before React
          hydrates — ColorZilla adds cz-shortcut-listen, password managers and
          grammar tools add their own — and every one of them throws a
          hydration mismatch in dev that looks like an app bug and is not.
          This suppresses the warning for THIS element's attributes only; a
          genuine mismatch in the tree below still reports normally. */}
      <body suppressHydrationWarning>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

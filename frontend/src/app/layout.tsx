import './globals.css';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = { title: 'HydroPak Admin', description: 'Water Bottle Business Admin' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${mono.variable} min-h-screen app-gradient`} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
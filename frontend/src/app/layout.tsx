import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

import { ToastProvider } from "@/components/ui/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Signal Clone",
  description: "A Signal Messenger clone",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} min-h-full flex flex-col font-sans`}>
        <ToastProvider>
          <Suspense fallback={null}>
            <AuthGuard>
              {children}
            </AuthGuard>
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}

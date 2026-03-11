import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Agentation } from 'agentation';
import { AppTourRoot } from "@/components/organisms/AppTour";
import { JotaiProvider } from "@/components/providers/JotaiProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Document Parser",
  description: "Document Parser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>

      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <Agentation />
          <JotaiProvider>
            <AppTourRoot>{children}</AppTourRoot>
          </JotaiProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

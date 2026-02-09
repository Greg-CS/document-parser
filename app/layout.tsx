import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Agentation } from 'agentation';
import { AppTourRoot } from "@/components/organisms/AppTour";

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
        <script
        src="https://embed.sandbox.array.io/cms/array-web-component.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>
        <script
        src="https://embed.sandbox.array.io/cms/array-account-login.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>

        <script
        src="https://embed.sandbox.array.io/cms/array-account-enroll.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>

        <script
        src="https://embed.array.io/cms/array-credit-report.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>
        {/* for production */}
        
        {/* 
        <script
        src="https://embed.array.io/cms/array-web-component.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>
        <script
        src="https://embed.array.io/cms/array-account-enroll.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script> 
        <script
        src="https://embed.sandbox.array.io/cms/array-web-component.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>
        <script
        src="https://embed.sandbox.array.io/cms/array-account-login.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script>*/}
        {/* <script
        src="https://embed.array.io/cms/array-account-login.js?appKey=3F03D20E-5311-43D8-8A76-E4B5D77793BD"
        ></script> */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Agentation />
        <AppTourRoot>{children}</AppTourRoot>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FORGE — The Adaptive Training OS",
  description:
    "One app for training, nutrition, recovery, and community. Adaptive workouts that rewrite themselves around your equipment, your energy, and your time.",
  applicationName: "FORGE",
  keywords: ["gym", "workout tracker", "fitness app", "nutrition", "AI coach", "strength training"],
  openGraph: {
    type: "website",
    siteName: "FORGE",
    images: [
      {
        url: "/favicon.ico",
        width: 1024,
        height: 1024,
        alt: "FORGE — The Adaptive Training OS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/favicon.ico"],
    title: "FORGE — The Adaptive Training OS",
    description:
      "One app for training, nutrition, recovery, and community.",
  },
};

export const viewport: Viewport = {
  themeColor: "#060708",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-ink text-chalk antialiased">{children}</body>
    </html>
  );
}

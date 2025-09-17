import type React from "react"
import type { Metadata } from "next"

import { Inter, Roboto_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] });

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "PrismAI - Intelligent Business Automation Platform",
  description:
    "Refract your business potential through AI with comprehensive automation, intelligent customer service, and seamless integrations. Transform operations with PrismAI.",
  keywords: [
    "PrismAI",
    "business automation",
    "AI platform",
    "intelligent automation",
    "customer service",
    "business intelligence",
  ],
  authors: [{ name: "PrismAI Team" }],
  openGraph: {
    title: "PrismAI - Intelligent Business Automation Platform",
    description:
      "Refract your business potential through AI with comprehensive automation, intelligent customer service, and seamless integrations.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PrismAI - Intelligent Business Automation Platform",
    description:
      "Refract your business potential through AI with comprehensive automation, intelligent customer service, and seamless integrations.",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.className} antialiased`}>
      <body className="font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  )
}

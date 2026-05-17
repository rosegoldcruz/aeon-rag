import type React from "react"
import type { Metadata } from "next"
import type { Viewport } from "next"
import { Space_Grotesk, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "AEON Ops",
  description: "AEON Ops private workspace",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="AEON Ops" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/site.webmanifest?v=20260517-1" />
        <link rel="shortcut icon" href="/favicon.ico?v=20260517-1" />
        <link rel="icon" href="/favicon.ico?v=20260517-1" />
        <link rel="icon" href="/favicon-16x16.png?v=20260517-1" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png?v=20260517-1" sizes="32x32" type="image/png" />
        <link rel="icon" href="/AEON.svg?v=20260517-1" type="image/svg+xml" />
        <link
          rel="apple-touch-icon"
          href="/apple-touch-icon.png?v=20260517-1"
          sizes="180x180"
          type="image/png"
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

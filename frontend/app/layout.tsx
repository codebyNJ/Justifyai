import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Doto } from "next/font/google"
import dynamic from "next/dynamic"
import "./globals.css"

const cormorantGaramond = {
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cormorant",
}

const doto = Doto({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-doto",
})

const NavbarApp = dynamic(() => import("@/components/navbar-app"), { ssr: true })

export const metadata: Metadata = {
  title: "Justify AI - Agentic Credit Intelligence",
  description: "Don't Guess, Know. Professional credit intelligence powered by AI.",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${doto.variable} dark antialiased overflow-x-hidden`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap"
          rel="stylesheet"
        />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
  --font-doto: ${doto.style.fontFamily};
  --font-cormorant: 'Cormorant Garamond', serif;
}
        `}</style>
      </head>
      <body className="min-h-dvh bg-black text-foreground overflow-x-hidden pt-20">
        <NavbarApp />
        {children}
      </body>
    </html>
  )
}

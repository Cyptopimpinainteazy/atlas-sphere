import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Solana DEX - Atlas Sphere",
  description: "Decentralized Exchange powered by Solana and Atlas Sphere",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

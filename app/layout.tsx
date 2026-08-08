import type { Metadata } from 'next'
import { Newsreader, Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

/* A warm, screen-first editorial serif. The didone we tried before had the drama but not
   the warmth, and a color-analysis studio should feel considered rather than severe.
   Newsreader is variable across weight and carries an optical-size axis, so headlines take
   the display cut and the smaller lines stay sturdy instead of thinning to hairlines. */
const display = Newsreader({
  variable: '--font-display',
  subsets: ['latin'],
  style: ['normal', 'italic'],
})

/* A quiet grotesque underneath, so the serif does all the talking. */
const sans = Instrument_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
})

/* The 2026 editorial look pairs a display serif with a utilitarian mono for metadata, and
   that suits this app unusually well: the numbers are the argument. Hex codes, delta E and
   the small caps labels are measurements, so they should look like measurements. */
const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Drape: Find the colors made for you',
  description:
    'Your skin decides your palette. Drape reads your undertone and dresses you in the colors that actually flatter you, then lets you try them on. Powered by YouCam AI.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      {/* Grammarly and friends write their own attributes onto <body> before React
          hydrates, which React then reports as a mismatch against markup we did not
          write and cannot control. Suppression applies to this element only, one level
          deep, so a genuine mismatch anywhere inside the app is still reported. */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
